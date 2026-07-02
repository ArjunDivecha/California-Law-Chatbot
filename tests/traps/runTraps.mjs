/**
 * 100-trap runner — Step 2/3 of the V2 sanitization-first plan.
 *
 * Loads tests/traps/manifest-v1.json, runs each trap's `input` through the
 * sanitization pipeline's `analyze()`, and checks:
 *   (a) every must_redact entry is ≥50%-overlap-covered by a span of the
 *       matching category in the pipeline output,
 *   (b) no must_not_redact substring intersects any predicted span,
 *   (c) result.privileged === expected_privileged.
 *
 * For traps with tool_result_phase=true, also runs analyze() against
 * simulated_tool_result and applies (a)+(b) to must_redact_in_tool_result.
 * (Pre-wrapper baseline — the dedicated tool-output sanitization wrapper
 * lands later per audit §8 item #8; this gives us starting telemetry.)
 *
 * Writes a JSON report to reports/traps-baseline-{YYYY-MM-DD}.json and
 * prints a human summary to stdout.
 *
 * Usage:  yarn test:traps
 *         yarn test:traps --id T-W1-001    # single trap
 *         yarn test:traps --category compound_identifier
 *         yarn test:traps --w-item W1
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Load manifest + sanitization pipeline
// ---------------------------------------------------------------------------

const manifestPath = joinPath(__dirname, 'manifest-v1.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const { analyze } = await import(joinPath(repoRoot, 'api/_shared/sanitization/index.ts'));

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const filterId = flag('--id');
const filterCategory = flag('--category');
const filterWItem = flag('--w-item');

const subset = manifest.traps.filter((t) => {
  if (filterId && t.id !== filterId) return false;
  if (filterCategory && t.category !== filterCategory) return false;
  if (filterWItem && t.w_item !== filterWItem) return false;
  return true;
});

// ---------------------------------------------------------------------------
// Matching primitives
// ---------------------------------------------------------------------------

function findRange(text, value) {
  const idx = text.indexOf(value);
  if (idx < 0) return null;
  return [idx, idx + value.length];
}

function overlap(a, b) {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return Math.max(0, end - start);
}

/**
 * Check whether the spans cover the `value` (of `category`) with ≥50% overlap.
 * Coverage can be assembled from MULTIPLE spans of the same category — this
 * handles the compound-name fragmentation case where one expected name span
 * is detected as two adjacent spans.
 */
function isCovered(spans, value, category, text) {
  const range = findRange(text, value);
  if (!range) {
    return { covered: false, reason: 'value-not-found-in-input', range: null };
  }
  const valLen = range[1] - range[0];

  // Sum overlapping length contributed by ALL same-category spans.
  let totalOverlap = 0;
  const contributors = [];
  for (const sp of spans) {
    if (sp.category !== category) continue;
    const o = overlap([sp.start, sp.end], range);
    if (o > 0) {
      totalOverlap += o;
      contributors.push({ start: sp.start, end: sp.end, raw: sp.raw, label: sp.label });
    }
  }
  const frac = totalOverlap / valLen;
  return {
    covered: frac >= 0.5,
    overlapFrac: frac,
    contributors,
    range,
    reason: frac >= 0.5 ? null : contributors.length === 0 ? 'no-matching-category-span' : 'insufficient-overlap',
  };
}

function findViolation(spans, substr, text) {
  const idx = text.indexOf(substr);
  if (idx < 0) return null; // substring not in input
  const range = [idx, idx + substr.length];
  for (const sp of spans) {
    if (overlap([sp.start, sp.end], range) > 0) {
      return { substr, predictedSpan: { start: sp.start, end: sp.end, category: sp.category, raw: sp.raw } };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Trap evaluation
// ---------------------------------------------------------------------------

function evalPhase(trap, text, mustRedact, mustNotRedact, expectedPrivileged) {
  const result = analyze(text);
  const spans = result.spans ?? [];

  const missed = [];
  for (const entry of mustRedact ?? []) {
    const cov = isCovered(spans, entry.value, entry.category, text);
    if (!cov.covered) {
      missed.push({ ...entry, reason: cov.reason, overlapFrac: cov.overlapFrac });
    }
  }

  const falsePositives = [];
  for (const sub of mustNotRedact ?? []) {
    const v = findViolation(spans, sub, text);
    if (v) falsePositives.push(v);
  }

  const privilegedMatches =
    expectedPrivileged === undefined
      ? null
      : Boolean(result.privileged) === Boolean(expectedPrivileged);

  return {
    spans,
    privileged: Boolean(result.privileged),
    confidence: result.confidence,
    missed,
    falsePositives,
    privilegedMatches,
    privilegedExpected: expectedPrivileged,
    pass:
      missed.length === 0 &&
      falsePositives.length === 0 &&
      (privilegedMatches === null || privilegedMatches),
  };
}

function evaluate(trap) {
  const phases = {};

  // Input phase — always run.
  phases.input = evalPhase(
    trap,
    trap.input,
    trap.must_redact,
    trap.must_not_redact,
    trap.expected_privileged,
  );

  // Tool-result phase — only when declared.
  if (trap.tool_result_phase === true) {
    phases.tool_result = evalPhase(
      trap,
      trap.simulated_tool_result,
      trap.must_redact_in_tool_result,
      [], // no must_not_redact for tool results in v1
      undefined, // privileged check only applies to input
    );
  }

  const pass = phases.input.pass && (phases.tool_result?.pass ?? true);
  return { id: trap.id, category: trap.category, w_item: trap.w_item, pass, phases };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const startedAt = new Date().toISOString();
const results = subset.map(evaluate);

const totals = {
  total: results.length,
  pass: results.filter((r) => r.pass).length,
  fail: results.filter((r) => !r.pass).length,
};

const byCategory = {};
for (const r of results) {
  const c = r.category;
  if (!byCategory[c]) byCategory[c] = { total: 0, pass: 0, fail: 0 };
  byCategory[c].total += 1;
  byCategory[c][r.pass ? 'pass' : 'fail'] += 1;
}

const failedDetail = results
  .filter((r) => !r.pass)
  .map((r) => {
    const reasons = [];
    for (const phaseName of ['input', 'tool_result']) {
      const p = r.phases[phaseName];
      if (!p || p.pass) continue;
      if (p.missed?.length) {
        reasons.push(
          `${phaseName}: missed ${p.missed.map((m) => `${m.category}:"${m.value}" (${m.reason})`).join('; ')}`,
        );
      }
      if (p.falsePositives?.length) {
        reasons.push(
          `${phaseName}: false-positive on ${p.falsePositives.map((fp) => `"${fp.substr}" → span ${fp.predictedSpan.category}:"${fp.predictedSpan.raw}"`).join('; ')}`,
        );
      }
      if (p.privilegedMatches === false) {
        reasons.push(`${phaseName}: privileged=${p.privileged} but expected=${p.privilegedExpected}`);
      }
    }
    return { id: r.id, category: r.category, w_item: r.w_item, reasons };
  });

// ---------------------------------------------------------------------------
// Write JSON report
// ---------------------------------------------------------------------------

const today = startedAt.slice(0, 10);
const reportsDir = joinPath(repoRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });
const reportPath = joinPath(reportsDir, `traps-baseline-${today}.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      manifest_version: manifest.manifest_version,
      ran_at: startedAt,
      filter: { id: filterId, category: filterCategory, w_item: filterWItem },
      totals,
      by_category: byCategory,
      results,
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0');
console.log('────────────────────────────────────────────────────────────');
console.log(`100-trap runner — manifest v${manifest.manifest_version}  (${startedAt})`);
console.log(`Filter: ${filterId ?? filterCategory ?? filterWItem ?? '(none — full suite)'}`);
console.log('────────────────────────────────────────────────────────────');
console.log(`TOTAL:    ${totals.pass}/${totals.total} pass  (${pct(totals.pass, totals.total)}%)`);
console.log(`FAILED:   ${totals.fail}`);
console.log('');
console.log('By category:');
for (const [c, v] of Object.entries(byCategory)) {
  console.log(`  ${c.padEnd(32)} ${String(v.pass).padStart(3)}/${String(v.total).padStart(3)}  (${pct(v.pass, v.total)}%)`);
}
if (failedDetail.length) {
  console.log('');
  console.log(`Failure detail (${failedDetail.length}):`);
  for (const f of failedDetail) {
    console.log(`  [${f.id}] (${f.w_item} / ${f.category})`);
    for (const r of f.reasons) {
      console.log(`     - ${r}`);
    }
  }
}
console.log('');
console.log(`Report: ${reportPath}`);
console.log(`        file://${encodeURI(reportPath)}`);
console.log('────────────────────────────────────────────────────────────');

// Step 3 gate: exit 0 only when zero failures.
process.exit(totals.fail === 0 ? 0 : 1);
