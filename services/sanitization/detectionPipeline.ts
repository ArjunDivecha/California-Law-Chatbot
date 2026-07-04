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
  HIGH_RISK_CATEGORIES,
  NEVER_ALLOWLISTABLE_CATEGORIES,
  computeConfidence,
} from '../../api/_shared/sanitization/index.js';
import {
  findAllowlistMatches,
  overlapsAllowlist,
} from '../../api/_shared/sanitization/allowlist.js';
import { runPatterns } from '../../api/_shared/sanitization/patterns.js';
import { detectNames } from '../../api/_shared/sanitization/detectNames.js';
import { STOPLIST_LOWER as GEO_AND_ROLE_STOPLIST } from './glinerPostProcess.js';
import {
  detectCompoundRisk,
  COMPOUND_RISK_BUCKET_THRESHOLD,
} from '../../api/_shared/sanitization/compoundRisk.js';
import { detectSpans, type DetectResult } from './opfClient.js';
import { getUserAllowlistLower } from './userAllowlist.js';
import { findUserDenylistSpans } from './userDenylist.js';

/**
 * Thrown by `detectPiiServerBackstop()` when raw PII is detected in the
 * request body. Under Option C (6th addendum), the browser must
 * tokenize before sending; if the server still sees a recognizable SSN
 * / phone / etc., it means tokenization failed upstream. Fail-closed.
 */
export class RawInputDetectedError extends Error {
  public readonly categories: string[];
  public readonly count: number;
  constructor(categories: string[], count: number) {
    super(
      `Raw PII detected in request body (${count} match${count === 1 ? '' : 'es'}: ${categories.join(', ')}). ` +
        `Browser-side tokenization should have replaced these with @@TOKEN@@ placeholders. ` +
        `Request blocked to prevent unprotected send.`,
    );
    this.name = 'RawInputDetectedError';
    this.categories = categories;
    this.count = count;
  }
}

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
      privileged: false,
      confidence: 1.0,
      compoundRiskBuckets: 0,
      usedOpf: false,
      opfElapsedMs: null,
    };
  }

  const allowlist = findAllowlistMatches(text);
  const regexSpans = patternSpans(text);
  // Per-device "always privileged" terms (userDenylist) — force-detected
  // regardless of what the ML detector finds. Attorney explicit choice
  // outranks every automatic suppression below.
  const denySpans = findUserDenylistSpans(text);

  let opfResult: DetectResult | null = null;
  try {
    opfResult = await detectSpans(text);
  } catch (err) {
    if (mode === 'strict') {
      throw new OpfUnavailableError(err);
    }
    // best-effort: fall back to heuristic (+ denylist force-detections)
    const heuristic = analyzeHeuristic(text);
    const spans = mergeSpans([...heuristic.spans, ...denySpans]);
    return {
      ...heuristic,
      spans,
      privileged:
        heuristic.privileged || spans.some((s) => HIGH_RISK_CATEGORIES.has(s.category)),
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
  // Denylist force-detections join AFTER the allowlist filters — the
  // attorney explicitly marked these privileged, so neither the static
  // legal allowlist nor the user allowlist may suppress them.
  afterUserAllow.push(...denySpans);
  const mergedRaw = mergeSpans(afterUserAllow);

  // Bare-place / generic-term suppression (2026-06-30, browser-GLiNER
  // integration). A span whose ENTIRE text is a bare place name or a
  // generic stoplisted term — "San Jose", "Long Beach", "Fresno County",
  // "Marin County" — is never client-identifying on its own, yet several
  // upstream paths can emit one as a standalone span: GLiNER tagging a
  // city as street_address, the OPF/GLiNER internal name-split leaving a
  // city residual, or the bigram name scanner. Rather than patch each
  // generator, drop these uniformly here, AFTER the merge. The
  // compound-risk pass still fires `privileged` on the COMBINATION
  // (ethnicity + neighborhood + role), so confidentiality is unaffected —
  // this only removes over-redaction false-positives on public geography.
  // A full address ("88 Industrial Drive, San Jose") is a LONGER span, so
  // its text is not a bare place and is NOT dropped.
  const isBarePlaceOrTerm = (raw: string): boolean => {
    const t = raw.trim().toLowerCase();
    if (GEO_AND_ROLE_STOPLIST.has(t)) return true;       // shared CA-city / role / org stoplist
    if (/^[a-z][a-z.'\- ]*\b(county|city)$/.test(t)) return true; // "<X> County" / "<X> City"
    return false;
  };
  // Denylist spans are exempt — if the attorney marked "Berkeley"
  // privileged, the geo stoplist must not silently un-redact it.
  const merged = mergedRaw.filter(
    (s) => s.label === 'user-denylist' || !isBarePlaceOrTerm(s.raw)
  );

  // OPF spans don't carry heuristic signal labels, so confidence is
  // modelled as 1.0 for the OPF path. The heuristic fallback path uses
  // computeConfidence() which applies signal-specific floors.
  //
  // Compound-risk (W1 mechanism, audit §8 item #3) MUST be OR'd into
  // privileged here even when OPF returns spans, because OPF on its own
  // does not detect compound identifiers (e.g. "Cantonese-speaking
  // widower in Sunset District + son a radiology resident at UCSF" has
  // no explicit-PII spans but is still a privilege risk). The heuristic
  // fallback path inherits compound-risk via analyzeHeuristic(); this
  // ensures the OPF-success path has parity with analyze() from index.ts.
  const compoundRisk = detectCompoundRisk(text);
  const compoundRiskBuckets = compoundRisk.bucketsHit;
  const privileged =
    merged.some((s) => HIGH_RISK_CATEGORIES.has(s.category)) ||
    compoundRiskBuckets >= COMPOUND_RISK_BUCKET_THRESHOLD;
  const confidence = computeConfidence(merged); // will be 1.0 unless heuristic supplements fired

  return {
    spans: merged,
    suppressedByAllowlist,
    privileged,
    confidence,
    compoundRiskBuckets,
    usedOpf: true,
    opfElapsedMs: opfResult.elapsedMs,
  };
}

/**
 * Server-side regex backstop only — no OPF call, no name heuristics.
 *
 * Per the 6th-addendum Option C and the V1→V2 audit 2026-05-14, the
 * Vercel proxy is NOT the primary detector. The browser tokenizes via
 * `detectPii()` (which uses OPF + IndexedDB token map) and sends
 * `@@TOKEN@@` placeholders over the wire. This function runs only the
 * deterministic regex patterns from `patterns.ts` so the server can
 * catch any raw PII that slipped past the browser (defense in depth).
 *
 * Behavior:
 *   - If raw PII is detected, returns the spans + privileged=true. The
 *     caller (agentProxy) should reject the request with a fail-closed
 *     error to prevent unprotected send to Anthropic.
 *   - If no raw PII detected, returns empty spans + privileged
 *     computed from compound-risk only.
 *   - Allowlist is honored (statute citations, case names, agencies).
 *
 * What this DOES NOT do:
 *   - No OPF daemon call. The daemon lives on the attorney's device,
 *     not in the Vercel container. Server-side OPF was an architecture
 *     error documented in audit §1.
 *   - No name heuristics. Single-word names ("Smith", "Liu") cannot be
 *     caught deterministically; the browser-side OPF + ML model is
 *     responsible. If a name appears here raw, browser-side
 *     tokenization failed and the request is rejected.
 */
/**
 * True when a regex span's text was marked "not privileged" by the attorney
 * (per-device user allowlist, forwarded from the client in the request body).
 * Boundary-tolerant in both directions because the server regex and the
 * browser GLiNER preview can choose slightly different spans for one value.
 */
function spanCoveredByUserAllowlist(
  text: string,
  span: Span,
  allow: ReadonlySet<string>,
): boolean {
  const raw = text.slice(span.start, span.end).trim().toLowerCase();
  if (!raw) return false;
  if (allow.has(raw)) return true;
  for (const a of allow) {
    if (a.length >= 3 && (a.includes(raw) || raw.includes(a))) return true;
  }
  return false;
}

export function detectPiiServerBackstop(
  text: string,
  userAllowlistLower?: ReadonlySet<string>,
): DetectionPipelineResult {
  if (!text || typeof text !== 'string') {
    return {
      spans: [],
      suppressedByAllowlist: 0,
      privileged: false,
      confidence: 1.0,
      compoundRiskBuckets: 0,
      usedOpf: false,
      opfElapsedMs: null,
    };
  }

  const allowlist = findAllowlistMatches(text);
  const regexSpans = patternSpans(text);

  // Drop spans overlapping the allowlist (statute citations, court names).
  const filteredSpans: Span[] = [];
  let suppressedByAllowlist = 0;
  for (const span of regexSpans) {
    if (overlapsAllowlist(span.start, span.end, allowlist)) {
      suppressedByAllowlist += 1;
    } else if (
      userAllowlistLower &&
      !NEVER_ALLOWLISTABLE_CATEGORIES.has(span.category) &&
      spanCoveredByUserAllowlist(text, span, userAllowlistLower)
    ) {
      // Attorney marked this term "not privileged" on their device — it is
      // sent raw by intent, so it must not trip the server backstop either.
      // (Catastrophic categories — ssn/cards/etc. — can never be allowlisted.)
      suppressedByAllowlist += 1;
    } else {
      filteredSpans.push(span);
    }
  }

  // Compound-risk pass — same dictionary as the browser path, fine to
  // re-run server-side (it's pure regex).
  const compoundRisk = detectCompoundRisk(text);
  const compoundRiskBuckets = compoundRisk.bucketsHit;
  const privileged =
    filteredSpans.some((s) => HIGH_RISK_CATEGORIES.has(s.category)) ||
    compoundRiskBuckets >= COMPOUND_RISK_BUCKET_THRESHOLD;
  const confidence = computeConfidence(filteredSpans);

  return {
    spans: filteredSpans,
    suppressedByAllowlist,
    privileged,
    confidence,
    compoundRiskBuckets,
    usedOpf: false,
    opfElapsedMs: null,
  };
}
