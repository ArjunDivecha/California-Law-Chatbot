/**
 * A.5 / Phase A exit criterion 5: token map persists across browser
 * reload. Per 6th-addendum Option C the token map lives in
 * device-local IndexedDB; the SAME real name should serialize to the
 * SAME `@@TOKEN@@` placeholder across page loads.
 *
 * The probe:
 *   1. Loads /v2, gets a fresh device key + IndexedDB.
 *   2. Types a message containing "Maria Rodriguez" and submits.
 *      Captures the outbound network body — extracts the `@@CLIENT_xxx@@`
 *      token that replaced "Maria Rodriguez".
 *   3. Reloads the page (same browser context — IndexedDB persists).
 *   4. Types another message that ALSO contains "Maria Rodriguez".
 *      Captures the outbound network body — extracts that token.
 *   5. Asserts the two tokens are IDENTICAL.
 *
 * If the same name maps to two different tokens across reloads, the
 * IndexedDB store isn't persisting (or the device key was regenerated).
 *
 * Requires:
 *   - dev-server.js on :3000 (the V2 API target)
 *   - vite dev server on :5173
 *   - OPF daemon at https://localhost:47822 (Option C primary detector)
 *     OR the chat hook will surface a `sanitizer_unavailable` error
 *     and the probe will fail at step 2.
 *
 * Status if OPF daemon not running:
 *   Probe exits 2 (precondition failure) with a clear message. This
 *   distinguishes "daemon down" from "tokenization broken."
 */

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const { clerkSetup, clerk } = await import('@clerk/testing/playwright');

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
for (const l of lines) {
  const m = l.match(/^CLERK_SECRET_KEY=(\S+)/);
  if (m && /califrnia law chatbot/i.test(l)) { process.env.CLERK_SECRET_KEY = m[1]; break; }
}
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';
await clerkSetup();

// The same browser-context is re-used across reloads to preserve
// localStorage + IndexedDB. Each page navigation re-mounts the
// SanitizerProvider, which should open the same IndexedDB.
// Headless Chromium needs to ignore self-signed cert errors to reach
// the local OPF daemon at https://localhost:47822.
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

// Capture network bodies for analysis
const outbound = [];
page.on('request', (req) => {
  if (req.url().includes('/api/agent/turn-stream') && req.method() === 'POST') {
    try { outbound.push({ at: Date.now(), body: req.postData() ?? '' }); } catch {}
  }
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });

// === First send ===
await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Verify sanitizer initialized + OPF reachable (precondition).
const sanitState1 = await page.evaluate(() => ({
  deviceKey: window.localStorage.getItem('cla-sanitization-device-key')?.slice(0, 16) ?? null,
  hasIDB: typeof indexedDB !== 'undefined',
}));
console.log('round 1 sanitizer state:', JSON.stringify(sanitState1));

const TEST_NAME = 'Maria Rodriguez';
const PROMPT_1 = `Please draft an email to my client ${TEST_NAME} confirming her appointment.`;
console.log(`\nround 1 prompt: ${JSON.stringify(PROMPT_1)}`);

await page.locator('textarea').first().fill(PROMPT_1);
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);

if (outbound.length === 0) {
  console.error('PRECONDITION FAIL: no outbound POST captured after first send.');
  console.error('Likely cause: OPF daemon at localhost:47822 unreachable → tokenizeForWire threw → fetch never fired.');
  console.error('Errors:', errors.slice(0, 5));
  await browser.close();
  process.exit(2);
}

const body1 = outbound[0].body;
const userText1 = (() => {
  try { return JSON.parse(body1).user_text; } catch { return null; }
})();
console.log('round 1 wire user_text:', userText1);

// Token format is `CLIENT_001` from previewSession.ts (no @@ wrappers).
const TOKEN_RE = /\bCLIENT_\d+\b/;
const token1 = (userText1 ?? '').match(TOKEN_RE)?.[0];
if (!token1) {
  console.error('FAIL: no @@CLIENT_xxx@@ token in round-1 outbound. Browser sent raw or empty.');
  console.error('raw user_text was:', JSON.stringify(userText1).slice(0, 300));
  await browser.close();
  process.exit(1);
}
console.log(`round 1 token for "${TEST_NAME}": ${token1}`);

// === Reload the page (same context — IndexedDB persists) ===
console.log('\n--- reloading /v2 ---');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const sanitState2 = await page.evaluate(() => ({
  deviceKey: window.localStorage.getItem('cla-sanitization-device-key')?.slice(0, 16) ?? null,
}));
console.log('round 2 sanitizer state:', JSON.stringify(sanitState2));
if (sanitState1.deviceKey !== sanitState2.deviceKey) {
  console.error('FAIL: device key rotated across reload — IndexedDB token map would not survive.');
  await browser.close();
  process.exit(1);
}

// === Second send — same name ===
const outboundCountBefore = outbound.length;
const PROMPT_2 = `Send a reminder to ${TEST_NAME} about Tuesday's hearing.`;
console.log(`\nround 2 prompt: ${JSON.stringify(PROMPT_2)}`);
await page.locator('textarea').first().fill(PROMPT_2);
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);

if (outbound.length <= outboundCountBefore) {
  console.error('FAIL: no outbound POST captured after second send.');
  await browser.close();
  process.exit(1);
}

const body2 = outbound[outbound.length - 1].body;
const userText2 = (() => {
  try { return JSON.parse(body2).user_text; } catch { return null; }
})();
console.log('round 2 wire user_text:', userText2);
const token2 = (userText2 ?? '').match(TOKEN_RE)?.[0];
if (!token2) {
  console.error('FAIL: no @@CLIENT_xxx@@ token in round-2 outbound.');
  await browser.close();
  process.exit(1);
}
console.log(`round 2 token for "${TEST_NAME}": ${token2}`);

// === Assertion ===
mkdirSync('reports', { recursive: true });
const verdict = {
  generated_at: new Date().toISOString(),
  test_name: TEST_NAME,
  device_key_prefix: sanitState1.deviceKey,
  round_1: { wire: userText1, token: token1 },
  round_2: { wire: userText2, token: token2 },
  same_token: token1 === token2,
  pass: token1 === token2,
};
writeFileSync('reports/token-map-persistence.json', JSON.stringify(verdict, null, 2));

console.log('\n=== Verdict ===');
console.log(`round 1 token: ${token1}`);
console.log(`round 2 token: ${token2}`);
console.log(token1 === token2 ? '✅ PASS — same token across reload' : '❌ FAIL — token rotated across reload');
console.log('\nReport: reports/token-map-persistence.json');

await browser.close();
process.exit(token1 === token2 ? 0 : 1);
