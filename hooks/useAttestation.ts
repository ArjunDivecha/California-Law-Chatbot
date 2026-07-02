/**
 * useAttestation — per-user informed-consent state.
 *
 * Reads / writes a localStorage flag keyed by Clerk user ID and a
 * version marker. Bumping ATTESTATION_VERSION forces the modal to
 * resurface for every attorney — use this when the acknowledgement
 * wording changes materially.
 *
 * Pure browser-local state. No server call, no network. The audit log
 * is the durable record; this hook is just the UI gate.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Version of the acknowledgement text. Bump when the modal wording
 * changes in a way that requires every attorney to re-acknowledge.
 * F&F compliance counsel should own this value.
 */
export const ATTESTATION_VERSION = 1;

const STORAGE_PREFIX = 'cla-sanitization-attested';

export interface AttestationRecord {
  version: number;
  acknowledgedAt: string; // ISO-8601
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:v${ATTESTATION_VERSION}:${userId}`;
}

function readAttestation(userId: string): AttestationRecord | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttestationRecord;
    if (parsed?.version !== ATTESTATION_VERSION || !parsed?.acknowledgedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAttestation(userId: string, record: AttestationRecord): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(record));
  } catch {
    // Ignore quota / privacy-mode errors — worst case the modal shows again.
  }
}

export interface UseAttestationResult {
  /** True once the attorney has acknowledged the current version. */
  attested: boolean;
  /** Timestamp of the acknowledgement, if any. */
  acknowledgedAt: string | null;
  /** Call when the attorney clicks "I understand". */
  acknowledge: () => void;
  /** Clear the acknowledgement (e.g., if F&F wants to require re-attestation). */
  clear: () => void;
  /** True once the mount-time read has completed. Avoids a modal flash. */
  ready: boolean;
}

export function useAttestation(userId: string | null | undefined): UseAttestationResult {
  const [record, setRecord] = useState<AttestationRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRecord(null);
      setReady(true);
      return;
    }
    setRecord(readAttestation(userId));
    setReady(true);
  }, [userId]);

  const acknowledge = useCallback(() => {
    if (!userId) return;
    const next: AttestationRecord = {
      version: ATTESTATION_VERSION,
      acknowledgedAt: new Date().toISOString(),
    };
    writeAttestation(userId, next);
    setRecord(next);
  }, [userId]);

  const clear = useCallback(() => {
    if (!userId) return;
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
      // ignore
    }
    setRecord(null);
  }, [userId]);

  return {
    attested: !!record,
    acknowledgedAt: record?.acknowledgedAt ?? null,
    acknowledge,
    clear,
    ready,
  };
}

// Exported for tests and any external helper scripts.
export const _internals = { storageKey, readAttestation, writeAttestation };
