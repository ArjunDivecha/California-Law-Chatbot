/**
 * v2 of the rehydration probe — uses Vercel bypass + Clerk dev sign-in via the
 * email+OTP flow that ships with pk_test_* instances. Also surfaces page state
 * better so we can see what's actually rendering at each step.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'https://california-law-chatbot-v2-33twm99ai.vercel.app';
const TEST_PII = 'i want to create a will for John Smith of 123 Mowry Avenue';
const OUT = '/tmp/rehydration-bug';
mkdirSync(OUT, { recursive: true });

let BYPASS = '';
try { BYPASS = readFileSync('/tmp/v2-bypass-secret', 'utf8').trim(); } catch {}

const browser = await chromium.launch({ headless: false, slowMo: 100 });
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1400, height: 900 },
  extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : {},
});
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));
page.on('requestfailed', r => logs.push({ type: 'reqfail', text: `${r.url()} ${r.failure()?.errorText}` }));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const url = page.url();
  const title = await page.title().catch(() => '');
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 400) || '(no body)').catch(() => '(err)');
  console.log(`  [${name}] url=${url}`);
  console.log(`    title=${title}`);
  console.log(`    body=${text.replace(/\n+/g, ' | ').slice(0, 300)}`);
}

console.log(`\n=== probe ${BASE_URL}/v2 ===`);

try {
  await page.goto(`${BASE_URL}/v2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await shot('01-landing');

  // Click "Sign up" link first — sign-in only works for existing users.
  // Clerk dev mode accepts +clerk_test@example.com pattern + OTP 424242
  // when creating new test users via Sign Up.
  const signUpLink = page.getByRole('link', { name: 'Sign up' }).or(page.locator('a:has-text("Sign up")')).first();
  if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  clicking Sign up link');
    await signUpLink.click();
    await page.waitForTimeout(2000);
  }

  // Sign Up form: email field
  const emailInput = page.locator('input[name="emailAddress"], input[name="identifier"], input[type="email"]').first();
  const hasEmail = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  email input visible: ${hasEmail}`);

  if (hasEmail) {
    // Use a fresh test email each run so we always sign up (not signing in)
    const email = `probe-${Date.now()}+clerk_test@example.com`;
    console.log(`  signing up as ${email}`);
    await emailInput.fill(email);
    await shot('02-email-filled');
    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await continueBtn.click();
    await page.waitForTimeout(3000);
    await shot('03-otp-step');

    // OTP. Clerk dev test users (identifier ending +clerk_test@example.com)
    // accept the fixed code 424242.
    const otpInputs = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"], input[name="code"]');
    const otpCount = await otpInputs.count();
    console.log(`  OTP inputs: ${otpCount}`);
    if (otpCount > 1) {
      const digits = '424242'.split('');
      for (let i = 0; i < Math.min(otpCount, 6); i++) {
        await otpInputs.nth(i).fill(digits[i]);
      }
    } else if (otpCount === 1) {
      await otpInputs.first().fill('424242');
    } else {
      // Type into focused
      await page.keyboard.type('424242');
    }
    await page.waitForTimeout(5000);
    await shot('04-after-otp');
  }

  // After sign-in, the app should land on /v2 with a textarea
  await page.waitForTimeout(2000);
  await shot('05-post-signin');

  const textarea = page.locator('textarea').first();
  const hasTextarea = await textarea.isVisible({ timeout: 15000 }).catch(() => false);
  console.log(`  textarea visible: ${hasTextarea}`);

  if (!hasTextarea) {
    console.log('\n  Textarea not visible — capturing rich state for diagnosis.');
    writeFileSync(`${OUT}/console-logs.json`, JSON.stringify(logs, null, 2));
    const html = await page.content();
    writeFileSync(`${OUT}/page.html`, html);
    console.log(`  Wrote ${OUT}/page.html (${html.length} bytes) and console-logs.json`);
  } else {
    // Type and submit
    await textarea.fill(TEST_PII);
    await page.waitForTimeout(2500);
    await shot('06-typed');

    const submit = page.locator('button[type="submit"]').first();
    await submit.click();
    await page.waitForTimeout(20000);
    await shot('07-after-stream');

    // Hard reload — bug reproducer
    const sessionUrl = page.url();
    console.log(`  session url before reload: ${sessionUrl}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    await shot('08-after-reload');

    // Read bubble texts
    const bubbles = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.prose, [class*="rounded-2xl"], [class*="rounded-3xl"], [class*="bg-pink"]'));
      return els.map(e => e.textContent?.trim()).filter(t => t && t.length > 10 && t.length < 2000);
    });
    const userBubble = bubbles.find(b => b.includes('will') || b.includes('John') || b.includes('CLIENT_') || b.includes('Mowry'));
    console.log(`\n  === POST-RELOAD BUBBLE ===`);
    console.log(`  ${JSON.stringify(userBubble?.slice(0, 300))}`);
    const HAS_REAL = userBubble?.includes('John Smith') || userBubble?.includes('Mowry');
    const HAS_TOKEN = userBubble?.includes('CLIENT_') || userBubble?.includes('ADDRESS_');
    console.log(`\n  real-names? ${HAS_REAL}   tokens? ${HAS_TOKEN}`);
    console.log(`  VERDICT: ${HAS_REAL && !HAS_TOKEN ? '✅ FIX WORKS' : '❌ STILL BROKEN'}`);
  }

  console.log('\n--- console errors ---');
  for (const l of logs.filter(x => x.type === 'error' || x.type === 'pageerror')) {
    console.log(`  [${l.type}] ${l.text}`);
  }
} finally {
  await page.waitForTimeout(1000);
  await browser.close();
}
