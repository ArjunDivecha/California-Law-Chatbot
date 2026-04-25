/**
 * RealChatSanitizer — production implementation of the ChatSanitizer
 * interface backed by the Day 2 encrypted persistent store and the Day
 * 3 tokenize/rehydrate pipeline.
 *
 * Constructed by the Day 7 passphrase-unlock flow after the attorney
 * unlocks the store. Day 4.5's chatAdapter singleton replaces its
 * pass-through default with an instance of this class via
 * setChatSanitizer(). The chat save/load path activates immediately.
 *
 * Caches the full token→raw map in memory so rehydrateMessage stays
 * synchronous and doesn't hit the IndexedDB decryption loop per token
 * replacement. The cache stays consistent because new entities flow
 * through tokenizeMessage, which updates the cache in lockstep with
 * the store.
 */

import type { ChatSanitizer } from './chatAdapter.ts';
import {
  findUnknownTokens,
  rehydrate,
  tokenize,
} from '../../api/_shared/sanitization/tokenize.ts';
import type { SanitizationStore } from '../../api/_shared/sanitization/store.ts';

const DEFAULT_TITLE_MAX = 60;

function sliceWithEllipsis(text: string, maxLen: number): string {
  const trimmed = text.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

export class RealChatSanitizer implements ChatSanitizer {
  private readonly store: SanitizationStore;
  private readonly tokenMap: Map<string, string>;

  constructor(store: SanitizationStore, initialMap: Map<string, string>) {
    this.store = store;
    this.tokenMap = new Map(initialMap);
  }

  /**
   * Tokenize outgoing text and merge any newly-allocated tokens into
   * the in-memory rehydrate cache so subsequent rehydrates see them.
   */
  async tokenizeMessage(text: string): Promise<string> {
    if (!text || typeof text !== 'string') return text ?? '';
    const { sanitized, tokenMap } = await tokenize(text, this.store);
    for (const [token, raw] of tokenMap) {
      this.tokenMap.set(token, raw);
    }
    return sanitized;
  }

  /**
   * Synchronous — uses the in-memory cache. Tokens not in the map are
   * left in place for the UI layer to flag as invented by the model.
   */
  rehydrateMessage(text: string): string {
    if (!text || typeof text !== 'string') return text ?? '';
    if (this.tokenMap.size === 0) return text;
    return rehydrate(text, this.tokenMap);
  }

  /**
   * Tokenize FIRST, then slice. Guarantees we never slice a name
   * mid-token in the sidebar title.
   */
  async deriveSafeTitle(text: string, maxLen: number = DEFAULT_TITLE_MAX): Promise<string> {
    const tokenized = await this.tokenizeMessage(text);
    return sliceWithEllipsis(tokenized, maxLen);
  }

  /** Expose the in-memory map (read-only copy) for UI token panels. */
  snapshotMap(): Map<string, string> {
    return new Map(this.tokenMap);
  }

  /**
   * Return any TOKEN_NNN references in `text` that are NOT in the cached
   * map — suggests the model made up a token that was not in the
   * original prompt. UI surfaces this as a visible warning.
   */
  findInventedTokens(text: string): string[] {
    if (!text) return [];
    return findUnknownTokens(text, this.tokenMap);
  }

  /** Drop a token from both the store and the cache. */
  async forgetEntity(tokenValue: string): Promise<void> {
    await this.store.forgetEntity(tokenValue);
    this.tokenMap.delete(tokenValue);
  }
}
