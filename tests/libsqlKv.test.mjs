/**
 * tests/libsqlKv.test.mjs — exercises api/_lib/libsqlKv.ts (the Turso/libSQL
 * session store) against a throwaway local `file:` database, both directly
 * (Redis semantics: NX locks, TTL expiry, LRANGE/ZRANGE index rules, INCR) and
 * through the real callers (sessionStore.ts, auditLog.ts) via the injection
 * hooks the desktop app already uses.
 *
 * Inputs : none.  Outputs: none (temp DB under os.tmpdir(), deleted at the end).
 * Run    : ./node_modules/.bin/tsx tests/libsqlKv.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibsqlKv } from '../api/_lib/libsqlKv.ts';
import {
  setSessionRedis, appendMessage, readMessages, writeMeta, readMeta,
  acquireLock, releaseLock, rateLimitHit, readToolResult,
} from '../api/_lib/sessionStore.ts';
import { setAuditSink, writeTurnManifest } from '../api/_shared/auditLog.ts';

const dir = mkdtempSync(join(tmpdir(), 'libsqlkv-'));
const kv = new LibsqlKv({ url: `file:${join(dir, 'test.db')}` });
let passed = 0;
async function t(name, fn) { await fn(); passed++; console.log('ok', name); }

try {
  await t('strings: set/get/del + plain SET clears TTL', async () => {
    assert.equal(await kv.set('a', '1'), 'OK');
    assert.equal(await kv.get('a'), '1');
    await kv.set('a', '2', { ex: 100 });
    assert.ok((await kv.ttl('a')) > 90);
    await kv.set('a', '3');
    assert.equal(await kv.ttl('a'), -1);
    assert.equal(await kv.del('a'), 1);
    assert.equal(await kv.get('a'), null);
  });

  await t('NX lock contract: null when held, OK after release/expiry', async () => {
    assert.equal(await kv.set('lock', 'x', { ex: 30, nx: true }), 'OK');
    assert.equal(await kv.set('lock', 'y', { ex: 30, nx: true }), null);
    assert.equal(await kv.get('lock'), 'x');
    await kv.del('lock');
    assert.equal(await kv.set('lock', 'z', { ex: 30, nx: true }), 'OK');
  });

  await t('TTL expiry is enforced lazily on read', async () => {
    await kv.set('short', 'v', { ex: 1 });
    await kv.expire('short', 0); // already past
    assert.equal(await kv.get('short'), null);
    await kv.rpush('l', 'a');
    await kv.expire('l', 0);
    assert.deepEqual(await kv.lrange('l', 0, -1), []);
  });

  await t('incr is atomic upsert', async () => {
    assert.equal(await kv.incr('n'), 1);
    assert.equal(await kv.incr('n'), 2);
    assert.equal(await kv.incr('n'), 3);
  });

  await t('lists: rpush/lpush/lrange with Redis index semantics', async () => {
    assert.equal(await kv.rpush('list', 'b', 'c'), 2);
    assert.equal(await kv.lpush('list', 'a'), 3);
    assert.deepEqual(await kv.lrange('list', 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(await kv.lrange('list', -2, -1), ['b', 'c']);
    assert.deepEqual(await kv.lrange('list', 1, 1), ['b']);
    assert.deepEqual(await kv.lrange('list', 5, 9), []);
  });

  await t('hashes: hset/hgetall, null when missing', async () => {
    assert.equal(await kv.hgetall('h'), null);
    assert.equal(await kv.hset('h', { a: 1, b: 'two', c: true }), 3);
    assert.deepEqual(await kv.hgetall('h'), { a: '1', b: 'two', c: 'true' });
    await kv.hset('h', { a: 'changed' });
    assert.equal((await kv.hgetall('h')).a, 'changed');
  });

  await t('sorted sets: zadd/zrange(rev)/zrem variadic/zcard', async () => {
    await kv.zadd('z', { score: 3, member: 'c' });
    await kv.zadd('z', { score: 1, member: 'a' });
    await kv.zadd('z', { score: 2, member: 'b' });
    assert.deepEqual(await kv.zrange('z', 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(await kv.zrange('z', 0, 1, { rev: true }), ['c', 'b']);
    assert.equal(await kv.zcard('z'), 3);
    assert.equal(await kv.zrem('z', 'a', 'c'), 2);
    assert.deepEqual(await kv.zrange('z', 0, -1), ['b']);
  });

  await t('sweepExpired removes every expired key across tables', async () => {
    await kv.set('e1', 'v'); await kv.expire('e1', 0);
    await kv.hset('e2', { f: 'v' }); await kv.expire('e2', 0);
    await kv.set('keep', 'v', { ex: 1000 });
    assert.equal(await kv.sweepExpired(), 2);
    assert.equal(await kv.get('keep'), 'v');
    assert.equal(await kv.hgetall('e2'), null);
  });

  // ── through the real callers ────────────────────────────────────────────
  setSessionRedis(kv);
  setAuditSink(kv);

  await t('sessionStore: messages + meta round-trip through libSQL', async () => {
    await appendMessage('s1', { role: 'user', content: 'hello' });
    await appendMessage('s1', { role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    const msgs = await readMessages('s1');
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'user');
    await writeMeta('s1', { user_id: 'u1', created_at: 'now', last_active_at: 'now', schema_version: 1, model: 'm', matter_mode: 'client_confidential', protected_locked: true });
    const meta = await readMeta('s1');
    assert.equal(meta.user_id, 'u1');
    assert.equal(meta.matter_mode, 'client_confidential');
    assert.equal(meta.protected_locked, true);
  });

  await t('sessionStore: single-flight lock + rate limit + tool-result cache', async () => {
    assert.equal(await acquireLock('s1'), true);
    assert.equal(await acquireLock('s1'), false);
    await releaseLock('s1');
    assert.equal(await acquireLock('s1'), true);
    assert.equal(await rateLimitHit('u1', 60), 1);
    assert.equal(await rateLimitHit('u1', 60), 2);
    assert.equal(await readToolResult('s1', 'nope'), null);
  });

  await t('auditLog: manifest lpush lands with a TTL', async () => {
    await writeTurnManifest({ turn: 1 });
    const day = new Date().toISOString().slice(0, 10);
    const rows = await kv.lrange(`manifest:${day}`, 0, -1);
    assert.equal(rows.length, 1);
    assert.ok((await kv.ttl(`manifest:${day}`)) > 0);
  });
} finally {
  setSessionRedis(null);
  setAuditSink(null);
  await kv.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed, 0 failed`);
