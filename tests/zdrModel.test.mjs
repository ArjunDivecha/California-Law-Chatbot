/**
 * =============================================================================
 * Test: ZDR model allowlist + fail-closed guard
 * Run:  npx tsx tests/zdrModel.test.mjs   (from repo root; no API key needed)
 * =============================================================================
 * Verifies api/_lib/zdrModels.ts: ZDR-eligible models pass, non-ZDR "Covered
 * Models" (claude-fable-5 / claude-mythos-5) and unknown models fail closed.
 *
 * INPUT FILES:  ../api/_lib/zdrModels.ts (module under test)
 * OUTPUT FILES: none (prints results to stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  assertZdrEligibleModel,
  isZdrEligibleModel,
  ZDR_ELIGIBLE_MODELS,
  NON_ZDR_COVERED_MODELS,
} from '../api/_lib/zdrModels.js';

let pass = 0;
function ok(name, fn) {
  fn();
  pass += 1;
  console.log(`  ok - ${name}`);
}

// ZDR-eligible models the agent loop actually uses must pass.
ok('opus-4-8 (primary default) is ZDR-eligible', () =>
  assert.equal(isZdrEligibleModel('claude-opus-4-8'), true));
ok('sonnet-4-6 (quick + verifier) is ZDR-eligible', () =>
  assert.equal(isZdrEligibleModel('claude-sonnet-4-6'), true));
ok('haiku-4-5 dated alias is ZDR-eligible', () =>
  assert.equal(isZdrEligibleModel('claude-haiku-4-5-20251001'), true));
ok('assert does NOT throw for opus-4-8', () =>
  assert.doesNotThrow(() => assertZdrEligibleModel('claude-opus-4-8')));
ok('assert does NOT throw for sonnet-4-6', () =>
  assert.doesNotThrow(() => assertZdrEligibleModel('claude-sonnet-4-6')));

// Non-ZDR Covered Models must fail closed.
ok('fable-5 is rejected (non-ZDR Covered Model)', () =>
  assert.throws(() => assertZdrEligibleModel('claude-fable-5'), /non-ZDR/i));
ok('mythos-5 is rejected (non-ZDR Covered Model)', () =>
  assert.throws(() => assertZdrEligibleModel('claude-mythos-5'), /non-ZDR/i));

// Anything unknown fails closed too.
ok('unknown model is rejected (fail-closed)', () =>
  assert.throws(() => assertZdrEligibleModel('gpt-4o'), /refusing/i));

// Set membership sanity.
ok('fable-5 not in eligible set; is in covered set', () => {
  assert.equal(ZDR_ELIGIBLE_MODELS.has('claude-fable-5'), false);
  assert.equal(NON_ZDR_COVERED_MODELS.has('claude-fable-5'), true);
});

console.log(`\nPASS — ${pass} checks passed.`);
