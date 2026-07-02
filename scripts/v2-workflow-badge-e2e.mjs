/**
 * P2.5 e2e — workflow persisted per-message + rendered as badge.
 *   1. /v2, switch to Quick Answer, send a query
 *   2. After done + fold-in: bubble shows "Quick" badge
 *   3. Reload → bubble re-hydrates from KV → "Quick" badge persists
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
  quick_badge_after_send: false,
  badge_persisted_after_reload: false,
  errors: [],
};

await clerkSetup();
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  // Get the Clerk user ID from window.Clerk so we can pre-acknowledge
  const userId = await page.evaluate(() => {
    // @ts-ignore
    return window.Clerk?.user?.id ?? null;
  });
  if (userId) {
    await page.evaluate((uid) => {
      localStorage.setItem(
        `cla-sanitization-attested:v1:${uid}`,
        JSON.stringify({ version: 1, acknowledgedAt: new Date().toISOString() }),
      );
    }, userId);
  }
  await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });
  // Acknowledge attestation modal if it's there
  const ack = page.getByRole('button', { name: /I understand|Acknowledge|Continue/i }).first();
  if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ack.click();
    await page.waitForTimeout(500);
  }

  await page.getByRole('button', { name: /Quick Answer/i }).click();
  await page.locator('textarea').first().fill('In one sentence: who must verify discovery responses in California state court?');
  await page.getByRole('button', { name: /^Send$/ }).click();
  await page.getByText(/tool round.*tokens.*s.*stop=/i).waitFor({ state: 'visible', timeout: 60000 });
  // Give the fold-in effect time
  await page.waitForTimeout(2500);

  // Look for Quick badge on assistant message
  outcome.quick_badge_after_send = await page
    .locator('span:text-is("Quick")')
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  console.log('quick_badge_after_send=', outcome.quick_badge_after_send);

  // Get session URL from sidebar — find the most-recent session entry
  const sessionLink = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.title?.startsWith('v2_'));
    return btns[0]?.title ?? null;
  });
  console.log('sessionLink=', sessionLink);

  if (sessionLink) {
    await page.goto(`http://localhost:5173/v2/${sessionLink}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    outcome.badge_persisted_after_reload = await page
      .locator('span:text-is("Quick")')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    console.log('badge_persisted_after_reload=', outcome.badge_persisted_after_reload);
  }
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-workflow-badge-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass = outcome.quick_badge_after_send && outcome.badge_persisted_after_reload;
process.exit(pass ? 0 : 1);
