/**
 * =============================================================================
 * SCRIPT NAME: scripts/migrate-upstash-to-libsql.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * One-off migration of the California Law Chatbot's remaining Upstash Redis
 * keys (cal-law-chat-redis) into the Turso/libSQL store used by
 * api/_lib/libsqlKv.ts. Copies every key with its type-appropriate contents
 * and remaining TTL, then verifies key-by-key that the destination matches
 * the source (values, list lengths, hash fields, zset members+scores, TTL
 * within a few seconds). Idempotent: re-running overwrites the same keys.
 *
 * Nothing is deleted from Upstash. Read-only on the source.
 *
 * Usage:
 *   ./node_modules/.bin/tsx scripts/migrate-upstash-to-libsql.mjs            # dry run: inventory only
 *   ./node_modules/.bin/tsx scripts/migrate-upstash-to-libsql.mjs --execute  # copy + verify
 *
 * INPUT (env):  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  (source)
 *               TURSO_DATABASE_URL, TURSO_AUTH_TOKEN               (destination)
 * OUTPUT FILE:  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/migration-<UTC>.json
 *               (per-key inventory, verification result, mismatches)
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibsqlKv } from '../api/_lib/libsqlKv.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'upstash-cleanup-2026-09-13');

// Load the repo .env if the shell didn't (same first-key-wins rule as elsewhere).
for (const f of ['.env', '.env.local']) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) continue;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const execute = process.argv.includes('--execute');
const SRC_URL = process.env.UPSTASH_REDIS_REST_URL;
const SRC_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!SRC_URL || !SRC_TOKEN) throw new Error('UPSTASH_REDIS_REST_URL / TOKEN missing');
if (execute && !process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL missing');

const H = { Authorization: `Bearer ${SRC_TOKEN}`, 'Content-Type': 'application/json' };
async function cmd(a) {
  const r = await fetch(SRC_URL, { method: 'POST', headers: H, body: JSON.stringify(a) });
  const j = await r.json();
  if (j.error) throw new Error(`${a[0]} ${a[1] ?? ''}: ${j.error}`);
  return j.result;
}
async function pipe(cmds) {
  const r = await fetch(`${SRC_URL}/pipeline`, { method: 'POST', headers: H, body: JSON.stringify(cmds) });
  return (await r.json()).map((x) => x.result);
}

// ── 1. inventory the source ─────────────────────────────────────────────────
let cursor = '0';
const keys = [];
do {
  const [c, ks] = await cmd(['SCAN', cursor, 'COUNT', '5000']);
  cursor = String(c);
  keys.push(...ks);
} while (cursor !== '0');
keys.sort();

const types = await pipe(keys.map((k) => ['TYPE', k]));
const ttls = await pipe(keys.map((k) => ['TTL', k]));
const entries = keys.map((k, i) => ({ key: k, type: types[i], ttl: ttls[i] }));
const byType = entries.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
console.log(`source: ${keys.length} keys`, byType);

// Fetch contents. Values are raw strings (no JSON auto-parse: we go through the
// REST API directly, not @upstash/redis, so what we copy is byte-for-byte).
const fetches = entries.map((e) =>
  e.type === 'list' ? ['LRANGE', e.key, '0', '-1']
  : e.type === 'hash' ? ['HGETALL', e.key]
  : e.type === 'zset' ? ['ZRANGE', e.key, '0', '-1', 'WITHSCORES']
  : e.type === 'set' ? ['SMEMBERS', e.key]
  : ['GET', e.key],
);
const contents = await pipe(fetches);
entries.forEach((e, i) => (e.value = contents[i]));

const report = {
  ran_at: new Date().toISOString(),
  execute,
  source: 'cal-law-chat-redis',
  source_keys: keys.length,
  by_type: byType,
  copied: 0,
  verified: 0,
  mismatches: [],
  skipped: [],
};

if (!execute) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, `migration-${report.ran_at.replace(/[:.]/g, '')}-dryrun.json`);
  fs.writeFileSync(out, JSON.stringify({ ...report, inventory: entries.map(({ key, type, ttl }) => ({ key, type, ttl })) }, null, 1));
  console.log('dry run only; inventory ->', out);
  process.exit(0);
}

// ── 2. copy into libSQL ─────────────────────────────────────────────────────
const dst = new LibsqlKv({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
await dst.init();

/** Order-insensitive canonical form for comparing hashes. */
function canon(obj) { return JSON.stringify(Object.fromEntries(Object.entries(obj ?? {}).sort())); }

function hashToObject(flat) {
  // HGETALL over REST returns [field, value, field, value, ...]
  const o = {};
  for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}

for (const e of entries) {
  if (e.ttl === -2) { report.skipped.push({ key: e.key, reason: 'expired during migration' }); continue; }
  await dst.del(e.key);
  if (e.type === 'string') await dst.set(e.key, e.value);
  else if (e.type === 'list') { if (e.value.length) await dst.rpush(e.key, ...e.value); }
  else if (e.type === 'hash') await dst.hset(e.key, hashToObject(e.value));
  else if (e.type === 'zset') {
    for (let i = 0; i < e.value.length; i += 2) await dst.zadd(e.key, { member: e.value[i], score: Number(e.value[i + 1]) });
  } else { report.skipped.push({ key: e.key, reason: `unsupported type ${e.type}` }); continue; }
  if (e.ttl > 0) await dst.expire(e.key, e.ttl);
  report.copied += 1;
}

// ── 3. verify destination against source ────────────────────────────────────
for (const e of entries) {
  if (e.ttl === -2) continue;
  let ok = true; let detail = '';
  if (e.type === 'string') { const v = await dst.get(e.key); ok = v === e.value; detail = ok ? '' : 'value differs'; }
  else if (e.type === 'list') { const v = await dst.lrange(e.key, 0, -1); ok = JSON.stringify(v) === JSON.stringify(e.value); detail = ok ? '' : `list ${v.length} vs ${e.value.length}`; }
  else if (e.type === 'hash') { const v = await dst.hgetall(e.key); ok = canon(v) === canon(hashToObject(e.value)); detail = ok ? '' : 'hash differs'; }
  else if (e.type === 'zset') {
    const members = await dst.zrange(e.key, 0, -1);
    const src = []; for (let i = 0; i < e.value.length; i += 2) src.push(e.value[i]);
    ok = JSON.stringify([...members].sort()) === JSON.stringify([...src].sort()); detail = ok ? '' : 'zset members differ';
  }
  if (ok && e.ttl > 0) { const [srcNow] = await pipe([['TTL', e.key]]); const t = await dst.ttl(e.key); if (Math.abs(t - srcNow) > 60) { ok = false; detail = `ttl ${t} vs ${srcNow}`; } }
  if (ok) report.verified += 1; else report.mismatches.push({ key: e.key, type: e.type, detail });
}
await dst.close();

fs.mkdirSync(REPORT_DIR, { recursive: true });
const out = path.join(REPORT_DIR, `migration-${report.ran_at.replace(/[:.]/g, '')}.json`);
fs.writeFileSync(out, JSON.stringify({ ...report, inventory: entries.map(({ key, type, ttl }) => ({ key, type, ttl })) }, null, 1));
console.log(JSON.stringify({ copied: report.copied, verified: report.verified, mismatches: report.mismatches.length, skipped: report.skipped.length }));
console.log('report ->', out);
if (report.mismatches.length) process.exit(1);
