import type {
  CandidateResult,
  EvalArm,
  EvalCategory,
  EvalTask,
  PriceTable,
  TokenUsage,
} from './types.js';
import { calculateCost } from './providers/shared.js';
import {
  categoryStratifiedPairedBootstrap,
  type BootstrapInterval,
  type BootstrapOptions,
} from './bootstrap.js';

export interface ArmEfficiency {
  response_count: number;
  task_count: number;
  median_latency_ms: number | null;
  p95_latency_ms: number | null;
  mean_input_tokens: number | null;
  mean_output_tokens: number | null;
  mean_cost_per_task_usd: number | null;
  cost_per_all_pass_task_usd: number | null;
}

export interface RoutingMix {
  total_router_responses: number;
  by_pool_model: Record<string, { count: number; rate: number }>;
  by_category: Record<string, Record<string, { count: number; rate: number }>>;
  classifier_overhead: {
    mean_input_tokens: number | null;
    mean_output_tokens: number | null;
    mean_cost_usd: number | null;
    mean_latency_ms: number | null;
  };
  fallback_count: number;
  fallback_rate: number | null;
}

export interface EfficiencyResult {
  arms: Record<string, ArmEfficiency>;
  paired_deltas_vs_static_anthropic: Record<
    string,
    {
      latency_ms: BootstrapInterval;
      cost_per_task_usd: BootstrapInterval;
    }
  >;
  routing_mix: RoutingMix;
}

interface TaskEfficiencyCluster {
  task_id: string;
  category: EvalCategory;
  arm: EvalArm;
  latency_ms: number | null;
  cost_usd: number | null;
}

function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(probability * sorted.length) - 1];
}

function responseCost(
  result: CandidateResult,
  prices: PriceTable,
): number | null {
  if (result.cost_usd !== null) return result.cost_usd;
  const classifier = result.classifier_usage;
  if (result.arm === 'anthropic_router' && classifier) {
    const candidateUsage: TokenUsage = {
      input_tokens: Math.max(
        0,
        result.input_tokens - classifier.input_tokens,
      ),
      output_tokens: Math.max(
        0,
        result.output_tokens - classifier.output_tokens,
      ),
    };
    const candidateCost = calculateCost(
      candidateUsage,
      prices[result.routed_model_id ?? result.model],
    );
    const classifierCost = result.classifier_cost_usd ??
      calculateCost(classifier, prices['claude-haiku-4-5']);
    return candidateCost === null || classifierCost === null
      ? null
      : candidateCost + classifierCost;
  }
  return calculateCost(
    {
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    },
    prices[result.model],
  );
}

function taskClusters(
  results: CandidateResult[],
  tasks: EvalTask[],
  prices: PriceTable,
): TaskEfficiencyCluster[] {
  const categoryByTask = new Map(tasks.map((task) => [task.id, task.category]));
  const arms = [...new Set(results.map((result) => result.arm))];
  const keys = new Set(
    tasks.flatMap((task) => arms.map((arm) => `${task.id}|${arm}`)),
  );
  return [...keys].map((key) => {
    const [taskId, arm] = key.split('|') as [string, EvalArm];
    const records = results.filter(
      (result) =>
        result.task_id === taskId &&
        result.arm === arm &&
        result.error === null,
    );
    const costs = records.map((record) => responseCost(record, prices));
    return {
      task_id: taskId,
      category: categoryByTask.get(taskId) as EvalCategory,
      arm,
      latency_ms: records.length === 2
        ? mean(records.map((record) => record.latency_ms))
        : null,
      cost_usd:
        records.length === 2 && costs.every((cost) => cost !== null)
          ? mean(costs as number[])
          : null,
    };
  });
}

function routingMix(
  router: CandidateResult[],
  tasks: EvalTask[],
): RoutingMix {
  const categoryByTask = new Map(tasks.map((task) => [task.id, task.category]));
  const byModel = new Map<string, number>();
  const byCategory = new Map<string, Map<string, number>>();
  for (const result of router) {
    const model = result.routed_model_id ?? result.model;
    byModel.set(model, (byModel.get(model) ?? 0) + 1);
    const category = categoryByTask.get(result.task_id) ?? 'unknown';
    const categoryModels = byCategory.get(category) ?? new Map<string, number>();
    categoryModels.set(model, (categoryModels.get(model) ?? 0) + 1);
    byCategory.set(category, categoryModels);
  }
  const classifierRecords = router.filter(
    (result) => result.classifier_usage !== undefined,
  );
  const fallbackCount = router.filter(
    (result) => result.classifier_fallback === true,
  ).length;
  return {
    total_router_responses: router.length,
    by_pool_model: Object.fromEntries(
      [...byModel.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      ).map(([model, count]) => [
        model,
        { count, rate: router.length === 0 ? 0 : count / router.length },
      ]),
    ),
    by_category: Object.fromEntries(
      [...byCategory.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      ).map(([category, models]) => {
        const total = [...models.values()].reduce((sum, count) => sum + count, 0);
        return [
          category,
          Object.fromEntries(
            [...models.entries()].sort(([left], [right]) =>
              left.localeCompare(right)
            ).map(([model, count]) => [
              model,
              { count, rate: count / total },
            ]),
          ),
        ];
      }),
    ),
    classifier_overhead: {
      mean_input_tokens: mean(
        classifierRecords.map(
          (result) => result.classifier_usage?.input_tokens ?? 0,
        ),
      ),
      mean_output_tokens: mean(
        classifierRecords.map(
          (result) => result.classifier_usage?.output_tokens ?? 0,
        ),
      ),
      mean_cost_usd: mean(
        classifierRecords.flatMap((result) =>
          result.classifier_cost_usd === null ||
            result.classifier_cost_usd === undefined
            ? []
            : [result.classifier_cost_usd]
        ),
      ),
      mean_latency_ms: mean(
        classifierRecords.map(
          (result) => result.classifier_latency_ms ?? 0,
        ),
      ),
    },
    fallback_count: fallbackCount,
    fallback_rate: router.length === 0 ? null : fallbackCount / router.length,
  };
}

export function computeEfficiency(
  results: CandidateResult[],
  tasks: EvalTask[],
  prices: PriceTable,
  allPassByTaskArm: Record<string, number | null>,
  bootstrapOptions: BootstrapOptions = {},
): EfficiencyResult {
  const clusters = taskClusters(results, tasks, prices);
  const arms = [...new Set(results.map((result) => result.arm))].sort();
  const metrics = Object.fromEntries(arms.map((arm) => {
    const records = results.filter(
      (result) => result.arm === arm && result.error === null,
    );
    const armClusters = clusters.filter((cluster) => cluster.arm === arm);
    const costs = armClusters.flatMap((cluster) =>
      cluster.cost_usd === null ? [] : [cluster.cost_usd]
    );
    const allPass = armClusters.flatMap((cluster) => {
      const value = allPassByTaskArm[`${cluster.task_id}|${arm}`];
      return value === null || value === undefined ? [] : [value];
    });
    const meanCost = costs.length === armClusters.length ? mean(costs) : null;
    const allPassRate = allPass.length === armClusters.length
      ? mean(allPass)
      : null;
    return [arm, {
      response_count: records.length,
      task_count: armClusters.length,
      median_latency_ms: percentile(
        records.map((record) => record.latency_ms),
        0.5,
      ),
      p95_latency_ms: percentile(
        records.map((record) => record.latency_ms),
        0.95,
      ),
      mean_input_tokens: mean(records.map((record) => record.input_tokens)),
      mean_output_tokens: mean(records.map((record) => record.output_tokens)),
      mean_cost_per_task_usd: meanCost,
      cost_per_all_pass_task_usd:
        meanCost === null || allPassRate === null || allPassRate === 0
          ? null
          : meanCost / allPassRate,
    } satisfies ArmEfficiency];
  }));

  const baselineByTask = new Map(
    clusters.filter((cluster) => cluster.arm === 'static_anthropic')
      .map((cluster) => [cluster.task_id, cluster]),
  );
  const sampleCounts = Object.fromEntries(
    [...new Set(tasks.map((task) => task.category))].map((category) => [
      category,
      tasks.filter((task) => task.category === category).length,
    ]),
  );
  const pairedBootstrapOptions = {
    ...bootstrapOptions,
    sample_counts: bootstrapOptions.sample_counts ?? sampleCounts,
  };
  const paired = Object.fromEntries(
    arms.filter((arm) => arm !== 'static_anthropic').map((arm) => {
      const challenger = clusters.filter((cluster) => cluster.arm === arm);
      const pairable = challenger.filter(
        (cluster) => baselineByTask.has(cluster.task_id),
      );
      return [arm, {
        latency_ms: categoryStratifiedPairedBootstrap(
          pairable,
          (cluster) => {
            const baseline = baselineByTask.get(cluster.task_id);
            return cluster.latency_ms === null || baseline?.latency_ms == null
              ? null
              : cluster.latency_ms - baseline.latency_ms;
          },
          pairedBootstrapOptions,
        ),
        cost_per_task_usd: categoryStratifiedPairedBootstrap(
          pairable,
          (cluster) => {
            const baseline = baselineByTask.get(cluster.task_id);
            return cluster.cost_usd === null || baseline?.cost_usd == null
              ? null
              : cluster.cost_usd - baseline.cost_usd;
          },
          pairedBootstrapOptions,
        ),
      }];
    }),
  );

  return {
    arms: metrics,
    paired_deltas_vs_static_anthropic: paired,
    routing_mix: routingMix(
      results.filter((result) => result.arm === 'anthropic_router'),
      tasks,
    ),
  };
}
