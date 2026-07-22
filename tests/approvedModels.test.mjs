/**
 * =============================================================================
 * Test: family-scoped model approval + fail-closed guard
 * Run:  npx tsx tests/approvedModels.test.mjs   (from repo root; no API key)
 * =============================================================================
 * Verifies api/_lib/approvedModels.ts after the 2026-07-22 change from per-ID
 * pinning to FAMILY-level approval (Arjun's directive: automatic latest-model
 * adoption via modelResolver.ts). Approved families pass — including future
 * ids in those families — while preview/mythos surfaces, other vendors, and
 * malformed ids fail closed.
 *
 * INPUT FILES:  ../api/_lib/approvedModels.ts (module under test)
 * OUTPUT FILES: none (prints results to stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  assertApprovedModel,
  isApprovedModel,
} from '../api/_lib/approvedModels.js';

let pass = 0;
function ok(name, fn) {
  fn();
  pass += 1;
  console.log(`  ok - ${name}`);
}

// Models the agent loop actually uses must pass.
ok('fable-5 (primary default) is approved', () =>
  assert.equal(isApprovedModel('claude-fable-5'), true));
ok('opus-4-8 (fallback) is approved', () =>
  assert.equal(isApprovedModel('claude-opus-4-8'), true));
ok('sonnet-4-6 (known-good fast tier) is approved', () =>
  assert.equal(isApprovedModel('claude-sonnet-4-6'), true));
ok('sonnet-5 (current fast tier) is approved', () =>
  assert.equal(isApprovedModel('claude-sonnet-5'), true));
ok('haiku-4-5 dated alias is approved', () =>
  assert.equal(isApprovedModel('claude-haiku-4-5-20251001'), true));
ok('future family members are approved (auto-adoption)', () => {
  assert.equal(isApprovedModel('claude-fable-6'), true);
  assert.equal(isApprovedModel('claude-opus-5-0'), true);
});
ok('assert does NOT throw for fable-5', () =>
  assert.doesNotThrow(() => assertApprovedModel('claude-fable-5')));
ok('assert does NOT throw for opus-4-8', () =>
  assert.doesNotThrow(() => assertApprovedModel('claude-opus-4-8')));

// Outside the approved families — or blocked surfaces — fails closed.
ok('mythos-5 is rejected (blocked surface)', () =>
  assert.throws(() => assertApprovedModel('claude-mythos-5'), /refusing/i));
ok('preview surfaces are rejected', () =>
  assert.throws(() => assertApprovedModel('claude-sonnet-6-preview'), /refusing/i));
ok('other vendors are rejected (fail-closed)', () =>
  assert.throws(() => assertApprovedModel('gpt-4o'), /refusing/i));
ok('empty model id is rejected (fail-closed)', () =>
  assert.throws(() => assertApprovedModel(''), /refusing/i));
ok('bare family prefix without version is rejected', () =>
  assert.throws(() => assertApprovedModel('claude-opus-'), /refusing/i));

console.log(`\nPASS — ${pass} checks passed.`);
