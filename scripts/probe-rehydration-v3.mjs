/**
 * v3: actually reproduces the bug-scene from the user's screenshot.
 *
 * The original screenshot was a SESSION URL (/v2/<sessionId>) where
 * tokens were visible. v2 of this probe stayed on /v2 (welcome) so
 * the reload landed on the welcome page — never reproducing the bug.
 *
 * v3 flow:
 *   1. Reuse the cookies from /tmp/playwright-v2-userdata (already signed in)
 *   2. Land on /v2 — type + submit a turn so a session lands in KV
 *   3. Wait for the stream to finish
 *   4. Click the topmost sidebar item → navigates to /v2/<sessionId>
 *   5. Reload — THIS is the bug repro point
 *   6. Read the user bubble: real names ✅ / tokens ❌
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'https://california-law-chatbot-v2.vercel.app';
const TEST_PII = 'please draft a will for John Smith of 123 Mowry Avenue in Fremont';
const OUT = '/tmp/rehydration-v3';
const USER_DATA = '/tmp/playwright-v2-userdata';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1400, height: 900 },
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
// Close any restored tabs from previous sessions (Google searches etc.)
// — we want a fresh page that goes straight to /v2.
for (const p of ctx.pages()) await p.close().catch(() => {});
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  ✓ ${name}.png  url=${page.url()}`);
}

async function bubbles() {
  return await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(
      '[class*="rounded-2xl"], [class*="rounded-3xl"], [class*="bg-pink"]'
    ));
    return els.map(e => e.textContent?.trim()).filter(t => t && t.length > 10 && t.length < 4000);
  });
}

console.log(`\n=== opening ${BASE_URL}/v2 (reusing prior cookies) ===`);
await page.goto(`${BASE_URL}/v2`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// Either we're signed in (textarea visible) or we need to sign in.
const textarea = page.locator('textarea').first();
const signedIn = await textarea.isVisible({ timeout: 5000 }).catch(() => false);
if (!signedIn) {
  console.log('\n=== WAITING for you to sign in (up to 5 min) ===\n');
  await textarea.waitFor({ timeout: 5 * 60 * 1000 });
}
await shot('01-loaded-signed-in');

// Type & submit
console.log(`  typing: "${TEST_PII}"`);
await textarea.click();
await textarea.fill(TEST_PII);
await page.waitForTimeout(2500);
await shot('02-typed');
await page.locator('button[type="submit"]').first().click();
console.log('  ✓ submitted, waiting ~30s for assistant to finish + session to land in KV...');
await page.waitForTimeout(30000);
await shot('03-stream-done');

// Find the just-created session in the sidebar. V2Sidebar renders
// session buttons with `title={s.session_id}` and the title text
// inside. The session_id starts with `v2_` or `v2d_`. Filter by that
// `title` attribute — much more specific than text matching.
console.log('  looking for sidebar session item (button[title^="v2"])...');
const sessionBtn = page.locator('aside button[title^="v2_"], aside button[title^="v2d_"]').first();
const sessionAvail = await sessionBtn.isVisible({ timeout: 15000 }).catch(() => false);
console.log(`  sidebar session item visible: ${sessionAvail}`);
if (!sessionAvail) {
  console.log('  ⚠ no session item with v2_ prefix in sidebar — aborting');
  await shot('04-no-session');
  await page.waitForTimeout(20000);
  await ctx.close();
  process.exit(2);
}
const sessionLabel = await sessionBtn.textContent();
console.log(`    topmost session title: ${JSON.stringify(sessionLabel?.slice(0, 100))}`);
await sessionBtn.click();
await page.waitForTimeout(4000);
await shot('04-after-sidebar-click');

const sessionUrl = page.url();
console.log(`\n  session URL: ${sessionUrl}`);
if (!sessionUrl.match(/\/v2\/[^/]+/)) {
  console.log('  ⚠ URL is not /v2/<id> — bug repro requires session URL. Aborting.');
  await page.waitForTimeout(20000);
  await ctx.close();
  process.exit(2);
}

// THE BUG REPRO POINT — hard reload
console.log('\n  === HARD RELOAD ===');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await shot('05-after-reload');

const reloadBubbles = await bubbles();
const reloadUser = reloadBubbles.find(b => /will|John|Smith|Mowry|CLIENT_|ADDRESS_/.test(b));
console.log(`\n=== POST-RELOAD BUBBLE ===`);
console.log(JSON.stringify(reloadUser?.slice(0, 500)));

const HAS_REAL = /John Smith|Mowry/.test(reloadUser || '');
const HAS_TOKEN = /CLIENT_|ADDRESS_/.test(reloadUser || '');
console.log(`\n  Real names visible?  ${HAS_REAL}`);
console.log(`  Tokens visible?      ${HAS_TOKEN}`);
console.log(`\n  VERDICT: ${HAS_REAL && !HAS_TOKEN ? '✅ FIX WORKS' : HAS_TOKEN ? '❌ BUG STILL PRESENT' : '⚠ INCONCLUSIVE'}`);

console.log('\n--- console errors ---');
for (const l of logs.filter(x => x.type === 'error' || x.type === 'pageerror').slice(0, 8)) {
  console.log(`  [${l.type}] ${l.text}`);
}
console.log(`\nScreenshots: ${OUT}/`);
console.log('Browser stays open 30s for inspection.');
await page.waitForTimeout(30000);
await ctx.close();
