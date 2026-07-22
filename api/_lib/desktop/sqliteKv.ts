/**
 * =============================================================================
 * SCRIPT NAME: api/_lib/desktop/sqliteKv.ts
 * =============================================================================
 *
 * DESCRIPTION:
 * Local SQLite replacement for Upstash Redis, used by the desktop (Tauri)
 * build so no session data ever leaves the machine. Implements the exact
 * `SessionRedis` interface from api/_lib/sessionStore.ts (lists, hashes,
 * strings with TTL/NX, sorted sets) plus the `AuditSink` interface from
 * api/_shared/auditLog.ts (lpush/expire), backed by better-sqlite3 in WAL
 * mode. The desktop server injects an instance via setSessionRedis() and
 * setAuditSink() at boot — sessionStore.ts and its callers are unchanged.
 *
 * Redis semantics implemented:
 *   - rpush/lpush/lrange   → list_items table (seq-ordered)
 *   - hset/hgetall         → hash_fields table
 *   - set(ex,nx)/get/incr  → kv table ('OK' / null contract for NX locks)
 *   - zadd/zrange(rev)/zrem/zcard → zset_members table
 *   - expire/TTL           → expiry table, enforced lazily on every read
 *   - del                  → removes the key from every table
 *
 * INPUT FILES:  none (creates the DB if missing)
 * OUTPUT FILES: SQLite database at
 *   $DESKTOP_DATA_DIR/sessions.db  (if DESKTOP_DATA_DIR is set), else
 *   /Users/<user>/Library/Application Support/AskPauli/sessions.db
 *   (on macOS; os.homedir()-derived equivalent elsewhere)
 *
 * DEPENDENCIES: better-sqlite3 (already a package.json dependency)
 * =============================================================================
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SessionRedis } from '../sessionStore.js';
import type { AuditSink } from '../../_shared/auditLog.js';

export function defaultDataDir(): string {
  return (
    process.env.DESKTOP_DATA_DIR ||
    join(homedir(), 'Library', 'Application Support', 'AskPauli')
  );
}

export class SqliteKv implements SessionRedis, AuditSink {
  readonly dbPath: string;
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = defaultDataDir();
    mkdirSync(dir, { recursive: true });
    this.dbPath = dbPath ?? join(dir, 'sessions.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS list_items (
        key TEXT NOT NULL, seq INTEGER NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (key, seq)
      );
      CREATE TABLE IF NOT EXISTS hash_fields (
        key TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (key, field)
      );
      CREATE TABLE IF NOT EXISTS zset_members (
        key TEXT NOT NULL, member TEXT NOT NULL, score REAL NOT NULL,
        PRIMARY KEY (key, member)
      );
      CREATE TABLE IF NOT EXISTS expiry (
        key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
      );
    `);
  }

  // ── expiry (lazy) ──────────────────────────────────────────────────────

  /** True if the key has a TTL that has passed; purges it if so. */
  private expiredAndPurged(key: string): boolean {
    const row = this.db
      .prepare('SELECT expires_at FROM expiry WHERE key = ?')
      .get(key) as { expires_at: number } | undefined;
    if (!row) return false;
    if (row.expires_at > Date.now()) return false;
    this.purge(key);
    return true;
  }

  private purge(key: string): void {
    this.db.prepare('DELETE FROM kv WHERE key = ?').run(key);
    this.db.prepare('DELETE FROM list_items WHERE key = ?').run(key);
    this.db.prepare('DELETE FROM hash_fields WHERE key = ?').run(key);
    this.db.prepare('DELETE FROM zset_members WHERE key = ?').run(key);
    this.db.prepare('DELETE FROM expiry WHERE key = ?').run(key);
  }

  private setTtl(key: string, seconds: number): void {
    this.db
      .prepare(
        'INSERT INTO expiry (key, expires_at) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at',
      )
      .run(key, Date.now() + seconds * 1000);
  }

  // ── lists ──────────────────────────────────────────────────────────────

  async rpush(key: string, ...values: string[]): Promise<number> {
    this.expiredAndPurged(key);
    const next = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM list_items WHERE key = ?')
      .get(key) as { m: number };
    let seq = next.m;
    const ins = this.db.prepare(
      'INSERT INTO list_items (key, seq, value) VALUES (?, ?, ?)',
    );
    for (const v of values) ins.run(key, ++seq, v);
    const n = this.db
      .prepare('SELECT COUNT(*) AS c FROM list_items WHERE key = ?')
      .get(key) as { c: number };
    return n.c;
  }

  async lpush(key: string, value: string): Promise<number> {
    this.expiredAndPurged(key);
    const min = this.db
      .prepare('SELECT COALESCE(MIN(seq), 0) AS m FROM list_items WHERE key = ?')
      .get(key) as { m: number };
    this.db
      .prepare('INSERT INTO list_items (key, seq, value) VALUES (?, ?, ?)')
      .run(key, min.m - 1, value);
    const n = this.db
      .prepare('SELECT COUNT(*) AS c FROM list_items WHERE key = ?')
      .get(key) as { c: number };
    return n.c;
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    if (this.expiredAndPurged(key)) return [];
    const rows = this.db
      .prepare('SELECT value FROM list_items WHERE key = ? ORDER BY seq ASC')
      .all(key) as Array<{ value: string }>;
    const all = rows.map((r) => r.value);
    // Redis LRANGE semantics: negative indexes count from the tail; the
    // range is inclusive. (0, -1) means the whole list.
    const n = all.length;
    let s = start < 0 ? Math.max(n + start, 0) : start;
    let e = end < 0 ? n + end : Math.min(end, n - 1);
    if (s > e) return [];
    return all.slice(s, e + 1);
  }

  // ── hashes ─────────────────────────────────────────────────────────────

  async hset(key: string, value: Record<string, unknown>): Promise<number> {
    this.expiredAndPurged(key);
    const ins = this.db.prepare(
      'INSERT INTO hash_fields (key, field, value) VALUES (?, ?, ?) ' +
        'ON CONFLICT(key, field) DO UPDATE SET value = excluded.value',
    );
    let count = 0;
    for (const [f, v] of Object.entries(value)) {
      ins.run(key, f, String(v));
      count++;
    }
    return count;
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
    if (this.expiredAndPurged(key)) return null;
    const rows = this.db
      .prepare('SELECT field, value FROM hash_fields WHERE key = ?')
      .all(key) as Array<{ field: string; value: string }>;
    if (rows.length === 0) return null;
    const out: Record<string, string> = {};
    for (const r of rows) out[r.field] = r.value;
    return out as T;
  }

  // ── strings ────────────────────────────────────────────────────────────

  async set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<unknown> {
    this.expiredAndPurged(key);
    if (opts?.nx) {
      const existing = this.db
        .prepare('SELECT key FROM kv WHERE key = ?')
        .get(key);
      if (existing) return null; // NX contract: null when not set
    }
    this.db
      .prepare(
        'INSERT INTO kv (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
    if (opts?.ex) this.setTtl(key, opts.ex);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.expiredAndPurged(key)) return null;
    const row = this.db
      .prepare('SELECT value FROM kv WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  async incr(key: string): Promise<number> {
    this.expiredAndPurged(key);
    const row = this.db
      .prepare('SELECT value FROM kv WHERE key = ?')
      .get(key) as { value: string } | undefined;
    const next = (row ? parseInt(row.value, 10) || 0 : 0) + 1;
    this.db
      .prepare(
        'INSERT INTO kv (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, String(next));
    return next;
  }

  async del(key: string): Promise<number> {
    this.purge(key);
    return 1;
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    this.setTtl(key, seconds);
    return 1;
  }

  // ── sorted sets ────────────────────────────────────────────────────────

  async zadd(
    key: string,
    score_member: { score: number; member: string },
  ): Promise<number | null> {
    this.expiredAndPurged(key);
    this.db
      .prepare(
        'INSERT INTO zset_members (key, member, score) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key, member) DO UPDATE SET score = excluded.score',
      )
      .run(key, score_member.member, score_member.score);
    return 1;
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean },
  ): Promise<string[]> {
    if (this.expiredAndPurged(key)) return [];
    const order = opts?.rev ? 'DESC' : 'ASC';
    const rows = this.db
      .prepare(
        `SELECT member FROM zset_members WHERE key = ? ORDER BY score ${order}, member ${order}`,
      )
      .all(key) as Array<{ member: string }>;
    const all = rows.map((r) => r.member);
    const n = all.length;
    const s = start < 0 ? Math.max(n + start, 0) : start;
    const e = stop < 0 ? n + stop : Math.min(stop, n - 1);
    if (s > e) return [];
    return all.slice(s, e + 1);
  }

  async zrem(key: string, member: string): Promise<number> {
    const info = this.db
      .prepare('DELETE FROM zset_members WHERE key = ? AND member = ?')
      .run(key, member);
    return info.changes;
  }

  async zcard(key: string): Promise<number> {
    if (this.expiredAndPurged(key)) return 0;
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM zset_members WHERE key = ?')
      .get(key) as { c: number };
    return row.c;
  }
}
