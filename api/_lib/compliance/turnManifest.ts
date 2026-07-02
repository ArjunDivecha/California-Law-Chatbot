/**
 * =============================================================================
 * Per-turn compliance manifest — California Law Chatbot V3
 * api/_lib/compliance/turnManifest.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Builds the per-turn record that ties together everything a lawyer (or a
 *   court, in discovery) would need to understand how a turn was handled:
 *   matter mode, the policy decision, which providers/tools were permitted vs
 *   actually called, model id, review gates, evidence sinks, and a HASH of the
 *   sanitized prompt. PRD §5.9.
 *
 *   GOVERNANCE INVARIANT (PRD §5.9a — "the audit trail is itself discoverable"):
 *   the manifest stores HASHES + structured metadata ONLY. It must never carry
 *   raw client text, the token map, or the prompt itself. buildTurnManifest()
 *   takes a precomputed HMAC, not the prompt, so raw text cannot leak in by
 *   construction.
 *
 * INPUT FILES:  none (pure builder; persistence is the caller's job).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import type { PolicyDecision } from './policyEngine.js';
import { providerSnapshot } from './providerRegistry.js';

export interface TurnManifestInput {
  turnId: string;
  sessionId: string;
  matterId?: string;
  /** Resolved model id used this turn (approved-model allowlist enforced in agentLoop). */
  model: string;
  decision: PolicyDecision;
  /** Tool names actually dispatched this turn. */
  toolsCalled: string[];
  /** HMAC of the SANITIZED prompt (never the prompt itself). May be absent. */
  sanitizedPromptHmac?: string;
  /** ISO-8601 timestamp (passed in for determinism/testability). */
  timestamp: string;
  /** Prompt/tool/policy versioning for reproducibility. */
  versions?: Record<string, string>;
}

export interface TurnManifest {
  turn_id: string;
  session_id: string;
  matter_id?: string;
  timestamp: string;
  matter_mode: PolicyDecision['effectiveMode'];
  escalated: boolean;
  model: string;
  model_policy: PolicyDecision['modelPolicy'];
  external_calls_allowed: boolean;
  tokenization: PolicyDecision['tokenization'];
  allowed_tools: string[];
  blocked_tools: { tool: string; reason: string }[];
  tools_called: string[];
  required_review_gates: string[];
  required_evidence_sinks: string[];
  required_disclosures: string[];
  reason_codes: string[];
  sanitized_prompt_hmac?: string;
  provider_snapshot: ReturnType<typeof providerSnapshot>;
  versions?: Record<string, string>;
  /** Set when the turn was hard-blocked by policy. */
  blocked_reason?: string;
}

/**
 * Build the per-turn manifest. Pure (deterministic given inputs). Contains
 * ONLY hashes + metadata — never raw client content.
 */
export function buildTurnManifest(input: TurnManifestInput): TurnManifest {
  const d = input.decision;
  return {
    turn_id: input.turnId,
    session_id: input.sessionId,
    ...(input.matterId ? { matter_id: input.matterId } : {}),
    timestamp: input.timestamp,
    matter_mode: d.effectiveMode,
    escalated: d.escalated,
    model: input.model,
    model_policy: d.modelPolicy,
    external_calls_allowed: d.externalCallsAllowed,
    tokenization: d.tokenization,
    allowed_tools: [...d.allowedTools],
    blocked_tools: d.blockedTools.map((b) => ({ tool: b.tool, reason: b.reason })),
    tools_called: [...input.toolsCalled],
    required_review_gates: [...d.requiredReviewGates],
    required_evidence_sinks: [...d.requiredEvidenceSinks],
    required_disclosures: [...d.requiredDisclosures],
    reason_codes: [...d.reasonCodes],
    ...(input.sanitizedPromptHmac ? { sanitized_prompt_hmac: input.sanitizedPromptHmac } : {}),
    provider_snapshot: providerSnapshot(),
    ...(input.versions ? { versions: input.versions } : {}),
    ...(d.block ? { blocked_reason: d.block.reason } : {}),
  };
}

/**
 * Defensive check used by tests + (optionally) at write time: returns the
 * offending key path if the manifest appears to contain raw prompt-like text.
 * The manifest is all enums/arrays/hashes, so any long free-text string value
 * (other than reasons/hmac) is suspicious.
 */
export function findRawTextLeak(manifest: TurnManifest): string | null {
  // Only the prompt HMAC is allowed to be a long opaque string; everything
  // else is short enums/ids/reasons. We flag any string > 256 chars.
  for (const [k, v] of Object.entries(manifest)) {
    if (typeof v === 'string' && v.length > 256) return k;
  }
  return null;
}
