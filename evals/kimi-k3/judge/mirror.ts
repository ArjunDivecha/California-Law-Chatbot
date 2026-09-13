import type {
  EvalArm,
  HardFailureCode,
  JudgePairResult,
  MirroredJudgeInput,
  MirroredJudgeResult,
} from '../types.js';
import { getJudgeAdapter, DEFAULT_JUDGE_ID } from './judgeRegistry.js';

type MappedWinner = EvalArm | 'tie' | 'ungradable';

function mapWinner(
  judgment: JudgePairResult,
  input: MirroredJudgeInput,
): MappedWinner {
  if (!judgment.schema_valid) return 'ungradable';
  if (judgment.winner === 'tie' || judgment.winner === 'ungradable') {
    return judgment.winner;
  }
  const displayedA =
    judgment.order === 'AB' ? input.left.arm : input.right.arm;
  const displayedB =
    judgment.order === 'AB' ? input.right.arm : input.left.arm;
  return judgment.winner === 'answer_a' ? displayedA : displayedB;
}

function unionFailures(
  judgments: JudgePairResult[],
  input: MirroredJudgeInput,
): { left: HardFailureCode[]; right: HardFailureCode[] } {
  const left = new Set<HardFailureCode>();
  const right = new Set<HardFailureCode>();
  for (const judgment of judgments) {
    if (!judgment.schema_valid) continue;
    const displayedA =
      judgment.order === 'AB' ? left : right;
    const displayedB =
      judgment.order === 'AB' ? right : left;
    for (const code of judgment.answer_a_hard_failures) displayedA.add(code);
    for (const code of judgment.answer_b_hard_failures) displayedB.add(code);
  }
  return {
    left: [...left].sort(),
    right: [...right].sort(),
  };
}

function majority(values: MappedWinner[]): MappedWinner {
  const counts = new Map<MappedWinner, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const winner = [...counts.entries()].find(([, count]) => count >= 2);
  return winner?.[0] ?? 'ungradable';
}

export async function judgeMirroredPair(
  input: MirroredJudgeInput,
): Promise<MirroredJudgeResult> {
  const adapter = input.adapter ?? getJudgeAdapter(DEFAULT_JUDGE_ID);
  const ab = await adapter.judgePair({
    task: input.task,
    answer_a: input.left,
    answer_b: input.right,
    order: 'AB',
    anonymous_pair_id: input.pair_id,
    phase: input.phase,
    pass_index: 1,
    transport: input.transport,
  });
  const ba = await adapter.judgePair({
    task: input.task,
    answer_a: input.left,
    answer_b: input.right,
    order: 'BA',
    anonymous_pair_id: input.pair_id,
    phase: input.phase,
    pass_index: 2,
    transport: input.transport,
  });
  const judgments = [ab, ba];
  const initialWinners = judgments.map((judgment) =>
    mapWinner(judgment, input),
  );
  const position_consistent = initialWinners[0] === initialWinners[1];
  if (!position_consistent) {
    judgments.push(await adapter.judgePair({
      task: input.task,
      answer_a: input.left,
      answer_b: input.right,
      order: 'AB',
      anonymous_pair_id: input.pair_id,
      phase: input.phase,
      pass_index: 3,
      transport: input.transport,
    }));
  }

  const failures = unionFailures(judgments, input);
  const mapped = judgments.map((judgment) => mapWinner(judgment, input));
  return {
    pair_id: input.pair_id,
    task_id: input.task.id,
    left_arm: input.left.arm,
    right_arm: input.right.arm,
    mapped_winner: position_consistent ? mapped[0] : majority(mapped),
    position_consistent,
    third_pass_required: !position_consistent,
    judgments,
    left_hard_failures: failures.left,
    right_hard_failures: failures.right,
  };
}
