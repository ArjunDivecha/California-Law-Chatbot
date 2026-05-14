/**
 * P2.4 e2e — confidentiality attestation modal.
 *   1. Clear localStorage for this user
 *   2. Sign in, /v2 → modal visible
 *   3. Click "I understand" → modal dismissed
 *   4. Reload → modal stays dismissed (acknowledgement persisted)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');
import { clerkSetup, clerk } from '@clerk/testing/playwright';

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
let key;
for (const l of lines) { const m = l.match(/^CLERK_SECRET_KEY=(\S+)/); if (m && /califrnia law chatbot/i.test(l)) { key = m[1]; break; } }
process.env.CLERK_SECRET_KEY = key;
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

mkdirSync(join(repoRoot, 'reports'), { recursive: true });

const outcome = {
  modal_visible_first_run: false,
  modal_dismissed_after_ack: false,
  modal_stays_dismissed_after_reload: false,
  errors: [],
};

await clerkSetup();
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  // Clear attestation
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('cla-sanitization-attested')) localStorage.removeItem(k);
    }
  });
  await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });

  outcome.modal_visible_first_run = await page
    .getByText(/I understand|Confidentiality|Acknowledg/i)
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  console.log('modal_visible_first_run=', outcome.modal_visible_first_run);

  // Click the acknowledge button — text varies, try common options
  const ack = page.getByRole('button', { name: /I understand|Acknowledge|Continue/i }).first();
  if (await ack.isVisible().catch(() => false)) {
    await ack.click();
    await page.waitForTimeout(500);
  }

  outcome.modal_dismissed_after_ack = !(await page
    .getByText(/I understand|Acknowledg/i)
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false));
  console.log('modal_dismissed_after_ack=', outcome.modal_dismissed_after_ack);

  // Reload and confirm it stays dismissed
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  outcome.modal_stays_dismissed_after_reload = !(await page
    .getByText(/I understand|Acknowledg/i)
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false));
  console.log('modal_stays_dismissed_after_reload=', outcome.modal_stays_dismissed_after_reload);
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-attestation-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.modal_visible_first_run &&
  outcome.modal_dismissed_after_ack &&
  outcome.modal_stays_dismissed_after_reload;
process.exit(pass ? 0 : 1);
