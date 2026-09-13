import type {
  CalibrationPair,
  EvalArm,
  EvalTask,
  JudgeId,
  PriceEntry,
  PriceTable,
  RouterConfig,
} from './types.js';
import { FIREWORKS_KIMI_MODEL } from './providers/fireworksKimi.js';
import { GPT56_JUDGE_MODEL } from './judge/gpt56Judge.js';

export interface PlannedCallRange {
  candidate: { min: number; max: number };
  classifier: { min: number; max: number };
  pairwise_judge: { min: number; max: number };
  calibration_judge: { min: number; max: number };
  total: { min: number; max: number };
}

export interface ConservativeCostEstimate {
  planned_calls: PlannedCallRange;
  conservative_cost_estimate_usd: number | null;
  cost_estimate_blocking_gaps: string[];
  assumptions: {
    candidate_input_tokens_per_call: number;
    candidate_output_tokens_per_call: number;
    classifier_input_tokens_per_call: number;
    classifier_output_tokens_per_call: number;
    judge_input_tokens_per_call: number;
    judge_output_tokens_per_call: number;
  };
}

function callCost(
  price: PriceEntry,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    inputTokens * price.input_usd_per_mtok +
    outputTokens * price.output_usd_per_mtok
  ) / 1_000_000;
}

export function estimateConservativeRunCost(options: {
  task_count: number;
  replicates: number;
  arms: EvalArm[];
  prices: PriceTable;
  static_anthropic_model: string;
  router_config: Pick<RouterConfig, 'classifier_model' | 'tier_models'>;
  max_output_tokens: number;
  tasks?: EvalTask[];
  calibration_pairs?: CalibrationPair[];
  judge_ids?: JudgeId[];
}): ConservativeCostEstimate {
  const judgeIds = options.judge_ids ?? [GPT56_JUDGE_MODEL];
  const judgeCount = judgeIds.length;
  const challengerCount = options.arms.filter(
    (arm) => arm !== 'static_anthropic',
  ).length;
  const candidateCalls =
    options.task_count * options.replicates * options.arms.length;
  const classifierCalls = options.arms.includes('anthropic_router')
    ? options.task_count * options.replicates
    : 0;
  const pairwiseMin =
    options.task_count * options.replicates * challengerCount * 2 * judgeCount;
  const pairwiseMax =
    options.task_count * options.replicates * challengerCount * 3 * judgeCount;
  const hasExactTasks =
    options.tasks !== undefined &&
    options.tasks.length === options.task_count &&
    options.tasks.length > 0;
  const hasExactCalibration =
    options.calibration_pairs !== undefined &&
    options.calibration_pairs.length > 0;
  const calibrationPairCount = hasExactCalibration
    ? (options.calibration_pairs as CalibrationPair[]).length
    : 60;
  const calibrationMin = calibrationPairCount * 2 * judgeCount;
  const calibrationMax = calibrationPairCount * 3 * judgeCount;
  const candidateInputs = hasExactTasks
    ? (options.tasks as EvalTask[]).map((task) =>
        Math.ceil(Buffer.byteLength(JSON.stringify({
          prompt: task.prompt,
          turns: task.turns,
          evidence: task.evidence,
        }), 'utf8') / 2) + 2_000
      )
    : Array.from(
        { length: options.task_count },
        () => 1_000_000,
      );
  const classifierInputs = hasExactTasks
    ? (options.tasks as EvalTask[]).map((task) =>
        Math.ceil(Buffer.byteLength(JSON.stringify({
          prompt: task.prompt,
          turns: task.turns,
          evidence: task.evidence,
        }), 'utf8') / 2) + 1_000
      )
    : Array.from(
        { length: options.task_count },
        () => 200_000,
      );
  const judgeInputs = hasExactTasks
    ? (options.tasks as EvalTask[]).map((task) =>
        Math.ceil(Buffer.byteLength(JSON.stringify({
          prompt: task.prompt,
          criteria: task.criteria,
          evidence: task.evidence,
        }), 'utf8') / 2) + (2 * options.max_output_tokens) + 2_000
      )
    : Array.from(
        { length: options.task_count },
        () => 1_000_000,
      );
  const calibrationInputs = hasExactCalibration
    ? (options.calibration_pairs as CalibrationPair[]).map((pair) =>
        Math.ceil(Buffer.byteLength(JSON.stringify({
          prompt: pair.prompt,
          criterion: pair.criterion,
          evidence: pair.evidence,
          answer_a: pair.answer_a,
          answer_b: pair.answer_b,
        }), 'utf8') / 2) + 2_000
      )
    : Array.from({ length: calibrationPairCount }, () => 1_000_000);
  const planned_calls: PlannedCallRange = {
    candidate: { min: candidateCalls, max: candidateCalls },
    classifier: { min: classifierCalls, max: classifierCalls },
    pairwise_judge: { min: pairwiseMin, max: pairwiseMax },
    calibration_judge: { min: calibrationMin, max: calibrationMax },
    total: {
      min: candidateCalls + classifierCalls + pairwiseMin + calibrationMin,
      max: candidateCalls + classifierCalls + pairwiseMax + calibrationMax,
    },
  };
  const assumptions = {
    candidate_input_tokens_per_call: Math.max(...candidateInputs, 0),
    candidate_output_tokens_per_call: options.max_output_tokens,
    classifier_input_tokens_per_call: Math.max(...classifierInputs, 0),
    classifier_output_tokens_per_call: 32,
    judge_input_tokens_per_call: Math.max(
      ...judgeInputs,
      ...calibrationInputs,
      0,
    ),
    judge_output_tokens_per_call: options.max_output_tokens,
  };
  const requiredModels = new Set<string>(judgeIds);
  if (options.arms.includes('static_anthropic')) {
    requiredModels.add(options.static_anthropic_model);
  }
  if (options.arms.includes('fireworks_kimi')) {
    requiredModels.add(FIREWORKS_KIMI_MODEL);
  }
  if (options.arms.includes('anthropic_router')) {
    requiredModels.add(options.router_config.classifier_model);
    for (const model of Object.values(options.router_config.tier_models)) {
      requiredModels.add(model);
    }
  }
  const gaps = [...requiredModels].filter(
    (model) => options.prices[model] == null,
  ).sort();
  if (gaps.length > 0) {
    return {
      planned_calls,
      conservative_cost_estimate_usd: null,
      cost_estimate_blocking_gaps: gaps,
      assumptions,
    };
  }

  let estimate = 0;
  const sumCandidateCost = (model: string): number =>
    options.replicates * candidateInputs.reduce(
      (sum, inputTokens) =>
        sum + callCost(
          options.prices[model] as PriceEntry,
          inputTokens,
          assumptions.candidate_output_tokens_per_call,
        ),
      0,
    );
  if (options.arms.includes('static_anthropic')) {
    estimate += sumCandidateCost(options.static_anthropic_model);
  }
  if (options.arms.includes('fireworks_kimi')) {
    estimate += sumCandidateCost(FIREWORKS_KIMI_MODEL);
  }
  if (options.arms.includes('anthropic_router')) {
    const pool = Object.values(options.router_config.tier_models);
    estimate += Math.max(...pool.map((model) => sumCandidateCost(model)));
    estimate += options.replicates * classifierInputs.reduce(
      (sum, inputTokens) =>
        sum + callCost(
          options.prices[options.router_config.classifier_model] as PriceEntry,
          inputTokens,
          assumptions.classifier_output_tokens_per_call,
        ),
      0,
    );
  }
  for (const judgeId of judgeIds) {
    const price = options.prices[judgeId] as PriceEntry;
    estimate += options.replicates * challengerCount * 3 *
      judgeInputs.reduce(
        (sum, inputTokens) =>
          sum + callCost(
            price,
            inputTokens,
            assumptions.judge_output_tokens_per_call,
          ),
        0,
      );
    estimate += 3 * calibrationInputs.reduce(
      (sum, inputTokens) =>
        sum + callCost(
          price,
          inputTokens,
          assumptions.judge_output_tokens_per_call,
        ),
      0,
    );
  }
  return {
    planned_calls,
    conservative_cost_estimate_usd: estimate,
    cost_estimate_blocking_gaps: [],
    assumptions,
  };
}
