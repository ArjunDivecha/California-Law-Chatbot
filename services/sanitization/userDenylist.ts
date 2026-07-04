/**
 * =============================================================================
 * FILE: userDenylist.ts (services/sanitization)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   The persistent "always privileged" list — the mirror image of
 *   userAllowlist.ts. Terms the attorney has explicitly marked "this IS
 *   privileged — always redact it", e.g. a client name the ML detector
 *   keeps missing. Every term here is force-detected as a `name` span in
 *   both the live preview and the wire (send) path, so it always
 *   tokenizes to CLIENT_xxx before leaving the device.
 *
 *   Adding a term here automatically removes it from the user allowlist
 *   (a term cannot be both "always send raw" and "always redact").
 *   The reverse direction (allowlist add → denylist remove) is handled
 *   at the UI layer to avoid a circular import.
 *
 * STORAGE:
 *   Browser localStorage, key `cla-user-denylist`. Per-device, survives
 *   sessions. Not encrypted — but unlike the allowlist these ARE
 *   potentially client identifiers, so the list never leaves the device:
 *   it is only used to ADD detections client-side and is never forwarded
 *   to the server (the server only ever sees the resulting tokens).
 *
 * INPUT FILES:  none (localStorage only).
 * OUTPUT FILES: none (localStorage only).
 * =============================================================================
 */

import type { Span } from '../../api/_shared/sanitization/index.js';
import { removeFromUserAllowlist } from './userAllowlist.js';

const STORAGE_KEY = 'cla-user-denylist';

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
    window.dispatchEvent(new CustomEvent('cla-user-denylist-changed'));
  } catch {
    /* quota or disabled storage — silently no-op */
  }
}

export function getUserDenylist(): string[] {
  return readRaw();
}

export function isUserDenylisted(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return readRaw().some((e) => e.toLowerCase() === lower);
}

/**
 * Add a term. Trims, dedupes case-insensitively. Also removes the term
 * from the user ALLOWLIST — the attorney's newest instruction wins.
 */
export function addToUserDenylist(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  removeFromUserAllowlist(trimmed);
  const list = readRaw();
  const lower = trimmed.toLowerCase();
  const existing = list.find((e) => e.toLowerCase() === lower);
  if (existing) return existing;
  list.push(trimmed);
  writeRaw(list);
  return trimmed;
}

export function removeFromUserDenylist(text: string): boolean {
  const lower = text.toLowerCase();
  const list = readRaw();
  const next = list.filter((e) => e.toLowerCase() !== lower);
  if (next.length === list.length) return false;
  writeRaw(next);
  return true;
}

/**
 * Subscribe to denylist changes. Returns an unsubscribe function.
 * Fires for both same-tab edits (CustomEvent) and cross-tab edits
 * (StorageEvent).
 */
export function subscribeToUserDenylist(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onSame = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler();
  };
  window.addEventListener('cla-user-denylist-changed', onSame as EventListener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('cla-user-denylist-changed', onSame as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Find every occurrence of every denylisted term in `text` and return
 * them as `name` spans (label 'user-denylist') so the tokenizer treats
 * them exactly like detected client names. Case-insensitive, word-
 * boundary matching so marking "Ann" privileged doesn't hit "Annual".
 */
export function findUserDenylistSpans(text: string): Span[] {
  if (!text) return [];
  const out: Span[] = [];
  for (const term of readRaw()) {
    const esc = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!esc) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        category: 'name',
        raw: m[0],
        label: 'user-denylist',
      });
    }
  }
  return out;
}
