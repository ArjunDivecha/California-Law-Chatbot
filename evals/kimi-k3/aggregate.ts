import type {
  EvalArm,
  EvalCategory,
  EvalTask,
  EvalTrack,
  HardFailureCode,
  ScoredPair,
} from './types.js';

export type CellStatus = 'gradable' | 'missing' | 'failed' | 'ungradable';

export interface ReplicateScoreCell {
  task_id: string;
  category: EvalCategory;
  track: EvalTrack;
  arm: EvalArm;
  replicate: 1 | 2;
  status: CellStatus;
  all_pass: 0 | 1 | null;
  material_hard_failure: 0 | 1 | null;
  criterion_pass_rate: number | null;
  hard_failures: HardFailureCode[];
}

export interface ArmTaskAggregate {
  arm: EvalArm;
  cells: [ReplicateScoreCell, ReplicateScoreCell];
  two_gradable_replicates: boolean;
  all_pass_mean: 0 | 0.5 | 1 | null;
  material_hard_failure_mean: 0 | 0.5 | 1 | null;
  criterion_pass_rate_mean: number | null;
}

export interface PairedTaskAggregate {
  task_id: string;
  category: EvalCategory;
  track: EvalTrack;
  baseline_arm: 'static_anthropic';
  challenger_arm: Exclude<EvalArm, 'static_anthropic'>;
  complete_paired_task: boolean;
  arms: Record<string, ArmTaskAggregate>;
  pairwise: {
    challenger_wins: number;
    baseline_wins: number;
    ties: number;
    ungradable: number;
    challenger_win_rate_non_ties: number | null;
  };
}

export interface MetricSummary {
  task_count: number;
  complete_task_count: number;
  all_pass_rate: number | null;
  material_hard_failure_rate: number | null;
  criterion_pass_rate: number | null;
  pairwise_win_rate_non_ties: number | null;
}

export interface AggregateResult {
  challenger_arm: Exclude<EvalArm, 'static_anthropic'>;
  tasks: PairedTaskAggregate[];
  complete_paired_tasks: number;
  overall: Record<string, MetricSummary>;
  by_category: Record<string, Record<string, MetricSummary>>;
  by_track: Record<string, Record<string, MetricSummary>>;
  visible_cell_counts: Record<CellStatus, number>;
}

function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyCell(
  task: EvalTask,
  arm: EvalArm,
  replicate: 1 | 2,
): ReplicateScoreCell {
  return {
    task_id: task.id,
    category: task.category,
    track: task.track,
    arm,
    replicate,
    status: 'missing',
    all_pass: null,
    material_hard_failure: null,
    criterion_pass_rate: null,
    hard_failures: [],
  };
}

function sideCell(
  task: EvalTask,
  pair: ScoredPair,
  arm: EvalArm,
): ReplicateScoreCell {
  const left = pair.left_arm === arm;
  const gradable = left ? pair.left_gradable : pair.right_gradable;
  const hardFailures = left
    ? pair.left_hard_failures
    : pair.right_hard_failures;
  const criterionValues = Object.values(pair.criterion_pass).map((item) =>
    left ? item.left : item.right
  );
  return {
    task_id: task.id,
    category: task.category,
    track: task.track,
    arm,
    replicate: pair.replicate as 1 | 2,
    status: gradable
      ? 'gradable'
      : hardFailures.includes('MALFORMED_DELIVERABLE')
        ? 'failed'
        : 'ungradable',
    all_pass: gradable
      ? ((left ? pair.left_all_pass : pair.right_all_pass) ? 1 : 0)
      : null,
    material_hard_failure: gradable ? (hardFailures.length > 0 ? 1 : 0) : null,
    criterion_pass_rate: gradable
      ? mean(criterionValues.map((value) => value ? 1 : 0))
      : null,
    hard_failures: [...hardFailures],
  };
}

function armAggregate(
  arm: EvalArm,
  cells: [ReplicateScoreCell, ReplicateScoreCell],
): ArmTaskAggregate {
  const complete = cells.every((cell) => cell.status === 'gradable');
  const allPass = complete
    ? mean(cells.map((cell) => cell.all_pass as number))
    : null;
  const hardFailure = complete
    ? mean(cells.map((cell) => cell.material_hard_failure as number))
    : null;
  return {
    arm,
    cells,
    two_gradable_replicates: complete,
    all_pass_mean: allPass as 0 | 0.5 | 1 | null,
    material_hard_failure_mean: hardFailure as 0 | 0.5 | 1 | null,
    criterion_pass_rate_mean: complete
      ? mean(cells.map((cell) => cell.criterion_pass_rate as number))
      : null,
  };
}

function summarize(
  records: PairedTaskAggregate[],
  arm: EvalArm,
): MetricSummary {
  const complete = records.filter(
    (record) => record.arms[arm].two_gradable_replicates,
  );
  const pairwise = records.flatMap((record) => {
    const value = record.pairwise.challenger_win_rate_non_ties;
    if (value === null) return [];
    return [
      arm === record.challenger_arm
        ? value
        : 1 - value,
    ];
  });
  return {
    task_count: records.length,
    complete_task_count: complete.length,
    all_pass_rate: mean(
      complete.map((record) => record.arms[arm].all_pass_mean as number),
    ),
    material_hard_failure_rate: mean(
      complete.map(
        (record) => record.arms[arm].material_hard_failure_mean as number,
      ),
    ),
    criterion_pass_rate: mean(
      complete.map(
        (record) => record.arms[arm].criterion_pass_rate_mean as number,
      ),
    ),
    pairwise_win_rate_non_ties: mean(pairwise),
  };
}

export function aggregatePairs(
  tasks: EvalTask[],
  scoredPairs: ScoredPair[],
  challengerArm: Exclude<EvalArm, 'static_anthropic'>,
): AggregateResult {
  const records = tasks.map((task): PairedTaskAggregate => {
    const relevant = scoredPairs.filter(
      (pair) =>
        pair.task_id === task.id &&
        [pair.left_arm, pair.right_arm].includes('static_anthropic') &&
        [pair.left_arm, pair.right_arm].includes(challengerArm),
    );
    const makeCells = (arm: EvalArm): [ReplicateScoreCell, ReplicateScoreCell] =>
      ([1, 2].map((replicate) => {
        const pair = relevant.find((item) => item.replicate === replicate);
        return pair
          ? sideCell(task, pair, arm)
          : emptyCell(task, arm, replicate as 1 | 2);
      }) as [ReplicateScoreCell, ReplicateScoreCell]);
    const baseline = armAggregate(
      'static_anthropic',
      makeCells('static_anthropic'),
    );
    const challenger = armAggregate(challengerArm, makeCells(challengerArm));
    let challengerWins = 0;
    let baselineWins = 0;
    let ties = 0;
    let ungradable = 0;
    for (const pair of relevant) {
      if (pair.mapped_winner === challengerArm) challengerWins += 1;
      else if (pair.mapped_winner === 'static_anthropic') baselineWins += 1;
      else if (pair.mapped_winner === 'tie') ties += 1;
      else ungradable += 1;
    }
    return {
      task_id: task.id,
      category: task.category,
      track: task.track,
      baseline_arm: 'static_anthropic',
      challenger_arm: challengerArm,
      complete_paired_task:
        baseline.two_gradable_replicates &&
        challenger.two_gradable_replicates,
      arms: {
        static_anthropic: baseline,
        [challengerArm]: challenger,
      },
      pairwise: {
        challenger_wins: challengerWins,
        baseline_wins: baselineWins,
        ties,
        ungradable,
        challenger_win_rate_non_ties:
          challengerWins + baselineWins === 0
            ? null
            : challengerWins / (challengerWins + baselineWins),
      },
    };
  });

  const arms: EvalArm[] = ['static_anthropic', challengerArm];
  const overall = Object.fromEntries(
    arms.map((arm) => [arm, summarize(records, arm)]),
  );
  const by_category = Object.fromEntries(
    [...new Set(tasks.map((task) => task.category))].map((category) => {
      const subset = records.filter((record) => record.category === category);
      return [
        category,
        Object.fromEntries(arms.map((arm) => [arm, summarize(subset, arm)])),
      ];
    }),
  );
  const by_track = Object.fromEntries(
    [...new Set(tasks.map((task) => task.track))].map((track) => {
      const subset = records.filter((record) => record.track === track);
      return [
        track,
        Object.fromEntries(arms.map((arm) => [arm, summarize(subset, arm)])),
      ];
    }),
  );
  const visibleCells = records.flatMap((record) =>
    Object.values(record.arms).flatMap((arm) => arm.cells)
  );
  return {
    challenger_arm: challengerArm,
    tasks: records,
    complete_paired_tasks: records.filter(
      (record) => record.complete_paired_task,
    ).length,
    overall,
    by_category,
    by_track,
    visible_cell_counts: {
      gradable: visibleCells.filter((cell) => cell.status === 'gradable').length,
      missing: visibleCells.filter((cell) => cell.status === 'missing').length,
      failed: visibleCells.filter((cell) => cell.status === 'failed').length,
      ungradable: visibleCells.filter(
        (cell) => cell.status === 'ungradable'
      ).length,
    },
  };
}
