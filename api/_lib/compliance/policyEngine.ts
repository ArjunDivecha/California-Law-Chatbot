/**
 * =============================================================================
 * Compliance Policy Engine (server-authoritative) — California Law Chatbot V3
 * api/_lib/compliance/policyEngine.ts
 * =============================================================================
 * WHAT THIS MODULE DOES (plain language):
 *   Given a matter's mode + client consent + what was detected in the input +
 *   the action being attempted, it decides — on the SERVER, authoritatively —
 *   what is allowed: which tools may run, whether any external call may happen
 *   at all, how aggressively to tokenize, which human-review gates and audit
 *   sinks are required, and what must be disclosed. Browser-side checks are
 *   preview/UX only; THIS is the trust boundary (PRD §5.2).
 *
 * KEY INVARIANTS (PRD §5.1, §5.3):
 *   - Matter binding drives the mode. Detection may only ESCALATE the mode,
 *     never lower it. protected_discovery never auto-downgrades.
 *   - Fail closed: if client consent is missing/forbidden for confidential or
 *     protected work, external calls are blocked. Staff cannot use protected
 *     mode without a supervising attorney.
 *   - Anthropic-direct model policy always (the counsel-approved model
 *     allowlist is enforced separately by api/_lib/approvedModels.ts at the
 *     Anthropic call site).
 *
 * SCOPE NOTE: This is the decision logic. Enforcement consumes the returned
 *   PolicyDecision: P3 builds the tools array from `allowedTools` and gates
 *   tool queries; the sanitizer reads `tokenization`; the UI reads
 *   `requiredReviewGates`/`requiredDisclosures`; the audit layer reads
 *   `requiredEvidenceSinks`. Provider-registry evidence (P4) will refine the
 *   `*Approved` inputs; here they are explicit inputs with safe defaults.
 *
 * INPUT FILES:  none (pure, dependency-free module).
 * OUTPUT FILES: none.
 * =============================================================================
 */

export type MatterMode = 'public_research' | 'client_confidential' | 'protected_discovery';

export type ClientAiConsentStatus =
  | 'not_obtained'
  | 'allowed'
  | 'restricted'
  | 'prohibited'
  | 'revoked';

export type DataClass =
  | 'public_law'
  | 'client_confidential'
  | 'attorney_client_privileged'
  | 'work_product'
  | 'protected_discovery'
  | 'personal_data'
  | 'sensitive_personal_data';

export type UserRole = 'attorney' | 'staff';

export type RequestedAction =
  | 'answer'
  | 'verify'
  | 'tool_call'
  | 'copy'
  | 'print'
  | 'export'
  | 'file'
  | 'send';

export type TokenizationLevel = 'off' | 'light' | 'strict';

/** Logical tool ids. P3 maps these to the Anthropic tool registry. */
export const ALL_TOOLS = [
  'web_search',
  'ceb_search',
  'courtlistener',
  'legiscan',
  'openstates',
  'citation_verify',
  'ca_code',
  'mcp',
] as const;
export type ToolId = (typeof ALL_TOOLS)[number];

export interface PolicyInput {
  /** Bound mode from the matter (matter-driven). The FLOOR for escalation. */
  matterMode: MatterMode;
  clientConsent: ClientAiConsentStatus;
  /** Data classes detected in the input by the sanitizer/detector. */
  detectedDataClasses?: DataClass[];
  requestedAction: RequestedAction;
  /** For requestedAction === 'tool_call'. */
  requestedTool?: ToolId | string;
  /** Defaults to 'attorney'. */
  userRole?: UserRole;
  hasProtectiveOrder?: boolean;
  /**
   * Whether the OpenAI embeddings provider (used by ceb_search) has an
   * approved DPA-backed registry entry for the effective data class. Default
   * false → ceb_search is treated as an un-approved external disclosure
   * surface for confidential/protected work. (Provider registry = P4.)
   */
  openAiEmbeddingsApproved?: boolean;
}

export interface BlockedTool {
  tool: string;
  reason: string;
}

export interface PolicyDecision {
  /** Mode after applying detection-driven escalation. */
  effectiveMode: MatterMode;
  /** True if detection raised the mode above the bound matterMode. */
  escalated: boolean;
  /** False ⇒ no external model/tool call may be made for this action. */
  externalCallsAllowed: boolean;
  /** Always 'anthropic_direct' (approved-model allowlist enforced at the call
   *  site by approvedModels.ts; no OpenRouter / cross-provider fallback). */
  modelPolicy: 'anthropic_direct';
  tokenization: TokenizationLevel;
  allowedTools: ToolId[];
  blockedTools: BlockedTool[];
  requiredReviewGates: string[];
  requiredEvidenceSinks: string[];
  requiredDisclosures: string[];
  reasonCodes: string[];
  /** When set, the requested action is hard-blocked (overrides allowances). */
  block?: { reason: string };
}

const MODE_RANK: Record<MatterMode, number> = {
  public_research: 0,
  client_confidential: 1,
  protected_discovery: 2,
};

/** Data classes that force at least client_confidential. */
const CONFIDENTIAL_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  'client_confidential',
  'attorney_client_privileged',
  'work_product',
  'personal_data',
  'sensitive_personal_data',
]);

const REUSE_ACTIONS: ReadonlySet<RequestedAction> = new Set<RequestedAction>([
  'copy',
  'print',
  'export',
  'file',
  'send',
]);

/** The mode that detected data classes alone would require. */
export function detectionFloor(classes: readonly DataClass[] = []): MatterMode {
  if (classes.includes('protected_discovery')) return 'protected_discovery';
  if (classes.some((c) => CONFIDENTIAL_CLASSES.has(c))) return 'client_confidential';
  return 'public_research';
}

/** max(boundMode, detectionFloor) — escalate only, never downgrade. */
export function escalateMode(bound: MatterMode, classes: readonly DataClass[] = []): MatterMode {
  const floor = detectionFloor(classes);
  return MODE_RANK[floor] > MODE_RANK[bound] ? floor : bound;
}

/**
 * The single server-authoritative decision. Pure function — same inputs always
 * yield the same decision (so it is exhaustively unit-testable).
 */
export function decidePolicy(input: PolicyInput): PolicyDecision {
  const role: UserRole = input.userRole ?? 'attorney';
  const reasonCodes: string[] = [];

  // 1. Mode: matter binding is the floor; detection may only escalate.
  const effectiveMode = escalateMode(input.matterMode, input.detectedDataClasses);
  const escalated = MODE_RANK[effectiveMode] > MODE_RANK[input.matterMode];
  if (escalated) reasonCodes.push(`escalated_to_${effectiveMode}`);

  // 2. Tokenization by mode.
  const tokenization: TokenizationLevel =
    effectiveMode === 'protected_discovery'
      ? 'strict'
      : effectiveMode === 'client_confidential'
        ? 'light'
        : 'off';

  // 3. Evidence sinks + disclosures by mode.
  const requiredEvidenceSinks: string[] =
    effectiveMode === 'protected_discovery'
      ? ['audit', 'worm']
      : effectiveMode === 'client_confidential'
        ? ['audit']
        : [];
  const requiredDisclosures: string[] =
    effectiveMode === 'public_research' ? [] : ['ai_use_disclosure', 'provider_disclosure'];

  // 4. Review gates for output-reuse actions.
  const requiredReviewGates: string[] = [];
  if (REUSE_ACTIONS.has(input.requestedAction) && effectiveMode !== 'public_research') {
    requiredReviewGates.push('lawyer_review');
    if (input.requestedAction === 'file') {
      requiredReviewGates.push('citation_verification', 'court_ai_disclosure_check');
    }
    if (input.requestedAction === 'send') requiredReviewGates.push('client_send_review');
  }

  // 5. Tool gating by mode (PRD §5.3 matrix). Enforced in P3 via allowedTools.
  const blockedTools: BlockedTool[] = [];
  const allow = new Set<ToolId>(ALL_TOOLS);
  const block = (tool: ToolId, reason: string) => {
    if (allow.delete(tool)) blockedTools.push({ tool, reason });
  };

  if (effectiveMode === 'public_research') {
    // All tools allowed (no client facts present by definition).
  } else if (effectiveMode === 'client_confidential') {
    block('web_search', 'web_search disabled in client_confidential (external query leakage); use a lawyer-approved sanitized public-law query');
    block('mcp', 'MCP connector sends tool I/O to third-party servers outside the DPA boundary; blocked for confidential work');
    if (!input.openAiEmbeddingsApproved) {
      block('ceb_search', 'ceb_search embeds the query via OpenAI; requires an approved DPA-backed registry entry for confidential data');
    }
  } else {
    // protected_discovery — most restrictive.
    block('web_search', 'web_search categorically blocked in protected_discovery');
    block('mcp', 'MCP connector blocked in protected_discovery');
    block('courtlistener', 'public-law API query may carry protected facts; blocked by default in protected_discovery');
    block('legiscan', 'public-law API query may carry protected facts; blocked by default in protected_discovery');
    block('openstates', 'public-law API query may carry protected facts; blocked by default in protected_discovery');
    if (!input.openAiEmbeddingsApproved) {
      block('ceb_search', 'OpenAI embeddings + Upstash not approved for protected_discovery; use a firm-controlled store + local embeddings');
    }
  }

  // 6. Consent + role hard blocks (override allowances → block external calls).
  let externalCallsAllowed = true;
  let hardBlock: { reason: string } | undefined;

  if (input.clientConsent === 'prohibited' || input.clientConsent === 'revoked') {
    externalCallsAllowed = false;
    hardBlock = { reason: `client AI-use consent is ${input.clientConsent}; no external processing permitted` };
    reasonCodes.push('consent_forbidden');
  } else if (effectiveMode !== 'public_research' && input.clientConsent === 'not_obtained') {
    externalCallsAllowed = false;
    hardBlock = { reason: 'client AI-use consent not obtained for confidential/protected matter' };
    reasonCodes.push('consent_required');
  } else if (input.clientConsent === 'restricted') {
    if (!requiredReviewGates.includes('lawyer_review')) requiredReviewGates.push('lawyer_review');
    reasonCodes.push('consent_restricted');
  }

  if (effectiveMode === 'protected_discovery' && role === 'staff') {
    externalCallsAllowed = false;
    hardBlock = { reason: 'protected_discovery requires a supervising attorney; staff role cannot proceed' };
    reasonCodes.push('staff_blocked_protected');
  }

  // If external calls are blocked, no tools may run.
  const allowedTools: ToolId[] = externalCallsAllowed ? [...allow] : [];
  if (!externalCallsAllowed) {
    for (const t of allow) {
      if (!blockedTools.find((b) => b.tool === t)) {
        blockedTools.push({ tool: t, reason: 'external calls disabled for this action' });
      }
    }
  }

  return {
    effectiveMode,
    escalated,
    externalCallsAllowed,
    modelPolicy: 'anthropic_direct',
    tokenization,
    allowedTools,
    blockedTools,
    requiredReviewGates,
    requiredEvidenceSinks,
    requiredDisclosures,
    reasonCodes,
    ...(hardBlock ? { block: hardBlock } : {}),
  };
}
