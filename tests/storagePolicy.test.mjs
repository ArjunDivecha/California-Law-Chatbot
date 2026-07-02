/**
 * =============================================================================
 * Test: P5 storage policy (where data lives, retention, isolation, fail-closed)
 * Run:  npx tsx tests/storagePolicy.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/storagePolicy.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  selectStore,
  effectiveRetention,
  matterScopedKey,
  getFirmControlledStore,
  setFirmControlledStore,
  isFirmStoreProvisioned,
} from '../api/_lib/compliance/storagePolicy.js';

let pass = 0;
const ok = (n, f) => { f(); pass += 1; console.log(`  ok - ${n}`); };
const NOW = '2026-06-24';

// ── selectStore ──
ok('protected_discovery ⇒ firm_controlled', () => {
  assert.equal(selectStore('protected_discovery', 'protected_discovery', NOW).target, 'firm_controlled');
});
ok('confidential + sensitive_personal_data ⇒ firm_controlled (Upstash forbidden)', () => {
  assert.equal(selectStore('client_confidential', 'sensitive_personal_data', NOW).target, 'firm_controlled');
});
ok('public_research ⇒ cloud_upstash, no tokenization', () => {
  const s = selectStore('public_research', 'public_law', NOW);
  assert.equal(s.target, 'cloud_upstash');
  assert.equal(s.tokenizeBeforeStore, false);
});
ok('confidential non-sensitive ⇒ cloud_upstash BUT tokenizeBeforeStore=true (F3)', () => {
  const s = selectStore('client_confidential', 'client_confidential', NOW);
  assert.equal(s.target, 'cloud_upstash');
  assert.equal(s.tokenizeBeforeStore, true);
});
ok('stale registry ⇒ confidential falls back to firm_controlled (fail closed)', () => {
  const s = selectStore('client_confidential', 'client_confidential', '2027-06-01');
  assert.equal(s.target, 'firm_controlled');
});

// ── retention ──
ok('public 90d, confidential 365d, protected retain', () => {
  assert.equal(effectiveRetention('public_research').days, 90);
  assert.equal(effectiveRetention('client_confidential').days, 365);
  assert.equal(effectiveRetention('protected_discovery').days, null);
});
ok('litigation hold forces retain (days=null) regardless of mode', () => {
  assert.equal(effectiveRetention('public_research', true).days, null);
  assert.equal(effectiveRetention('client_confidential', true).litigationHold, true);
});

// ── isolation ──
ok('matterScopedKey namespaces by matter; empty matterId throws', () => {
  assert.equal(matterScopedKey('m1', 'session:abc'), 'matter:m1:session:abc');
  assert.throws(() => matterScopedKey('', 'x'), /matterId is required/);
});

// ── firm-controlled store fail-closed ──
ok('getFirmControlledStore THROWS when not provisioned (no silent fallback)', () => {
  setFirmControlledStore(null);
  assert.equal(isFirmStoreProvisioned(), false);
  assert.throws(() => getFirmControlledStore(), /not provisioned/);
});
ok('injected firm store is returned + usable', async () => {
  const mem = new Map();
  setFirmControlledStore({
    put: async (m, k, v) => { mem.set(`${m}/${k}`, v); },
    get: async (m, k) => mem.get(`${m}/${k}`) ?? null,
  });
  assert.equal(isFirmStoreProvisioned(), true);
  const s = getFirmControlledStore();
  await s.put('m1', 'k', 'v');
  assert.equal(await s.get('m1', 'k'), 'v');
  setFirmControlledStore(null); // restore
});

console.log(`\nPASS — ${pass} checks passed.`);
