/**
 * =============================================================================
 * Test: P3 tool gating + outbound exfiltration guard
 * Run:  npx tsx tests/toolGating.test.mjs   (from repo root; no API key needed)
 * =============================================================================
 * Exercises buildToolsForPolicy() (api/_lib/tools/index.ts) and guardToolQuery()
 * (api/_lib/compliance/toolQueryGuard.ts) against real PolicyDecisions.
 *
 * INPUT FILES:  ../api/_lib/tools/index.ts, ../api/_lib/compliance/toolQueryGuard.ts,
 *               ../api/_lib/compliance/policyEngine.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { decidePolicy } from '../api/_lib/compliance/policyEngine.js';
import { guardToolQuery, extractQueryString } from '../api/_lib/compliance/toolQueryGuard.js';
import { buildToolsForPolicy, policyIdForTool } from '../api/_lib/tools/index.js';

let pass = 0;
const ok = (n, f) => {
  f();
  pass += 1;
  console.log(`  ok - ${n}`);
};
const names = (tools) => tools.map((t) => t.name).filter(Boolean);

// Verified against the detector (tests/_probe_analyze probe): PII ⇒ privileged,
// public-law ⇒ clean.
const PII_QUERY = 'client John Q. Public SSN 123-45-6789 divorce filing';
const CLEAN_QUERY = 'California Family Code section 1615 revocable living trust requirements';

const tc = (matterMode, extra = {}) =>
  decidePolicy({ matterMode, clientConsent: 'allowed', requestedAction: 'tool_call', ...extra });
const pub = tc('public_research');
const conf = tc('client_confidential');
const prot = tc('protected_discovery', { userRole: 'attorney' });

// ── buildToolsForPolicy ──
// ceb_search was retired 2026-07-03 (CEB ToS prohibits AI/database
// ingestion of their content) — it no longer appears in any tools array.
ok('public: includes web_search + public-law search', () => {
  const n = names(buildToolsForPolicy(pub));
  assert.ok(n.includes('web_search'));
  assert.ok(n.includes('courtlistener_search'));
  assert.ok(!n.includes('ceb_search'), 'ceb_search was retired and must never appear');
});
ok('confidential: web_search DROPPED; verify/ca_code kept', () => {
  const n = names(buildToolsForPolicy(conf));
  assert.ok(!n.includes('web_search'));
  assert.ok(n.includes('courtlistener_search'));
  assert.ok(n.includes('citation_verify'));
  assert.ok(n.includes('statute_verify'));
  assert.ok(n.includes('california_code_lookup'));
  assert.ok(!n.includes('ceb_search'), 'ceb_search was retired and must never appear');
});
ok('protected: web/public-law search all dropped; citation_verify kept', () => {
  const n = names(buildToolsForPolicy(prot));
  for (const t of ['web_search', 'courtlistener_search', 'legiscan_search', 'openstates_search']) {
    assert.ok(!n.includes(t), `${t} should be dropped in protected`);
  }
  assert.ok(n.includes('citation_verify'));
  assert.ok(!n.includes('ceb_search'), 'ceb_search was retired and must never appear');
});
ok('policyIdForTool maps real registered names', () => {
  assert.equal(policyIdForTool('courtlistener_search'), 'courtlistener');
  assert.equal(policyIdForTool('statute_verify'), 'citation_verify');
  assert.equal(policyIdForTool('california_code_lookup'), 'ca_code');
  assert.equal(policyIdForTool('unknown_tool'), undefined);
});

// ── extractQueryString ──
ok('extractQueryString joins string inputs only', () => {
  assert.equal(extractQueryString({ query: 'foo', topK: 5, citation: 'bar' }), 'foo bar');
});

// ── guardToolQuery ──
ok('guard: external disabled ⇒ blocked', () => {
  const blocked = decidePolicy({ matterMode: 'client_confidential', clientConsent: 'prohibited', requestedAction: 'tool_call' });
  const r = guardToolQuery({ toolPolicyId: 'courtlistener', toolName: 'courtlistener_search', query: CLEAN_QUERY, decision: blocked });
  assert.equal(r.allowed, false);
});
ok('guard: tool not permitted in mode ⇒ blocked (web_search in confidential)', () => {
  const r = guardToolQuery({ toolPolicyId: 'web_search', toolName: 'web_search', query: CLEAN_QUERY, decision: conf });
  assert.equal(r.allowed, false);
});
ok('guard: unrecognized tool ⇒ blocked', () => {
  const r = guardToolQuery({ toolPolicyId: undefined, toolName: 'mystery', query: 'x', decision: pub });
  assert.equal(r.allowed, false);
});
ok('guard: confidential + clean public-law query ⇒ allowed', () => {
  const r = guardToolQuery({ toolPolicyId: 'courtlistener', toolName: 'courtlistener_search', query: CLEAN_QUERY, decision: conf });
  assert.equal(r.allowed, true);
});
ok('guard: confidential + query carrying client PII ⇒ BLOCKED (exfiltration)', () => {
  const r = guardToolQuery({ toolPolicyId: 'courtlistener', toolName: 'courtlistener_search', query: PII_QUERY, decision: conf });
  assert.equal(r.allowed, false);
  assert.equal(r.exfiltrationBlock, true);
});
ok('guard: public_research does not content-block (mode already decided clean)', () => {
  const r = guardToolQuery({ toolPolicyId: 'web_search', toolName: 'web_search', query: PII_QUERY, decision: pub });
  assert.equal(r.allowed, true);
});

console.log(`\nPASS — ${pass} checks passed.`);
