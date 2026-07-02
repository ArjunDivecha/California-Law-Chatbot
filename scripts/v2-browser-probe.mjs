/**
 * Diagnostic Playwright probe for /v2 — captures console errors, network
 * failures, and the final DOM state. Use when the screenshot says
 * "blank page" to figure out WHY.
 *
 * Drives Playwright via its Node API (chromium.launch) rather than the
 * CLI's `screenshot` subcommand because the CLI doesn't expose console-
 * event hooks. The global playwright install (v1.57.0) lives at
 * ~/.nvm/versions/node/v24.12.0/lib/node_modules/playwright; resolve it
 * from there so we don't need a local node_modules install.
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

// Resolve playwright from the GLOBAL nvm install — no local node_modules
// dep on the V2 project for this probe.
const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');

const URL_TO_PROBE = process.argv[2] || 'http://localhost:5173/v2';
const SCREENSHOT_PATH = process.argv[3] || join(repoRoot, 'docs/screenshots/v2-probe-2026-05-13.png');

mkdirSync(dirname(SCREENSHOT_PATH), { recursive: true });

console.log(`Probing: ${URL_TO_PROBE}`);
console.log(`Screenshot: ${SCREENSHOT_PATH}`);
console.log('─'.repeat(70));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleEvents = [];
page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
const pageErrors = [];
page.on('pageerror', (err) => {
  pageErrors.push({ message: err.message, stack: err.stack });
});
const networkFailures = [];
page.on('requestfailed', (req) => {
  networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
});
const responseStatuses = [];
page.on('response', (resp) => {
  if (resp.status() >= 400) {
    responseStatuses.push({ url: resp.url(), status: resp.status() });
  }
});

try {
  await page.goto(URL_TO_PROBE, { waitUntil: 'networkidle', timeout: 30000 });
} catch (err) {
  console.log(`Navigation error: ${err.message}`);
}

const url = page.url();
const title = await page.title();
const bodyHtml = await page.evaluate(() => document.body?.innerHTML?.slice(0, 4000) ?? '(no body)');
const bodyText = await page.evaluate(() => document.body?.innerText ?? '(no body)');
const rootHtml = await page.evaluate(() => document.getElementById('root')?.outerHTML?.slice(0, 2000) ?? '(no #root)');

console.log(`Final URL:   ${url}`);
console.log(`Title:       ${title}`);
console.log();
console.log('=== Page errors ===');
if (pageErrors.length === 0) console.log('  (none)');
for (const e of pageErrors) console.log(`  ${e.message}`);
console.log();
console.log('=== Console (errors + warnings) ===');
for (const e of consoleEvents) {
  if (['error', 'warning'].includes(e.type)) console.log(`  [${e.type}] ${e.text.slice(0, 300)}`);
}
console.log();
console.log('=== Network failures + 4xx/5xx ===');
for (const f of networkFailures) console.log(`  FAIL ${f.url}  ${f.failure}`);
for (const s of responseStatuses) console.log(`  ${s.status}  ${s.url}`);
console.log();
console.log('=== #root outerHTML (first 2KB) ===');
console.log(rootHtml);
console.log();
console.log('=== body innerText (first 1KB) ===');
console.log(bodyText.slice(0, 1000));

await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

await browser.close();
console.log();
console.log(`Screenshot written: ${SCREENSHOT_PATH}`);
