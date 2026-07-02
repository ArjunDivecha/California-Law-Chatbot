/**
 * =============================================================================
 * Billing metadata + fee-rule guards (P7)
 * api/_lib/compliance/billing.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   COPRAC + Rules 1.5 / B&P §§6147-6148 (PRD §5.14): don't bill AI runtime as
 *   attorney time; general AI subscription/infra is non-billable OVERHEAD;
 *   matter-specific provider pass-through may be billed only at actual cost,
 *   disclosed, with NO markup absent informed written consent. This module
 *   classifies costs, validates entries against those rules, and rolls up a
 *   billing-support ledger (the chatbot is NOT the system of record for
 *   invoices — it exports support metadata).
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */

export type CostKind =
  | 'attorney_time'
  | 'staff_time'
  | 'ai_runtime'
  | 'provider_passthrough'
  | 'overhead';

export interface BillingEntry {
  matterId: string;
  kind: CostKind;
  amount: number;
  billable: boolean;
  /** Markup over actual cost (0 = at cost). */
  markup?: number;
  disclosed?: boolean;
  /** Informed WRITTEN consent on file for any markup. */
  consentForMarkup?: boolean;
}

/** General AI subscription / infrastructure is non-billable overhead by default. */
export function classifyAiSubscription(): { kind: CostKind; billable: boolean } {
  return { kind: 'overhead', billable: false };
}

export interface BillingValidation {
  valid: boolean;
  reason?: string;
}

/** Enforce the fee rules on a single entry. */
export function validateBillingEntry(e: BillingEntry): BillingValidation {
  if (e.amount < 0) return { valid: false, reason: 'amount must be non-negative' };
  if (e.kind === 'overhead' && e.billable) {
    return { valid: false, reason: 'general AI/infrastructure overhead must not be billed as a separate client charge' };
  }
  if (e.kind === 'ai_runtime' && e.billable) {
    return { valid: false, reason: 'AI runtime must not be billed as attorney time; treat as overhead or disclosed pass-through' };
  }
  if ((e.markup ?? 0) > 0 && !(e.disclosed && e.consentForMarkup)) {
    return { valid: false, reason: 'markup on a pass-through cost requires disclosure + informed written consent (Rule 1.5)' };
  }
  return { valid: true };
}

export interface BillingLedger {
  byKind: Record<CostKind, number>;
  billableTotal: number;
  nonBillableTotal: number;
  invalid: { entry: BillingEntry; reason: string }[];
}

/** Roll up entries into a billing-support ledger, separating billable lines. */
export function buildBillingLedger(entries: BillingEntry[]): BillingLedger {
  const byKind = {
    attorney_time: 0, staff_time: 0, ai_runtime: 0, provider_passthrough: 0, overhead: 0,
  } as Record<CostKind, number>;
  let billableTotal = 0;
  let nonBillableTotal = 0;
  const invalid: { entry: BillingEntry; reason: string }[] = [];
  for (const e of entries) {
    const v = validateBillingEntry(e);
    if (!v.valid) {
      invalid.push({ entry: e, reason: v.reason ?? 'invalid' });
      continue;
    }
    byKind[e.kind] += e.amount;
    if (e.billable) billableTotal += e.amount + (e.markup ?? 0);
    else nonBillableTotal += e.amount;
  }
  return { byKind, billableTotal, nonBillableTotal, invalid };
}
