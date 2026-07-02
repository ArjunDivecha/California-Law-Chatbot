import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');
import { clerkSetup, clerk } from '@clerk/testing/playwright';

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
let key;
for (const l of lines) { const m = l.match(/^CLERK_SECRET_KEY=(\S+)/); if (m && /califrnia law chatbot/i.test(l)) { key = m[1]; break; } }
process.env.CLERK_SECRET_KEY = key;
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

await clerkSetup();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });

await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });
console.log('At /v2: URL=', page.url(), 'subtitle=', await page.evaluate(() => Array.from(document.querySelectorAll('span')).map(s => s.textContent).find(t => /V2/.test(t || ''))));

console.log('Clicking Verify Citation Link...');
await page.getByRole('button', { name: /Verify Citation/i }).click();
await page.waitForTimeout(2000);
console.log('After click: URL=', page.url());
console.log('Subtitle now:', await page.evaluate(() => Array.from(document.querySelectorAll('span')).map(s => s.textContent).find(t => /V2/.test(t || ''))));
console.log('Body heading:', await page.evaluate(() => document.querySelector('h2')?.textContent));

await page.goto('http://localhost:5173/v2/verify', { waitUntil: 'networkidle' });
console.log('Direct /v2/verify: URL=', page.url(), 'subtitle=', await page.evaluate(() => Array.from(document.querySelectorAll('span')).map(s => s.textContent).find(t => /V2/.test(t || ''))));

await browser.close();
