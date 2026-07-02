/**
 * scrubError — server-side error sanitization for V2.
 *
 * Per the V1→V2 audit 2026-05-14 (Phase B.2): even after browser-side
 * tokenization (Option C), a server-side exception that happens to
 * include the request body in its message would re-leak raw PII into
 * Vercel logs or the response payload. This helper strips HIGH_RISK
 * regex matches from any string before it's logged or returned.
 *
 * Two entry points:
 *   - scrubMessage(s)  →  string with HIGH_RISK spans replaced by
 *                          [redacted:<category>] markers.
 *   - scrubError(err)  →  Error with sanitized .message and a
 *                          sanitized .stack (best-effort).
 *
 * Performance: runs `runPatterns()` (deterministic regex, ~milliseconds
 * on a few-KB string). Safe to call from any error path.
 *
 * What this does NOT catch:
 *   - Single-word names ("Liu"), per Option C the server doesn't have
 *     the heuristic name detector, so the only way a name leaks here
 *     is if the browser tokenization is broken upstream (which the
 *     proxy backstop already rejects).
 *   - Allowlist-eligible terms (statute citations) — we don't suppress
 *     by allowlist here because the goal is conservative scrubbing of
 *     error text, not document classification.
 */

import { runPatterns } from '../_shared/sanitization/patterns.js';
import { HIGH_RISK_CATEGORIES } from '../_shared/sanitization/index.js';

export function scrubMessage(s: unknown): string {
  if (s == null) return '';
  const text = typeof s === 'string' ? s : String(s);
  if (!text) return '';
  let scrubbed = text;
  try {
    const matches = runPatterns(text)
      .filter((m) => HIGH_RISK_CATEGORIES.has(m.category))
      .sort((a, b) => b.start - a.start); // reverse so indices don't shift
    for (const m of matches) {
      scrubbed =
        scrubbed.slice(0, m.start) +
        `[redacted:${m.category}]` +
        scrubbed.slice(m.end);
    }
  } catch {
    // If pattern matching itself errored, fall back to a coarse replace
    // of common formats. Failing open here would defeat the purpose.
    scrubbed = scrubbed
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted:ssn]')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[redacted:email]')
      .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[redacted:phone]');
  }
  return scrubbed;
}

export function scrubError(err: unknown): Error {
  if (err instanceof Error) {
    const out = new Error(scrubMessage(err.message));
    out.name = err.name;
    if (err.stack) {
      try {
        out.stack = scrubMessage(err.stack);
      } catch {
        out.stack = err.stack;
      }
    }
    // Preserve common Error fields if present (e.g., RawInputDetectedError).
    for (const k of Object.keys(err)) {
      try {
        (out as unknown as Record<string, unknown>)[k] = (err as unknown as Record<string, unknown>)[k];
      } catch {
        // ignore non-assignable keys
      }
    }
    return out;
  }
  return new Error(scrubMessage(err));
}
