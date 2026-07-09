/**
 * 9-scenario parity probe — V2 (/v2/magic) vs codex/drafting-magic-sanitized
 * (/drafting-magic). Both apps must be running locally:
 *   - V2 vite on http://localhost:5173
 *   - codex vite on http://localhost:5174
 *
 * For each scenario we capture a small DOM signature on both pages and
 * report match/mismatch. AI generation is intentionally NOT exercised
 * (the codex branch requires Bedrock creds; V2 uses Claude server-side) —
 * structural parity is what we assert.
 */

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire('/Users/arjundivecha/.nvm/versions/node/v24.12.0/lib/node_modules/playwright/');
const { chromium } = require('playwright');

const { clerkSetup, clerk } = await import('@clerk/testing/playwright');

const lines = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8').split('\n');
let key;
for (const l of lines) {
  const m = l.match(/^CLERK_SECRET_KEY=(\S+)/);
  if (m && /califrnia law chatbot/i.test(l)) { key = m[1]; break; }
}
process.env.CLERK_SECRET_KEY = key;
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZW1lcmdpbmctdHJlZWZyb2ctNDkuY2xlcmsuYWNjb3VudHMuZGV2JA';
await clerkSetup();

mkdirSync('/tmp/magic-parity', { recursive: true });

const V2_URL = 'http://localhost:5173/v2/magic';
const CODEX_URL = 'http://localhost:5174/drafting-magic';

async function openPage(browser, baseUrl, magicUrl, label) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await clerk.signIn({ page, emailAddress: 'v2-playwright-e2e+clerk_test@v2.example.com' });
  await page.goto(magicUrl, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 1500));
  // Dismiss codex confidentiality acknowledgment dialog if present so the
  // page content is comparable.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((n) =>
      /understand.*continue|I understand|got it|continue/i.test(n.innerText || ''),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `/tmp/magic-parity/${label}-initial.png` });
  return { ctx, page, errors };
}

async function clickTabByLabel(page, label) {
  // Tab nav: try button/role-tab/a containing the label text
  await page.evaluate((label) => {
    const candidates = Array.from(document.querySelectorAll('button, [role="tab"], a'));
    const target = candidates.find((n) =>
      n.innerText && n.innerText.trim().toLowerCase() === label.toLowerCase(),
    ) || candidates.find((n) =>
      n.innerText && n.innerText.toLowerCase().includes(label.toLowerCase()),
    );
    if (target) target.click();
  }, label);
  await new Promise((r) => setTimeout(r, 700));
}

async function snapshot(page, label) {
  // A small, semi-deterministic DOM signature for parity comparison.
  // Scope to the page main content (skip chrome/sidebar) by anchoring
  // on the "Drafting Magic" H1 — both pages have it, and everything
  // after it in the DOM is page content.
  return page.evaluate((label) => {
    const root = (() => {
      const h1s = Array.from(document.querySelectorAll('h1'));
      const dm = h1s.find((h) => /drafting magic/i.test(h.innerText || ''));
      if (dm) {
        // Walk up to find a top-level container that wraps the whole page
        let node = dm;
        for (let i = 0; i < 8; i += 1) {
          if (!node.parentElement) break;
          node = node.parentElement;
          // Heuristic: stop when the container holds at least 3 H3s
          if (node.querySelectorAll('h3').length >= 3) break;
        }
        return node;
      }
      return document.body;
    })();
    const CHROME_HEADINGS = ['California Law Chatbot'];
    const CHROME_BUTTON_RE =
      /(^\+ New chat$|^New chat$|^Draft a document$|^Verify citations$|^Drafting Magic$|^Sanitization · |^Research$|^Drafting$|^Export workspace$|^Reset$|msg\s+·|ago$|OUTPUT TYPE:)/i;
    const text = (sel) =>
      Array.from(root.querySelectorAll(sel))
        .map((n) => (n.innerText || '').trim())
        .filter(Boolean);
    const buttons = text('button').filter((b) => !CHROME_BUTTON_RE.test(b)).slice(0, 40);
    const headings = [...text('h1'), ...text('h2'), ...text('h3'), ...text('h4')]
      .filter((h) => !CHROME_HEADINGS.includes(h))
      .slice(0, 40);
    const bodyText = (root.innerText || '').replace(/\s+/g, ' ').slice(0, 4000);
    return {
      label,
      headingsCount: headings.length,
      headingsSample: headings.slice(0, 40),
      buttonsCount: buttons.length,
      buttonsSample: buttons.slice(0, 40),
      bodyTextLen: bodyText.length,
      bodyHead: bodyText.slice(0, 1000),
    };
  }, label);
}

function compareSnap(a, b) {
  const keys = ['headingsCount', 'buttonsCount'];
  const diffs = {};
  for (const k of keys) {
    diffs[k] = { v2: a[k], codex: b[k], match: a[k] === b[k] };
  }
  diffs.headingsOverlap = a.headingsSample.filter((h) => b.headingsSample.includes(h)).length;
  diffs.buttonsOverlap = a.buttonsSample.filter((b2) => b.buttonsSample.includes(b2)).length;
  diffs.headingsOnlyV2 = a.headingsSample.filter((h) => !b.headingsSample.includes(h));
  diffs.headingsOnlyCodex = b.headingsSample.filter((h) => !a.headingsSample.includes(h));
  diffs.bodyLenDelta = Math.abs(a.bodyTextLen - b.bodyTextLen);
  // Pass criteria: headings count equal AND all V2 headings present in codex,
  // OR equivalent. Buttons overlap >= 80% of the smaller set.
  const headingsPass =
    a.headingsCount === b.headingsCount &&
    diffs.headingsOnlyV2.length === 0 &&
    diffs.headingsOnlyCodex.length === 0;
  const minBtn = Math.min(a.buttonsCount, b.buttonsCount);
  const buttonsPass = minBtn === 0 ? true : diffs.buttonsOverlap / minBtn >= 0.8;
  diffs.verdict = headingsPass && buttonsPass ? 'PASS' : 'FAIL';
  return diffs;
}

const browser = await chromium.launch({ headless: true });

const v2 = await openPage(browser, 'http://localhost:5173/', V2_URL, 'v2');
const codex = await openPage(browser, 'http://localhost:5174/', CODEX_URL, 'codex');

const scenarios = [
  { name: 'mount', do: async () => {} },
  { name: 'tab-inputs', do: async (p) => clickTabByLabel(p, 'Inputs') },
  { name: 'tab-compare', do: async (p) => clickTabByLabel(p, 'Compare') },
  { name: 'tab-strategy', do: async (p) => clickTabByLabel(p, 'Strategy') },
  { name: 'tab-draft', do: async (p) => clickTabByLabel(p, 'Draft') },
  { name: 'tab-review', do: async (p) => clickTabByLabel(p, 'Review') },
  { name: 'back-to-inputs', do: async (p) => clickTabByLabel(p, 'Inputs') },
  {
    name: 'add-source',
    do: async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((n) =>
          /add.*source|add packet|add document|new source/i.test(n.innerText || ''),
        );
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    },
  },
  {
    name: 'toggle-included',
    do: async (p) => {
      await p.evaluate(() => {
        const cb = document.querySelector('input[type=checkbox]');
        if (cb) cb.click();
      });
      await new Promise((r) => setTimeout(r, 400));
    },
  },
];

const report = { scenarios: [], started_at: new Date().toISOString() };

for (const sc of scenarios) {
  await sc.do(v2.page);
  await sc.do(codex.page);
  const v2Snap = await snapshot(v2.page, sc.name);
  const codexSnap = await snapshot(codex.page, sc.name);
  await v2.page.screenshot({ path: `/tmp/magic-parity/${sc.name}-v2.png` });
  await codex.page.screenshot({ path: `/tmp/magic-parity/${sc.name}-codex.png` });
  const diff = compareSnap(v2Snap, codexSnap);
  report.scenarios.push({ scenario: sc.name, diff, v2: v2Snap, codex: codexSnap });
  console.log(`[${sc.name}] ${diff.verdict.padEnd(4)} headings v2=${v2Snap.headingsCount} codex=${codexSnap.headingsCount} (overlap ${diff.headingsOverlap}) buttons v2=${v2Snap.buttonsCount} codex=${codexSnap.buttonsCount} (overlap ${diff.buttonsOverlap})`);
}

const passed = report.scenarios.filter((s) => s.diff.verdict === 'PASS').length;
const total = report.scenarios.length;
report.summary = { passed, total, parity: `${passed}/${total}` };
report.v2_errors = v2.errors.slice(0, 10);
report.codex_errors = codex.errors.slice(0, 10);
console.log(`\nSUMMARY: ${passed}/${total} scenarios PASS`);
const outPath = `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/magic-parity-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport: ${outPath}`);

await browser.close();
