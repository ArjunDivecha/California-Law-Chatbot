/**
 * In-process CourtListener search tool for the V2 agent loop.
 *
 * Hits CourtListener REST v4 /search/ — case-law opinion search. Same
 * filter mechanic as the V1 api/courtlistener-search.ts endpoint (which
 * stays running until Phase 5 cutover): California-only mode uses the
 * `court_id:<abbrev>` advanced-query operators (court_id:cal,
 * court_id:calctapp, ca9, cacd, caed, cand, casd, calappdeptsuper).
 *
 * Latency baseline (2026-05-12, 5 queries):  p50 1.3s, p95 5.5s.
 */

import { fetchWithTimeout } from './_http.js';

export interface CourtListenerSearchInput {
  /** Search query. Required. */
  query: string;
  /** Restrict to California state + federal courts (default true). */
  california_only?: boolean;
  /** Max results to return (default 5, max 20). */
  limit?: number;
  /** Filter to opinions filed on or after this date (YYYY-MM-DD). */
  filed_after?: string;
  /** Filter to opinions filed on or before this date (YYYY-MM-DD). */
  filed_before?: string;
}

export interface CourtListenerHit {
  case_name: string;
  court: string;
  date_filed: string;
  citation: string | null;
  cluster_id: number | null;
  absolute_url: string;
  /** First ~500 chars of opinion text snippet when available. */
  snippet?: string;
}

export interface CourtListenerSearchResult {
  hits: CourtListenerHit[];
  total_count: number;
  elapsed_ms: number;
}

const CA_COURT_IDS = [
  'cal',
  'calctapp',
  'calappdeptsuper',
  'ca9',
  'cacd',
  'caed',
  'cand',
  'casd',
];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4/search/';

interface RawSearchResult {
  case_name?: string;
  caseName?: string;
  court?: string;
  date_filed?: string;
  dateFiled?: string;
  citation?: string[] | string;
  cluster_id?: number;
  absolute_url?: string;
  snippet?: string;
}

interface RawSearchResponse {
  count?: number;
  results?: RawSearchResult[];
}

function firstString(v: string[] | string | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * Run a CourtListener search. Returns the top hits normalized to a
 * stable shape. Errors thrown bubble to the agent loop's dispatcher.
 */
export async function courtlistenerSearch(
  input: CourtListenerSearchInput,
): Promise<CourtListenerSearchResult> {
  const q = input.query?.trim();
  if (!q) throw new Error('courtlistenerSearch: query is required');

  const apiKey = process.env.COURTLISTENER_API_KEY;
  if (!apiKey) {
    throw new Error('courtlistenerSearch: COURTLISTENER_API_KEY not configured');
  }

  const californiaOnly = input.california_only !== false; // default true
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

  const queryWithCourt = californiaOnly
    ? `(${q}) AND (${CA_COURT_IDS.map((c) => `court_id:${c}`).join(' OR ')})`
    : q;

  const url = new URL(BASE_URL);
  url.searchParams.set('q', queryWithCourt);
  url.searchParams.set('type', 'o'); // case-law opinions
  if (input.filed_after) url.searchParams.set('filed_after', input.filed_after);
  if (input.filed_before) url.searchParams.set('filed_before', input.filed_before);

  const t0 = performance.now();
  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  const body = (await resp.json().catch(() => ({}))) as RawSearchResponse;
  if (!resp.ok) {
    throw new Error(
      `courtlistenerSearch HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }

  const raw = body.results ?? [];
  const hits: CourtListenerHit[] = raw.slice(0, limit).map((r) => ({
    case_name: r.case_name ?? r.caseName ?? '(unknown)',
    court: r.court ?? '(unknown)',
    date_filed: r.date_filed ?? r.dateFiled ?? '',
    citation: firstString(r.citation),
    cluster_id: r.cluster_id ?? null,
    absolute_url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : '',
    snippet: r.snippet?.slice(0, 500),
  }));

  return {
    hits,
    total_count: body.count ?? 0,
    elapsed_ms: performance.now() - t0,
  };
}

export const COURTLISTENER_SEARCH_TOOL_DEFINITION = {
  name: 'courtlistener_search',
  description:
    'Search CourtListener for California case law (default) or federal/all jurisdictions. Use this for finding case-law opinions on a topic, recent appellate decisions, or specific case captions. Returns case name, court, date filed, citation, and a text snippet. Prefer this over web_search for any "find me a case on X" or "what does case Y say" query.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query — keywords, case caption, or natural-language description of the issue.',
      },
      california_only: {
        type: 'boolean',
        description:
          'Restrict to California state + federal courts (default true). Set false for national searches.',
      },
      limit: {
        type: 'integer',
        description: 'Max hits to return (default 5, max 20).',
        minimum: 1,
        maximum: 20,
      },
      filed_after: {
        type: 'string',
        description: 'Filter to opinions filed on or after this date (YYYY-MM-DD).',
      },
      filed_before: {
        type: 'string',
        description: 'Filter to opinions filed on or before this date (YYYY-MM-DD).',
      },
    },
    required: ['query'],
  },
} as const;
