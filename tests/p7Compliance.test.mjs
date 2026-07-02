/**
 * =============================================================================
 * Test: P7 billing + bias controls + governance
 * Run:  npx tsx tests/p7Compliance.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/{billing,biasReview,governance}.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { classifyAiSubscription, validateBillingEntry, buildBillingLedger } from '../api/_lib/compliance/billing.js';
import { requiresBiasReview, isAutonomousDecisionBlocked, evaluateBiasControls } from '../api/_lib/compliance/biasReview.js';
import { needsRecertification, governanceStatus } from '../api/_lib/compliance/governance.js';

let pass = 0;
const ok = (n, f) => { f(); pass += 1; console.log(`  ok - ${n}`); };
const NOW = '2026-06-24';

// ── billing ──
ok('AI subscription classified as non-billable overhead', () => {
  const c = classifyAiSubscription();
  assert.equal(c.kind, 'overhead');
  assert.equal(c.billable, false);
});
ok('billing rules: overhead/ai_runtime not billable; markup needs disclosure+consent', () => {
  assert.equal(validateBillingEntry({ matterId: 'm', kind: 'overhead', amount: 10, billable: true }).valid, false);
  assert.equal(validateBillingEntry({ matterId: 'm', kind: 'ai_runtime', amount: 5, billable: true }).valid, false);
  assert.equal(validateBillingEntry({ matterId: 'm', kind: 'provider_passthrough', amount: 5, billable: true, markup: 2 }).valid, false);
  assert.equal(validateBillingEntry({ matterId: 'm', kind: 'provider_passthrough', amount: 5, billable: true, markup: 2, disclosed: true, consentForMarkup: true }).valid, true);
  assert.equal(validateBillingEntry({ matterId: 'm', kind: 'attorney_time', amount: 100, billable: true }).valid, true);
});
ok('ledger separates billable/non-billable + collects invalid entries', () => {
  const l = buildBillingLedger([
    { matterId: 'm', kind: 'attorney_time', amount: 100, billable: true },
    { matterId: 'm', kind: 'overhead', amount: 20, billable: false },
    { matterId: 'm', kind: 'overhead', amount: 9, billable: true }, // invalid
    { matterId: 'm', kind: 'provider_passthrough', amount: 5, billable: true },
  ]);
  assert.equal(l.billableTotal, 105);
  assert.equal(l.nonBillableTotal, 20);
  assert.equal(l.invalid.length, 1);
});

// ── bias controls ──
ok('requiresBiasReview: sensitive workflows yes, generic no', () => {
  assert.equal(requiresBiasReview('employment'), true);
  assert.equal(requiresBiasReview('intake_prioritization'), true);
  assert.equal(requiresBiasReview('contract_research'), false);
});
ok('isAutonomousDecisionBlocked: protected-class-sensitive decisions blocked', () => {
  assert.equal(isAutonomousDecisionBlocked('credibility_scoring'), true);
  assert.equal(isAutonomousDecisionBlocked('client_selection'), true);
  assert.equal(isAutonomousDecisionBlocked('summarize_case'), false);
});
ok('evaluateBiasControls: autonomous blocked decision NOT permitted; sensitive workflow needs review', () => {
  assert.equal(evaluateBiasControls({ workflow: 'employment', decisionType: 'credibility_scoring', humanReviewed: false }).permitted, false);
  assert.equal(evaluateBiasControls({ workflow: 'employment', humanReviewed: false }).permitted, false);
  assert.equal(evaluateBiasControls({ workflow: 'employment', humanReviewed: true }).permitted, true);
  assert.equal(evaluateBiasControls({ workflow: 'contract_research', humanReviewed: false }).permitted, true);
});

// ── governance ──
ok('needsRecertification: overdue/garbage true, recent false', () => {
  assert.equal(needsRecertification('2026-01-01', NOW, 90), true);
  assert.equal(needsRecertification('2026-06-01', NOW, 90), false);
  assert.equal(needsRecertification('bad-date', NOW, 90), true);
});
ok('governanceStatus: healthy when current + nothing stale; unhealthy when stale', () => {
  const good = governanceStatus(NOW, '2026-06-01');
  assert.equal(good.staleProviders.length, 0);
  assert.equal(good.recertNeeded, false);
  assert.equal(good.healthy, true);
  const bad = governanceStatus('2027-06-01', '2027-05-15'); // past every provider reviewExpiry
  assert.ok(bad.staleProviders.length > 0);
  assert.equal(bad.healthy, false);
});

console.log(`\nPASS — ${pass} checks passed.`);
