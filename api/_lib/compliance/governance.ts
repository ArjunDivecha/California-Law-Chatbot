/**
 * =============================================================================
 * Governance & recertification (P7)
 * api/_lib/compliance/governance.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   COPRAC competence/supervision (Rules 1.1, 5.1) require periodic
 *   reassessment as models/providers/detectors change (PRD §5.4, §12 Epic 12).
 *   This computes whether a recertification is due and surfaces stale provider
 *   registry entries, so an admin can export the current governance state for
 *   counsel review and a CI/runtime gate can block on staleness.
 *
 * INPUT FILES:  none (pure; reads the in-memory provider registry).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import { staleProviders, listProviders } from './providerRegistry.js';

const DAY_MS = 86_400_000;

/** Is a periodic review overdue? Fails CLOSED on unparseable dates. */
export function needsRecertification(lastReviewISO: string, nowISO: string, intervalDays = 90): boolean {
  const last = Date.parse(lastReviewISO);
  const now = Date.parse(nowISO);
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return now - last > intervalDays * DAY_MS;
}

export interface GovernanceStatus {
  asOf: string;
  recertNeeded: boolean;
  lastReview?: string;
  staleProviders: string[];
  providerCount: number;
  /** True when nothing is stale and recertification is current. */
  healthy: boolean;
}

/** Snapshot the governance posture for an admin/counsel export. */
export function governanceStatus(nowISO: string, lastReviewISO?: string): GovernanceStatus {
  const stale = staleProviders(nowISO);
  const recertNeeded = lastReviewISO ? needsRecertification(lastReviewISO, nowISO) : true;
  return {
    asOf: nowISO,
    recertNeeded,
    lastReview: lastReviewISO,
    staleProviders: stale,
    providerCount: listProviders().length,
    healthy: stale.length === 0 && !recertNeeded,
  };
}
