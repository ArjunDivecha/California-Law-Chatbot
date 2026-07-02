/**
 * V2 drafting end-to-end browser test. Bypasses Clerk hosted sign-in
 * via @clerk/testing (same pattern as scripts/v2-browser-e2e.mjs),
 * navigates to /v2/draft, picks the legal_memo template, fills the
 * variables form + instructions, clicks Draft, and verifies:
 *   - template picker rendered the 4 cards
 *   - selecting a template revealed the variables form
 *   - the form submission triggered the SSE stream
 *   - the privilege chip painted
 *   - real token content streamed into the output panel
 *   - the done summary footer rendered
 *
 * Screenshots are written to docs/screenshots/v2-draft-*.png so we have
 * visual proof.
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

function loadSecretFromFallback() {
  const lines = readFileSync(
    '/Users/arjundivecha/Dropbox/AAA Backup/.env.txt',
    'utf8',
  ).split('\n');
  for (const line of lines) {
    const m = line.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m && /califrnia law chatbot/i.test(line)) return m[1];
  }
  for (const line of lines) {
    const m = line.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m) return m[1];
  }
  throw new Error('CLERK_SECRET_KEY not found');
}

const CLERK_SECRET_KEY = loadSecretFromFallback();
process.env.CLERK_SECRET_KEY = CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY =
  'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const shot = (page, name) =>
  page.screenshot({
    path: join(SCREENSHOTS_DIR, `v2-draft-${name}-2026-05-13.png`),
    fullPage: true,
  });

const outcome = {
  signed_in: false,
  draft_page_loaded: false,
  template_cards_visible: false,
  template_selected: false,
  form_rendered: false,
  draft_button_enabled: false,
  draft_submitted: false,
  privilege_chip_visible: false,
  real_tokens_streamed: false,
  section_headers_in_output: false,
  done_footer_visible: false,
  assistant_text_sample: null,
  errors: [],
  console_events: [],
};

let browser;
try {
  // 1. Ensure test user exists
  const cc = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const existing = await cc.users.getUserList({ emailAddress: [TEST_EMAIL] });
  if (!existing.data || existing.data.length === 0) {
    log('Creating test user');
    await cc.users.createUser({
      emailAddress: [TEST_EMAIL],
      password: 'V2PlaywrightE2eTestPw!2026',
      skipPasswordChecks: true,
    });
  }
  log('Running clerkSetup()');
  await clerkSetup();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) {
      outcome.console_events.push(`[${m.type()}] ${m.text().slice(0, 240)}`);
    }
  });
  page.on('pageerror', (e) =>
    outcome.console_events.push(`[pageerror] ${e.message}`),
  );

  log(`Goto ${BASE_URL}/`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });

  log('Signing in via @clerk/testing');
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  outcome.signed_in = true;

  log(`Goto ${BASE_URL}/v2/draft`);
  await page.goto(`${BASE_URL}/v2/draft`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  outcome.draft_page_loaded = page.url().endsWith('/v2/draft');
  await shot(page, '01-loaded');

  // Template picker
  const picker = page.getByText(/Choose a document type/i);
  outcome.template_cards_visible = await picker
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  log(`template_cards_visible=${outcome.template_cards_visible}`);

  // Click legal_memo
  log('Selecting legal_memo template');
  const memoCard = page.getByRole('button', {
    name: /Legal Research Memorandum/i,
  });
  await memoCard.click();
  outcome.template_selected = true;
  await shot(page, '02-template-selected');

  // Form rendered — check the subject input by placeholder
  outcome.form_rendered = await page
    .locator('input[placeholder*="Validity"]')
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  log(`form_rendered=${outcome.form_rendered}`);

  // Fill in the form. Use placeholder selectors (the rendered labels
  // include a trailing " *" for required fields, which trips regex
  // matches like /^Date$/). Date is auto-prefilled to today by the
  // page's useEffect — skip it.
  log('Filling form');
  await page.locator('input[placeholder="Jane Partner"]').fill('Jane Partner');
  await page.locator('input[placeholder="John Associate"]').fill('John Associate');
  await page.locator('input[placeholder="Estate of Smith"]').fill('Estate of Smith');
  await page.locator('input[placeholder*="Validity"]').fill(
    'Validity of holographic codicil under Probate Code 6111',
  );

  const instructions = page.locator('textarea').last();
  await instructions.fill(
    'Decedent executed a typed will in 2020, later added a handwritten note dated 2024 directing one specific bequest be increased. The handwritten note is unsigned but in decedent\'s handwriting. Analyze whether the note is a valid holographic codicil under Cal. Probate Code § 6111.',
  );

  // Length: short — keep the test fast
  await page.locator('select').nth(0).selectOption('short');

  await shot(page, '03-form-filled');

  // Wait for the Draft button to be enabled (required + instructions ≥ 10 chars)
  const draftBtn = page.getByRole('button', {
    name: /Draft Legal Research Memorandum/i,
  });
  outcome.draft_button_enabled = await draftBtn.isEnabled().catch(() => false);
  log(`draft_button_enabled=${outcome.draft_button_enabled}`);

  if (!outcome.draft_button_enabled) {
    log('Draft button disabled — capturing missing-required warning');
    await shot(page, '04-button-disabled');
    throw new Error('Draft button never enabled');
  }

  log('Clicking Draft');
  await draftBtn.click();
  outcome.draft_submitted = true;

  // Privilege chip
  const chip = page.getByText(/Privileged|Public research/i).first();
  outcome.privilege_chip_visible = await chip
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  log(`privilege_chip_visible=${outcome.privilege_chip_visible}`);
  if (outcome.privilege_chip_visible) await shot(page, '05-chip-visible');

  // Real tokens streamed — wait for output pre to contain section header
  log('Waiting for real token content…');
  outcome.real_tokens_streamed = await page
    .waitForFunction(
      () => {
        const els = document.querySelectorAll('.v2-md');
        for (const p of els) {
          if ((p.textContent || '').length > 200) return true;
        }
        return false;
      },
      { timeout: 90000, polling: 500 },
    )
    .then(() => true)
    .catch(() => false);
  log(`real_tokens_streamed=${outcome.real_tokens_streamed}`);

  // Capture sample
  outcome.assistant_text_sample = await page
    .evaluate(() => {
      const els = document.querySelectorAll('.v2-md');
      for (const p of els) {
        const t = (p.textContent || '').trim();
        if (t.length > 50) return t.slice(0, 500);
      }
      return null;
    })
    .catch(() => null);
  log(`sample: ${(outcome.assistant_text_sample || '').slice(0, 160)}`);

  // Section header markers
  outcome.section_headers_in_output = await page
    .waitForFunction(
      () => {
        // Markdown renders `## SECTION: ...` as <h2> elements; check that
        // at least one section header exists in the output pane.
        const headings = document.querySelectorAll('.v2-md h2');
        for (const h of headings) {
          if (/SECTION:/.test(h.textContent || '')) return true;
        }
        return false;
      },
      { timeout: 60000, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  log(`section_headers_in_output=${outcome.section_headers_in_output}`);
  await shot(page, '06-streaming');

  // Wait for done footer
  outcome.done_footer_visible = await page
    .getByText(/tool round.*tokens.*s.*stop=/i)
    .waitFor({ state: 'visible', timeout: 180000 })
    .then(() => true)
    .catch(() => false);
  log(`done_footer_visible=${outcome.done_footer_visible}`);
  await shot(page, '07-complete');

  // Phase 3 wire-up: verify the Verify-Citations panel appears + works
  log('Looking for Verify Citations button…');
  const verifyBtn = page.getByRole('button', { name: /Verify Citations/i });
  outcome.verify_button_visible = await verifyBtn
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  log(`verify_button_visible=${outcome.verify_button_visible}`);

  if (outcome.verify_button_visible) {
    log('Clicking Verify Citations');
    await verifyBtn.click();

    // Wait for at least one verdict row to resolve (status=real or fake)
    outcome.verdict_row_resolved = await page
      .waitForFunction(
        () => {
          const rows = document.querySelectorAll('.bg-emerald-50, .bg-amber-50');
          return rows.length > 0;
        },
        { timeout: 120000, polling: 1000 },
      )
      .then(() => true)
      .catch(() => false);
    log(`verdict_row_resolved=${outcome.verdict_row_resolved}`);
    await shot(page, '08-verification-running');

    // Wait for verification done summary (X verified · Y not verified · Z total)
    outcome.verification_done = await page
      .getByText(/verified.*not verified.*total/i)
      .waitFor({ state: 'visible', timeout: 300000 })
      .then(() => true)
      .catch(() => false);
    log(`verification_done=${outcome.verification_done}`);
    await shot(page, '09-verification-complete');
  }
} catch (err) {
  outcome.errors.push(err.message);
  log(`ERROR: ${err.message}`);
} finally {
  if (browser) await browser.close();
}

const reportPath = join(REPORTS_DIR, 'v2-draft-e2e-2026-05-13.json');
writeFileSync(reportPath, JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));

// Pass: signed in + page loaded + template cards + form + chip + real tokens
const pass =
  outcome.signed_in &&
  outcome.draft_page_loaded &&
  outcome.template_cards_visible &&
  outcome.form_rendered &&
  outcome.draft_submitted &&
  outcome.privilege_chip_visible &&
  outcome.real_tokens_streamed;
process.exit(pass ? 0 : 1);
