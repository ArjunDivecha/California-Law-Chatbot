/**
 * =============================================================================
 * Storage policy — where client data may live, retention, isolation (P5)
 * api/_lib/compliance/storagePolicy.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Decides WHERE a matter's conversation/vector data may be stored, for how
 *   long, and whether it must be tokenized first. Encodes PRD §5.7:
 *     - protected_discovery ⇒ firm-controlled store ONLY (Upstash's DPA §12.4
 *       forbids Restricted Data; SOC2/HIPAA cover Redis not Vector).
 *     - client_confidential with sensitive_personal_data ⇒ firm-controlled too.
 *     - client_confidential (non-sensitive) ⇒ cloud (Upstash) is permissible
 *       ONLY if approved, and — finding F3 — client content must be TOKENIZED
 *       before it lands in the firm's own (non-ZDR) cloud store, because
 *       relaxing OPF on the Anthropic ZDR leg otherwise pushes raw facts into
 *       Upstash/Vercel.
 *     - public_research ⇒ cloud, no tokenization needed.
 *   Plus retention windows (litigation-hold aware) and matter-scoped key
 *   namespacing for cross-matter isolation.
 *
 *   The firm-controlled store itself (pgvector/sqlite + local embeddings) is
 *   INFRASTRUCTURE that must be provisioned (PRD §5.7a). It is represented here
 *   by a fail-closed adapter interface: until provisioned, getFirmControlledStore()
 *   THROWS rather than silently falling back to a third party (CLAUDE.md:
 *   "FAIL IS FAIL — no unauthorized fallbacks").
 *
 * INPUT FILES:  none (pure policy; the store adapter is injected).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import type { MatterMode, DataClass } from './policyEngine.js';
import { isProviderApprovedFor } from './providerRegistry.js';

export type StoreTarget = 'cloud_upstash' | 'firm_controlled' | 'blocked';

export interface StoreSelection {
  target: StoreTarget;
  reason: string;
  /** Client content must be tokenized BEFORE it reaches this store. */
  tokenizeBeforeStore: boolean;
}

const SENSITIVE: ReadonlySet<DataClass> = new Set<DataClass>(['sensitive_personal_data']);

/**
 * Decide where conversation/vector data for this turn may be stored.
 * Fails closed: if nothing is approved, returns 'blocked'.
 */
export function selectStore(mode: MatterMode, dataClass: DataClass, asOf: string): StoreSelection {
  if (mode === 'protected_discovery') {
    return {
      target: 'firm_controlled',
      reason: 'protected_discovery requires a firm-controlled store (Upstash DPA §12.4 forbids Restricted Data)',
      tokenizeBeforeStore: false, // firm-controlled boundary; strict OPF still applies to external model calls
    };
  }
  if (SENSITIVE.has(dataClass)) {
    return {
      target: 'firm_controlled',
      reason: `data class ${dataClass} is Restricted Data — prohibited on Upstash; use the firm-controlled store`,
      tokenizeBeforeStore: false,
    };
  }
  if (mode === 'public_research') {
    return { target: 'cloud_upstash', reason: 'public research — no client facts', tokenizeBeforeStore: false };
  }
  // client_confidential, non-sensitive:
  const ok = isProviderApprovedFor('upstash_redis', mode, dataClass, asOf);
  if (!ok.approved) {
    return { target: 'firm_controlled', reason: `Upstash not approved (${ok.reason}); use firm-controlled store`, tokenizeBeforeStore: false };
  }
  return {
    target: 'cloud_upstash',
    // Finding F3: the firm's own cloud store is NOT ZDR — tokenize before storing.
    reason: 'client_confidential non-sensitive — cloud store permitted, but tokenize before storing (F3)',
    tokenizeBeforeStore: true,
  };
}

export interface RetentionPolicy {
  mode: MatterMode;
  /** Days until auto-delete; null = retain (e.g. litigation hold / protected). */
  days: number | null;
  litigationHold: boolean;
}

/**
 * Effective retention by mode, litigation-hold aware. A hold forces retain
 * (days=null). Protected discovery defaults to retain-until-resolved.
 */
export function effectiveRetention(mode: MatterMode, litigationHold = false): RetentionPolicy {
  if (litigationHold) return { mode, days: null, litigationHold: true };
  const days = mode === 'public_research' ? 90 : mode === 'client_confidential' ? 365 : null;
  return { mode, days, litigationHold: false };
}

/** Namespace a storage key by matter so one matter's data can't be read under another. */
export function matterScopedKey(matterId: string, base: string): string {
  if (!matterId) throw new Error('matterScopedKey: matterId is required for isolation');
  return `matter:${matterId}:${base}`;
}

// ---------------------------------------------------------------------------
// Firm-controlled store adapter (INFRA — provisioned separately, PRD §5.7a)
// ---------------------------------------------------------------------------

export interface FirmControlledStore {
  /** Store a record under a matter-scoped key. */
  put(matterId: string, key: string, value: string): Promise<void>;
  get(matterId: string, key: string): Promise<string | null>;
}

let firmStore: FirmControlledStore | null = null;

/** Provision the firm-controlled store (pgvector/sqlite). Injected at boot/tests. */
export function setFirmControlledStore(store: FirmControlledStore | null): void {
  firmStore = store;
}

/**
 * Get the firm-controlled store, or THROW if not provisioned. Fail-closed: we
 * never silently fall back to a third-party store for protected/restricted data.
 */
export function getFirmControlledStore(): FirmControlledStore {
  if (!firmStore) {
    throw new Error(
      'firm-controlled store not provisioned. Protected/Restricted data cannot be stored. ' +
        'Stand up pgvector/sqlite + local embeddings and call setFirmControlledStore() (PRD §5.7a). ' +
        'Refusing to fall back to a third-party store.',
    );
  }
  return firmStore;
}

export function isFirmStoreProvisioned(): boolean {
  return firmStore !== null;
}
