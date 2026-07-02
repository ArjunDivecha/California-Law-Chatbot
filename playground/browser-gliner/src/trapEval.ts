/**
 * =============================================================================
 * FILE: trapEval.ts  (browser-gliner prototype)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   Scores one trap from the 120-trap manifest using the SAME logic as the
 *   production wire-pipeline runner `tests/traps/runTrapsWire.mjs` in its
 *   `--gliner-only` mode. For each trap it:
 *     - takes the in-browser GLiNER spans (name + address only, GLiNER's
 *       strengths),
 *     - merges in the REAL production regex patterns (dates, SSN, email,
 *       phone, etc.) and applies the REAL allowlist + compound-risk modules
 *       (imported read-only from api/_shared/sanitization/*),
 *     - checks (a) every must_redact value is >=50% covered by a span of
 *       the matching category, (b) no must_not_redact substring is falsely
 *       flagged, (c) no must_redact raw value survives into the synthesized
 *       wire body, (d) the privileged flag matches expected.
 *
 *   The ONLY thing that differs from runTrapsWire --gliner-only is the
 *   engine producing the GLiNER spans (Python fp32 -> browser int8 ONNX).
 *   So a pass here == int8 holds the production gate.
 *
 *   NOTE on the tool-result phase: 11/120 traps also have a tool_result
 *   phase that runTrapsWire evaluates with the server-side analyze()
 *   (regex + name heuristics). That path is DETECTOR-INDEPENDENT (it never
 *   touches GLiNER), so it is out of scope here and reported separately as
 *   "input-phase only". This harness answers the GLiNER-engine question.
 *
 * IMPORTS (READ-ONLY) FROM PRODUCTION:
 *   ../../../api/_shared/sanitization/patterns.ts    (runPatterns)
 *   ../../../api/_shared/sanitization/allowlist.ts   (findAllowlistMatches, overlapsAllowlist)
 *   ../../../api/_shared/sanitization/compoundRisk.ts(detectCompoundRisk)
 *
 * INPUT FILES:  ../../../tests/traps/manifest-v1.json (imported by main.ts)
 * OUTPUT FILES: none (returns result objects; main.ts offers JSON download).
 * =============================================================================
 */

import { runPatterns } from '../../../api/_shared/sanitization/patterns';
import {
  findAllowlistMatches,
  overlapsAllowlist,
} from '../../../api/_shared/sanitization/allowlist';
import { detectCompoundRisk } from '../../../api/_shared/sanitization/compoundRisk';
import type { CategorizedSpan } from './postProcess';

// Mirrors api/_shared/sanitization/index.ts HIGH_RISK_CATEGORIES
// (read 2026-06-30). Kept local to avoid pulling index.ts's internal
// .js-specifier import graph into the prototype bundle. Re-sync if the
// production set changes.
export const HIGH_RISK_CATEGORIES: ReadonlySet<string> = new Set<string>([
  'name', 'ssn', 'tin', 'phone', 'email', 'street_address',
  'bank_account', 'credit_card', 'dollar_amount', 'medical_record',
  'bar_number', 'driver_license', 'court_case', 'client_matter',
  'date', 'zip',
]);

export interface EvalSpan {
  start: number;
  end: number;
  category: string;
  raw: string;
  label: string;
}

export interface TrapMustRedact {
  value: string;
  category: string;
}
export interface Trap {
  id: string;
  category: string;
  w_item?: string;
  input: string;
  must_redact?: TrapMustRedact[];
  must_not_redact?: string[];
  expected_privileged?: boolean;
  tool_result_phase?: boolean;
}

// --- coverage / violation helpers (mirror runTrapsWire.mjs) -----------------

function findRange(text: string, value: string): [number, number] | null {
  const idx = text.indexOf(value);
  if (idx < 0) return null;
  return [idx, idx + value.length];
}
function overlapLen(a: [number, number], b: [number, number]): number {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}
function isCovered(spans: EvalSpan[], value: string, category: string, text: string) {
  const range = findRange(text, value);
  if (!range) return { covered: false, reason: 'value-not-found-in-input' as const, overlapFrac: 0 };
  const valLen = range[1] - range[0];
  let overlap = 0;
  for (const sp of spans) {
    if (sp.category !== category) continue;
    overlap += overlapLen([sp.start, sp.end], range);
  }
  const frac = overlap / valLen;
  return { covered: frac >= 0.5, overlapFrac: frac, reason: frac >= 0.5 ? null : 'insufficient-or-no-span' };
}
function findViolation(spans: EvalSpan[], substr: string, text: string) {
  const idx = text.indexOf(substr);
  if (idx < 0) return null;
  const range: [number, number] = [idx, idx + substr.length];
  for (const sp of spans) {
    // FP only when a predicted span is EQUAL TO or FULLY INSIDE the
    // must_not_redact substring (a larger correct span is not an FP).
    if (sp.start >= range[0] && sp.end <= range[1]) {
      return { substr, predictedSpan: { start: sp.start, end: sp.end, category: sp.category, raw: sp.raw } };
    }
  }
  return null;
}
function buildWireBody(text: string, spans: EvalSpan[]): string {
  const highRisk = spans.filter((s) => HIGH_RISK_CATEGORIES.has(s.category));
  if (!highRisk.length) return text;
  const sorted = [...highRisk].sort((a, b) => b.start - a.start);
  let out = text;
  for (const sp of sorted) {
    out = out.slice(0, sp.start) + `${sp.category.toUpperCase()}_TOKEN` + out.slice(sp.end);
  }
  return out;
}

/** mergeSpans: add `extra` spans that don't overlap any existing NAME span. */
function mergeSpans(stock: EvalSpan[], extra: EvalSpan[]): EvalSpan[] {
  const out = [...stock];
  for (const ex of extra) {
    let overlaps = false;
    for (const s of stock) {
      if (s.category !== 'name') continue;
      if (overlapLen([s.start, s.end], [ex.start, ex.end]) > 0) { overlaps = true; break; }
    }
    if (!overlaps) out.push(ex);
  }
  return out;
}

export interface TrapResult {
  id: string;
  category: string;
  w_item?: string;
  pass: boolean;
  missed: Array<TrapMustRedact & { overlapFrac: number; reason: string | null }>;
  falsePositives: Array<{ substr: string }>;
  wireLeaks: Array<{ value: string; category: string }>;
  privilegedExpected?: boolean;
  privilegedActual: boolean;
  compoundRiskBuckets: number;
  // Lowest GLiNER score among name/address spans that contributed to a
  // must_redact catch — useful for the >=0.98 confidence-gate discussion.
  minNameScore: number | null;
  spans: EvalSpan[];
}

/**
 * Evaluate the input phase of one trap using browser-GLiNER spans merged
 * with the production regex/allowlist/compound-risk modules.
 * `glinerSpans` are the post-processed CategorizedSpans from BrowserGliner.
 */
export function evalTrapInputPhase(trap: Trap, glinerSpans: CategorizedSpan[]): TrapResult {
  const text = trap.input;

  // GLiNER contributes name + street_address only (its strengths), exactly
  // as runTrapsWire --gliner-only does.
  const glinerKept = glinerSpans.filter(
    (s) => s.category === 'name' || s.category === 'street_address',
  );
  const glinerEval: EvalSpan[] = glinerKept.map((s) => ({
    start: s.start, end: s.end, category: s.category, raw: s.text, label: 'gliner-' + s.label,
  }));

  const regexEval: EvalSpan[] = runPatterns(text).map((m: any) => ({
    start: m.start, end: m.end, category: m.category, raw: m.raw, label: m.label,
  }));

  let spans = mergeSpans(glinerEval, regexEval);

  const allow = findAllowlistMatches(text);
  spans = spans.filter((s) => !overlapsAllowlist(s.start, s.end, allow));

  const cr = detectCompoundRisk(text);
  const compoundRiskBuckets: number = cr.bucketsHit ?? 0;

  const missed: TrapResult['missed'] = [];
  for (const entry of trap.must_redact ?? []) {
    const cov = isCovered(spans, entry.value, entry.category, text);
    if (!cov.covered) missed.push({ ...entry, overlapFrac: cov.overlapFrac, reason: cov.reason ?? null });
  }
  const falsePositives: TrapResult['falsePositives'] = [];
  for (const sub of trap.must_not_redact ?? []) {
    const v = findViolation(spans, sub, text);
    if (v) falsePositives.push({ substr: v.substr });
  }

  const privilegedActual =
    spans.some((s) => HIGH_RISK_CATEGORIES.has(s.category)) || compoundRiskBuckets >= 3;
  const privilegedMatches =
    trap.expected_privileged === undefined ? null : privilegedActual === Boolean(trap.expected_privileged);

  const wireBody = buildWireBody(text, spans);
  const wireLeaks: TrapResult['wireLeaks'] = [];
  for (const entry of trap.must_redact ?? []) {
    if (wireBody.includes(entry.value)) wireLeaks.push({ value: entry.value, category: entry.category });
  }

  const nameScores = glinerKept.map((s) => s.score).filter((n) => typeof n === 'number');
  const minNameScore = nameScores.length ? Math.min(...nameScores) : null;

  return {
    id: trap.id,
    category: trap.category,
    w_item: trap.w_item,
    pass:
      missed.length === 0 &&
      falsePositives.length === 0 &&
      wireLeaks.length === 0 &&
      (privilegedMatches === null || privilegedMatches),
    missed,
    falsePositives,
    wireLeaks,
    privilegedExpected: trap.expected_privileged,
    privilegedActual,
    compoundRiskBuckets,
    minNameScore,
    spans,
  };
}
