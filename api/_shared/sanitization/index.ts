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
} from './patterns.js';
import { findAllowlistMatches, overlapsAllowlist } from './allowlist.js';
import { detectNames, type NameSpan } from './detectNames.js';
import { detectCompoundRisk, COMPOUND_RISK_BUCKET_THRESHOLD } from './compoundRisk.js';

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
  /**
   * True if any high-risk PII category was detected OR the compound-risk
   * mechanism (audit §8 item #3 minimum viable) detected ≥3 distinct
   * signal buckets. Used by the agent loop to gate `web_search` out of
   * the tools array (§E of the V2 plan).
   */
  privileged: boolean;
  /**
   * 0–1 confidence that sanitization caught everything. Driven by the
   * weakest detection signal present. Values < 0.98 route to manual review.
   * Does NOT account for compound-identifier gaps (W1) — see sanitization
   * audit §5 for a full picture of what this score cannot measure.
   */
  confidence: number;
  /**
   * Number of distinct compound-risk buckets that fired. ≥3 contributes
   * to `privileged`. 0 when the input contains no signal-bucket terms.
   * Surfaced for telemetry and for the audit record's compound-risk field.
   */
  compoundRiskBuckets?: number;
}

// ---------------------------------------------------------------------------
// Privilege + confidence helpers (exported for use in detectionPipeline)
// ---------------------------------------------------------------------------

/**
 * Categories whose presence marks the prompt as containing information that
 * could identify a specific client or matter. Drives web_search gating.
 * Lower-risk categories (date, zip, credit_card) are omitted — a filing
 * date or courthouse ZIP does not by itself identify a client.
 */
export const HIGH_RISK_CATEGORIES: ReadonlySet<SpanCategory> = new Set<SpanCategory>([
  'name',
  'ssn',
  'tin',
  'phone',
  'email',
  'street_address',
  'bank_account',
  'credit_card',
  'dollar_amount',
  'medical_record',
  'bar_number',
  'driver_license',
  'court_case',
  'client_matter',
]);

/**
 * Minimum confidence floor contributed by each name-detection heuristic
 * signal. Deterministic regex patterns (non-name) are treated as 1.0 and
 * do not reduce confidence. OPF ML detections are also treated as 1.0 —
 * this map only applies to the heuristic fallback path.
 */
const NAME_SIGNAL_CONFIDENCE: Readonly<Record<string, number>> = {
  title_prefix: 0.93,
  address_cue: 0.90,
  possessive: 0.88,
  relational: 0.87,
  'opf-internal-bigram': 0.85,
  capitalized_bigram: 0.78,
  cue_lowercase: 0.72,
  single_subject_verb: 0.65,
};

/**
 * Compute overall confidence from the merged span list. Returns a value in
 * (0, 1]. Confidence is 1.0 when only deterministic patterns fired; it
 * drops as less-certain name heuristics are used.
 */
export function computeConfidence(spans: Span[]): number {
  let confidence = 1.0;
  for (const span of spans) {
    if (span.category !== 'name') continue;
    const floor = NAME_SIGNAL_CONFIDENCE[span.label] ?? 0.72;
    confidence = Math.min(confidence, floor);
  }
  return confidence;
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
 * Merge overlapping spans into a minimal non-overlapping set.
 *
 * Resolution rule:
 *   - If exactly one of the overlapping spans is a `name`, the OTHER
 *     wins. The non-name PII detectors (SSN, ZIP, phone, address, etc.)
 *     are more specific signals; the bigram name scanner is the
 *     broadest. This stops "San Francisco CA" from eating "CA 94123".
 *   - Otherwise the longer span wins; ties broken by earliest start.
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
      // Specific signal beats broad name.
      out[out.length - 1] = s;
      continue;
    }
    if (!lastIsName && sIsName) {
      // Keep the existing specific span; drop the name.
      continue;
    }
    // Same-class overlap: keep the longer one.
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

  const compoundRisk = detectCompoundRisk(text);
  const compoundRiskBuckets = compoundRisk.bucketsHit;
  const privileged =
    merged.some((s) => HIGH_RISK_CATEGORIES.has(s.category)) ||
    compoundRiskBuckets >= COMPOUND_RISK_BUCKET_THRESHOLD;
  const confidence = computeConfidence(merged);

  return { spans: merged, suppressedByAllowlist, privileged, confidence, compoundRiskBuckets };
}

export { type PIICategory, type NameSpan };
