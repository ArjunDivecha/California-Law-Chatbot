/**
 * =============================================================================
 * SCRIPT NAME: api/_lib/libsqlKv.ts
 * =============================================================================
 *
 * DESCRIPTION:
 * Remote SQLite (Turso / libSQL) replacement for Upstash Redis, used by the
 * web build on Vercel. It is the hosted twin of the desktop adapter
 * api/_lib/desktop/sqliteKv.ts: same five-table schema, same Redis semantics,
 * so the desktop app and the web app share one storage model and differ only
 * in the connection string. Implements the `SessionRedis` interface from
 * api/_lib/sessionStore.ts (lists, hashes, strings with TTL/NX, sorted sets),
 * the `AuditSink` interface (lpush/expire) and the `EnvelopeSink` interface
 * (set with TTL) from api/_shared/auditLog.ts.
 *
 * Differences from the desktop adapter, all forced by the client being async
 * and remote:
 *   - every method awaits @libsql/client `execute` / `batch` calls
 *   - SET NX is a single atomic `INSERT ... ON CONFLICT DO NOTHING` (the
 *     desktop version checks-then-writes, which is fine in-process but not
 *     across concurrent Vercel function instances)
 *   - INCR is a single atomic upsert with RETURNING
 *   - expired keys are purged lazily on read, plus a cheap opportunistic sweep
 *     of all expired keys roughly once per 64 writes
 *
 * Selected by sessionStore / auditLog / chats when TURSO_DATABASE_URL is set
 * (env is injected by the Vercel Marketplace Turso integration). Upstash
 * remains the fallback when it is not, so the switch is a config flip.
 *
 * INPUT FILES:  none
 * OUTPUT FILES: none (writes to the remote Turso database named by
 *               TURSO_DATABASE_URL; schema created on first use)
 *
 * DEPENDENCIES: @libsql/client
 * =============================================================================
 */

import { createClient, type Client, type InArgs } from '@libsql/client';

/** Object form of @libsql/client's InStatement (the union also admits bare strings). */
type Stmt = { sql: string; args: InArgs };
import type { SessionRedis } from './sessionStore.js';
import type { AuditSink, EnvelopeSink } from '../_shared/auditLog.js';

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS kv (
     key TEXT PRIMARY KEY, value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS list_items (
     key TEXT NOT NULL, seq INTEGER NOT NULL, value TEXT NOT NULL,
     PRIMARY KEY (key, seq)
   )`,
  `CREATE TABLE IF NOT EXISTS hash_fields (
     key TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL,
     PRIMARY KEY (key, field)
   )`,
  `CREATE TABLE IF NOT EXISTS zset_members (
     key TEXT NOT NULL, member TEXT NOT NULL, score REAL NOT NULL,
     PRIMARY KEY (key, member)
   )`,
  `CREATE TABLE IF NOT EXISTS expiry (
     key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS expiry_expires_at ON expiry (expires_at)`,
];

const TABLES = ['kv', 'list_items', 'hash_fields', 'zset_members', 'expiry'] as const;

export interface LibsqlKvOptions {
  url: string;
  authToken?: string;
}

export class LibsqlKv implements SessionRedis, AuditSink, EnvelopeSink {
  private readonly client: Client;
  private ready: Promise<void> | null = null;
  private writes = 0;

  constructor(opts: LibsqlKvOptions) {
    this.client = createClient({ url: opts.url, authToken: opts.authToken });
  }

  /** Create the schema once per process. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.client
        .batch(SCHEMA.map((sql) => ({ sql, args: [] })), 'write')
        .then(() => undefined)
        .catch((err) => {
          this.ready = null;
          throw err;
        });
    }
    return this.ready;
  }

  private async run(sql: string, args: InArgs = []) {
    await this.init();
    return this.client.execute({ sql, args });
  }

  private async tx(statements: Stmt[]) {
    await this.init();
    return this.client.batch(statements, 'write');
  }

  private purgeStatements(key: string): Stmt[] {
    return TABLES.map((t) => ({ sql: `DELETE FROM ${t} WHERE key = ?`, args: [key] }));
  }

  // ── expiry (lazy) ──────────────────────────────────────────────────────

  /** True if the key has a TTL that has passed; purges it if so. */
  private async expiredAndPurged(key: string): Promise<boolean> {
    const rs = await this.run('SELECT expires_at FROM expiry WHERE key = ?', [key]);
    const row = rs.rows[0];
    if (!row) return false;
    if (Number(row.expires_at) > Date.now()) return false;
    await this.tx(this.purgeStatements(key));
    return true;
  }

  private ttlStatement(key: string, seconds: number): Stmt {
    return {
      sql:
        'INSERT INTO expiry (key, expires_at) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at',
      args: [key, Date.now() + seconds * 1000],
    };
  }

  /**
   * Delete every key whose TTL has passed. Called opportunistically from the
   * write path; also exported for maintenance scripts.
   */
  async sweepExpired(now: number = Date.now()): Promise<number> {
    const rs = await this.run('SELECT key FROM expiry WHERE expires_at <= ?', [now]);
    const keys = rs.rows.map((r) => String(r.key));
    if (keys.length === 0) return 0;
    const stmts: Stmt[] = [];
    for (const k of keys) stmts.push(...this.purgeStatements(k));
    await this.tx(stmts);
    return keys.length;
  }

  private async maybeSweep(): Promise<void> {
    this.writes += 1;
    if (this.writes % 64 !== 0) return;
    try {
      await this.sweepExpired();
    } catch {
      /* best effort; the lazy purge on read still enforces TTLs */
    }
  }

  // ── lists ──────────────────────────────────────────────────────────────

  async rpush(key: string, ...values: string[]): Promise<number> {
    await this.expiredAndPurged(key);
    // Each INSERT computes its own seq inside the same transaction, so a
    // multi-value push stays contiguous and ordered.
    const stmts: Stmt[] = values.map((v) => ({
      sql:
        'INSERT INTO list_items (key, seq, value) ' +
        'SELECT ?, COALESCE(MAX(seq), 0) + 1, ? FROM list_items WHERE key = ?',
      args: [key, v, key],
    }));
    stmts.push({ sql: 'SELECT COUNT(*) AS c FROM list_items WHERE key = ?', args: [key] });
    const results = await this.tx(stmts);
    await this.maybeSweep();
    return Number(results[results.length - 1].rows[0].c);
  }

  async lpush(key: string, value: string): Promise<number> {
    await this.expiredAndPurged(key);
    const results = await this.tx([
      {
        sql:
          'INSERT INTO list_items (key, seq, value) ' +
          'SELECT ?, COALESCE(MIN(seq), 0) - 1, ? FROM list_items WHERE key = ?',
        args: [key, value, key],
      },
      { sql: 'SELECT COUNT(*) AS c FROM list_items WHERE key = ?', args: [key] },
    ]);
    await this.maybeSweep();
    return Number(results[1].rows[0].c);
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    if (await this.expiredAndPurged(key)) return [];
    const rs = await this.run('SELECT value FROM list_items WHERE key = ? ORDER BY seq ASC', [key]);
    const all = rs.rows.map((r) => String(r.value));
    // Redis LRANGE semantics: negative indexes count from the tail; the
    // range is inclusive. (0, -1) means the whole list.
    const n = all.length;
    const s = start < 0 ? Math.max(n + start, 0) : start;
    const e = end < 0 ? n + end : Math.min(end, n - 1);
    if (s > e) return [];
    return all.slice(s, e + 1);
  }

  // ── hashes ─────────────────────────────────────────────────────────────

  async hset(key: string, value: Record<string, unknown>): Promise<number> {
    await this.expiredAndPurged(key);
    const entries = Object.entries(value);
    if (entries.length === 0) return 0;
    await this.tx(
      entries.map(([f, v]) => ({
        sql:
          'INSERT INTO hash_fields (key, field, value) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key, field) DO UPDATE SET value = excluded.value',
        args: [key, f, String(v)],
      })),
    );
    await this.maybeSweep();
    return entries.length;
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
    if (await this.expiredAndPurged(key)) return null;
    const rs = await this.run('SELECT field, value FROM hash_fields WHERE key = ?', [key]);
    if (rs.rows.length === 0) return null;
    const out: Record<string, string> = {};
    for (const r of rs.rows) out[String(r.field)] = String(r.value);
    return out as T;
  }

  // ── strings ────────────────────────────────────────────────────────────

  async set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<unknown> {
    await this.expiredAndPurged(key);
    if (opts?.nx) {
      // Atomic across instances: the row either lands or it doesn't.
      const rs = await this.run(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
        [key, value],
      );
      if (rs.rowsAffected === 0) return null; // NX contract: null when not set
      if (opts.ex) {
        const t = this.ttlStatement(key, opts.ex);
        await this.run(t.sql, t.args);
      }
      await this.maybeSweep();
      return 'OK';
    }
    const stmts: Stmt[] = [
      {
        sql:
          'INSERT INTO kv (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [key, value],
      },
    ];
    if (opts?.ex) stmts.push(this.ttlStatement(key, opts.ex));
    else stmts.push({ sql: 'DELETE FROM expiry WHERE key = ?', args: [key] }); // plain SET clears a TTL, like Redis
    await this.tx(stmts);
    await this.maybeSweep();
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (await this.expiredAndPurged(key)) return null;
    const rs = await this.run('SELECT value FROM kv WHERE key = ?', [key]);
    const row = rs.rows[0];
    return row ? String(row.value) : null;
  }

  async incr(key: string): Promise<number> {
    await this.expiredAndPurged(key);
    const rs = await this.run(
      'INSERT INTO kv (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(kv.value AS INTEGER) + 1 AS TEXT) ' +
        'RETURNING value',
      [key, '1'],
    );
    await this.maybeSweep();
    return Number(rs.rows[0].value);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const stmts: Stmt[] = [];
    for (const k of keys) stmts.push(...this.purgeStatements(k));
    await this.tx(stmts);
    return keys.length;
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    const s = this.ttlStatement(key, seconds);
    await this.run(s.sql, s.args);
    return 1;
  }

  // ── sorted sets ────────────────────────────────────────────────────────

  async zadd(
    key: string,
    score_member: { score: number; member: string },
  ): Promise<number | null> {
    await this.expiredAndPurged(key);
    await this.run(
      'INSERT INTO zset_members (key, member, score) VALUES (?, ?, ?) ' +
        'ON CONFLICT(key, member) DO UPDATE SET score = excluded.score',
      [key, score_member.member, score_member.score],
    );
    await this.maybeSweep();
    return 1;
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean },
  ): Promise<string[]> {
    if (await this.expiredAndPurged(key)) return [];
    const order = opts?.rev ? 'DESC' : 'ASC';
    const rs = await this.run(
      `SELECT member FROM zset_members WHERE key = ? ORDER BY score ${order}, member ${order}`,
      [key],
    );
    const all = rs.rows.map((r) => String(r.member));
    const n = all.length;
    const s = start < 0 ? Math.max(n + start, 0) : start;
    const e = stop < 0 ? n + stop : Math.min(stop, n - 1);
    if (s > e) return [];
    return all.slice(s, e + 1);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    const results = await this.tx(
      members.map((m) => ({
        sql: 'DELETE FROM zset_members WHERE key = ? AND member = ?',
        args: [key, m],
      })),
    );
    return results.reduce((n, r) => n + r.rowsAffected, 0);
  }

  async zcard(key: string): Promise<number> {
    if (await this.expiredAndPurged(key)) return 0;
    const rs = await this.run('SELECT COUNT(*) AS c FROM zset_members WHERE key = ?', [key]);
    return Number(rs.rows[0].c);
  }

  // ── maintenance / migration helpers ────────────────────────────────────

  /** Remaining TTL in seconds, -1 if none, -2 if the key has expired. */
  async ttl(key: string): Promise<number> {
    const rs = await this.run('SELECT expires_at FROM expiry WHERE key = ?', [key]);
    const row = rs.rows[0];
    if (!row) return -1;
    const ms = Number(row.expires_at) - Date.now();
    return ms <= 0 ? -2 : Math.ceil(ms / 1000);
  }

  /** Every live key across all tables (for verification scripts). */
  async keys(): Promise<string[]> {
    const rs = await this.run(
      TABLES.filter((t) => t !== 'expiry')
        .map((t) => `SELECT key FROM ${t}`)
        .join(' UNION '),
    );
    return rs.rows.map((r) => String(r.key));
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

// ---------------------------------------------------------------------------
// Process-wide singleton, selected by env
// ---------------------------------------------------------------------------

let shared: LibsqlKv | null = null;

/** True when the Turso integration has injected its connection env. */
export function libsqlConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function getLibsqlKv(): LibsqlKv {
  if (shared) return shared;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('libsqlKv: TURSO_DATABASE_URL not configured');
  shared = new LibsqlKv({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return shared;
}

/** Test-only: drop the cached singleton so env changes take effect. */
export function resetLibsqlKv(): void {
  shared = null;
}
