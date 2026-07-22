/**
 * =============================================================================
 * Automatic latest-model resolver — api/_lib/modelResolver.ts
 * =============================================================================
 * WHAT THIS MODULE DOES (plain language):
 *   Keeps AskPauli on the newest Anthropic model in each family — Fable
 *   (primary research), Opus (unavailability failover), Sonnet (quick mode +
 *   citation verifier) — WITHOUT adding latency to any user turn.
 *
 * HOW (the fast/automatic contract, per Arjun 2026-07-22):
 *   - On module load we fire ONE background call to Anthropic's Models API
 *     (GET /v1/models via the SDK). Turns never await it.
 *   - Getters (latestPrimary/latestFallback/latestFast) are synchronous cache
 *     reads. Until the first resolution lands — or if it ever fails — they
 *     return the pinned KNOWN_GOOD defaults, so a Models-API outage can never
 *     break a turn (availability fail-open onto known-good, matching the
 *     repo's fail-open plumbing convention; the approvedModels guard remains
 *     the fail-CLOSED gate on whatever id is ultimately used).
 *   - The cache self-refreshes lazily: any getter call after REFRESH_MS
 *     re-fires the background resolution (again without blocking the caller).
 *     Serverless cold starts resolve per-instance; the desktop sidecar
 *     resolves at boot.
 *
 * SELECTION RULES:
 *   Newest `created_at` within each id-prefix family; ids containing
 *   "preview" or "mythos" are excluded (never counsel-reviewed surfaces).
 *   Resolved ids still pass assertApprovedModel() at request time — the
 *   family-scoped guard in approvedModels.ts.
 *
 * INPUT FILES:  none (network: api.anthropic.com/v1/models, key from
 *               ANTHROPIC_API_KEY).
 * OUTPUT FILES: none.
 * =============================================================================
 */

import Anthropic from '@anthropic-ai/sdk';

export const KNOWN_GOOD = {
  primary: 'claude-fable-5',
  fallback: 'claude-opus-4-8',
  fast: 'claude-sonnet-4-6',
} as const;

const FAMILY_PREFIX = {
  primary: 'claude-fable-',
  fallback: 'claude-opus-',
  fast: 'claude-sonnet-',
} as const;

const REFRESH_MS = 6 * 60 * 60 * 1000; // 6h — new models ship monthly, not hourly

type Resolved = { primary: string; fallback: string; fast: string };

let cache: Resolved | null = null;
let lastAttempt = 0;
let inFlight = false;

function eligible(id: string): boolean {
  return !id.includes('preview') && !id.includes('mythos');
}

/** Background resolution — never throws, never awaited by turn code. */
async function refresh(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  lastAttempt = Date.now();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const models: Array<{ id: string; created_at: string }> = [];
    for await (const m of client.models.list()) {
      models.push({ id: m.id, created_at: m.created_at });
    }
    models.sort((a, b) => b.created_at.localeCompare(a.created_at)); // newest first
    const pick = (prefix: string, fallbackId: string): string =>
      models.find((m) => m.id.startsWith(prefix) && eligible(m.id))?.id ?? fallbackId;
    cache = {
      primary: pick(FAMILY_PREFIX.primary, KNOWN_GOOD.primary),
      fallback: pick(FAMILY_PREFIX.fallback, KNOWN_GOOD.fallback),
      fast: pick(FAMILY_PREFIX.fast, KNOWN_GOOD.fast),
    };
    console.log(
      `[modelResolver] resolved latest models: primary=${cache.primary} ` +
        `fallback=${cache.fallback} fast=${cache.fast}`,
    );
  } catch (err) {
    console.warn(
      '[modelResolver] Models API resolution failed; serving known-good pinned models',
      err instanceof Error ? err.message : err,
    );
  } finally {
    inFlight = false;
  }
}

function get(kind: keyof Resolved): string {
  if (Date.now() - lastAttempt > REFRESH_MS) void refresh(); // lazy re-resolve, non-blocking
  return cache?.[kind] ?? KNOWN_GOOD[kind];
}

/** Newest Fable-family model (primary research engine). Synchronous. */
export function latestPrimary(): string {
  return get('primary');
}
/** Newest Opus-family model (unavailability failover). Synchronous. */
export function latestFallback(): string {
  return get('fallback');
}
/** Newest Sonnet-family model (quick mode + citation verifier). Synchronous. */
export function latestFast(): string {
  return get('fast');
}

// Kick the first resolution at module load — by the time a user turn arrives
// (even seconds later), the cache is warm. Turns never wait on this.
void refresh();
