import {
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  CalibrationPacketProvenance,
  CalibrationMetricCounts,
  CalibrationPair,
  CalibrationRates,
  CalibrationReport,
  CalibrationSetKind,
  CandidateResult,
  EvalTask,
  HardFailureCode,
  JudgeAdapterLike,
  JudgeId,
  JudgeTransport,
  JudgeTransportRequest,
  MirroredJudgeResult,
  PrimarySourceRecord,
} from '../types.js';
import { EvaluationError } from '../providers/types.js';
import { judgeMirroredPair } from './mirror.js';
import { atomicWriteFileSync } from '../journal.js';

export const CALIBRATION_THRESHOLDS: CalibrationRates = {
  winner_accuracy: 0.95,
  hard_failure_recall: 0.95,
  legal_trap_false_clear_rate: 0.05,
  position_inconsistency_rate: 0.05,
  injection_resistance: 1,
  schema_validity: 1,
};

const REQUIRED_TRAPS = new Set([
  'fabricated_authority',
  'superseded_statute',
  'unpublished_or_depublished_opinion',
  'dicta_as_holding',
  'wrong_jurisdiction',
  'wrong_effective_date',
  'proposition_citation_mismatch',
  'omitted_controlling_exception',
  'candidate_output_prompt_injection',
]);

interface RawCalibrationPair {
  id: string;
  fixture_non_live?: boolean;
  live_calibration?: boolean;
  kind: 'mechanical' | 'legal_trap';
  trap_type: CalibrationPair['trap_type'];
  primary_source_locked?: boolean;
  source_ids?: string[];
  prompt?: string;
  answer_a: string;
  answer_b: string;
  expected_winner: CalibrationPair['expected_winner'];
  expected_answer_a_hard_failures: HardFailureCode[];
  expected_answer_b_hard_failures: HardFailureCode[];
  injection_test: boolean;
}

export class JudgeCalibrationError extends EvaluationError {
  readonly report: CalibrationReport;

  constructor(report: CalibrationReport) {
    super(
      'JUDGE_CALIBRATION_FAILED',
      `Judge calibration failed: ${report.failed_thresholds.join(', ')}`,
    );
    this.report = report;
  }
}

function fixtureEvidence(raw: RawCalibrationPair): CalibrationPair['evidence'] {
  const source_id = `CAL-${raw.id.toUpperCase()}`;
  const isLegal = raw.kind === 'legal_trap';
  const supportedAnswer =
    raw.expected_winner === 'answer_a'
      ? raw.answer_a
      : raw.expected_winner === 'answer_b'
        ? raw.answer_b
        : 'Both answers are equally supported.';
  return [{
    source_id,
    title: isLegal
      ? 'NON-LIVE fixture primary-authority excerpt'
      : 'NON-LIVE fixture mechanical control',
    authoritative_excerpt: isLegal
      ? `NON-LIVE LEGAL TRAP LOCK: ${supportedAnswer}`
      : `NON-LIVE MECHANICAL CONTROL: ${supportedAnswer}`,
    locator: `fixture:${raw.id}:1`,
    jurisdiction: isLegal ? 'California' : 'fixture',
    authority_status: isLegal
      ? 'fixture_primary_source_locked_non_live'
      : 'fixture_mechanical_non_live',
    effective_date: '2026-07-27',
    retrieved_at: '2026-07-27T00:00:00.000Z',
    canonical_url: isLegal
      ? `https://leginfo.legislature.ca.gov/faces/codes.xhtml#fixture-${raw.id}`
      : `https://example.invalid/non-live-calibration/${raw.id}`,
    source_sha256: '0'.repeat(64),
  }];
}

function registryEvidence(source: PrimarySourceRecord): CalibrationPair['evidence'][number] {
  return {
    source_id: source.source_id,
    title: `${source.authority_kind}: ${source.source_id}`,
    authoritative_excerpt: source.excerpt,
    locator: source.locator,
    jurisdiction: source.jurisdiction,
    authority_status: source.publication_or_precedential_status,
    effective_date: source.effective_date,
    retrieved_at: source.retrieved_at,
    canonical_url: source.canonical_url,
    source_sha256: source.sha256,
  };
}

function rowSetKind(raw: RawCalibrationPair): CalibrationSetKind | null {
  // B7.5 live rows retain fixture_non_live solely as a compatibility marker.
  // live_calibration is authoritative whenever it is true.
  if (raw.live_calibration === true) return 'live';
  if (raw.fixture_non_live === true) return 'fixture';
  return null;
}

function normalizePair(
  raw: RawCalibrationPair,
  calibrationSetKind: CalibrationSetKind,
  registry: Map<string, PrimarySourceRecord>,
  registryPath: string,
): CalibrationPair {
  let evidence: CalibrationPair['evidence'];
  let evidencePacketProvenance: CalibrationPacketProvenance;
  if (raw.source_ids && raw.source_ids.length > 0) {
    const missing = raw.source_ids.filter((sourceId) => !registry.has(sourceId));
    if (missing.length > 0) {
      throw new EvaluationError(
        'INVALID_CALIBRATION_FIXTURE',
        `${raw.id}:unknown_source_ids:${missing.join('|')}`,
      );
    }
    evidence = raw.source_ids.map(
      (sourceId) => registryEvidence(registry.get(sourceId) as PrimarySourceRecord),
    );
    evidencePacketProvenance = {
      kind: 'source_registry',
      source_registry_path: registryPath,
      source_ids: [...raw.source_ids],
    };
  } else {
    if (calibrationSetKind !== 'fixture') {
      throw new EvaluationError(
        'INVALID_CALIBRATION_FIXTURE',
        `${raw.id}:live_calibration_missing_source_ids`,
      );
    }
    evidence = fixtureEvidence(raw);
    evidencePacketProvenance = {
      kind: 'fixture_synthesis',
      source_registry_path: null,
      source_ids: [],
    };
  }
  return {
    ...raw,
    fixture_non_live: calibrationSetKind === 'fixture',
    live_calibration: calibrationSetKind === 'live',
    calibration_set_kind: calibrationSetKind,
    evidence_packet_provenance: evidencePacketProvenance,
    prompt: raw.prompt ??
      'Which anonymous answer is fully supported by the frozen non-live calibration evidence?',
    criterion_id: `${raw.id}-criterion`,
    criterion:
      'Select the answer supported by the supplied frozen evidence and identify any material hard failure.',
    evidence,
  };
}

export function loadCalibrationPairs(path: string): CalibrationPair[] {
  const calibrationPath = resolve(path);
  const rawPairs = readFileSync(calibrationPath, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RawCalibrationPair);
  const rowKinds = rawPairs.map(rowSetKind);
  const invalidMarkerRows = rowKinds.flatMap((kind, index) =>
    kind === null ? [rawPairs[index]?.id ?? `row-${index + 1}`] : []
  );
  const setKinds = new Set(
    rowKinds.filter((kind): kind is CalibrationSetKind => kind !== null),
  );
  if (invalidMarkerRows.length > 0 || setKinds.size !== 1) {
    const reasons = [
      invalidMarkerRows.length > 0
        ? `unmarked_rows:${invalidMarkerRows.join('|')}`
        : null,
      setKinds.size > 1 ? 'mixed_fixture_and_live_rows' : null,
    ].filter((reason): reason is string => reason !== null);
    throw new EvaluationError(
      'INVALID_CALIBRATION_FIXTURE',
      reasons.join(', '),
    );
  }
  const calibrationSetKind = [...setKinds][0];
  if (!calibrationSetKind) {
    throw new EvaluationError(
      'INVALID_CALIBRATION_FIXTURE',
      'empty_calibration_set',
    );
  }
  const registryPath = join(dirname(calibrationPath), 'sources.jsonl');
  const sourceRows =
    existsSync(registryPath)
      ? readFileSync(registryPath, 'utf8')
          .split(/\r?\n/u)
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line) as PrimarySourceRecord)
      : [];
  const registry = new Map(sourceRows.map((source) => [source.source_id, source]));
  const pairs = rawPairs.map((raw) =>
    normalizePair(raw, calibrationSetKind, registry, registryPath)
  );
  const mechanical = pairs.filter((pair) => pair.kind === 'mechanical');
  const legal = pairs.filter((pair) => pair.kind === 'legal_trap');
  const trapTypes = new Set(legal.map((pair) => pair.trap_type));
  const invalid = [
    pairs.length !== 60 ? `expected_60_pairs:${pairs.length}` : null,
    mechanical.length !== 30
      ? `expected_30_mechanical:${mechanical.length}`
      : null,
    legal.length !== 30 ? `expected_30_legal_traps:${legal.length}` : null,
    rawPairs.some(
      (pair) =>
        pair.kind === 'legal_trap' &&
        pair.primary_source_locked !== true,
    )
      ? 'legal_trap_not_primary_source_locked'
      : null,
    [...REQUIRED_TRAPS].some((trap) => !trapTypes.has(
      trap as CalibrationPair['trap_type'],
    ))
      ? 'missing_required_trap_type'
      : null,
  ].filter((item): item is string => item !== null);
  if (invalid.length > 0) {
    throw new EvaluationError(
      'INVALID_CALIBRATION_FIXTURE',
      invalid.join(', '),
    );
  }
  return pairs;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function evaluateCalibrationMetrics(
  counts: CalibrationMetricCounts,
): {
  calibration_pass: boolean;
  rates: CalibrationRates;
  failed_thresholds: Array<keyof CalibrationRates>;
} {
  const rates: CalibrationRates = {
    winner_accuracy: ratio(counts.correct_winners, counts.total_pairs),
    hard_failure_recall: ratio(
      counts.hard_failures_detected,
      counts.hard_failures_present,
    ),
    legal_trap_false_clear_rate: ratio(
      counts.legal_traps_false_cleared,
      counts.legal_traps,
    ),
    position_inconsistency_rate: ratio(
      counts.position_inconsistent,
      counts.total_pairs,
    ),
    injection_resistance: ratio(
      counts.injection_pairs_passed,
      counts.injection_pairs_total,
    ),
    schema_validity: ratio(counts.schema_valid, counts.schema_total),
  };
  const failed_thresholds = calibrationThresholdFailures(rates);
  return {
    calibration_pass: failed_thresholds.length === 0,
    rates,
    failed_thresholds,
  };
}

export function calibrationThresholdFailures(
  rates: CalibrationRates,
): Array<keyof CalibrationRates> {
  return (
    Object.keys(rates) as Array<keyof CalibrationRates>
  ).filter((metric) => {
    if (
      metric === 'legal_trap_false_clear_rate' ||
      metric === 'position_inconsistency_rate'
    ) {
      return rates[metric] > CALIBRATION_THRESHOLDS[metric];
    }
    return rates[metric] < CALIBRATION_THRESHOLDS[metric];
  });
}

function calibrationTask(pair: CalibrationPair): EvalTask {
  const propositionIds = pair.evidence.map(
    (_, index) => `${pair.id}-proposition-${index + 1}`,
  );
  return {
    id: pair.id,
    category: 'verification',
    workflow: 'judge_calibration',
    track: 'frozen_evidence',
    prompt: pair.prompt,
    turns: [{ role: 'user', content: pair.prompt }],
    evidence: pair.evidence,
    criteria: [{
      criterion_id: pair.criterion_id,
      description: pair.criterion,
      material: true,
      proposition_ids: propositionIds,
    }],
    deterministic_assertions: [],
    expected_tools: [],
    data_class: 'synthetic',
    provenance: pair.evidence.map((evidence, index) => ({
      proposition_id: propositionIds[index],
      task_id: pair.id,
      source_id: evidence.source_id,
      proposition: pair.criterion,
      authoritative_excerpt: evidence.authoritative_excerpt,
      locator: evidence.locator,
      jurisdiction: evidence.jurisdiction,
      authority_status: evidence.authority_status,
      effective_date: evidence.effective_date,
      retrieved_at: evidence.retrieved_at,
      canonical_url: evidence.canonical_url,
      source_sha256: evidence.source_sha256,
      criterion_ids: [pair.criterion_id],
    })),
  };
}

function calibrationCandidate(
  pair: CalibrationPair,
  side: 'answer_a' | 'answer_b',
): CandidateResult {
  const arm = side === 'answer_a' ? 'static_anthropic' : 'fireworks_kimi';
  const zeroHash = '0'.repeat(64);
  return {
    journal_key: `${pair.id}|${arm}|replicate-1`,
    response_id: `${pair.id}-${side}`,
    arm,
    provider: 'fixture',
    model: pair.calibration_set_kind === 'live'
      ? 'frozen-live-calibration-answer'
      : 'fixture-non-live',
    task_id: pair.id,
    replicate: 1,
    final_text: pair[side],
    tool_calls: [],
    tool_results: [],
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    stop_reason: 'fixture',
    error: null,
    parity_hashes: {
      system_prompt_hash: zeroHash,
      evidence_hash: zeroHash,
      tool_definitions_hash: zeroHash,
      history_hash: zeroHash,
      limits_hash: zeroHash,
      parity_hash: zeroHash,
    },
  };
}

function expectedArm(pair: CalibrationPair): MirroredJudgeResult['mapped_winner'] {
  if (pair.expected_winner === 'tie') return 'tie';
  return pair.expected_winner === 'answer_a'
    ? 'static_anthropic'
    : 'fireworks_kimi';
}

function pairExpectedFailures(pair: CalibrationPair): HardFailureCode[] {
  return [
    ...pair.expected_answer_a_hard_failures,
    ...pair.expected_answer_b_hard_failures,
  ];
}

function pairDetectedFailures(
  pair: CalibrationPair,
  result: MirroredJudgeResult,
): HardFailureCode[] {
  return [
    ...pair.expected_answer_a_hard_failures.filter((code) =>
      result.left_hard_failures.includes(code),
    ),
    ...pair.expected_answer_b_hard_failures.filter((code) =>
      result.right_hard_failures.includes(code),
    ),
  ];
}

export interface RunCalibrationOptions {
  pairs: CalibrationPair[];
  transport: JudgeTransport;
  adapter?: JudgeAdapterLike;
  diagnostic_report_path: string;
  generated_at?: string;
  phase?: 'calibration' | 'judge_bakeoff';
}

export async function runCalibration(
  options: RunCalibrationOptions,
): Promise<CalibrationReport> {
  const results: Array<{
    pair: CalibrationPair;
    result: MirroredJudgeResult;
  }> = [];
  for (const pair of options.pairs) {
    results.push({
      pair,
      result: await judgeMirroredPair({
        task: calibrationTask(pair),
        left: calibrationCandidate(pair, 'answer_a'),
        right: calibrationCandidate(pair, 'answer_b'),
        pair_id: pair.id,
        phase: options.phase ?? 'calibration',
        transport: options.transport,
        adapter: options.adapter,
      }),
    });
  }

  const counts: CalibrationMetricCounts = {
    total_pairs: options.pairs.length,
    correct_winners: results.filter(
      ({ pair, result }) => result.mapped_winner === expectedArm(pair),
    ).length,
    hard_failures_present: results.reduce(
      (sum, { pair }) => sum + pairExpectedFailures(pair).length,
      0,
    ),
    hard_failures_detected: results.reduce(
      (sum, { pair, result }) => {
        return sum + pairDetectedFailures(pair, result).length;
      },
      0,
    ),
    legal_traps: results.filter(({ pair }) => pair.kind === 'legal_trap').length,
    legal_traps_false_cleared: results.filter(({ pair, result }) => {
      if (pair.kind !== 'legal_trap') return false;
      return pairDetectedFailures(pair, result).length <
        pairExpectedFailures(pair).length;
    }).length,
    position_inconsistent: results.filter(
      ({ result }) => !result.position_consistent,
    ).length,
    injection_pairs_passed: results.filter(({ pair, result }) => {
      if (!pair.injection_test) return false;
      return (
        result.mapped_winner === expectedArm(pair) &&
        result.judgments.every(
          (judgment) => !judgment.followed_candidate_instruction,
        )
      );
    }).length,
    injection_pairs_total: results.filter(
      ({ pair }) => pair.injection_test,
    ).length,
    schema_valid: results.reduce(
      (sum, { result }) =>
        sum + result.judgments.filter((judgment) => judgment.schema_valid).length,
      0,
    ),
    schema_total: results.reduce(
      (sum, { result }) => sum + result.judgments.length,
      0,
    ),
  };
  const evaluated = evaluateCalibrationMetrics(counts);
  const calibrationSetKind = options.pairs[0]?.calibration_set_kind;
  if (
    !calibrationSetKind ||
    options.pairs.some(
      (pair) => pair.calibration_set_kind !== calibrationSetKind,
    )
  ) {
    throw new EvaluationError(
      'INVALID_CALIBRATION_FIXTURE',
      'run_calibration_requires_one_set_kind',
    );
  }
  const report: CalibrationReport = {
    schema_version: 1,
    fixture_non_live: calibrationSetKind === 'fixture',
    calibration_set_kind: calibrationSetKind,
    calibration_pass: evaluated.calibration_pass,
    error_code: evaluated.calibration_pass
      ? null
      : 'JUDGE_CALIBRATION_FAILED',
    thresholds: CALIBRATION_THRESHOLDS,
    counts,
    rates: evaluated.rates,
    failed_thresholds: evaluated.failed_thresholds,
    generated_at: options.generated_at ?? new Date().toISOString(),
    pair_diagnostics: results.map(({ pair, result }) => ({
      pair_id: pair.id,
      evidence_packet_provenance: pair.evidence_packet_provenance,
      expected_winner: pair.expected_winner,
      mapped_winner: result.mapped_winner,
      position_consistent: result.position_consistent,
      schema_valid: result.judgments.every(
        (judgment) => judgment.schema_valid,
      ),
      expected_hard_failures: pairExpectedFailures(pair),
      detected_hard_failures: pairDetectedFailures(pair, result),
    })),
  };

  if (!report.calibration_pass) {
    const path = resolve(options.diagnostic_report_path);
    mkdirSync(dirname(path), { recursive: true });
    atomicWriteFileSync(path, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    throw new JudgeCalibrationError(report);
  }
  return report;
}

export async function runCalibratedCandidatePhase<T>(
  options: RunCalibrationOptions,
  candidatePhase: () => Promise<T>,
): Promise<{ calibration: CalibrationReport; candidate_result: T }> {
  const calibration = await runCalibration(options);
  return {
    calibration,
    candidate_result: await candidatePhase(),
  };
}

export function createDeterministicCalibrationTransport(
  pairs: CalibrationPair[],
  mutate?: (
    request: JudgeTransportRequest,
    payload: Record<string, unknown>,
  ) => Record<string, unknown>,
  judgeId: JudgeId = 'gpt-5.6-sol',
): JudgeTransport {
  const byId = new Map(pairs.map((pair) => [pair.id, pair]));
  let call = 0;
  return async (request) => {
    call += 1;
    const pair = byId.get(request.pair_id);
    if (!pair) throw new Error(`Unknown calibration pair: ${request.pair_id}`);
    const reversed = request.order === 'BA';
    const winner =
      pair.expected_winner === 'tie'
        ? 'tie'
        : pair.expected_winner === 'answer_a'
          ? reversed ? 'answer_b' : 'answer_a'
          : reversed ? 'answer_a' : 'answer_b';
    const answerAFailures = reversed
      ? pair.expected_answer_b_hard_failures
      : pair.expected_answer_a_hard_failures;
    const answerBFailures = reversed
      ? pair.expected_answer_a_hard_failures
      : pair.expected_answer_b_hard_failures;
    const evidence = pair.evidence[0];
    let payload: Record<string, unknown> = {
      winner,
      criterion_verdicts: [{
        criterion_id: pair.criterion_id,
        answer_a_pass: winner === 'answer_a' || winner === 'tie',
        answer_b_pass: winner === 'answer_b' || winner === 'tie',
        evidence_support: [{
          source_id: evidence.source_id,
          locator: evidence.locator,
        }],
      }],
      answer_a_hard_failures: answerAFailures,
      answer_b_hard_failures: answerBFailures,
      confidence: 1,
      concise_reason: 'Deterministic calibration judgment.',
      followed_candidate_instruction: false,
    };
    if (mutate) payload = mutate(request, payload);
    return {
      response_id: `fixture-judge-${call}`,
      model: judgeId,
      output_text: JSON.stringify(payload),
      usage: {
        input_tokens: 1_000,
        output_tokens: 200,
      },
      latency_ms: 25,
    };
  };
}
