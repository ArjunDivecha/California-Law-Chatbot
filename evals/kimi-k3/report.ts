import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stableJson } from './providers/shared.js';
import { sanitizeArtifactValue } from './hygiene.js';
import { atomicWriteFileSync } from './journal.js';
import type { MetricSummary } from './aggregate.js';
import type { ArmEfficiency, EfficiencyResult } from './efficiency.js';
import type { RecommendationResult } from './recommend.js';

export interface EvaluationSummary {
  schema_version: number;
  run_id: string;
  mode: string;
  generated_at: string;
  bootstrap: { seed: number; resamples: number };
  endpoints: Record<string, unknown>;
  tracks: Record<string, unknown>;
  metrics: {
    overall: Record<string, MetricSummary>;
    by_category: Record<string, Record<string, MetricSummary>>;
  };
  efficiency: EfficiencyResult;
  recommendations: RecommendationResult[];
  missing_cells: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WriteReportOptions {
  reports_root: string;
  run_id: string;
  summary: EvaluationSummary;
  prior_summary?: EvaluationSummary | null;
}

export interface ReportPaths {
  run_directory: string;
  summary_path: string;
  report_path: string;
  latest_path: string;
}

function prettyStableJson(value: unknown): string {
  return `${JSON.stringify(JSON.parse(stableJson(value)), null, 2)}\n`;
}

function valueAt(root: unknown, path: string[]): unknown {
  let value = root;
  for (const key of path) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function display(current: unknown, prior: unknown): string {
  if (current === null || current === undefined || Number.isNaN(current)) {
    if (prior !== null && prior !== undefined && !Number.isNaN(prior)) {
      return `${display(prior, undefined)}*`;
    }
    return '—';
  }
  if (typeof current === 'number') {
    return Number.isInteger(current)
      ? String(current)
      : current.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '');
  }
  if (typeof current === 'boolean') return current ? 'yes' : 'no';
  if (Array.isArray(current)) return current.length === 0 ? '—' : current.join(', ');
  return String(current);
}

function markdownValue(current: unknown, prior: unknown): unknown {
  if (current === null || current === undefined) return display(current, prior);
  if (Array.isArray(current)) {
    const old = Array.isArray(prior) ? prior : [];
    return current.map((item, index) => markdownValue(item, old[index]));
  }
  if (current && typeof current === 'object') {
    const old =
      prior && typeof prior === 'object'
        ? prior as Record<string, unknown>
        : {};
    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>).map(([key, value]) => [
        key,
        markdownValue(value, old[key]),
      ]),
    );
  }
  return current;
}

function markdownJson(current: unknown, prior: unknown): string {
  return JSON.stringify(markdownValue(current, prior), null, 2);
}

function metricRows(
  metrics: Record<string, MetricSummary>,
  prior: EvaluationSummary | null | undefined,
  priorPath: string[],
): string[] {
  const rows = [
    '| Arm | Tasks | Complete | All-pass | Criterion-pass | Material hard failure | Pairwise win (non-ties) |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const [arm, values] of Object.entries(metrics).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const priorValues = valueAt(prior, [...priorPath, arm]) as
      | MetricSummary
      | undefined;
    rows.push(
      `| ${arm} | ${display(values.task_count, priorValues?.task_count)} | ` +
      `${display(values.complete_task_count, priorValues?.complete_task_count)} | ` +
      `${display(values.all_pass_rate, priorValues?.all_pass_rate)} | ` +
      `${display(values.criterion_pass_rate, priorValues?.criterion_pass_rate)} | ` +
      `${display(values.material_hard_failure_rate, priorValues?.material_hard_failure_rate)} | ` +
      `${display(values.pairwise_win_rate_non_ties, priorValues?.pairwise_win_rate_non_ties)} |`,
    );
  }
  return rows;
}

function efficiencyRows(
  arms: Record<string, ArmEfficiency>,
  prior: EvaluationSummary | null | undefined,
): string[] {
  const rows = [
    '| Arm | Median latency ms | P95 latency ms | Mean input tokens | Mean output tokens | Mean cost/task USD | Cost/all-pass task USD |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const [arm, values] of Object.entries(arms).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const old = valueAt(prior, ['efficiency', 'arms', arm]) as
      | ArmEfficiency
      | undefined;
    rows.push(
      `| ${arm} | ${display(values.median_latency_ms, old?.median_latency_ms)} | ` +
      `${display(values.p95_latency_ms, old?.p95_latency_ms)} | ` +
      `${display(values.mean_input_tokens, old?.mean_input_tokens)} | ` +
      `${display(values.mean_output_tokens, old?.mean_output_tokens)} | ` +
      `${display(values.mean_cost_per_task_usd, old?.mean_cost_per_task_usd)} | ` +
      `${display(values.cost_per_all_pass_task_usd, old?.cost_per_all_pass_task_usd)} |`,
    );
  }
  return rows;
}

export function writeEvaluationReport(
  options: WriteReportOptions,
): ReportPaths {
  const reportsRoot = resolve(options.reports_root);
  const runDirectory = join(reportsRoot, options.run_id);
  mkdirSync(runDirectory, { recursive: true });
  const clean = sanitizeArtifactValue(options.summary) as EvaluationSummary;
  const summaryPath = join(runDirectory, 'summary.json');
  const reportPath = join(runDirectory, 'report.md');
  const latestPath = join(reportsRoot, 'latest.json');
  atomicWriteFileSync(summaryPath, prettyStableJson(clean), { mode: 0o600 });
  const benchmarkIntegrity =
    clean.benchmark_integrity as
      | {
          attestation_reviewer_ids?: string[];
          attestation_kind?: 'machine_only' | 'human' | 'mixed';
        }
      | undefined;
  const reviewerIds = benchmarkIntegrity?.attestation_reviewer_ids ?? [];
  const attestationKind = benchmarkIntegrity?.attestation_kind ??
    clean.attestation_kind;
  const attestationDisclosure = clean.fixture_non_live === true
    ? `Benchmark attestation: non-live fixture-only records (${
        reviewerIds.join(', ') || 'none'
      }); zero human review`
    : attestationKind === 'machine_only'
      ? `Benchmark attestation: machine-only (cross-vendor LLM verifiers ${
          reviewerIds.join(', ')
        }); zero human review`
      : attestationKind === 'mixed'
        ? `Benchmark attestation: mixed machine and human review (${
            reviewerIds.join(', ')
          })`
        : `Benchmark attestation: human review (${
            reviewerIds.join(', ') || 'reviewer ids unavailable'
          })`;

  const markdown: string[] = [
    '# Kimi K3 California-law screening evaluation',
    '',
    `Run: ${clean.run_id}`,
    `Mode: ${clean.mode}`,
    `Bootstrap: seeded task-cluster resampling (${clean.bootstrap.seed}; ${clean.bootstrap.resamples} resamples)`,
    '',
    `**${attestationDisclosure}**`,
    '',
    'This offline screening report does not authorize a production provider or model replacement.',
    '',
    '## Primary endpoint — task-level all-pass delta',
    '',
    'One-sided 95% lower bounds are evaluated separately for each challenger.',
    '',
    '```json',
    markdownJson(
      (clean.endpoints as Record<string, unknown>).primary ?? {},
      valueAt(options.prior_summary, ['endpoints', 'primary']),
    ),
    '```',
    '',
    '## Safety co-primary endpoint — material-hard-failure delta',
    '',
    'One-sided 95% upper bounds are evaluated separately for each challenger.',
    '',
    '```json',
    markdownJson(
      (clean.endpoints as Record<string, unknown>).safety ?? {},
      valueAt(options.prior_summary, ['endpoints', 'safety']),
    ),
    '```',
    '',
    '## Secondary descriptive endpoints',
    '',
    'Criterion pass, pairwise preference, latency, token use, and cost are descriptive and cannot rescue a failed primary or safety gate.',
    '',
    '## Frozen Evidence track',
    '',
    'Model-only reasoning over identical frozen evidence with no live tools.',
    '',
    '```json',
    markdownJson(
      clean.tracks.frozen_evidence ?? {},
      valueAt(options.prior_summary, ['tracks', 'frozen_evidence']),
    ),
    '```',
    '',
    '## Shared Agent track',
    '',
    'Only shared application-owned California-law tools are permitted.',
    '',
    '```json',
    markdownJson(
      clean.tracks.shared_agent ?? {},
      valueAt(options.prior_summary, ['tracks', 'shared_agent']),
    ),
    '```',
    '',
    '## Overall metrics by arm',
    '',
    ...metricRows(clean.metrics.overall, options.prior_summary, [
      'metrics',
      'overall',
    ]),
    '',
    '## Category metrics',
    '',
  ];
  for (const [category, metrics] of Object.entries(
    clean.metrics.by_category,
  ).sort(([left], [right]) => left.localeCompare(right))) {
    markdown.push(
      `### ${category}`,
      '',
      ...metricRows(metrics, options.prior_summary, [
        'metrics',
        'by_category',
        category,
      ]),
      '',
    );
  }
  markdown.push(
    '## Efficiency endpoints and paired deltas',
    '',
    ...efficiencyRows(clean.efficiency.arms, options.prior_summary),
    '',
    '### Paired deltas versus static_anthropic',
    '',
    '```json',
    markdownJson(
      clean.efficiency.paired_deltas_vs_static_anthropic,
      valueAt(options.prior_summary, [
        'efficiency',
        'paired_deltas_vs_static_anthropic',
      ]),
    ),
    '```',
    '',
    '## Router routing mix',
    '',
    'Includes pool model/category mix, classifier overhead, and fallback rate.',
    '',
    '```json',
    markdownJson(
      clean.efficiency.routing_mix,
      valueAt(options.prior_summary, ['efficiency', 'routing_mix']),
    ),
    '```',
    '',
    '## Missing, failed, and ungradable cells',
    '',
    'Cells remain visible and are never silently dropped.',
    '',
    '```json',
    markdownJson(
      clean.missing_cells,
      valueAt(options.prior_summary, ['missing_cells']),
    ),
    '```',
    '',
    '## Recommendations',
    '',
  );
  for (const recommendation of clean.recommendations) {
    markdown.push(
      `- ${display(recommendation.arm, undefined)}: ` +
      `${display(recommendation.recommendation, undefined)}` +
      (recommendation.reason_code
        ? ` (${display(recommendation.reason_code, undefined)})`
        : ''),
    );
  }
  markdown.push(
    '',
    'Undefined values are shown as —. A stale retained value, when supplied from a prior summary, has a trailing asterisk.',
    '',
  );
  atomicWriteFileSync(reportPath, markdown.join('\n'), { mode: 0o600 });
  atomicWriteFileSync(latestPath, prettyStableJson({
    run_id: options.run_id,
    summary_path: `${options.run_id}/summary.json`,
    report_path: `${options.run_id}/report.md`,
  }), { mode: 0o600 });
  return {
    run_directory: runDirectory,
    summary_path: summaryPath,
    report_path: reportPath,
    latest_path: latestPath,
  };
}
