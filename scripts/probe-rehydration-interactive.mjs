/**
 * Interactive rehydration probe.
 *
 * Opens a real browser, navigates to V2 prod, and waits for YOU to
 * sign in via Clerk. Once you're signed in (detected by the chat
 * textarea appearing), the probe:
 *
 *   1. Captures a screenshot of the loaded chat
 *   2. Types a test message containing real PII ("John Smith of 123 Mowry Avenue")
 *   3. Submits, waits for the agent to finish streaming
 *   4. Captures the LIVE bubble state
 *   5. Hard-reloads the page (the bug reproducer)
 *   6. Captures the POST-RELOAD bubble state
 *   7. Reports verdict: real names visible? tokens visible?
 *
 * Run: node scripts/probe-rehydration-interactive.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'https://california-law-chatbot-v2.vercel.app';
const TEST_PII = 'please draft a will for John Smith of 123 Mowry Avenue in Fremont';
const OUT = '/tmp/rehydration-interactive';
mkdirSync(OUT, { recursive: true });

// Persistent user-data dir so cookies survive between runs.
const USER_DATA = '/tmp/playwright-v2-userdata';

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1400, height: 900 },
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function bubbles() {
  return await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(
      '[class*="rounded-2xl"], [class*="rounded-3xl"], [class*="bg-pink"]'
    ));
    return els.map(e => e.textContent?.trim()).filter(t => t && t.length > 10 && t.length < 4000);
  });
}

console.log(`\n=== opening ${BASE_URL}/v2 ===`);
await page.goto(`${BASE_URL}/v2`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await shot('01-opened');

console.log(`
=== WAITING FOR YOU TO SIGN IN ===

Please sign in in the browser window I just opened.
After you land on /v2 and see the chat textarea, the probe will
proceed automatically. You have up to 5 minutes.
`);

// Wait up to 5 min for the chat textarea to appear (which means we're
// on /v2 post-signin, NOT on Clerk's sign-in page).
const textarea = page.locator('textarea').first();
await textarea.waitFor({ timeout: 5 * 60 * 1000 });

console.log('\n=== signed in, chat textarea visible — running test flow ===\n');
await page.waitForTimeout(2000);
await shot('02-signed-in');

// Type the test PII
console.log(`  typing: "${TEST_PII}"`);
await textarea.click();
await textarea.fill(TEST_PII);
await page.waitForTimeout(2500); // chip preview debounce
await shot('03-typed');

// Submit
const submit = page.locator('button[type="submit"]').first();
await submit.click();
console.log('  ✓ submitted');

await page.waitForTimeout(3000);
await shot('04-just-after-submit');

// Capture LIVE bubble (should show real names — never broken in live state)
const liveBubbles = await bubbles();
const liveUser = liveBubbles.find(b => /will|John|Smith|Mowry|CLIENT_/.test(b));
console.log(`  LIVE user bubble: ${JSON.stringify(liveUser?.slice(0, 250))}`);

// Wait for the agent to finish streaming
console.log('  waiting ~25s for agent stream to finish...');
await page.waitForTimeout(25000);
await shot('05-stream-done');

// Hard reload — THIS is the bug reproducer
const beforeReloadUrl = page.url();
console.log(`\n  reloading ${beforeReloadUrl}`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await shot('06-after-reload');

const reloadBubbles = await bubbles();
const reloadUser = reloadBubbles.find(b => /will|John|Smith|Mowry|CLIENT_|ADDRESS_/.test(b));
console.log(`\n=== POST-RELOAD USER BUBBLE ===`);
console.log(JSON.stringify(reloadUser?.slice(0, 400)));

const HAS_REAL = /John Smith|Mowry/.test(reloadUser || '');
const HAS_TOKEN = /CLIENT_|ADDRESS_/.test(reloadUser || '');
console.log(`\n  Real names visible?  ${HAS_REAL}`);
console.log(`  Tokens visible?      ${HAS_TOKEN}`);
console.log(`\n  VERDICT: ${HAS_REAL && !HAS_TOKEN ? '✅ FIX WORKS' : HAS_TOKEN ? '❌ BUG STILL PRESENT' : '⚠ INCONCLUSIVE'}`);

console.log('\n--- console errors during run ---');
for (const l of logs.filter(x => x.type === 'error' || x.type === 'pageerror').slice(0, 10)) {
  console.log(`  [${l.type}] ${l.text}`);
}

console.log(`\nScreenshots: ${OUT}/`);
console.log('Browser stays open for 30s so you can inspect — close it any time.');
await page.waitForTimeout(30000);
await ctx.close();
