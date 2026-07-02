/**
 * In-process CEB (Continuing Education of the Bar) search tool for the
 * V2 agent loop.
 *
 * Embeds the query via OpenAI (text-embedding-3-small, 1536 dim) and
 * queries Upstash Vector across the 5 CEB namespaces in parallel:
 *
 *   ceb_trusts_estates, ceb_family_law, ceb_business_litigation,
 *   ceb_business_entities, ceb_business_transactions
 *
 * Replaces the V1 HTTP endpoint api/ceb-search.ts (which stays running
 * for V1 production traffic and is deleted at Phase 5 cutover). This
 * module is invoked in-process from the agent loop's tool dispatcher.
 *
 * Latency baseline (2026-05-12, 5 queries):  p50 5.2s, p95 6.4s — see
 * reports/latency-baseline-2026-05-12.json.
 */

import { Index } from '@upstash/vector';
import { fetchWithTimeout } from './_http.js';

export interface CebSearchInput {
  /** The query string. Required. */
  query: string;
  /** Optional category restriction: searches only this namespace if set. */
  category?:
    | 'trusts_estates'
    | 'family_law'
    | 'business_litigation'
    | 'business_entities'
    | 'business_transactions';
  /** Top-k results per namespace (default 5). */
  top_k?: number;
  /** Minimum similarity score, 0..1 (default 0.7). */
  min_score?: number;
}

export interface CebSearchHit {
  namespace: string;
  score: number;
  metadata: Record<string, unknown> | null;
  /** Excerpt extracted from metadata.text or metadata.chunk if available. */
  excerpt?: string;
}

export interface CebSearchResult {
  /** Sorted by descending score, deduplicated. */
  hits: CebSearchHit[];
  /** Per-namespace match counts before deduplication. */
  by_namespace: Record<string, number>;
  /** Elapsed ms for the embed + vector query phase. */
  elapsed_ms: number;
}

const ALL_NAMESPACES = [
  'ceb_trusts_estates',
  'ceb_family_law',
  'ceb_business_litigation',
  'ceb_business_entities',
  'ceb_business_transactions',
] as const;

const CATEGORY_TO_NAMESPACE: Record<NonNullable<CebSearchInput['category']>, string> = {
  trusts_estates: 'ceb_trusts_estates',
  family_law: 'ceb_family_law',
  business_litigation: 'ceb_business_litigation',
  business_entities: 'ceb_business_entities',
  business_transactions: 'ceb_business_transactions',
};

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.7;
const EMBEDDING_MODEL = 'text-embedding-3-small';

let cachedIndex: Index | null = null;
function getIndex(): Index {
  if (cachedIndex) return cachedIndex;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    throw new Error('cebSearch: UPSTASH_VECTOR_REST_URL / TOKEN not configured');
  }
  cachedIndex = new Index({ url, token });
  return cachedIndex;
}

async function embed(query: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('cebSearch: OPENAI_API_KEY not configured');
  const resp = await fetchWithTimeout('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: query, model: EMBEDDING_MODEL }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`OpenAI embed ${resp.status}: ${body.slice(0, 200)}`);
  }
  const j = (await resp.json()) as { data: Array<{ embedding: number[] }> };
  return j.data[0].embedding;
}

function extractExcerpt(metadata: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined;
  const candidates = ['text', 'chunk', 'content', 'excerpt'];
  for (const k of candidates) {
    const v = metadata[k];
    if (typeof v === 'string' && v.length > 0) return v.slice(0, 1000);
  }
  return undefined;
}

/**
 * Run a CEB search. Embeds the query, fans out to the requested
 * namespace(s) in parallel, deduplicates and sorts by score, returns
 * the top hits. Errors are thrown — the agent loop's tool dispatcher
 * catches and reports them back to the model as tool_result blocks.
 */
export async function cebSearch(input: CebSearchInput): Promise<CebSearchResult> {
  const q = input.query?.trim();
  if (!q) {
    throw new Error('cebSearch: query is required');
  }
  const topK = input.top_k ?? DEFAULT_TOP_K;
  const minScore = input.min_score ?? DEFAULT_MIN_SCORE;
  const namespaces = input.category
    ? [CATEGORY_TO_NAMESPACE[input.category]]
    : [...ALL_NAMESPACES];

  const t0 = performance.now();
  const vector = await embed(q);
  const index = getIndex();

  const perNamespace = await Promise.all(
    namespaces.map(async (ns) => {
      try {
        const results = await index.query({
          vector,
          topK,
          includeMetadata: true,
          ...({ namespace: ns } as Record<string, unknown>),
        });
        return { ns, results };
      } catch (err) {
        // One namespace failing should not kill the whole search — return
        // an empty result for it and let the others succeed.
        // eslint-disable-next-line no-console
        console.warn(`[cebSearch] namespace ${ns} failed:`, (err as Error).message);
        return { ns, results: [] as Awaited<ReturnType<Index['query']>> };
      }
    }),
  );

  const byNamespace: Record<string, number> = {};
  const all: CebSearchHit[] = [];
  for (const { ns, results } of perNamespace) {
    byNamespace[ns] = results.length;
    for (const r of results) {
      if (typeof r.score !== 'number' || r.score < minScore) continue;
      const metadata = (r.metadata ?? null) as Record<string, unknown> | null;
      all.push({
        namespace: ns,
        score: r.score,
        metadata,
        excerpt: extractExcerpt(metadata),
      });
    }
  }

  // Dedupe: same excerpt content from multiple namespaces collapses to
  // the highest-scoring instance.
  all.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const deduped: CebSearchHit[] = [];
  for (const h of all) {
    const key = h.excerpt ?? `${h.namespace}:${h.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(h);
    if (deduped.length >= topK) break;
  }

  return {
    hits: deduped,
    by_namespace: byNamespace,
    elapsed_ms: performance.now() - t0,
  };
}

/**
 * Anthropic tool definition for the agent loop's `tools` array.
 * Description tuned for the model: tell it WHEN to call this tool, not
 * just what it does.
 */
export const CEB_SEARCH_TOOL_DEFINITION = {
  name: 'ceb_search',
  description:
    "Search the firm's Continuing Education of the Bar (CEB) practice-guide library — the authoritative California practitioner-oriented secondary source covering Trusts & Estates, Family Law, Business Litigation, Business Entities, and Business Transactions. Use this for procedure, forms, drafting practice tips, and California-specific 'how to' questions. Prefer this over web_search for established California practice topics.",
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language search query — short queries (3–10 words) work best.',
      },
      category: {
        type: 'string',
        enum: [
          'trusts_estates',
          'family_law',
          'business_litigation',
          'business_entities',
          'business_transactions',
        ],
        description: 'Optional: restrict search to a single CEB vertical. Omit to search all five.',
      },
      top_k: {
        type: 'integer',
        description: 'Top hits to return (default 5, max 20).',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  },
} as const;
