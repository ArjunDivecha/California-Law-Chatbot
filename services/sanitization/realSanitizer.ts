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

import type { ChatSanitizer } from './chatAdapter.js';
import {
  findUnknownTokens,
  rehydrate,
  tokenize,
  tokenizeWithSpans,
} from '../../api/_shared/sanitization/tokenize.js';
import type { SanitizationStore } from '../../api/_shared/sanitization/store.js';
import { detectPii } from './detectionPipeline.js';

const DEFAULT_TITLE_MAX = 60;

function sliceWithEllipsis(text: string, maxLen: number): string {
  const trimmed = text.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
   *
   * Default path uses the heuristic detector — kept for legacy callers
   * (chat persistence, title derivation) where we can be slightly less
   * thorough since the data never leaves the device.
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
   * Persistence-only tokenize: applies ONLY the existing token-store
   * mappings via word-bounded substring match. Does NOT run OPF, the
   * heuristic detector, or the regex pattern pass — so bot-response
   * text never adds new tokens to the store.
   *
   * Use case: chat persistence. User input has already been tokenized
   * pre-send via tokenizeMessageWithDetection. When saving the entire
   * thread (user + bot messages), we want bot text re-tokenized so
   * stored chat history doesn't carry rehydrated client names. But
   * the bot's natural language often contains capitalized phrases
   * ("What You Need", "Confidentiality Warning") that the detector
   * mistakes for client names — adding junk entries to the store.
   *
   * This method is the safe path: only known entities (already in the
   * store from the user's input) get re-tokenized in bot text. New
   * model-generated phrases pass through untouched.
   */
  async tokenizeForSaveStoreOnly(text: string): Promise<string> {
    if (!text || typeof text !== 'string') return text ?? '';
    if (this.tokenMap.size === 0) return text;
    // Iterate longest raw first so multi-word names match before any
    // single-word substring inside them.
    const entries = Array.from(this.tokenMap.entries()).sort(
      ([, a], [, b]) => b.length - a.length
    );
    let out = text;
    for (const [token, raw] of entries) {
      if (!raw || raw.length < 2) continue;
      const re = new RegExp(`\\b${escapeRegex(raw)}\\b`, 'gi');
      out = out.replace(re, token);
    }
    return out;
  }

  /**
   * Tokenize using the OPF-driven detection pipeline (best-effort:
   * falls back to the heuristic detector if the daemon is unreachable,
   * with the `usedOpf` flag indicating which detector ran).
   *
   * Returns metadata so the caller can decide whether to flag the
   * message as having degraded sanitization. Used by the wire path
   * (useChat.sendMessage) and any other feature that needs the
   * highest-quality detection plus visibility into the method used.
   */
  async tokenizeMessageWithDetection(text: string): Promise<{
    sanitized: string;
    usedOpf: boolean;
    opfElapsedMs: number | null;
  }> {
    if (!text || typeof text !== 'string') {
      return { sanitized: text ?? '', usedOpf: false, opfElapsedMs: null };
    }
    const detection = await detectPii(text, 'best-effort');
    const { sanitized, tokenMap } = await tokenizeWithSpans(text, this.store, detection.spans);
    for (const [token, raw] of tokenMap) {
      this.tokenMap.set(token, raw);
    }
    return {
      sanitized,
      usedOpf: detection.usedOpf,
      opfElapsedMs: detection.opfElapsedMs,
    };
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
   * Replace the in-memory rehydrate cache with a fresh snapshot from the
   * store. Used after the UI mutates the store directly (manual entity
   * add/remove from the token-store viewer) so subsequent rehydrates see
   * the new entries.
   */
  replaceMap(next: Map<string, string>): void {
    this.tokenMap.clear();
    for (const [token, raw] of next) {
      this.tokenMap.set(token, raw);
    }
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
