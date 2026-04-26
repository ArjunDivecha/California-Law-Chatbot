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
import { detectNames } from '../../api/_shared/sanitization/detectNames.js';
import { detectSpans, type DetectResult } from './opfClient.js';
import { getUserAllowlistLower } from './userAllowlist.js';

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

function heuristicNameSpans(text: string): Span[] {
  return detectNames(text).map((n) => ({
    start: n.start,
    end: n.end,
    category: 'name' as const,
    raw: n.raw,
    label: n.signal,
  }));
}

/**
 * Lenient name detector for use INSIDE an OPF non-name span. OPF has
 * already declared this region PII, so a lower-precision bigram match
 * is acceptable — false positives stay tokenized either way (the
 * fragments around the match still get the original OPF category).
 *
 * Pattern: any bigram (or trigram) of word-tokens where at least one
 * token starts with a capital letter, with word boundaries. Catches
 * "arjun Divecha", "Maria Esperanza", "John Q Smith". Skips lone
 * lowercase pairs ("the buyer") and US state abbreviations.
 */
function lenientNamesInSpan(text: string, span: Span): Span[] {
  // Skip lenient name detection inside OPF spans whose category isn't
  // person-adjacent. Inside private_address spans the lenient detector
  // would happily tag "Oak Street", "Berkeley CA", etc. as names —
  // splitting the address into nonsense fragments. Limit to private_*
  // categories where a human name plausibly co-occurs (currently only
  // `name` and `street_address` since OPF sometimes wraps "person of
  // address" into one address span). For other categories, skip.
  if (span.category !== 'street_address' && span.category !== 'name') return [];

  // Anchored single-word "head". From each head we try a 3-word match,
  // then 2-word, and accept the first one that passes filters. Greedy
  // single-regex patterns get foiled by stop-word tails ("arjun Divecha
  // of" → "of" stop word → whole thing rejected, we lose "arjun Divecha").
  const headRe = /\b[A-Za-z][a-zA-Z'-]+/g;
  const STOP = new Set([
    'of', 'at', 'for', 'with', 'to', 'by', 'from', 'on', 'in', 'and',
    'or', 'the', 'a', 'an', 'his', 'her', 'their', 'my', 'our',
    'is', 'was', 'are', 'were', 'be', 'been',
  ]);
  // Words that are *components of an address*, never personal names.
  // If any token in the candidate matches one of these, reject — it's
  // an address fragment OPF already labeled correctly.
  const ADDRESS_WORDS = new Set([
    'st', 'street', 'ave', 'avenue', 'blvd', 'boulevard', 'rd', 'road',
    'dr', 'drive', 'ln', 'lane', 'ct', 'court', 'pl', 'place', 'way',
    'pkwy', 'parkway', 'terr', 'terrace', 'cir', 'circle', 'hwy',
    'highway', 'suite', 'apt', 'apartment', 'unit', 'floor', 'fl',
    'building', 'bldg', 'po', 'box',
  ]);
  const US_STATES = new Set([
    'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi',
    'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi',
    'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc',
    'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut',
    'vt', 'va', 'wa', 'wv', 'wi', 'wy', 'dc',
  ]);
  const slice = text.slice(span.start, span.end);
  const out: Span[] = [];
  let h: RegExpExecArray | null;
  let lastEnd = -1;
  while ((h = headRe.exec(slice)) !== null) {
    const headStart = h.index;
    if (headStart < lastEnd) continue; // skip head positions inside an already-accepted span
    // Try 3-word, then 2-word match starting at this head.
    const candidates = [
      new RegExp(`^([A-Za-z][a-zA-Z'-]+(?:\\s+[A-Za-z][a-zA-Z'-]+){2})\\b`),
      new RegExp(`^([A-Za-z][a-zA-Z'-]+\\s+[A-Za-z][a-zA-Z'-]+)\\b`),
    ];
    const tail = slice.slice(headStart);
    let accepted: { raw: string; len: number } | null = null;
    for (const re of candidates) {
      const m = re.exec(tail);
      if (!m) continue;
      const raw = m[1];
      const words = raw.split(/\s+/);
      if (!words.some((w) => /^[A-Z]/.test(w))) continue;
      if (words.some((w) => STOP.has(w.toLowerCase()))) continue;
      if (words.some((w) => /ed$/.test(w) && w.length >= 5)) continue;
      // Reject if any token is an address component or a state — those
      // are address fragments, not personal names.
      if (words.some((w) => ADDRESS_WORDS.has(w.toLowerCase()))) continue;
      if (words.some((w) => US_STATES.has(w.toLowerCase()))) continue;
      // Reject if any token is purely numeric (street numbers).
      if (words.some((w) => /^\d+$/.test(w))) continue;
      accepted = { raw, len: raw.length };
      break;
    }
    if (!accepted) continue;
    out.push({
      start: span.start + headStart,
      end: span.start + headStart + accepted.len,
      category: 'name',
      raw: accepted.raw,
      label: 'opf-internal-bigram',
    });
    lastEnd = headStart + accepted.len;
  }
  return out;
}

/**
 * When OPF returns a long non-name span ("arjun Divecha of 161 bret
 * harte road, berkeley" labeled private_address), find the person
 * inside and split the OPF span around them so the person and the
 * address tokenize as separate entities. Uses both the global
 * heuristic detector and a lenient bigram pass restricted to inside
 * the OPF span.
 *
 * Mutates neither input. Returns a new array.
 */
function refineOpfWithNames(
  text: string,
  opfSpans: Span[],
  nameSpans: Span[]
): Span[] {
  const out: Span[] = [];
  for (const opf of opfSpans) {
    if (opf.category === 'name') {
      out.push(opf);
      continue;
    }
    const ADDRESS_OR_STATE_RE = /\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|pkwy|parkway|terr|terrace|cir|circle|hwy|highway|suite|apt|apartment|unit|floor|fl|building|bldg|po|box|al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i;
    const globalContained = nameSpans.filter(
      (n) =>
        n.start >= opf.start &&
        n.end <= opf.end &&
        // When the OPF span is an address, reject heuristic names that
        // are actually address components (the capitalized_bigram
        // detector tags "Oak Street" as a name — wrong here).
        !(opf.category === 'street_address' && ADDRESS_OR_STATE_RE.test(n.raw))
    );
    const lenient = lenientNamesInSpan(text, opf);
    // Dedupe by position, prefer global heuristic matches over lenient
    // when they overlap.
    const all = [...globalContained, ...lenient].sort(
      (a, b) => a.start - b.start
    );
    const contained: Span[] = [];
    for (const cand of all) {
      const last = contained[contained.length - 1];
      if (!last || cand.start >= last.end) contained.push(cand);
    }
    if (contained.length === 0) {
      out.push(opf);
      continue;
    }
    let cursor = opf.start;
    const pushFragment = (s: number, e: number) => {
      if (e <= s) return;
      const slice = text.slice(s, e);
      const leading = slice.length - slice.trimStart().length;
      const trailing = slice.length - slice.trimEnd().length;
      const innerStart = s + leading;
      const innerEnd = e - trailing;
      if (innerEnd <= innerStart) return;
      // Heuristic: if the fragment is JUST a connector like "of" or
      // "at" or "for" with no other words, drop it — it's safer not
      // to send a phantom address consisting only of "of".
      const trimmed = text.slice(innerStart, innerEnd);
      if (/^(?:of|at|for|with|to|by|from|on|in)\b\s*$/i.test(trimmed)) return;
      out.push({
        ...opf,
        start: innerStart,
        end: innerEnd,
        raw: trimmed,
        label: `${opf.label}+name-split`,
      });
    };
    for (const name of contained) {
      pushFragment(cursor, name.start);
      out.push(name);
      cursor = name.end;
    }
    pushFragment(cursor, opf.end);
  }
  return out;
}

/**
 * Split a span around any user-allowlisted substring it contains. The
 * allowlisted slice gets removed entirely (sent raw); the remaining
 * non-allowlisted slices are returned as separate sub-spans with the
 * same category and label, so they still get tokenized.
 *
 * Example: OPF returns one private_address span "161 bret harte road,
 * berkeley ca 94708". User allowlist contains "Berkeley". This returns
 * two sub-spans: "161 bret harte road," and "ca 94708" — Berkeley is
 * dropped from the span set and survives on the wire as plain text.
 *
 * Whole-span match (the entire raw equals an allowlisted entry) is
 * handled by the caller before this function is invoked.
 */
function splitSpanByUserAllowlist(span: Span, userAllowSet: Set<string>): Span[] {
  if (userAllowSet.size === 0) return [span];
  const lowerRaw = span.raw.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const allowed of userAllowSet) {
    if (!allowed) continue;
    let from = 0;
    let idx;
    while ((idx = lowerRaw.indexOf(allowed, from)) !== -1) {
      // Word-boundary check so allowlisting "ca" doesn't strip "California".
      const before = idx === 0 ? '' : span.raw[idx - 1];
      const after = idx + allowed.length >= span.raw.length ? '' : span.raw[idx + allowed.length];
      const wordLeft = !before || /\W/.test(before);
      const wordRight = !after || /\W/.test(after);
      if (wordLeft && wordRight) ranges.push([idx, idx + allowed.length]);
      from = idx + allowed.length;
    }
  }
  if (ranges.length === 0) return [span];
  // Merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    if (merged.length === 0 || merged[merged.length - 1][1] < r[0]) {
      merged.push([r[0], r[1]]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
    }
  }
  // Build remaining sub-spans from the gaps between allowlisted ranges.
  const out: Span[] = [];
  let cursor = 0;
  const pushIfNonEmpty = (s: number, e: number) => {
    if (e <= s) return;
    const slice = span.raw.slice(s, e);
    const leading = slice.length - slice.trimStart().length;
    const trailing = slice.length - slice.trimEnd().length;
    const innerStart = s + leading;
    const innerEnd = e - trailing;
    if (innerEnd <= innerStart) return;
    out.push({
      ...span,
      start: span.start + innerStart,
      end: span.start + innerEnd,
      raw: span.raw.slice(innerStart, innerEnd),
    });
  };
  for (const [s, e] of merged) {
    pushIfNonEmpty(cursor, s);
    cursor = e;
  }
  pushIfNonEmpty(cursor, span.raw.length);
  return out;
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

  // OPF can occasionally return a single span for "person of address"
  // phrasings ("arjun Divecha of 161 bret harte road, berkeley" → one
  // private_address span). Run our heuristic name detector and split
  // OPF non-name spans around any contained name so the person and
  // the address tokenize as separate entities.
  const localNames = heuristicNameSpans(text);
  const refinedOpf = refineOpfWithNames(text, opfResult.spans, localNames);

  // Include high-precision heuristic name signals as OPF supplements so
  // names that OPF misses (e.g. lowercase possessives: "rachel's", "john's")
  // are still caught. Excludes 'capitalized_bigram' (too noisy) and
  // 'address_cue' (already handled by OPF address spans).
  const HIGH_PRECISION_SIGNALS = new Set([
    'title_prefix', 'possessive', 'relational', 'cue_lowercase',
  ]);
  const supplementNames = localNames.filter(
    (n) => HIGH_PRECISION_SIGNALS.has(n.label)
  );

  // OPF refined spans + regex spans + heuristic supplements → drop allowlist
  // overlaps → split around user allowlist substrings → merge.
  //
  // Static legal allowlist (overlapsAllowlist): canonical statute
  // citations, case captions etc. — drop the whole span.
  //
  // User allowlist (userAllowSet): per-device list of "always send raw"
  // terms. If a span's raw text exactly matches an entry, drop the
  // span entirely. If a span contains an allowlisted substring (e.g.,
  // an OPF address span containing "Berkeley" that the user marked
  // public), split the span around the substring so the allowlisted
  // chunk survives on the wire as plain text and the rest still
  // tokenizes.
  const userAllowSet = getUserAllowlistLower();
  const all = [...regexSpans, ...refinedOpf, ...supplementNames];
  const beforeStatic = all.filter((s) => !overlapsAllowlist(s.start, s.end, allowlist));
  const afterUserAllow: Span[] = [];
  for (const span of beforeStatic) {
    if (userAllowSet.has(span.raw.toLowerCase())) continue; // whole-span match
    afterUserAllow.push(...splitSpanByUserAllowlist(span, userAllowSet));
  }
  const suppressedByAllowlist = all.length - afterUserAllow.length;
  const merged = mergeSpans(afterUserAllow);

  return {
    spans: merged,
    suppressedByAllowlist,
    usedOpf: true,
    opfElapsedMs: opfResult.elapsedMs,
  };
}
