import * as nodeFs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type {
  CandidateJournal,
  CandidateResult,
  JudgeId,
  JudgePairResult,
  RoutingDecision,
} from './types.js';
import { sanitizeArtifactValue } from './hygiene.js';
import { EvaluationError } from './providers/types.js';

export interface DurableFs {
  mkdirSync(path: string, options: { recursive: true }): unknown;
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
  openSync(path: string, flags: string, mode?: number): number;
  writeSync(fd: number, data: string): number;
  fsyncSync(fd: number): void;
  closeSync(fd: number): void;
  renameSync(oldPath: string, newPath: string): void;
  unlinkSync?(path: string): void;
}

export type ProviderJournalRecord =
  | ({ record_type: 'candidate' } & CandidateResult)
  | ({
      record_type: 'classifier';
      journal_key: string;
      response_id: string;
      response_ids: string[];
      arm: 'anthropic_router';
      provider: 'anthropic';
      model: string;
      task_id: string;
      replicate: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number | null;
      latency_ms: number;
      stop_reason: 'classified' | 'fallback';
      error: string | null;
      classifier_verdict: RoutingDecision['classifier_verdict'];
      routed_model_id: string;
      classifier_fallback: boolean;
      classifier_attempts: number;
      escalation_reason: RoutingDecision['escalation_reason'];
      classifier_usage: RoutingDecision['classifier_usage'];
      assembled_input_tokens: number;
    });

export interface JudgeResultJournalRecord {
  record_type: 'judge';
  journal_key: string;
  phase: 'calibration' | 'candidate_judge' | 'judge_bakeoff';
  judge_id: JudgeId;
  pair_id: string;
  task_id: string;
  order: 'AB' | 'BA';
  pass_index: 1 | 2 | 3;
  result: JudgePairResult;
}

let atomicSequence = 0;

function safeClose(fs: DurableFs, fd: number | null): void {
  if (fd === null) return;
  try {
    fs.closeSync(fd);
  } catch {
    // Preserve the primary write/rename error.
  }
}

export function atomicWriteFileSync(
  path: string,
  data: string,
  options: { mode?: number; fs?: DurableFs } = {},
): void {
  const fs = options.fs ?? nodeFs;
  const target = resolve(path);
  fs.mkdirSync(dirname(target), { recursive: true });
  atomicSequence += 1;
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${process.pid}.${atomicSequence}.tmp`,
  );
  let fd: number | null = null;
  try {
    fd = fs.openSync(temporary, 'wx', options.mode ?? 0o600);
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temporary, target);
  } catch (error) {
    safeClose(fs, fd);
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync?.(temporary);
    } catch {
      // Preserve the primary error.
    }
    throw error;
  }
}

export function atomicWriteJsonlSync(
  path: string,
  records: unknown[],
  options: { mode?: number; fs?: DurableFs } = {},
): void {
  const data = records.length === 0
    ? ''
    : `${records.map((record) =>
      JSON.stringify(sanitizeArtifactValue(record))
    ).join('\n')}\n`;
  atomicWriteFileSync(path, data, options);
}

function classifierRecord(
  decision: RoutingDecision,
): ProviderJournalRecord {
  const responseIds = decision.classifier_response_ids ?? [];
  return {
    record_type: 'classifier',
    journal_key: decision.journal_key,
    response_id:
      responseIds.at(-1) ??
      `classifier-${decision.task_id}-${decision.replicate}-no-response`,
    response_ids: responseIds,
    arm: 'anthropic_router',
    provider: 'anthropic',
    model: decision.classifier_model,
    task_id: decision.task_id,
    replicate: decision.replicate,
    input_tokens: decision.classifier_usage.input_tokens,
    output_tokens: decision.classifier_usage.output_tokens,
    cost_usd: decision.classifier_cost_usd,
    latency_ms: decision.classifier_latency_ms,
    stop_reason: decision.classifier_fallback ? 'fallback' : 'classified',
    error: decision.error,
    classifier_verdict: decision.classifier_verdict,
    routed_model_id: decision.routed_model_id,
    classifier_fallback: decision.classifier_fallback,
    classifier_attempts: decision.classifier_attempts,
    escalation_reason: decision.escalation_reason,
    classifier_usage: decision.classifier_usage,
    assembled_input_tokens: decision.assembled_input_tokens,
  };
}

function parseJournal(path: string, fs: DurableFs): ProviderJournalRecord[] {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf8');
  return content
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as ProviderJournalRecord;
      } catch (error) {
        throw new EvaluationError(
          'INVALID_PROVIDER_JOURNAL',
          `Malformed provider journal line ${index + 1}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
}

export class FileCandidateJournal implements CandidateJournal {
  readonly path: string;
  readonly records: ProviderJournalRecord[];
  readonly #fs: DurableFs;
  readonly #byKey = new Map<string, ProviderJournalRecord>();
  readonly #candidates = new Map<string, CandidateResult>();

  constructor(
    path: string,
    options: { resume?: boolean; fs?: DurableFs } = {},
  ) {
    this.path = resolve(path);
    this.#fs = options.fs ?? nodeFs;
    this.#fs.mkdirSync(dirname(this.path), { recursive: true });
    if (!options.resume) {
      atomicWriteFileSync(this.path, '', { fs: this.#fs, mode: 0o600 });
    }
    this.records = parseJournal(this.path, this.#fs);
    for (const record of this.records) {
      if (
        !record ||
        typeof record !== 'object' ||
        typeof record.journal_key !== 'string' ||
        (record.record_type !== 'candidate' &&
          record.record_type !== 'classifier')
      ) {
        throw new EvaluationError(
          'INVALID_PROVIDER_JOURNAL',
          'Provider journal contains an invalid record',
        );
      }
      const expectedPrefix =
        `${record.task_id}|${record.arm}|replicate-${record.replicate}`;
      const valid =
        typeof record.response_id === 'string' &&
        typeof record.provider === 'string' &&
        typeof record.model === 'string' &&
        typeof record.task_id === 'string' &&
        Number.isInteger(record.replicate) &&
        typeof record.input_tokens === 'number' &&
        typeof record.output_tokens === 'number' &&
        (record.cost_usd === null || typeof record.cost_usd === 'number') &&
        typeof record.latency_ms === 'number' &&
        typeof record.stop_reason === 'string' &&
        (record.error === null || typeof record.error === 'string') &&
        record.journal_key === (
          record.record_type === 'candidate'
            ? expectedPrefix
            : `${expectedPrefix}|classifier`
        );
      if (!valid) {
        throw new EvaluationError(
          'INVALID_PROVIDER_JOURNAL',
          `Provider journal record has invalid required fields: ${record.journal_key}`,
        );
      }
      if (this.#byKey.has(record.journal_key)) {
        throw new EvaluationError(
          'DUPLICATE_JOURNAL_KEY',
          `Provider journal key already exists: ${record.journal_key}`,
        );
      }
      this.#byKey.set(record.journal_key, record);
      if (record.record_type === 'candidate') {
        const { record_type: _recordType, ...candidate } = record;
        this.#candidates.set(record.journal_key, candidate);
      }
    }
  }

  get(journalKey: string): CandidateResult | undefined {
    const record = this.#candidates.get(journalKey);
    return record ? structuredClone(record) : undefined;
  }

  append(record: CandidateResult): void {
    this.#append({
      record_type: 'candidate',
      ...record,
    });
  }

  appendRoutingDecision(decision: RoutingDecision): void {
    this.#append(classifierRecord(decision));
  }

  getRoutingDecision(journalKey: string): RoutingDecision | undefined {
    const record = this.#byKey.get(journalKey);
    if (!record || record.record_type !== 'classifier') return undefined;
    return {
      journal_key: record.journal_key,
      arm: 'anthropic_router',
      task_id: record.task_id,
      replicate: record.replicate,
      classifier_model: record.model,
      classifier_verdict: record.classifier_verdict,
      routed_model_id: record.routed_model_id,
      classifier_fallback: record.classifier_fallback,
      classifier_attempts: record.classifier_attempts,
      classifier_response_ids: [...record.response_ids],
      classifier_usage: structuredClone(record.classifier_usage),
      classifier_cost_usd: record.cost_usd,
      classifier_latency_ms: record.latency_ms,
      assembled_input_tokens: record.assembled_input_tokens,
      escalation_reason: record.escalation_reason,
      error: record.error,
    };
  }

  candidateCount(): number {
    return this.#candidates.size;
  }

  #append(record: ProviderJournalRecord): void {
    if (this.#byKey.has(record.journal_key)) {
      throw new EvaluationError(
        'DUPLICATE_JOURNAL_KEY',
        `Provider journal key already exists: ${record.journal_key}`,
      );
    }
    const clean = sanitizeArtifactValue(record) as ProviderJournalRecord;
    const line = `${JSON.stringify(clean)}\n`;
    let fd: number | null = null;
    try {
      fd = this.#fs.openSync(this.path, 'a', 0o600);
      this.#fs.writeSync(fd, line);
      this.#fs.fsyncSync(fd);
      this.#fs.closeSync(fd);
      fd = null;
    } catch (error) {
      safeClose(this.#fs, fd);
      throw error;
    }
    this.records.push(clean);
    this.#byKey.set(clean.journal_key, clean);
    if (clean.record_type === 'candidate') {
      const { record_type: _recordType, ...candidate } = clean;
      this.#candidates.set(clean.journal_key, candidate);
    }
  }
}

export function judgeResultJournalKey(options: {
  phase: JudgeResultJournalRecord['phase'];
  judge_id: JudgeId;
  pair_id: string;
  order: 'AB' | 'BA';
  pass_index: 1 | 2 | 3;
}): string {
  return [
    options.phase,
    options.judge_id,
    options.pair_id,
    options.order,
    `pass-${options.pass_index}`,
  ].join('|');
}

export class FileJudgeResultJournal {
  readonly path: string;
  readonly records: JudgeResultJournalRecord[];
  readonly #fs: DurableFs;
  readonly #byKey = new Map<string, JudgeResultJournalRecord>();

  constructor(
    path: string,
    options: { resume?: boolean; fs?: DurableFs } = {},
  ) {
    this.path = resolve(path);
    this.#fs = options.fs ?? nodeFs;
    this.#fs.mkdirSync(dirname(this.path), { recursive: true });
    if (!options.resume) {
      atomicWriteFileSync(this.path, '', { fs: this.#fs, mode: 0o600 });
    }
    this.records = this.#fs.existsSync(this.path)
      ? this.#fs.readFileSync(this.path, 'utf8')
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line, index) => {
            let record: JudgeResultJournalRecord;
            try {
              record = JSON.parse(line) as JudgeResultJournalRecord;
            } catch (error) {
              throw new EvaluationError(
                'INVALID_JUDGE_JOURNAL',
                `Malformed judge journal line ${index + 1}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
            return record;
          })
      : [];
    for (const record of this.records) {
      const expected = judgeResultJournalKey(record);
      if (
        record?.record_type !== 'judge' ||
        record.journal_key !== expected ||
        !record.result ||
        record.result.judge_id !== record.judge_id
      ) {
        throw new EvaluationError(
          'INVALID_JUDGE_JOURNAL',
          'Judge journal contains an invalid record',
        );
      }
      if (this.#byKey.has(record.journal_key)) {
        throw new EvaluationError(
          'DUPLICATE_JOURNAL_KEY',
          `Judge journal key already exists: ${record.journal_key}`,
        );
      }
      this.#byKey.set(record.journal_key, record);
    }
  }

  get(journalKey: string): JudgePairResult | undefined {
    const record = this.#byKey.get(journalKey);
    return record ? structuredClone(record.result) : undefined;
  }

  append(record: JudgeResultJournalRecord): void {
    if (this.#byKey.has(record.journal_key)) {
      throw new EvaluationError(
        'DUPLICATE_JOURNAL_KEY',
        `Judge journal key already exists: ${record.journal_key}`,
      );
    }
    const clean = sanitizeArtifactValue(record) as JudgeResultJournalRecord;
    const line = `${JSON.stringify(clean)}\n`;
    let fd: number | null = null;
    try {
      fd = this.#fs.openSync(this.path, 'a', 0o600);
      this.#fs.writeSync(fd, line);
      this.#fs.fsyncSync(fd);
      this.#fs.closeSync(fd);
      fd = null;
    } catch (error) {
      safeClose(this.#fs, fd);
      throw error;
    }
    this.records.push(clean);
    this.#byKey.set(clean.journal_key, clean);
  }
}
