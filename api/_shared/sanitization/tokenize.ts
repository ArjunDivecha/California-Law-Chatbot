/**
 * Tokenize + Rehydrate
 *
 * `tokenize(prompt, store)` walks the analyzer spans and substitutes each
 * one with a stable token from the encrypted store. The result is the
 * string that's safe to send over the wire, plus a per-request map the
 * caller can keep in memory to rehydrate responses.
 *
 * `rehydrate(text, map)` does the reverse. It's synchronous because it
 * only touches the in-memory token map — never the IndexedDB store.
 * That keeps response rendering fast and off the encryption critical
 * path.
 *
 * Pure functions over the Day 1 analyzer and Day 2 store. Callable from
 * either the browser or the Vercel server backstop (the backstop runs
 * analyze only — it never needs to tokenize, since it's auditing an
 * already-tokenized payload).
 */

import { analyze, type Span } from './index.js';
import type { SanitizationStore } from './store.js';

export interface TokenizeResult {
  sanitized: string;
  /** Token.value → raw, for only the entities that appeared in this prompt. */
  tokenMap: Map<string, string>;
  /** Audit metadata — which categories were tokenized and how many of each. */
  tokenCategoryCounts: Record<string, number>;
}

export async function tokenize(
  prompt: string,
  store: SanitizationStore
): Promise<TokenizeResult> {
  const { spans } = analyze(prompt);
  return tokenizeWithSpans(prompt, store, spans);
}

/**
 * Apply pre-computed spans (from any detector — heuristic, OPF, or a
 * combination) to `prompt`, producing the wire-safe sanitized text plus
 * the per-request rehydrate map. Used by the OPF-driven path so the
 * detection happens upstream and this function only does the
 * substitution + persistent-store reconciliation.
 *
 * The spans are expected to be merged + non-overlapping + sorted by
 * start (the same shape `analyze()` produces). No re-merging here.
 */
export async function tokenizeWithSpans(
  prompt: string,
  store: SanitizationStore,
  spans: Span[]
): Promise<TokenizeResult> {
  const tokenMap = new Map<string, string>();
  const tokenCategoryCounts: Record<string, number> = {};

  let cursor = 0;
  const parts: string[] = [];
  for (const span of spans) {
    parts.push(prompt.slice(cursor, span.start));
    // assignToken returns the existing token if this entity was already
    // seen (same category, same lowercased raw) — so "Maria Esperanza" in
    // turn 5 of a chat gets the same CLIENT_001 she got in turn 1.
    const token = await store.assignToken(span.raw, span.category);
    parts.push(token.value);
    tokenMap.set(token.value, span.raw);
    tokenCategoryCounts[span.category] =
      (tokenCategoryCounts[span.category] ?? 0) + 1;
    cursor = span.end;
  }
  parts.push(prompt.slice(cursor));
  let sanitized = parts.join('');

  // Second pass — apply any entries already in the persistent store that
  // the analyzer missed for this turn. Without this, adding "James Donde"
  // in the token-store viewer would have no effect on a lowercase
  // "james donde" in chat (the detector wouldn't fire). Iterate from
  // longest raw to shortest so multi-word names match before any
  // single-word substring inside them. Case-insensitive substring match
  // with word boundaries — same shape as the rehydrate side.
  //
  // Skip single-word entries that are common stop words. These can end
  // up in the store via accidental quick-add or older buggy paths, and
  // applying them would tokenize every "the", "a", "for" etc. in chat.
  const fullMap = await store.rehydrateMap();
  const manualEntries = Array.from(fullMap.entries())
    .filter(([token]) => !tokenMap.has(token))
    .sort(([, a], [, b]) => b.length - a.length);
  for (const [token, raw] of manualEntries) {
    if (!raw) continue;
    if (isCommonStopWord(raw)) continue;
    const re = new RegExp(`\\b${escapeRegex(raw)}\\b`, 'gi');
    if (!re.test(sanitized)) continue;
    sanitized = sanitized.replace(re, token);
    tokenMap.set(token, raw);
    const inferred = inferCategoryFromToken(token);
    tokenCategoryCounts[inferred] =
      (tokenCategoryCounts[inferred] ?? 0) + 1;
  }

  return {
    sanitized,
    tokenMap,
    tokenCategoryCounts,
  };
}

/**
 * Tokens whose `raw` mapping is a single common stop word are
 * defensively skipped during the manual-store substring pass. They
 * would otherwise tokenize every occurrence of "the", "a", "for"
 * etc. in chat — corrupting both the wire payload and the rehydrate
 * round-trip. Single-word raws only; multi-word entries containing a
 * stop word ("for James Donde") are still applied normally.
 */
const COMMON_STOP_WORDS = new Set<string>([
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'their', 'our', 'its',
  'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'and', 'or', 'but', 'so', 'if', 'then',
  'of', 'at', 'for', 'with', 'to', 'by', 'from',
  'on', 'in', 'about', 'as', 'into', 'over', 'under',
  'no', 'yes', 'not',
  'whats', "what's", 'who', 'when', 'where', 'why', 'how',
  'will', 'would', 'should', 'could', 'can', 'may', 'might',
]);

export function isCommonStopWord(raw: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed)) return false; // multi-word entries are fine
  return COMMON_STOP_WORDS.has(trimmed.toLowerCase());
}

function inferCategoryFromToken(token: string): string {
  const prefix = token.split('_')[0];
  switch (prefix) {
    case 'CLIENT': return 'name';
    case 'ADDRESS': return 'street_address';
    case 'PHONE': return 'phone';
    case 'EMAIL': return 'email';
    case 'DATE': return 'date';
    case 'SSN': return 'ssn';
    case 'TIN': return 'tin';
    case 'LICENSE': return 'driver_license';
    case 'CARD': return 'credit_card';
    case 'ACCT': return 'bank_account';
    case 'MRN': return 'medical_record';
    case 'MATTER': return 'client_matter';
    case 'ZIP': return 'zip';
    default: return 'name';
  }
}

// ---------------------------------------------------------------------------
// Rehydrate
// ---------------------------------------------------------------------------

/**
 * Replace every token in `text` with its raw value from `tokenMap`.
 *
 * Tokens not present in the map are left in place — callers can grep
 * afterwards to decide whether to warn the attorney that the model
 * mentioned an entity that wasn't in their original prompt (a sign of
 * model hallucination).
 *
 * The replacement uses word boundaries so `CLIENT_10` does not match
 * the prefix of `CLIENT_100`. Longest token values are applied first as
 * an extra safety net.
 */
export function rehydrate(text: string, tokenMap: Map<string, string>): string {
  if (!text || tokenMap.size === 0) return text;

  const entries = Array.from(tokenMap.entries()).sort(
    ([a], [b]) => b.length - a.length
  );

  let out = text;
  for (const [token, raw] of entries) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'g');
    out = out.replace(re, raw);
  }
  return out;
}

/**
 * Return the set of TOKEN_NNN-shaped substrings in `text` that are NOT in
 * `tokenMap`. Used by the UI to flag model-invented entities. Matches the
 * same prefix set as the store assigner.
 */
export function findUnknownTokens(
  text: string,
  tokenMap: Map<string, string>
): string[] {
  const pattern = /\b(CLIENT|ADDRESS|DATE|PHONE|SSN|TIN|CARD|ACCT|LICENSE|MRN|MATTER|EMAIL|ZIP)_\d{3,}\b/g;
  const unknown = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (!tokenMap.has(m[0])) unknown.add(m[0]);
  }
  return Array.from(unknown);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
