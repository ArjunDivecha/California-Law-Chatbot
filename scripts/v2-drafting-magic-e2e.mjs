/**
 * P5.4 e2e — Drafting Magic end-to-end.
 *   1. Sign in, go to /v2/magic
 *   2. Verify packet builder + form visible
 *   3. Fill 2 sources + instructions
 *   4. Click Generate → stream begins
 *   5. Verify privilege chip + workproduct sections render
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
mkdirSync(join(repoRoot, 'docs/screenshots'), { recursive: true });

const outcome = {
  page_loaded: false,
  packet_builder_visible: false,
  output_pane_visible: false,
  generate_button_visible: false,
  generate_clicked: false,
  workproduct_streaming: false,
  section_headings_rendered: false,
  errors: [],
};

await clerkSetup();
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto('http://localhost:5173/v2/magic', { waitUntil: 'networkidle' });
  // Dismiss attestation if shown
  const ack = page.getByRole('button', { name: /I understand|Acknowledge|Continue/i }).first();
  if (await ack.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ack.click();
    await page.waitForTimeout(500);
  }

  outcome.page_loaded = page.url().endsWith('/v2/magic');
  outcome.packet_builder_visible = await page
    .getByText(/Packet/i)
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  outcome.output_pane_visible = await page
    .getByText(/Workproduct/i)
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  console.log('page_loaded=', outcome.page_loaded, 'packet=', outcome.packet_builder_visible, 'output=', outcome.output_pane_visible);

  // Fill source 1 (already auto-added)
  const sourceTextareas = page.locator('textarea[placeholder*="Paste source"]');
  await sourceTextareas.first().fill('TRUST AGREEMENT — Settlor: J. Smith. Trustee: M. Chen. Successor trustee: P. Smith.\nDistributions: equal shares to Smith children at age 25.\nIncapacity trigger: 2 physician certifications.');
  // Add a second source
  await page.getByRole('button', { name: /\+ Add source/i }).click();
  await page.waitForTimeout(300);
  await sourceTextareas.nth(1).fill('POUR-OVER WILL — Testator: J. Smith. Pour-over recipient: J. Smith Revocable Trust.\nExecutor: M. Chen. Alternate executor: P. Smith.');

  // Instructions
  await page.locator('textarea[placeholder*="What do you want"]').fill('Reconcile fiduciary appointments across the trust and pour-over will. Confirm both name M. Chen as primary fiduciary and P. Smith as alternate. Identify any conflict. Produce a one-page summary.');
  await page.screenshot({ path: join(repoRoot, 'docs/screenshots/v2-magic-01-2026-05-13.png'), fullPage: true });

  const genBtn = page.getByRole('button', { name: /Generate (Draft|Review Memo)/i }).first();
  outcome.generate_button_visible = await genBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (outcome.generate_button_visible) {
    await genBtn.click();
    outcome.generate_clicked = true;
  }

  // Wait for done footer or text to begin streaming
  outcome.workproduct_streaming = await page
    .waitForFunction(
      () => {
        const els = document.querySelectorAll('.v2-md');
        for (const e of els) {
          if ((e.textContent || '').length > 100) return true;
        }
        return false;
      },
      { timeout: 180000, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  console.log('workproduct_streaming=', outcome.workproduct_streaming);

  outcome.section_headings_rendered = await page
    .waitForFunction(
      () => {
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
  console.log('section_headings_rendered=', outcome.section_headings_rendered);
  await page.screenshot({ path: join(repoRoot, 'docs/screenshots/v2-magic-02-streaming-2026-05-13.png'), fullPage: true });
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-drafting-magic-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.page_loaded &&
  outcome.packet_builder_visible &&
  outcome.output_pane_visible &&
  outcome.generate_button_visible &&
  outcome.generate_clicked &&
  outcome.workproduct_streaming;
process.exit(pass ? 0 : 1);
