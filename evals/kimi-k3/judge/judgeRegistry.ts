import type {
  JudgeAdapterLike,
  JudgeId,
} from '../types.js';
import {
  judgePair,
  GPT56_JUDGE_CONFIG_RESPONSE_SCHEMA,
  GPT56_JUDGE_MODEL,
} from './gpt56Judge.js';
import {
  DEEPSEEK_JSON_OBJECT_SCHEMA_INSTRUCTION,
  DEEPSEEK_V4_DETERMINISTIC_CONFIG,
  DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG,
  DEEPSEEK_V4_JUDGE_MODEL,
  DEEPSEEK_V4_NATIVE_JUDGE_MODEL,
  DEEPSEEK_V4_NATIVE_ROUTE_CONFIG,
  judgePairDeepSeekV4,
  judgePairDeepSeekV4Native,
} from './deepseekV4Judge.js';
import { EvaluationError } from '../providers/types.js';
import { sha256 } from '../providers/shared.js';
import {
  JUDGE_PROMPT_INSTRUCTIONS,
  JUDGE_RESPONSE_SCHEMA,
} from './sharedJudge.js';

export interface JudgeAdapter extends JudgeAdapterLike {
  provider: 'openai' | 'deepseek' | 'fireworks';
  deterministic_config: Readonly<Record<string, unknown>>;
  reasoning_effort: 'high' | 'not_applicable';
}

export const DEFAULT_JUDGE_ID: JudgeId = GPT56_JUDGE_MODEL;

const JUDGES: ReadonlyMap<JudgeId, JudgeAdapter> = new Map([
  [
    GPT56_JUDGE_MODEL,
    {
      id: GPT56_JUDGE_MODEL,
      provider: 'openai',
      deterministic_config: {
        api: 'responses',
        reasoning: { effort: 'high' },
        store: false,
        tools: [],
        strict_json_schema: true,
      },
      reasoning_effort: 'high',
      judgePair,
    },
  ],
  [
    DEEPSEEK_V4_NATIVE_JUDGE_MODEL,
    {
      id: DEEPSEEK_V4_NATIVE_JUDGE_MODEL,
      provider: 'deepseek',
      deterministic_config: {
        api: 'chat_completions',
        base_url: DEEPSEEK_V4_NATIVE_ROUTE_CONFIG.base_url,
        api_key_env_var: DEEPSEEK_V4_NATIVE_ROUTE_CONFIG.api_key_env_var,
        model: DEEPSEEK_V4_NATIVE_ROUTE_CONFIG.judge_id,
        response_format: { type: 'json_object' },
        ...DEEPSEEK_V4_DETERMINISTIC_CONFIG,
        strict_json_schema_client_validation: true,
      },
      reasoning_effort: 'not_applicable',
      judgePair: judgePairDeepSeekV4Native,
    },
  ],
  [
    DEEPSEEK_V4_JUDGE_MODEL,
    {
      id: DEEPSEEK_V4_JUDGE_MODEL,
      provider: 'fireworks',
      deterministic_config: {
        api: 'chat_completions',
        base_url: DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG.base_url,
        api_key_env_var: DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG.api_key_env_var,
        model: DEEPSEEK_V4_FIREWORKS_ROUTE_CONFIG.judge_id,
        response_format: { type: 'json_schema', strict: true },
        ...DEEPSEEK_V4_DETERMINISTIC_CONFIG,
        strict_json_schema: true,
      },
      reasoning_effort: 'not_applicable',
      judgePair: judgePairDeepSeekV4,
    },
  ],
]);

export function registeredJudgeIds(): JudgeId[] {
  return [...JUDGES.keys()];
}

export function isRegisteredJudgeId(value: string): value is JudgeId {
  return JUDGES.has(value as JudgeId);
}

export function getJudgeAdapter(id: string): JudgeAdapter {
  const adapter = JUDGES.get(id as JudgeId);
  if (!adapter) {
    throw new EvaluationError(
      'UNKNOWN_JUDGE',
      `Unknown judge "${id}". Registered judges: ${registeredJudgeIds().join(', ')}`,
    );
  }
  return adapter;
}

export function judgeConfigHash(id: string): string {
  const adapter = getJudgeAdapter(id);
  const promptInstructions =
    adapter.id === DEEPSEEK_V4_NATIVE_JUDGE_MODEL
      ? [
          JUDGE_PROMPT_INSTRUCTIONS,
          DEEPSEEK_JSON_OBJECT_SCHEMA_INSTRUCTION,
        ].join('\n\n')
      : JUDGE_PROMPT_INSTRUCTIONS;
  const responseSchema =
    adapter.id === GPT56_JUDGE_MODEL
      ? GPT56_JUDGE_CONFIG_RESPONSE_SCHEMA
      : JUDGE_RESPONSE_SCHEMA;
  return sha256({
    prompt_instructions: promptInstructions,
    response_schema: responseSchema,
    deterministic_config: adapter.deterministic_config,
  });
}

export function registeredJudgeConfigHashes(): Partial<
  Record<JudgeId, string>
> {
  return Object.fromEntries(
    registeredJudgeIds().map((judgeId) => [
      judgeId,
      judgeConfigHash(judgeId),
    ]),
  );
}
