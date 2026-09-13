import { createHash } from 'node:crypto';
import type {
  CandidateParityHashes,
  CandidateResult,
  CandidateRunConfig,
  CandidateTransportRequest,
  EvalArm,
  EvalTask,
  PriceEntry,
  TokenUsage,
} from '../types.js';

function normalizeForJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForJson(item)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalizeForJson(value));
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(
    typeof value === 'string' ? value : stableJson(value),
  ).digest('hex');
}

export function candidateJournalKey(
  taskId: string,
  arm: EvalArm,
  replicate: number,
): string {
  return `${taskId}|${arm}|replicate-${replicate}`;
}

export function calculateCost(
  usage: TokenUsage,
  price: PriceEntry | null | undefined,
): number | null {
  if (!price) return null;
  return (
    (usage.input_tokens * price.input_usd_per_mtok +
      usage.output_tokens * price.output_usd_per_mtok) /
    1_000_000
  );
}

function sanitizeDebugValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDebugValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(reasoning|thinking|chain.?of.?thought|hidden)/iu.test(key))
      .map(([key, item]) => [key, sanitizeDebugValue(item)]),
  );
}

export function boundedDebugMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized = sanitizeDebugValue(metadata) as Record<string, unknown>;
  const serialized = stableJson(sanitized);
  if (Buffer.byteLength(serialized, 'utf8') <= 8_192) return sanitized;
  return {
    truncated: true,
    original_sha256: sha256(serialized),
    retained_keys: Object.keys(sanitized).slice(0, 32),
  };
}

export function buildParityHashes(
  task: EvalTask,
  config: CandidateRunConfig,
): CandidateParityHashes {
  const hashes = {
    system_prompt_hash: sha256(config.system_prompt),
    evidence_hash: sha256(task.evidence),
    tool_definitions_hash: sha256(config.tool_definitions),
    history_hash: sha256({
      frozen_history: config.history_window,
      task_turns: task.turns,
    }),
    limits_hash: sha256({
      max_output_tokens: config.max_output_tokens,
      max_iterations: config.max_iterations,
    }),
  };
  return {
    ...hashes,
    parity_hash: sha256(hashes),
  };
}

export async function runNormalizedCandidate(
  provider: 'anthropic' | 'fireworks',
  task: EvalTask,
  config: CandidateRunConfig,
): Promise<CandidateResult> {
  const journal_key = candidateJournalKey(task.id, config.arm, config.replicate);
  const completed = config.journal?.get(journal_key);
  if (completed) return completed;

  const parity_hashes = buildParityHashes(task, config);
  const request: CandidateTransportRequest = {
    provider,
    arm: config.arm,
    model: config.model,
    task_id: task.id,
    category: task.category,
    track: task.track,
    replicate: config.replicate,
    system_prompt: config.system_prompt,
    turns: [...config.history_window, ...task.turns],
    evidence: task.evidence,
    tool_definitions: config.tool_definitions,
    max_output_tokens: config.max_output_tokens,
    max_iterations: config.max_iterations,
  };

  let result: CandidateResult;
  try {
    const response = await config.transport(request);
    const price = config.prices[response.model] ?? config.prices[config.model];
    result = {
      journal_key,
      response_id: response.response_id,
      arm: config.arm,
      provider,
      model: response.model,
      task_id: task.id,
      replicate: config.replicate,
      final_text: response.final_text,
      tool_calls: response.tool_calls ?? [],
      tool_results: response.tool_results ?? [],
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: calculateCost(response.usage, price),
      latency_ms: response.latency_ms,
      stop_reason: response.stop_reason,
      error: response.error ?? null,
      error_code: response.error_code ?? null,
      parity_hashes,
      debug_metadata: boundedDebugMetadata(response.debug_metadata),
    };
  } catch (error) {
    result = {
      journal_key,
      response_id: `error-${sha256(journal_key).slice(0, 16)}`,
      arm: config.arm,
      provider,
      model: config.model,
      task_id: task.id,
      replicate: config.replicate,
      final_text: '',
      tool_calls: [],
      tool_results: [],
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      stop_reason: 'error',
      error: error instanceof Error ? error.message : String(error),
      error_code: 'CANDIDATE_TRANSPORT_ERROR',
      parity_hashes,
    };
  }

  if (result.error_code !== 'COST_CAP_HARD_STOP') {
    await config.journal?.append(result);
  }
  return result;
}
