/**
 * Reproduces and verifies the 2026-05-18 rehydration bug:
 * V2 chat bubbles showed CLIENT_001/ADDRESS_001 after session reload
 * because the hydrate path skipped rehydrateMessagesForDisplay.
 *
 * Flow:
 *   1. Sign in via Clerk dev-mode test email + OTP 424242
 *   2. Navigate to /v2 (fresh session)
 *   3. Type a sentence with a real name + address
 *   4. Capture bubble pre-submit
 *   5. Submit, wait for turn to finish
 *   6. Capture bubble + assistant response
 *   7. Reload the page (this is where the bug manifests)
 *   8. Capture bubble post-reload — should still show the real name
 *
 * Run: BASE_URL=<preview-or-prod-url> node scripts/probe-rehydration-bug.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'https://california-law-chatbot-v2.vercel.app';
const TEST_EMAIL = process.env.TEST_EMAIL || 'rehydrate.test+clerk_test@example.com';
const TEST_PII = 'i want to create a will for John Smith of 123 Mowry Avenue';
const OUT = '/tmp/rehydration-bug';
mkdirSync(OUT, { recursive: true });

// Vercel preview URLs are gated by SSO. Pass the project's automation
// bypass secret via header so Playwright reaches the actual app, not
// the Vercel auth wall. The secret is minted via the Vercel REST API
// (PATCH /v1/projects/:id/protection-bypass) and stored locally.
let BYPASS = '';
try { BYPASS = readFileSync('/tmp/v2-bypass-secret', 'utf8').trim(); } catch {}

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1400, height: 900 },
  extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : {},
});
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text().slice(0, 200) }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  ✓ shot ${name}`);
}

async function getBubbleTexts() {
  return await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('[class*="rounded-2xl"], [class*="rounded-3xl"], [class*="bg-pink"]'));
    return bubbles
      .map(b => b.textContent?.trim())
      .filter(t => t && t.length > 10 && t.length < 2000);
  });
}

console.log(`\n=== probe ${BASE_URL}/v2 ===`);

try {
  // 1. Hit /v2 — should redirect to Clerk sign-in
  await page.goto(`${BASE_URL}/v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot('01-landing');

  // 2. Clerk sign-in (dev mode accepts +clerk_test@example.com emails)
  const emailInput = page.locator('input[name="identifier"], input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[clerk] email step');
    await emailInput.fill(TEST_EMAIL);
    await shot('02-email');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(3000);
    await shot('03-otp-step');

    // OTP — Clerk dev test users accept 424242
    const otpInputs = page.locator('input[autocomplete="one-time-code"], input[name="code"]');
    const count = await otpInputs.count();
    console.log(`  OTP inputs found: ${count}`);
    if (count > 1) {
      // Split-digit OTP UI (Clerk's default) — type into each
      const digits = '424242'.split('');
      for (let i = 0; i < Math.min(count, digits.length); i++) {
        await otpInputs.nth(i).fill(digits[i]);
      }
    } else if (count === 1) {
      await otpInputs.first().fill('424242');
    } else {
      // Hidden single input — type into focused element
      await page.keyboard.type('424242');
    }
    await page.waitForTimeout(4000);
    await shot('04-after-otp');
  } else {
    console.log('[clerk] already signed in or different UI');
  }

  // 3. Should be on /v2 now
  await page.waitForURL(/\/v2/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('05-v2-loaded');

  // 4. Type PII and submit
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ timeout: 10000 });
  await textarea.fill(TEST_PII);
  await page.waitForTimeout(2000); // chip preview debounce
  await shot('06-typed-before-submit');

  const preSubmitBubbles = await getBubbleTexts();
  console.log(`  pre-submit visible bubbles: ${preSubmitBubbles.length}`);

  const submitBtn = page.locator('button[type="submit"], button:has-text("Send")').first();
  await submitBtn.click();
  console.log('  ✓ submitted');

  // 5. Wait for the user bubble to appear + assistant streaming to start
  await page.waitForTimeout(3000);
  await shot('07-just-after-submit');

  // 6. Capture user bubble (should show real name on live submit)
  const liveBubbles = await getBubbleTexts();
  const userBubble = liveBubbles.find(b => b.includes('will for') || b.includes('CLIENT_') || b.includes('John Smith'));
  console.log(`  LIVE user bubble: ${JSON.stringify(userBubble?.slice(0, 200))}`);

  // 7. Wait for assistant to finish streaming a bit
  await page.waitForTimeout(15000);
  await shot('08-after-stream');

  // 8. Hard reload — this is the bug reproducer
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await shot('09-after-reload');

  const reloadedBubbles = await getBubbleTexts();
  const reloadedUser = reloadedBubbles.find(b => b.includes('will') || b.includes('CLIENT_') || b.includes('John Smith') || b.includes('Mowry'));
  console.log(`\n=== POST-RELOAD USER BUBBLE ===`);
  console.log(JSON.stringify(reloadedUser?.slice(0, 400)));

  // Decision: bug fixed if bubble contains "John Smith" or "Mowry" (the real values).
  // Bug present if bubble contains "CLIENT_" or "ADDRESS_" tokens instead.
  const HAS_REAL = reloadedUser?.includes('John Smith') || reloadedUser?.includes('Mowry');
  const HAS_TOKEN = reloadedUser?.includes('CLIENT_') || reloadedUser?.includes('ADDRESS_');
  console.log(`\nReal names visible? ${HAS_REAL}`);
  console.log(`Tokens visible?     ${HAS_TOKEN}`);
  console.log(`Verdict: ${HAS_REAL && !HAS_TOKEN ? 'FIX WORKS' : 'BUG STILL PRESENT'}`);

  console.log('\n--- console errors ---');
  for (const l of logs.filter(x => x.type === 'error' || x.type === 'pageerror')) {
    console.log(`  [${l.type}] ${l.text}`);
  }
} finally {
  await page.waitForTimeout(2000);
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}/`);
