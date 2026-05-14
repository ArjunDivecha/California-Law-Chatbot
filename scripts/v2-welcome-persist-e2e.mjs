/**
 * P1.3 e2e:
 *   1. Welcome banner visible on empty /v2
 *   2. Type text, wait > 1.5s for debounce, reload page → text restored
 *   3. Send a message → welcome disappears, persisted draft cleared
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

mkdirSync(join(repoRoot, 'docs/screenshots'), { recursive: true });
mkdirSync(join(repoRoot, 'reports'), { recursive: true });

const outcome = {
  welcome_visible: false,
  draft_persisted_across_reload: false,
  draft_clears_on_send: false,
  errors: [],
};

await clerkSetup();
const browser = await chromium.launch({ headless: true });
let page;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });

  outcome.welcome_visible = await page
    .getByText(/V2 Welcome/i)
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  console.log('welcome_visible=', outcome.welcome_visible);
  await page.screenshot({ path: join(repoRoot, 'docs/screenshots/v2-welcome-01-2026-05-13.png'), fullPage: true });

  // Type, wait 2s for debounce save, reload, check restored
  const persistText = 'Draft persistence test — placeholder';
  await page.locator('textarea').first().fill(persistText);
  await page.waitForTimeout(2000); // > 1500ms debounce
  await page.reload({ waitUntil: 'networkidle' });
  const restored = await page.locator('textarea').first().inputValue();
  outcome.draft_persisted_across_reload = restored === persistText;
  console.log('draft_persisted_across_reload=', outcome.draft_persisted_across_reload, 'value=', restored.slice(0, 50));
  await page.screenshot({ path: join(repoRoot, 'docs/screenshots/v2-welcome-02-restored-2026-05-13.png'), fullPage: true });

  // Send a message → draft should clear + welcome should go away
  await page.locator('textarea').first().fill('Test: send and clear');
  await page.getByRole('button', { name: /^Send$/ }).click();
  await page.waitForTimeout(2500);
  // Reload to test persistence cleared
  await page.reload({ waitUntil: 'networkidle' });
  const afterSend = await page.locator('textarea').first().inputValue();
  outcome.draft_clears_on_send = afterSend.trim().length === 0;
  console.log('draft_clears_on_send=', outcome.draft_clears_on_send);
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-welcome-persist-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.welcome_visible &&
  outcome.draft_persisted_across_reload &&
  outcome.draft_clears_on_send;
process.exit(pass ? 0 : 1);
