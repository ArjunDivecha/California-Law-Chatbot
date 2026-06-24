/**
 * =============================================================================
 * Test: compliance policy engine (server-authoritative decisions)
 * Run:  npx tsx tests/policyEngine.test.mjs   (from repo root; no API key needed)
 * =============================================================================
 * Exercises api/_lib/compliance/policyEngine.ts: mode escalation (never
 * downgrade), per-mode tool gating, consent/role hard-blocks, tokenization
 * levels, review gates, and evidence sinks.
 *
 * INPUT FILES:  ../api/_lib/compliance/policyEngine.ts (module under test)
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  decidePolicy,
  escalateMode,
  detectionFloor,
} from '../api/_lib/compliance/policyEngine.js';

let pass = 0;
function ok(name, fn) {
  fn();
  pass += 1;
  console.log(`  ok - ${name}`);
}
const base = { matterMode: 'public_research', clientConsent: 'allowed', requestedAction: 'answer' };

// ── Mode escalation (matter binding is the floor; detection only raises) ──
ok('detectionFloor: public_law only ⇒ public_research', () =>
  assert.equal(detectionFloor(['public_law']), 'public_research'));
ok('detectionFloor: client_confidential ⇒ client_confidential', () =>
  assert.equal(detectionFloor(['public_law', 'client_confidential']), 'client_confidential'));
ok('detectionFloor: protected_discovery ⇒ protected_discovery', () =>
  assert.equal(detectionFloor(['protected_discovery']), 'protected_discovery'));
ok('escalate: public bound + privileged detected ⇒ client_confidential', () =>
  assert.equal(escalateMode('public_research', ['attorney_client_privileged']), 'client_confidential'));
ok('NEVER downgrade: protected bound + only public_law detected ⇒ protected_discovery', () =>
  assert.equal(escalateMode('protected_discovery', ['public_law']), 'protected_discovery'));

// ── public_research: permissive ──
ok('public_research: all tools allowed, tokenization off, external allowed', () => {
  const d = decidePolicy({ ...base, requestedAction: 'tool_call', requestedTool: 'web_search' });
  assert.equal(d.effectiveMode, 'public_research');
  assert.equal(d.tokenization, 'off');
  assert.equal(d.externalCallsAllowed, true);
  assert.ok(d.allowedTools.includes('web_search'));
  assert.ok(d.allowedTools.includes('ceb_search'));
  assert.equal(d.requiredEvidenceSinks.length, 0);
  assert.equal(d.block, undefined);
});

// ── client_confidential: web_search + mcp blocked; ceb gated; light tokenization ──
ok('client_confidential: web_search + mcp + ceb_search blocked (ceb unapproved)', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential' });
  assert.equal(d.tokenization, 'light');
  assert.ok(!d.allowedTools.includes('web_search'));
  assert.ok(!d.allowedTools.includes('mcp'));
  assert.ok(!d.allowedTools.includes('ceb_search'));
  assert.ok(d.allowedTools.includes('courtlistener'));
  assert.deepEqual(d.requiredEvidenceSinks, ['audit']);
  assert.ok(d.requiredDisclosures.includes('ai_use_disclosure'));
});
ok('client_confidential: ceb_search allowed when OpenAI embeddings approved', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential', openAiEmbeddingsApproved: true });
  assert.ok(d.allowedTools.includes('ceb_search'));
});
ok('client_confidential export ⇒ lawyer_review gate', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential', requestedAction: 'export' });
  assert.ok(d.requiredReviewGates.includes('lawyer_review'));
});

// ── protected_discovery: most restrictive ──
ok('protected_discovery: web/mcp/public-law/ceb all blocked; strict; worm', () => {
  const d = decidePolicy({ ...base, matterMode: 'protected_discovery' });
  assert.equal(d.tokenization, 'strict');
  for (const t of ['web_search', 'mcp', 'courtlistener', 'legiscan', 'openstates', 'ceb_search']) {
    assert.ok(!d.allowedTools.includes(t), `${t} should be blocked`);
  }
  assert.ok(d.allowedTools.includes('citation_verify'));
  assert.deepEqual(d.requiredEvidenceSinks, ['audit', 'worm']);
});
ok('protected_discovery file ⇒ citation + court-disclosure gates', () => {
  const d = decidePolicy({ ...base, matterMode: 'protected_discovery', requestedAction: 'file' });
  assert.ok(d.requiredReviewGates.includes('citation_verification'));
  assert.ok(d.requiredReviewGates.includes('court_ai_disclosure_check'));
});

// ── consent + role hard-blocks ──
ok('consent prohibited ⇒ hard block, no tools', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential', clientConsent: 'prohibited', requestedAction: 'tool_call' });
  assert.equal(d.externalCallsAllowed, false);
  assert.ok(d.block);
  assert.equal(d.allowedTools.length, 0);
});
ok('consent revoked ⇒ hard block', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential', clientConsent: 'revoked' });
  assert.equal(d.externalCallsAllowed, false);
});
ok('consent not_obtained: blocked in confidential, allowed in public', () => {
  const conf = decidePolicy({ ...base, matterMode: 'client_confidential', clientConsent: 'not_obtained' });
  assert.equal(conf.externalCallsAllowed, false);
  const pub = decidePolicy({ ...base, clientConsent: 'not_obtained' });
  assert.equal(pub.externalCallsAllowed, true);
});
ok('consent restricted ⇒ adds lawyer_review', () => {
  const d = decidePolicy({ ...base, matterMode: 'client_confidential', clientConsent: 'restricted' });
  assert.ok(d.requiredReviewGates.includes('lawyer_review'));
  assert.equal(d.externalCallsAllowed, true);
});
ok('staff cannot use protected_discovery ⇒ hard block', () => {
  const d = decidePolicy({ ...base, matterMode: 'protected_discovery', userRole: 'staff' });
  assert.equal(d.externalCallsAllowed, false);
  assert.ok(d.block);
});
ok('attorney CAN use protected_discovery (consent allowed)', () => {
  const d = decidePolicy({ ...base, matterMode: 'protected_discovery', userRole: 'attorney' });
  assert.equal(d.externalCallsAllowed, true);
});

// ── escalation flows end-to-end ──
ok('public bound but privileged detected ⇒ effective confidential + tokenization light', () => {
  const d = decidePolicy({ ...base, detectedDataClasses: ['attorney_client_privileged'] });
  assert.equal(d.effectiveMode, 'client_confidential');
  assert.equal(d.escalated, true);
  assert.equal(d.tokenization, 'light');
  assert.ok(!d.allowedTools.includes('web_search'));
});

console.log(`\nPASS — ${pass} checks passed.`);
