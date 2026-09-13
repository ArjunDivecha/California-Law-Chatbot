import type {
  CandidateResult,
  CandidateRunConfig,
  ComplexityTier,
  EvalTask,
  RouterConfig,
  RoutingDecision,
  TokenUsage,
} from '../types.js';
import type { CandidateProvider } from './types.js';
import { EvaluationError } from './types.js';
import {
  calculateCost,
  candidateJournalKey,
  runNormalizedCandidate,
  sha256,
  stableJson,
} from './shared.js';

export const APPROVED_ROUTER_MODEL_RE =
  /^claude-(fable|opus|sonnet|haiku)-[a-z0-9][a-z0-9.-]*$/;
export const ROUTER_TIERS = [
  'simple',
  'standard',
  'complex',
  'frontier',
] as const satisfies readonly ComplexityTier[];

const decisionCaches = new WeakMap<
  RouterConfig,
  Map<string, RoutingDecision>
>();

function isApprovedRouterModel(model: string): boolean {
  return (
    APPROVED_ROUTER_MODEL_RE.test(model) &&
    !model.includes('preview') &&
    !model.includes('mythos')
  );
}

export function assertApprovedAnthropicModel(model: string): void {
  if (!isApprovedRouterModel(model)) {
    throw new EvaluationError(
      'UNAPPROVED_ROUTER_MODEL',
      `Anthropic request refused by approved-family guard: ${model}`,
    );
  }
}

export function assertApprovedRouterConfig(config: RouterConfig): void {
  const models = [
    config.classifier_model,
    config.frozen_static_anthropic_model,
    ...ROUTER_TIERS.map((tier) => config.tier_models[tier]),
  ];
  const unapproved = models.filter((model) => !isApprovedRouterModel(model));
  const missingWindows = ROUTER_TIERS
    .map((tier) => config.tier_models[tier])
    .filter((model) => !Number.isFinite(config.context_windows[model]));
  if (unapproved.length > 0 || missingWindows.length > 0) {
    const details = [
      unapproved.length > 0
        ? `unapproved models: ${unapproved.join(', ')}`
        : '',
      missingWindows.length > 0
        ? `missing context windows: ${missingWindows.join(', ')}`
        : '',
    ].filter(Boolean).join('; ');
    throw new EvaluationError(
      'UNAPPROVED_ROUTER_MODEL',
      `Router configuration refused before request construction (${details})`,
    );
  }
}

function emptyUsage(): TokenUsage {
  return { input_tokens: 0, output_tokens: 0 };
}

function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    cache_read_input_tokens:
      (left.cache_read_input_tokens ?? 0) +
      (right.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens:
      (left.cache_creation_input_tokens ?? 0) +
      (right.cache_creation_input_tokens ?? 0),
  };
}

function assembledInputTokens(task: EvalTask, config: RouterConfig): number {
  if (typeof config.assembled_input_tokens === 'function') {
    return config.assembled_input_tokens(task);
  }
  if (typeof config.assembled_input_tokens === 'number') {
    return config.assembled_input_tokens;
  }
  return Math.ceil(stableJson({
    prompt: task.prompt,
    turns: task.turns,
    evidence: task.evidence,
  }).length / 4);
}

function parseTier(response: { tier?: ComplexityTier; text?: string }): ComplexityTier {
  if (response.tier && ROUTER_TIERS.includes(response.tier)) {
    return response.tier;
  }
  if (!response.text) throw new Error('Classifier response omitted tier JSON');
  const parsed = JSON.parse(response.text) as Record<string, unknown>;
  if (
    Object.keys(parsed).length !== 1 ||
    typeof parsed.tier !== 'string' ||
    !ROUTER_TIERS.includes(parsed.tier as ComplexityTier)
  ) {
    throw new Error('Classifier response failed strict tier schema');
  }
  return parsed.tier as ComplexityTier;
}

function classifierPrompt(task: EvalTask, replicate: number): string {
  return stableJson({
    instruction:
      'Classify request complexity. Return exactly one JSON object with tier set to simple, standard, complex, or frontier.',
    definitions: {
      simple: 'Direct, narrow answer with little synthesis.',
      standard: 'Ordinary legal analysis or drafting with bounded synthesis.',
      complex: 'Multi-authority, multi-step, or materially nuanced analysis.',
      frontier: 'Exceptional ambiguity, breadth, or long-form appellate-grade reasoning.',
    },
    replicate,
    task: {
      id: task.id,
      category: task.category,
      workflow: task.workflow,
      prompt: task.prompt,
      turns: task.turns,
      evidence: task.evidence,
    },
  });
}

function escalateForContext(
  tier: ComplexityTier,
  tokens: number,
  config: RouterConfig,
): { tier: ComplexityTier; reason: 'CONTEXT_WINDOW_EXCEEDED' | null } {
  let index = ROUTER_TIERS.indexOf(tier);
  const initial = index;
  while (
    index < ROUTER_TIERS.length - 1 &&
    tokens > config.context_windows[config.tier_models[ROUTER_TIERS[index]]]
  ) {
    index += 1;
  }
  return {
    tier: ROUTER_TIERS[index],
    reason: index === initial ? null : 'CONTEXT_WINDOW_EXCEEDED',
  };
}

export async function classifyComplexity(
  task: EvalTask,
  replicate: number,
  config: RouterConfig,
): Promise<RoutingDecision> {
  // This is deliberately the first operation: no prompt/request object exists
  // until every classifier and pool id has passed the mirrored counsel guard.
  assertApprovedRouterConfig(config);

  const cacheKey = `${task.id}|${replicate}|${sha256({
    task,
    classifier: config.classifier_model,
    tiers: config.tier_models,
    windows: config.context_windows,
    assembled_input_tokens:
      typeof config.assembled_input_tokens === 'number'
        ? config.assembled_input_tokens
        : null,
  })}`;
  let cache = decisionCaches.get(config);
  if (!cache) {
    cache = new Map();
    decisionCaches.set(config, cache);
  }
  const cached = cache.get(cacheKey);
  if (cached) return structuredClone(cached);

  const tokens = assembledInputTokens(task, config);
  const journal_key = `${task.id}|anthropic_router|replicate-${replicate}|classifier`;
  const resumed = config.get_routing_decision?.(journal_key);
  if (resumed) {
    cache.set(cacheKey, resumed);
    return structuredClone(resumed);
  }
  let usage = emptyUsage();
  let latency = 0;
  let lastError: string | null = null;
  const responseIds: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await config.classifier_transport({
        model: config.classifier_model,
        task_id: task.id,
        replicate,
        prompt: classifierPrompt(task, replicate),
        allowed_tiers: ROUTER_TIERS,
        temperature: 0,
        max_output_tokens: 32,
      });
      usage = addUsage(usage, response.usage);
      latency += response.latency_ms;
      responseIds.push(response.response_id);
      const verdict = parseTier(response);
      const escalated = escalateForContext(verdict, tokens, config);
      const decision: RoutingDecision = {
        journal_key,
        arm: 'anthropic_router',
        task_id: task.id,
        replicate,
        classifier_model: config.classifier_model,
        classifier_verdict: verdict,
        routed_model_id: config.tier_models[escalated.tier],
        classifier_fallback: false,
        classifier_attempts: attempt,
        classifier_response_ids: [...responseIds],
        classifier_usage: usage,
        classifier_cost_usd: calculateCost(
          usage,
          config.prices[config.classifier_model],
        ),
        classifier_latency_ms: latency,
        assembled_input_tokens: tokens,
        escalation_reason: escalated.reason,
        error: null,
      };
      cache.set(cacheKey, decision);
      await config.journal_routing_decision?.(decision);
      return structuredClone(decision);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const fallback: RoutingDecision = {
    journal_key,
    arm: 'anthropic_router',
    task_id: task.id,
    replicate,
    classifier_model: config.classifier_model,
    classifier_verdict: null,
    routed_model_id: config.frozen_static_anthropic_model,
    classifier_fallback: true,
    classifier_attempts: 2,
    classifier_response_ids: [...responseIds],
    classifier_usage: usage,
    classifier_cost_usd: calculateCost(
      usage,
      config.prices[config.classifier_model],
    ),
    classifier_latency_ms: latency,
    assembled_input_tokens: tokens,
    escalation_reason: null,
    error: lastError,
  };
  cache.set(cacheKey, fallback);
  await config.journal_routing_decision?.(fallback);
  return structuredClone(fallback);
}

export class AnthropicRouterProvider implements CandidateProvider {
  async run(
    task: EvalTask,
    config: CandidateRunConfig,
  ): Promise<CandidateResult> {
    if (config.arm !== 'anthropic_router') {
      throw new EvaluationError(
        'PROVIDER_ARM_MISMATCH',
        `AnthropicRouterProvider requires anthropic_router, received ${config.arm}`,
      );
    }
    if (!config.router_config) {
      throw new EvaluationError(
        'ROUTER_CONFIG_REQUIRED',
        'anthropic_router requires router_config',
      );
    }

    const journal_key = candidateJournalKey(task.id, config.arm, config.replicate);
    const completed = config.journal?.get(journal_key);
    if (completed) return completed;

    const routing = await classifyComplexity(
      task,
      config.replicate,
      config.router_config,
    );
    const candidate = await runNormalizedCandidate('anthropic', task, {
      ...config,
      model: routing.routed_model_id,
      journal: undefined,
    });
    const candidateCost = candidate.cost_usd;
    const classifierCost = routing.classifier_cost_usd;
    const result: CandidateResult = {
      ...candidate,
      journal_key,
      input_tokens:
        candidate.input_tokens + routing.classifier_usage.input_tokens,
      output_tokens:
        candidate.output_tokens + routing.classifier_usage.output_tokens,
      cost_usd:
        candidateCost === null || classifierCost === null
          ? null
          : candidateCost + classifierCost,
      latency_ms: candidate.latency_ms + routing.classifier_latency_ms,
      classifier_verdict: routing.classifier_verdict,
      routed_model_id: routing.routed_model_id,
      classifier_usage: routing.classifier_usage,
      classifier_cost_usd: routing.classifier_cost_usd,
      classifier_latency_ms: routing.classifier_latency_ms,
      classifier_fallback: routing.classifier_fallback,
      debug_metadata: {
        ...candidate.debug_metadata,
        routing_error: routing.error,
        routing_escalation_reason: routing.escalation_reason,
      },
    };
    if (result.error_code !== 'COST_CAP_HARD_STOP') {
      await config.journal?.append(result);
    }
    return result;
  }
}

export function createAnthropicRouterProvider(): CandidateProvider {
  return new AnthropicRouterProvider();
}
