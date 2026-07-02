/**
 * Phase C — 120-trap wire-pipeline runner (V1→V2 audit 2026-05-14).
 *
 * Companion to tests/traps/runTraps.mjs (which uses `analyze()` —
 * regex + name heuristics, no OPF). This runner uses the FULL browser
 * detection pipeline `detectPii()` (regex + names + allowlist +
 * compound-risk + OPF daemon), which is what `tokenizeForWire()`
 * actually runs in production. It also constructs the would-be wire
 * body (sanitized text with HIGH_RISK spans tokenized) and asserts
 * that no `must_redact` raw value survives to the wire.
 *
 * Two pass criteria per trap (input phase):
 *   (a) coverage: every must_redact entry is ≥50% covered by a span
 *       of the matching category.
 *   (b) wire-clean: every must_redact entry's raw value does NOT
 *       appear anywhere in the sanitized wire body.
 *   plus the existing (c) no false positives on must_not_redact and
 *   (d) privileged flag matches expected.
 *
 * Tool-result-phase traps reuse the original analyze() check from
 * runTraps.mjs (tool output sanitization stays server-side, doesn't
 * go through OPF — Phase A.7).
 *
 * Plan §0.c hard gate: TWO consecutive zero-leak runs.
 *
 * Usage:  node tests/traps/runTrapsWire.mjs
 *         node tests/traps/runTrapsWire.mjs --id T-W1-001
 *         node tests/traps/runTrapsWire.mjs --category compound_identifier
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '..', '..');

const manifestPath = joinPath(__dirname, 'manifest-v1.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Full pipeline — uses OPF daemon when reachable.
const { detectPii } = await import(
  joinPath(repoRoot, 'services/sanitization/detectionPipeline.ts')
);
// Server-side tool-output check uses analyze() directly (Phase A.7
// established server-side tool-result sanitization stays as-is).
const { analyze, HIGH_RISK_CATEGORIES } = await import(
  joinPath(repoRoot, 'api/_shared/sanitization/index.ts')
);

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const filterId = flag('--id');
const filterCategory = flag('--category');
const filterWItem = flag('--w-item');
const runLabel = flag('--label') ?? new Date().toISOString().slice(0, 10);
// `--hybrid` adds the AI4Privacy-fine-tuned OPF as a second name detector,
// merged into the stock spans.
const useHybrid = args.includes('--hybrid');
// `--gliner-only` replaces OPF entirely with GLiNER (span-based,
// urchade/gliner_multi_pii-v1). Catches single-word and compound names
// without fragmentation. Uncorrelated with OPF/AI4Privacy family.
const useGlinerOnly = args.includes('--gliner-only');
// `--gliner-hybrid` uses OPF stock + GLiNER together (3 uncorrelated
// signals: OPF + GLiNER + regex).
const useGlinerHybrid = args.includes('--gliner-hybrid');
const FT_CHECKPOINT =
  '/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-prd-run/remote_artifacts/runs/privacy_filter_full/run_b_weighted';
const OPF_BIN = '/Users/arjundivecha/.opf-daemon/venv/bin/opf';
const PYTHON_BIN = '/Users/arjundivecha/.opf-daemon/venv/bin/python';
const GLINER_SCRIPT = joinPath(repoRoot, 'scripts/gliner_detect.py');

const subset = manifest.traps.filter((t) => {
  if (filterId && t.id !== filterId) return false;
  if (filterCategory && t.category !== filterCategory) return false;
  if (filterWItem && t.w_item !== filterWItem) return false;
  return true;
});

// ---------------------------------------------------------------------------
// Coverage logic (mirrors runTraps.mjs)
// ---------------------------------------------------------------------------

function findRange(text, value) {
  const idx = text.indexOf(value);
  if (idx < 0) return null;
  return [idx, idx + value.length];
}
function overlapLen(a, b) {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}
function isCovered(spans, value, category, text) {
  const range = findRange(text, value);
  if (!range) return { covered: false, reason: 'value-not-found-in-input' };
  const valLen = range[1] - range[0];
  let overlap = 0;
  const contributors = [];
  for (const sp of spans) {
    if (sp.category !== category) continue;
    const o = overlapLen([sp.start, sp.end], range);
    if (o > 0) { overlap += o; contributors.push(sp); }
  }
  const frac = overlap / valLen;
  return { covered: frac >= 0.5, overlapFrac: frac, contributors,
           reason: frac >= 0.5 ? null : contributors.length === 0 ? 'no-matching-category-span' : 'insufficient-overlap' };
}
function findViolation(spans, substr, text) {
  // A `must_not_redact` violation fires when a predicted span EQUALS
  // OR IS FULLY CONTAINED WITHIN the substring — i.e., the detector
  // tagged this exact substring as PII on its own.
  //
  // It does NOT fire when the predicted span is LARGER than the
  // substring, because that means the substring is just a fragment of
  // a wider real-PII match (e.g., "San Jose" within "88 Industrial
  // Drive, San Jose" is correctly part of the full address span).
  // Pre-fix this fired on any overlap, which was overly strict — it
  // counted larger-span correct catches as false positives.
  const idx = text.indexOf(substr);
  if (idx < 0) return null;
  const range = [idx, idx + substr.length];
  for (const sp of spans) {
    if (sp.start >= range[0] && sp.end <= range[1]) {
      return { substr, predictedSpan: { start: sp.start, end: sp.end, category: sp.category, raw: sp.raw } };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Wire-form synthesis: replace HIGH_RISK spans with token placeholders
// (mirrors the tokenizeForWire substitution after detectPii.)
// ---------------------------------------------------------------------------

function buildWireBody(text, spans) {
  const highRisk = spans.filter((s) => HIGH_RISK_CATEGORIES.has(s.category));
  if (!highRisk.length) return text;
  const sorted = [...highRisk].sort((a, b) => b.start - a.start);
  let out = text;
  for (const sp of sorted) {
    const tok = `${sp.category.toUpperCase()}_TOKEN`;
    out = out.slice(0, sp.start) + tok + out.slice(sp.end);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase evaluation
// ---------------------------------------------------------------------------

/**
 * Pre-compute GLiNER spans for the whole subset by piping all texts
 * through one Python process. Avoids 120× model-load cost.
 */
function precomputeGliner(traps) {
  if (!useGlinerOnly && !useGlinerHybrid) return new Map();
  console.log(`Pre-computing GLiNER spans for ${traps.length} traps (one model load)...`);
  const stdin = traps.map((t) => JSON.stringify({ text: t.input })).join('\n');
  const r = spawnSync(PYTHON_BIN, [GLINER_SCRIPT], {
    input: stdin,
    encoding: 'utf-8',
    env: { ...process.env, TRANSFORMERS_VERBOSITY: 'error' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const lines = (r.stdout || '').split('\n').filter(Boolean);
  const m = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    try {
      const obj = JSON.parse(lines[i]);
      m.set(traps[i].id, (obj.spans ?? []).map((s) => ({
        start: s.start, end: s.end,
        category: s.category,
        raw: s.text,
        label: 'gliner-' + s.label,
      })));
    } catch {
      m.set(traps[i].id, []);
    }
  }
  console.log(`  done. ${m.size} pre-computed.`);
  return m;
}

function fineTuneNameSpans(text) {
  // Subprocess opf redact with --checkpoint; parse JSON; extract only
  // private_person spans. Maps to our 'name' category. Best-effort —
  // failures return [].
  const r = spawnSync(
    OPF_BIN,
    ['redact', '--device', 'mps', '--no-print-color-coded-text', '--format', 'json',
     '--checkpoint', FT_CHECKPOINT, text],
    { encoding: 'utf-8', env: { ...process.env, OPF_MOE_TRITON: '0' } },
  );
  if (r.status !== 0) return [];
  // Output prefixes a "summary: ..." line before the JSON. Skip to first '{'.
  const stdout = r.stdout || '';
  const i = stdout.indexOf('{');
  if (i < 0) return [];
  try {
    const parsed = JSON.parse(stdout.slice(i, stdout.lastIndexOf('}') + 1));
    return (parsed.detected_spans ?? [])
      .filter((s) => s.label === 'private_person')
      .map((s) => ({
        start: s.start, end: s.end,
        category: 'name',
        raw: s.text,
        label: 'ft-private-person',
      }));
  } catch { return []; }
}

function mergeSpans(stock, extra) {
  // Add extra spans that don't overlap any existing name span.
  const out = [...stock];
  for (const ex of extra) {
    let overlaps = false;
    for (const s of stock) {
      if (s.category !== 'name') continue;
      if (overlapLen([s.start, s.end], [ex.start, ex.end]) > 0) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) out.push(ex);
  }
  return out;
}

async function evalInputPhase(trap, glinerSpansById) {
  const text = trap.input;

  let detection;
  let spans;
  if (useGlinerOnly) {
    // GLiNER (names + addresses only) + regex (dates, SSN, email, phone,
    // etc.) + compound-risk + allowlist filter.
    const { runPatterns } = await import(
      joinPath(repoRoot, 'api/_shared/sanitization/patterns.ts')
    );
    const { detectCompoundRisk } = await import(
      joinPath(repoRoot, 'api/_shared/sanitization/compoundRisk.ts')
    );
    // Drop GLiNER date predictions — regex is more precise for dates
    // (won't flag bare "Tuesday"). Keep GLiNER's strengths: names and
    // addresses.
    const glinerSpans = (glinerSpansById.get(trap.id) ?? []).filter(
      (s) => s.category === 'name' || s.category === 'street_address',
    );
    const regexSpans = runPatterns(text).map((m) => ({
      start: m.start, end: m.end, category: m.category, raw: m.raw, label: m.label,
    }));
    spans = mergeSpans(glinerSpans, regexSpans);
    // Filter via allowlist
    const { findAllowlistMatches, overlapsAllowlist } = await import(
      joinPath(repoRoot, 'api/_shared/sanitization/allowlist.ts')
    );
    const allow = findAllowlistMatches(text);
    spans = spans.filter((s) => !overlapsAllowlist(s.start, s.end, allow));
    // Compound-risk detection runs on raw text (same as detectPii path).
    const cr = detectCompoundRisk(text);
    detection = {
      privileged: null,
      compoundRiskBuckets: cr.bucketsHit,
      confidence: 1.0,
    };
  } else {
    detection = await detectPii(text, 'best-effort');
    spans = detection.spans ?? [];
    if (useHybrid) {
      const ftNames = fineTuneNameSpans(text);
      spans = mergeSpans(spans, ftNames);
    }
    if (useGlinerHybrid) {
      const glinerSpans = glinerSpansById.get(trap.id) ?? [];
      // Use GLiNER for name + address only (its strengths). Drop other
      // categories where OPF/regex are stronger.
      const filtered = glinerSpans.filter(
        (s) => s.category === 'name' || s.category === 'street_address',
      );
      spans = mergeSpans(spans, filtered);
    }
  }

  const missed = [];
  for (const entry of trap.must_redact ?? []) {
    const cov = isCovered(spans, entry.value, entry.category, text);
    if (!cov.covered) missed.push({ ...entry, ...cov });
  }
  const falsePositives = [];
  for (const sub of trap.must_not_redact ?? []) {
    const v = findViolation(spans, sub, text);
    if (v) falsePositives.push(v);
  }
  const privilegedExpected = trap.expected_privileged;
  // Any merge-mode (hybrid, gliner-only, gliner-hybrid) recomputes
  // privileged from the merged spans so the added detector's catches
  // promote privileged from false → true.
  const usingMerge = useHybrid || useGlinerOnly || useGlinerHybrid;
  const privilegedActual = usingMerge
    ? spans.some((s) => HIGH_RISK_CATEGORIES.has(s.category)) ||
      (detection.compoundRiskBuckets ?? 0) >= 3
    : Boolean(detection.privileged);
  const privilegedMatches = privilegedExpected === undefined ? null : privilegedActual === Boolean(privilegedExpected);

  // Wire-form leak check: build the would-be outbound body and look
  // for any must_redact raw value surviving in it.
  const wireBody = buildWireBody(text, spans);
  const wireLeaks = [];
  for (const entry of trap.must_redact ?? []) {
    if (wireBody.includes(entry.value)) {
      wireLeaks.push({ value: entry.value, category: entry.category });
    }
  }

  return {
    spans,
    detection: {
      privileged: privilegedActual,
      confidence: detection.confidence,
      compoundRiskBuckets: detection.compoundRiskBuckets,
      usedOpf: detection.usedOpf,
      opfElapsedMs: detection.opfElapsedMs,
    },
    wireBody,
    wireLeaks,
    missed,
    falsePositives,
    privilegedMatches,
    privilegedExpected,
    pass:
      missed.length === 0 &&
      falsePositives.length === 0 &&
      wireLeaks.length === 0 &&
      (privilegedMatches === null || privilegedMatches),
  };
}

function evalToolResultPhase(trap) {
  // Tool-result sanitization is the server-side analyze() path.
  const text = trap.simulated_tool_result;
  if (!text) return { pass: true, skipped: true };
  const result = analyze(text);
  const spans = result.spans ?? [];

  const missed = [];
  for (const entry of trap.must_redact_in_tool_result ?? []) {
    const cov = isCovered(spans, entry.value, entry.category, text);
    if (!cov.covered) missed.push({ ...entry, ...cov });
  }
  return { spans, missed, pass: missed.length === 0 };
}

async function evaluate(trap, glinerSpansById) {
  const phases = { input: await evalInputPhase(trap, glinerSpansById) };
  if (trap.tool_result_phase === true) {
    phases.tool_result = evalToolResultPhase(trap);
  }
  const pass = phases.input.pass && (phases.tool_result?.pass ?? true);
  return { id: trap.id, category: trap.category, w_item: trap.w_item, pass, phases };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const startedAt = new Date().toISOString();
const modeDesc = useGlinerOnly ? 'GLiNER-only (+ regex + allowlist)'
  : useGlinerHybrid ? 'OPF stock + GLiNER hybrid'
  : useHybrid ? 'OPF stock + OPF fine-tune (names) hybrid'
  : 'OPF stock (best-effort)';
console.log(`Running ${subset.length} traps through wire pipeline: ${modeDesc}`);
console.log('');

const glinerSpansById = precomputeGliner(subset);

const results = [];
const t0 = Date.now();
for (let i = 0; i < subset.length; i += 1) {
  const trap = subset[i];
  const r = await evaluate(trap, glinerSpansById);
  results.push(r);
  if (!r.pass) {
    const reasons = [];
    if (!r.phases.input.pass) {
      if (r.phases.input.missed?.length) reasons.push(`missed=${r.phases.input.missed.map((m) => m.category + ':' + JSON.stringify(m.value)).join(', ')}`);
      if (r.phases.input.falsePositives?.length) reasons.push(`fp=${r.phases.input.falsePositives.map((fp) => JSON.stringify(fp.substr)).join(', ')}`);
      if (r.phases.input.wireLeaks?.length) reasons.push(`WIRE-LEAK=${r.phases.input.wireLeaks.map((l) => JSON.stringify(l.value)).join(', ')}`);
      if (r.phases.input.privilegedMatches === false) reasons.push(`priv ${r.phases.input.privilegedExpected} → ${r.phases.input.detection.privileged}`);
    }
    if (r.phases.tool_result && !r.phases.tool_result.pass) {
      reasons.push(`tool_result_missed=${r.phases.tool_result.missed.map((m) => m.category + ':' + JSON.stringify(m.value)).join(', ')}`);
    }
    console.log(`  ✗ ${trap.id} [${trap.category}] ${reasons.join(' | ')}`);
  } else if ((i + 1) % 20 === 0 || i === subset.length - 1) {
    console.log(`  ${i + 1}/${subset.length} traps complete (${results.filter((x) => x.pass).length} pass)`);
  }
}
const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);

const totals = {
  total: results.length,
  pass: results.filter((r) => r.pass).length,
  fail: results.filter((r) => !r.pass).length,
  wire_leaks: results.filter((r) => r.phases.input?.wireLeaks?.length).length,
};

const byCategory = {};
for (const r of results) {
  const c = r.category;
  if (!byCategory[c]) byCategory[c] = { total: 0, pass: 0, fail: 0 };
  byCategory[c].total += 1;
  byCategory[c][r.pass ? 'pass' : 'fail'] += 1;
}

console.log(`\n=== Summary (label=${runLabel}) ===`);
console.log(`  pass:        ${totals.pass}/${totals.total}`);
console.log(`  wire leaks:  ${totals.wire_leaks}`);
console.log(`  elapsed:     ${elapsedS}s`);
console.log(`  by category:`);
for (const [c, b] of Object.entries(byCategory).sort()) {
  console.log(`    ${c.padEnd(30)} ${b.pass}/${b.total}${b.fail ? ` (${b.fail} fail)` : ''}`);
}

mkdirSync(joinPath(repoRoot, 'reports'), { recursive: true });
const outPath = joinPath(repoRoot, `reports/traps-wire-${runLabel}.json`);
writeFileSync(outPath, JSON.stringify({
  generated_at: startedAt,
  label: runLabel,
  manifest_version: manifest.manifest_version,
  manifest_authored: manifest.authored,
  elapsed_seconds: Number(elapsedS),
  totals,
  by_category: byCategory,
  failed: results.filter((r) => !r.pass).map((r) => ({
    id: r.id, category: r.category, w_item: r.w_item,
    missed: r.phases.input?.missed,
    falsePositives: r.phases.input?.falsePositives,
    wireLeaks: r.phases.input?.wireLeaks,
    privilegedExpected: r.phases.input?.privilegedExpected,
    privilegedActual: r.phases.input?.detection?.privileged,
    tool_result_missed: r.phases.tool_result?.missed,
  })),
}, null, 2));

console.log(`\nReport: ${outPath}`);
console.log(`\n${totals.wire_leaks === 0 && totals.pass === totals.total ? '✅ ZERO LEAK' : '⚠ FAIL'}`);
process.exit(totals.pass === totals.total ? 0 : 1);
