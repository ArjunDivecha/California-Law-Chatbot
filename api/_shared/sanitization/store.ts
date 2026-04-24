/**
 * SanitizationStore — encrypted persistent token map.
 *
 * Stores a per-attorney mapping of `raw client identifier → stable pseudonym
 * token` (e.g., "Maria Esperanza" → "CLIENT_001") in the browser's IndexedDB,
 * encrypted at rest with a key derived from the attorney's passphrase.
 *
 * Guarantees:
 *  - The passphrase is never persisted anywhere.
 *  - A wrong passphrase on open throws WrongPassphraseError immediately
 *    (verified via a sentinel round-trip).
 *  - Tokens, once assigned, are stable forever — reopening the store and
 *    looking up "Maria Esperanza" returns CLIENT_001 on day 1, day 100, and
 *    every day in between.
 *  - There is NO RECOVERY. If the attorney forgets the passphrase, the store
 *    is permanently unreadable. This is a deliberate compliance posture.
 *
 * The store exposes an injection seam for tests: `init({ idb, crypto })`
 * lets the harness pass a fake-indexeddb factory and Node's webcrypto. In
 * browser use, both default to `globalThis`.
 */

import type { SpanCategory } from './index.ts';
import {
  WrongPassphraseError,
  createSentinel,
  decryptString,
  deriveKey,
  encryptString,
  lookupKey,
  newSalt,
  verifySentinel,
  type EncryptedBlob,
} from './crypto.ts';

// ---------------------------------------------------------------------------
// Public token shape
// ---------------------------------------------------------------------------

export interface Token {
  value: string;         // e.g. "CLIENT_001"
  category: SpanCategory;
}

export interface StoreOptions {
  /** Override the IndexedDB factory. Browser default is globalThis.indexedDB. */
  indexedDB?: IDBFactory;
  /** Database name. Defaults to "cla-sanitization-v1". */
  dbName?: string;
}

const DEFAULT_DB_NAME = 'cla-sanitization-v1';
const DB_VERSION = 1;
const ENTITY_STORE = 'entities';
const META_STORE = 'meta';

// Token prefix per category.
const TOKEN_PREFIX: Record<SpanCategory, string> = {
  name: 'CLIENT',
  ssn: 'SSN',
  tin: 'TIN',
  phone: 'PHONE',
  email: 'EMAIL',
  street_address: 'ADDRESS',
  zip: 'ZIP',
  date: 'DATE',
  credit_card: 'CARD',
  bank_account: 'ACCT',
  driver_license: 'LICENSE',
  medical_record: 'MRN',
  client_matter: 'MATTER',
};

interface EntityRecord {
  /** SHA-256 of (category + ':' + lowercased raw). Primary key. */
  lookup: string;
  category: SpanCategory;
  token: string;
  /** Encrypted raw string — decrypts to the original text. */
  iv: Uint8Array;
  ct: Uint8Array;
  createdAt: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

function getIDB(opts?: StoreOptions): IDBFactory {
  const idb = opts?.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) {
    throw new Error('IndexedDB is unavailable. Sanitization store cannot run here.');
  }
  return idb;
}

// Wrap IDBRequest in a Promise.
function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

async function openDb(idb: IDBFactory, dbName: string): Promise<IDBDatabase> {
  const req = idb.open(dbName, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(ENTITY_STORE)) {
      db.createObjectStore(ENTITY_STORE, { keyPath: 'lookup' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'key' });
    }
  };
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

// ---------------------------------------------------------------------------
// SanitizationStore
// ---------------------------------------------------------------------------

export class SanitizationStore {
  private db: IDBDatabase | null = null;
  private key: CryptoKey | null = null;
  private counters: Partial<Record<SpanCategory, number>> = {};
  private dbName: string = DEFAULT_DB_NAME;
  private indexedDB: IDBFactory | null = null;

  /**
   * Open or create the store. On first open, `passphrase` establishes the
   * encryption key. On subsequent opens, the passphrase must match — a
   * WrongPassphraseError is thrown otherwise.
   */
  async init(passphrase: string, opts?: StoreOptions): Promise<void> {
    this.indexedDB = getIDB(opts);
    this.dbName = opts?.dbName ?? DEFAULT_DB_NAME;
    this.db = await openDb(this.indexedDB, this.dbName);

    // Load or generate salt.
    let saltRaw = (await this.readMeta<Uint8Array>('kdf.salt')) ?? null;
    let firstInit = false;
    if (!saltRaw) {
      saltRaw = newSalt();
      await this.writeMeta('kdf.salt', saltRaw);
      firstInit = true;
    }

    this.key = await deriveKey(passphrase, saltRaw);

    if (firstInit) {
      const sentinel = await createSentinel(this.key);
      await this.writeMeta('sentinel', sentinel);
    } else {
      const sentinel = (await this.readMeta<EncryptedBlob>('sentinel')) ?? null;
      if (!sentinel) {
        // Store exists but sentinel missing — treat as corrupt/legacy.
        throw new Error('Sanitization store is corrupt: sentinel missing.');
      }
      await verifySentinel(this.key, sentinel);
    }

    // Prime counters from meta.
    for (const category of Object.keys(TOKEN_PREFIX) as SpanCategory[]) {
      const n = (await this.readMeta<number>(`counter.${category}`)) ?? 0;
      this.counters[category] = n;
    }
  }

  async lookupToken(raw: string, category: SpanCategory): Promise<Token | null> {
    const db = this.ensureDb();
    const lk = await lookupKey(category, raw);
    const tx = db.transaction(ENTITY_STORE, 'readonly');
    const rec = (await promisifyRequest(tx.objectStore(ENTITY_STORE).get(lk))) as
      | EntityRecord
      | undefined;
    if (!rec) return null;
    return { value: rec.token, category: rec.category };
  }

  async assignToken(raw: string, category: SpanCategory): Promise<Token> {
    const existing = await this.lookupToken(raw, category);
    if (existing) return existing;

    const db = this.ensureDb();
    const key = this.ensureKey();
    const lk = await lookupKey(category, raw);

    // Increment counter and persist.
    const next = (this.counters[category] ?? 0) + 1;
    this.counters[category] = next;
    const tokenValue = `${TOKEN_PREFIX[category]}_${String(next).padStart(3, '0')}`;

    const blob = await encryptString(key, raw);
    const record: EntityRecord = {
      lookup: lk,
      category,
      token: tokenValue,
      iv: blob.iv,
      ct: blob.ct,
      createdAt: Date.now(),
    };

    const tx = db.transaction([ENTITY_STORE, META_STORE], 'readwrite');
    tx.objectStore(ENTITY_STORE).put(record);
    tx.objectStore(META_STORE).put({ key: `counter.${category}`, value: next } as MetaRecord);
    await promisifyTransaction(tx);

    return { value: tokenValue, category };
  }

  /** Return a complete map of Token.value → raw for the unlocked store. */
  async rehydrateMap(): Promise<Map<string, string>> {
    const db = this.ensureDb();
    const key = this.ensureKey();
    const tx = db.transaction(ENTITY_STORE, 'readonly');
    const all = (await promisifyRequest(tx.objectStore(ENTITY_STORE).getAll())) as EntityRecord[];
    const map = new Map<string, string>();
    for (const rec of all) {
      const raw = await decryptString(key, { iv: rec.iv, ct: rec.ct });
      map.set(rec.token, raw);
    }
    return map;
  }

  async forgetEntity(token: string): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction(ENTITY_STORE, 'readwrite');
    const store = tx.objectStore(ENTITY_STORE);
    const cursorReq = store.openCursor();
    await new Promise<void>((resolve, reject) => {
      cursorReq.onerror = () => reject(cursorReq.error);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        const rec = cursor.value as EntityRecord;
        if (rec.token === token) cursor.delete();
        cursor.continue();
      };
    });
    await promisifyTransaction(tx);
  }

  /**
   * Return an already-encrypted blob containing every entity + meta in the
   * store. Intended for manual cross-device transfer; the bytes are AES-GCM
   * encrypted, so they can travel over insecure channels. Re-importing on
   * another device still requires the same passphrase.
   */
  async exportEncrypted(): Promise<Uint8Array> {
    const db = this.ensureDb();
    const tx = db.transaction([ENTITY_STORE, META_STORE], 'readonly');
    const entities = (await promisifyRequest(tx.objectStore(ENTITY_STORE).getAll())) as EntityRecord[];
    const metaAll = (await promisifyRequest(tx.objectStore(META_STORE).getAll())) as MetaRecord[];
    const payload = {
      version: DB_VERSION,
      entities: entities.map((e) => ({
        lookup: e.lookup,
        category: e.category,
        token: e.token,
        iv: Array.from(e.iv),
        ct: Array.from(e.ct),
        createdAt: e.createdAt,
      })),
      meta: metaAll.map((m) => ({
        key: m.key,
        value:
          m.value instanceof Uint8Array
            ? { __bytes: Array.from(m.value) }
            : // Encrypted sentinel is { iv, ct } of Uint8Array — serialize similarly.
              m.value && typeof m.value === 'object' && 'iv' in (m.value as Record<string, unknown>)
              ? {
                  __blob: {
                    iv: Array.from((m.value as EncryptedBlob).iv),
                    ct: Array.from((m.value as EncryptedBlob).ct),
                  },
                }
              : m.value,
      })),
    };
    return new TextEncoder().encode(JSON.stringify(payload));
  }

  async importEncrypted(payload: Uint8Array, passphrase: string, opts?: StoreOptions): Promise<void> {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (!data || typeof data !== 'object' || data.version !== DB_VERSION) {
      throw new Error('Unrecognized sanitization export format.');
    }

    // Wipe any existing store on this device first.
    const idb = getIDB(opts);
    const dbName = opts?.dbName ?? DEFAULT_DB_NAME;
    await new Promise<void>((resolve, reject) => {
      const req = idb.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB delete blocked'));
    });

    this.db = await openDb(idb, dbName);
    this.indexedDB = idb;
    this.dbName = dbName;

    // Restore meta records.
    const metaTx = this.db.transaction(META_STORE, 'readwrite');
    const metaStore = metaTx.objectStore(META_STORE);
    for (const m of data.meta as Array<{ key: string; value: unknown }>) {
      let value: unknown = m.value;
      if (value && typeof value === 'object' && '__bytes' in (value as Record<string, unknown>)) {
        value = new Uint8Array((value as { __bytes: number[] }).__bytes);
      } else if (value && typeof value === 'object' && '__blob' in (value as Record<string, unknown>)) {
        const b = (value as { __blob: { iv: number[]; ct: number[] } }).__blob;
        value = { iv: new Uint8Array(b.iv), ct: new Uint8Array(b.ct) };
      }
      metaStore.put({ key: m.key, value } as MetaRecord);
    }
    await promisifyTransaction(metaTx);

    // Restore entities.
    const entTx = this.db.transaction(ENTITY_STORE, 'readwrite');
    const entStore = entTx.objectStore(ENTITY_STORE);
    for (const e of data.entities as Array<{
      lookup: string;
      category: SpanCategory;
      token: string;
      iv: number[];
      ct: number[];
      createdAt: number;
    }>) {
      entStore.put({
        lookup: e.lookup,
        category: e.category,
        token: e.token,
        iv: new Uint8Array(e.iv),
        ct: new Uint8Array(e.ct),
        createdAt: e.createdAt,
      } as EntityRecord);
    }
    await promisifyTransaction(entTx);

    // Unlock with the provided passphrase; will throw WrongPassphraseError if
    // the exported store was encrypted with a different passphrase.
    const saltRaw = (await this.readMeta<Uint8Array>('kdf.salt')) ?? null;
    if (!saltRaw) throw new Error('Imported store is missing salt.');
    this.key = await deriveKey(passphrase, saltRaw);
    const sentinel = (await this.readMeta<EncryptedBlob>('sentinel')) ?? null;
    if (!sentinel) throw new Error('Imported store is missing sentinel.');
    await verifySentinel(this.key, sentinel);

    for (const category of Object.keys(TOKEN_PREFIX) as SpanCategory[]) {
      this.counters[category] = (await this.readMeta<number>(`counter.${category}`)) ?? 0;
    }
  }

  close(): void {
    if (this.db) this.db.close();
    this.db = null;
    this.key = null;
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private ensureDb(): IDBDatabase {
    if (!this.db) throw new Error('SanitizationStore not initialized. Call init() first.');
    return this.db;
  }
  private ensureKey(): CryptoKey {
    if (!this.key) throw new Error('SanitizationStore not unlocked. Call init() first.');
    return this.key;
  }

  private async readMeta<T>(key: string): Promise<T | undefined> {
    const db = this.ensureDb();
    const tx = db.transaction(META_STORE, 'readonly');
    const rec = (await promisifyRequest(tx.objectStore(META_STORE).get(key))) as
      | MetaRecord
      | undefined;
    return rec ? (rec.value as T) : undefined;
  }

  private async writeMeta(key: string, value: unknown): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value } as MetaRecord);
    await promisifyTransaction(tx);
  }
}

export { WrongPassphraseError };
