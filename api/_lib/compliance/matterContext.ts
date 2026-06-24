/**
 * =============================================================================
 * Matter-mode transitions — the "locked protected flag" safety logic (P2/P6)
 * api/_lib/compliance/matterContext.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   The dangerous failure in a matter-aware system is an ACCIDENTAL DOWNGRADE —
 *   silently dropping a protected_discovery session to a looser mode and then
 *   leaking. So protected_discovery is a LOCKED matter-policy flag (PRD §5.1):
 *   entering it locks it on, and downgrading out of it requires an explicit
 *   attorney override (logged by the caller). Escalation is always allowed.
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import type { MatterMode } from './policyEngine.js';

const RANK: Record<MatterMode, number> = {
  public_research: 0,
  client_confidential: 1,
  protected_discovery: 2,
};

export interface MatterContextState {
  matterMode: MatterMode;
  protectedLocked: boolean;
}

export interface MatterTransitionResult {
  allowed: boolean;
  reason?: string;
  next?: MatterContextState;
}

/**
 * Validate a requested matter-mode change against current state.
 * - Entering protected_discovery LOCKS it on.
 * - Downgrading out of a locked protected matter requires attorneyOverride.
 * - All other transitions (incl. escalation) are allowed.
 */
export function validateMatterTransition(
  current: MatterContextState,
  requestedMode: MatterMode,
  opts: { attorneyOverride?: boolean } = {},
): MatterTransitionResult {
  if (requestedMode === 'protected_discovery') {
    return { allowed: true, next: { matterMode: 'protected_discovery', protectedLocked: true } };
  }
  const isDowngradeFromProtected =
    current.protectedLocked && RANK[requestedMode] < RANK.protected_discovery;
  if (isDowngradeFromProtected) {
    if (!opts.attorneyOverride) {
      return {
        allowed: false,
        reason:
          'protected_discovery is locked on this matter; downgrading requires explicit attorney confirmation (logged)',
      };
    }
    return { allowed: true, next: { matterMode: requestedMode, protectedLocked: false } };
  }
  return { allowed: true, next: { matterMode: requestedMode, protectedLocked: false } };
}

/** Parse/validate an untrusted matter mode string. */
export function parseMatterMode(v: unknown): MatterMode | null {
  return v === 'public_research' || v === 'client_confidential' || v === 'protected_discovery'
    ? v
    : null;
}
