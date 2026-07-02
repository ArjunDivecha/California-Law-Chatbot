/**
 * P2.3 e2e — Sources panel renders below assistant bubble after a
 * tool-using query.
 *
 * Strategy: Research Memo (default) with a query that forces tool use,
 * then confirm a "Sources" header appears in the DOM after `done`.
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
  message_with_sources: false,
  source_panel_header: false,
  source_link_clickable: false,
  errors: [],
};

await clerkSetup();
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });

  // Use default Research Memo workflow + a query that forces CEB tool use
  await page.locator('textarea').first().fill('Use the CEB practice-guide tool to find guidance on California Probate Code 6111 holographic wills. I need specific CEB section citations.');
  await page.getByRole('button', { name: /^Send$/ }).click();

  // Wait for done footer
  await page.getByText(/tool round.*tokens.*s.*stop=/i).waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(repoRoot, 'docs/screenshots/v2-sources-01-2026-05-13.png'), fullPage: true });

  outcome.source_panel_header = await page
    .locator('text=Sources')
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  console.log('source_panel_header=', outcome.source_panel_header);

  // Find any clickable link in the sources panel
  const sourceLink = page.locator('a[target="_blank"]').first();
  outcome.source_link_clickable = await sourceLink.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('source_link_clickable=', outcome.source_link_clickable);

  // CEB sources don't have URLs (internal Upstash vector DB) — so the
  // panel-header presence alone is the pass criterion. A separate test
  // for CourtListener/LegiScan would confirm clickable links.
  outcome.message_with_sources = outcome.source_panel_header;
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-sources-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
process.exit(outcome.message_with_sources ? 0 : 1);
