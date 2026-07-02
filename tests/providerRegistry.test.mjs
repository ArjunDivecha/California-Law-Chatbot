/**
 * =============================================================================
 * Test: P4 provider registry + per-turn manifest
 * Run:  npx tsx tests/providerRegistry.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/providerRegistry.ts,
 *               ../api/_lib/compliance/turnManifest.ts,
 *               ../api/_lib/compliance/policyEngine.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  isProviderApprovedFor,
  staleProviders,
  getProvider,
  providerSnapshot,
} from '../api/_lib/compliance/providerRegistry.js';
import { buildTurnManifest, findRawTextLeak } from '../api/_lib/compliance/turnManifest.js';
import { decidePolicy } from '../api/_lib/compliance/policyEngine.js';

let pass = 0;
const ok = (n, f) => { f(); pass += 1; console.log(`  ok - ${n}`); };
const NOW = '2026-06-24';

// ── provider registry ──
ok('Upstash Vector REJECTS sensitive_personal_data (DPA §12.4 ceiling)', () => {
  const r = isProviderApprovedFor('upstash_vector', 'client_confidential', 'sensitive_personal_data', NOW);
  assert.equal(r.approved, false);
  assert.match(r.reason, /Restricted Data/);
});
ok('Upstash Vector approved for public_law (CEB public corpus)', () => {
  assert.equal(isProviderApprovedFor('upstash_vector', 'public_research', 'public_law', NOW).approved, true);
});
ok('OpenAI embeddings approved for client_confidential, NOT protected, NOT sensitive', () => {
  assert.equal(isProviderApprovedFor('openai_embeddings', 'client_confidential', 'client_confidential', NOW).approved, true);
  assert.equal(isProviderApprovedFor('openai_embeddings', 'protected_discovery', 'client_confidential', NOW).approved, false);
  assert.equal(isProviderApprovedFor('openai_embeddings', 'client_confidential', 'sensitive_personal_data', NOW).approved, false);
});
ok('Anthropic direct approved for protected_discovery + sensitive data', () => {
  assert.equal(isProviderApprovedFor('anthropic_messages_zdr', 'protected_discovery', 'sensitive_personal_data', NOW).approved, true);
});
ok('unknown provider ⇒ not approved (fail closed)', () => {
  assert.equal(isProviderApprovedFor('mystery_db', 'public_research', 'public_law', NOW).approved, false);
});
ok('stale registry entry ⇒ not approved + flagged by staleProviders', () => {
  const future = '2027-06-01'; // past every reviewExpiry (2026-12-31)
  assert.equal(isProviderApprovedFor('anthropic_messages_zdr', 'public_research', 'public_law', future).approved, false);
  assert.ok(staleProviders(future).includes('anthropic_messages_zdr'));
  assert.equal(staleProviders(NOW).length, 0);
});
ok('Anthropic entry carries DPA evidence + vendor_no_waiver privilege class', () => {
  const p = getProvider('anthropic_messages_zdr');
  assert.equal(p.privilegeClass, 'vendor_no_waiver');
  assert.ok(p.evidence.length >= 1);
});

// ── turn manifest ──
const decision = decidePolicy({ matterMode: 'client_confidential', clientConsent: 'allowed', requestedAction: 'tool_call' });
ok('manifest: built from decision, records tools_called + provider snapshot', () => {
  const m = buildTurnManifest({
    turnId: 't1', sessionId: 's1', model: 'claude-opus-4-8', decision,
    toolsCalled: ['courtlistener_search'], sanitizedPromptHmac: 'abc123', timestamp: NOW,
  });
  assert.equal(m.matter_mode, 'client_confidential');
  assert.equal(m.model, 'claude-opus-4-8');
  assert.deepEqual(m.tools_called, ['courtlistener_search']);
  assert.equal(m.sanitized_prompt_hmac, 'abc123');
  assert.ok(m.provider_snapshot.length === providerSnapshot().length);
  assert.ok(m.blocked_tools.some((b) => b.tool === 'web_search'));
});
ok('manifest: NO raw client text (invariant)', () => {
  const m = buildTurnManifest({ turnId: 't', sessionId: 's', model: 'claude-opus-4-8', decision, toolsCalled: [], timestamp: NOW });
  assert.equal(findRawTextLeak(m), null);
});
ok('manifest: a planted long string IS caught by findRawTextLeak', () => {
  const m = buildTurnManifest({ turnId: 't', sessionId: 's', model: 'claude-opus-4-8', decision, toolsCalled: [], timestamp: NOW });
  m.reason_codes = []; // keep arrays
  m.session_id = 'x'.repeat(300); // simulate a leak
  assert.equal(findRawTextLeak(m), 'session_id');
});
ok('manifest: hard-blocked decision records blocked_reason', () => {
  const blocked = decidePolicy({ matterMode: 'client_confidential', clientConsent: 'prohibited', requestedAction: 'tool_call' });
  const m = buildTurnManifest({ turnId: 't', sessionId: 's', model: 'claude-opus-4-8', decision: blocked, toolsCalled: [], timestamp: NOW });
  assert.ok(m.blocked_reason);
  assert.equal(m.external_calls_allowed, false);
});

console.log(`\nPASS — ${pass} checks passed.`);
