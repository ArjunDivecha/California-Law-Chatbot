import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const { clerkSetup, clerk } = await import('@clerk/testing/playwright');
const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt','utf8').split('\n');
for (const l of lines) { const m = l.match(/^CLERK_SECRET_KEY=(\S+)/); if (m && /califrnia law chatbot/i.test(l)) { process.env.CLERK_SECRET_KEY = m[1]; break; } }
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';
await clerkSetup();
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
// Probe localStorage for the device key — proof SanitizerProvider ran
const deviceKey = await page.evaluate(() => {
  try { return window.localStorage.getItem('cla-sanitization-device-key'); }
  catch { return '(no access)'; }
});
const dbInfo = await page.evaluate(async () => {
  if (typeof indexedDB === 'undefined') return '(no IDB)';
  const names = await indexedDB.databases?.();
  return Array.isArray(names) ? names.map(d => d.name).join(',') : '(no list)';
});
const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText || '(no h1)');
await page.screenshot({ path: '/tmp/v2-sanitizer-mount.png' });
console.log('URL:', page.url());
console.log('H1:', h1);
console.log('device key present:', deviceKey ? `${deviceKey.slice(0,16)}... (${deviceKey.length} chars)` : 'NONE');
console.log('IndexedDB databases:', dbInfo);
console.log('Errors:', errors.slice(0, 5));
await browser.close();
