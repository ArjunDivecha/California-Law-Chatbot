/**
 * =============================================================================
 * Test: counsel-approved model allowlist + fail-closed guard
 * Run:  npx tsx tests/approvedModels.test.mjs   (from repo root; no API key)
 * =============================================================================
 * Verifies api/_lib/approvedModels.ts: approved models pass, unapproved and
 * unknown models fail closed. Replaces the retired ZDR-based gate
 * (zdrModels.ts) — ZDR was declined 2026-07-01; the allowlist is now a
 * counsel/change-control gate under standard commercial terms + DPA.
 *
 * INPUT FILES:  ../api/_lib/approvedModels.ts (module under test)
 * OUTPUT FILES: none (prints results to stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  assertApprovedModel,
  isApprovedModel,
  APPROVED_MODELS,
} from '../api/_lib/approvedModels.js';

let pass = 0;
function ok(name, fn) {
  fn();
  pass += 1;
  console.log(`  ok - ${name}`);
}

// Models the agent loop actually uses must pass.
ok('fable-5 (primary default, restored 2026-07) is approved', () =>
  assert.equal(isApprovedModel('claude-fable-5'), true));
ok('opus-4-8 (fallback) is approved', () =>
  assert.equal(isApprovedModel('claude-opus-4-8'), true));
ok('sonnet-4-6 (quick + verifier) is approved', () =>
  assert.equal(isApprovedModel('claude-sonnet-4-6'), true));
ok('haiku-4-5 dated alias is approved', () =>
  assert.equal(isApprovedModel('claude-haiku-4-5-20251001'), true));
ok('assert does NOT throw for fable-5', () =>
  assert.doesNotThrow(() => assertApprovedModel('claude-fable-5')));
ok('assert does NOT throw for opus-4-8', () =>
  assert.doesNotThrow(() => assertApprovedModel('claude-opus-4-8')));

// Anything not on the allowlist fails closed — including other vendors'
// models and Anthropic models that were never counsel-reviewed.
ok('mythos-5 is rejected (not counsel-approved)', () =>
  assert.throws(() => assertApprovedModel('claude-mythos-5'), /refusing/i));
ok('unknown model is rejected (fail-closed)', () =>
  assert.throws(() => assertApprovedModel('gpt-4o'), /refusing/i));
ok('empty model id is rejected (fail-closed)', () =>
  assert.throws(() => assertApprovedModel(''), /refusing/i));

// Set membership sanity.
ok('allowlist contains fable-5 and opus-4-8; not mythos-5', () => {
  assert.equal(APPROVED_MODELS.has('claude-fable-5'), true);
  assert.equal(APPROVED_MODELS.has('claude-opus-4-8'), true);
  assert.equal(APPROVED_MODELS.has('claude-mythos-5'), false);
});

console.log(`\nPASS — ${pass} checks passed.`);
