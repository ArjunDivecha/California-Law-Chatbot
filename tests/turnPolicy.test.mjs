/**
 * =============================================================================
 * Test: P3b agent-loop policy wiring (computeTurnPolicy)
 * Run:  npx tsx tests/turnPolicy.test.mjs   (from repo root; no API key needed)
 * =============================================================================
 * Verifies the live-path glue: computeTurnPolicy() reads the session matter
 * mode from (mocked) Redis, escalates on unambiguous PII (not bare names), and
 * produces a PolicyDecision whose allowedTools gate web_search correctly.
 *
 * INPUT FILES:  ../api/_lib/agentLoop.ts, ../api/_lib/sessionStore.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { setSessionRedis } from '../api/_lib/sessionStore.js';
import { computeTurnPolicy } from '../api/_lib/agentLoop.js';

let pass = 0;
const ok = (n, f) => f().then(() => { pass += 1; console.log(`  ok - ${n}`); });

/** Minimal mock Redis: only hgetall is exercised by computeTurnPolicy→readMeta. */
function mockRedis(metaHash) {
  const noop = async () => 0;
  return {
    hgetall: async () => metaHash,
    rpush: noop, lrange: async () => [], hset: noop,
    set: async () => null, get: async () => null, incr: noop, del: noop,
    expire: async () => null, zadd: async () => 0, zrange: async () => [],
    zrem: noop, zcard: noop,
  };
}

const has = (d, t) => d.allowedTools.includes(t);

await ok('legacy session (no matter mode) + clean text ⇒ public_research, web_search ON', async () => {
  setSessionRedis(mockRedis({})); // empty hash ⇒ readMeta null ⇒ defaults
  const d = await computeTurnPolicy('s1', 'statute of limitations for breach of contract in California');
  assert.equal(d.effectiveMode, 'public_research');
  assert.ok(has(d, 'web_search'));
});

await ok('public session + UNAMBIGUOUS PII (SSN) ⇒ escalates to confidential, web_search OFF', async () => {
  setSessionRedis(mockRedis({ user_id: 'u', matter_mode: 'public_research' }));
  const d = await computeTurnPolicy('s2', 'client SSN 123-45-6789 needs advice');
  assert.equal(d.effectiveMode, 'client_confidential');
  assert.equal(d.escalated, true);
  assert.ok(!has(d, 'web_search'));
});

await ok('public session + bare case name only ⇒ NOT escalated (web_search stays ON)', async () => {
  setSessionRedis(mockRedis({ user_id: 'u', matter_mode: 'public_research' }));
  const d = await computeTurnPolicy('s3', 'summarize People v. Anderson and Smith v. Jones');
  assert.equal(d.effectiveMode, 'public_research');
  assert.ok(has(d, 'web_search'));
});

await ok('bound client_confidential matter ⇒ web_search OFF, tokenization light', async () => {
  setSessionRedis(mockRedis({ user_id: 'u', matter_mode: 'client_confidential' }));
  const d = await computeTurnPolicy('s4', 'what is the deadline to respond');
  assert.equal(d.effectiveMode, 'client_confidential');
  assert.ok(!has(d, 'web_search'));
  assert.equal(d.tokenization, 'light');
});

await ok('bound protected_discovery matter ⇒ public-law search + web_search all OFF', async () => {
  setSessionRedis(mockRedis({ user_id: 'u', matter_mode: 'protected_discovery' }));
  const d = await computeTurnPolicy('s5', 'analyze the produced documents');
  assert.equal(d.effectiveMode, 'protected_discovery');
  for (const t of ['web_search', 'courtlistener', 'ceb_search']) assert.ok(!has(d, t));
});

setSessionRedis(null); // restore
console.log(`\nPASS — ${pass} checks passed.`);
