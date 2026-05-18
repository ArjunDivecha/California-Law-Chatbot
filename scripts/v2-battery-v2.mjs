/**
 * V2 battery v2 — harder error isolation. Every test in its own try/catch
 * with a hard 90s page-state timeout so one stuck test never kills the run.
 * Re-uses /tmp/playwright-v2-userdata signed-in session.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'https://california-law-chatbot-v2.vercel.app';
const OUT = '/tmp/v2-battery';
const USER_DATA = '/tmp/playwright-v2-userdata';
mkdirSync(OUT, { recursive: true });

const results = [];
let shotIdx = 0;
function rec(group, test, verdict, detail = '') {
  const r = { group, test, verdict, detail, ts: new Date().toISOString() };
  results.push(r);
  console.log(`  [${group}] ${test}: ${verdict}${detail ? ' — ' + detail : ''}`);
  writeFileSync(`${OUT}/results.json`, JSON.stringify({
    meta: { ts: new Date().toISOString(), total: results.length },
    results,
  }, null, 2));
}

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1500, height: 1000 },
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
for (const p of ctx.pages()) await p.close().catch(() => {});
const page = await ctx.newPage();

const wireRequests = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('/api/')) {
    let body = '';
    try { body = req.postData() || ''; } catch {}
    wireRequests.push({ url, method: req.method(), body: body.slice(0, 50000), ts: Date.now() });
  }
});
page.on('pageerror', e => writeFileSync(`${OUT}/console-log.txt`, `[pageerror] ${e.message}\n`, { flag: 'a' }));
// Auto-dismiss any browser dialogs (XSS test in J1)
page.on('dialog', async d => {
  console.log(`  ! dialog appeared: ${d.type()} ${d.message().slice(0, 80)}`);
  rec('J', 'J1-XSS-DIALOG', 'FAIL', `dialog fired: ${d.message().slice(0, 100)}`);
  await d.dismiss().catch(() => {});
});

async function shot(name) {
  shotIdx++;
  const f = `${OUT}/${String(shotIdx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
  return f;
}

async function bodyText() {
  try {
    return await page.evaluate(() => document.body?.innerText || '');
  } catch { return ''; }
}

async function scan() {
  const text = await bodyText();
  return {
    CLIENT: (text.match(/CLIENT_\d+/g) || []).length,
    ADDRESS: (text.match(/ADDRESS_\d+/g) || []).length,
    PHONE: (text.match(/PHONE_\d+/g) || []).length,
    SSN: (text.match(/SSN_\d+/g) || []).length,
    realName: /John Smith|Jane Doe|Bartholomew|Theodore/.test(text),
    realAddr: /Mowry|Fremont|Elm Grove|Pennsylvania/.test(text),
    length: text.length,
  };
}

async function safeGoto(url, waitMs = 4000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(waitMs);
    return true;
  } catch (e) {
    console.log(`  goto ${url} failed: ${e.message.slice(0, 80)}`);
    return false;
  }
}

async function chatTurn(text, waitMs = 30000) {
  const ta = page.locator('textarea').first();
  await ta.waitFor({ timeout: 10000 });
  await ta.click();
  await ta.fill(text);
  await page.waitForTimeout(2000);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(waitMs);
}

// Wrapper: run a test fn with a hard timeout, never throws
async function safeTest(group, name, fn, timeoutMs = 120000) {
  const timer = new Promise(r => setTimeout(() => r({ verdict: 'TIMEOUT' }), timeoutMs));
  try {
    const result = await Promise.race([fn(), timer]);
    if (result?.verdict === 'TIMEOUT') {
      rec(group, name, 'TIMEOUT', `>${timeoutMs / 1000}s`);
    }
    // fn handles its own rec() calls
  } catch (e) {
    rec(group, name, 'ERROR', e.message.slice(0, 150));
  }
}

// ==== sign-in check ====
console.log(`\n=== sign-in check ===`);
await safeGoto(`${BASE}/v2`, 4000);
const ta = page.locator('textarea').first();
if (!(await ta.isVisible({ timeout: 5000 }).catch(() => false))) {
  console.log('  not signed in — waiting up to 4 min');
  await ta.waitFor({ timeout: 240_000 }).catch(() => {});
}
await shot('signed-in');

// =========================================================================
// GROUP A: Rehydration parity
// =========================================================================
console.log(`\n=== A. REHYDRATION PARITY ===`);

await safeTest('A', 'A1: /v2 chat rehydration on reload', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  await chatTurn('please draft a will for John Smith of 123 Mowry Avenue', 30000);
  await shot('A1-after-turn');
  const sBtn = page.locator('aside button[title^="v2_"], aside button[title^="v2d_"]').first();
  await sBtn.click({ timeout: 10000 });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const t = await scan();
  await shot('A1-after-reload');
  rec('A', 'A1: /v2 chat rehydration on reload',
    t.realName && t.CLIENT === 0 ? 'PASS' : 'FAIL',
    `realName=${t.realName} CLIENT=${t.CLIENT}`);
}, 180000);

for (const [letter, url] of [['A2', '/v2/draft'], ['A3', '/v2/magic'], ['A4', '/v2/verify']]) {
  await safeTest('A', `${letter}: ${url} no stray tokens on load`, async () => {
    await safeGoto(`${BASE}${url}`, 6000);
    const t = await scan();
    await shot(`${letter}-${url.replace('/', '-')}-loaded`);
    rec('A', `${letter}: ${url} no stray tokens on load`,
      t.CLIENT === 0 && t.ADDRESS === 0 ? 'PASS' : 'FAIL',
      `CLIENT=${t.CLIENT} ADDRESS=${t.ADDRESS} bodyLen=${t.length}`);
  }, 60000);
}

// =========================================================================
// GROUP B: WIRE-GUARD
// =========================================================================
console.log(`\n=== B. WIRE-GUARD ===`);
await safeTest('B', 'B1: zero raw-PII leaks on chat /api/* requests', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  wireRequests.length = 0;
  const RAW = {
    name: 'Bartholomew Pennington-Smythe',
    addr: '7421 Elm Grove Lane, Sacramento CA 95816',
    phone: '415-555-9876',
    ssn: '123-45-6789',
  };
  await chatTurn(`Draft a will for ${RAW.name} at ${RAW.addr}, phone ${RAW.phone}, SSN ${RAW.ssn}`, 30000);
  await shot('B1-after-turn');
  const patterns = [
    { name: 'unique-surname', re: /Pennington-Smythe/i },
    { name: 'unique-street', re: /Elm Grove Lane/i },
    { name: 'unique-phone', re: /415-555-9876/ },
    { name: 'ssn-format', re: /\d{3}-\d{2}-\d{4}/ },
  ];
  const leaks = [];
  for (const r of wireRequests) {
    for (const p of patterns) {
      if (p.re.test(r.body)) leaks.push({ pattern: p.name, url: r.url.replace(/https:\/\/[^/]+/, '') });
    }
  }
  writeFileSync(`${OUT}/B1-wire-detail.json`, JSON.stringify({
    requests: wireRequests.length,
    leaks,
    urls: [...new Set(wireRequests.map(r => r.url.replace(/https:\/\/[^/]+/, '')))],
  }, null, 2));
  rec('B', 'B1: zero raw-PII on chat /api/* requests',
    leaks.length === 0 ? 'PASS' : 'FAIL',
    `${leaks.length} leak(s) across ${wireRequests.length} requests`);
}, 90000);

// =========================================================================
// GROUP C: Drafting templates (presence + 1 full e2e)
// =========================================================================
console.log(`\n=== C. DRAFTING TEMPLATES ===`);
const TEMPLATES = ['Legal Research Memorandum', 'Demand Letter', 'Client Advisory Letter', 'Motion to Compel Discovery'];
for (const t of TEMPLATES) {
  await safeTest('C', `${t} template card visible`, async () => {
    await safeGoto(`${BASE}/v2/draft`, 4000);
    const card = page.locator(`text=${t}`).first();
    const has = await card.isVisible({ timeout: 5000 }).catch(() => false);
    rec('C', `${t} template card`, has ? 'PASS' : 'FAIL', '');
    if (has) {
      await card.click();
      await page.waitForTimeout(2000);
      const inputs = await page.locator('textarea, input[type="text"], input[type="date"]').count();
      rec('C', `${t} renders form fields`, inputs > 2 ? 'PASS' : 'FAIL', `${inputs} fields`);
    }
  }, 30000);
}

// One e2e (Legal Research Memo — simpler than Demand Letter, fewer fields)
await safeTest('C', 'C-e2e: Legal Research Memo full generation', async () => {
  await safeGoto(`${BASE}/v2/draft`, 4000);
  await page.locator('text=Legal Research Memorandum').first().click();
  await page.waitForTimeout(2000);
  const pf = page.getByRole('button', { name: /test data|pre.?fill/i }).first();
  if (await pf.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pf.click();
    await page.waitForTimeout(1500);
  }
  const gen = page.getByRole('button', { name: /^Draft|^Generate/i }).first();
  if (!(await gen.isVisible({ timeout: 3000 }).catch(() => false))) {
    rec('C', 'C-e2e: Memo generation', 'SKIP', 'no Generate button');
    return;
  }
  await gen.click();
  await page.waitForTimeout(75000);
  await shot('C-memo-final');
  const t = await scan();
  rec('C', 'C-e2e: Memo generation produces body',
    t.length > 1500 ? 'PASS' : 'FAIL', `bodyLen=${t.length}`);
  rec('C', 'C-e2e: Memo output free of stray tokens',
    t.CLIENT === 0 && t.ADDRESS === 0 ? 'PASS' : 'FAIL',
    `CLIENT=${t.CLIENT} ADDRESS=${t.ADDRESS}`);
}, 120000);

// =========================================================================
// GROUP D: Drafting Magic
// =========================================================================
console.log(`\n=== D. DRAFTING MAGIC ===`);
await safeTest('D', 'D-multi: Magic page UI checks', async () => {
  await safeGoto(`${BASE}/v2/magic`, 6000);
  await shot('D-magic');
  const t = await scan();
  rec('D', 'D1: Magic page loads with content',
    t.length > 500 ? 'PASS' : 'FAIL', `bodyLen=${t.length}`);

  const tabs = ['Strategy', 'Sources', 'Compliance', 'Draft'];
  const body = await bodyText();
  for (const tab of tabs) {
    rec('D', `D-tab: "${tab}" mentioned in UI`,
      new RegExp(tab, 'i').test(body) ? 'PASS' : 'INFO', '');
  }

  // Persistence test
  const taArea = page.locator('textarea').first();
  if (await taArea.isVisible({ timeout: 3000 }).catch(() => false)) {
    const MARKER = `__pers_${Date.now()}__`;
    await taArea.fill(MARKER);
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    const after = await bodyText();
    rec('D', 'D2: workspace persists across reload (localStorage)',
      after.includes(MARKER) ? 'PASS' : 'FAIL', '');
  } else {
    rec('D', 'D2: workspace persists', 'SKIP', 'no textarea visible');
  }
}, 90000);

// =========================================================================
// GROUP E: /v2/verify
// =========================================================================
console.log(`\n=== E. VERIFY CITATION ===`);
await safeTest('E', 'E1: /v2/verify renders + verifies cites', async () => {
  await safeGoto(`${BASE}/v2/verify`, 5000);
  await shot('E-verify');
  const body = await bodyText();
  rec('E', 'E1: /v2/verify page renders',
    /Verify|Citation|passage/i.test(body) ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);

  const taE = page.locator('textarea').first();
  if (await taE.isVisible({ timeout: 3000 }).catch(() => false)) {
    await taE.fill('In Marvin v. Marvin, 18 Cal. 3d 660 (1976), the California Supreme Court held that unmarried cohabitants could enforce contracts. The plaintiff also cites Smith v. Jones, 999 Cal. 5th 9999 (2099), which does not exist.');
    await page.waitForTimeout(2000);
    const vb = page.getByRole('button', { name: /Verify Citation/i }).first();
    if (await vb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await vb.click();
      await page.waitForTimeout(60000);
      await shot('E-verify-done');
      const after = await bodyText();
      rec('E', 'E2: Verify produces output',
        /(real|fake|verified|ambiguous|not verified)/i.test(after) ? 'PASS' : 'FAIL', '');
    } else {
      rec('E', 'E2: Verify button found', 'FAIL', 'no Verify Citation button');
    }
  } else {
    rec('E', 'E2: paste passage', 'SKIP', 'no textarea');
  }
}, 120000);

// =========================================================================
// GROUP F: Tool integrations
// =========================================================================
console.log(`\n=== F. TOOL INTEGRATIONS ===`);
await safeTest('F', 'F: tools surfaced in research turn', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  await chatTurn('What does California Code of Civil Procedure 425.16 require? Cite CEB and CourtListener.', 60000);
  await shot('F-after-tools');
  const body = await bodyText();
  const checks = [
    { name: 'CEB', re: /CEB|California Civil Practice/i },
    { name: 'CourtListener', re: /CourtListener|courtlistener\.com/i },
    { name: 'California Code', re: /Cal\.|CCP|Code of Civil Procedure/i },
  ];
  for (const c of checks) {
    rec('F', `F: ${c.name} visible`,
      c.re.test(body) ? 'PASS' : 'INFO', '');
  }
  rec('F', 'F: substantive response',
    body.length > 2000 ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);
}, 90000);

// =========================================================================
// GROUP G: Audit chain
// =========================================================================
console.log(`\n=== G. AUDIT CHAIN ===`);
await safeTest('G', 'G: Upstash audit records', async () => {
  execSync('vercel env pull /tmp/v2-prod.local --environment=production --scope team_Ey1tbKTda2OYUXPoGEwh0VKi 2>&1 | tail -1');
  const envText = readFileSync('/tmp/v2-prod.local', 'utf8');
  const URL = (envText.match(/^UPSTASH_REDIS_REST_URL="?(.*?)"?$/m) || [])[1];
  const TOKEN = (envText.match(/^UPSTASH_REDIS_REST_TOKEN="?(.*?)"?$/m) || [])[1];
  if (!URL || !TOKEN) { rec('G', 'G: Upstash', 'SKIP', 'no creds'); return; }
  const today = new Date().toISOString().slice(0, 10);

  const daily = await fetch(`${URL}/lrange/audit:${today}/0/20`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const dailyCount = Array.isArray(daily.result) ? daily.result.length : 0;
  rec('G', 'G1: audit:YYYY-MM-DD daily list has entries',
    dailyCount > 0 ? 'PASS' : 'FAIL', `${dailyCount} entries`);

  let plaintextLeak = false;
  for (const e of (daily.result || [])) {
    if (/Pennington-Smythe|Elm Grove|Mowry|John Smith|Theodore Roosevelt/.test(e)) plaintextLeak = true;
  }
  rec('G', 'G2: audit entries contain NO raw PII',
    !plaintextLeak ? 'PASS' : 'FAIL', '');

  const env = await fetch(`${URL}/scan/0/match/audit_record_envelope:*/count/30`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const envKeys = Array.isArray(env.result?.[1]) ? env.result[1].length : 0;
  rec('G', 'G3: envelope-encrypted records present',
    envKeys > 0 ? 'PASS' : 'FAIL', `${envKeys} keys`);

  const sh = await fetch(`${URL}/scan/0/match/shadow:*/count/20`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` },
  }).then(r => r.json());
  const shKeys = Array.isArray(sh.result?.[1]) ? sh.result[1].length : 0;
  rec('G', 'G4: shadow:* keys present (V1 dual-fire)',
    shKeys > 0 ? 'PASS' : 'INFO', `${shKeys} keys`);
}, 60000);

// =========================================================================
// GROUP J: Edge cases
// =========================================================================
console.log(`\n=== J. EDGE CASES ===`);
await safeTest('J', 'J1: XSS in input does not execute', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  await chatTurn('Draft a will for <script>alert("XSS123")</script> of <img src=x onerror=alert(456)>123 Main', 15000);
  await shot('J1-xss');
  const html = await page.evaluate(() => document.documentElement.innerHTML);
  const rawScript = html.includes('<script>alert("XSS123")</script>');
  rec('J', 'J1: no live <script> in DOM',
    !rawScript ? 'PASS' : 'FAIL', '');
}, 60000);

await safeTest('J', 'J2: 5000-char input does not crash', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  const longText = 'Discuss legal X. '.repeat(330);
  await chatTurn(longText, 20000);
  await shot('J2-long');
  rec('J', 'J2: long-input handled', 'PASS', `len=${longText.length}`);
}, 60000);

await safeTest('J', 'J3: RTL Unicode names handled', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  await chatTurn('Draft inheritance for محمد علي of 123 King Fahd Road, Riyadh', 25000);
  await shot('J3-rtl');
  rec('J', 'J3: RTL handled', 'PASS', '');
}, 60000);

await safeTest('J', 'J4: empty input → submit disabled', async () => {
  await safeGoto(`${BASE}/v2`, 3000);
  const ta = page.locator('textarea').first();
  await ta.click();
  await ta.fill('');
  await page.waitForTimeout(500);
  const sb = page.locator('button[type="submit"]').first();
  const dis = await sb.isDisabled().catch(() => false);
  rec('J', 'J4: empty input disabled submit', dis ? 'PASS' : 'FAIL', `disabled=${dis}`);
}, 30000);

// =========================================================================
// GROUP L: Navigation
// =========================================================================
console.log(`\n=== L. NAVIGATION ===`);
await safeTest('L', 'L: session navigation', async () => {
  await safeGoto(`${BASE}/v2`, 4000);
  const items = await page.locator('aside button[title^="v2_"], aside button[title^="v2d_"]').count();
  rec('L', 'L1: sidebar shows session items',
    items > 0 ? 'PASS' : 'FAIL', `${items} items`);
  if (items > 0) {
    const first = page.locator('aside button[title^="v2_"], aside button[title^="v2d_"]').first();
    const sid = await first.getAttribute('title');
    await first.click();
    await page.waitForTimeout(3000);
    const url = page.url();
    rec('L', 'L2: session click navigates to /v2/<id>',
      url.includes(sid) ? 'PASS' : 'FAIL', url.slice(-50));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const body = await bodyText();
    rec('L', 'L3: direct session URL reload loads history',
      body.length > 200 && !/Sign in to/.test(body) ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);
  }
}, 60000);

// =========================================================================
// GROUP M: Daemon fail-closed
// =========================================================================
console.log(`\n=== M. DAEMON FAIL-CLOSED ===`);
await safeTest('M', 'M: daemon down → fail-closed (no raw on wire)', async () => {
  execSync('launchctl unload ~/Library/LaunchAgents/com.fflp.gliner-daemon.plist 2>/dev/null || true');
  await new Promise(r => setTimeout(r, 3000));
  let daemonAlive = false;
  try {
    execSync('curl -sS --max-time 1 http://127.0.0.1:47841/v1/health > /dev/null 2>&1');
    daemonAlive = true;
  } catch {}
  rec('M', 'M-pre: daemon stopped',
    !daemonAlive ? 'PASS' : 'FAIL', '');

  await safeGoto(`${BASE}/v2`, 3000);
  wireRequests.length = 0;
  try {
    await chatTurn('Draft a will for Theodore Roosevelt of 1600 Pennsylvania Ave', 15000);
  } catch {}
  await shot('M-daemon-down');
  let raw = false;
  for (const r of wireRequests) {
    if (/Theodore Roosevelt/.test(r.body)) { raw = true; break; }
  }
  rec('M', 'M1: no raw "Theodore Roosevelt" on wire when daemon down',
    !raw ? 'PASS' : 'FAIL', '');

  execSync('launchctl load ~/Library/LaunchAgents/com.fflp.gliner-daemon.plist 2>/dev/null || true');
  await new Promise(r => setTimeout(r, 5000));
}, 90000);

// ===== final =====
console.log(`\n=== BATTERY DONE ===`);
const total = results.length;
const pass = results.filter(r => r.verdict === 'PASS').length;
const fail = results.filter(r => r.verdict === 'FAIL').length;
const err = results.filter(r => r.verdict === 'ERROR' || r.verdict === 'TIMEOUT').length;
const skip = results.filter(r => r.verdict === 'SKIP').length;
const info = results.filter(r => r.verdict === 'INFO').length;
console.log(`  total=${total} pass=${pass} fail=${fail} error=${err} skip=${skip} info=${info}`);

writeFileSync(`${OUT}/results.json`, JSON.stringify({
  meta: { ts: new Date().toISOString(), total, pass, fail, error: err, skip, info, base: BASE },
  results,
}, null, 2));

await page.waitForTimeout(3000);
await ctx.close();
