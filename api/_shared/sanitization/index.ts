/**
 * Sanitization Analyzer — public entry.
 *
 * `analyze(prompt)` runs every detector, removes spans that overlap the
 * public-legal allowlist, and merges overlapping spans into a minimal
 * non-overlapping list sorted by position. Tokenization + storage live in
 * separate modules and consume this output.
 *
 * Pure function — no I/O, no browser APIs, no Bedrock calls. Safe to import
 * from both client-side React code and server-side Vercel functions.
 */

import {
  runPatterns,
  type PatternMatch,
  type PIICategory,
} from './patterns.ts';
import { findAllowlistMatches, overlapsAllowlist } from './allowlist.ts';
import { detectNames, type NameSpan } from './detectNames.ts';

export type SpanCategory = PIICategory | 'name';

export interface Span {
  start: number;
  end: number;
  category: SpanCategory;
  raw: string;
  /** Free-form label (e.g., the pattern name or the name-signal) for audit. */
  label: string;
}

export interface AnalyzeResult {
  spans: Span[];
  /** How many allowlist hits we suppressed — useful for telemetry. */
  suppressedByAllowlist: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function patternToSpan(m: PatternMatch): Span {
  return {
    start: m.start,
    end: m.end,
    category: m.category,
    raw: m.raw,
    label: m.label,
  };
}

function nameToSpan(n: NameSpan): Span {
  return {
    start: n.start,
    end: n.end,
    category: 'name',
    raw: n.raw,
    label: n.signal,
  };
}

/**
 * Merge overlapping spans into a minimal non-overlapping set. When two spans
 * overlap, the *longer* one wins (it's more specific). Ties go to the span
 * that starts first. Categories from the dropped span are lost — we log but
 * don't surface this; for sanitization purposes we only need to know *that*
 * a region is sensitive, not the full set of detectors that fired.
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
    // Overlap: keep the longer span.
    const lastLen = last.end - last.start;
    const sLen = s.end - s.start;
    if (sLen > lastLen) {
      out[out.length - 1] = s;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyze(text: string): AnalyzeResult {
  if (!text || typeof text !== 'string') {
    return { spans: [], suppressedByAllowlist: 0 };
  }

  const allowlist = findAllowlistMatches(text);

  const rawPatternSpans = runPatterns(text).map(patternToSpan);
  const rawNameSpans = detectNames(text).map(nameToSpan);
  const all = [...rawPatternSpans, ...rawNameSpans];

  const unsuppressed = all.filter(
    (s) => !overlapsAllowlist(s.start, s.end, allowlist)
  );
  const suppressedByAllowlist = all.length - unsuppressed.length;

  const merged = mergeSpans(unsuppressed);

  return { spans: merged, suppressedByAllowlist };
}

export { type PIICategory, type NameSpan };
