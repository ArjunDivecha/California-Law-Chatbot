/**
 * =============================================================================
 * Test: P5-infra local embeddings daemon client (fail-closed)
 * Run:  npx tsx tests/localEmbeddings.test.mjs   (from repo root; no API key)
 * =============================================================================
 * INPUT FILES:  ../api/_lib/compliance/localEmbeddings.ts
 * OUTPUT FILES: none (stdout; exits non-zero on failure)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { embedLocal, isLocalEmbeddingsConfigured } from '../api/_lib/compliance/localEmbeddings.js';

let pass = 0;
const ok = (n, f) => { const r = f(); if (r && r.then) return r.then(() => { pass += 1; console.log(`  ok - ${n}`); }); pass += 1; console.log(`  ok - ${n}`); };

const okFetch = (vecs) => async () => ({ ok: true, status: 200, json: async () => ({ embeddings: vecs }) });

ok('isLocalEmbeddingsConfigured reflects url presence', () => {
  assert.equal(isLocalEmbeddingsConfigured(undefined), false);
  assert.equal(isLocalEmbeddingsConfigured('http://127.0.0.1:8077/embed'), true);
});

await ok('NO daemon configured ⇒ THROWS (no cloud fallback)', async () => {
  await assert.rejects(() => embedLocal(['hello'], { url: undefined }), /not configured/);
});

await ok('happy path ⇒ returns one vector per text', async () => {
  const out = await embedLocal(['a', 'b'], { url: 'http://x', fetchImpl: okFetch([[0.1, 0.2], [0.3, 0.4]]) });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], [0.1, 0.2]);
});

await ok('empty input ⇒ [] (no call)', async () => {
  assert.deepEqual(await embedLocal([], { url: 'http://x' }), []);
});

await ok('non-200 ⇒ throws', async () => {
  await assert.rejects(() => embedLocal(['a'], { url: 'http://x', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }), /error 503/);
});

await ok('transport error ⇒ throws (unreachable)', async () => {
  await assert.rejects(() => embedLocal(['a'], { url: 'http://x', fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }), /unreachable/);
});

await ok('count mismatch ⇒ throws', async () => {
  await assert.rejects(() => embedLocal(['a', 'b'], { url: 'http://x', fetchImpl: okFetch([[0.1]]) }), /malformed or mismatched/);
});

await ok('non-numeric embedding ⇒ throws', async () => {
  await assert.rejects(() => embedLocal(['a'], { url: 'http://x', fetchImpl: okFetch([['nope']]) }), /non-numeric/);
});

console.log(`\nPASS — ${pass} checks passed.`);
