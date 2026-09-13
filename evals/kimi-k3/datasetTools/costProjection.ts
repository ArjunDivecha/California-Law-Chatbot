/**
 * costProjection.ts -- tightened cost projection for the canonical
 * california-law-v1 run, computed from the REAL dataset instead of the
 * dry-run's context-window-max ceiling.
 *
 * WHAT THIS DOES
 *   This module produces both the planning number and the LIVE-START GUARD. It
 *   walks the real 120 tasks and the
 *   real 60 calibration pairs, measures the exact bytes each arm and each judge
 *   would actually be sent (system prompt + tool definitions + history window +
 *   task turns + evidence packet for candidates; the exact
 *   buildSharedJudgePrompt layout for judges), converts characters to tokens
 *   with the documented chars/4 heuristic, and reports a realistic and a
 *   conservative band per arm and for both registered judges
 *   (gpt-5.6-sol and native deepseek-v4-pro).
 *
 *   evals/kimi-k3/costEstimate.ts::estimateConservativeRunCost() still reports
 *   the deliberately extreme context-window-max ceiling (~$14k) in dry-run,
 *   but that informational number does not gate live start. The unchanged
 *   journaled LiveCostCap remains the hard stop before every paid call.
 *
 * TOKENIZER
 *   chars / 4, rounded up. This repository has NO tokenizer dependency and one
 *   is deliberately not added. chars/4 is the standard English-prose
 *   approximation; it runs a little LOW on JSON punctuation and legal citation
 *   strings, which is why the conservative band multiplies it (see
 *   CONSERVATIVE_INPUT_MULTIPLIER) rather than trusting it neat.
 *
 * INPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/calibration.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/config/prices.json
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/config/router.json
 *
 * OUTPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/kimi-k3-eval/cost-projection-<YYYYMMDD>.json
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/kimi-k3-eval/cost-projection-<YYYYMMDD>.md
 *
 * USAGE
 *   ./node_modules/.bin/tsx evals/kimi-k3/datasetTools/costProjection.ts [--date YYYYMMDD]
 *
 * NOTES
 *   Deterministic apart from the output filename, which takes --date (default:
 *   today, UTC). No network. Nothing outside reports/kimi-k3-eval/ is written.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFileSync } from '../journal.js';
import { stableJson } from '../providers/shared.js';
import { estimateConservativeRunCost } from '../costEstimate.js';
import type {
  CalibrationPair,
  EvalArm,
  EvalTask,
  JudgeId,
  PriceTable,
  RouterConfig,
} from '../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = join(HERE, '..');
const REPO_ROOT = resolve(EVAL_ROOT, '..', '..');
const DATASET = join(EVAL_ROOT, 'datasets', 'california-law-v1');
const REPORTS = join(REPO_ROOT, 'reports', 'kimi-k3-eval');

/* ------------------------------------------------------------------ knobs */

/** Frozen run parameters, mirrored from evals/kimi-k3/cli.ts. */
const MAX_OUTPUT_TOKENS = 4_096;
const REPLICATES = 2;
const KIMI_MODEL = 'accounts/fireworks/routers/kimi-k3-us';

/**
 * The canonical live run freezes the PRODUCTION research/drafting system prompt
 * and the application-owned California-law tool definitions. Neither is pinned
 * in this repo's eval config yet (cli.ts uses a one-line fixture placeholder),
 * so their size is an explicit allowance rather than a measurement. 2,000
 * tokens is roughly the size of the production agent's system prompt plus a
 * handful of tool schemas; the conservative band doubles it.
 */
const SYSTEM_AND_TOOLS_TOKENS_REALISTIC = 2_000;
const SYSTEM_AND_TOOLS_TOKENS_CONSERVATIVE = 4_000;

/** chars/4 undercounts JSON and citation strings; pad the conservative band. */
const CONSERVATIVE_INPUT_MULTIPLIER = 1.25;

/**
 * Candidate output length. The dataset carries no reference answers, so this is
 * an assumption, not a measurement, and it is labelled as one everywhere.
 * Deliverable-shaped categories are assumed to run to the output cap.
 */
const REALISTIC_OUTPUT_TOKENS: Record<string, number> = {
  research: 1_600,
  verification: 900,
  abstention_adversarial: 700,
  multi_turn: 1_400,
  drafting: MAX_OUTPUT_TOKENS,
  long_context: 2_400,
};

/**
 * Judge output. gpt-5.6-sol runs at reasoning.effort=high and OpenAI bills
 * reasoning tokens as output, so the visible strict-JSON verdict (a few hundred
 * tokens) is a small part of the bill. 2,000 realistic / cap conservative.
 */
const JUDGE_OUTPUT_TOKENS_REALISTIC = 2_000;
const JUDGE_OUTPUT_TOKENS_CONSERVATIVE = MAX_OUTPUT_TOKENS;

/** Bytes of fixed scaffolding in buildSharedJudgePrompt (instructions + tags). */
const JUDGE_INSTRUCTIONS_CHARS = 700;
const JUDGE_SCHEMA_TOKENS = 400;

const JUDGES = ['gpt-5.6-sol', 'deepseek-v4-pro'] as const;
type JudgeChoice = typeof JUDGES[number];

/* ------------------------------------------------------------------ utils */

function tokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

function loadJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function costUsd(
  price: { input_usd_per_mtok: number; output_usd_per_mtok: number },
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    inputTokens * price.input_usd_per_mtok
    + outputTokens * price.output_usd_per_mtok
  ) / 1_000_000;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

/* ------------------------------------------------------------- measurement */

interface TaskSizing {
  task_id: string;
  category: string;
  turns_chars: number;
  evidence_chars: number;
  criteria_chars: number;
  prompt_chars: number;
  candidate_input_tokens_realistic: number;
  candidate_input_tokens_conservative: number;
  candidate_output_tokens_realistic: number;
  judge_input_tokens_realistic: number;
  judge_input_tokens_conservative: number;
}

function sizeTask(task: EvalTask): TaskSizing {
  const turnsChars = stableJson(task.turns).length;
  const evidenceChars = stableJson(
    task.evidence.map((record) => ({
      source_id: record.source_id,
      title: record.title,
      authoritative_excerpt: record.authoritative_excerpt,
      locator: record.locator,
      jurisdiction: record.jurisdiction,
      authority_status: record.authority_status,
      effective_date: record.effective_date,
    })),
  ).length;
  const criteriaChars = stableJson(
    task.criteria.map((criterion) => ({
      criterion_id: criterion.criterion_id,
      description: criterion.description,
      material: criterion.material,
    })),
  ).length;
  const promptChars = JSON.stringify(task.prompt).length;

  const bodyTokens = tokensFromChars(turnsChars + evidenceChars);
  const candidateRealistic = bodyTokens + SYSTEM_AND_TOOLS_TOKENS_REALISTIC;
  const candidateConservative = Math.ceil(
    bodyTokens * CONSERVATIVE_INPUT_MULTIPLIER,
  ) + SYSTEM_AND_TOOLS_TOKENS_CONSERVATIVE;

  const outputRealistic =
    REALISTIC_OUTPUT_TOKENS[task.category] ?? MAX_OUTPUT_TOKENS;

  // Judge sees: instructions + TASK_PROMPT + ATOMIC_CRITERIA +
  // FROZEN_EVIDENCE_PACKET + both candidate answers.
  const judgeStaticTokens = tokensFromChars(
    JUDGE_INSTRUCTIONS_CHARS + promptChars + criteriaChars + evidenceChars,
  ) + JUDGE_SCHEMA_TOKENS;
  const judgeRealistic = judgeStaticTokens + 2 * outputRealistic;
  const judgeConservative = Math.ceil(
    judgeStaticTokens * CONSERVATIVE_INPUT_MULTIPLIER,
  ) + 2 * MAX_OUTPUT_TOKENS;

  return {
    task_id: task.id,
    category: task.category,
    turns_chars: turnsChars,
    evidence_chars: evidenceChars,
    criteria_chars: criteriaChars,
    prompt_chars: promptChars,
    candidate_input_tokens_realistic: candidateRealistic,
    candidate_input_tokens_conservative: candidateConservative,
    candidate_output_tokens_realistic: outputRealistic,
    judge_input_tokens_realistic: judgeRealistic,
    judge_input_tokens_conservative: judgeConservative,
  };
}

interface CalibrationRow {
  id: string;
  prompt: string;
  answer_a: string;
  answer_b: string;
}

function sizeCalibrationPair(row: CalibrationRow): {
  input_realistic: number;
  input_conservative: number;
} {
  const chars =
    JUDGE_INSTRUCTIONS_CHARS
    + JSON.stringify(row.prompt ?? '').length
    + (row.answer_a ?? '').length
    + (row.answer_b ?? '').length;
  const realistic = tokensFromChars(chars) + JUDGE_SCHEMA_TOKENS;
  return {
    input_realistic: realistic,
    input_conservative: Math.ceil(realistic * CONSERVATIVE_INPUT_MULTIPLIER),
  };
}

export interface DatasetDerivedConservativeCostProjection {
  estimate_usd: number | null;
  method: 'dataset_derived_conservative';
  per_phase_usd: {
    candidates: number | null;
    classifier: number | null;
    pairwise_judging: number | null;
    calibration: number | null;
    total: number | null;
  };
  blocking_price_gaps: string[];
  planned_calls: {
    candidates: number;
    classifier: number;
    pairwise_judging: number;
    calibration: number;
    total: number;
  };
}

/**
 * Conservative live-start projection over the exact dataset and phases a run
 * will execute. This deliberately shares B8's per-row sizing, 1.25x input
 * padding, 4,000-token system/tool allowance, 4,096-token candidate/judge
 * output allowance, and worst-priced router-tier assumption.
 */
export function projectDatasetDerivedConservativeCost(options: {
  tasks: EvalTask[];
  calibration_pairs: CalibrationPair[];
  include_calibration: boolean;
  arms: EvalArm[];
  judge_ids: JudgeId[];
  prices: PriceTable;
  static_anthropic_model: string;
  router_config: Pick<RouterConfig, 'classifier_model' | 'tier_models'> & {
    context_windows: Record<string, number>;
  };
  replicates: number;
}): DatasetDerivedConservativeCostProjection {
  const sizings = options.tasks.map(sizeTask);
  const calibrationSizes = options.include_calibration
    ? options.calibration_pairs.map(sizeCalibrationPair)
    : [];
  const challengerCount = options.arms.filter(
    (arm) => arm !== 'static_anthropic',
  ).length;
  const candidateCalls =
    options.tasks.length * options.replicates * options.arms.length;
  const classifierCalls = options.arms.includes('anthropic_router')
    ? options.tasks.length * options.replicates
    : 0;
  const pairwiseCalls =
    options.tasks.length * options.replicates * challengerCount * 3 *
    options.judge_ids.length;
  const calibrationCalls =
    calibrationSizes.length * 3 * options.judge_ids.length;
  const requiredModels = new Set<string>(options.judge_ids);
  if (options.arms.includes('static_anthropic')) {
    requiredModels.add(options.static_anthropic_model);
  }
  if (options.arms.includes('fireworks_kimi')) {
    requiredModels.add(KIMI_MODEL);
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
  const plannedCalls = {
    candidates: candidateCalls,
    classifier: classifierCalls,
    pairwise_judging: pairwiseCalls,
    calibration: calibrationCalls,
    total:
      candidateCalls + classifierCalls + pairwiseCalls + calibrationCalls,
  };
  if (gaps.length > 0) {
    return {
      estimate_usd: null,
      method: 'dataset_derived_conservative',
      per_phase_usd: {
        candidates: null,
        classifier: null,
        pairwise_judging: null,
        calibration: null,
        total: null,
      },
      blocking_price_gaps: gaps,
      planned_calls: plannedCalls,
    };
  }

  const sumCandidateCost = (model: string): number => {
    const price = options.prices[model];
    if (!price) throw new Error(`missing price for ${model}`);
    return options.replicates * sizings.reduce(
      (sum, sizing) => sum + costUsd(
        price,
        sizing.candidate_input_tokens_conservative,
        MAX_OUTPUT_TOKENS,
      ),
      0,
    );
  };
  let candidates = 0;
  if (options.arms.includes('static_anthropic')) {
    candidates += sumCandidateCost(options.static_anthropic_model);
  }
  if (options.arms.includes('fireworks_kimi')) {
    candidates += sumCandidateCost(KIMI_MODEL);
  }
  if (options.arms.includes('anthropic_router')) {
    candidates += Math.max(
      ...Object.values(options.router_config.tier_models)
        .map(sumCandidateCost),
    );
  }

  let classifier = 0;
  if (options.arms.includes('anthropic_router')) {
    const model = options.router_config.classifier_model;
    const price = options.prices[model];
    if (!price) throw new Error(`missing price for ${model}`);
    classifier = options.replicates * sizings.reduce(
      (sum, sizing) => sum + costUsd(
        price,
        Math.min(
          sizing.candidate_input_tokens_conservative,
          options.router_config.context_windows[model] ?? 200_000,
        ),
        32,
      ),
      0,
    );
  }

  let pairwiseJudging = 0;
  let calibration = 0;
  for (const judgeId of options.judge_ids) {
    const price = options.prices[judgeId];
    if (!price) throw new Error(`missing price for ${judgeId}`);
    pairwiseJudging +=
      options.replicates * challengerCount * 3 * sizings.reduce(
        (sum, sizing) => sum + costUsd(
          price,
          sizing.judge_input_tokens_conservative,
          JUDGE_OUTPUT_TOKENS_CONSERVATIVE,
        ),
        0,
      );
    calibration += 3 * calibrationSizes.reduce(
      (sum, sizing) => sum + costUsd(
        price,
        sizing.input_conservative,
        JUDGE_OUTPUT_TOKENS_CONSERVATIVE,
      ),
      0,
    );
  }
  const total = candidates + classifier + pairwiseJudging + calibration;
  return {
    estimate_usd: total,
    method: 'dataset_derived_conservative',
    per_phase_usd: {
      candidates,
      classifier,
      pairwise_judging: pairwiseJudging,
      calibration,
      total,
    },
    blocking_price_gaps: [],
    planned_calls: plannedCalls,
  };
}

/* ------------------------------------------------------------------- main */

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const stamp = option(args, '--date')
    ?? new Date().toISOString().slice(0, 10).replace(/-/gu, '');

  const tasks = loadJsonl<EvalTask>(join(DATASET, 'tasks.jsonl'));
  const calibration = loadJsonl<CalibrationRow>(
    join(DATASET, 'calibration.jsonl'),
  );
  const prices = JSON.parse(
    readFileSync(join(EVAL_ROOT, 'config', 'prices.json'), 'utf8'),
  ) as PriceTable & { _provenance?: unknown };
  const router = JSON.parse(
    readFileSync(join(EVAL_ROOT, 'config', 'router.json'), 'utf8'),
  ) as {
    classifier_model: string;
    tier_models: Record<string, string>;
    context_windows: Record<string, number>;
  };

  const sizings = tasks.map(sizeTask);
  const staticModel = 'claude-fable-5';
  const pool = Object.values(router.tier_models);

  /* -------------------------------------------------- per-arm candidates */
  const arms: Record<string, {
    model: string | string[];
    realistic_usd: number;
    conservative_usd: number;
    note?: string;
  }> = {};

  const sumOver = (
    model: string,
    band: 'realistic' | 'conservative',
  ): number => {
    const price = prices[model];
    if (!price) throw new Error(`missing price for ${model}`);
    return sizings.reduce((total, sizing) => total + REPLICATES * costUsd(
      price,
      band === 'realistic'
        ? sizing.candidate_input_tokens_realistic
        : sizing.candidate_input_tokens_conservative,
      band === 'realistic'
        ? sizing.candidate_output_tokens_realistic
        : MAX_OUTPUT_TOKENS,
    ), 0);
  };

  arms.static_anthropic = {
    model: staticModel,
    realistic_usd: sumOver(staticModel, 'realistic'),
    conservative_usd: sumOver(staticModel, 'conservative'),
    note: 'Frozen primary model at authoring time (claude-fable-5). The live '
      + 'command freezes and records the exact id it actually used.',
  };
  arms.fireworks_kimi = {
    model: KIMI_MODEL,
    realistic_usd: sumOver(KIMI_MODEL, 'realistic'),
    conservative_usd: sumOver(KIMI_MODEL, 'conservative'),
  };

  // Router: the tier mix is unknown until the classifier runs, so realistic =
  // pool-uniform mean and conservative = the most expensive pool model. Both
  // include the per-replicate haiku classifier call.
  const classifierPrice = prices[router.classifier_model];
  if (!classifierPrice) {
    throw new Error(`missing price for ${router.classifier_model}`);
  }
  const classifierUsd = sizings.reduce((total, sizing) => total + REPLICATES
    * costUsd(
      classifierPrice,
      Math.min(
        sizing.candidate_input_tokens_realistic,
        router.context_windows[router.classifier_model] ?? 200_000,
      ),
      32,
    ), 0);
  const classifierUsdConservative = sizings.reduce(
    (total, sizing) => total + REPLICATES * costUsd(
      classifierPrice,
      Math.min(
        sizing.candidate_input_tokens_conservative,
        router.context_windows[router.classifier_model] ?? 200_000,
      ),
      32,
    ),
    0,
  );
  const poolRealistic = pool.map((model) => sumOver(model, 'realistic'));
  const routerRealistic =
    poolRealistic.reduce((sum, value) => sum + value, 0) / pool.length
    + classifierUsd;
  const worstPool = pool.reduce(
    (worst, model) => Math.max(worst, sumOver(model, 'conservative')),
    0,
  );
  arms.anthropic_router = {
    model: pool,
    realistic_usd: routerRealistic,
    conservative_usd: worstPool + classifierUsdConservative,
    note: 'Realistic = POOL-UNIFORM mean across the four pool models plus the '
      + 'per-replicate claude-haiku-4-5 classifier call. The real tier mix is '
      + 'unknowable before the classifier runs, so this is an explicit '
      + 'placeholder, not a prediction. Conservative = every replicate routed '
      + 'to the most expensive pool model.',
  };

  /* --------------------------------------------------------- judge costs */
  const pairwiseMin = 120 * REPLICATES * 2 * 2; // 2 pair families x 2 orders
  const pairwiseMax = 120 * REPLICATES * 2 * 3; // + one third pass
  const calibrationMin = 120;
  const calibrationMax = 180;

  const calibrationSizes = calibration.map(sizeCalibrationPair);
  const calibrationRealisticTokens = calibrationSizes.reduce(
    (sum, item) => sum + item.input_realistic,
    0,
  ) / Math.max(1, calibrationSizes.length);
  const calibrationConservativeTokens = calibrationSizes.reduce(
    (sum, item) => sum + item.input_conservative,
    0,
  ) / Math.max(1, calibrationSizes.length);

  const judgeCosts: Record<JudgeChoice, {
    model: string;
    pairwise_realistic_usd: number;
    pairwise_conservative_usd: number;
    calibration_realistic_usd: number;
    calibration_conservative_usd: number;
    total_realistic_usd: number;
    total_conservative_usd: number;
  }> = {} as never;

  for (const judge of JUDGES) {
    const price = prices[judge];
    if (!price) throw new Error(`missing price for judge ${judge}`);
    // Each task contributes 4 mirrored pairwise calls per replicate-family
    // minimum (2 families x 2 orders); scale the per-task judge input by that.
    const perTaskRealistic = sizings.reduce(
      (total, sizing) => total + costUsd(
        price,
        sizing.judge_input_tokens_realistic,
        JUDGE_OUTPUT_TOKENS_REALISTIC,
      ),
      0,
    );
    const perTaskConservative = sizings.reduce(
      (total, sizing) => total + costUsd(
        price,
        sizing.judge_input_tokens_conservative,
        JUDGE_OUTPUT_TOKENS_CONSERVATIVE,
      ),
      0,
    );
    const pairwiseRealistic = perTaskRealistic * (pairwiseMin / tasks.length);
    const pairwiseConservative =
      perTaskConservative * (pairwiseMax / tasks.length);
    const calibrationRealistic = calibrationMin * costUsd(
      price,
      Math.ceil(calibrationRealisticTokens),
      JUDGE_OUTPUT_TOKENS_REALISTIC,
    );
    const calibrationConservative = calibrationMax * costUsd(
      price,
      Math.ceil(calibrationConservativeTokens),
      JUDGE_OUTPUT_TOKENS_CONSERVATIVE,
    );
    judgeCosts[judge] = {
      model: judge,
      pairwise_realistic_usd: pairwiseRealistic,
      pairwise_conservative_usd: pairwiseConservative,
      calibration_realistic_usd: calibrationRealistic,
      calibration_conservative_usd: calibrationConservative,
      total_realistic_usd: pairwiseRealistic + calibrationRealistic,
      total_conservative_usd: pairwiseConservative + calibrationConservative,
    };
  }

  /* --------------------------------------------------------- dry-run bound */
  const ceiling = estimateConservativeRunCost({
    task_count: tasks.length,
    replicates: REPLICATES,
    arms: ['static_anthropic', 'anthropic_router', 'fireworks_kimi'],
    prices,
    static_anthropic_model: staticModel,
    router_config: {
      classifier_model: router.classifier_model,
      tier_models: router.tier_models as never,
    },
    max_output_tokens: MAX_OUTPUT_TOKENS,
  });

  /* ------------------------------------------------------------ assemble */
  const candidateRealistic = Object.values(arms)
    .reduce((sum, arm) => sum + arm.realistic_usd, 0);
  const candidateConservative = Object.values(arms)
    .reduce((sum, arm) => sum + arm.conservative_usd, 0);

  const inputTokensSorted = sizings
    .map((sizing) => sizing.candidate_input_tokens_realistic)
    .sort((a, b) => a - b);
  const byCategory: Record<string, {
    tasks: number;
    mean_candidate_input_tokens: number;
    max_candidate_input_tokens: number;
  }> = {};
  for (const sizing of sizings) {
    const bucket = byCategory[sizing.category] ?? {
      tasks: 0,
      mean_candidate_input_tokens: 0,
      max_candidate_input_tokens: 0,
    };
    bucket.tasks += 1;
    bucket.mean_candidate_input_tokens += sizing.candidate_input_tokens_realistic;
    bucket.max_candidate_input_tokens = Math.max(
      bucket.max_candidate_input_tokens,
      sizing.candidate_input_tokens_realistic,
    );
    byCategory[sizing.category] = bucket;
  }
  for (const bucket of Object.values(byCategory)) {
    bucket.mean_candidate_input_tokens = Math.round(
      bucket.mean_candidate_input_tokens / bucket.tasks,
    );
  }

  const totals = Object.fromEntries(JUDGES.map((judge) => [judge, {
    realistic_total_usd: round(candidateRealistic + judgeCosts[judge].total_realistic_usd),
    conservative_total_usd: round(
      candidateConservative + judgeCosts[judge].total_conservative_usd,
    ),
  }]));

  const report = {
    kind: 'tightened_cost_projection',
    dataset: 'california-law-v1',
    spec_ref: 'specs/CALC-KIMI-K3-GPT56-JUDGE-001.spec.md',
    generated_for_date: stamp,
    method: {
      tokenizer: 'chars/4, rounded up (no tokenizer dependency exists in this '
        + 'repo and none was added). Approximate for English prose; runs low on '
        + 'JSON and citation strings, which the conservative band pads by '
        + `${CONSERVATIVE_INPUT_MULTIPLIER}x.`,
      candidate_input: 'measured per task from the real assembled request: '
        + 'stableJson(task.turns) + stableJson(evidence packet) + a system '
        + 'prompt/tool-definition allowance',
      judge_input: 'measured per task from the exact buildSharedJudgePrompt '
        + 'layout: instructions + TASK_PROMPT + ATOMIC_CRITERIA + '
        + 'FROZEN_EVIDENCE_PACKET + both candidate answers',
      calibration_input: 'measured from the real 60-pair calibration.jsonl',
      output_tokens: 'ASSUMPTION, not a measurement — the dataset contains no '
        + 'reference answers. Realistic values are per category; conservative '
        + 'is the 4,096-token output cap everywhere.',
      router_mix: 'ASSUMPTION — pool-uniform mean for realistic, worst pool '
        + 'model for conservative.',
    },
    assumptions: {
      replicates: REPLICATES,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      system_and_tools_tokens_realistic: SYSTEM_AND_TOOLS_TOKENS_REALISTIC,
      system_and_tools_tokens_conservative: SYSTEM_AND_TOOLS_TOKENS_CONSERVATIVE,
      conservative_input_multiplier: CONSERVATIVE_INPUT_MULTIPLIER,
      realistic_output_tokens_by_category: REALISTIC_OUTPUT_TOKENS,
      judge_output_tokens_realistic: JUDGE_OUTPUT_TOKENS_REALISTIC,
      judge_output_tokens_conservative: JUDGE_OUTPUT_TOKENS_CONSERVATIVE,
    },
    measured_dataset: {
      task_count: tasks.length,
      calibration_pairs: calibration.length,
      candidate_input_tokens: {
        total: inputTokensSorted.reduce((sum, value) => sum + value, 0),
        mean: Math.round(
          inputTokensSorted.reduce((sum, value) => sum + value, 0)
          / inputTokensSorted.length,
        ),
        median: percentile(inputTokensSorted, 50),
        p95: percentile(inputTokensSorted, 95),
        max: inputTokensSorted[inputTokensSorted.length - 1],
        min: inputTokensSorted[0],
      },
      by_category: byCategory,
      mean_calibration_judge_input_tokens: Math.round(
        calibrationRealisticTokens,
      ),
    },
    planned_calls: {
      candidate: 120 * REPLICATES * 3,
      classifier: 120 * REPLICATES,
      pairwise_judge: { min: pairwiseMin, max: pairwiseMax },
      calibration_judge: { min: calibrationMin, max: calibrationMax },
    },
    arms: Object.fromEntries(Object.entries(arms).map(([name, arm]) => [name, {
      ...arm,
      realistic_usd: round(arm.realistic_usd),
      conservative_usd: round(arm.conservative_usd),
    }])),
    candidate_side_usd: {
      realistic: round(candidateRealistic),
      conservative: round(candidateConservative),
    },
    judges: Object.fromEntries(JUDGES.map((judge) => [judge, {
      ...judgeCosts[judge],
      pairwise_realistic_usd: round(judgeCosts[judge].pairwise_realistic_usd),
      pairwise_conservative_usd: round(
        judgeCosts[judge].pairwise_conservative_usd,
      ),
      calibration_realistic_usd: round(
        judgeCosts[judge].calibration_realistic_usd,
      ),
      calibration_conservative_usd: round(
        judgeCosts[judge].calibration_conservative_usd,
      ),
      total_realistic_usd: round(judgeCosts[judge].total_realistic_usd),
      total_conservative_usd: round(judgeCosts[judge].total_conservative_usd),
    }])),
    totals_by_judge_choice: totals,
    dry_run_hard_bound: {
      conservative_cost_estimate_usd: ceiling.conservative_cost_estimate_usd,
      note: 'evals/kimi-k3/costEstimate.ts assumes every candidate and judge '
        + 'call fills a 1M-token context window. It is an informational dry-run '
        + 'ceiling and does not gate live start; the dataset-derived '
        + 'conservative projection is checked against --max-cost-usd.',
    },
    recommended_max_cost_usd: Math.ceil(
      Math.max(...JUDGES.map((judge) => totals[judge].conservative_total_usd))
      * 1.2 / 50,
    ) * 50,
  };

  mkdirSync(REPORTS, { recursive: true });
  const jsonPath = join(REPORTS, `cost-projection-${stamp}.json`);
  const mdPath = join(REPORTS, `cost-projection-${stamp}.md`);
  atomicWriteFileSync(jsonPath, `${JSON.stringify(report, null, 1)}\n`, {
    mode: 0o644,
  });

  const usd = (value: number): string => `$${round(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const md: string[] = [];
  md.push('# Tightened cost projection — california-law-v1 canonical run');
  md.push('');
  md.push(`Generated for ${stamp}. Spec: \`${report.spec_ref}\`.`);
  md.push('');
  md.push('## Headline');
  md.push('');
  md.push('| judge | realistic total | conservative total |');
  md.push('| --- | ---: | ---: |');
  for (const judge of JUDGES) {
    md.push(
      `| \`${judge}\` | ${usd(totals[judge].realistic_total_usd)} | `
      + `${usd(totals[judge].conservative_total_usd)} |`,
    );
  }
  md.push('');
  md.push(
    `Dry-run context-window-max ceiling (informational only): `
    + `**${usd(ceiling.conservative_cost_estimate_usd ?? 0)}** — that number `
    + 'assumes every call fills a 1M-token window and does not gate live start. '
    + 'Suggested `--max-cost-usd` for a canonical run: '
    + `**$${report.recommended_max_cost_usd}** (worst judge, conservative band, `
    + '+20% headroom).',
  );
  md.push('');
  md.push('## What the real dataset actually costs to send');
  md.push('');
  const tokenStats = report.measured_dataset.candidate_input_tokens;
  md.push('| statistic | assembled candidate input tokens per task |');
  md.push('| --- | ---: |');
  md.push(`| mean | ${tokenStats.mean.toLocaleString('en-US')} |`);
  md.push(`| median | ${tokenStats.median.toLocaleString('en-US')} |`);
  md.push(`| p95 | ${tokenStats.p95.toLocaleString('en-US')} |`);
  md.push(`| max | ${tokenStats.max.toLocaleString('en-US')} |`);
  md.push(`| min | ${tokenStats.min.toLocaleString('en-US')} |`);
  md.push('');
  md.push(
    `The dry-run guard assumes 1,000,000 input tokens for every one of these. `
    + `The real median is ${tokenStats.median.toLocaleString('en-US')} — about `
    + `${Math.round(1_000_000 / Math.max(1, tokenStats.median))}x smaller.`,
  );
  md.push('');
  md.push('| category | tasks | mean input tokens | max input tokens |');
  md.push('| --- | ---: | ---: | ---: |');
  for (const [category, bucket] of Object.entries(byCategory)) {
    md.push(
      `| ${category} | ${bucket.tasks} | `
      + `${bucket.mean_candidate_input_tokens.toLocaleString('en-US')} | `
      + `${bucket.max_candidate_input_tokens.toLocaleString('en-US')} |`,
    );
  }
  md.push('');
  md.push('## Per arm (720 candidate calls: 3 arms x 120 tasks x 2 replicates)');
  md.push('');
  md.push('| arm | model(s) | realistic | conservative |');
  md.push('| --- | --- | ---: | ---: |');
  for (const [name, arm] of Object.entries(arms)) {
    const model = Array.isArray(arm.model) ? arm.model.join(', ') : arm.model;
    md.push(
      `| \`${name}\` | \`${model}\` | ${usd(arm.realistic_usd)} | `
      + `${usd(arm.conservative_usd)} |`,
    );
  }
  md.push(
    `| **candidate side total** | | **${usd(candidateRealistic)}** | `
    + `**${usd(candidateConservative)}** |`,
  );
  md.push('');
  for (const [name, arm] of Object.entries(arms)) {
    if (arm.note) md.push(`- \`${name}\`: ${arm.note}`);
  }
  md.push('');
  md.push('## Per judge');
  md.push('');
  md.push(
    '| judge | pairwise (960-1440 calls) | calibration (120-180 calls) | '
    + 'judge total |',
  );
  md.push('| --- | ---: | ---: | ---: |');
  for (const judge of JUDGES) {
    const entry = judgeCosts[judge];
    md.push(
      `| \`${judge}\` | ${usd(entry.pairwise_realistic_usd)} – `
      + `${usd(entry.pairwise_conservative_usd)} | `
      + `${usd(entry.calibration_realistic_usd)} – `
      + `${usd(entry.calibration_conservative_usd)} | `
      + `${usd(entry.total_realistic_usd)} – `
      + `${usd(entry.total_conservative_usd)} |`,
    );
  }
  md.push('');
  md.push('## Method and what is assumed rather than measured');
  md.push('');
  md.push(
    '- **Tokenizer:** chars/4, rounded up. There is no tokenizer dependency in '
    + 'this repository and none was added. It approximates English prose well '
    + 'and undercounts JSON punctuation and citation strings, so the '
    + `conservative band multiplies input by ${CONSERVATIVE_INPUT_MULTIPLIER}x.`,
  );
  md.push(
    '- **Measured from real data:** every candidate assembled input (turns + '
    + 'evidence packet), every judge input (the exact `buildSharedJudgePrompt` '
    + 'layout), and all 60 calibration pair inputs.',
  );
  md.push(
    '- **Assumed, not measured:** candidate output length (the dataset has no '
    + 'reference answers) — realistic values per category, conservative is the '
    + '4,096-token cap; judge output length at `reasoning.effort=high`, where '
    + 'reasoning tokens bill as output; the frozen production system prompt and '
    + 'tool definitions, allowed '
    + `${SYSTEM_AND_TOOLS_TOKENS_REALISTIC.toLocaleString('en-US')} / `
    + `${SYSTEM_AND_TOOLS_TOKENS_CONSERVATIVE.toLocaleString('en-US')} tokens; `
    + 'and the router tier mix, which cannot be known before the classifier '
    + 'runs.',
  );
  md.push(
    '- **Live-start gate:** `--max-cost-usd` is compared with this '
    + 'dataset-derived conservative projection for exactly the phases the run '
    + 'will execute. The context-window-max estimate remains informational. '
    + 'The journaled actual-usage guard before each paid call is unchanged.',
  );
  md.push('');
  atomicWriteFileSync(mdPath, `${md.join('\n')}\n`, { mode: 0o644 });

  console.log(JSON.stringify({
    json: jsonPath,
    md: mdPath,
    totals_by_judge_choice: totals,
    candidate_side_usd: report.candidate_side_usd,
    dry_run_hard_bound_usd: ceiling.conservative_cost_estimate_usd,
    recommended_max_cost_usd: report.recommended_max_cost_usd,
  }, null, 1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
