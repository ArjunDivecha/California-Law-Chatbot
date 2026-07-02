/**
 * User-editable allowlist — terms the attorney has explicitly marked
 * "always send raw, do not tokenize."
 *
 * Distinct from the static legal allowlist in
 * api/_shared/sanitization/allowlist.ts (which holds canonical statute
 * citations, case captions, agency names, etc., baked into the build).
 * This module is the per-device, user-managed version.
 *
 * Examples of what an attorney would put here:
 *   - Public city names that OPF flags as PRIVATE_ADDRESS components ("Berkeley")
 *   - Common first names that aren't actually clients ("John" used as an example)
 *   - Their own firm name if OPF tagged it as PRIVATE_PERSON
 *
 * Storage: localStorage. Not encrypted — entries are things the user
 * explicitly chose to leak; they're not client identifiers. Per-device.
 *
 * Matching: case-insensitive exact text match against the span's raw
 * text. Word-boundary semantics for substring matches are handled at
 * the consumer layer (detectionPipeline) by checking whole spans, not
 * partial text.
 */

const STORAGE_KEY = 'cla-user-allowlist';

function readRaw(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRaw(list: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Notify same-tab listeners (storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent('cla-user-allowlist-changed'));
  } catch {
    /* quota or disabled storage — silently no-op */
  }
}

export function getUserAllowlist(): string[] {
  return readRaw();
}

/** Returns lowercased entries for fast case-insensitive lookup. */
export function getUserAllowlistLower(): Set<string> {
  const set = new Set<string>();
  for (const entry of readRaw()) set.add(entry.toLowerCase());
  return set;
}

export function isUserAllowlisted(text: string): boolean {
  if (!text) return false;
  return getUserAllowlistLower().has(text.toLowerCase());
}

/**
 * Add a term. Trims, dedupes case-insensitively, returns the canonical
 * form actually stored (may differ from input if a duplicate already
 * exists in different casing — first-write wins for display purposes).
 */
export function addToUserAllowlist(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const list = readRaw();
  const lower = trimmed.toLowerCase();
  const existing = list.find((e) => e.toLowerCase() === lower);
  if (existing) return existing;
  list.push(trimmed);
  writeRaw(list);
  return trimmed;
}

export function removeFromUserAllowlist(text: string): boolean {
  const lower = text.toLowerCase();
  const list = readRaw();
  const next = list.filter((e) => e.toLowerCase() !== lower);
  if (next.length === list.length) return false;
  writeRaw(next);
  return true;
}

/**
 * Subscribe to allowlist changes. Returns an unsubscribe function.
 * Fires for both same-tab edits (CustomEvent) and cross-tab edits
 * (StorageEvent).
 */
export function subscribeToUserAllowlist(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onSame = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler();
  };
  window.addEventListener('cla-user-allowlist-changed', onSame as EventListener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('cla-user-allowlist-changed', onSame as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}
