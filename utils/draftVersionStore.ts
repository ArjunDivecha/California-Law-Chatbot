/**
 * utils/draftVersionStore.ts
 *
 * Word-style version history for V2 Draft sessions (phase 1 of the draft
 * versioning system, 2026-08-07). Each session accumulates an immutable
 * chain of document versions; the panel in V2DraftPage lists them and can
 * view or restore any of them. Restores never destroy history — they append
 * a new version whose kind is 'restore'.
 *
 * STORAGE: IndexedDB (db `v2-draft-versions`, store `versions`), one record
 * per version keyed `<sessionId>:<paddedVersionNumber>`. The payload
 * (document text + attribution) is AES-GCM encrypted at rest with the same
 * device-local key as draft sessions (services/workspaceCrypto). Nothing
 * ever leaves the device. IndexedDB rather than localStorage because 50
 * versions of a long agreement would blow localStorage's ~5MB cap.
 *
 * RETENTION (pure logic in `planPrune`, unit-tested): max 50 versions per
 * session; when over, oldest 'auto' versions are pruned first; 'manual',
 * 'initial', and 'restore' versions are never auto-pruned. Deleting a draft
 * session deletes its whole chain (deleteVersionsForSession).
 *
 * No file I/O (browser IndexedDB only).
 */

import { encryptWorkspace, decryptWorkspace } from '../services/workspaceCrypto.ts';

export type DraftVersionKind = 'initial' | 'auto' | 'manual' | 'restore';

/** One applied proposal, kept for attribution in the panel / future redline. */
export interface VersionAttribution {
  section: string;
  description: string;
}

export interface DraftVersion {
  session_id: string;
  /** 1-based, strictly increasing within a session. */
  version: number;
  savedAt: string;
  kind: DraftVersionKind;
  /** Optional user-provided label ("sent to opposing counsel"). */
  label?: string;
  /** Proposals applied since the previous version (empty for initial/manual). */
  proposals: VersionAttribution[];
  documentText: string;
  /** Word-count delta vs the previous version (insertions positive). */
  wordDelta: number;
  /** For kind 'restore': the version number that was restored. */
  restoredFrom?: number;
}

/** Metadata row shown in the panel (documentText omitted until viewed). */
export type DraftVersionMeta = Omit<DraftVersion, 'documentText'>;

export const MAX_VERSIONS_PER_SESSION = 50;

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable without a browser)
// ---------------------------------------------------------------------------

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function wordDelta(prevText: string | null, nextText: string): number {
  return countWords(nextText) - (prevText === null ? 0 : countWords(prevText));
}

/**
 * Given the existing metas (any order) and the cap, return the version
 * numbers to delete: oldest 'auto' versions first; never 'initial',
 * 'manual', or 'restore'. If protected versions alone exceed the cap,
 * nothing beyond the auto versions is pruned (history is precious).
 */
export function planPrune(metas: Array<Pick<DraftVersionMeta, 'version' | 'kind'>>, cap = MAX_VERSIONS_PER_SESSION): number[] {
  if (metas.length <= cap) return [];
  const excess = metas.length - cap;
  return [...metas]
    .filter((m) => m.kind === 'auto')
    .sort((a, b) => a.version - b.version)
    .slice(0, excess)
    .map((m) => m.version);
}

export function nextVersionNumber(metas: Array<Pick<DraftVersionMeta, 'version'>>): number {
  return metas.reduce((mx, m) => Math.max(mx, m.version), 0) + 1;
}

// ---------------------------------------------------------------------------
// IndexedDB plumbing
// ---------------------------------------------------------------------------

const DB_NAME = 'v2-draft-versions';
const STORE = 'versions';

function recordKey(sessionId: string, version: number): string {
  return `${sessionId}:${String(version).padStart(6, '0')}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('draftVersionStore: IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('draftVersionStore: open failed'));
  });
}

function idbGetRange(db: IDBDatabase, sessionId: string): Promise<Array<{ key: string; value: string }>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const range = IDBKeyRange.bound(`${sessionId}:`, `${sessionId}:￿`);
    const req = tx.objectStore(STORE).openCursor(range);
    const out: Array<{ key: string; value: string }> = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push({ key: String(cursor.key), value: cursor.value as string });
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error ?? new Error('draftVersionStore: cursor failed'));
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('draftVersionStore: put failed'));
  });
}

function idbDelete(db: IDBDatabase, keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    for (const k of keys) tx.objectStore(STORE).delete(k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('draftVersionStore: delete failed'));
  });
}

async function readAll(sessionId: string): Promise<DraftVersion[]> {
  const db = await openDb();
  try {
    const rows = await idbGetRange(db, sessionId);
    const out: DraftVersion[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(await decryptWorkspace(row.value)) as DraftVersion;
        if (parsed && typeof parsed.version === 'number' && typeof parsed.documentText === 'string') {
          out.push(parsed);
        }
      } catch {
        // Undecryptable/corrupt version: skip rather than fail the chain.
      }
    }
    return out.sort((a, b) => a.version - b.version);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AppendVersionInput {
  session_id: string;
  kind: DraftVersionKind;
  documentText: string;
  proposals?: VersionAttribution[];
  label?: string;
  restoredFrom?: number;
}

/** Append a version to the session's chain. Auto/initial cuts skip (return
 *  null) when the text is identical to the latest version — no empty
 *  versions. Explicit user actions ('manual', 'restore') always append, so
 *  every deliberate checkpoint/restore is visible in the history. */
export async function appendVersion(input: AppendVersionInput): Promise<DraftVersion | null> {
  const existing = await readAll(input.session_id);
  const latest = existing[existing.length - 1] ?? null;
  const explicitAction = input.kind === 'manual' || input.kind === 'restore';
  if (latest && latest.documentText === input.documentText && !explicitAction) {
    return null;
  }
  const v: DraftVersion = {
    session_id: input.session_id,
    version: nextVersionNumber(existing),
    savedAt: new Date().toISOString(),
    kind: input.kind,
    label: input.label,
    proposals: input.proposals ?? [],
    documentText: input.documentText,
    wordDelta: wordDelta(latest ? latest.documentText : null, input.documentText),
    restoredFrom: input.restoredFrom,
  };
  const db = await openDb();
  try {
    await idbPut(db, recordKey(v.session_id, v.version), await encryptWorkspace(JSON.stringify(v)));
    const pruneNums = planPrune([...existing.map((m) => ({ version: m.version, kind: m.kind })), { version: v.version, kind: v.kind }]);
    await idbDelete(db, pruneNums.map((n) => recordKey(v.session_id, n)));
  } finally {
    db.close();
  }
  return v;
}

/** All version metadata for a session, newest first (no document bodies). */
export async function listVersions(sessionId: string): Promise<DraftVersionMeta[]> {
  const all = await readAll(sessionId);
  return all
    .map(({ documentText: _omit, ...meta }) => meta)
    .sort((a, b) => b.version - a.version);
}

/** Load one full version (with document body). */
export async function loadVersion(sessionId: string, version: number): Promise<DraftVersion | null> {
  const all = await readAll(sessionId);
  return all.find((v) => v.version === version) ?? null;
}

/** Remove the entire chain for a session (called when a draft is deleted). */
export async function deleteVersionsForSession(sessionId: string): Promise<void> {
  const db = await openDb();
  try {
    const rows = await idbGetRange(db, sessionId);
    await idbDelete(db, rows.map((r) => r.key));
  } finally {
    db.close();
  }
}
