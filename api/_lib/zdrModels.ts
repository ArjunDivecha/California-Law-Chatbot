/**
 * =============================================================================
 * ZDR (Zero Data Retention) model allowlist + fail-closed guard
 * California Law Chatbot V3 — api/_lib/zdrModels.ts
 * =============================================================================
 * WHAT THIS MODULE DOES (plain language):
 *   Defines which Anthropic models are Zero-Data-Retention (ZDR) eligible under
 *   Femme & Femme's enterprise arrangement, and provides a guard that THROWS
 *   (fails closed) before any Anthropic request that could carry confidential
 *   client content is sent to a model that is NOT ZDR-eligible.
 *
 * WHY THIS EXISTS:
 *   Anthropic "Covered Models" (currently `claude-fable-5` and
 *   `claude-mythos-5`) require 30-day retention and are NOT ZDR-eligible; they
 *   were also suspended for all customers on 2026-06-12. Sending client prompts
 *   to a retention-required model would violate the confidentiality posture.
 *   This module makes that mistake impossible by construction.
 *   References: docs/PRD_COPRAC_ZDR_COMPLIANCE.md §5.8;
 *   docs/ZDR_ENTERPRISE_IMPLICATIONS.md ("Priority 1: Replace Fable 5 Defaults
 *   With Opus"); verified 2026-06-23 against Anthropic's API & data-retention
 *   docs.
 *
 * INPUT FILES:  none (pure, dependency-free module).
 * OUTPUT FILES: none.
 *
 * NOTE: In V3 the guard is unconditional — the chatbot has no current use case
 * for a non-ZDR model. P2 (the matter-mode policy engine) may later relax this
 * for an explicit `public_research`-only override; until then the default is
 * DENY (CLAUDE.md: "FAIL IS FAIL — no unauthorized fallbacks").
 * =============================================================================
 */

/**
 * Anthropic models that are ZDR-eligible under enterprise terms.
 * Verified 2026-06-23. EXCLUDES the non-ZDR "Covered Models" below.
 */
export const ZDR_ELIGIBLE_MODELS: ReadonlySet<string> = new Set<string>([
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
]);

/**
 * Models explicitly known to require retention (non-ZDR "Covered Models").
 * Listed so the guard can give a precise, actionable error. Not exhaustive —
 * anything not in ZDR_ELIGIBLE_MODELS is treated as non-eligible regardless.
 */
export const NON_ZDR_COVERED_MODELS: ReadonlySet<string> = new Set<string>([
  'claude-fable-5',
  'claude-mythos-5',
]);

/** True iff `model` is on the ZDR-eligible allowlist. */
export function isZdrEligibleModel(model: string): boolean {
  return ZDR_ELIGIBLE_MODELS.has(model);
}

/**
 * Fail-closed guard. Throws if `model` is not ZDR-eligible. Call this
 * immediately before any Anthropic request that may carry client content.
 */
export function assertZdrEligibleModel(model: string): void {
  if (isZdrEligibleModel(model)) return;
  const coveredNote = NON_ZDR_COVERED_MODELS.has(model)
    ? ' It is a non-ZDR "Covered Model" requiring 30-day retention.'
    : '';
  throw new Error(
    `ZDR guard: refusing to send a request to non-ZDR-eligible model "${model}".${coveredNote} ` +
      `Allowed (ZDR-eligible) models: ${[...ZDR_ELIGIBLE_MODELS].join(', ')}. ` +
      `Set V2_PRIMARY_MODEL / V2_FALLBACK_MODEL to a ZDR-eligible model. ` +
      `(claude-fable-5 / claude-mythos-5 are blocked.)`,
  );
}
