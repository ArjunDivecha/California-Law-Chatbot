/**
 * In-process LegiScan search tool for the V2 agent loop. Wraps LegiScan's
 * public search API for California bills. Mirrors the surface of V1's
 * api/legislative-search.ts (source=legiscan branch) but called directly
 * from the dispatcher rather than via HTTP self-call.
 *
 * LegiScan key required (`LEGISCAN_API_KEY`). Returns the top N bill hits.
 */

export interface LegiscanSearchInput {
  /** Free-text query (e.g., "tenant relocation Oakland", "AB 1482"). Required. */
  query: string;
  /** Two-letter state code; default 'CA'. */
  state?: string;
  /** Max bills to return (default 5, max 20). */
  limit?: number;
}

export interface LegiscanHit {
  bill_number: string;
  title: string;
  status: string;
  state: string;
  last_action: string;
  last_action_date: string;
  url: string;
}

export interface LegiscanSearchResult {
  hits: LegiscanHit[];
  total_count: number;
  elapsed_ms: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

interface LegiscanRawBill {
  bill_number?: string;
  title?: string;
  last_action?: string;
  last_action_date?: string;
  state?: string;
  url?: string;
  status_desc?: string;
}

interface LegiscanSearchResponse {
  status?: string;
  searchresult?: Record<string, LegiscanRawBill | { count?: number }>;
}

export async function legiscanSearch(
  input: LegiscanSearchInput,
): Promise<LegiscanSearchResult> {
  const q = input.query?.trim();
  if (!q) throw new Error('legiscanSearch: query is required');

  const apiKey = process.env.LEGISCAN_API_KEY;
  if (!apiKey) throw new Error('legiscanSearch: LEGISCAN_API_KEY not configured');

  const state = (input.state ?? 'CA').toUpperCase();
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const url = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=search&state=${encodeURIComponent(state)}&query=${encodeURIComponent(q)}`;

  const t0 = performance.now();
  const resp = await fetch(url);
  const body = (await resp.json().catch(() => ({}))) as LegiscanSearchResponse;
  if (!resp.ok) {
    throw new Error(`legiscanSearch HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  if (body.status === 'ERROR') {
    throw new Error(`legiscanSearch API error: ${JSON.stringify(body).slice(0, 200)}`);
  }

  const sr = body.searchresult ?? {};
  // LegiScan returns numeric-keyed objects (0, 1, 2, …) plus a "summary"
  // entry. Filter out summary, treat the rest as bills.
  const bills: LegiscanRawBill[] = [];
  let totalCount = 0;
  for (const [k, v] of Object.entries(sr)) {
    if (k === 'summary') {
      const c = (v as { count?: number }).count;
      if (typeof c === 'number') totalCount = c;
      continue;
    }
    bills.push(v as LegiscanRawBill);
  }

  const hits: LegiscanHit[] = bills.slice(0, limit).map((b) => ({
    bill_number: b.bill_number ?? '',
    title: b.title ?? '',
    status: b.status_desc ?? '',
    state: b.state ?? state,
    last_action: b.last_action ?? '',
    last_action_date: b.last_action_date ?? '',
    url: b.url ?? '',
  }));

  return {
    hits,
    total_count: totalCount || hits.length,
    elapsed_ms: performance.now() - t0,
  };
}

export const LEGISCAN_SEARCH_TOOL_DEFINITION = {
  name: 'legiscan_search',
  description:
    'Search LegiScan for California legislation by topic, bill number, or keyword. Returns bill number, title, current status, and last legislative action. Use for "is there a pending bill on X?", "what is the status of AB 1482?", or "any recent California legislation on rent control?". Prefer legiscan_search over web_search for legislative-tracking queries.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Free-text query — topic, bill number, or keywords.',
      },
      state: {
        type: 'string',
        description: "Two-letter state code (default 'CA').",
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
