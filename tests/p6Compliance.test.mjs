/**
 * =============================================================================
 * Test: P6 consent/attestations + review gates + conflicts + device + wiring
 * Run:  npx tsx tests/p6Compliance.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/{attestations,reviewGate,conflicts,
 *               securityHeaders}.ts, ../api/_lib/agentLoop.ts, ../api/_lib/sessionStore.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { setSessionRedis } from '../api/_lib/sessionStore.js';
import {
  consentSatisfiedFor,
  recordClientConsent,
  getAttestations,
} from '../api/_lib/compliance/attestations.js';
import { evaluateReviewGates, validateReviewAttestation } from '../api/_lib/compliance/reviewGate.js';
import { hasConflict, crossMatterRetrievalAllowed } from '../api/_lib/compliance/conflicts.js';
import { buildCspHeader, securityHeaders, isSessionExpired } from '../api/_lib/compliance/securityHeaders.js';
import { computeTurnPolicy } from '../api/_lib/agentLoop.js';

let pass = 0;
const ok = (n, f) => { const r = f(); if (r && r.then) return r.then(() => { pass += 1; console.log(`  ok - ${n}`); }); pass += 1; console.log(`  ok - ${n}`); };

function statefulRedis(initial = {}) {
  const meta = { ...initial };
  const noop = async () => 0;
  return {
    hgetall: async () => (Object.keys(meta).length ? { ...meta } : null),
    hset: async (_k, fields) => { Object.assign(meta, fields); return 1; },
    rpush: noop, lrange: async () => [], set: async () => null, get: async () => null,
    incr: noop, del: noop, expire: async () => null, zadd: async () => 0,
    zrange: async () => [], zrem: noop, zcard: noop,
  };
}

// ── consent predicate ──
ok('consentSatisfiedFor: public always true; confidential needs allowed/restricted', () => {
  assert.equal(consentSatisfiedFor('public_research', 'not_obtained'), true);
  assert.equal(consentSatisfiedFor('client_confidential', 'allowed'), true);
  assert.equal(consentSatisfiedFor('client_confidential', 'restricted'), true);
  assert.equal(consentSatisfiedFor('client_confidential', 'not_obtained'), false);
  assert.equal(consentSatisfiedFor('protected_discovery', 'prohibited'), false);
});

// ── record + read consent (server-side, via mock store) ──
await ok('recordClientConsent persists; getAttestations reads it back', async () => {
  setSessionRedis(statefulRedis({ user_id: 'u', matter_mode: 'client_confidential' }));
  let a = await getAttestations('s1');
  assert.equal(a.consent, 'not_obtained');
  await recordClientConsent('s1', 'allowed', 'attorney:jane', 'v1', '2026-06-24T00:00:00Z');
  a = await getAttestations('s1');
  assert.equal(a.consent, 'allowed');
  assert.equal(a.consentSigner, 'attorney:jane');
  assert.equal(a.consentVersion, 'v1');
});

// ── review gates ──
ok('evaluateReviewGates: missing reported; permitted only when all satisfied', () => {
  assert.deepEqual(evaluateReviewGates(['lawyer_review', 'citation_verification'], ['lawyer_review']), { permitted: false, missing: ['citation_verification'] });
  assert.deepEqual(evaluateReviewGates(['lawyer_review'], ['lawyer_review', 'extra']), { permitted: true, missing: [] });
});
ok('validateReviewAttestation: unresolved issues block even if gates met', () => {
  const r = validateReviewAttestation(['lawyer_review'], {
    action: 'file', reviewer: 'jane', role: 'attorney', gatesSatisfied: ['lawyer_review'],
    checklistVersion: 'v1', unresolvedIssues: ['fake citation?'], at: '2026-06-24',
  });
  assert.equal(r.permitted, false);
});

// ── conflicts / ethical walls ──
ok('hasConflict: client of one matter adverse in another ⇒ true', () => {
  assert.equal(hasConflict({ matterId: 'm1', clients: ['Acme'], adverseParties: ['Beta'] }, { matterId: 'm2', clients: ['Gamma'], adverseParties: ['acme'] }), true);
  assert.equal(hasConflict({ matterId: 'm1', clients: ['Acme'], adverseParties: ['Beta'] }, { matterId: 'm2', clients: ['Gamma'], adverseParties: ['Delta'] }), false);
});
ok('crossMatterRetrieval: same ok; diff needs complete link', () => {
  assert.equal(crossMatterRetrievalAllowed('m1', 'm1').allowed, true);
  assert.equal(crossMatterRetrievalAllowed('m1', 'm2').allowed, false);
  assert.equal(crossMatterRetrievalAllowed('m1', 'm2', { approvedBy: 'jane', basis: 'joint rep', at: '2026-06-24' }).allowed, true);
  assert.equal(crossMatterRetrievalAllowed('m1', 'm2', { approvedBy: '', basis: '', at: '' }).allowed, false);
});

// ── device / security headers ──
ok('CSP restricts connect to known providers; headers include HSTS + frame DENY', () => {
  assert.match(buildCspHeader(), /api\.anthropic\.com/);
  assert.match(buildCspHeader(), /frame-ancestors 'none'/);
  const h = securityHeaders();
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.ok(h['Strict-Transport-Security']);
});
ok('isSessionExpired: old ⇒ true, recent ⇒ false, garbage ⇒ true (fail closed)', () => {
  assert.equal(isSessionExpired('2026-06-24T00:00:00Z', '2026-06-24T00:45:00Z', 30), true);
  assert.equal(isSessionExpired('2026-06-24T00:00:00Z', '2026-06-24T00:10:00Z', 30), false);
  assert.equal(isSessionExpired('not-a-date', '2026-06-24T00:10:00Z', 30), true);
});

// ── end-to-end: consent enforcement in computeTurnPolicy (P6 flip) ──
await ok('bound confidential WITHOUT consent ⇒ external calls BLOCKED', async () => {
  setSessionRedis(statefulRedis({ user_id: 'u', matter_mode: 'client_confidential' }));
  const d = await computeTurnPolicy('s2', 'what is the filing deadline');
  assert.equal(d.externalCallsAllowed, false);
});
await ok('bound confidential WITH recorded consent ⇒ external calls allowed', async () => {
  setSessionRedis(statefulRedis({ user_id: 'u', matter_mode: 'client_confidential', client_ai_consent: 'allowed' }));
  const d = await computeTurnPolicy('s3', 'what is the filing deadline');
  assert.equal(d.externalCallsAllowed, true);
});
await ok('public session escalated by PII ⇒ NOT hard-blocked (still answers, web_search dropped)', async () => {
  setSessionRedis(statefulRedis({ user_id: 'u', matter_mode: 'public_research' }));
  const d = await computeTurnPolicy('s4', 'client SSN 123-45-6789 advice');
  assert.equal(d.effectiveMode, 'client_confidential');
  assert.equal(d.externalCallsAllowed, true);
  assert.ok(!d.allowedTools.includes('web_search'));
});

setSessionRedis(null);
console.log(`\nPASS — ${pass} checks passed.`);
