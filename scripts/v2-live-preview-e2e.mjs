/**
 * P1.1 e2e — verifies live sanitization preview fires as you type.
 *   1. Sign in via @clerk/testing
 *   2. /v2 — type a clean phrase, expect "No privileged content"
 *   3. Type a name, expect "Detected: N name(s)" + token chip
 *   4. Clear text, expect panel to disappear
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const require = createRequire(
  '/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/',
);
const { chromium } = require('playwright');

import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';

const TEST_EMAIL = 'v2-playwright-e2e+clerk_test@v2.example.com';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = join(repoRoot, 'docs/screenshots');
const REPORTS_DIR = join(repoRoot, 'reports');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(REPORTS_DIR, { recursive: true });

function loadSecret() {
  const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
  for (const l of lines) {
    const m = l.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m && /califrnia law chatbot/i.test(l)) return m[1];
  }
  for (const l of lines) {
    const m = l.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m) return m[1];
  }
  throw new Error('CLERK_SECRET_KEY not found');
}

const CLERK_SECRET_KEY = loadSecret();
process.env.CLERK_SECRET_KEY = CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY =
  'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const shot = (page, name) =>
  page.screenshot({
    path: join(SCREENSHOTS_DIR, `v2-preview-${name}-2026-05-13.png`),
    fullPage: true,
  });

const outcome = {
  signed_in: false,
  v2_loaded: false,
  clean_chip_visible: false,
  privileged_chip_visible: false,
  token_chip_visible: false,
  cleared_panel_hidden: false,
  errors: [],
  console_events: [],
};

let browser;
try {
  const cc = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const ex = await cc.users.getUserList({ emailAddress: [TEST_EMAIL] });
  if (!ex.data || ex.data.length === 0) {
    await cc.users.createUser({
      emailAddress: [TEST_EMAIL],
      password: 'V2PlaywrightE2eTestPw!2026',
      skipPasswordChecks: true,
    });
  }
  await clerkSetup();

  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) {
      outcome.console_events.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
    }
  });

  log('Sign in + nav /v2');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  outcome.signed_in = true;

  await page.goto(`${BASE_URL}/v2`, { waitUntil: 'networkidle', timeout: 30000 });
  outcome.v2_loaded = page.url().includes('/v2');

  const ta = page.locator('textarea').first();

  log('Type clean text');
  await ta.fill('What does CRC 2.550 require for a motion to seal?');
  // Wait for debounce + render
  outcome.clean_chip_visible = await page
    .getByText(/No privileged content detected/i)
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  log(`clean_chip_visible=${outcome.clean_chip_visible}`);
  await shot(page, '01-clean');

  log('Type name');
  await ta.fill('Please advise on the trust drafting for Maria Garcia who lives at 123 Elm Street.');
  outcome.privileged_chip_visible = await page
    .getByText(/Detected:/i)
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  // The token chip pattern "CLIENT_001 = " or similar
  outcome.token_chip_visible = await page
    .getByText(/CLIENT_|ADDRESS_/i)
    .first()
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  log(`privileged_chip_visible=${outcome.privileged_chip_visible}`);
  log(`token_chip_visible=${outcome.token_chip_visible}`);
  await shot(page, '02-privileged');

  log('Clear text');
  await ta.fill('');
  // After 300ms the panel should vanish.
  await page.waitForTimeout(500);
  outcome.cleared_panel_hidden = await page
    .getByText(/Detected:/i)
    .isHidden({ timeout: 2000 })
    .catch(() => true);
  log(`cleared_panel_hidden=${outcome.cleared_panel_hidden}`);
  await shot(page, '03-cleared');
} catch (err) {
  outcome.errors.push(err.message);
  log(`ERROR: ${err.message}`);
} finally {
  if (browser) await browser.close();
}

writeFileSync(join(REPORTS_DIR, 'v2-live-preview-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.signed_in &&
  outcome.v2_loaded &&
  outcome.clean_chip_visible &&
  outcome.privileged_chip_visible &&
  outcome.token_chip_visible &&
  outcome.cleared_panel_hidden;
process.exit(pass ? 0 : 1);
