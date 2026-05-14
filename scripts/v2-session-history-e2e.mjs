/**
 * V2 session history end-to-end. Verifies the Phase 4.x sidebar + URL-
 * driven hydration flow:
 *
 *   1. Sign in via @clerk/testing
 *   2. Navigate to /v2
 *   3. Verify V2Sidebar is visible with "+ New chat" + "Draft a document"
 *   4. Submit a chat message → a new session is created on the server
 *   5. Wait for the assistant response to complete
 *   6. Reload sidebar (it re-fetches on URL change anyway) — verify the
 *      new session appears in the list with a derived title
 *   7. Click the session in the sidebar → navigates to /v2/<id>
 *   8. Verify message history hydrates (user bubble appears with the
 *      original text)
 *   9. Click "+ New chat" → navigates back to /v2 with a fresh session
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
  const lines = readFileSync(
    '/Users/arjundivecha/Dropbox/AAA Backup/.env.txt',
    'utf8',
  ).split('\n');
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
    path: join(SCREENSHOTS_DIR, `v2-history-${name}-2026-05-13.png`),
    fullPage: true,
  });

const outcome = {
  signed_in: false,
  v2_loaded: false,
  sidebar_visible: false,
  new_chat_button_visible: false,
  draft_button_visible: false,
  message_submitted: false,
  session_appears_in_sidebar: false,
  sidebar_title_present: false,
  click_session_navigates: false,
  hydrated_user_bubble_visible: false,
  new_chat_resets: false,
  final_url_after_new_chat: null,
  errors: [],
  console_events: [],
};

let browser;
try {
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
  await clerkSetup();

  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) {
      outcome.console_events.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
    }
  });
  page.on('pageerror', (e) => outcome.console_events.push(`[pageerror] ${e.message}`));

  log(`Goto ${BASE_URL}/`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });

  log('Signing in');
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  outcome.signed_in = true;

  log(`Goto ${BASE_URL}/v2`);
  await page.goto(`${BASE_URL}/v2`, { waitUntil: 'networkidle', timeout: 30000 });
  outcome.v2_loaded = page.url().includes('/v2');
  await shot(page, '01-v2-loaded');

  // Sidebar checks
  const newBtn = page.getByRole('button', { name: /\+ New chat/i });
  outcome.new_chat_button_visible = await newBtn
    .isVisible({ timeout: 6000 })
    .catch(() => false);
  const draftBtn = page.getByRole('button', { name: /Draft a document/i });
  outcome.draft_button_visible = await draftBtn
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  outcome.sidebar_visible =
    outcome.new_chat_button_visible && outcome.draft_button_visible;
  log(`sidebar_visible=${outcome.sidebar_visible}`);

  // Submit a chat message
  const TEST_QUERY = 'Sidebar-history-test: One sentence on what CRC 2.550 requires.';
  log('Submitting chat message');
  const textarea = page.locator('textarea').first();
  await textarea.fill(TEST_QUERY);
  await page.getByRole('button', { name: /^Send$/ }).click();
  outcome.message_submitted = true;

  // Wait for the assistant response to complete — done footer pattern.
  log('Waiting for done footer');
  await page
    .getByText(/tool round.*tokens.*s.*stop=/i)
    .waitFor({ state: 'visible', timeout: 240000 })
    .catch(() => {});
  await shot(page, '02-chat-complete');

  // Sidebar should now have an entry for this session. Look for a row
  // matching the truncated title.
  log('Looking for new session in sidebar');
  const titlePrefix = 'Sidebar-history-test';
  const sidebarEntry = page.getByRole('button', {
    name: new RegExp(titlePrefix, 'i'),
  });
  outcome.session_appears_in_sidebar = await sidebarEntry
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  outcome.sidebar_title_present = outcome.session_appears_in_sidebar;
  log(`session_appears_in_sidebar=${outcome.session_appears_in_sidebar}`);
  await shot(page, '03-sidebar-has-entry');

  if (outcome.session_appears_in_sidebar) {
    log('Navigating to a new chat first, then clicking the saved session');
    // Navigate away (new chat) so we can verify hydration loads the saved one.
    await newBtn.click();
    await page.waitForLoadState('networkidle');

    // Click the saved session
    const sessionBtn = page.getByRole('button', { name: new RegExp(titlePrefix, 'i') }).first();
    await sessionBtn.click();
    await page.waitForLoadState('networkidle');
    outcome.click_session_navigates = /\/v2\/v2_/.test(page.url());
    log(`URL after click: ${page.url()}`);

    // Verify the user-bubble re-rendered with the original text
    const userBubble = page.locator('div.bg-pink-500').filter({ hasText: TEST_QUERY });
    outcome.hydrated_user_bubble_visible = await userBubble
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    log(`hydrated_user_bubble_visible=${outcome.hydrated_user_bubble_visible}`);
    await shot(page, '04-hydrated');

    // New Chat resets
    log('Clicking + New chat to reset');
    await newBtn.click();
    await page.waitForLoadState('networkidle');
    outcome.final_url_after_new_chat = page.url();
    outcome.new_chat_resets = page.url().endsWith('/v2');
    await shot(page, '05-new-chat');
  }
} catch (err) {
  outcome.errors.push(err.message);
  log(`ERROR: ${err.message}`);
} finally {
  if (browser) await browser.close();
}

writeFileSync(
  join(REPORTS_DIR, 'v2-session-history-e2e-2026-05-13.json'),
  JSON.stringify(outcome, null, 2),
);
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.signed_in &&
  outcome.v2_loaded &&
  outcome.sidebar_visible &&
  outcome.message_submitted &&
  outcome.session_appears_in_sidebar &&
  outcome.click_session_navigates &&
  outcome.hydrated_user_bubble_visible &&
  outcome.new_chat_resets;
process.exit(pass ? 0 : 1);
