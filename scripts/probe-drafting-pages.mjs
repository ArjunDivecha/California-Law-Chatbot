/**
 * Probe /v2/draft and /v2/magic for token leakage:
 *   - Drafting (/v2/draft): pick template, fill PII vars, generate draft.
 *     Verify generated draft shows real names (not CLIENT_001) and that
 *     no token leaks into the UI.
 *   - Drafting Magic (/v2/magic): type PII into the workspace, trigger
 *     a draft, verify output has real names + that reload preserves raw.
 *
 * Reuses /tmp/playwright-v2-userdata so we don't sign in again.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'https://california-law-chatbot-v2.vercel.app';
const OUT = '/tmp/drafting-probe';
const USER_DATA = '/tmp/playwright-v2-userdata';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1500, height: 1000 },
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
for (const p of ctx.pages()) await p.close().catch(() => {});
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  ✓ ${name}.png  url=${page.url()}`);
}

async function scanForTokens(label) {
  const text = await page.evaluate(() => document.body?.innerText || '');
  const clientHits = (text.match(/CLIENT_\d+/g) || []).slice(0, 5);
  const addrHits = (text.match(/ADDRESS_\d+/g) || []).slice(0, 5);
  const phoneHits = (text.match(/PHONE_\d+/g) || []).slice(0, 5);
  const ssnHits = (text.match(/SSN_\d+/g) || []).slice(0, 5);
  const hasRealName = /John Smith/.test(text);
  const hasRealAddr = /Mowry|Fremont/.test(text);
  console.log(`  [${label}] tokens: CLIENT=${clientHits.length} ADDR=${addrHits.length} PHONE=${phoneHits.length} SSN=${ssnHits.length} | real: name=${hasRealName} addr=${hasRealAddr}`);
  if (clientHits.length) console.log(`    samples: ${clientHits.join(', ')}`);
  return { clientHits, addrHits, hasRealName, hasRealAddr };
}

// ---- 1. /v2/draft ----
console.log(`\n=== /v2/draft ===`);
await page.goto(`${BASE_URL}/v2/draft`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await shot('draft-01-loaded');

// Click a template — Demand Letter is more PII-heavy than memo
const demandLetter = page.locator('text=Demand Letter').first();
const hasDemand = await demandLetter.isVisible({ timeout: 5000 }).catch(() => false);
console.log(`  Demand Letter visible: ${hasDemand}`);
if (hasDemand) {
  await demandLetter.click();
  await page.waitForTimeout(2000);
  await shot('draft-02-template-selected');

  // Find input fields and fill with PII
  const inputs = await page.locator('input[type="text"], textarea').all();
  console.log(`  found ${inputs.length} input fields`);
  const piiValues = [
    'John Smith',                    // client name
    '123 Mowry Avenue, Fremont, CA', // address
    '555-123-4567',                  // phone
    'Acme Corp',                     // defendant
    '2025-01-15',                    // incident date
    '$10,000',                       // demand amount
    'breach of contract',            // claim
    'Please draft a strongly worded demand', // instructions
  ];
  for (let i = 0; i < Math.min(inputs.length, piiValues.length); i++) {
    try { await inputs[i].fill(piiValues[i]); } catch {}
  }
  await page.waitForTimeout(2000);
  await shot('draft-03-fields-filled');
  await scanForTokens('draft-after-typing');

  // Click Generate button
  const genBtn = page.getByRole('button', { name: /Generate|Draft/i }).first();
  if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`  clicking Generate`);
    await genBtn.click();
    // Wait ~60s for stream (drafts take longer than chat)
    await page.waitForTimeout(60000);
    await shot('draft-04-after-generate');
    await scanForTokens('draft-after-generate');
  } else {
    console.log('  Generate button not found');
  }
}

// ---- 2. /v2/magic ----
console.log(`\n=== /v2/magic ===`);
// Clear any prior workspace localStorage so we test from scratch
await page.evaluate(() => {
  try { window.localStorage.removeItem('drafting-magic:estate-workspace:v1'); } catch {}
});
await page.goto(`${BASE_URL}/v2/magic`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await shot('magic-01-loaded');
await scanForTokens('magic-initial');

// Look for an attorney update field or input area
const textInputs = await page.locator('textarea, input[type="text"]').all();
console.log(`  magic page has ${textInputs.length} text inputs`);
if (textInputs.length) {
  // Find a substantial textarea and type PII
  for (const inp of textInputs.slice(0, 3)) {
    try {
      const tag = await inp.evaluate(e => e.tagName);
      if (tag === 'TEXTAREA') {
        await inp.fill('Please draft a will for John Smith of 123 Mowry Avenue. He is the trustee for Acme Trust.');
        break;
      }
    } catch {}
  }
  await page.waitForTimeout(2000);
  await shot('magic-02-after-typing');
  await scanForTokens('magic-after-typing');
}

// Click a Generate / Draft button if present
const magicBtn = page.getByRole('button', { name: /Generate|Draft|Run/i }).first();
if (await magicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  console.log(`  clicking magic Generate`);
  await magicBtn.click();
  await page.waitForTimeout(45000);
  await shot('magic-03-after-generate');
  await scanForTokens('magic-after-generate');
}

// Reload — verify workspace persistence handles PII correctly
console.log('\n=== /v2/magic reload ===');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await shot('magic-04-after-reload');
await scanForTokens('magic-after-reload');

console.log('\n--- console errors (filtered) ---');
for (const l of logs.filter(x => x.type === 'error' || x.type === 'pageerror').slice(0, 8)) {
  console.log(`  [${l.type}] ${l.text}`);
}

console.log(`\nScreenshots: ${OUT}/`);
console.log('Browser stays open 30s.');
await page.waitForTimeout(30000);
await ctx.close();
