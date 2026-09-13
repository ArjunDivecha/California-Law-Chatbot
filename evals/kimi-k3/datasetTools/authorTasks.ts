import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVAL_CATEGORIES,
  type EvalCriterion,
  type EvalTask,
  type PrimarySourceRecord,
  type ProvenanceProposition,
} from '../types.js';
import { atomicWriteFileSync } from '../journal.js';
import { sha256 } from '../providers/shared.js';
import { EvaluationError } from '../providers/types.js';
import { loadSourceRegistry } from './sourceRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, '..', 'datasets', 'california-law-v1');
const TRACKS = new Set(['frozen_evidence', 'shared_agent']);
const DATA_CLASSES = new Set(['public', 'synthetic']);
const TURN_ROLES = new Set(['user', 'assistant', 'tool']);
const ASSERTION_KINDS = new Set([
  'contains',
  'not_contains',
  'citation',
  'statute',
  'schema',
  'tool_call',
  'abstention',
]);
const HARD_FAILURE_CODES = new Set([
  'FABRICATED_AUTHORITY',
  'UNSUPPORTED_PROPOSITION',
  'WRONG_JURISDICTION',
  'WRONG_EFFECTIVE_DATE',
  'MATERIAL_FACT_INVENTION',
  'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
  'POLICY_OR_TOOL_VIOLATION',
  'MALFORMED_DELIVERABLE',
]);

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function taskContentSha256(task: EvalTask): string {
  const { task_content_sha256: _ignored, ...content } = task;
  return sha256(content);
}

function nonempty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function readExistingTasks(path: string): EvalTask[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as EvalTask;
      } catch {
        throw new EvaluationError(
          'INVALID_TASK_DATASET',
          `Malformed task JSONL line ${index + 1}`,
        );
      }
    });
}

function propositionCriterionIds(
  propositionId: string,
  criteria: EvalCriterion[],
  supplied: unknown,
): string[] {
  const derived = criteria
    .filter((criterion) => criterion.proposition_ids.includes(propositionId))
    .map((criterion) => criterion.criterion_id);
  if (supplied === undefined) return derived;
  if (
    !Array.isArray(supplied) ||
    supplied.some((value) => typeof value !== 'string')
  ) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `criterion_ids must be a string array for ${propositionId}`,
    );
  }
  const normalized = [...new Set(supplied as string[])].sort();
  if (
    normalized.length !== [...new Set(derived)].length ||
    normalized.some((value, index) =>
      value !== [...new Set(derived)].sort()[index]
    )
  ) {
    throw new EvaluationError(
      'CRITERION_PROPOSITION_LINK_MISMATCH',
      `criterion links are not bidirectional for ${propositionId}`,
    );
  }
  return supplied as string[];
}

function assembleProposition(
  raw: Record<string, unknown>,
  taskId: string,
  criteria: EvalCriterion[],
  source: PrimarySourceRecord,
): ProvenanceProposition {
  const proposition_id = nonempty(raw.proposition_id, 'proposition_id');
  const authoritative_excerpt = nonempty(
    raw.authoritative_excerpt ?? raw.excerpt,
    `authoritative_excerpt for ${proposition_id}`,
  );
  if (
    !normalizeWhitespace(source.excerpt).includes(
      normalizeWhitespace(authoritative_excerpt),
    )
  ) {
    throw new EvaluationError(
      'SOURCE_ENTAILMENT_FAILED',
      `Proposition excerpt is not present in source ${source.source_id}: ${proposition_id}`,
    );
  }
  const criterion_ids = propositionCriterionIds(
    proposition_id,
    criteria,
    raw.criterion_ids,
  );
  if (criterion_ids.length === 0) {
    throw new EvaluationError(
      'UNLINKED_PROPOSITION',
      `Proposition has no criterion: ${proposition_id}`,
    );
  }
  return {
    proposition_id,
    task_id: taskId,
    source_id: source.source_id,
    proposition: nonempty(
      raw.proposition,
      `proposition for ${proposition_id}`,
    ),
    authoritative_excerpt,
    locator: source.locator,
    jurisdiction: source.jurisdiction,
    authority_status: source.publication_or_precedential_status,
    effective_date: source.effective_date,
    retrieved_at: source.retrieved_at,
    canonical_url: source.canonical_url,
    source_sha256: source.sha256,
    criterion_ids,
  };
}

export function assembleEvalTask(
  draft: unknown,
  sources: Map<string, PrimarySourceRecord>,
): EvalTask {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      'Each task draft must be an object',
    );
  }
  const raw = draft as Record<string, unknown>;
  const id = nonempty(raw.id, 'id');
  const category = nonempty(raw.category, `category for ${id}`);
  if (!EVAL_CATEGORIES.includes(category as EvalTask['category'])) {
    throw new EvaluationError(
      'INVALID_TASK_CATEGORY',
      `Invalid category for ${id}: ${category}`,
    );
  }
  const track = nonempty(raw.track, `track for ${id}`);
  if (!TRACKS.has(track)) {
    throw new EvaluationError(
      'INVALID_TASK_TRACK',
      `Invalid track for ${id}: ${track}`,
    );
  }
  const dataClass = nonempty(raw.data_class, `data_class for ${id}`);
  if (!DATA_CLASSES.has(dataClass)) {
    throw new EvaluationError(
      'INVALID_TASK_DATA_CLASS',
      `Canonical authored tasks require public or synthetic data: ${id}`,
    );
  }
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `criteria must be a non-empty array for ${id}`,
    );
  }
  const criteria = raw.criteria as EvalCriterion[];
  const criterionIds = new Set<string>();
  for (const criterion of criteria) {
    nonempty(criterion?.criterion_id, `criterion_id for ${id}`);
    nonempty(criterion?.description, `criterion description for ${id}`);
    if (typeof criterion.material !== 'boolean') {
      throw new EvaluationError(
        'INVALID_TASK_DRAFT',
        `criterion material must be boolean for ${criterion.criterion_id}`,
      );
    }
    if (
      !Array.isArray(criterion.proposition_ids) ||
      criterion.proposition_ids.some((value) => typeof value !== 'string') ||
      (criterion.material && criterion.proposition_ids.length === 0)
    ) {
      throw new EvaluationError(
        'UNSUPPORTED_MATERIAL_CRITERION',
        `Material criterion needs proposition_ids: ${criterion.criterion_id}`,
      );
    }
    if (criterionIds.has(criterion.criterion_id)) {
      throw new EvaluationError(
        'DUPLICATE_CRITERION_ID',
        `Duplicate criterion_id: ${criterion.criterion_id}`,
      );
    }
    criterionIds.add(criterion.criterion_id);
  }
  const rawPropositions = raw.provenance ?? raw.propositions;
  if (!Array.isArray(rawPropositions) || rawPropositions.length === 0) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `provenance must be a non-empty array for ${id}`,
    );
  }
  const propositionIds = new Set<string>();
  const provenance = rawPropositions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new EvaluationError(
        'INVALID_TASK_DRAFT',
        `Invalid proposition in ${id}`,
      );
    }
    const proposition = item as Record<string, unknown>;
    const propositionId = nonempty(
      proposition.proposition_id,
      `proposition_id for ${id}`,
    );
    if (propositionIds.has(propositionId)) {
      throw new EvaluationError(
        'DUPLICATE_PROPOSITION_ID',
        `Duplicate proposition_id: ${propositionId}`,
      );
    }
    propositionIds.add(propositionId);
    const sourceId = nonempty(
      proposition.source_id,
      `source_id for ${propositionId}`,
    );
    const source = sources.get(sourceId);
    if (!source) {
      throw new EvaluationError(
        'UNKNOWN_SOURCE_ID',
        `Unknown source_id ${sourceId} for ${propositionId}`,
      );
    }
    return assembleProposition(proposition, id, criteria, source);
  });
  for (const criterion of criteria) {
    if (
      criterion.proposition_ids.some(
        (propositionId) => !propositionIds.has(propositionId),
      )
    ) {
      throw new EvaluationError(
        'UNSUPPORTED_MATERIAL_CRITERION',
        `Criterion references unknown proposition: ${criterion.criterion_id}`,
      );
    }
  }
  if (!Array.isArray(raw.turns)) {
    throw new EvaluationError('INVALID_TASK_DRAFT', `turns must be an array for ${id}`);
  }
  for (const [index, turn] of raw.turns.entries()) {
    if (
      !turn ||
      typeof turn !== 'object' ||
      !TURN_ROLES.has((turn as { role?: unknown }).role as string) ||
      typeof (turn as { content?: unknown }).content !== 'string' ||
      (
        (turn as { tool_name?: unknown }).tool_name !== undefined &&
        typeof (turn as { tool_name?: unknown }).tool_name !== 'string'
      )
    ) {
      throw new EvaluationError(
        'INVALID_TASK_DRAFT',
        `Invalid turn ${index + 1} for ${id}`,
      );
    }
  }
  if (!Array.isArray(raw.deterministic_assertions)) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `deterministic_assertions must be an array for ${id}`,
    );
  }
  const assertionIds = new Set<string>();
  for (const assertion of raw.deterministic_assertions) {
    if (!assertion || typeof assertion !== 'object') {
      throw new EvaluationError(
        'INVALID_TASK_DRAFT',
        `Invalid deterministic assertion for ${id}`,
      );
    }
    const record = assertion as Record<string, unknown>;
    const assertionId = nonempty(
      record.assertion_id,
      `assertion_id for ${id}`,
    );
    if (
      assertionIds.has(assertionId) ||
      !ASSERTION_KINDS.has(record.kind as string) ||
      !['string', 'number', 'boolean'].includes(typeof record.expected) &&
        !(
          Array.isArray(record.expected) &&
          record.expected.every((value) => typeof value === 'string')
        ) ||
      (
        record.hard_failure_code !== undefined &&
        !HARD_FAILURE_CODES.has(record.hard_failure_code as string)
      )
    ) {
      throw new EvaluationError(
        'INVALID_TASK_DRAFT',
        `Invalid deterministic assertion: ${assertionId}`,
      );
    }
    assertionIds.add(assertionId);
  }
  if (
    !Array.isArray(raw.expected_tools) ||
    raw.expected_tools.some((value) => typeof value !== 'string')
  ) {
    throw new EvaluationError(
      'INVALID_TASK_DRAFT',
      `expected_tools must be a string array for ${id}`,
    );
  }
  const evidence = [...new Set(provenance.map((item) => item.source_id))]
    .map((sourceId) => sources.get(sourceId) as PrimarySourceRecord)
    .map((source) => ({
      source_id: source.source_id,
      title: source.locator,
      authoritative_excerpt: source.excerpt,
      locator: source.locator,
      jurisdiction: source.jurisdiction,
      authority_status: source.publication_or_precedential_status,
      effective_date: source.effective_date,
      retrieved_at: source.retrieved_at,
      canonical_url: source.canonical_url,
      source_sha256: source.sha256,
    }));
  const task: EvalTask = {
    id,
    category: category as EvalTask['category'],
    workflow: nonempty(raw.workflow, `workflow for ${id}`),
    track: track as EvalTask['track'],
    prompt: nonempty(raw.prompt, `prompt for ${id}`),
    turns: raw.turns as EvalTask['turns'],
    evidence,
    criteria,
    deterministic_assertions:
      raw.deterministic_assertions as EvalTask['deterministic_assertions'],
    expected_tools: raw.expected_tools as string[],
    data_class: dataClass as EvalTask['data_class'],
    provenance,
  };
  task.task_content_sha256 = taskContentSha256(task);
  return task;
}

export function appendTasksAtomically(options: {
  output: string;
  sources: string;
  drafts: unknown[];
}): EvalTask[] {
  if (!Array.isArray(options.drafts) || options.drafts.length === 0) {
    throw new EvaluationError(
      'INVALID_TASK_INPUT',
      'Input must contain at least one task draft',
    );
  }
  const sourceRecords = loadSourceRegistry(options.sources);
  const sources = new Map(
    sourceRecords.map((record) => [record.source_id, record]),
  );
  const existing = readExistingTasks(options.output);
  const taskIds = new Set(existing.map((task) => task.id));
  const additions = options.drafts.map((draft) => assembleEvalTask(draft, sources));
  for (const task of additions) {
    if (taskIds.has(task.id)) {
      throw new EvaluationError(
        'DUPLICATE_TASK_ID',
        `Duplicate task id: ${task.id}`,
      );
    }
    taskIds.add(task.id);
  }
  const existingBytes = existsSync(options.output)
    ? readFileSync(options.output, 'utf8')
    : '';
  const preservedPrefix =
    existingBytes.length === 0 || existingBytes.endsWith('\n')
      ? existingBytes
      : `${existingBytes}\n`;
  atomicWriteFileSync(
    options.output,
    `${preservedPrefix}${
      additions.map((task) => JSON.stringify(task)).join('\n')
    }\n`,
    { mode: 0o644 },
  );
  return additions;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new EvaluationError('INVALID_ARGUMENT', `${name} requires a value`);
  }
  return value;
}

function readDrafts(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { tasks?: unknown }).tasks)
  ) {
    return (parsed as { tasks: unknown[] }).tasks;
  }
  throw new EvaluationError(
    'INVALID_TASK_INPUT',
    'Input JSON must be an array or an object with a tasks array',
  );
}

export function runAuthorTasks(args: string[]): Record<string, unknown> {
  const unknown = args.filter(
    (value, index) =>
      value.startsWith('--') &&
      !['--input', '--output', '--sources'].includes(value) &&
      !['--input', '--output', '--sources'].includes(args[index - 1]),
  );
  if (unknown.length > 0) {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      `Unknown arguments: ${unknown.join(', ')}`,
    );
  }
  const input = option(args, '--input');
  if (!input) {
    throw new EvaluationError('INVALID_ARGUMENT', '--input is required');
  }
  const output = resolve(option(args, '--output') ?? join(DATASET, 'tasks.jsonl'));
  const sources = resolve(
    option(args, '--sources') ?? join(DATASET, 'sources.jsonl'),
  );
  const additions = appendTasksAtomically({
    output,
    sources,
    drafts: readDrafts(input),
  });
  return {
    output,
    appended: additions.length,
    tasks: additions.map((task) => ({
      id: task.id,
      task_content_sha256: task.task_content_sha256,
      proposition_hashes: task.provenance.map((record) => sha256(record)).sort(),
      source_hashes: [...new Set(
        task.evidence.map((record) => record.source_sha256),
      )].sort(),
    })),
  };
}

async function main(): Promise<void> {
  try {
    console.log(JSON.stringify(runAuthorTasks(process.argv.slice(2))));
  } catch (error) {
    const known = error instanceof EvaluationError;
    console.log(JSON.stringify({
      exit: known ? error.exit_code : 1,
      error_code: known ? error.error_code : 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = known ? error.exit_code : 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}
