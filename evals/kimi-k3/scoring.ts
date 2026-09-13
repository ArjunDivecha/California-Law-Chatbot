import type {
  CandidateResult,
  DeterministicAssertion,
  EvalTask,
  HardFailureCode,
  JudgePairResult,
  ScoredPair,
} from './types.js';

export const HARD_FAILURE_CODES = [
  'FABRICATED_AUTHORITY',
  'UNSUPPORTED_PROPOSITION',
  'WRONG_JURISDICTION',
  'WRONG_EFFECTIVE_DATE',
  'MATERIAL_FACT_INVENTION',
  'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
  'POLICY_OR_TOOL_VIOLATION',
  'MALFORMED_DELIVERABLE',
] as const satisfies readonly HardFailureCode[];

function textIncludes(text: string, expected: string): boolean {
  return text.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
}

function expectedStrings(assertion: DeterministicAssertion): string[] {
  return Array.isArray(assertion.expected)
    ? assertion.expected.map(String)
    : [String(assertion.expected)];
}

function toolNames(result: CandidateResult): string[] {
  return result.tool_calls.flatMap((call) => {
    if (!call || typeof call !== 'object') return [];
    const record = call as Record<string, unknown>;
    const value = record.name ?? record.tool_name ?? record.type;
    return typeof value === 'string' ? [value] : [];
  });
}

function assertionPasses(
  assertion: DeterministicAssertion,
  result: CandidateResult,
): boolean {
  const values = expectedStrings(assertion);
  switch (assertion.kind) {
    case 'contains':
    case 'citation':
    case 'statute':
      return values.every((value) => textIncludes(result.final_text, value));
    case 'not_contains':
      return values.every((value) => !textIncludes(result.final_text, value));
    case 'tool_call': {
      const actual = toolNames(result);
      return values.every((value) => actual.includes(value));
    }
    case 'schema': {
      if (typeof assertion.expected === 'boolean') {
        if (!assertion.expected) return result.stop_reason !== 'end_turn';
        try {
          const parsed = JSON.parse(result.final_text) as unknown;
          return parsed !== null && typeof parsed === 'object';
        } catch {
          return false;
        }
      }
      return values.every((value) => textIncludes(result.final_text, value));
    }
    case 'abstention': {
      const abstained =
        /(cannot determine|does not establish|insufficient|not enough|manual verification|required evidence is not supplied|decline)/iu
          .test(result.final_text);
      return assertion.expected === false ? !abstained : abstained;
    }
  }
}

function defaultFailureCode(
  assertion: DeterministicAssertion,
): HardFailureCode {
  if (assertion.hard_failure_code) return assertion.hard_failure_code;
  if (assertion.kind === 'schema') return 'MALFORMED_DELIVERABLE';
  if (assertion.kind === 'tool_call') return 'POLICY_OR_TOOL_VIOLATION';
  return 'UNSUPPORTED_PROPOSITION';
}

function mappedSide(
  judgment: JudgePairResult,
  candidate: 'left' | 'right',
): 'answer_a' | 'answer_b' {
  if (judgment.order === 'AB') {
    return candidate === 'left' ? 'answer_a' : 'answer_b';
  }
  return candidate === 'left' ? 'answer_b' : 'answer_a';
}

function mappedWinner(
  judgment: JudgePairResult,
  left: CandidateResult,
  right: CandidateResult,
): CandidateResult['arm'] | 'tie' | 'ungradable' {
  if (!judgment.schema_valid || judgment.winner === 'ungradable') {
    return 'ungradable';
  }
  if (judgment.winner === 'tie') return 'tie';
  const winnerIsLeft =
    (judgment.order === 'AB' && judgment.winner === 'answer_a') ||
    (judgment.order === 'BA' && judgment.winner === 'answer_b');
  return winnerIsLeft ? left.arm : right.arm;
}

function majority<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ordered.length === 0 || ordered[0][1] === ordered[1]?.[1]) return null;
  return ordered[0][0];
}

function criterionPass(
  criterionId: string,
  candidate: 'left' | 'right',
  judgments: JudgePairResult[],
): boolean {
  const votes = judgments.flatMap((judgment) => {
    if (!judgment.schema_valid || judgment.winner === 'ungradable') return [];
    const verdict = judgment.criterion_verdicts.find(
      (item) => item.criterion_id === criterionId,
    );
    if (!verdict) return [];
    return [
      mappedSide(judgment, candidate) === 'answer_a'
        ? verdict.answer_a_pass
        : verdict.answer_b_pass,
    ];
  });
  return majority(votes) ?? false;
}

function judgedFailures(
  candidate: 'left' | 'right',
  judgments: JudgePairResult[],
): HardFailureCode[] {
  const failures = new Set<HardFailureCode>();
  for (const judgment of judgments) {
    if (!judgment.schema_valid) continue;
    const side = mappedSide(judgment, candidate);
    const codes =
      side === 'answer_a'
        ? judgment.answer_a_hard_failures
        : judgment.answer_b_hard_failures;
    for (const code of codes) failures.add(code);
  }
  return HARD_FAILURE_CODES.filter((code) => failures.has(code));
}

export function scorePair(
  task: EvalTask,
  left: CandidateResult,
  right: CandidateResult,
  judgments: JudgePairResult[],
): ScoredPair {
  if (
    left.task_id !== task.id ||
    right.task_id !== task.id ||
    left.replicate !== right.replicate
  ) {
    throw new Error('scorePair requires the same task and replicate');
  }

  const deterministic = task.deterministic_assertions.map((assertion) => ({
    assertion_id: assertion.assertion_id,
    kind: assertion.kind,
    left_pass: assertionPasses(assertion, left),
    right_pass: assertionPasses(assertion, right),
    hard_failure_code: defaultFailureCode(assertion),
  }));
  const leftFailures = new Set(judgedFailures('left', judgments));
  const rightFailures = new Set(judgedFailures('right', judgments));
  for (const result of deterministic) {
    if (!result.left_pass && result.hard_failure_code) {
      leftFailures.add(result.hard_failure_code);
    }
    if (!result.right_pass && result.hard_failure_code) {
      rightFailures.add(result.hard_failure_code);
    }
  }
  if (left.error) leftFailures.add('MALFORMED_DELIVERABLE');
  if (right.error) rightFailures.add('MALFORMED_DELIVERABLE');

  const criterion_pass = Object.fromEntries(
    task.criteria.map((criterion) => [
      criterion.criterion_id,
      {
        left: criterionPass(criterion.criterion_id, 'left', judgments),
        right: criterionPass(criterion.criterion_id, 'right', judgments),
      },
    ]),
  );
  const winners = judgments.map((judgment) =>
    mappedWinner(judgment, left, right)
  );
  const firstTwo = winners.slice(0, 2);
  const positionConsistent =
    firstTwo.length === 2 &&
    firstTwo[0] !== 'ungradable' &&
    firstTwo[0] === firstTwo[1];
  const winner = majority(winners.filter((item) => item !== 'ungradable'));
  const mapped =
    winner ?? (winners.every((item) => item === 'ungradable')
      ? 'ungradable'
      : 'ungradable');
  const material = task.criteria.filter((criterion) => criterion.material);
  const leftGradable =
    left.error === null &&
    judgments.some((judgment) => judgment.schema_valid) &&
    mapped !== 'ungradable';
  const rightGradable =
    right.error === null &&
    judgments.some((judgment) => judgment.schema_valid) &&
    mapped !== 'ungradable';

  return {
    pair_id: judgments[0]?.pair_id ??
      `${task.id}|${left.arm}|${right.arm}|replicate-${left.replicate}`,
    task_id: task.id,
    category: task.category,
    track: task.track,
    replicate: left.replicate,
    left_arm: left.arm,
    right_arm: right.arm,
    mapped_winner: mapped,
    position_consistent: positionConsistent,
    criterion_pass,
    deterministic_assertions: deterministic,
    left_hard_failures: HARD_FAILURE_CODES.filter((code) =>
      leftFailures.has(code)
    ),
    right_hard_failures: HARD_FAILURE_CODES.filter((code) =>
      rightFailures.has(code)
    ),
    left_all_pass:
      leftGradable &&
      material.every((criterion) => criterion_pass[criterion.criterion_id].left) &&
      deterministic.every((assertion) => assertion.left_pass) &&
      leftFailures.size === 0,
    right_all_pass:
      rightGradable &&
      material.every((criterion) => criterion_pass[criterion.criterion_id].right) &&
      deterministic.every((assertion) => assertion.right_pass) &&
      rightFailures.size === 0,
    left_gradable: leftGradable,
    right_gradable: rightGradable,
    third_pass_required: judgments.length > 2,
  };
}
