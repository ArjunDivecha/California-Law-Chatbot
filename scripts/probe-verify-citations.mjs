/**
 * Citation-verification correctness probe.
 *
 * Hits POST /api/agent/verify-stream with a mixed bag of REAL and FAKE
 * citations and asserts the verifier sub-agent classifies each one
 * correctly. Two regression cases are included to lock the recent
 * extractor regex fix (abbreviated party names + multi-period reporters):
 *
 *   REAL cases   → expected verdict status = 'real'
 *   FAKE cases   → expected verdict status = 'fake'
 *   AMBIG cases  → expected status = 'real' OR 'ambiguous' (model has
 *                  some discretion when a real-but-obscure cite returns
 *                  no hits)
 *
 * Requires the dev server on http://localhost:3000 (api/agent/verify-
 * stream is reachable directly there — no Clerk needed for this route).
 * Real verification ~12-18 s/citation; total ~120 s for 7 citations.
 *
 * Test set:
 *   REAL  ─ Marvin v. Marvin (1976) 18 Cal.3d 660                    (palimony)
 *   REAL  ─ Tarasoff v. Regents of Univ. of Cal. (1976) 17 Cal.3d 425
 *           ← REGRESSION: abbreviated party name "Univ. of Cal."
 *   REAL  ─ Miranda v. Arizona (1966) 384 U.S. 436                   (federal)
 *   REAL  ─ Coca-Cola Co. v. Koke Co. (1920) 254 U.S. 143
 *           ← REGRESSION: "Co." abbreviated suffix
 *   FAKE  ─ Smith v. Hallucinated Holdings (2024) 99 Cal.5th 1234
 *   FAKE  ─ People v. Phantom (2023) 88 Cal.App.5th 4567
 *           ← REGRESSION: multi-period reporter "Cal.App.5th"
 *
 * Output: prints a per-citation verdict table + a final pass/fail
 * summary. Exits 0 only if every verdict matches its expected set.
 */

import { mkdirSync, writeFileSync } from 'node:fs';

const ENDPOINT = 'http://localhost:3000/api/agent/verify-stream';

// Each test has `expected` as an array of acceptable status values so
// the verifier has room to mark a real-but-obscure cite as 'ambiguous'
// when CourtListener is rate-limited or has no entry for it.
const TEST_CITATIONS = [
  {
    name: 'Marvin v. Marvin',
    citation: 'Marvin v. Marvin (1976) 18 Cal.3d 660',
    reporter: '18 Cal.3d 660',
    expected: ['real'],
  },
  {
    name: 'Tarasoff v. Regents',
    // Regression for abbreviated party names — "Univ. of Cal." used to
    // confuse the extractor. Fixed in citationVerify.ts.
    citation: 'Tarasoff v. Regents of Univ. of Cal. (1976) 17 Cal.3d 425',
    reporter: '17 Cal.3d 425',
    expected: ['real'],
  },
  {
    name: 'Miranda v. Arizona',
    citation: 'Miranda v. Arizona (1966) 384 U.S. 436',
    reporter: '384 U.S. 436',
    // CourtListener has this opinion, but the verifier sub-agent can land
    // on 'ambiguous' if CL rate-limits during the run. Both outcomes are
    // valid; only 'fake' would be wrong.
    expected: ['real', 'ambiguous'],
  },
  {
    name: 'Coca-Cola Co. v. Koke Co.',
    // Regression for "Co." suffix + hyphenated party name. Real US
    // Supreme Court 1920 trademark case — Justice Holmes opinion.
    // Pre-1924 coverage in CourtListener is sparse; CEB may not cover
    // federal IP cases; 'ambiguous' is acceptable.
    citation: 'Coca-Cola Co. v. Koke Co. (1920) 254 U.S. 143',
    reporter: '254 U.S. 143',
    expected: ['real', 'ambiguous'],
  },
  {
    name: 'Smith v. Hallucinated Holdings',
    citation: 'Smith v. Hallucinated Holdings (2024) 99 Cal.5th 1234',
    reporter: '99 Cal.5th 1234',
    expected: ['fake'],
  },
  {
    name: 'People v. Phantom',
    // Regression for multi-period reporter "Cal.App.5th".
    citation: 'People v. Phantom (2023) 88 Cal.App.5th 4567',
    reporter: '88 Cal.App.5th 4567',
    expected: ['fake'],
  },
];

const inputText = `Please verify the following authorities:
- ${TEST_CITATIONS.map((c) => c.citation).join('\n- ')}`;

console.log(`POSTing ${TEST_CITATIONS.length} citations to ${ENDPOINT}`);
console.log('(verifier sub-agent runs sequentially, ~18s/citation expected)');
console.log('');

const startedAt = Date.now();
const resp = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
  body: JSON.stringify({
    text: inputText,
    session_id: `verify-probe-${Date.now()}`,
    user_id: 'verify-probe',
  }),
});
if (!resp.ok || !resp.body) {
  console.error(`HTTP ${resp.status}`);
  process.exit(2);
}

const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buf = '';
const verdicts = [];
let manifest = null;
let done = false;
let lastEventAt = Date.now();

while (!done) {
  const { done: streamDone, value } = await reader.read();
  if (streamDone) break;
  buf += decoder.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf('\n\n')) !== -1) {
    const block = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    const lines = block.split('\n');
    let evt = 'message';
    let dataLine = '';
    for (const ln of lines) {
      if (ln.startsWith('event:')) evt = ln.slice(6).trim();
      else if (ln.startsWith('data:')) dataLine += ln.slice(5).trim();
    }
    if (!dataLine) continue;
    try {
      const parsed = JSON.parse(dataLine);
      const tSinceLast = ((Date.now() - lastEventAt) / 1000).toFixed(1);
      lastEventAt = Date.now();
      if (evt === 'manifest') {
        manifest = parsed.citations ?? parsed;
        console.log(`[manifest] ${manifest.length} citations extracted (+${tSinceLast}s)`);
      } else if (evt === 'verdict') {
        verdicts.push(parsed);
        console.log(
          `[verdict] ${parsed.citation?.slice(0, 50).padEnd(50)} → ${String(parsed.status).padEnd(5)} (${parsed.elapsed_ms ?? '?'}ms, +${tSinceLast}s)`,
        );
      } else if (evt === 'done') {
        done = true;
        console.log(`[done] +${tSinceLast}s`);
      } else if (evt === 'error') {
        console.error(`[error] ${parsed.message ?? parsed.code}`);
        done = true;
      }
    } catch {
      // ignore JSON parse failures
    }
  }
}

const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\nTotal: ${totalSec}s`);

// Map verdicts back to expected outcomes
const results = [];
let passed = 0;
console.log('\n=== Results ===');
for (const test of TEST_CITATIONS) {
  // Match by case-name fragment OR reporter — the extractor sometimes
  // splits citations, and we want to attribute the verdict to the
  // intended test case either way.
  const nameFragment = test.name.split(' v.')[0];
  const verdict =
    verdicts.find((v) =>
      String(v.citation || '').toLowerCase().includes(nameFragment.toLowerCase()),
    ) ??
    verdicts.find((v) =>
      String(v.citation || '').toLowerCase().includes(test.reporter.toLowerCase()),
    );
  const actual = verdict?.status ?? 'no_verdict';
  const pass = test.expected.includes(actual);
  if (pass) passed += 1;
  results.push({
    name: test.name,
    expected: test.expected,
    actual,
    pass,
    reasoning: verdict?.reasoning?.slice(0, 200) ?? null,
    confidence: verdict?.confidence ?? null,
    match_url: verdict?.match_url ?? null,
    elapsed_ms: verdict?.elapsed_ms ?? null,
  });
  console.log(
    `  ${pass ? '✓' : '✗'}  ${test.name.padEnd(36)} expected=${test.expected.join('|').padEnd(15)} got=${String(actual).padEnd(11)} ${verdict?.match_url ?? ''}`,
  );
}

const summary = {
  generated_at: new Date().toISOString(),
  total_seconds: Number(totalSec),
  passed,
  total: TEST_CITATIONS.length,
  parity: `${passed}/${TEST_CITATIONS.length}`,
  results,
};

mkdirSync('reports', { recursive: true });
const outPath = `reports/verify-citations-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\n${passed}/${TEST_CITATIONS.length} PASS`);
console.log(`Report: ${outPath}`);
process.exit(passed === TEST_CITATIONS.length ? 0 : 1);
