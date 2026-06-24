/**
 * =============================================================================
 * Test: P5-infra SqliteVecStore (firm-controlled vector store)
 * Run:  npx tsx tests/sqliteVecStore.test.mjs   (from repo root; no API key)
 * =============================================================================
 * Real in-memory SQLite + sqlite-vec. Verifies matter-scoped key/value, vector
 * kNN, MATTER ISOLATION (one matter's vectors never surface in another's),
 * upsert-update semantics, and the dimension guard.
 *
 * INPUT FILES:  ../api/_lib/compliance/sqliteVecStore.ts (uses better-sqlite3 + sqlite-vec)
 * OUTPUT FILES: none (in-memory db)
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { SqliteVecStore } from '../api/_lib/compliance/sqliteVecStore.js';

let pass = 0;
const ok = (n, f) => { const r = f(); if (r && r.then) return r.then(() => { pass += 1; console.log(`  ok - ${n}`); }); pass += 1; console.log(`  ok - ${n}`); };

const store = new SqliteVecStore({ path: ':memory:', dim: 3 });

await ok('key/value is matter-scoped (m1 write invisible to m2)', async () => {
  await store.put('m1', 'session:1', 'hello');
  assert.equal(await store.get('m1', 'session:1'), 'hello');
  assert.equal(await store.get('m2', 'session:1'), null);
});

ok('vector upsert + kNN returns nearest within matter', () => {
  store.upsertVector('m1', 'd1', [0.1, 0.2, 0.3], 'h1');
  store.upsertVector('m1', 'd2', [0.9, 0.8, 0.7], 'h2');
  const res = store.queryVectors('m1', [0.1, 0.2, 0.31], 1);
  assert.equal(res.length, 1);
  assert.equal(res[0].docId, 'd1');
  assert.ok(res[0].distance >= 0);
});

ok('MATTER ISOLATION: another matter\'s nearer vector is NOT returned', () => {
  // dX (m2) is essentially identical to the query — but querying m1 must not see it.
  store.upsertVector('m2', 'dX', [0.1, 0.2, 0.31], 'hX');
  const res = store.queryVectors('m1', [0.1, 0.2, 0.31], 1);
  assert.equal(res[0].docId, 'd1'); // m1's own nearest, NOT m2's dX
  assert.equal(store.count('m2'), 1);
});

ok('upsert on same (matter,doc) UPDATES, does not duplicate', () => {
  const before = store.count('m1');
  store.upsertVector('m1', 'd1', [0.0, 0.0, 1.0], 'h1b');
  assert.equal(store.count('m1'), before);
});

ok('dimension mismatch throws (fail closed)', () => {
  assert.throws(() => store.upsertVector('m1', 'd9', [1, 2], 'h'), /dim/);
  assert.throws(() => store.queryVectors('m1', [1, 2, 3, 4], 1), /dim/);
});

ok('empty matterId throws (isolation invariant)', () => {
  assert.throws(() => store.upsertVector('', 'd', [1, 2, 3], 'h'), /matterId/);
});

store.close();
console.log(`\nPASS — ${pass} checks passed.`);
