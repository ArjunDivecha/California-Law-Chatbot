/**
 * Smoke probe for the ported /v2/magic page. Verifies the page mounts,
 * renders the 5 workflow tabs, and surfaces no console errors.
 *
 * Run while `npm run dev` is up on :5173 and dev-server.js on :3000.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');

const { clerkSetup, clerk } = await import('@clerk/testing/playwright');

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
let key;
for (const l of lines) {
  const m = l.match(/^CLERK_SECRET_KEY=(\S+)/);
  if (m && /califrnia law chatbot/i.test(l)) { key = m[1]; break; }
}
process.env.CLERK_SECRET_KEY = key;
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

await clerkSetup();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[error] ${m.text().slice(0, 300)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
await page.goto('http://localhost:5173/v2/magic', { waitUntil: 'networkidle' });
await new Promise((r) => setTimeout(r, 2000));

const url = page.url();
const title = await page.title();
const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText);

// The codex page has 5 workflow tabs: inputs, compare, strategy, draft, review
const tabsFound = await page.evaluate(() => {
  const labels = ['inputs', 'compare', 'strategy', 'draft', 'review'];
  const seen = {};
  for (const label of labels) {
    const el = Array.from(document.querySelectorAll('button, [role="tab"], a')).find((n) =>
      n.innerText && n.innerText.toLowerCase().includes(label),
    );
    seen[label] = Boolean(el);
  }
  return seen;
});

const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 800));

await page.screenshot({ path: '/tmp/v2-magic-port.png', fullPage: false });

console.log('URL:', url);
console.log('TITLE:', title);
console.log('H1:', h1);
console.log('TABS_PRESENT:', JSON.stringify(tabsFound));
console.log('BODY_START:', bodyStart);
console.log('ERRORS:', errors.slice(0, 10));
console.log('SCREENSHOT: /tmp/v2-magic-port.png');

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
