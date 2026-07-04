/**
 * In-process OpenStates search tool for the V2 agent loop. Wraps the
 * OpenStates v3 GraphQL/REST API for California bills. Mirrors V1's
 * api/legislative-search.ts (source=openstates branch).
 *
 * Key: OPENSTATES_API_KEY (sent via `X-API-Key` header).
 */

import { fetchWithTimeout } from './_http.js';

/**
 * Coerce a possibly-string / NaN tool input to a clamped integer. Tool inputs
 * arrive from the model as loosely-typed JSON — a `limit` may show up as "5"
 * (string) or garbage. Falls back to `def` on anything non-finite.
 */
function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export interface OpenStatesSearchInput {
  /** Free-text query — bill keywords or identifier. Required. */
  query: string;
  /** State abbreviation; default 'ca'. */
  jurisdiction?: string;
  /** Max bills to return (default 5, max 20). */
  limit?: number;
}

export interface OpenStatesHit {
  identifier: string;
  title: string;
  classification: string[];
  subject: string[];
  session: string;
  jurisdiction: string;
  latest_action_description: string;
  latest_action_date: string;
  openstates_url: string;
}

export interface OpenStatesSearchResult {
  hits: OpenStatesHit[];
  total_count: number;
  elapsed_ms: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const BASE_URL = 'https://v3.openstates.org/bills';

interface OpenStatesRawBill {
  identifier?: string;
  title?: string;
  classification?: string[];
  subject?: string[];
  session?: string;
  jurisdiction?: { name?: string } | string;
  latest_action_description?: string;
  latest_action_date?: string;
  openstates_url?: string;
}

interface OpenStatesSearchResponse {
  results?: OpenStatesRawBill[];
  pagination?: { total_items?: number };
}

export async function openstatesSearch(
  input: OpenStatesSearchInput,
): Promise<OpenStatesSearchResult> {
  const q = input.query?.trim();
  if (!q) throw new Error('openstatesSearch: query is required');

  const apiKey = process.env.OPENSTATES_API_KEY;
  if (!apiKey) throw new Error('openstatesSearch: OPENSTATES_API_KEY not configured');

  const jurisdiction = (input.jurisdiction ?? 'ca').toLowerCase();
  const limit = clampInt(input.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

  const url = new URL(BASE_URL);
  url.searchParams.set('jurisdiction', jurisdiction);
  url.searchParams.set('q', q);
  url.searchParams.set('per_page', String(limit));
  url.searchParams.set('sort', 'updated_desc');

  const t0 = performance.now();
  const resp = await fetchWithTimeout(url, { headers: { 'X-API-Key': apiKey } });
  const body = (await resp.json().catch(() => ({}))) as OpenStatesSearchResponse;
  if (!resp.ok) {
    throw new Error(
      `openstatesSearch HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }

  const raw = body.results ?? [];
  const hits: OpenStatesHit[] = raw.slice(0, limit).map((b) => ({
    identifier: b.identifier ?? '',
    title: b.title ?? '',
    classification: b.classification ?? [],
    subject: b.subject ?? [],
    session: b.session ?? '',
    jurisdiction:
      typeof b.jurisdiction === 'string'
        ? b.jurisdiction
        : b.jurisdiction?.name ?? jurisdiction.toUpperCase(),
    latest_action_description: b.latest_action_description ?? '',
    latest_action_date: b.latest_action_date ?? '',
    openstates_url: b.openstates_url ?? '',
  }));

  return {
    hits,
    total_count: body.pagination?.total_items ?? hits.length,
    elapsed_ms: performance.now() - t0,
  };
}

export const OPENSTATES_SEARCH_TOOL_DEFINITION = {
  name: 'openstates_search',
  description:
    "Search OpenStates for California legislation by topic or identifier. Alternative source to LegiScan with richer subject metadata. Returns bill identifier, title, classification, subject tags, session, latest action. Use as a cross-check when LegiScan results are sparse, or when you need the bill's subject taxonomy.",
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Bill keywords or identifier (e.g., "AB 1482", "rent control").',
      },
      jurisdiction: {
        type: 'string',
        description: "State abbreviation (default 'ca').",
      },
      limit: {
        type: 'integer',
        description: 'Max bills to return (default 5, max 20).',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  },
} as const;
