import { join, resolve } from 'node:path';
import type {
  CalibrationRates,
  JudgeId,
  JudgePairResult,
  JudgeTransport,
  PriceTable,
} from '../types.js';
import { atomicWriteFileSync } from '../journal.js';
import {
  JudgeCalibrationError,
  runCalibration,
  type RunCalibrationOptions,
} from './calibration.js';
import type { JudgeAdapter } from './judgeRegistry.js';
import { judgeConfigHash } from './judgeRegistry.js';

export interface JudgeBakeoffEntry {
  adapter: JudgeAdapter;
  transport: JudgeTransport;
}

export interface JudgeBakeoffResult {
  judge_id: JudgeId;
  judge_config_hash: string;
  calibration_set_content_hash: string;
  run_started_at: string;
  calibration_pass: boolean;
  rates: CalibrationRates;
  failed_thresholds: Array<keyof CalibrationRates>;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms_total: number;
  latency_ms_mean: number;
}

export interface JudgeBakeoffReport {
  schema_version: 1;
  fixture_non_live: boolean;
  run_id: string;
  run_started_at: string;
  generated_at: string;
  calibration_set_content_hash: string;
  judge_config_hashes: Partial<Record<JudgeId, string>>;
  winner_judge_id: JudgeId | null;
  judges: JudgeBakeoffResult[];
}

function markdown(report: JudgeBakeoffReport): string {
  const lines = [
    '# Judge calibration bakeoff',
    '',
    `Run: \`${report.run_id}\``,
    '',
    `Winner: ${report.winner_judge_id ?? 'none'}`,
    '',
    '| Judge | Verdict | Winner accuracy | Hard-failure recall | Trap false-clear | Position inconsistency | Injection resistance | Schema validity | Input tokens | Output tokens | Cost USD | Mean latency ms |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const judge of report.judges) {
    lines.push([
      `| ${judge.judge_id}`,
      judge.calibration_pass ? 'PASS' : 'FAIL',
      judge.rates.winner_accuracy.toFixed(4),
      judge.rates.hard_failure_recall.toFixed(4),
      judge.rates.legal_trap_false_clear_rate.toFixed(4),
      judge.rates.position_inconsistency_rate.toFixed(4),
      judge.rates.injection_resistance.toFixed(4),
      judge.rates.schema_validity.toFixed(4),
      String(judge.input_tokens),
      String(judge.output_tokens),
      judge.cost_usd.toFixed(6),
      `${judge.latency_ms_mean.toFixed(2)} |`,
    ].join(' | '));
  }
  return `${lines.join('\n')}\n`;
}

function chooseWinner(judges: JudgeBakeoffResult[]): JudgeId | null {
  const passing = judges.filter((judge) => judge.calibration_pass);
  passing.sort((left, right) =>
    right.rates.winner_accuracy - left.rates.winner_accuracy ||
    right.rates.hard_failure_recall - left.rates.hard_failure_recall ||
    left.rates.legal_trap_false_clear_rate -
      right.rates.legal_trap_false_clear_rate ||
    left.rates.position_inconsistency_rate -
      right.rates.position_inconsistency_rate ||
    right.rates.injection_resistance - left.rates.injection_resistance ||
    right.rates.schema_validity - left.rates.schema_validity ||
    left.cost_usd - right.cost_usd ||
    left.latency_ms_mean - right.latency_ms_mean ||
    left.judge_id.localeCompare(right.judge_id)
  );
  return passing[0]?.judge_id ?? null;
}

export async function runJudgeBakeoff(options: {
  run_id: string;
  reports_root: string;
  pairs: RunCalibrationOptions['pairs'];
  entries: JudgeBakeoffEntry[];
  prices: PriceTable;
  calibration_set_content_hash: string;
  run_started_at: string;
  generated_at?: string;
  fixture_non_live: boolean;
  journal_results?: (judgeId: JudgeId) => JudgePairResult[];
}): Promise<{
  report: JudgeBakeoffReport;
  json_path: string;
  markdown_path: string;
}> {
  const judges: JudgeBakeoffResult[] = [];
  for (const entry of options.entries) {
    let calls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let latencyMs = 0;
    const measuredTransport: JudgeTransport = async (request) => {
      const response = await entry.transport(request);
      calls += 1;
      inputTokens += response.usage?.input_tokens ?? 0;
      outputTokens += response.usage?.output_tokens ?? 0;
      latencyMs += response.latency_ms ?? 0;
      return response;
    };
    let calibration;
    try {
      calibration = await runCalibration({
        pairs: options.pairs,
        transport: measuredTransport,
        adapter: entry.adapter,
        diagnostic_report_path: join(
          resolve(options.reports_root),
          options.run_id,
          `.failed-${entry.adapter.id.replaceAll('/', '_')}.json`,
        ),
        generated_at: options.generated_at,
        phase: 'judge_bakeoff',
      });
    } catch (error) {
      if (!(error instanceof JudgeCalibrationError)) throw error;
      calibration = error.report;
    }
    const journaled = options.journal_results?.(entry.adapter.id);
    if (journaled) {
      calls = journaled.length;
      inputTokens = journaled.reduce(
        (sum, result) => sum + result.input_tokens,
        0,
      );
      outputTokens = journaled.reduce(
        (sum, result) => sum + result.output_tokens,
        0,
      );
      latencyMs = journaled.reduce(
        (sum, result) => sum + result.latency_ms,
        0,
      );
    }
    const price = options.prices[entry.adapter.id];
    const cost = price
      ? (
          inputTokens * price.input_usd_per_mtok +
          outputTokens * price.output_usd_per_mtok
        ) / 1_000_000
      : 0;
    judges.push({
      judge_id: entry.adapter.id,
      judge_config_hash: judgeConfigHash(entry.adapter.id),
      calibration_set_content_hash: options.calibration_set_content_hash,
      run_started_at: options.run_started_at,
      calibration_pass: calibration.calibration_pass,
      rates: calibration.rates,
      failed_thresholds: calibration.failed_thresholds,
      calls,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      latency_ms_total: latencyMs,
      latency_ms_mean: calls === 0 ? 0 : latencyMs / calls,
    });
  }
  const report: JudgeBakeoffReport = {
    schema_version: 1,
    fixture_non_live: options.fixture_non_live,
    run_id: options.run_id,
    run_started_at: options.run_started_at,
    generated_at: options.generated_at ?? new Date().toISOString(),
    calibration_set_content_hash: options.calibration_set_content_hash,
    judge_config_hashes: Object.fromEntries(
      judges.map((judge) => [judge.judge_id, judge.judge_config_hash]),
    ),
    winner_judge_id: chooseWinner(judges),
    judges,
  };
  const directory = join(resolve(options.reports_root), options.run_id);
  const json_path = join(directory, 'judge-bakeoff.json');
  const markdown_path = join(directory, 'judge-bakeoff.md');
  atomicWriteFileSync(
    json_path,
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  atomicWriteFileSync(markdown_path, markdown(report), { mode: 0o600 });
  return { report, json_path, markdown_path };
}
