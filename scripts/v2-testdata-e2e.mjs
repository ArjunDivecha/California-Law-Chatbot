/**
 * P3.1 e2e — "Use test data" button pre-fills the variables form.
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

const outcome = { button_visible: false, variables_populated: false, instructions_populated: false, draft_enabled: false, errors: [] };

await clerkSetup();
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto('http://localhost:5173/v2/draft', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Legal Research Memorandum/i }).click();

  const btn = page.getByRole('button', { name: /Use test data/i });
  outcome.button_visible = await btn.isVisible({ timeout: 4000 }).catch(() => false);
  console.log('button_visible=', outcome.button_visible);

  if (outcome.button_visible) {
    await btn.click();
    await page.waitForTimeout(500);
    // Check that the "to" field is populated with "Sarah Chen, Partner"
    const toVal = await page.locator('input[placeholder="Jane Partner"]').inputValue();
    outcome.variables_populated = toVal.length > 5;
    console.log('variables_populated=', outcome.variables_populated, 'to=', toVal);
    const instr = await page.locator('textarea').last().inputValue();
    outcome.instructions_populated = instr.length > 50;
    console.log('instructions_populated=', outcome.instructions_populated);
    // Draft button enabled?
    const draftBtn = page.getByRole('button', { name: /Draft Legal Research Memorandum/i });
    outcome.draft_enabled = await draftBtn.isEnabled({ timeout: 2000 }).catch(() => false);
    console.log('draft_enabled=', outcome.draft_enabled);
  }
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-testdata-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass = outcome.button_visible && outcome.variables_populated && outcome.instructions_populated && outcome.draft_enabled;
process.exit(pass ? 0 : 1);
