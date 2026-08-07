/**
 * utils/draftSessionStore.ts
 *
 * Device-local persistence for the V2 Draft page (/v2/draft), added
 * 2026-08-07 after the page lost all state on any navigation. Follows the
 * Drafting Magic precedent (V2DraftingMagicPage + services/workspaceCrypto):
 * document text and edit history are AES-GCM encrypted at rest with a
 * device-local key and NEVER leave the device — deliberately NOT the cloud
 * sessionStore used by chat, so client documents don't sit in cloud KV.
 *
 * Storage layout (window.localStorage):
 *   v2-draft:index          — plaintext JSON array of {id,title,savedAt}
 *                             (titles may contain client names, so they are
 *                             truncated document-derived labels only)
 *   v2-draft:session:<id>   — encrypted DraftSessionSnapshot JSON
 *
 * Retention: newest MAX_SESSIONS (20) kept; older sessions pruned on save.
 *
 * No file I/O (browser localStorage only).
 */

import { encryptWorkspace, decryptWorkspace, isEncrypted } from '../services/workspaceCrypto.ts';

export interface DraftSessionTurnSnapshot {
  instruction: string;
  proposals: Array<{
    id: string;
    section: string;
    description: string;
    rationale: string;
    find: string;
    replace: string;
    status: 'pending' | 'applied' | 'rejected' | 'unmatched';
  }>;
  rawNote?: string;
}

export interface DraftSessionSnapshot {
  version: 1;
  id: string;
  savedAt: string;
  title: string;
  documentText: string;
  history: DraftSessionTurnSnapshot[];
  uploadedName: string | null;
}

export interface DraftSessionIndexEntry {
  id: string;
  title: string;
  savedAt: string;
}

const INDEX_KEY = 'v2-draft:index';
const SESSION_PREFIX = 'v2-draft:session:';
const MAX_SESSIONS = 20;

function readIndex(): DraftSessionIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is DraftSessionIndexEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.savedAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeIndex(entries: DraftSessionIndexEntry[]): void {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

/** Derive a short human-recognizable title. Prefers the uploaded filename,
 *  else the first non-empty line of the document, truncated. */
export function draftTitle(documentText: string, uploadedName: string | null): string {
  if (uploadedName) return uploadedName;
  const line = documentText
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line ?? 'Untitled draft').slice(0, 60);
}

export function listDraftSessions(): DraftSessionIndexEntry[] {
  return readIndex().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function saveDraftSession(snapshot: DraftSessionSnapshot): Promise<void> {
  const payload = await encryptWorkspace(JSON.stringify(snapshot));
  window.localStorage.setItem(SESSION_PREFIX + snapshot.id, payload);
  const rest = readIndex().filter((e) => e.id !== snapshot.id);
  const next = [{ id: snapshot.id, title: snapshot.title, savedAt: snapshot.savedAt }, ...rest]
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    .slice(0, MAX_SESSIONS);
  // Prune sessions that fell off the retention window.
  for (const e of rest) {
    if (!next.some((k) => k.id === e.id)) {
      window.localStorage.removeItem(SESSION_PREFIX + e.id);
    }
  }
  writeIndex(next);
}

export async function loadDraftSession(id: string): Promise<DraftSessionSnapshot | null> {
  try {
    const stored = window.localStorage.getItem(SESSION_PREFIX + id);
    if (!stored) return null;
    const raw = isEncrypted(stored) ? await decryptWorkspace(stored) : stored;
    const parsed = JSON.parse(raw) as DraftSessionSnapshot;
    if (parsed.version !== 1 || typeof parsed.documentText !== 'string') return null;
    if (!Array.isArray(parsed.history)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteDraftSession(id: string): void {
  window.localStorage.removeItem(SESSION_PREFIX + id);
  writeIndex(readIndex().filter((e) => e.id !== id));
}

/** Most recently saved session id, or null. */
export function latestDraftSessionId(): string | null {
  return listDraftSessions()[0]?.id ?? null;
}
