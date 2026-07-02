/**
 * Phase B verification probes.
 *
 *   B.1: verify-stream rejects raw PII with 503
 *   B.2: server error path produces scrubbed messages, not raw
 *   B.3: assertNoRawPii() throws WireGuardError on raw PII
 *
 * The probes don't require browser / OPF daemon — they test the
 * server-side gates and the wire-guard helper directly.
 */

import { spawnSync } from 'node:child_process';

const PHASES = [];
function check(name, condition, detail = '') {
  PHASES.push({ name, pass: !!condition, detail });
  console.log(`  ${condition ? '✓' : '✗'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ============================================================
// B.1: verify-stream rejects raw PII with 503
// ============================================================
console.log('\n=== B.1 verify-stream raw-PII rejection ===');
const raw = 'Marvin v. Marvin (1976) 18 Cal.3d 660. SSN 123-45-6789, contact: client@example.com.';
const resp = await fetch('http://localhost:3000/api/agent/verify-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: raw }),
});
const body = await resp.text();
check(
  'returns 503 for raw PII',
  resp.status === 503,
  `actual status=${resp.status}`,
);
let parsed = null;
try { parsed = JSON.parse(body); } catch {}
check(
  'response body has error code sanitizer_unavailable',
  parsed?.error === 'sanitizer_unavailable',
  `error=${parsed?.error}`,
);
check(
  'rejection message names a category (defense-in-depth audit trail)',
  /ssn|email/i.test(parsed?.message ?? ''),
  `message=${(parsed?.message ?? '').slice(0, 80)}`,
);

// ============================================================
// B.1: tokenized input passes (sanity)
// ============================================================
console.log('\n=== B.1 verify-stream tokenized input passes ===');
const tokenized = 'Marvin v. Marvin (1976) 18 Cal.3d 660. Plaintiff CLIENT_001 raised concerns.';
const resp2 = await fetch('http://localhost:3000/api/agent/verify-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: tokenized }),
});
check(
  'returns 200 for tokenized input',
  resp2.status === 200,
  `actual status=${resp2.status}`,
);
// Consume the SSE stream just enough to confirm headers + manifest
const reader = resp2.body.getReader();
const dec = new TextDecoder();
let buf = '';
let sawManifest = false;
for (let i = 0; i < 30; i += 1) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  if (buf.includes('manifest')) { sawManifest = true; break; }
}
reader.cancel();
check('SSE manifest event surfaced for tokenized input', sawManifest);

// ============================================================
// B.2: server error scrubbing — assertion via direct scrubMessage
// ============================================================
console.log('\n=== B.2 scrubMessage strips raw PII ===');
// Run a tiny node-side check via spawnSync (using tsx since scrubError is .ts)
const result = spawnSync(
  'npx',
  [
    'tsx', '-e',
    `import { scrubMessage } from './api/_lib/scrubError.ts';
    const tests = [
      'Failed to send msg to client@example.com',
      'Phone (415) 555-1234 not reachable',
      'SSN 123-45-6789 mismatch',
      'No PII here at all',
    ];
    for (const t of tests) {
      console.log(JSON.stringify({ input: t, output: scrubMessage(t) }));
    }`,
  ],
  { encoding: 'utf-8' },
);
console.log(result.stdout);
const scrubLines = result.stdout
  .split('\n')
  .filter((l) => l.startsWith('{'))
  .map((l) => JSON.parse(l));
const emailScrubbed = scrubLines[0]?.output.includes('[redacted:email]');
const phoneScrubbed = scrubLines[1]?.output.includes('[redacted:phone]');
const ssnScrubbed = scrubLines[2]?.output.includes('[redacted:ssn]');
const cleanPassthrough = scrubLines[3]?.output === scrubLines[3]?.input;
check('email is scrubbed', emailScrubbed, scrubLines[0]?.output);
check('phone is scrubbed', phoneScrubbed, scrubLines[1]?.output);
check('SSN is scrubbed', ssnScrubbed, scrubLines[2]?.output);
check('clean text passes through unchanged', cleanPassthrough);

// ============================================================
// B.3: wireGuard catches raw PII
// ============================================================
console.log('\n=== B.3 assertNoRawPii throws on raw PII ===');
const wgTest = spawnSync(
  'npx',
  [
    'tsx', '-e',
    `import { assertNoRawPii, WireGuardError } from './services/sanitization/wireGuard.ts';
    const cases = [
      { body: { user_text: 'tokenized: CLIENT_001 is doing fine' }, expect: 'pass' },
      { body: { user_text: 'SSN 123-45-6789 here' }, expect: 'throw' },
      { body: { user_text: 'email me at me@example.com' }, expect: 'throw' },
      { body: { instructions: 'no PII here' }, expect: 'pass' },
    ];
    const out = [];
    for (const c of cases) {
      try {
        assertNoRawPii(c.body);
        out.push({ expect: c.expect, actual: 'pass', err: null });
      } catch (e) {
        out.push({ expect: c.expect, actual: 'throw', err: (e as Error).name });
      }
    }
    console.log(JSON.stringify(out));`,
  ],
  { encoding: 'utf-8' },
);
const wgResults = JSON.parse(wgTest.stdout.trim() || '[]');
for (const r of wgResults) {
  check(`case (expect=${r.expect}) → actual=${r.actual}`, r.expect === r.actual);
}

// ============================================================
// Summary
// ============================================================
const passed = PHASES.filter((p) => p.pass).length;
const total = PHASES.length;
console.log(`\nSummary: ${passed}/${total} checks pass`);
process.exit(passed === total ? 0 : 1);
