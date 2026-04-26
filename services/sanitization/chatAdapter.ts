/**
 * ChatSanitizer adapter — the client-side seam between chat persistence
 * and the Phase 6 tokenizer.
 *
 * Today the default implementation is a **pass-through**: messages save
 * and load unchanged, titles slice as they always have. This preserves
 * current behavior while providing a single injection point that Day 7
 * (the passphrase unlock flow) can swap for a real implementation that
 * tokenizes on save, rehydrates on load, and derives sanitized titles.
 *
 * Once the real sanitizer is installed via `setChatSanitizer`, every
 * chat save and every chat reopen runs through it. Messages hit Upstash
 * Redis + Vercel Blob as tokens only.
 */

import type { ChatMessage } from '../../types';
import { scanForRawPII } from '../../api/_shared/sanitization/guard.js';

const DEFAULT_TITLE_MAX = 60;

export interface ChatSanitizer {
  /** Convert raw text (what the attorney sees) into tokenized text for the wire. */
  tokenizeMessage(text: string): Promise<string>;
  /** Convert tokenized text back to real names for display. */
  rehydrateMessage(text: string): string;
  /** Derive a sidebar title from a raw first user message. Must be token-safe. */
  deriveSafeTitle(text: string, maxLen?: number): Promise<string>;
  /**
   * Return any TOKEN_NNN references in `text` that are NOT present in the
   * sanitizer's local map — indicators of model-invented entities. The UI
   * should warn when this returns non-empty. Pass-through sanitizer returns
   * an empty array (no map = nothing to invent against).
   */
  findInventedTokens?(text: string): string[];
  /**
   * OPF-aware tokenize. Returns the tokenized text plus a flag indicating
   * whether the OPF daemon actually ran (false = heuristic fallback was
   * used, which the UI should surface to the attorney). Optional: legacy
   * sanitizers (pass-through) can skip this and callers fall back to
   * plain tokenizeMessage.
   */
  tokenizeMessageWithDetection?(text: string): Promise<{
    sanitized: string;
    usedOpf: boolean;
    opfElapsedMs: number | null;
  }>;
}

// ---------------------------------------------------------------------------
// Default pass-through implementation
// ---------------------------------------------------------------------------

function sliceWithEllipsis(text: string, maxLen: number): string {
  return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
}

export const passthroughSanitizer: ChatSanitizer = {
  async tokenizeMessage(text: string): Promise<string> {
    return text;
  },
  rehydrateMessage(text: string): string {
    return text;
  },
  async deriveSafeTitle(text: string, maxLen = DEFAULT_TITLE_MAX): Promise<string> {
    return sliceWithEllipsis(text.trim(), maxLen);
  },
  findInventedTokens(): string[] {
    return [];
  },
};

// ---------------------------------------------------------------------------
// Singleton holder — set from the React passphrase-unlock layer in Day 7
// ---------------------------------------------------------------------------

let activeSanitizer: ChatSanitizer = passthroughSanitizer;

export function getChatSanitizer(): ChatSanitizer {
  return activeSanitizer;
}

export function setChatSanitizer(sanitizer: ChatSanitizer | null): void {
  activeSanitizer = sanitizer ?? passthroughSanitizer;
}

// ---------------------------------------------------------------------------
// Helpers used by useChat
// ---------------------------------------------------------------------------

/**
 * OPF-driven tokenize for the wire path. Falls back to plain
 * tokenizeMessage when the active sanitizer doesn't support
 * tokenizeMessageWithDetection (the pass-through sanitizer that runs
 * before the SanitizerProvider has initialized).
 */
export async function tokenizeForWire(text: string): Promise<{
  sanitized: string;
  usedOpf: boolean;
  opfElapsedMs: number | null;
}> {
  const sanitizer = getChatSanitizer();
  if (typeof sanitizer.tokenizeMessageWithDetection === 'function') {
    return sanitizer.tokenizeMessageWithDetection(text);
  }
  // Pass-through sanitizer (or anything without OPF support): no
  // tokenization, no OPF, but flagged so the UI can surface that the
  // detector wasn't running.
  const sanitized = await sanitizer.tokenizeMessage(text);
  return { sanitized, usedOpf: false, opfElapsedMs: null };
}

/**
 * Map every ChatMessage through the sanitizer's tokenizeMessage.
 * Preserves every other field.
 */
export async function tokenizeMessagesForSave(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const sanitizer = getChatSanitizer();
  const out: ChatMessage[] = [];
  for (const m of messages) {
    out.push({ ...m, text: await sanitizer.tokenizeMessage(m.text) });
  }
  return out;
}

/**
 * Rehydrate every tokenized ChatMessage for display.
 * Synchronous — rehydrate is fast and must not block React render.
 */
export function rehydrateMessagesForDisplay(messages: ChatMessage[]): ChatMessage[] {
  const sanitizer = getChatSanitizer();
  return messages.map((m) => ({ ...m, text: sanitizer.rehydrateMessage(m.text) }));
}

/**
 * Find TOKEN_NNN patterns in the rehydrated text that are not in the
 * active sanitizer's token map. Empty array when the active sanitizer
 * is the pass-through or when the text references no tokens.
 */
export function findInventedTokensInText(text: string): string[] {
  if (!text) return [];
  const sanitizer = getChatSanitizer();
  return typeof sanitizer.findInventedTokens === 'function'
    ? sanitizer.findInventedTokens(text)
    : [];
}

/**
 * Build a token-safe title from a raw first user-message text.
 */
export async function deriveTitleFromRaw(
  rawText: string,
  maxLen: number = DEFAULT_TITLE_MAX
): Promise<string> {
  return getChatSanitizer().deriveSafeTitle(rawText, maxLen);
}

// ---------------------------------------------------------------------------
// Pre-save PII scan (Day 6.5)
// ---------------------------------------------------------------------------

export interface PresaveScanResult {
  clean: boolean;
  /** Unique triggered categories, sorted. Never includes matched text. */
  categories: string[];
  /** Which message indexes had a hit (title = -1). */
  dirtyIndexes: number[];
}

/**
 * Client-side mirror of the /api/chats server backstop. Scans the
 * already-tokenized payload for raw-PII-shaped content one more time
 * before the HTTP round-trip. Fails fast locally so the attorney gets
 * an immediate warning instead of waiting for a 400.
 *
 * Returns a structured result. Callers decide whether to block or warn.
 */
export function presavePiiScan(args: {
  title?: string;
  messages?: Array<{ text?: string }>;
}): PresaveScanResult {
  const cats = new Set<string>();
  const dirty: number[] = [];

  if (typeof args.title === 'string') {
    const r = scanForRawPII(args.title);
    if ('categories' in r) {
      for (const c of r.categories) cats.add(c);
      dirty.push(-1);
    }
  }
  if (Array.isArray(args.messages)) {
    args.messages.forEach((m, idx) => {
      const text = m?.text;
      if (typeof text !== 'string') return;
      const r = scanForRawPII(text);
      if ('categories' in r) {
        for (const c of r.categories) cats.add(c);
        dirty.push(idx);
      }
    });
  }

  return {
    clean: cats.size === 0,
    categories: Array.from(cats).sort(),
    dirtyIndexes: dirty,
  };
}
