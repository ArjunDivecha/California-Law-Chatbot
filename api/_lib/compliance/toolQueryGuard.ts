/**
 * =============================================================================
 * Tool-query guard — outbound exfiltration defense (P3)
 * api/_lib/compliance/toolQueryGuard.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   The LAST check before an in-process tool (ceb_search, courtlistener_search,
 *   …) actually runs. It looks at the EXACT outbound query the model produced
 *   and decides whether it may leave the system. Three defenses (PRD §5.5):
 *     1. If the policy disabled external calls → block.
 *     2. If the tool is not permitted in the effective matter mode → block
 *        (defense-in-depth: the model could still emit a tool the array-level
 *        filter dropped, or a renamed/unknown tool).
 *     3. EXFILTRATION DEFENSE: in client_confidential / protected_discovery,
 *        re-run the SAME PII detector on the outbound query. If it carries
 *        client-confidential facts — even because untrusted retrieved content
 *        prompt-injected the model into doing so — block it. Client facts must
 *        never become an external search query.
 *
 *   web_search (Anthropic server-side) is gated earlier by buildToolsForPolicy
 *   (omitted from the tools array), so it never reaches dispatch; this guard
 *   covers the in-process tools that DO run here.
 *
 * INPUT FILES:  none at runtime (imports the pure detector analyze()).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import { analyze } from '../../_shared/sanitization/index.js';
import type { PolicyDecision, ToolId } from './policyEngine.js';

export interface ToolQueryGuardInput {
  /** Logical policy id for the tool (undefined ⇒ unrecognized tool). */
  toolPolicyId: ToolId | undefined;
  /** Registered tool name, for error messages. */
  toolName: string;
  /** Concatenated string inputs of the tool_use block (the outbound query). */
  query: string;
  decision: PolicyDecision;
}

export interface ToolQueryGuardResult {
  allowed: boolean;
  reason?: string;
  /** Set when the block was due to detected client facts in the query. */
  exfiltrationBlock?: boolean;
}

/**
 * Pull the outbound query text out of a tool_use input object: join every
 * string-valued field (query, q, citation, statute, etc.) so the detector sees
 * everything the model is about to send out.
 */
export function extractQueryString(input: Record<string, unknown>): string {
  return Object.values(input)
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .trim();
}

/** Decide whether an outbound tool query may run. Pure (analyze is deterministic). */
export function guardToolQuery(g: ToolQueryGuardInput): ToolQueryGuardResult {
  const { decision } = g;

  if (!decision.externalCallsAllowed) {
    return {
      allowed: false,
      reason: `external tool calls are disabled for this action (${decision.block?.reason ?? 'policy'})`,
    };
  }

  if (g.toolPolicyId === undefined) {
    return { allowed: false, reason: `tool "${g.toolName}" is not a recognized policy-gated tool` };
  }

  if (!decision.allowedTools.includes(g.toolPolicyId)) {
    return {
      allowed: false,
      reason: `tool "${g.toolName}" is not permitted in ${decision.effectiveMode} mode`,
    };
  }

  // Exfiltration defense — only confidential/protected modes carry client facts.
  if (decision.effectiveMode !== 'public_research' && g.query) {
    const result = analyze(g.query);
    if (result.privileged) {
      return {
        allowed: false,
        exfiltrationBlock: true,
        reason: `outbound ${g.toolName} query appears to contain client-confidential facts; blocked to prevent external disclosure (run a sanitized public-law query instead)`,
      };
    }
  }

  return { allowed: true };
}
