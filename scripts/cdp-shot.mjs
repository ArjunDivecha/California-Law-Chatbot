/**
 * Connect to the long-lived headed Chrome (CDP on 9223), screenshot the
 * active app tab, leave the browser open. Reused every turn during the
 * live UI-iteration session.
 *
 * Usage:
 *   node scripts/cdp-shot.mjs [outPath] [gotoUrl]
 * If gotoUrl is given, navigates the tab there first.
 */
import { chromium } from 'playwright';

const out = process.argv[2] || '/tmp/v2-live/shot.png';
const gotoUrl = process.argv[3] || null;

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
// Pick the localhost app tab if present, else the first page.
let page = ctx.pages().find(p => p.url().includes('localhost:5173'))
        || ctx.pages().find(p => !p.url().startsWith('chrome'))
        || ctx.pages()[0];

if (gotoUrl) {
  await page.goto(gotoUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

await page.screenshot({ path: out, fullPage: false }).catch(async () => {
  await page.screenshot({ path: out });
});

const url = page.url();
const title = await page.title().catch(() => '');
console.log(JSON.stringify({ url, title, out }));

// Detach WITHOUT closing the browser.
await browser.close();
