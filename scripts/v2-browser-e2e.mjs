/**
 * V2 end-to-end browser test using @clerk/testing — bypasses the hosted
 * Clerk sign-in UI (Cloudflare blocks headless traffic there) and signs
 * the page in via Clerk's backend signInTokens API + clerk.signIn ticket
 * strategy. Then drives the rendered /v2 chat surface and screenshots.
 *
 * Reads CLERK_SECRET_KEY from the gitignored env fallback
 * `~/Dropbox/AAA Backup/.env.txt` (the file contains keys for several
 * Clerk instances; we filter to the California-Law-Chatbot publishable
 * key's matching secret).
 *
 * Playwright is resolved from the global nvm install at
 * ~/.nvm/versions/node/v24.12.0/lib/node_modules/playwright; @clerk/*
 * comes from this project's node_modules.
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
const TEST_PASSWORD = 'V2PlaywrightE2eTestPw!2026';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = join(repoRoot, 'docs/screenshots');
const REPORTS_DIR = join(repoRoot, 'reports');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(REPORTS_DIR, { recursive: true });

// ── Load CLERK_SECRET_KEY from gitignored fallback. The fallback file has
//    multiple lines for different Clerk instances; the second line (per
//    user) is the California-Law-Chatbot one matching pk_test_ZW1lc... .
//    The first env-var assignment wins (don't overwrite).
function loadSecretFromFallback() {
  const path = '/Users/arjundivecha/Dropbox/AAA Backup/.env.txt';
  const lines = readFileSync(path, 'utf8').split('\n');
  // Find the CLERK_SECRET_KEY annotated with "califrnia law chatbot" (sic
  // — typo is in the source file; using literal substring match).
  for (const line of lines) {
    const m = line.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m && /califrnia law chatbot/i.test(line)) return m[1];
  }
  // Fall back to the last CLERK_SECRET_KEY in the file (most recent).
  let last = null;
  for (const line of lines) {
    const m = line.match(/^CLERK_SECRET_KEY=(\S+)/);
    if (m) last = m[1];
  }
  if (last) return last;
  throw new Error('CLERK_SECRET_KEY not found in fallback env file');
}

const CLERK_SECRET_KEY = loadSecretFromFallback();
process.env.CLERK_SECRET_KEY = CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY =
  'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function shot(page, name) {
  return page.screenshot({
    path: join(SCREENSHOTS_DIR, `v2-e2e-${name}-2026-05-13.png`),
    fullPage: true,
  });
}

// ── 1. Ensure test user exists in Clerk (idempotent: lookup, create if missing).
const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

async function ensureTestUser() {
  const existing = await clerkClient.users.getUserList({
    emailAddress: [TEST_EMAIL],
  });
  if (existing.data && existing.data.length > 0) {
    log(`Test user already exists: ${existing.data[0].id}`);
    return existing.data[0];
  }
  log('Creating test user via Clerk backend API');
  const created = await clerkClient.users.createUser({
    emailAddress: [TEST_EMAIL],
    password: TEST_PASSWORD,
    skipPasswordChecks: true,
    skipPasswordRequirement: false,
  });
  log(`Created test user: ${created.id}`);
  return created;
}

const outcome = {
  signed_in: false,
  v2_loaded: false,
  heading_visible: false,
  errors: [],
  console_events: [],
  final_url: null,
};

let browser;
try {
  await ensureTestUser();

  // ── 2. clerkSetup fetches a testing token from the dashboard so the
  //       Clerk JS client lets us sign in headlessly without bot detection.
  log('Running clerkSetup()');
  await clerkSetup();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      outcome.console_events.push(
        `[${msg.type()}] ${msg.text().slice(0, 240)}`,
      );
    }
  });
  page.on('pageerror', (e) =>
    outcome.console_events.push(`[pageerror] ${e.message}`),
  );

  // ── 3. Land on / first so Clerk JS loads with the publishable key. /v2
  //       redirects to hosted sign-in when unauthenticated; we don't want
  //       that — we want the Clerk JS object on the same origin.
  log(`Goto ${BASE_URL}/`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await shot(page, '01-root-loaded');

  // ── 4. Sign in via @clerk/testing — uses createSignInToken under the
  //       hood, no UI required.
  log(`clerk.signIn({ emailAddress: "${TEST_EMAIL}" })`);
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  outcome.signed_in = true;
  log('Signed in');
  await shot(page, '02-after-signin');

  // ── 5. Navigate to /v2 — should now render V2ChatPage, not redirect.
  log(`Goto ${BASE_URL}/v2`);
  await page.goto(`${BASE_URL}/v2`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  outcome.final_url = page.url();
  log(`URL: ${outcome.final_url}`);
  outcome.v2_loaded = outcome.final_url.includes('/v2');
  await shot(page, '03-v2-page');

  // ── 6. Verify the V2 chat heading is visible (proves V2ChatPage
  //       mounted, not the V1 shell or a Clerk redirect screen).
  const v2Heading = page.getByText(/V2 Preview · Anthropic Agent Loop/i);
  outcome.heading_visible = await v2Heading
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  log(`heading_visible=${outcome.heading_visible}`);

  if (outcome.heading_visible) {
    // Capture the chat surface composed view
    await shot(page, '04-v2-chat-ready');

    // ── 7. Drive a real query through the chat input and watch for SSE
    //       streaming. A simple greeting query so the agent answers from
    //       its own knowledge and doesn't trigger long-running tool calls
    //       (that's a separate test). The privilege chip should render
    //       in "Public research" mode for this non-PII query.
    log('Submitting test query');
    const TEST_QUERY = 'Hi — in one sentence, what kind of California legal research can you help with?';
    const textarea = page.locator('textarea').first();
    await textarea.fill(TEST_QUERY);
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for either: (a) the user bubble to appear (proves form
    // submitted), (b) the privilege chip, or (c) an error banner.
    const userBubble = page.locator('div.bg-pink-500').filter({ hasText: TEST_QUERY });
    outcome.user_bubble_rendered = await userBubble
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    log(`user_bubble_rendered=${outcome.user_bubble_rendered}`);
    await shot(page, '05-query-submitted');

    // Privilege chip OR error banner — whichever resolves first
    const chip = page.getByText(/Privileged|Public research/i);
    const errorBanner = page.getByText(/Gate error|Stream error/i);
    const chipVisible = chip
      .first()
      .waitFor({ state: 'visible', timeout: 25000 })
      .then(() => 'chip')
      .catch(() => null);
    const errVisible = errorBanner
      .first()
      .waitFor({ state: 'visible', timeout: 25000 })
      .then(() => 'error')
      .catch(() => null);
    const winner = await Promise.race([chipVisible, errVisible]);
    log(`First post-submit signal: ${winner}`);
    outcome.first_signal = winner;

    if (winner === 'chip') {
      const chipText = await chip.first().innerText().catch(() => '');
      outcome.privilege_chip_text = chipText;
      await shot(page, '06-privilege-chip');

      // Wait for assistant tokens to contain *real* content (not the
      // "Thinking…" / "Working on round X…" placeholders). Poll the DOM
      // for an assistant bubble whose text doesn't match those phrases.
      const sawRealTokens = await page
        .waitForFunction(
          () => {
            const bubbles = Array.from(
              document.querySelectorAll('div.bg-white.border.border-gray-200'),
            );
            for (const b of bubbles) {
              const txt = (b.textContent || '').trim();
              if (!txt) continue;
              if (/^Thinking…/.test(txt)) continue;
              if (/^Working on round/.test(txt)) continue;
              if (txt.length > 20) return true; // real content
            }
            return false;
          },
          { timeout: 60000, polling: 500 },
        )
        .then(() => true)
        .catch(() => false);
      outcome.tokens_streamed = sawRealTokens;
      log(`tokens_streamed=${sawRealTokens}`);

      // Capture the assistant text we ended up with (whatever it is).
      outcome.assistant_text_sample = await page
        .evaluate(() => {
          const bubbles = Array.from(
            document.querySelectorAll('div.bg-white.border.border-gray-200'),
          );
          for (const b of bubbles) {
            const txt = (b.textContent || '').trim();
            if (
              txt &&
              !/^Thinking…/.test(txt) &&
              !/^Working on round/.test(txt)
            ) {
              return txt.slice(0, 400);
            }
          }
          return null;
        })
        .catch(() => null);
      log(`assistant_text_sample: ${(outcome.assistant_text_sample || '').slice(0, 120)}`);

      // Look for the "done" footer (tool rounds · tokens · seconds)
      const doneFooter = page.getByText(/tool round.*tokens.*s.*stop=/i);
      outcome.done_footer = await doneFooter
        .isVisible({ timeout: 120000 })
        .catch(() => false);
      log(`done_footer=${outcome.done_footer}`);
      await shot(page, '07-chat-complete');
    } else if (winner === 'error') {
      const errText = await errorBanner.first().innerText().catch(() => '');
      outcome.error_banner_text = errText;
      log(`Error banner: ${errText.slice(0, 200)}`);
      await shot(page, '06-error-banner');
    } else {
      log('Neither chip nor error appeared within 25s — timing out');
      await shot(page, '06-timeout');
    }
  } else {
    // Capture whatever did render for diagnostics
    const bodyText = await page.evaluate(
      () => document.body?.innerText?.slice(0, 800) ?? '',
    );
    outcome.body_text_sample = bodyText;
    log(`Body text sample: ${bodyText.slice(0, 300)}`);
  }
} catch (err) {
  outcome.errors.push(err.message);
  log(`ERROR: ${err.message}`);
  if (err.stack) outcome.errors.push(err.stack.split('\n').slice(0, 6).join('\n'));
} finally {
  if (browser) await browser.close();
}

const reportPath = join(REPORTS_DIR, 'v2-browser-e2e-2026-05-13.json');
writeFileSync(reportPath, JSON.stringify(outcome, null, 2));
log(`Wrote ${reportPath}`);
console.log(JSON.stringify(outcome, null, 2));

process.exit(outcome.heading_visible && outcome.tokens_streamed ? 0 : 1);
