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
 * Anthropic model FAMILIES approved for use with client content under F&F's
 * standard commercial terms + DPA. Changed from per-ID pinning to family-level
 * approval on 2026-07-22 (Arjun's directive: automatic latest-model adoption —
 * see api/_lib/modelResolver.ts). Rationale: every model in these families
 * runs under the same org-level account terms (no-training + DPA), so the
 * per-ID review gate added churn without changing the data posture. The guard
 * remains fail-closed against anything OUTSIDE these families, and against
 * preview/mythos surfaces, which are never approved.
 */
export const APPROVED_FAMILY_RE =
  /^claude-(fable|opus|sonnet|haiku)-[a-z0-9][a-z0-9.-]*$/;

const BLOCKED_SUBSTRINGS = ['preview', 'mythos'];

/** True iff `model` belongs to an approved family (and no blocked surface). */
export function isApprovedModel(model: string): boolean {
  return (
    APPROVED_FAMILY_RE.test(model) &&
    !BLOCKED_SUBSTRINGS.some((s) => model.includes(s))
  );
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
      `Approved families: claude-fable-*, claude-opus-*, claude-sonnet-*, ` +
      `claude-haiku-* (preview/mythos surfaces always blocked). Set ` +
      `V2_PRIMARY_MODEL / V2_FALLBACK_MODEL to an approved model, or update ` +
      `api/_lib/approvedModels.ts.`,
  );
}
