import type { EvalArm, EvalCategory } from './types.js';

export type Recommendation =
  | 'QUALIFIED_FOR_CONTROLLED_SHADOW'
  | 'SHADOW_WITH_ANTHROPIC_ESCALATION'
  | 'KEEP_ANTHROPIC'
  | 'INCONCLUSIVE';

export interface RecommendationInput {
  arm: Exclude<EvalArm, 'static_anthropic'>;
  calibration_pass: boolean;
  benchmark_integrity_pass: boolean;
  complete_paired_tasks: number;
  all_pass_delta_one_sided_ci95_lower?: number | null;
  material_hard_failure_delta_one_sided_ci95_upper?: number | null;
  worst_category_all_pass_point_delta?: number | null;
  category_all_pass_point_deltas?: Partial<Record<EvalCategory, number | null>>;
  weak_category?: EvalCategory;
  fabricated_authority_count?: number;
  tool_schema_completion?: number;
  mean_cost_per_task_point_delta_pct?: number | null;
  predeclared_escalation_rules?: Partial<Record<EvalCategory, string>>;
  predeclared_anthropic_escalation_categories?: EvalCategory[];
  exact_model_config_identity_available?: boolean;
  confidence_intervals_computable?: boolean;
  missing_reviewer_attestations?: number;
  missing_source_integrity_checks?: number;
  [key: string]: unknown;
}

export interface RecommendationResult {
  arm: RecommendationInput['arm'];
  recommendation: Recommendation;
  reason_code: string | null;
  reason_codes: string[];
}

function numberAlias(
  input: RecommendationInput,
  normalized: keyof RecommendationInput,
  aliases: string[],
): number | null | undefined {
  const direct = input[normalized];
  if (typeof direct === 'number') return direct;
  if (direct === null) return null;
  for (const alias of aliases) {
    const value = input[alias];
    if (typeof value === 'number') return value;
    if (value === null) return null;
  }
  return undefined;
}

export function recommendArm(
  input: RecommendationInput,
): RecommendationResult {
  const prefix = input.arm === 'anthropic_router' ? 'router' : 'kimi';
  const allPassLower = numberAlias(
    input,
    'all_pass_delta_one_sided_ci95_lower',
    [`${prefix}_all_pass_delta_one_sided_ci95_lower`],
  );
  const hardFailureUpper = numberAlias(
    input,
    'material_hard_failure_delta_one_sided_ci95_upper',
    [`${prefix}_material_hard_failure_delta_one_sided_ci95_upper`],
  );
  const fabricated = numberAlias(
    input,
    'fabricated_authority_count',
    [`${prefix}_fabricated_authority_count`],
  );
  const costDelta = numberAlias(
    input,
    'mean_cost_per_task_point_delta_pct',
    [`${prefix}_mean_cost_per_task_point_delta_pct`],
  );

  const inconclusive: string[] = [];
  if (!input.benchmark_integrity_pass) inconclusive.push('BENCHMARK_INTEGRITY_FAILED');
  if (!input.calibration_pass) inconclusive.push('JUDGE_CALIBRATION_FAILED');
  if (input.complete_paired_tasks < 108) inconclusive.push('INSUFFICIENT_COMPLETE_PAIRED_TASKS');
  if (input.exact_model_config_identity_available === false) {
    inconclusive.push('MODEL_CONFIG_IDENTITY_UNAVAILABLE');
  }
  if (
    input.confidence_intervals_computable === false ||
    allPassLower === null ||
    allPassLower === undefined ||
    hardFailureUpper === null ||
    hardFailureUpper === undefined
  ) {
    inconclusive.push('PAIRED_CONFIDENCE_INTERVAL_UNAVAILABLE');
  }
  if ((input.missing_reviewer_attestations ?? 0) > 0) {
    inconclusive.push('MISSING_REVIEWER_ATTESTATION');
  }
  if ((input.missing_source_integrity_checks ?? 0) > 0) {
    inconclusive.push('MISSING_SOURCE_INTEGRITY_CHECK');
  }
  if (inconclusive.length > 0) {
    return {
      arm: input.arm,
      recommendation: 'INCONCLUSIVE',
      reason_code: inconclusive[0],
      reason_codes: inconclusive,
    };
  }

  const failed: string[] = [];
  if ((allPassLower as number) < -0.05) {
    failed.push('ALL_PASS_NONINFERIORITY_FAILED');
  }
  if ((hardFailureUpper as number) > 0.02) {
    failed.push('MATERIAL_HARD_FAILURE_SAFETY_FAILED');
  }
  if ((fabricated ?? 0) !== 0) failed.push('FABRICATED_AUTHORITY_PRESENT');
  if ((input.tool_schema_completion ?? 0) < 0.99) {
    failed.push('TOOL_SCHEMA_COMPLETION_FAILED');
  }
  if (input.arm === 'anthropic_router' && (costDelta === null || costDelta === undefined || costDelta >= 0)) {
    failed.push('ROUTER_NO_COST_ADVANTAGE');
  }
  if (failed.length > 0) {
    return {
      arm: input.arm,
      recommendation: 'KEEP_ANTHROPIC',
      reason_code: failed[0],
      reason_codes: failed,
    };
  }

  const weakCategories = new Set<EvalCategory>();
  for (const [category, value] of Object.entries(
    input.category_all_pass_point_deltas ?? {},
  )) {
    if (value !== null && value !== undefined && value < -0.10) {
      weakCategories.add(category as EvalCategory);
    }
  }
  if (
    weakCategories.size === 0 &&
    (input.worst_category_all_pass_point_delta ?? 0) < -0.10 &&
    input.weak_category
  ) {
    weakCategories.add(input.weak_category);
  }
  if (
    weakCategories.size === 0 &&
    (input.worst_category_all_pass_point_delta ?? 0) < -0.10
  ) {
    return {
      arm: input.arm,
      recommendation: 'KEEP_ANTHROPIC',
      reason_code: 'CATEGORY_ALL_PASS_GATE_FAILED',
      reason_codes: [
        'CATEGORY_ALL_PASS_GATE_FAILED',
        'WEAK_CATEGORY_IDENTITY_UNAVAILABLE',
      ],
    };
  }
  if (weakCategories.size > 0) {
    const declared = new Set([
      ...Object.keys(input.predeclared_escalation_rules ?? {}),
      ...(input.predeclared_anthropic_escalation_categories ?? []),
    ]);
    const undeclared = [...weakCategories].filter(
      (category) => !declared.has(category),
    );
    if (undeclared.length > 0) {
      return {
        arm: input.arm,
        recommendation: 'KEEP_ANTHROPIC',
        reason_code: 'CATEGORY_ALL_PASS_GATE_FAILED',
        reason_codes: [
          'CATEGORY_ALL_PASS_GATE_FAILED',
          ...undeclared.map((category) => `NO_ESCALATION_RULE:${category}`),
        ],
      };
    }
    return {
      arm: input.arm,
      recommendation: 'SHADOW_WITH_ANTHROPIC_ESCALATION',
      reason_code: 'PREDECLARED_CATEGORY_ESCALATION',
      reason_codes: [...weakCategories].map(
        (category) => `ESCALATE:${category}`,
      ),
    };
  }

  return {
    arm: input.arm,
    recommendation: 'QUALIFIED_FOR_CONTROLLED_SHADOW',
    reason_code: null,
    reason_codes: [],
  };
}
