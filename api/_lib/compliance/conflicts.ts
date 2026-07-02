/**
 * =============================================================================
 * Conflicts / ethical walls (P6)
 * api/_lib/compliance/conflicts.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Matter isolation (P5) keeps one matter's data out of another's context.
 *   This adds the ethics layer on top (PRD §5.13): a conflict signal when a
 *   client of one matter is an adverse party in another, and a rule that
 *   cross-matter retrieval is blocked unless an authorized attorney recorded a
 *   link with a conflict/joint-representation basis. The firm's practice-
 *   management system remains the system of record for conflicts; this module
 *   exists so the chatbot never breaches a wall.
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */

export interface MatterParties {
  matterId: string;
  clients: string[];
  adverseParties: string[];
}

const norm = (s: string): string => s.trim().toLowerCase();

/** Conflict signal: a client of one matter appears as an adverse party in either. */
export function hasConflict(a: MatterParties, b: MatterParties): boolean {
  const adverse = new Set([...a.adverseParties, ...b.adverseParties].map(norm));
  const clients = [...a.clients, ...b.clients].map(norm);
  return clients.some((c) => adverse.has(c));
}

export interface CrossMatterLink {
  approvedBy: string; // attorney id
  basis: string; // conflict/joint-representation rationale
  at: string; // ISO
}

export interface CrossMatterResult {
  allowed: boolean;
  reason?: string;
}

/**
 * May data from `fromMatter` be retrieved into `toMatter`? Same matter = yes.
 * Different matters require a complete authorized link record (fail closed).
 */
export function crossMatterRetrievalAllowed(
  fromMatter: string,
  toMatter: string,
  link?: CrossMatterLink,
): CrossMatterResult {
  if (!fromMatter || !toMatter) return { allowed: false, reason: 'matter ids required' };
  if (fromMatter === toMatter) return { allowed: true };
  if (!link) {
    return {
      allowed: false,
      reason: 'cross-matter retrieval requires an authorized attorney link (conflict/joint-representation basis)',
    };
  }
  if (!link.approvedBy || !link.basis || !link.at) {
    return { allowed: false, reason: 'incomplete cross-matter link record (approvedBy + basis + timestamp required)' };
  }
  return { allowed: true };
}
