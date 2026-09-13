import type {
  BenchmarkAttestation,
  EvalCategory,
  EvalTask,
} from './types.js';
import { EVAL_CATEGORIES } from './types.js';
import { sha256 } from './providers/shared.js';
import { EvaluationError } from './providers/types.js';

export const CANONICAL_DATASET_COUNTS: Record<EvalCategory, number> = {
  research: 30,
  drafting: 25,
  verification: 20,
  multi_turn: 15,
  abstention_adversarial: 20,
  long_context: 10,
};

export const FIXTURE_DATASET_COUNTS: Record<EvalCategory, number> = {
  research: 2,
  drafting: 2,
  verification: 2,
  multi_turn: 2,
  abstention_adversarial: 2,
  long_context: 2,
};

export const MACHINE_ATTESTATION_REVIEWER_IDS = [
  'verifier-claude-opus-5',
  'verifier-gpt-5.6-sol',
] as const;

export type AttestationKind = 'machine_only' | 'human' | 'mixed';

export function classifyAttestationKind(
  reviewerIds: string[],
): AttestationKind {
  const registered = new Set<string>(MACHINE_ATTESTATION_REVIEWER_IDS);
  const machineCount = reviewerIds.filter((id) => registered.has(id)).length;
  if (reviewerIds.length > 0 && machineCount === reviewerIds.length) {
    return 'machine_only';
  }
  return machineCount > 0 ? 'mixed' : 'human';
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function taskContentHash(task: EvalTask): string {
  const { task_content_sha256: _ignored, ...content } = task;
  return sha256(content);
}

export function benchmarkDatasetHash(tasks: EvalTask[]): string {
  return sha256(tasks);
}

export function benchmarkPropositionHashes(task: EvalTask): string[] {
  return task.provenance.map((proposition) => sha256(proposition)).sort();
}

export function benchmarkSourceHashes(task: EvalTask): string[] {
  return [...new Set(
    task.evidence.map((evidence) => evidence.source_sha256),
  )].sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function distribution(tasks: EvalTask[]): Record<EvalCategory, number> {
  const counts = Object.fromEntries(
    EVAL_CATEGORIES.map((category) => [category, 0]),
  ) as Record<EvalCategory, number>;
  for (const task of tasks) {
    if (EVAL_CATEGORIES.includes(task.category)) counts[task.category] += 1;
  }
  return counts;
}

export interface PartialDatasetProgressReport {
  validation_pass: boolean;
  canonical_count_gate_pass: boolean;
  task_count: number;
  target_task_count: number;
  remaining_task_count: number;
  category_counts: Record<EvalCategory, number>;
  target_category_counts: Record<EvalCategory, number>;
  remaining_category_counts: Record<EvalCategory, number>;
  primary_source_grounded_tasks: number;
  unsupported_propositions: number;
  errors: string[];
}

export function validatePartialDataset(
  tasks: EvalTask[],
): PartialDatasetProgressReport {
  const errors: string[] = [];
  const ids = new Set<string>();
  let grounded = 0;
  let unsupported = 0;
  for (const task of tasks) {
    const taskErrors: string[] = [];
    if (!task || typeof task !== 'object' || typeof task.id !== 'string') {
      errors.push('invalid_task_record');
      continue;
    }
    if (ids.has(task.id)) taskErrors.push('duplicate_task_id');
    ids.add(task.id);
    if (!EVAL_CATEGORIES.includes(task.category)) {
      taskErrors.push('invalid_category');
    }
    if (!['frozen_evidence', 'shared_agent'].includes(task.track)) {
      taskErrors.push('invalid_track');
    }
    if (!['public', 'synthetic'].includes(task.data_class)) {
      taskErrors.push('invalid_data_class');
    }
    if (
      !Array.isArray(task.evidence) ||
      !Array.isArray(task.criteria) ||
      !Array.isArray(task.provenance) ||
      task.evidence.length === 0 ||
      task.criteria.length === 0 ||
      task.provenance.length === 0
    ) {
      taskErrors.push('missing_integrity_records');
    } else {
      const evidenceById = new Map(
        task.evidence.map((record) => [record.source_id, record]),
      );
      const propositionById = new Map(
        task.provenance.map((record) => [record.proposition_id, record]),
      );
      for (const evidence of task.evidence) {
        if (
          !evidence.source_id ||
          !evidence.authoritative_excerpt ||
          !evidence.locator ||
          !evidence.jurisdiction ||
          !evidence.authority_status ||
          !evidence.effective_date ||
          !evidence.retrieved_at ||
          !/^https:\/\//u.test(evidence.canonical_url) ||
          evidence.source_sha256 !== sha256(evidence.authoritative_excerpt)
        ) {
          taskErrors.push(`invalid_source:${evidence.source_id}`);
        }
      }
      for (const proposition of task.provenance) {
        const evidence = evidenceById.get(proposition.source_id);
        const invalid =
          proposition.task_id !== task.id ||
          !proposition.proposition ||
          !proposition.authoritative_excerpt ||
          !evidence ||
          !normalizeWhitespace(evidence.authoritative_excerpt).includes(
            normalizeWhitespace(proposition.authoritative_excerpt),
          ) ||
          proposition.locator !== evidence.locator ||
          proposition.jurisdiction !== evidence.jurisdiction ||
          proposition.authority_status !== evidence.authority_status ||
          proposition.effective_date !== evidence.effective_date ||
          proposition.retrieved_at !== evidence.retrieved_at ||
          proposition.source_sha256 !== evidence.source_sha256 ||
          proposition.canonical_url !== evidence.canonical_url ||
          !Array.isArray(proposition.criterion_ids) ||
          proposition.criterion_ids.length === 0;
        if (invalid) {
          unsupported += 1;
          taskErrors.push(
            `unsupported_proposition:${proposition.proposition_id}`,
          );
        }
      }
      for (const criterion of task.criteria) {
        if (
          !Array.isArray(criterion.proposition_ids) ||
          (criterion.material && criterion.proposition_ids.length === 0) ||
          criterion.proposition_ids.some((id) => {
            const proposition = propositionById.get(id);
            return !proposition ||
              !proposition.criterion_ids.includes(criterion.criterion_id);
          })
        ) {
          taskErrors.push(`unsupported_criterion:${criterion.criterion_id}`);
        }
      }
      if (
        task.task_content_sha256 !== undefined &&
        task.task_content_sha256 !== taskContentHash(task)
      ) {
        taskErrors.push('task_content_hash_mismatch');
      }
    }
    if (taskErrors.length === 0) grounded += 1;
    errors.push(...taskErrors.map((error) => `${task.id}:${error}`));
  }
  const counts = distribution(tasks);
  for (const category of EVAL_CATEGORIES) {
    if (counts[category] > CANONICAL_DATASET_COUNTS[category]) {
      errors.push(`category_overflow:${category}`);
    }
  }
  const target = Object.values(CANONICAL_DATASET_COUNTS).reduce(
    (sum, value) => sum + value,
    0,
  );
  const canonicalCountGatePass =
    tasks.length === target &&
    EVAL_CATEGORIES.every(
      (category) =>
        counts[category] === CANONICAL_DATASET_COUNTS[category],
    );
  return {
    validation_pass: errors.length === 0,
    canonical_count_gate_pass: canonicalCountGatePass,
    task_count: tasks.length,
    target_task_count: target,
    remaining_task_count: Math.max(0, target - tasks.length),
    category_counts: counts,
    target_category_counts: CANONICAL_DATASET_COUNTS,
    remaining_category_counts: Object.fromEntries(
      EVAL_CATEGORIES.map((category) => [
        category,
        Math.max(0, CANONICAL_DATASET_COUNTS[category] - counts[category]),
      ]),
    ) as Record<EvalCategory, number>,
    primary_source_grounded_tasks: grounded,
    unsupported_propositions: unsupported,
    errors,
  };
}

export interface BenchmarkIntegrityReport {
  benchmark_integrity_pass: boolean;
  dataset_hash: string;
  task_count: number;
  category_counts: Record<EvalCategory, number>;
  expected_category_counts: Record<EvalCategory, number>;
  primary_source_grounded_tasks: number;
  reviewer_attestations: number;
  attestation_kind: AttestationKind;
  attestation_reviewer_ids: string[];
  attestation_binding_failures: string[];
  unsupported_propositions: number;
  unattested_tasks: number;
  accepted_unattested_tasks: 0;
  accepted_unsupported_propositions: 0;
  excluded_tasks: string[];
  replacement_tasks_required: number;
  errors: string[];
}

export class BenchmarkIntegrityError extends EvaluationError {
  readonly report: BenchmarkIntegrityReport;

  constructor(report: BenchmarkIntegrityReport) {
    super(
      'BENCHMARK_INTEGRITY_FAILED',
      report.errors.slice(0, 12).join(', '),
    );
    this.report = report;
  }
}

export function validateBenchmarkIntegrity(options: {
  tasks: EvalTask[];
  attestations: BenchmarkAttestation[];
  mode: 'fixture' | 'live';
  expected_counts?: Record<EvalCategory, number>;
}): BenchmarkIntegrityReport {
  const { tasks, attestations, mode } = options;
  const expected = options.expected_counts ??
    (mode === 'fixture'
      ? FIXTURE_DATASET_COUNTS
      : CANONICAL_DATASET_COUNTS);
  const datasetHash = benchmarkDatasetHash(tasks);
  const counts = distribution(tasks);
  const errors: string[] = [];
  const excluded = new Set<string>();
  let unsupported = 0;
  let groundedTasks = 0;
  let unattestedTasks = 0;
  let acceptedAttestations = 0;
  const acceptedReviewerIds = new Set<string>();
  const attestationBindingFailures: string[] = [];
  const taskIds = new Set(tasks.map((task) => task.id));

  if (
    EVAL_CATEGORIES.some((category) => counts[category] !== expected[category])
  ) {
    errors.push('dataset_distribution_mismatch');
  }

  for (const [index, attestation] of attestations.entries()) {
    if (!taskIds.has(attestation.task_id)) {
      const failure =
        `attestation[${index}]:unknown_task:${String(attestation.task_id)}`;
      attestationBindingFailures.push(failure);
      errors.push(failure);
    }
  }

  for (const task of tasks) {
    const taskErrors: string[] = [];
    const evidenceById = new Map(
      task.evidence.map((evidence) => [evidence.source_id, evidence]),
    );
    const criteriaById = new Map(
      task.criteria.map((criterion) => [criterion.criterion_id, criterion]),
    );
    const propositionsById = new Map(
      task.provenance.map((proposition) => [
        proposition.proposition_id,
        proposition,
      ]),
    );
    if (
      task.evidence.length === 0 ||
      task.criteria.length === 0 ||
      task.provenance.length === 0
    ) {
      taskErrors.push('missing_integrity_records');
    }
    for (const evidence of task.evidence) {
      if (
        !evidence.authoritative_excerpt ||
        !evidence.locator ||
        !evidence.jurisdiction ||
        !evidence.authority_status ||
        !evidence.effective_date ||
        !evidence.retrieved_at ||
        !/^https:\/\//u.test(evidence.canonical_url) ||
        !/^[a-f0-9]{64}$/u.test(evidence.source_sha256) ||
        (
          mode === 'live' &&
          evidence.source_sha256 !== sha256(evidence.authoritative_excerpt)
        )
      ) {
        taskErrors.push(`invalid_source:${evidence.source_id}`);
      }
    }
    for (const proposition of task.provenance) {
      const evidence = evidenceById.get(proposition.source_id);
      const linkedCriteria = proposition.criterion_ids.map((id) =>
        criteriaById.get(id)
      );
      const invalid =
        proposition.task_id !== task.id ||
        !proposition.proposition ||
        !evidence ||
        !normalizeWhitespace(evidence.authoritative_excerpt).includes(
          normalizeWhitespace(proposition.authoritative_excerpt),
        ) ||
        proposition.locator !== evidence.locator ||
        proposition.jurisdiction !== evidence.jurisdiction ||
        proposition.authority_status !== evidence.authority_status ||
        proposition.effective_date !== evidence.effective_date ||
        proposition.retrieved_at !== evidence.retrieved_at ||
        proposition.source_sha256 !== evidence.source_sha256 ||
        proposition.canonical_url !== evidence.canonical_url ||
        proposition.criterion_ids.length === 0 ||
        linkedCriteria.some((criterion) => !criterion) ||
        linkedCriteria.some(
          (criterion) =>
            !criterion?.proposition_ids.includes(proposition.proposition_id),
        );
      if (invalid) {
        unsupported += 1;
        taskErrors.push(
          `unsupported_proposition:${proposition.proposition_id}`,
        );
      }
    }
    if (
      task.task_content_sha256 !== undefined &&
      task.task_content_sha256 !== taskContentHash(task)
    ) {
      taskErrors.push('task_content_hash_mismatch');
    }
    for (const criterion of task.criteria) {
      if (
        criterion.proposition_ids.length === 0 ||
        criterion.proposition_ids.some((id) => {
          const proposition = propositionsById.get(id);
          return !proposition ||
            !proposition.criterion_ids.includes(criterion.criterion_id);
        })
      ) {
        taskErrors.push(`unsupported_criterion:${criterion.criterion_id}`);
      }
    }
    const expectedPropositions = benchmarkPropositionHashes(task);
    const expectedSources = benchmarkSourceHashes(task);
    const approvals: BenchmarkAttestation[] = [];
    for (const [index, attestation] of attestations.entries()) {
      if (attestation.task_id !== task.id) continue;
      const bindingErrors: string[] = [];
      if (
        typeof attestation.reviewer_id !== 'string' ||
        !/^[A-Za-z0-9_.:-]{2,64}$/u.test(attestation.reviewer_id)
      ) {
        bindingErrors.push('invalid_reviewer_id');
      }
      if (
        typeof attestation.reviewed_at !== 'string' ||
        Number.isNaN(Date.parse(attestation.reviewed_at))
      ) {
        bindingErrors.push('invalid_reviewed_at');
      }
      if (
        attestation.decision !== 'APPROVE' &&
        attestation.decision !== 'REJECT'
      ) {
        bindingErrors.push('invalid_decision');
      }
      if (
        !Array.isArray(attestation.reason_codes) ||
        attestation.reason_codes.some((code) => typeof code !== 'string')
      ) {
        bindingErrors.push('invalid_reason_codes');
      }
      if (attestation.dataset_hash !== datasetHash) {
        bindingErrors.push('dataset_hash_mismatch');
      }
      if (
        !Array.isArray(attestation.proposition_hashes) ||
        attestation.proposition_hashes.some(
          (hash) => typeof hash !== 'string',
        ) ||
        !sameStrings(attestation.proposition_hashes, expectedPropositions)
      ) {
        bindingErrors.push('proposition_hashes_mismatch');
      }
      if (
        !Array.isArray(attestation.source_hashes) ||
        attestation.source_hashes.some((hash) => typeof hash !== 'string') ||
        !sameStrings(attestation.source_hashes, expectedSources)
      ) {
        bindingErrors.push('source_hashes_mismatch');
      }
      if (
        mode === 'fixture'
          ? attestation.fixture_non_live !== true
          : attestation.fixture_non_live === true
      ) {
        bindingErrors.push(
          mode === 'fixture'
            ? 'fixture_non_live_marker_missing'
            : 'fixture_attestation_for_live_dataset',
        );
      }
      if (bindingErrors.length > 0) {
        const failure =
          `attestation[${index}]:${task.id}:${
            String(attestation.reviewer_id)
          }:${bindingErrors.join('+')}`;
        attestationBindingFailures.push(failure);
        taskErrors.push(failure);
        continue;
      }
      if (attestation.decision === 'APPROVE') approvals.push(attestation);
    }
    const reviewers = new Set(approvals.map((record) => record.reviewer_id));
    acceptedAttestations += approvals.length;
    approvals.forEach((record) => acceptedReviewerIds.add(record.reviewer_id));
    if (approvals.length !== 2 || reviewers.size !== 2) {
      unattestedTasks += 1;
      taskErrors.push(
        approvals.length < 2 || reviewers.size < 2
          ? 'missing_two_bound_approve_attestations'
          : 'expected_exactly_two_bound_approve_attestations',
      );
    }
    if (taskErrors.length === 0) groundedTasks += 1;
    else {
      excluded.add(task.id);
      errors.push(...taskErrors.map((error) => `${task.id}:${error}`));
    }
  }

  const expectedTaskCount = Object.values(expected).reduce(
    (sum, count) => sum + count,
    0,
  );
  const distributionReplacements = EVAL_CATEGORIES.reduce(
    (sum, category) => sum + Math.max(0, expected[category] - counts[category]),
    0,
  );
  const replacementTasksRequired = Math.max(
    distributionReplacements,
    Math.max(0, expectedTaskCount - (tasks.length - excluded.size)) +
      Math.max(0, tasks.length - expectedTaskCount),
  );
  const report: BenchmarkIntegrityReport = {
    benchmark_integrity_pass:
      errors.length === 0 &&
      tasks.length === expectedTaskCount &&
      excluded.size === 0,
    dataset_hash: datasetHash,
    task_count: tasks.length,
    category_counts: counts,
    expected_category_counts: expected,
    primary_source_grounded_tasks: groundedTasks,
    reviewer_attestations: acceptedAttestations,
    attestation_kind: classifyAttestationKind([...acceptedReviewerIds]),
    attestation_reviewer_ids: [...acceptedReviewerIds].sort(),
    attestation_binding_failures: attestationBindingFailures,
    unsupported_propositions: unsupported,
    unattested_tasks: unattestedTasks,
    accepted_unattested_tasks: 0,
    accepted_unsupported_propositions: 0,
    excluded_tasks: [...excluded].sort(),
    replacement_tasks_required: replacementTasksRequired,
    errors,
  };
  return report;
}

export function assertBenchmarkIntegrity(options: {
  tasks: EvalTask[];
  attestations: BenchmarkAttestation[];
  mode: 'fixture' | 'live';
  expected_counts?: Record<EvalCategory, number>;
}): BenchmarkIntegrityReport {
  const report = validateBenchmarkIntegrity(options);
  if (!report.benchmark_integrity_pass) {
    throw new BenchmarkIntegrityError(report);
  }
  return report;
}
