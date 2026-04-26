/**
 * Detection pipeline — single async entry point that any feature in the
 * app calls when it needs to know "what spans of this text are PII?"
 *
 * Combines:
 *   1. OPF daemon spans (preferred when daemon healthy — broad coverage,
 *      mixed-case names, lowercase, foreign names, addresses)
 *   2. Regex patterns from api/_shared/sanitization/patterns (always
 *      run — deterministic on SSN, credit-card, phone, email, ZIP
 *      formats; specializes the generic OPF account_number bucket)
 *   3. Allowlist suppression (statute citations, case names, agencies,
 *      etc., never tokenized)
 *
 * Two modes:
 *   - 'strict' (used by the wire path / outbound gate): if the OPF
 *     daemon is unreachable, throws OpfUnavailableError so the caller
 *     can fail-closed. Never silently degrades.
 *   - 'best-effort' (used by the live preview): if OPF is unreachable,
 *     falls back to the heuristic name detector so the user still
 *     sees an approximate preview while the banner shows OPF as down.
 *
 * The output shape is the same `AnalyzeResult` the synchronous
 * `analyze()` already produces, so downstream tokenize/rehydrate logic
 * is unchanged.
 */

import {
  analyze as analyzeHeuristic,
  type AnalyzeResult,
  type Span,
} from '../../api/_shared/sanitization/index.js';
import {
  findAllowlistMatches,
  overlapsAllowlist,
} from '../../api/_shared/sanitization/allowlist.js';
import { runPatterns } from '../../api/_shared/sanitization/patterns.js';
import { detectSpans, type DetectResult } from './opfClient.js';

export class OpfUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      `Sanitization service unavailable. ${
        cause instanceof Error ? cause.message : String(cause ?? '')
      }`.trim()
    );
    this.name = 'OpfUnavailableError';
  }
}

export type DetectionMode = 'strict' | 'best-effort';

export interface DetectionPipelineResult extends AnalyzeResult {
  /** True if OPF was actually used; false if we fell back to heuristics. */
  usedOpf: boolean;
  /** OPF round-trip ms when used; null when fell back. */
  opfElapsedMs: number | null;
}

/**
 * Mirror of mergeSpans from index.ts — duplicated here so this module
 * can be a single async wrapper without circular imports. Resolution
 * rule unchanged: when one span is `name` and the other is more
 * specific (regex pattern), the specific one wins.
 */
function mergeSpans(spans: Span[]): Span[] {
  if (spans.length <= 1) return [...spans];
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (!last || s.start >= last.end) {
      out.push(s);
      continue;
    }
    const lastIsName = last.category === 'name';
    const sIsName = s.category === 'name';
    if (lastIsName && !sIsName) {
      out[out.length - 1] = s;
      continue;
    }
    if (!lastIsName && sIsName) continue;
    const lastLen = last.end - last.start;
    const sLen = s.end - s.start;
    if (sLen > lastLen) out[out.length - 1] = s;
  }
  return out;
}

function patternSpans(text: string): Span[] {
  return runPatterns(text).map((m) => ({
    start: m.start,
    end: m.end,
    category: m.category,
    raw: m.raw,
    label: m.label,
  }));
}

/**
 * Run the full detection pipeline using OPF as the primary detector.
 *
 * @param text   The text to analyze.
 * @param mode   'strict' throws on OPF failure; 'best-effort' falls
 *               back to the heuristic detector.
 */
export async function detectPii(
  text: string,
  mode: DetectionMode = 'best-effort'
): Promise<DetectionPipelineResult> {
  if (!text || typeof text !== 'string') {
    return {
      spans: [],
      suppressedByAllowlist: 0,
      usedOpf: false,
      opfElapsedMs: null,
    };
  }

  const allowlist = findAllowlistMatches(text);
  const regexSpans = patternSpans(text);

  let opfResult: DetectResult | null = null;
  try {
    opfResult = await detectSpans(text);
  } catch (err) {
    if (mode === 'strict') {
      throw new OpfUnavailableError(err);
    }
    // best-effort: fall back to heuristic
    const heuristic = analyzeHeuristic(text);
    return {
      spans: heuristic.spans,
      suppressedByAllowlist: heuristic.suppressedByAllowlist,
      usedOpf: false,
      opfElapsedMs: null,
    };
  }

  // OPF spans + regex spans → unsuppressed → merged
  const all = [...regexSpans, ...opfResult.spans];
  const unsuppressed = all.filter(
    (s) => !overlapsAllowlist(s.start, s.end, allowlist)
  );
  const suppressedByAllowlist = all.length - unsuppressed.length;
  const merged = mergeSpans(unsuppressed);

  return {
    spans: merged,
    suppressedByAllowlist,
    usedOpf: true,
    opfElapsedMs: opfResult.elapsedMs,
  };
}
