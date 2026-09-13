import type {
  JudgePairInput,
  JudgePairResult,
  JudgeId,
  OpenAICompatibleChatJudgeTransportRequest,
} from '../types.js';
import {
  buildSharedJudgePrompt,
  executeJudgeRequest,
} from './sharedJudge.js';

export const DEEPSEEK_V4_JUDGE_MODEL =
  'accounts/fireworks/models/deepseek-v4-pro' as const;
export const DEEPSEEK_V4_NATIVE_JUDGE_MODEL = 'deepseek-v4-pro' as const;

export interface DeepSeekV4JudgeRouteConfig {
  judge_id: Extract<
    JudgeId,
    'deepseek-v4-pro' | 'accounts/fireworks/models/deepseek-v4-pro'
  >;
  provider: 'deepseek' | 'fireworks';
  base_url:
    | 'https://api.deepseek.com'
    | 'https://api.fireworks.ai/inference/v1';
  api_key_env_var: 'DEEPSEEK_API_KEY' | 'FIREWORKS_API_KEY';
  response_format: 'json_object' | 'json_schema';
  input_usd_per_mtok: number;
  output_usd_per_mtok: number;
}

export const DEEPSEEK_V4_NATIVE_ROUTE_CONFIG = {
  judge_id: DEEPSEEK_V4_NATIVE_JUDGE_MODEL,
  provider: 'deepseek',
  base_url: 'https://api.deepseek.com',
  api_key_env_var: 'DEEPSEEK_API_KEY',
  response_format: 'json_object',
  input_usd_per_mtok: 0.435,
  output_usd_per_mtok: 0.87,
} as const satisfies DeepSeekV4JudgeRouteConfig;

export const DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG = {
  judge_id: DEEPSEEK_V4_JUDGE_MODEL,
  provider: 'fireworks',
  base_url: 'https://api.fireworks.ai/inference/v1',
  api_key_env_var: 'FIREWORKS_API_KEY',
  response_format: 'json_schema',
  input_usd_per_mtok: 1.74,
  output_usd_per_mtok: 3.48,
} as const satisfies DeepSeekV4JudgeRouteConfig;

/**
 * Pinned judge configuration:
 * - OpenAI-compatible chat-completions protocol
 * - temperature=0, top_p=1, seed=5601, max_tokens=4096
 * - no tools and no web search
 * - route-specific JSON output mode
 *
 * Client-side validation remains authoritative even when the endpoint accepts
 * response_format. This adapter contains no SDK, fetch, or other network path:
 * callers inject the transport. Live wiring reads the configured credential
 * from process.env at call setup and never logs, copies, journals, or persists
 * its value.
 */
export const DEEPSEEK_V4_DETERMINISTIC_CONFIG = {
  temperature: 0,
  top_p: 1,
  seed: 5601,
  max_tokens: 4_096,
  tools: [],
} as const;

export const DEEPSEEK_JSON_OBJECT_SCHEMA_INSTRUCTION =
  'The endpoint enforces only JSON-object syntax, so the exact required output schema follows. Match it exactly; do not add, remove, or rename fields.';

function buildRequest(
  input: JudgePairInput,
  route: DeepSeekV4JudgeRouteConfig,
): OpenAICompatibleChatJudgeTransportRequest {
  const prompt = buildSharedJudgePrompt(input);
  const systemPrompt =
    route.response_format === 'json_object'
      ? [
          prompt.instructions,
          DEEPSEEK_JSON_OBJECT_SCHEMA_INSTRUCTION,
          `REQUIRED_OUTPUT_JSON_SCHEMA\n${JSON.stringify(prompt.schema)}`,
        ].join('\n\n')
      : prompt.instructions;
  return {
    model: route.judge_id,
    api: 'chat_completions',
    base_url: route.base_url,
    api_key_env_var: route.api_key_env_var,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt.input },
    ],
    temperature: DEEPSEEK_V4_DETERMINISTIC_CONFIG.temperature,
    top_p: DEEPSEEK_V4_DETERMINISTIC_CONFIG.top_p,
    seed: DEEPSEEK_V4_DETERMINISTIC_CONFIG.seed,
    max_tokens: DEEPSEEK_V4_DETERMINISTIC_CONFIG.max_tokens,
    tools: [],
    response_format: route.response_format === 'json_object'
      ? { type: 'json_object' }
      : {
          type: 'json_schema',
          json_schema: {
            name: 'california_law_pair_judgment',
            strict: true,
            schema: prompt.schema,
          },
        },
    pair_id: input.anonymous_pair_id,
    task_id: input.task.id,
    order: input.order,
    phase: input.phase,
    pass_index: input.pass_index,
  };
}

export function createDeepSeekV4Judge(
  route: DeepSeekV4JudgeRouteConfig,
): (input: JudgePairInput) => Promise<JudgePairResult> {
  return async (input) =>
    executeJudgeRequest(input, buildRequest(input, route), {
      judge_id: route.judge_id,
      judge_reasoning_effort: 'not_applicable',
      input_usd_per_mtok: route.input_usd_per_mtok,
      output_usd_per_mtok: route.output_usd_per_mtok,
    });
}

export const judgePairDeepSeekV4 = createDeepSeekV4Judge(
  DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG,
);

export const judgePairDeepSeekV4Native = createDeepSeekV4Judge(
  DEEPSEEK_V4_NATIVE_ROUTE_CONFIG,
);
