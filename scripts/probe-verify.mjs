import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');

import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
let key;
for (const l of lines) { const m = l.match(/^CLERK_SECRET_KEY=(\S+)/); if (m && /califrnia law chatbot/i.test(l)) { key = m[1]; break; } }
process.env.CLERK_SECRET_KEY = key;
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

await clerkSetup();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text().slice(0,300)}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
await page.goto('http://localhost:5173/v2/verify', { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

const url = page.url();
const title = await page.title();
const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText);
const subtitle = await page.evaluate(() => Array.from(document.querySelectorAll('span')).map(s => s.innerText).find(t => /V2/.test(t || '')));
const body = await page.evaluate(() => document.body.innerText.slice(0, 600));

console.log('URL:', url);
console.log('TITLE:', title);
console.log('H1:', h1);
console.log('SUBTITLE_WITH_V2:', subtitle);
console.log('BODY START:', body);
console.log('ERRORS:', errors.slice(0, 5));
await browser.close();
