/**
 * =============================================================================
 * Counsel-approved Anthropic model allowlist + fail-closed guard
 * California Law Chatbot V4 — api/_lib/approvedModels.ts
 * =============================================================================
 * WHAT THIS MODULE DOES (plain language):
 *   Defines which Anthropic models are approved to receive client content under
 *   Femme & Femme's data-protection posture, and provides a guard that THROWS
 *   (fails closed) before any Anthropic request is sent to a model that is not
 *   on the approved list.
 *
 * WHY THIS EXISTS (and why it is NOT a ZDR list):
 *   V3 gated models on Zero-Data-Retention eligibility, premised on an
 *   enterprise ZDR arrangement. That premise died 2026-07-01: Anthropic ZDR
 *   requires a ~$100k/yr commitment F&F will not make. The operative posture is
 *   Anthropic's STANDARD commercial terms + auto-incorporated DPA: no training
 *   on API content, deletion-on-request, default 30-day retention (flagged
 *   content up to 2 years, safety scores up to 7 years). Per the 2026-06-02
 *   Morgan v. V2X research (2026 WL 864223, D. Colo.), those contractual terms
 *   — not ZDR — are what the protective-order standard actually requires:
 *   (1) no training on inputs, (2) no third-party disclosure except
 *   essential-to-service, (3) deletion-on-request, (4) retained written
 *   documentation. Every model below runs under those same account terms, so
 *   the allowlist is a counsel/change-control gate (COPRAC 2026: periodic model
 *   reassessment; no silent model churn), not a retention gate.
 *
 *   `claude-fable-5` was suspended for all customers 2026-06-12 (US
 *   export-control directive) and restored ~2026-07. Arjun re-approved it as
 *   the primary engine on 2026-07-01. If it is suspended again, the automatic
 *   unavailability failover in agentLoop.ts lands on `claude-opus-4-8`.
 *
 *   Adding a model here is a compliance event: update the provider-registry
 *   evidence and the disclosure copy if the vendor terms for the model differ,
 *   and record counsel sign-off. See docs/PRD_COPRAC_ZDR_COMPLIANCE.md §5.8
 *   (de-ZDR'd 2026-07-01).
 *
 * INPUT FILES:  none (pure, dependency-free module).
 * OUTPUT FILES: none.
 * =============================================================================
 */

/**
 * Anthropic models approved for use with client content under F&F's standard
 * commercial terms + DPA. Counsel/change-control gate — reviewed 2026-07-01.
 */
export const APPROVED_MODELS: ReadonlySet<string> = new Set<string>([
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
]);

/** True iff `model` is on the approved allowlist. */
export function isApprovedModel(model: string): boolean {
  return APPROVED_MODELS.has(model);
}

/**
 * Fail-closed guard. Throws if `model` is not approved. Call this immediately
 * before any Anthropic request that may carry client content — an env override
 * (V2_PRIMARY_MODEL / V2_FALLBACK_MODEL) can never introduce an unreviewed
 * model.
 */
export function assertApprovedModel(model: string): void {
  if (isApprovedModel(model)) return;
  throw new Error(
    `Model guard: refusing to send a request to unapproved model "${model}". ` +
      `Approved models: ${[...APPROVED_MODELS].join(', ')}. ` +
      `Set V2_PRIMARY_MODEL / V2_FALLBACK_MODEL to an approved model, or add ` +
      `the model to api/_lib/approvedModels.ts with counsel sign-off.`,
  );
}
