export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  provider: 'exa' | 'serper';
}

export interface WebSearchMeta {
  requested: boolean;
  enabled: boolean;
  provider?: 'exa' | 'serper';
  resultsCount: number;
  sources: WebSearchSource[];
  latencyMs?: number;
  error?: string;
  reason?: string;
}

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const SERPER_SEARCH_URL = 'https://google.serper.dev/search';
const RESULT_LIMIT = 5;
const SNIPPET_CHARS = 320;
const SEARCH_TIMEOUT_MS = 15000;

function compactText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, maxChars: number = SNIPPET_CHARS): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function queryExaSearch(query: string): Promise<{
  provider: 'exa';
  enabled: boolean;
  results: WebSearchSource[];
  latencyMs?: number;
  error?: string;
}> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      provider: 'exa',
      enabled: false,
      results: [],
      error: 'EXA_API_KEY not configured',
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(EXA_SEARCH_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: compactText(query).slice(0, 500),
        numResults: RESULT_LIMIT,
        type: 'fast',
      }),
      signal: withTimeoutSignal(SEARCH_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const details = compactText(await response.text().catch(() => ''));
      return {
        provider: 'exa',
        enabled: false,
        results: [],
        latencyMs,
        error: `Exa returned ${response.status}: ${details || 'unknown error'}`,
      };
    }

    const data = await response.json().catch(() => null);
    const rawResults = Array.isArray(data?.results) ? data.results : [];
    const results = rawResults
      .map((item: any): WebSearchSource | null => {
        const url = compactText(item?.url);
        if (!url) return null;

        return {
          title: compactText(item?.title) || 'Untitled result',
          url,
          publishedDate: compactText(
            item?.publishedDate || item?.published_date || item?.date
          ) || undefined,
          snippet: truncateText(
            compactText(item?.summary || item?.text || item?.snippet || 'No snippet provided.')
          ),
          provider: 'exa',
        };
      })
      .filter((item: WebSearchSource | null): item is WebSearchSource => item !== null);

    return {
      provider: 'exa',
      enabled: results.length > 0,
      results,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'exa',
      enabled: false,
      results: [],
      error: error instanceof Error ? error.message : 'Exa request failed',
    };
  }
}

async function querySerperSearch(query: string): Promise<{
  provider: 'serper';
  enabled: boolean;
  results: WebSearchSource[];
  latencyMs?: number;
  error?: string;
}> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return {
      provider: 'serper',
      enabled: false,
      results: [],
      error: 'SERPER_API_KEY not configured',
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(SERPER_SEARCH_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: compactText(query).slice(0, 500),
        gl: 'us',
        hl: 'en',
        num: RESULT_LIMIT,
      }),
      signal: withTimeoutSignal(SEARCH_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const details = compactText(await response.text().catch(() => ''));
      return {
        provider: 'serper',
        enabled: false,
        results: [],
        latencyMs,
        error: `Serper returned ${response.status}: ${details || 'unknown error'}`,
      };
    }

    const data = await response.json().catch(() => null);
    const rawResults = Array.isArray(data?.organic) ? data.organic : [];
    const results = rawResults
      .map((item: any): WebSearchSource | null => {
        const url = compactText(item?.link || item?.url);
        if (!url) return null;

        return {
          title: compactText(item?.title) || 'Untitled result',
          url,
          publishedDate: compactText(item?.date || item?.publishedDate) || undefined,
          snippet: truncateText(compactText(item?.snippet || 'No snippet provided.')),
          provider: 'serper',
        };
      })
      .filter((item: WebSearchSource | null): item is WebSearchSource => item !== null);

    return {
      provider: 'serper',
      enabled: results.length > 0,
      results,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'serper',
      enabled: false,
      results: [],
      error: error instanceof Error ? error.message : 'Serper request failed',
    };
  }
}

export function shouldUseWebSearch(query: string): boolean {
  const text = compactText(query).toLowerCase();
  if (!text) {
    return false;
  }

  return /(current|currently|latest|recent|today|yesterday|this year|new law|updated|amended|effective|pending|introduced|bill|news|as of|202[4-9])/i.test(
    text
  );
}

export async function buildWebSearchContext(
  query: string,
  requested: boolean
): Promise<{ webContext: string | null; meta: WebSearchMeta }> {
  const meta: WebSearchMeta = {
    requested,
    enabled: false,
    resultsCount: 0,
    sources: [],
  };

  if (!requested) {
    meta.reason = 'heuristic_not_triggered';
    return { webContext: null, meta };
  }

  const exaResult = await queryExaSearch(query);
  const selectedResult = exaResult.enabled
    ? exaResult
    : await querySerperSearch(query);

  meta.provider = selectedResult.provider;
  meta.enabled = selectedResult.enabled;
  meta.resultsCount = selectedResult.results.length;
  meta.sources = selectedResult.results;
  meta.latencyMs = selectedResult.latencyMs;

  if (selectedResult.error) {
    meta.error = selectedResult.error;
  }

  if (!selectedResult.results.length) {
    meta.reason = selectedResult.error ? 'search_error' : 'no_results';
    return { webContext: null, meta };
  }

  const renderedResults = selectedResult.results.map((result, index) => {
    const publishedLine = result.publishedDate ? `Published: ${result.publishedDate}\n` : '';
    return (
      `[${index + 1}] ${result.title}\n` +
      `URL: ${result.url}\n` +
      publishedLine +
      `Snippet: ${result.snippet}`
    );
  });

  return {
    webContext: `<web_context>\n${renderedResults.join('\n\n')}\n</web_context>`,
    meta,
  };
}
