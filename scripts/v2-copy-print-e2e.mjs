/**
 * P2.1 e2e — copy & print buttons on assistant messages.
 *   1. Sign in, /v2
 *   2. Quick Answer query → assistant message renders
 *   3. Copy button visible on assistant bubble, click it, clipboard set
 *   4. Print button visible (we don't click — opens window — but verify
 *      the button is reachable + has the correct aria-label)
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
  message_rendered: false,
  copy_button_visible: false,
  copy_clicked: false,
  copy_feedback_shown: false,
  clipboard_has_content: false,
  print_button_visible: false,
  errors: [],
};

await clerkSetup();
// Grant clipboard permission so navigator.clipboard.writeText works
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto('http://localhost:5173/v2', { waitUntil: 'networkidle' });

  // Use Quick Answer for speed
  await page.getByRole('button', { name: /Quick Answer/i }).click();
  await page.locator('textarea').first().fill('In one sentence, who decides motions to compel in California Superior Court?');
  await page.getByRole('button', { name: /^Send$/ }).click();

  // Wait for the assistant bubble to settle (done footer visible)
  await page.getByText(/tool round.*tokens.*s.*stop=/i).waitFor({ state: 'visible', timeout: 60000 });
  // Brief settle for the message-fold-in effect to complete
  await page.waitForTimeout(2000);

  // Assistant bubble selector
  const assistantBubble = page.locator('div.bg-white.border.border-gray-200').first();
  outcome.message_rendered = await assistantBubble.isVisible({ timeout: 4000 }).catch(() => false);
  console.log('message_rendered=', outcome.message_rendered);

  // Copy button
  const copyBtn = page.getByRole('button', { name: /Copy message/i }).first();
  outcome.copy_button_visible = await copyBtn.isVisible({ timeout: 4000 }).catch(() => false);
  console.log('copy_button_visible=', outcome.copy_button_visible);

  if (outcome.copy_button_visible) {
    await copyBtn.click();
    outcome.copy_clicked = true;
    // Copy feedback "✓ Copied" appears for 1.5s
    outcome.copy_feedback_shown = await page
      .getByText(/✓ Copied/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    console.log('copy_feedback_shown=', outcome.copy_feedback_shown);
    // Read clipboard via page.evaluate
    const clipText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    });
    outcome.clipboard_has_content = clipText.length > 20;
    console.log('clipboard_has_content=', outcome.clipboard_has_content, 'len=', clipText.length);
  }

  // Print button
  outcome.print_button_visible = await page
    .getByRole('button', { name: /Print message/i })
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  console.log('print_button_visible=', outcome.print_button_visible);
} catch (err) {
  outcome.errors.push(err.message);
  console.log('ERROR:', err.message);
} finally {
  await browser.close();
}

writeFileSync(join(repoRoot, 'reports/v2-copy-print-e2e-2026-05-13.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
const pass =
  outcome.message_rendered &&
  outcome.copy_button_visible &&
  outcome.copy_clicked &&
  outcome.copy_feedback_shown &&
  outcome.clipboard_has_content &&
  outcome.print_button_visible;
process.exit(pass ? 0 : 1);
