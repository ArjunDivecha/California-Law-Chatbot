/**
 * =============================================================================
 * Bias & discrimination review controls (P7)
 * api/_lib/compliance/biasReview.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   COPRAC Rule 8.4.1 / PRD §5.15: AI use must not produce discriminatory legal
 *   decisions, and multi-agent flows can compound bias. We use DETERMINISTIC
 *   refusal/review rules (no unvalidated bias classifier): workflows with
 *   bias/discrimination risk require a human review gate, and certain
 *   protected-class-sensitive decisions may NOT be made autonomously by the AI.
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */

/** Workflows that carry bias/discrimination risk → require a review gate. */
export const BIAS_SENSITIVE_WORKFLOWS = [
  'intake_prioritization',
  'case_valuation',
  'employment',
  'housing',
  'immigration',
  'family',
  'criminal',
  'disability_medical',
  'credibility_assessment',
  'settlement_recommendation',
  'client_selection',
] as const;
export type BiasSensitiveWorkflow = (typeof BIAS_SENSITIVE_WORKFLOWS)[number];

const SENSITIVE = new Set<string>(BIAS_SENSITIVE_WORKFLOWS);

/** Does this workflow require a human bias-review gate before output reuse? */
export function requiresBiasReview(workflow: string): boolean {
  return SENSITIVE.has(workflow);
}

/** Decisions the AI may NOT make autonomously (attorney must own them). */
export const BLOCKED_AUTONOMOUS_DECISIONS = [
  'client_selection',
  'case_acceptance',
  'case_rejection',
  'credibility_scoring',
  'protected_class_relevance',
  'settlement_posture',
] as const;

const BLOCKED = new Set<string>(BLOCKED_AUTONOMOUS_DECISIONS);

/** Is an autonomous (no-human) decision of this type blocked? */
export function isAutonomousDecisionBlocked(decisionType: string): boolean {
  return BLOCKED.has(decisionType);
}

export interface BiasReviewResult {
  permitted: boolean;
  requiresReview: boolean;
  reason?: string;
}

/**
 * Gate a workflow action. Autonomous protected-class-sensitive decisions are
 * never permitted; bias-sensitive workflows are permitted only with review.
 */
export function evaluateBiasControls(args: {
  workflow: string;
  decisionType?: string;
  humanReviewed: boolean;
}): BiasReviewResult {
  if (args.decisionType && isAutonomousDecisionBlocked(args.decisionType) && !args.humanReviewed) {
    return { permitted: false, requiresReview: true, reason: `decision "${args.decisionType}" cannot be made autonomously by AI; attorney must review and own it` };
  }
  if (requiresBiasReview(args.workflow) && !args.humanReviewed) {
    return { permitted: false, requiresReview: true, reason: `workflow "${args.workflow}" carries bias/discrimination risk; human review required` };
  }
  return { permitted: true, requiresReview: requiresBiasReview(args.workflow) };
}
