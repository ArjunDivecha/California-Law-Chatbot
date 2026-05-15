/**
 * Browser-side wire-guard — Phase B.3 / plan §S CI assertion.
 *
 * Belt-and-suspenders check immediately before fetch(). The browser
 * tokenization layer (`tokenizeForWire`) is the primary defense; this
 * helper runs a final deterministic-regex pass on the assembled
 * outbound payload and aborts the send if any HIGH_RISK pattern
 * survived.
 *
 * Why we need this in addition to tokenizeForWire():
 * - tokenizeForWire calls OPF + regex but may miss exotic forms.
 * - This helper runs only deterministic regex (SSN, credit card,
 *   phone, email, etc.) which catches anything OPF skipped.
 * - If the assert fires it means a known-tokenizable pattern made it
 *   to the wire — the right action is fail-closed, not silently send.
 *
 * Behavior:
 *   - assertNoRawPii(body) throws RawInputDetectedError when any
 *     HIGH_RISK pattern matches.
 *   - body can be a string OR any JSON-serializable object — we
 *     stringify before scanning.
 *
 * Performance: runPatterns() on a few-KB string is sub-millisecond.
 * Safe to run on every fetch.
 */

import { runPatterns } from '../../api/_shared/sanitization/patterns.js';
import { HIGH_RISK_CATEGORIES } from '../../api/_shared/sanitization/index.js';

export class WireGuardError extends Error {
  public readonly categories: string[];
  public readonly count: number;
  constructor(categories: string[], count: number) {
    super(
      `Wire-guard refused outbound request: ${count} raw PII match${count === 1 ? '' : 'es'} ` +
        `(${categories.join(', ')}) survived browser tokenization. ` +
        `Request blocked to prevent unprotected send.`,
    );
    this.name = 'WireGuardError';
    this.categories = categories;
    this.count = count;
  }
}

/**
 * Throws if the body contains raw HIGH_RISK PII. Call immediately
 * before fetch().
 *
 * @param body  String OR JSON-serializable object. Object will be
 *              stringified via JSON.stringify.
 */
export function assertNoRawPii(body: string | object): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (!text) return;
  const matches = runPatterns(text).filter((m) => HIGH_RISK_CATEGORIES.has(m.category));
  if (matches.length === 0) return;
  const cats = Array.from(new Set(matches.map((m) => m.category)));
  throw new WireGuardError(cats, matches.length);
}
