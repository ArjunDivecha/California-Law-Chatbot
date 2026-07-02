/**
 * =============================================================================
 * Server-side attestations: client AI consent + attorney policy ack (P6)
 * api/_lib/compliance/attestations.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Records and reads — SERVER-SIDE, versioned, per matter/session — the two
 *   things COPRAC requires before confidential AI work (PRD §5.10):
 *     1. the client's AI-use consent status (allowed/restricted/prohibited/…),
 *     2. the supervising attorney's policy acknowledgment.
 *   Replaces the old localStorage-only attestation (which could not gate
 *   anything). consentSatisfiedFor() is the pure predicate the policy engine
 *   uses; the record/get functions persist into the session meta hash.
 *
 * INPUT FILES:  none directly (persists via sessionStore → Upstash Redis).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import { readMeta, writeMeta } from '../sessionStore.js';
import type { MatterMode, ClientAiConsentStatus } from './policyEngine.js';

/** Pure: is the recorded consent sufficient to do external AI work in `mode`? */
export function consentSatisfiedFor(mode: MatterMode, status: ClientAiConsentStatus): boolean {
  if (mode === 'public_research') return true; // no client facts ⇒ no consent needed
  return status === 'allowed' || status === 'restricted';
}

export interface AttestationSnapshot {
  consent: ClientAiConsentStatus;
  consentSigner?: string;
  consentVersion?: string;
  consentAt?: string;
  policyAckSigner?: string;
  policyAckVersion?: string;
  policyAckAt?: string;
}

/** Record the client's AI-use consent for this session/matter. */
export async function recordClientConsent(
  sessionId: string,
  status: ClientAiConsentStatus,
  signer: string,
  version: string,
  nowISO: string,
): Promise<void> {
  await writeMeta(sessionId, {
    client_ai_consent: status,
    consent_signer: signer,
    consent_version: version,
    consent_at: nowISO,
  });
}

/** Record the supervising attorney's AI-policy acknowledgment. */
export async function recordAttorneyPolicyAck(
  sessionId: string,
  signer: string,
  version: string,
  nowISO: string,
): Promise<void> {
  await writeMeta(sessionId, {
    policy_ack_signer: signer,
    policy_ack_version: version,
    policy_ack_at: nowISO,
  });
}

export async function getAttestations(sessionId: string): Promise<AttestationSnapshot> {
  const m = await readMeta(sessionId).catch(() => null);
  return {
    consent: m?.client_ai_consent ?? 'not_obtained',
    consentSigner: m?.consent_signer,
    consentVersion: m?.consent_version,
    consentAt: m?.consent_at,
    policyAckSigner: m?.policy_ack_signer,
    policyAckVersion: m?.policy_ack_version,
    policyAckAt: m?.policy_ack_at,
  };
}
