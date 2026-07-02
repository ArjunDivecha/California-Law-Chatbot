/**
 * =============================================================================
 * Test: route security (CORS allowlist + hardening headers) — F8/§8
 * Run:  npx tsx tests/routeSecurity.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_shared/routeSecurity.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  resolveCorsOrigin,
  defaultAllowedOrigins,
  applyResponseSecurity,
  headerString,
} from '../api/_shared/routeSecurity.js';

let pass = 0;
const ok = (n, f) => { f(); pass += 1; console.log(`  ok - ${n}`); };
const mockRes = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; } });

ok('resolveCorsOrigin: missing origin ⇒ null (same-origin)', () => {
  assert.equal(resolveCorsOrigin(undefined), null);
});
ok('resolveCorsOrigin: allowlisted origin ⇒ echoed', () => {
  assert.equal(resolveCorsOrigin('http://localhost:5173'), 'http://localhost:5173');
});
ok('resolveCorsOrigin: non-allowlisted ⇒ null (NEVER *)', () => {
  assert.equal(resolveCorsOrigin('http://evil.example'), null);
});
ok('custom allowlist honored', () => {
  assert.equal(resolveCorsOrigin('https://app.ff.law', ['https://app.ff.law']), 'https://app.ff.law');
});
ok('defaultAllowedOrigins includes localhost dev', () => {
  assert.ok(defaultAllowedOrigins().includes('http://localhost:5173'));
});
ok('headerString normalizes array headers', () => {
  assert.equal(headerString(['a', 'b']), 'a');
  assert.equal(headerString('x'), 'x');
  assert.equal(headerString(undefined), undefined);
});

ok('applyResponseSecurity: allowlisted origin ⇒ ACAO echoed + CSP set, no wildcard', () => {
  const res = mockRes();
  applyResponseSecurity(res, 'http://localhost:5173');
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.notEqual(res.headers['Access-Control-Allow-Origin'], '*');
  assert.ok(res.headers['Content-Security-Policy']);
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Vary'], 'Origin');
});
ok('applyResponseSecurity: disallowed origin ⇒ NO ACAO, but hardening headers still set', () => {
  const res = mockRes();
  applyResponseSecurity(res, 'http://evil.example');
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  assert.ok(res.headers['Content-Security-Policy']);
  assert.ok(res.headers['Strict-Transport-Security']);
});

console.log(`\nPASS — ${pass} checks passed.`);
