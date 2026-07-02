/**
 * =============================================================================
 * Provider Registry — California Law Chatbot V3
 * api/_lib/compliance/providerRegistry.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   A single source of truth for WHICH third-party providers may receive WHICH
 *   data classes in WHICH matter modes — backed by evidence, not marketing
 *   claims (PRD §5.4, COPRAC Confidentiality duty). The policy/manifest layers
 *   query this; nothing should send client data to a provider that isn't
 *   approved here for that data class + mode.
 *
 *   Encodes the mid-2026 VERIFIED facts:
 *     - Anthropic Messages API: ZDR-eligible (per-org; enablement must be
 *       verified), no training on commercial data, DPA auto-incorporated.
 *     - OpenAI embeddings: no training since 2023-03-01; /v1/embeddings is
 *       ZDR-eligible (approval-gated → 'eligible_pending' until confirmed) + DPA.
 *     - Upstash Vector/Redis: DPA §12.4 PROHIBITS "Restricted Data"
 *       (sensitive_personal_data); SOC 2 / HIPAA cover REDIS, not Vector;
 *       encryption is opt-in (must be verified on).
 *     - CourtListener / LegiScan / OpenStates: public-law APIs; query logs.
 *
 * NOTE: 'eligible_pending' entries and the *_VERIFY items in PRD §13 must be
 * confirmed by counsel/ops before relying on them for confidential/protected
 * data; the registry intentionally restricts those entries until then.
 *
 * INPUT FILES:  none (data is inline — the registry IS the source of truth).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import type { DataClass, MatterMode } from './policyEngine.js';

export type ZdrStatus = 'eligible_enabled' | 'eligible_pending' | 'not_eligible' | 'n/a';
/** Privilege/work-product classification (PRD §7). */
export type PrivilegeClass = 'vendor_no_waiver' | 'review_required' | 'unassessed';

export interface ProviderEvidence {
  source: string;
  url?: string;
  retrievedAt: string; // ISO date
  note?: string;
}

export interface ProviderEntry {
  providerId: string;
  service: string;
  /** Data classes this provider MAY receive. */
  dataClassesAllowed: DataClass[];
  /** Matter modes that may use this provider. */
  mattersAllowed: MatterMode[];
  trainsOnData: boolean;
  retention: string;
  zdrStatus: ZdrStatus;
  /** True if the provider's own terms forbid "Restricted Data" (Upstash §12.4). */
  restrictedDataProhibited?: boolean;
  subprocessors: string[];
  region?: string;
  deletionRights: string;
  privilegeClass: PrivilegeClass;
  evidence: ProviderEvidence[];
  /** ISO date; after this the entry is stale and must not be relied upon. */
  reviewExpiry: string;
  owner: string;
}

/** Data classes treated as "Restricted Data" under vendor prohibitions. */
const RESTRICTED_DATA_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  'sensitive_personal_data',
]);

const REGISTRY: ProviderEntry[] = [
  {
    providerId: 'anthropic_messages_zdr',
    service: 'Anthropic Claude Messages API (direct)',
    dataClassesAllowed: [
      'public_law',
      'client_confidential',
      'attorney_client_privileged',
      'work_product',
      'protected_discovery',
      'personal_data',
      'sensitive_personal_data',
    ],
    mattersAllowed: ['public_research', 'client_confidential', 'protected_discovery'],
    trainsOnData: false,
    retention: 'Zero at rest after response (ZDR); flagged-content exception up to 2y; T&S scores up to 7y',
    zdrStatus: 'eligible_pending', // confirm the production org has ZDR enabled (PRD §13 item 1)
    subprocessors: ['AWS', 'GCP'],
    region: 'US',
    deletionRights: 'ZDR — not stored at rest; see T&S retention exception',
    privilegeClass: 'vendor_no_waiver', // DPA auto-incorporated; no training
    evidence: [
      { source: 'Anthropic API & data retention docs', url: 'https://platform.claude.com/docs/en/manage-claude/api-and-data-retention', retrievedAt: '2026-06-23' },
      { source: 'Anthropic DPA (auto-incorporated in Commercial Terms)', url: 'https://www.anthropic.com/legal/commercial-terms', retrievedAt: '2026-06-23' },
    ],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'openai_embeddings',
    service: 'OpenAI text-embedding-3-small (native API)',
    dataClassesAllowed: ['public_law', 'client_confidential', 'personal_data'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: '30 days default (abuse monitoring); zero under approved ZDR',
    zdrStatus: 'eligible_pending', // request ZDR + sign DPA (PRD §13 item 3)
    subprocessors: ['Microsoft Azure'],
    region: 'US',
    deletionRights: 'DPA deletion; ZDR removes 30-day retention once enabled',
    privilegeClass: 'review_required', // until ZDR+DPA confirmed for the org
    evidence: [
      { source: 'OpenAI data controls (no training on API since 2023-03-01; /v1/embeddings ZDR-eligible)', url: 'https://developers.openai.com/api/docs/guides/your-data', retrievedAt: '2026-06-23' },
    ],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'upstash_vector',
    service: 'Upstash Vector (CEB embeddings store)',
    // CEB corpus is PUBLISHED practice-guide content. Client/query vectors that
    // carry confidential facts should NOT be stored here; sensitive_personal_data
    // is contractually prohibited (DPA §12.4).
    dataClassesAllowed: ['public_law'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: 'Per DPA; backups up to 4 weeks post-termination',
    zdrStatus: 'n/a',
    restrictedDataProhibited: true, // DPA §12.4
    subprocessors: ['AWS', 'GCP'],
    region: 'US (verify region pin)',
    deletionRights: 'DPA return/delete on termination',
    privilegeClass: 'review_required',
    evidence: [
      { source: 'Upstash DPA §12.4 (Restricted Data prohibited); SOC2/HIPAA scoped to Redis NOT Vector; encryption opt-in', url: 'https://upstash.com/trust/dpa.pdf', retrievedAt: '2026-06-23', note: 'For protected_discovery / sensitive data use a firm-controlled store + local embeddings (PRD §5.7a).' },
    ],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'upstash_redis',
    service: 'Upstash Redis (session store)',
    dataClassesAllowed: ['public_law', 'client_confidential', 'personal_data'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: 'Per DPA; matter-scoped retention enforced by app (P5)',
    zdrStatus: 'n/a',
    restrictedDataProhibited: true, // DPA §12.4
    subprocessors: ['AWS', 'GCP'],
    region: 'US (verify region pin)',
    deletionRights: 'DPA return/delete; app-level retention + litigation hold (P5)',
    privilegeClass: 'review_required',
    evidence: [
      { source: 'Upstash DPA §12.4; SOC 2 / HIPAA apply to Redis', url: 'https://upstash.com/trust/dpa.pdf', retrievedAt: '2026-06-23' },
    ],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'courtlistener',
    service: 'CourtListener case-law API',
    dataClassesAllowed: ['public_law'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: '~90-day usage logs',
    zdrStatus: 'n/a',
    subprocessors: [],
    region: 'US',
    deletionRights: 'n/a (public-law queries; use POST-embedding path for client-fact-bearing queries)',
    privilegeClass: 'review_required',
    evidence: [
      { source: 'CourtListener API + terms (POST-embedding avoids sending raw query)', url: 'https://www.courtlistener.com/help/api/rest/search/', retrievedAt: '2026-06-23' },
    ],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'legiscan',
    service: 'LegiScan bill API',
    dataClassesAllowed: ['public_law'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: 'Unspecified; query by identifier only',
    zdrStatus: 'n/a',
    subprocessors: [],
    region: 'US',
    deletionRights: 'n/a',
    privilegeClass: 'review_required',
    evidence: [{ source: 'LegiScan ToS/Privacy', url: 'https://legiscan.com/privacy', retrievedAt: '2026-06-23' }],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
  {
    providerId: 'openstates',
    service: 'OpenStates bill API',
    dataClassesAllowed: ['public_law'],
    mattersAllowed: ['public_research', 'client_confidential'],
    trainsOnData: false,
    retention: 'Account/usage data deletable on request',
    zdrStatus: 'n/a',
    subprocessors: [],
    region: 'US',
    deletionRights: 'Deletion on request (~14 days)',
    privilegeClass: 'review_required',
    evidence: [{ source: 'OpenStates ToS/Privacy', url: 'https://openstates.org/tos/', retrievedAt: '2026-06-23' }],
    reviewExpiry: '2026-12-31',
    owner: 'F&F / project',
  },
];

const BY_ID = new Map(REGISTRY.map((p) => [p.providerId, p]));

export function listProviders(): ProviderEntry[] {
  return [...REGISTRY];
}

export function getProvider(providerId: string): ProviderEntry | undefined {
  return BY_ID.get(providerId);
}

export interface ProviderApprovalResult {
  approved: boolean;
  reason?: string;
}

/**
 * Is `providerId` approved to receive `dataClass` in `mode`, as of `asOf`?
 * Fails closed: unknown provider, stale entry, mode/data-class not allowed, or
 * a Restricted-Data class against a provider whose terms forbid it ⇒ not approved.
 */
export function isProviderApprovedFor(
  providerId: string,
  mode: MatterMode,
  dataClass: DataClass,
  asOf: string,
): ProviderApprovalResult {
  const p = BY_ID.get(providerId);
  if (!p) return { approved: false, reason: `unknown provider "${providerId}"` };
  if (p.reviewExpiry < asOf) {
    return { approved: false, reason: `provider "${providerId}" registry entry is stale (expired ${p.reviewExpiry})` };
  }
  if (p.restrictedDataProhibited && RESTRICTED_DATA_CLASSES.has(dataClass)) {
    return { approved: false, reason: `provider "${providerId}" contractually prohibits Restricted Data (${dataClass})` };
  }
  if (!p.mattersAllowed.includes(mode)) {
    return { approved: false, reason: `provider "${providerId}" not approved for ${mode}` };
  }
  if (!p.dataClassesAllowed.includes(dataClass)) {
    return { approved: false, reason: `provider "${providerId}" not approved for data class ${dataClass}` };
  }
  return { approved: true };
}

/** Provider ids whose registry entry has expired as of `asOf` (CI/runtime gate). */
export function staleProviders(asOf: string): string[] {
  return REGISTRY.filter((p) => p.reviewExpiry < asOf).map((p) => p.providerId);
}

/** Compact snapshot for the per-turn manifest (no evidence bodies). */
export function providerSnapshot(): { providerId: string; zdrStatus: ZdrStatus; restrictedDataProhibited: boolean }[] {
  return REGISTRY.map((p) => ({
    providerId: p.providerId,
    zdrStatus: p.zdrStatus,
    restrictedDataProhibited: Boolean(p.restrictedDataProhibited),
  }));
}
