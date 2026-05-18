/**
 * Final deep verify: fixes locators for E2 + adds Export probes (DOCX/PDF/HTML).
 * This is the last test sweep before report writeup.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'https://california-law-chatbot-v2.vercel.app';
const OUT = '/tmp/v2-final';
const USER_DATA = '/tmp/playwright-v2-userdata';
mkdirSync(OUT, { recursive: true });

const results = [];
function rec(group, test, verdict, detail = '') {
  results.push({ group, test, verdict, detail, ts: new Date().toISOString() });
  console.log(`  [${group}] ${test}: ${verdict}${detail ? ' — ' + detail : ''}`);
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
}

const downloadDir = `${OUT}/downloads`;
mkdirSync(downloadDir, { recursive: true });

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

const wireReqs = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('/api/')) {
    let body = '';
    try { body = req.postData() || ''; } catch {}
    wireReqs.push({ url, method: req.method(), body: body.slice(0, 50000) });
  }
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
}

// ============================================================
// E2 redo: use EXACT-text role-button match (case-sensitive)
// to avoid sidebar's lowercase "Verify citations"
// ============================================================
console.log(`\n=== E2 (exact-match): Verify Citations ===`);
try {
  await page.goto(`${BASE}/v2/verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const ta = page.locator('textarea').first();
  await ta.waitFor({ timeout: 10000 });
  await ta.fill('In Marvin v. Marvin, 18 Cal. 3d 660 (1976), the California Supreme Court held cohabitants could enforce contracts. The plaintiff also cites Smith v. Jones, 999 Cal. 5th 9999 (2099) which does not exist.');
  await page.waitForTimeout(2000);
  await shot('E-pasted');
  // EXACT match — sidebar text is "Verify citations" (lowercase c), main button is "Verify Citations"
  const vb = page.getByRole('button', { name: 'Verify Citations', exact: true }).first();
  const ok = await vb.isVisible({ timeout: 5000 }).catch(() => false);
  if (!ok) {
    rec('E', 'E2-exact: main Verify button found', 'FAIL', '');
  } else {
    rec('E', 'E2-exact: main Verify button found', 'PASS', '');
    await vb.click();
    console.log('  Verify clicked. Waiting 60s...');
    await page.waitForTimeout(60000);
    await shot('E-done');
    const verdictText = await page.evaluate(() => {
      const sects = document.querySelectorAll('section');
      for (const s of sects) {
        const h = s.querySelector('h2');
        if (h && /Verdict/i.test(h.textContent || '')) return s.textContent || '';
      }
      return '';
    });
    rec('E', 'E2-exact: verdict pane has output',
      verdictText.length > 60 && /(real|fake|verified|ambiguous|not verified|\b\d+ verified)/i.test(verdictText) ? 'PASS' : 'FAIL',
      `verdict pane length=${verdictText.length}, snippet="${verdictText.slice(0, 120)}"`);
    rec('E', 'E2-exact: Marvin v. Marvin in verdicts',
      /Marvin/i.test(verdictText) ? 'PASS' : 'FAIL', verdictText.slice(0, 200));
  }
} catch (e) {
  rec('E', 'E2-exact', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// EXPORTS: generate a draft then download DOCX/PDF/HTML
// ============================================================
console.log(`\n=== EXPORTS: DOCX / PDF / HTML ===`);
try {
  await page.goto(`${BASE}/v2/draft`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.locator('text=Legal Research Memorandum').first().click();
  await page.waitForTimeout(2000);
  const pf = page.getByRole('button', { name: /Use test data/i }).first();
  if (await pf.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pf.click();
    await page.waitForTimeout(1500);
  }
  const gen = page.getByRole('button', { name: /Draft Legal Research Memorandum/i }).first();
  await gen.click();
  console.log('  generating draft (90s)...');
  await page.waitForTimeout(90000);
  await shot('EXP-after-generate');
  // Find export buttons — should appear in the Draft Output column after streaming completes
  for (const fmt of ['DOCX', 'PDF', 'HTML']) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`Export ${fmt}|Download ${fmt}|${fmt}$|\\.${fmt.toLowerCase()}`, 'i') }).first();
      const exists = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!exists) {
        rec('EXP', `EXP-${fmt}: button visible`, 'INFO', 'not found');
        continue;
      }
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        btn.click(),
      ]);
      if (!dl) {
        rec('EXP', `EXP-${fmt}: download triggered`, 'FAIL', '');
        continue;
      }
      const path = `${downloadDir}/memo-export.${fmt.toLowerCase()}`;
      await dl.saveAs(path);
      const size = existsSync(path) ? statSync(path).size : 0;
      rec('EXP', `EXP-${fmt}: file downloaded`,
        size > 500 ? 'PASS' : 'FAIL', `${size} bytes → ${path}`);
      // For HTML, also check that real names exist in the file (user owns the export)
      if (fmt === 'HTML' && size > 0) {
        const content = readFileSync(path, 'utf8');
        const hasNames = /Sarah Chen|Michael Rodriguez|John Smith/.test(content);
        const hasTokens = /CLIENT_\d+|ADDRESS_\d+/.test(content);
        rec('EXP', 'EXP-HTML: contains real names (user owns export)',
          hasNames ? 'PASS' : 'INFO', '');
        rec('EXP', 'EXP-HTML: tokens absent from exported file',
          !hasTokens ? 'PASS' : 'FAIL',
          hasTokens ? `tokens leaked into export: ${content.match(/(CLIENT|ADDRESS)_\d+/g)?.slice(0,3).join(',')}` : '');
      }
    } catch (e) {
      rec('EXP', `EXP-${fmt}`, 'ERROR', e.message.slice(0, 100));
    }
  }
} catch (e) {
  rec('EXP', 'EXP main', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// TOOL OUTPUT REDACTION: trigger web_search; verify response
// has no PII patterns it shouldn't have
// ============================================================
console.log(`\n=== TOOL OUTPUT REDACTION ===`);
try {
  await page.goto(`${BASE}/v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  wireReqs.length = 0;
  const ta = page.locator('textarea').first();
  await ta.click();
  await ta.fill('Search the web for "Marc Rich pardon" — find news articles. Quote phone numbers or emails if they appear.');
  await page.waitForTimeout(2500);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(60000);
  await shot('TOR-after-search');
  const body = await page.evaluate(() => document.body?.innerText || '');
  // Look for any SSN, phone, or email pattern in the visible response
  const ssns = (body.match(/\b\d{3}-\d{2}-\d{4}\b/g) || []).length;
  const phones = (body.match(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g) || []).length;
  const emails = (body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).length;
  // These should be sanitized either to tokens or filtered out
  rec('TOR', 'TOR: no SSN-format strings in tool-output response',
    ssns === 0 ? 'PASS' : 'INFO', `${ssns} SSN-like strings`);
  rec('TOR', 'TOR: response is substantive',
    body.length > 2000 ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);
  rec('TOR', 'TOR: tool round-count info present (sources panel)',
    /search|courtlistener|web_search|tool/i.test(body) ? 'PASS' : 'INFO', '');
} catch (e) {
  rec('TOR', 'TOR', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// TOKEN MAP IDB SURVIVAL: read indexedDB contents
// ============================================================
console.log(`\n=== IDB TOKEN MAP ===`);
try {
  await page.goto(`${BASE}/v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  // Use page.evaluate to inspect IndexedDB sanitization store
  const idbReport = await page.evaluate(async () => {
    return new Promise(resolve => {
      const req = indexedDB.open('cla-sanitization', 1);
      req.onerror = () => resolve({ ok: false, err: 'open' });
      req.onsuccess = () => {
        const db = req.result;
        const stores = Array.from(db.objectStoreNames);
        if (!stores.length) { resolve({ ok: false, err: 'no stores' }); return; }
        try {
          const tx = db.transaction(stores, 'readonly');
          const counts = {};
          let done = 0;
          for (const name of stores) {
            const cr = tx.objectStore(name).count();
            cr.onsuccess = () => {
              counts[name] = cr.result;
              if (++done === stores.length) resolve({ ok: true, counts });
            };
          }
        } catch (e) {
          resolve({ ok: false, err: e.message });
        }
      };
    });
  });
  if (idbReport.ok) {
    const total = Object.values(idbReport.counts).reduce((a, b) => a + b, 0);
    rec('IDB', 'IDB: cla-sanitization DB accessible',
      total > 0 ? 'PASS' : 'FAIL', JSON.stringify(idbReport.counts));
  } else {
    rec('IDB', 'IDB: cla-sanitization DB accessible', 'FAIL', idbReport.err || '');
  }
  // Also check the device-key in localStorage
  const deviceKey = await page.evaluate(() => localStorage.getItem('cla-sanitization-device-key'));
  rec('IDB', 'IDB: device-key in localStorage',
    !!deviceKey ? 'PASS' : 'FAIL', deviceKey ? `len=${deviceKey.length}` : '');
} catch (e) {
  rec('IDB', 'IDB', 'ERROR', e.message.slice(0, 150));
}

// ============================================================
// CSP / response headers smoke
// ============================================================
console.log(`\n=== CSP HEADERS ===`);
try {
  const resp = await fetch(`${BASE}/v2`);
  const csp = resp.headers.get('content-security-policy');
  const xfo = resp.headers.get('x-frame-options');
  const xcto = resp.headers.get('x-content-type-options');
  rec('CSP', 'CSP: Content-Security-Policy header set',
    !!csp ? 'PASS' : 'INFO', csp ? csp.slice(0, 200) : 'not set');
  rec('CSP', 'CSP: X-Frame-Options header',
    !!xfo ? 'PASS' : 'INFO', xfo || 'not set');
  rec('CSP', 'CSP: X-Content-Type-Options',
    xcto === 'nosniff' ? 'PASS' : 'INFO', xcto || '');
} catch (e) {
  rec('CSP', 'CSP', 'ERROR', e.message.slice(0, 100));
}

// ============================================================
// SOURCES PANEL — were sources rendered for the earlier turn?
// ============================================================
console.log(`\n=== SOURCES ===`);
try {
  await page.goto(`${BASE}/v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  // Navigate to a prior session with sources
  const firstSession = page.locator('aside button[title^="v2_"]').first();
  if (await firstSession.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstSession.click();
    await page.waitForTimeout(6000);
    const body = await page.evaluate(() => document.body?.innerText || '');
    rec('SRC', 'SRC: source attribution rendered',
      /Source|courtlistener|CEB|Citation/i.test(body) ? 'PASS' : 'INFO', '');
  }
} catch (e) {
  rec('SRC', 'SRC', 'ERROR', e.message.slice(0, 100));
}

console.log(`\n=== FINAL DEEP DONE ===`);
const tot = results.length;
const p = results.filter(r => r.verdict === 'PASS').length;
const f = results.filter(r => r.verdict === 'FAIL').length;
console.log(`  total=${tot} pass=${p} fail=${f}`);

await page.waitForTimeout(3000);
await ctx.close();
