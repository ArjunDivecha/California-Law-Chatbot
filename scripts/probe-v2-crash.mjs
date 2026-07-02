import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://california-law-chatbot-v2.vercel.app/v2';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errors = [];
const requests = [];
page.on('pageerror', e => errors.push(['pageerror', e.message, e.stack?.split('\n').slice(0,5).join(' | ')]));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(['console.'+m.type(), m.text()]); });
page.on('requestfailed', r => requests.push(['failed', r.url(), r.failure()?.errorText]));
page.on('response', r => { if (r.status() >= 400) requests.push(['http', r.status(), r.url()]); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push(['nav', e.message]));
await page.waitForTimeout(2000);
const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerText?.slice(0, 500) || '(no root)');
console.log('=== body text ===\n' + body + '\n');
console.log('=== errors (' + errors.length + ') ===');
errors.forEach(e => console.log('  ' + JSON.stringify(e)));
console.log('\n=== failed/error requests (' + requests.length + ') ===');
requests.forEach(r => console.log('  ' + JSON.stringify(r)));
await browser.close();
