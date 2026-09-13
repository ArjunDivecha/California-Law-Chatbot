/**
 * makeAttestation.ts -- emit one hash-bound BenchmarkAttestation record.
 *
 * WHAT THIS DOES
 *   A non-attorney benchmark reviewer (or someone running the tool on their
 *   behalf) reads a review packet under evals/kimi-k3/review-bundles/tasks/,
 *   decides APPROVE or REJECT, and runs this tool. It looks the task up in the
 *   canonical dataset, recomputes the dataset hash, the task's proposition
 *   hashes and its source hashes with the SAME functions live mode uses
 *   (evals/kimi-k3/integrity.ts), and appends a single JSONL record binding the
 *   reviewer's decision to those exact hashes.
 *
 *   It cannot fabricate an attestation for a task that does not exist, and it
 *   refuses to write a record whose hashes do not match the live dataset -- if
 *   the dataset changes after review, every attestation bound to the old hash
 *   stops counting, which is the intended behaviour.
 *
 *   It also refuses, by default, to write inside this repository: reviewer
 *   attestations are external evidence and must not be committed.
 *
 * INPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl   (default --dataset)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/review-bundles/manifest.json            (optional staleness cross-check)
 *
 * OUTPUT FILES (absolute paths)
 *   whatever --out names, e.g. /Users/arjundivecha/benchmark-attestations/california-law-v1.jsonl
 *   The file is APPENDED to (created if absent) and fsynced. Nothing else is written.
 *
 * USAGE
 *   ./node_modules/.bin/tsx evals/kimi-k3/datasetTools/makeAttestation.ts \
 *     --task verification-real-008 \
 *     --reviewer REV-A \
 *     --decision APPROVE \
 *     --reviewed-at 2026-07-28T00:00:00Z \
 *     --reason ENTAILED_AND_SELF_CONTAINED \
 *     --out ~/benchmark-attestations/california-law-v1.jsonl
 *
 *   Options:
 *     --task <task_id>          required
 *     --reviewer <opaque_id>    required; must contain no '@', no space, and no
 *                               personal name -- use REV-A / REV-B style ids
 *     --decision APPROVE|REJECT required
 *     --reviewed-at <ISO-8601>  required (UTC, e.g. 2026-07-28T00:00:00Z)
 *     --reason <code>           repeatable; >=1 required for REJECT
 *     --out <path>              required; must be OUTSIDE the repository
 *     --dataset <dir>           default evals/kimi-k3/datasets/california-law-v1
 *     --allow-in-repo           escape hatch, prints a loud warning
 *     --dry-run                 print the record, write nothing
 *
 * NOTES
 *   fixture_non_live is deliberately never set: live mode rejects any
 *   attestation carrying it, and repository fixtures are generated elsewhere.
 */
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  benchmarkDatasetHash,
  benchmarkPropositionHashes,
  benchmarkSourceHashes,
} from '../integrity.js';
import { EvaluationError } from '../providers/types.js';
import type { BenchmarkAttestation, EvalTask } from '../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const DEFAULT_DATASET = join(HERE, '..', 'datasets', 'california-law-v1');
const BUNDLE_MANIFEST = join(HERE, '..', 'review-bundles', 'manifest.json');

export const APPROVE_REASON_CODES = [
  'ENTAILED_AND_SELF_CONTAINED',
  'APPROVED_WITH_AGGREGATOR_CAVEAT_NOTED',
] as const;

export const REJECT_REASON_CODES = [
  'UNSUPPORTED_PROPOSITION',
  'CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY',
  'STALE_EFFECTIVE_DATE',
  'AMBIGUOUS_AUTHORITY_STATUS',
  'FAILED_SOURCE_HASH',
  'EXCERPT_NOT_VERBATIM',
  'CRITERION_PROPOSITION_MISMATCH',
  'AGGREGATOR_SOURCE_NOT_ACCEPTABLE',
  'ARCHIVED_SOURCE_NOT_ACCEPTABLE',
  'PROMPT_CONTAINS_NONPUBLIC_MATERIAL',
] as const;

const ALL_REASON_CODES = new Set<string>([
  ...APPROVE_REASON_CODES,
  ...REJECT_REASON_CODES,
]);

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new EvaluationError('INVALID_ARGUMENT', `${name} requires a value`);
  }
  return value;
}

function options(args: string[], name: string): string[] {
  const values: string[] = [];
  args.forEach((value, index) => {
    if (value !== name) return;
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      throw new EvaluationError('INVALID_ARGUMENT', `${name} requires a value`);
    }
    values.push(next);
  });
  return values;
}

function expandHome(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

function loadTasks(datasetDir: string): EvalTask[] {
  const file = join(resolve(expandHome(datasetDir)), 'tasks.jsonl');
  if (!existsSync(file)) {
    throw new EvaluationError('DATASET_NOT_FOUND', `No tasks.jsonl at ${file}`);
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalTask);
}

export function buildAttestation(input: {
  tasks: EvalTask[];
  task_id: string;
  reviewer_id: string;
  reviewed_at: string;
  decision: 'APPROVE' | 'REJECT';
  reason_codes: string[];
}): BenchmarkAttestation {
  const task = input.tasks.find((record) => record.id === input.task_id);
  if (!task) {
    throw new EvaluationError(
      'UNKNOWN_TASK_ID',
      `No task ${input.task_id} in the dataset — an attestation cannot be `
      + 'written for a task that does not exist',
    );
  }
  if (!/^[A-Za-z0-9_.:-]{2,64}$/u.test(input.reviewer_id)) {
    throw new EvaluationError(
      'INVALID_REVIEWER_ID',
      'reviewer_id must be an opaque token (letters, digits, _ . : -), '
      + '2-64 chars, containing no name or contact data',
    );
  }
  if (Number.isNaN(Date.parse(input.reviewed_at))) {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      `--reviewed-at is not an ISO-8601 timestamp: ${input.reviewed_at}`,
    );
  }
  const unknown = input.reason_codes.filter(
    (code) => !ALL_REASON_CODES.has(code),
  );
  if (unknown.length > 0) {
    throw new EvaluationError(
      'UNKNOWN_REASON_CODE',
      `Unknown reason code(s): ${unknown.join(', ')}`,
    );
  }
  if (input.decision === 'REJECT' && input.reason_codes.length === 0) {
    throw new EvaluationError(
      'REASON_CODE_REQUIRED',
      'A REJECT attestation must carry at least one reason code',
    );
  }
  if (
    input.decision === 'APPROVE' &&
    input.reason_codes.some((code) =>
      (REJECT_REASON_CODES as readonly string[]).includes(code)
    )
  ) {
    throw new EvaluationError(
      'INVALID_REASON_CODE',
      'An APPROVE attestation cannot carry a REJECT reason code',
    );
  }
  return {
    task_id: task.id,
    reviewer_id: input.reviewer_id,
    reviewed_at: input.reviewed_at,
    dataset_hash: benchmarkDatasetHash(input.tasks),
    proposition_hashes: benchmarkPropositionHashes(task),
    source_hashes: benchmarkSourceHashes(task),
    decision: input.decision,
    reason_codes: input.reason_codes,
  };
}

export function runMakeAttestation(args: string[]): Record<string, unknown> {
  const known = new Set([
    '--task', '--reviewer', '--decision', '--reviewed-at', '--reason',
    '--out', '--dataset', '--allow-in-repo', '--dry-run',
  ]);
  const unknownArgs = args.filter(
    (value, index) =>
      value.startsWith('--') &&
      !known.has(value) &&
      !known.has(args[index - 1] ?? ''),
  );
  if (unknownArgs.length > 0) {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      `Unknown arguments: ${unknownArgs.join(', ')}`,
    );
  }
  const taskId = option(args, '--task');
  const reviewerId = option(args, '--reviewer');
  const decision = option(args, '--decision');
  const reviewedAt = option(args, '--reviewed-at');
  const out = option(args, '--out');
  const dryRun = args.includes('--dry-run');
  for (const [flag, value] of [
    ['--task', taskId],
    ['--reviewer', reviewerId],
    ['--decision', decision],
    ['--reviewed-at', reviewedAt],
  ] as const) {
    if (!value) {
      throw new EvaluationError('INVALID_ARGUMENT', `${flag} is required`);
    }
  }
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      '--decision must be APPROVE or REJECT',
    );
  }
  if (!out && !dryRun) {
    throw new EvaluationError('INVALID_ARGUMENT', '--out is required');
  }

  const datasetDir = option(args, '--dataset') ?? DEFAULT_DATASET;
  const tasks = loadTasks(datasetDir);
  const attestation = buildAttestation({
    tasks,
    task_id: taskId as string,
    reviewer_id: reviewerId as string,
    reviewed_at: reviewedAt as string,
    decision,
    reason_codes: options(args, '--reason'),
  });

  const warnings: string[] = [];
  if (existsSync(BUNDLE_MANIFEST)) {
    const manifest = JSON.parse(readFileSync(BUNDLE_MANIFEST, 'utf8')) as {
      generated_from_dataset_hash?: string;
    };
    if (
      manifest.generated_from_dataset_hash &&
      manifest.generated_from_dataset_hash !== attestation.dataset_hash
    ) {
      throw new EvaluationError(
        'STALE_REVIEW_BUNDLE',
        'The review packets were generated from dataset hash '
        + `${manifest.generated_from_dataset_hash} but the dataset now hashes `
        + `to ${attestation.dataset_hash}. Regenerate the packets and have the `
        + 'task re-reviewed; an attestation bound to a stale reading is worse '
        + 'than none.',
      );
    }
  } else {
    warnings.push('review-bundles/manifest.json not found; skipped the '
      + 'packet-staleness cross-check');
  }

  if (dryRun) {
    return { dry_run: true, attestation, warnings, written: false };
  }

  const target = resolve(expandHome(out as string));
  const inRepo = target.startsWith(`${REPO_ROOT}/`);
  if (inRepo && !args.includes('--allow-in-repo')) {
    throw new EvaluationError(
      'ATTESTATION_INSIDE_REPO',
      `Refusing to write ${target}: reviewer attestations are EXTERNAL `
      + 'evidence and must live outside the repository so they cannot be '
      + 'committed, edited in a code review, or regenerated by an agent. '
      + 'Pass --allow-in-repo only if you know exactly why.',
    );
  }
  if (inRepo) {
    warnings.push(`WARNING: writing an attestation INSIDE the repository at ${target}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(target, `${JSON.stringify(attestation)}\n`, { mode: 0o600 });
  const handle = openSync(target, 'r');
  try {
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  return { written: true, path: target, attestation, warnings };
}

async function main(): Promise<void> {
  try {
    const result = runMakeAttestation(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 1));
  } catch (error) {
    const known = error instanceof EvaluationError;
    console.log(JSON.stringify({
      exit: known ? error.exit_code : 1,
      error_code: known ? error.error_code : 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
    }, null, 1));
    process.exitCode = known ? error.exit_code : 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}
