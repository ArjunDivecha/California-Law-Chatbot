/**
 * =============================================================================
 * Test: matter-mode transitions (locked protected flag)
 * Run:  npx tsx tests/matterContext.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/matterContext.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { validateMatterTransition, parseMatterMode } from '../api/_lib/compliance/matterContext.js';

let pass = 0;
const ok = (n, f) => { f(); pass += 1; console.log(`  ok - ${n}`); };
const S = (mode, locked = false) => ({ matterMode: mode, protectedLocked: locked });

ok('entering protected_discovery LOCKS it on', () => {
  const r = validateMatterTransition(S('public_research'), 'protected_discovery');
  assert.equal(r.allowed, true);
  assert.equal(r.next.protectedLocked, true);
});
ok('downgrade from locked protected WITHOUT override ⇒ blocked', () => {
  const r = validateMatterTransition(S('protected_discovery', true), 'public_research');
  assert.equal(r.allowed, false);
  assert.match(r.reason, /locked/);
});
ok('downgrade from locked protected WITH attorney override ⇒ allowed + unlocks', () => {
  const r = validateMatterTransition(S('protected_discovery', true), 'client_confidential', { attorneyOverride: true });
  assert.equal(r.allowed, true);
  assert.equal(r.next.matterMode, 'client_confidential');
  assert.equal(r.next.protectedLocked, false);
});
ok('escalation public → confidential allowed', () => {
  const r = validateMatterTransition(S('public_research'), 'client_confidential');
  assert.equal(r.allowed, true);
  assert.equal(r.next.protectedLocked, false);
});
ok('confidential → public allowed when not locked', () => {
  const r = validateMatterTransition(S('client_confidential', false), 'public_research');
  assert.equal(r.allowed, true);
});
ok('re-entering protected from protected stays locked', () => {
  const r = validateMatterTransition(S('protected_discovery', true), 'protected_discovery');
  assert.equal(r.allowed, true);
  assert.equal(r.next.protectedLocked, true);
});
ok('parseMatterMode validates input', () => {
  assert.equal(parseMatterMode('protected_discovery'), 'protected_discovery');
  assert.equal(parseMatterMode('nonsense'), null);
  assert.equal(parseMatterMode(undefined), null);
});

console.log(`\nPASS — ${pass} checks passed.`);
