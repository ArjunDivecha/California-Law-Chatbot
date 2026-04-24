/**
 * Server-side Sanitization Backstop
 *
 * Re-runs the deterministic PII patterns from patterns.ts on every
 * incoming request's text content. If any match, the request is rejected
 * with a structured 400 before it reaches retrieval or Bedrock.
 *
 * This is intentionally *narrower* than the client-side analyzer. The
 * browser runs patterns + names + allowlist + attorney-in-the-loop. The
 * server re-runs only the deterministic pattern set — "this looks exactly
 * like an SSN, phone, address, DOB, credit-card, etc." No name detection,
 * no capitalized-bigram heuristics. We want zero false positives on
 * already-sanitized text, but hard rejection when the client-side
 * sanitizer has clearly missed something structured.
 *
 * Intended call site: every /api/* route that accepts attorney prompt text.
 * Call after the flow-policy guard, before any retrieval or model call.
 * The error body never includes the matched text — only the category
 * names — so the audit log stays free of raw PII.
 */

import { runPatterns, type PatternMatch } from './patterns.ts';

export interface BackstopAccept {
  ok: true;
}

export interface BackstopReject {
  ok: false;
  /** Unique category names that triggered. Never includes the raw text. */
  categories: string[];
  /** Human-readable caveat for the chat UI to show the attorney. */
  message: string;
}

export type BackstopResult = BackstopAccept | BackstopReject;

/**
 * Scan a single string. Returns ok or a structured rejection.
 */
export function scanForRawPII(text: unknown): BackstopResult {
  if (typeof text !== 'string' || text.length === 0) return { ok: true };

  const matches: PatternMatch[] = runPatterns(text);
  if (matches.length === 0) return { ok: true };

  const categories = Array.from(new Set(matches.map((m) => m.category))).sort();
  return {
    ok: false,
    categories,
    message: `The request contains content that looks like raw personal data (${categories.join(
      ', '
    )}). Client-side sanitization did not catch it. Please re-sanitize in your browser before resubmitting.`,
  };
}

/**
 * Scan an array of conversation-history entries. Each entry is scanned for
 * PII; any hit short-circuits. Entries with a non-string `text` field are
 * skipped safely.
 */
export function scanConversationHistory(
  history: unknown
): BackstopResult {
  if (!Array.isArray(history)) return { ok: true };
  for (const entry of history) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = (entry as { text?: unknown; content?: unknown }).text ??
      (entry as { content?: unknown }).content;
    const result = scanForRawPII(raw);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Run both the primary-text scan and the history scan. Merges categories
 * so the caller sees every hit.
 */
export function scanRequest(primaryText: unknown, history?: unknown): BackstopResult {
  const primary = scanForRawPII(primaryText);
  const histResult = history !== undefined ? scanConversationHistory(history) : { ok: true as const };

  if (primary.ok && histResult.ok) return { ok: true };

  const cats = new Set<string>();
  if (!primary.ok) for (const c of primary.categories) cats.add(c);
  if (!histResult.ok) for (const c of histResult.categories) cats.add(c);
  const categories = Array.from(cats).sort();

  return {
    ok: false,
    categories,
    message: `The request contains content that looks like raw personal data (${categories.join(
      ', '
    )}). Client-side sanitization did not catch it. Please re-sanitize in your browser before resubmitting.`,
  };
}

/**
 * Convenience: writes the 400 response for a rejection. Returns true if
 * the response was sent so the caller can return immediately.
 */
export function rejectWithBackstop(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  result: BackstopResult
): boolean {
  if (result.ok) return false;
  res.status(400).json({
    error: 'backstop_triggered',
    categories: result.categories,
    message: result.message,
  });
  return true;
}
