import type {
  CandidateJournal,
  CandidateResult,
  CandidateRunConfig,
  EvalTask,
} from '../types.js';

export interface CandidateProvider {
  run(task: EvalTask, config: CandidateRunConfig): Promise<CandidateResult>;
}

export class EvaluationError extends Error {
  readonly error_code: string;
  readonly exit_code: 2;
  readonly details: Record<string, unknown>;

  constructor(
    error_code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'EvaluationError';
    this.error_code = error_code;
    this.exit_code = 2;
    this.details = details;
  }
}

export class InMemoryCandidateJournal implements CandidateJournal {
  readonly records: CandidateResult[] = [];
  readonly #byKey = new Map<string, CandidateResult>();

  get(journal_key: string): CandidateResult | undefined {
    return this.#byKey.get(journal_key);
  }

  append(record: CandidateResult): void {
    if (this.#byKey.has(record.journal_key)) {
      throw new EvaluationError(
        'DUPLICATE_JOURNAL_KEY',
        `Candidate journal key already exists: ${record.journal_key}`,
      );
    }
    this.#byKey.set(record.journal_key, record);
    this.records.push(record);
  }
}

export type {
  CandidateJournal,
  CandidateResult,
  CandidateRunConfig,
  EvalTask,
} from '../types.js';
