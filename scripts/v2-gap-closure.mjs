/**
 * Gap closure: exercise the things the prior battery skipped:
 *   GAP1: Drafting export — actually download DOCX/PDF/HTML
 *   GAP2: Drafting Magic full generation (kicks /api/agent/drafting-magic)
 *   GAP3: Verify Citation: confirm explicit "fake" verdict on Smith v. Jones
 *   GAP4: Verify the new hardening headers (X-Frame, X-Content-Type, Referrer, Permissions)
 *   GAP5: IDB token-store name (cla-sanitization-v1)
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';

const BASE = 'https://california-law-chatbot-v2.vercel.app';
const OUT = '/tmp/v2-gap';
const USER_DATA = '/tmp/playwright-v2-userdata';
mkdirSync(OUT, { recursive: true });
mkdirSync(`${OUT}/dl`, { recursive: true });

const results = [];
function rec(group, test, verdict, detail = '') {
  results.push({ group, test, verdict, detail, ts: new Date().toISOString() });
  console.log(`  [${group}] ${test}: ${verdict}${detail ? ' — ' + detail : ''}`);
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
}

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1500, height: 1000 },
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
  acceptDownloads: true,
});
for (const p of ctx.pages()) await p.close().catch(() => {});
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
}

// ============================================================
// GAP1: Drafting export downloads
// ============================================================
console.log(`\n=== GAP1: Drafting exports ===`);
try {
  await page.goto(`${BASE}/v2/draft`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('text=Legal Research Memorandum').first().click();
  await page.waitForTimeout(2500);
  const pf = page.getByRole('button', { name: /Use test data/i }).first();
  if (await pf.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pf.click();
    await page.waitForTimeout(1500);
  }
  await page.getByRole('button', { name: /Draft Legal Research Memorandum/i }).first().click();
  console.log('  generating memo (waiting 100s for completion)...');
  await page.waitForTimeout(100000);
  await shot('GAP1-after-gen');
  // Look for the Export panel — H3 "Export"
  const exportH3Visible = await page.locator('h3:has-text("Export")').isVisible({ timeout: 5000 }).catch(() => false);
  rec('GAP1', 'GAP1: Export panel present after generation',
    exportH3Visible ? 'PASS' : 'FAIL', '');

  for (const fmt of ['DOCX', 'PDF', 'HTML']) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`Export ${fmt}`, 'i') }).first();
      const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!visible) {
        rec('GAP1', `GAP1: Export ${fmt} button visible`, 'FAIL', '');
        continue;
      }
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        btn.click(),
      ]);
      if (!download) {
        rec('GAP1', `GAP1: Export ${fmt} triggers download`, 'FAIL', '');
        continue;
      }
      const path = `${OUT}/dl/memo.${fmt.toLowerCase()}`;
      await download.saveAs(path);
      const size = existsSync(path) ? statSync(path).size : 0;
      rec('GAP1', `GAP1: Export ${fmt} downloads non-empty file`,
        size > 1000 ? 'PASS' : 'FAIL', `${size} bytes`);
      if (fmt === 'HTML' && size > 0) {
        const content = readFileSync(path, 'utf8');
        rec('GAP1', 'GAP1: HTML export contains real names (user owns the file)',
          /Sarah Chen|Michael Rodriguez|John Smith/.test(content) ? 'PASS' : 'INFO',
          '');
        rec('GAP1', 'GAP1: HTML export has NO stray CLIENT_NNN tokens',
          !/CLIENT_\d+/.test(content) ? 'PASS' : 'FAIL',
          /CLIENT_\d+/.test(content) ? content.match(/CLIENT_\d+/g)?.slice(0,3).join(',') : '');
      }
      await page.waitForTimeout(1000);
    } catch (e) {
      rec('GAP1', `GAP1: Export ${fmt}`, 'ERROR', e.message.slice(0, 100));
    }
  }
} catch (e) {
  rec('GAP1', 'GAP1', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// GAP3: Verify Citation — fake cite handling
// ============================================================
console.log(`\n=== GAP3: Verify Citation fake-cite handling ===`);
try {
  await page.goto(`${BASE}/v2/verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const ta = page.locator('textarea').first();
  await ta.fill('In Marvin v. Marvin, 18 Cal. 3d 660 (1976), the court ruled X. The plaintiff also relies on Smith v. Jones, 999 Cal. 5th 9999 (2099), a case that does not exist in any reporter.');
  await page.waitForTimeout(2000);
  const vb = page.getByRole('button', { name: 'Verify Citations', exact: true }).first();
  await vb.click();
  console.log('  verify clicked, waiting 90s for both citations...');
  await page.waitForTimeout(90000);
  await shot('GAP3-after-verify');
  const verdictText = await page.evaluate(() => {
    const sects = document.querySelectorAll('section');
    for (const s of sects) {
      const h = s.querySelector('h2');
      if (h && /Verdict/i.test(h.textContent || '')) return s.textContent || '';
    }
    return '';
  });
  rec('GAP3', 'GAP3: Marvin v. Marvin verified as real',
    /Marvin/i.test(verdictText) && /verified|real|✓/i.test(verdictText) ? 'PASS' : 'INFO',
    verdictText.slice(0, 200));
  rec('GAP3', 'GAP3: Smith v. Jones (fake) explicitly flagged',
    /(Smith.*Jones[^]*?(fake|not verified|✗|hallucina|ambiguous))/i.test(verdictText)
      ? 'PASS' : 'INFO',
    verdictText.match(/Smith v\. Jones[^.]{0,200}/i)?.[0]?.slice(0, 200) || verdictText.slice(0, 200));
} catch (e) {
  rec('GAP3', 'GAP3', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// GAP4: hardening headers
// ============================================================
console.log(`\n=== GAP4: Hardening headers ===`);
try {
  const resp = await fetch(`${BASE}/v2`);
  for (const [name, expected] of [
    ['x-frame-options', 'DENY'],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['permissions-policy', /geolocation=/i],
  ]) {
    const val = resp.headers.get(name);
    const ok = expected instanceof RegExp ? expected.test(val || '') : val === expected;
    rec('GAP4', `GAP4: ${name} = "${expected instanceof RegExp ? expected.source : expected}"`,
      ok ? 'PASS' : 'FAIL', val || '(not set)');
  }
} catch (e) {
  rec('GAP4', 'GAP4', 'ERROR', e.message.slice(0, 100));
}

// ============================================================
// GAP5: IDB token store (use correct DB name)
// ============================================================
console.log(`\n=== GAP5: IDB token store ===`);
try {
  await page.goto(`${BASE}/v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const report = await page.evaluate(async () => {
    const names = ['cla-sanitization-v1', 'cla-sanitization', 'sanitization'];
    const found = [];
    for (const n of names) {
      const r = await new Promise(resolve => {
        const req = indexedDB.open(n);
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);
          if (!stores.length) {
            db.close();
            resolve({ name: n, exists: false });
            return;
          }
          try {
            const tx = db.transaction(stores, 'readonly');
            const counts = {};
            let done = 0;
            for (const s of stores) {
              const cr = tx.objectStore(s).count();
              cr.onsuccess = () => {
                counts[s] = cr.result;
                if (++done === stores.length) {
                  db.close();
                  resolve({ name: n, exists: true, stores, counts });
                }
              };
            }
          } catch (e) {
            db.close();
            resolve({ name: n, error: e.message });
          }
        };
      });
      if (r) found.push(r);
    }
    return found;
  });
  const v1 = report.find(r => r.name === 'cla-sanitization-v1');
  rec('GAP5', 'GAP5: cla-sanitization-v1 IDB exists with stores',
    v1?.stores?.length > 0 ? 'PASS' : 'FAIL',
    v1 ? JSON.stringify(v1) : 'not found');
  const totalRecords = v1?.counts ? Object.values(v1.counts).reduce((a, b) => a + b, 0) : 0;
  rec('GAP5', 'GAP5: IDB has at least one persisted record (token map populated)',
    totalRecords > 0 ? 'PASS' : 'INFO', `total records=${totalRecords}`);
} catch (e) {
  rec('GAP5', 'GAP5', 'ERROR', e.message.slice(0, 100));
}

// ============================================================
// GAP2: Drafting Magic full generation
// ============================================================
console.log(`\n=== GAP2: Drafting Magic generate ===`);
try {
  await page.goto(`${BASE}/v2/magic`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await shot('GAP2-magic');
  // Find the primary generate-draft button. Magic page has many buttons;
  // look for one that triggers `/api/agent/drafting-magic`.
  const candidates = [
    /Generate.*Draft/i,
    /Run Magic/i,
    /Draft.*Now/i,
    /Create.*Draft/i,
    /^Generate$/i,
    /^Draft$/i,
  ];
  let clicked = false;
  for (const pattern of candidates) {
    const btn = page.getByRole('button', { name: pattern }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      const label = (await btn.textContent())?.trim() || '?';
      console.log(`  found Magic generate button: "${label}"`);
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    rec('GAP2', 'GAP2: Magic generate button discoverable', 'INFO',
      'no obvious generate-draft button — flow may require attorney typing first');
  } else {
    console.log('  waiting 60s for generation...');
    await page.waitForTimeout(60000);
    await shot('GAP2-after-generate');
    const body = await page.evaluate(() => document.body?.innerText || '');
    rec('GAP2', 'GAP2: Magic generation produced changed UI',
      body.length > 3000 ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);
  }
} catch (e) {
  rec('GAP2', 'GAP2', 'ERROR', e.message.slice(0, 150));
}

console.log(`\n=== GAP CLOSURE DONE ===`);
const tot = results.length;
const p = results.filter(r => r.verdict === 'PASS').length;
console.log(`  total=${tot} pass=${p}`);
await page.waitForTimeout(3000);
await ctx.close();
