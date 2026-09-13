import type {
  JudgePairInput,
  JudgePairResult,
  OpenAIResponsesJudgeTransportRequest,
} from '../types.js';
import {
  buildSharedJudgePrompt,
  executeJudgeRequest,
  JUDGE_RESPONSE_SCHEMA,
} from './sharedJudge.js';

export const GPT56_JUDGE_MODEL = 'gpt-5.6-sol' as const;
export { JUDGE_RESPONSE_SCHEMA };

/**
 * OpenAI strict json_schema mode rejects `uniqueItems` (verified live
 * 2026-07-27: HTTP 400 invalid_json_schema). Deep-strip it from the copy
 * sent on the wire; the full schema — uniqueness included — is still
 * enforced by the client-side validator, so judge-schema validity is
 * unaffected.
 */
function sanitizeSchemaForOpenAI(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchemaForOpenAI);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'uniqueItems') continue;
      out[key] = sanitizeSchemaForOpenAI(value);
    }
    return out;
  }
  return node;
}

export const GPT56_JUDGE_CONFIG_RESPONSE_SCHEMA =
  sanitizeSchemaForOpenAI(JUDGE_RESPONSE_SCHEMA);

function buildRequest(
  input: JudgePairInput,
): OpenAIResponsesJudgeTransportRequest {
  const prompt = buildSharedJudgePrompt(input);
  return {
    model: GPT56_JUDGE_MODEL,
    api: 'responses',
    reasoning: { effort: 'high' },
    store: false,
    tools: [],
    instructions: prompt.instructions,
    input: prompt.input,
    text: {
      format: {
        type: 'json_schema',
        name: 'california_law_pair_judgment',
        strict: true,
        schema: sanitizeSchemaForOpenAI(prompt.schema) as typeof prompt.schema,
      },
    },
    pair_id: input.anonymous_pair_id,
    task_id: input.task.id,
    order: input.order,
    phase: input.phase,
    pass_index: input.pass_index,
  };
}

export async function judgePair(
  input: JudgePairInput,
): Promise<JudgePairResult> {
  return executeJudgeRequest(input, buildRequest(input), {
    judge_id: GPT56_JUDGE_MODEL,
    judge_reasoning_effort: 'high',
    input_usd_per_mtok: 5,
    output_usd_per_mtok: 30,
  });
}
