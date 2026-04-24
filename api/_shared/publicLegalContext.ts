import type { Source } from '../../types';

export interface PublicLegalContextResult {
  requested: boolean;
  enabled: boolean;
  queries: string[];
  context: string;
  sources: Source[];
  providers: string[];
  reason?: string;
  error?: string;
}

const MAX_RESULTS_PER_PROVIDER = 5;
const SEARCH_TIMEOUT_MS = 12000;

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/\bartificial intelligence\b|\bai\b/i, 'artificial intelligence'],
  [/\bhousing\b|\btenant\b|\blandlord\b|\brent\b/i, 'housing tenant landlord'],
  [/\bprivacy\b|\bccpa\b|\bcpra\b/i, 'privacy'],
  [/\bemployment\b|\blabor\b|\bwage\b|\bworkplace\b/i, 'employment labor'],
  [/\bdivorce\b|\bfamily law\b|\bcustody\b|\bchild support\b/i, 'family law'],
  [/\btrust\b|\bprobate\b|\bestate\b/i, 'trust probate estate'],
  [/\bconsumer\b|\blemon law\b|\bvehicle\b|\bautomobile\b/i, 'consumer vehicle'],
  [/\bclimate\b|\benvironment\b|\benergy\b/i, 'climate environment'],
  [/\bcriminal\b|\bcrime\b|\bpolice\b|\bsentencing\b/i, 'criminal justice'],
  [/\bhealth\b|\bmedical\b|\bhospital\b/i, 'health'],
  [/\beducation\b|\bschool\b|\bstudent\b/i, 'education'],
  [/\btax\b|\btaxes\b/i, 'tax'],
];

function compactText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxChars: number = 360): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars).trimEnd()}...`;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function normalizeBillId(value: string): string {
  return value.toUpperCase().replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export function shouldUsePublicLegalLookup(query: string): boolean {
  const text = compactText(query).toLowerCase();
  if (!text) {
    return false;
  }

  const hasCurrentIntent =
    /\b(current|currently|latest|recent|today|this year|new laws?|passed|signed|chaptered|enacted|effective|pending|introduced|202[4-9])\b/i.test(text);
  const hasPublicLawSubject =
    /\b(california|ca|bill|bills|law|laws|legislation|legislature|statute|assembly|senate|ab|sb)\b/i.test(text);

  return hasCurrentIntent && hasPublicLawSubject;
}

export function buildSanitizedPublicLegalQueries(query: string): string[] {
  const text = compactText(query);
  if (!text) {
    return [];
  }

  const billMatches = text.match(/\b(?:AB|SB|AJR|SJR|ACR|SCR|HR|SR)\s*-?\s*\d+[A-Z]?\b/gi) || [];
  if (billMatches.length > 0) {
    return Array.from(new Set(billMatches.map(normalizeBillId))).slice(0, 4);
  }

  const yearMatches = text.match(/\b20\d{2}\b/g) || [];
  const years = Array.from(new Set(yearMatches)).filter((year) => /^202[4-9]$/.test(year));
  const topics = TOPIC_PATTERNS
    .filter(([pattern]) => pattern.test(text))
    .map(([, term]) => term)
    .slice(0, 3);

  const currentLawIntent = /\b(new laws?|passed|signed|chaptered|enacted|effective)\b/i.test(text);
  const baseParts = [...years, ...topics];

  if (currentLawIntent) {
    baseParts.push('chaptered', 'signed');
  }

  if (baseParts.length === 0) {
    return [];
  }

  const baseQuery = Array.from(new Set(baseParts)).join(' ');
  const variants = [baseQuery];

  for (const year of years) {
    if (currentLawIntent) {
      variants.push(`${year} chaptered`);
      variants.push(`${year} signed into law`);
    }
    for (const topic of topics) {
      variants.push(`${year} ${topic}`);
    }
  }

  return Array.from(new Set(variants.map(compactText).filter(Boolean))).slice(0, 4);
}

async function searchOpenStates(query: string): Promise<Source[]> {
  const apiKey = process.env.OPENSTATES_API_KEY;
  if (!apiKey) {
    return [];
  }

  const url = new URL('https://v3.openstates.org/bills');
  url.searchParams.set('per_page', String(MAX_RESULTS_PER_PROVIDER));
  url.searchParams.set('jurisdiction', 'California');
  url.searchParams.set('query', query);

  const response = await fetch(url.toString(), {
    headers: { 'X-API-KEY': apiKey },
    signal: withTimeoutSignal(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenStates returned ${response.status}`);
  }

  const data = await response.json().catch(() => null);
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((bill: any): Source => {
    const identifier = compactText(bill?.identifier) || 'California bill';
    const title = compactText(bill?.title) || 'Title unavailable';
    const session = compactText(
      bill?.legislative_session?.identifier ||
      bill?.legislative_session?.name ||
      bill?.session
    );
    const updatedAt = compactText(bill?.updated_at || bill?.updatedAt);
    const url = compactText(bill?.openstates_url || bill?.sources?.[0]?.url);

    return {
      title: `${identifier} - ${title}`,
      url: url || `https://openstates.org/ca/bills/?q=${encodeURIComponent(identifier)}`,
      excerpt: truncateText(
        [
          title,
          session ? `Session: ${session}` : '',
          updatedAt ? `Updated: ${updatedAt}` : '',
          'Provider: OpenStates',
        ].filter(Boolean).join('. ')
      ),
    };
  });
}

async function searchLegiScan(query: string): Promise<Source[]> {
  const apiKey = process.env.LEGISCAN_API_KEY;
  if (!apiKey) {
    return [];
  }

  const url = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=search&state=CA&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: withTimeoutSignal(SEARCH_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`LegiScan returned ${response.status}`);
  }

  const data = await response.json().catch(() => null);
  const resultsObj = data?.searchresult || {};
  const entries = Object.values(resultsObj)
    .filter((entry: any) => entry && typeof entry === 'object' && entry.bill_number)
    .slice(0, MAX_RESULTS_PER_PROVIDER) as any[];

  return entries.map((entry: any): Source => {
    const billNumber = compactText(entry?.bill_number) || 'California bill';
    const title = compactText(entry?.title) || 'Title unavailable';
    const lastAction = compactText(entry?.last_action);
    const lastActionDate = compactText(entry?.last_action_date);
    const url = compactText(entry?.url || entry?.text_url || entry?.research_url);

    return {
      title: `${billNumber} - ${title}`,
      url: url || `https://legiscan.com/CA/search/${encodeURIComponent(billNumber)}`,
      excerpt: truncateText(
        [
          title,
          lastActionDate ? `Last action date: ${lastActionDate}` : '',
          lastAction ? `Last action: ${lastAction}` : '',
          'Provider: LegiScan',
        ].filter(Boolean).join('. ')
      ),
    };
  });
}

export async function buildPublicLegalContext(query: string): Promise<PublicLegalContextResult> {
  const requested = shouldUsePublicLegalLookup(query);
  if (!requested) {
    return {
      requested,
      enabled: false,
      queries: [],
      context: '',
      sources: [],
      providers: [],
      reason: 'heuristic_not_triggered',
    };
  }

  const queries = buildSanitizedPublicLegalQueries(query);
  if (queries.length === 0) {
    return {
      requested,
      enabled: false,
      queries,
      context: '',
      sources: [],
      providers: [],
      reason: 'no_safe_public_terms',
    };
  }

  const collectedSources: Source[] = [];
  const providers = new Set<string>();
  const errors: string[] = [];

  for (const safeQuery of queries) {
    const [openStatesResult, legiScanResult] = await Promise.allSettled([
      searchOpenStates(safeQuery),
      searchLegiScan(safeQuery),
    ]);

    if (openStatesResult.status === 'fulfilled' && openStatesResult.value.length > 0) {
      providers.add('OpenStates');
      collectedSources.push(...openStatesResult.value);
    } else if (openStatesResult.status === 'rejected') {
      errors.push(openStatesResult.reason?.message || 'OpenStates failed');
    }

    if (legiScanResult.status === 'fulfilled' && legiScanResult.value.length > 0) {
      providers.add('LegiScan');
      collectedSources.push(...legiScanResult.value);
    } else if (legiScanResult.status === 'rejected') {
      errors.push(legiScanResult.reason?.message || 'LegiScan failed');
    }
  }

  const sources = Array.from(new Map(
    collectedSources
      .filter((source) => source.url)
      .map((source) => [source.url, source])
  ).values()).slice(0, 10);

  const renderedSources = sources.map((source, index) => {
    return `[${index + 1}] ${source.title}\nURL: ${source.url}\nSnippet: ${source.excerpt || ''}`;
  });

  return {
    requested,
    enabled: sources.length > 0,
    queries,
    context: sources.length > 0
      ? `<public_legal_context privacy="sanitized_query_only" queries="${queries.join(' | ')}">\n${renderedSources.join('\n\n')}\n</public_legal_context>`
      : '',
    sources,
    providers: Array.from(providers),
    reason: sources.length > 0 ? undefined : 'no_results',
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
