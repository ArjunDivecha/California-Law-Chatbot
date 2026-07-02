/**
 * UI render probe: confirm the verifier panel renders all three verdict
 * states (real, fake, ambiguous) with distinct colors after the ternary-
 * status refactor. Hits the real /api/agent/verify-stream, so this runs
 * the full sub-agent loop (~60s).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then((c) => c.newPage());
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
await page.goto('http://localhost:5173/v2/verify', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const passage = [
  'Marvin v. Marvin (1976) 18 Cal.3d 660',
  'Smith v. Hallucinated Holdings (2024) 99 Cal.5th 1234',
].join('; ');
await page.locator('textarea').fill(passage);
// The page has two buttons matching /verify citations/i — the sidebar
// nav link (Title Case "Verify citations") and the main action button
// ("Verify Citations"). Pick the one inside a <form> / not in nav.
await page.getByRole('button', { name: 'Verify Citations', exact: true }).click();

// Wait until BOTH citations have a confidence number rendered (i.e. both
// verdicts have terminal status), not just one.
await page.waitForFunction(
  () => {
    const t = document.body.innerText || '';
    const matches = t.match(/conf [\d.]+/g) || [];
    return matches.length >= 2;
  },
  { timeout: 180000 },
);
await page.waitForTimeout(2000);

await page.screenshot({ path: '/tmp/v2-verify-render.png', fullPage: false });

const verdictPanel = await page.evaluate(() => {
  const txt = document.body.innerText || '';
  const i = txt.indexOf('Verdicts');
  return i >= 0 ? txt.slice(i, i + 1500) : '(no verdicts panel)';
});
console.log(verdictPanel);
console.log('SCREENSHOT: /tmp/v2-verify-render.png');
await browser.close();
