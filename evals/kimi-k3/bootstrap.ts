import type { EvalCategory } from './types.js';
import type { PairedTaskAggregate } from './aggregate.js';

export const DEFAULT_BOOTSTRAP_SEED = 5601;
export const DEFAULT_BOOTSTRAP_RESAMPLES = 10_000;

export interface BootstrapInterval {
  point_estimate: number | null;
  lower_one_sided_95: number | null;
  upper_one_sided_95: number | null;
  seed: number;
  resamples: number;
  complete_clusters: number;
}

export interface BootstrapCluster {
  task_id: string;
  category: EvalCategory;
}

export interface BootstrapOptions {
  seed?: number;
  resamples?: number;
  sample_counts?: Partial<Record<EvalCategory, number>>;
}

/**
 * Mulberry32 is a compact 32-bit seeded PRNG. It is intentionally implemented
 * here instead of relying on Math.random so identical seed/input/order triples
 * yield byte-identical intervals across Node runs.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted: number[], probability: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.floor(probability * (sorted.length - 1));
  return sorted[index];
}

export function categoryStratifiedPairedBootstrap<T extends BootstrapCluster>(
  clusters: T[],
  delta: (cluster: T) => number | null,
  options: BootstrapOptions = {},
): BootstrapInterval {
  const seed = options.seed ?? DEFAULT_BOOTSTRAP_SEED;
  const resamples = options.resamples ?? DEFAULT_BOOTSTRAP_RESAMPLES;
  if (!Number.isInteger(resamples) || resamples <= 0) {
    throw new Error('bootstrap resamples must be a positive integer');
  }
  const usable = clusters.filter((cluster) => delta(cluster) !== null);
  if (usable.length === 0) {
    return {
      point_estimate: null,
      lower_one_sided_95: null,
      upper_one_sided_95: null,
      seed,
      resamples,
      complete_clusters: 0,
    };
  }
  const byCategory = new Map<EvalCategory, T[]>();
  for (const cluster of usable) {
    const group = byCategory.get(cluster.category) ?? [];
    group.push(cluster);
    byCategory.set(cluster.category, group);
  }
  const categoryEntries = [...byCategory.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  if (
    Object.entries(options.sample_counts ?? {}).some(([category, count]) =>
      (count ?? 0) > 0 &&
      (byCategory.get(category as EvalCategory)?.length ?? 0) === 0
    )
  ) {
    return {
      point_estimate: null,
      lower_one_sided_95: null,
      upper_one_sided_95: null,
      seed,
      resamples,
      complete_clusters: usable.length,
    };
  }

  const random = mulberry32(seed);
  const estimates: number[] = [];
  for (let iteration = 0; iteration < resamples; iteration += 1) {
    const sampled: number[] = [];
    for (const [category, group] of categoryEntries) {
      const count = options.sample_counts?.[category] ?? group.length;
      for (let draw = 0; draw < count; draw += 1) {
        const cluster = group[Math.floor(random() * group.length)];
        sampled.push(delta(cluster) as number);
      }
    }
    if (sampled.length > 0) estimates.push(mean(sampled));
  }
  estimates.sort((left, right) => left - right);
  return {
    point_estimate: mean(usable.map((cluster) => delta(cluster) as number)),
    lower_one_sided_95: percentile(estimates, 0.05),
    upper_one_sided_95: percentile(estimates, 0.95),
    seed,
    resamples,
    complete_clusters: usable.length,
  };
}

export function bootstrapQualityDeltas(
  tasks: PairedTaskAggregate[],
  options: BootstrapOptions = {},
): {
  all_pass_delta: BootstrapInterval;
  material_hard_failure_delta: BootstrapInterval;
} {
  const complete = tasks.filter((task) => task.complete_paired_task);
  const challenger = tasks[0]?.challenger_arm;
  const sampleCounts = Object.fromEntries(
    [...new Set(tasks.map((task) => task.category))].map((category) => [
      category,
      tasks.filter((task) => task.category === category).length,
    ]),
  );
  const effectiveOptions = {
    ...options,
    sample_counts: options.sample_counts ?? sampleCounts,
  };
  return {
    all_pass_delta: categoryStratifiedPairedBootstrap(
      complete,
      (task) => {
        if (!challenger) return null;
        const candidate = task.arms[challenger].all_pass_mean;
        const baseline = task.arms.static_anthropic.all_pass_mean;
        return candidate === null || baseline === null
          ? null
          : candidate - baseline;
      },
      effectiveOptions,
    ),
    material_hard_failure_delta: categoryStratifiedPairedBootstrap(
      complete,
      (task) => {
        if (!challenger) return null;
        const candidate =
          task.arms[challenger].material_hard_failure_mean;
        const baseline =
          task.arms.static_anthropic.material_hard_failure_mean;
        return candidate === null || baseline === null
          ? null
          : candidate - baseline;
      },
      effectiveOptions,
    ),
  };
}
