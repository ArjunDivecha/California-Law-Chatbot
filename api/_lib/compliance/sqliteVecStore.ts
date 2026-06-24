/**
 * =============================================================================
 * Firm-controlled vector store (sqlite-vec) — P5-infra
 * api/_lib/compliance/sqliteVecStore.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   The firm-controlled store for protected_discovery + Restricted-Data matters
 *   (PRD §5.7a; decision 2026-06-24 = sqlite-vec + local BGE-M3 embeddings).
 *   An embedded SQLite database (no server, single file) with the sqlite-vec
 *   extension for vector kNN. Implements the FirmControlledStore key/value
 *   interface AND matter-scoped vector upsert/query, so client embeddings +
 *   conversation data never leave the firm's host.
 *
 *   Deployment note: this runs on the FIRM'S host (a local/on-prem process),
 *   NOT Vercel serverless (which is ephemeral and can't hold a persistent
 *   SQLite file or reach the local embedding daemon). Wire it at boot via
 *   storagePolicy.setFirmControlledStore(new SqliteVecStore(...)).
 *
 *   Matter isolation: every read is filtered by matter_id; vector queries
 *   over-fetch then filter so one matter's vectors can't surface in another's.
 *
 * INPUT FILES:  the SQLite db file at `path` (or FIRM_STORE_PATH; ':memory:' for tests)
 * OUTPUT FILES: same file (created if absent)
 * =============================================================================
 */
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { FirmControlledStore } from './storagePolicy.js';

export interface SqliteVecStoreOptions {
  /** SQLite file path. Defaults to FIRM_STORE_PATH, then ':memory:'. */
  path?: string;
  /** Embedding dimensionality (e.g. BGE-M3 = 1024). Required. */
  dim: number;
}

export interface VectorMatch {
  docId: string;
  distance: number;
  textHash: string;
}

/** Over-fetch factor so matter-filtered kNN still returns enough rows. */
const OVERFETCH = 8;

const toBuf = (v: number[]): Buffer => Buffer.from(Float32Array.from(v).buffer);

export class SqliteVecStore implements FirmControlledStore {
  private db: Database.Database;
  private dim: number;

  constructor(opts: SqliteVecStoreOptions) {
    if (!opts.dim || opts.dim < 1) throw new Error('SqliteVecStore: dim is required (embedding dimensionality)');
    this.dim = opts.dim;
    this.db = new Database(opts.path ?? process.env.FIRM_STORE_PATH ?? ':memory:');
    this.db.pragma('journal_mode = WAL');
    (sqliteVec as { load: (db: Database.Database) => void }).load(this.db);
    this.db.exec(
      `create table if not exists kv(
         matter_id text not null, key text not null, value text not null,
         primary key (matter_id, key)
       )`,
    );
    this.db.exec(`create virtual table if not exists vecs using vec0(embedding float[${this.dim}])`);
    this.db.exec(
      `create table if not exists vmeta(
         rowid integer primary key, matter_id text not null, doc_id text not null, text_hash text not null
       )`,
    );
  }

  // ── FirmControlledStore (matter-scoped key/value) ──
  async put(matterId: string, key: string, value: string): Promise<void> {
    if (!matterId) throw new Error('put: matterId required for isolation');
    this.db.prepare('insert or replace into kv(matter_id, key, value) values (?,?,?)').run(matterId, key, value);
  }

  async get(matterId: string, key: string): Promise<string | null> {
    if (!matterId) throw new Error('get: matterId required for isolation');
    const row = this.db.prepare('select value from kv where matter_id=? and key=?').get(matterId, key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  // ── Matter-scoped vector ops ──
  private nextRowid(): bigint {
    const r = this.db.prepare('select coalesce(max(rowid),0)+1 as n from vmeta').get() as { n: number };
    return BigInt(r.n);
  }

  /** Upsert a document embedding for a matter. (docId unique per matter.) */
  upsertVector(matterId: string, docId: string, embedding: number[], textHash: string): void {
    if (!matterId) throw new Error('upsertVector: matterId required');
    if (embedding.length !== this.dim) {
      throw new Error(`upsertVector: embedding dim ${embedding.length} != store dim ${this.dim}`);
    }
    const existing = this.db
      .prepare('select rowid from vmeta where matter_id=? and doc_id=?')
      .get(matterId, docId) as { rowid: number } | undefined;
    if (existing) {
      this.db.prepare('update vecs set embedding=? where rowid=?').run(toBuf(embedding), BigInt(existing.rowid));
      this.db.prepare('update vmeta set text_hash=? where rowid=?').run(textHash, BigInt(existing.rowid));
      return;
    }
    const rowid = this.nextRowid();
    const tx = this.db.transaction(() => {
      this.db.prepare('insert into vecs(rowid, embedding) values (?,?)').run(rowid, toBuf(embedding));
      this.db.prepare('insert into vmeta(rowid, matter_id, doc_id, text_hash) values (?,?,?,?)').run(rowid, matterId, docId, textHash);
    });
    tx();
  }

  /** kNN within a single matter (isolation enforced by filtering on matter_id). */
  queryVectors(matterId: string, embedding: number[], k: number): VectorMatch[] {
    if (!matterId) throw new Error('queryVectors: matterId required');
    if (embedding.length !== this.dim) {
      throw new Error(`queryVectors: embedding dim ${embedding.length} != store dim ${this.dim}`);
    }
    // sqlite-vec needs a CLEAN kNN (only `match` + literal `k`, no other
    // constraints on the vec0 table), so do the kNN in a subquery, then filter
    // by matter in the outer join. kLit is a sanitized integer (inline-safe).
    const kLit = Math.max(1, Math.floor(k * OVERFETCH));
    const rows = this.db
      .prepare(
        `select v.distance as distance, m.doc_id as docId, m.text_hash as textHash
           from (select rowid, distance from vecs where embedding match ? and k = ${kLit}) v
           join vmeta m on m.rowid = v.rowid
          where m.matter_id = ?
          order by v.distance`,
      )
      .all(toBuf(embedding), matterId) as VectorMatch[];
    return rows.slice(0, k);
  }

  count(matterId: string): number {
    const r = this.db.prepare('select count(*) as n from vmeta where matter_id=?').get(matterId) as { n: number };
    return r.n;
  }

  close(): void {
    this.db.close();
  }
}
