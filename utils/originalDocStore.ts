/**
 * utils/originalDocStore.ts
 *
 * Device-local IndexedDB store for the ORIGINAL bytes of a document loaded
 * into the Draft page (2026-08-17). Added because the original .docx was
 * held only in a React ref: quitting the app (or reloading the tab) and
 * restoring the draft session lost the bytes, so Save-to-Box/Export silently
 * fell back to a regenerated document and destroyed the firm's formatting.
 *
 * Keyed by draft session id. Bytes never leave the device — same trust
 * model as the version store (v2-draft-versions).
 *
 * No file I/O beyond the browser's IndexedDB.
 */

const DB_NAME = 'v2-draft-originals';
const STORE = 'originals';

export interface StoredOriginalDoc {
  name: string;
  bytes: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

export async function saveOriginalDoc(sessionId: string, doc: StoredOriginalDoc): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(doc, sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('put failed'));
  });
  db.close();
}

export async function loadOriginalDoc(sessionId: string): Promise<StoredOriginalDoc | null> {
  const db = await openDb();
  const out = await new Promise<StoredOriginalDoc | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(sessionId);
    req.onsuccess = () => resolve((req.result as StoredOriginalDoc | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('get failed'));
  });
  db.close();
  return out;
}

export async function deleteOriginalDoc(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
  });
  db.close();
}
