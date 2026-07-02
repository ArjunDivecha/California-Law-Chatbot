/**
 * =============================================================================
 * Lawyer review gates for output reuse (P6)
 * api/_lib/compliance/reviewGate.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Before a draft is copied, printed, exported, filed, or sent, COPRAC
 *   requires meaningful lawyer review (PRD §5.11). The PolicyDecision lists the
 *   gates required for an action (e.g. lawyer_review, citation_verification,
 *   court_ai_disclosure_check). This module checks whether the gates recorded
 *   as satisfied cover what's required, and is the chokepoint the
 *   export/file/send routes call. No autonomous filing/sending: an action with
 *   unmet gates is NOT permitted.
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */

export interface ReviewGateResult {
  permitted: boolean;
  missing: string[];
}

/**
 * Pure: are all `required` gates present in `satisfied`? Order-insensitive,
 * duplicate-safe. permitted only when nothing is missing.
 */
export function evaluateReviewGates(required: string[], satisfied: string[]): ReviewGateResult {
  const sat = new Set(satisfied);
  const missing = [...new Set(required)].filter((g) => !sat.has(g));
  return { permitted: missing.length === 0, missing };
}

export interface ReviewAttestation {
  action: string;
  reviewer: string;
  role: string;
  gatesSatisfied: string[];
  checklistVersion: string;
  unresolvedIssues: string[];
  at: string; // ISO
}

/**
 * Validate a review attestation against the required gates. Fails if the
 * reviewer left unresolved issues OR any required gate is unmet.
 */
export function validateReviewAttestation(
  required: string[],
  attestation: ReviewAttestation,
): ReviewGateResult {
  if (attestation.unresolvedIssues.length > 0) {
    return { permitted: false, missing: ['unresolved_issues', ...evaluateReviewGates(required, attestation.gatesSatisfied).missing] };
  }
  return evaluateReviewGates(required, attestation.gatesSatisfied);
}
