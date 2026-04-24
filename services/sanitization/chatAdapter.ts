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

const DEFAULT_TITLE_MAX = 60;

export interface ChatSanitizer {
  /** Convert raw text (what the attorney sees) into tokenized text for the wire. */
  tokenizeMessage(text: string): Promise<string>;
  /** Convert tokenized text back to real names for display. */
  rehydrateMessage(text: string): string;
  /** Derive a sidebar title from a raw first user message. Must be token-safe. */
  deriveSafeTitle(text: string, maxLen?: number): Promise<string>;
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
 * Build a token-safe title from a raw first user-message text.
 */
export async function deriveTitleFromRaw(
  rawText: string,
  maxLen: number = DEFAULT_TITLE_MAX
): Promise<string> {
  return getChatSanitizer().deriveSafeTitle(rawText, maxLen);
}
