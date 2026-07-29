/**
 * In-process citation verification tool for the V2 agent loop. Extracts
 * case citations from a passage of text and verifies each against
 * CourtListener's REST v4 /search/ endpoint plus CiteLaw's structured
 * identity-verification endpoint. Mirrors V1's api/verify-citations.ts
 * but is called directly from the dispatcher.
 *
 * The model uses this tool BEFORE finalizing any drafting output that
 * contains citations — per the drafting Skills, every cited case must be
 * retrievable here or it must not appear in the draft.
 *
 * CiteLaw was added as a secondary structured identity gate after the
 * 2026-07-29 provider benchmark showed that reporter-only lookups could
 * accept fabricated captions attached to real reporter slots.
 */

import { fetchWithTimeout } from './_http.js';

export interface CitationVerifyInput {
  /** Text containing citations to extract and verify. Required if `citations` empty. */
  text?: string;
  /** Optional: specific citations to verify directly (skips extraction). */
  citations?: string[];
}

export interface CitationVerification {
  text: string;
  type: 'case' | 'statute' | 'unknown';
  is_valid_format: boolean;
  /**
   * 'verified'    — a CourtListener hit's own citation list contains the
   *                 queried volume/reporter/page (evidence-checked).
   * 'unconfirmed' — search returned candidates but none could be
   *                 confirmed to bear this exact cite. NOT evidence of
   *                 fabrication; also NOT license to cite as verified.
   * 'not_found'   — well-formed cite, zero search hits.
   * 'unverified'  — malformed citation, not checked.
   * 'unavailable' — CourtListener errored/rate-limited; verification
   *                 could not run. Never interpret as fabricated.
   */
  status: 'verified' | 'unconfirmed' | 'unverified' | 'not_found' | 'unavailable';
  /** CourtListener's raw status before the CiteLaw identity gate is applied. */
  courtlistener_status?: CitationVerification['status'];
  courtlistener_match?: {
    cluster_id: string;
    url: string;
    case_name: string;
    court?: string;
    date_filed?: string;
  };
  /** Top search hit when status='unconfirmed' — a lead, not a match. */
  possible_match?: CitationVerification['courtlistener_match'];
  /**
   * Structured identity evidence from CiteLaw. `possible_match` and
   * `no_match` are never positive evidence by themselves.
   */
  citelaw?: CiteLawCitationVerification;
  /** Provider(s) that supplied positive evidence for status='verified'. */
  verification_source?: 'courtlistener' | 'citelaw' | 'courtlistener+citelaw';
}

export interface CiteLawMatch {
  id?: string;
  title?: string;
  citation?: string[];
  court?: string;
  year?: number;
  url?: string;
  citelaw_cite?: string;
}

export interface CiteLawCitationVerification {
  status:
    | 'confirmed'
    | 'possible_match'
    | 'no_match'
    | 'unavailable'
    | 'not_configured'
    | 'skipped';
  detected_source?: string;
  reason?: string;
  field_matches?: Record<string, boolean | null>;
  match?: CiteLawMatch;
  candidates?: CiteLawMatch[];
}

export interface CiteLawBilling {
  citations_verified: number;
  credits_per_citation_rate?: string;
  credits_charged: number;
  credits_remaining?: number;
}

export interface CiteLawRunSummary {
  status: 'completed' | 'cached' | 'not_configured' | 'unavailable';
  requested: number;
  submitted: number;
  cache_hits: number;
  skipped: number;
  billing?: CiteLawBilling;
  error?: string;
}

export interface CitationVerifyResult {
  citations: CitationVerification[];
  total_found: number;
  verified: number;
  unconfirmed: number;
  unverified: number;
  not_found: number;
  unavailable: number;
  /** Batch-level CiteLaw usage and billing visibility. */
  citelaw: CiteLawRunSummary;
  elapsed_ms: number;
}

export interface CitationVerifyRuntimeOptions {
  /**
   * Override CiteLaw authentication for a trusted internal caller.
   * `undefined` reads CITELAW_API_KEY; `null` explicitly disables CiteLaw.
   */
  citelawApiKey?: string | null;
}

// California + federal reporter patterns — same as V1.
const CASE_CITATION_PATTERNS: RegExp[] = [
  /(\d+)\s+(Cal\.?\s*Rptr\.?\s*(?:2d|3d)?)\s+(\d+)/gi,
  /(\d+)\s+(Cal\.?\s*(?:App\.?)?\s*(?:2d|3d|4th|5th)?)\s+(\d+)/gi,
  /(\d+)\s+(F\.?\s*(?:Supp\.?)?\s*(?:2d|3d)?)\s+(\d+)/gi,
  /(\d+)\s+(P\.?\s*(?:2d|3d))\s+(\d+)/gi,
  /(\d+)\s+(U\.?S\.?)\s+(\d+)/gi,
  /(\d+)\s+(S\.?\s*Ct\.?)\s+(\d+)/gi,
  /(\d{4})\s+(WL|Cal\.?\s*(?:App\.?)?\s*LEXIS)\s+(\d+)/gi,
];

// A "party-name token" is a Title-Case word that MAY include embedded
// periods (Univ., Cal., Inc., Co., Corp., Bros.), apostrophes (Ass'n,
// O'Reilly), ampersands (Smith & Wesson), or hyphens (7-Eleven, Coca-
// Cola). Bare uppercase like "Cal" is also fine. We additionally
// allow lowercase connectors ("of", "the", "and", "&", "in", "on",
// "for", "or", "de", "la") between Title-Case tokens so captions
// like "Regents of the University of California" don't break the
// match. This pattern is intentionally permissive on the case-name
// side and strict on the reporter side.
const PARTY_NAME = String.raw`[A-Z][\w'.&\-]*(?:\s+(?:[A-Z][\w'.&\-]*|of|the|and|&|in|on|for|or|de|la|el|los|las|von|van))*`;
const PARTY_NAME_WITH_SUFFIX =
  String.raw`${PARTY_NAME}(?:,\s*(?:Inc\.?|LLC|L\.L\.C\.|Corp\.?|Co\.?|Ltd\.?|L\.P\.|LLP|P\.C\.))?`;
// A reporter cite: 1+ digits + space + (Cal[.App][.Xd|th] | F[.Supp][.Xd] | U.S.) + space + 1+ digits.
// Note we explicitly enumerate the period-bearing forms instead of using
// a generic [^,;.\n]+ — that earlier pattern choked on multi-period
// reporters like "Cal.App.5th".
const REPORTER = String.raw`\d+\s+(?:Cal\.?\s*Rptr\.?\s*(?:2d|3d)?|Cal\.?\s*(?:App\.?)?\s*(?:2d|3d|4th|5th)?|F\.?\s*(?:Supp\.?)?\s*(?:2d|3d)?|P\.?\s*(?:2d|3d)|U\.?S\.?|S\.?\s*Ct\.?)\s+\d+`;

const CITELAW_ENDPOINT = 'https://citelaw.org/api/v1/citations/verify';
const CITELAW_DEFAULT_MAX_CITATIONS = 50;
const CITELAW_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CITELAW_CACHE_MAX_ENTRIES = 1_000;

interface PreparedCitation {
  index: number;
  text: string;
  type: 'case' | 'statute' | 'unknown';
  isValid: boolean;
  reporter?: string;
  title?: string;
  year?: number;
}

interface CiteLawCacheEntry {
  expiresAt: number;
  value: CiteLawCitationVerification;
}

interface CiteLawBatchResult {
  byIndex: Map<number, CiteLawCitationVerification>;
  summary: CiteLawRunSummary;
}

const citeLawCache = new Map<string, CiteLawCacheEntry>();

export function extractCitations(text: string): Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> = [];

  // FIRST pass: full case-name+reporter ("Williams v. Superior Court (2017) 3 Cal.5th 531").
  // Capture these BEFORE the bare-reporter pass so their sub-reporter parts
  // can be deduped against the full form in the next pass.
  const fullPattern = new RegExp(
    String.raw`(${PARTY_NAME_WITH_SUFFIX}\s+v\.?\s+${PARTY_NAME_WITH_SUFFIX})` +
      String.raw`\s*(?:\((\d{4})\))?\s*,?\s*(${REPORTER})`,
    'g',
  );
  const fullForms: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fullPattern.exec(text)) !== null) {
    const full = m[2] ? `${m[1]} (${m[2]}) ${m[3]}` : `${m[1]}, ${m[3]}`;
    const k = full.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ text: full.trim(), type: 'case' });
      fullForms.push(k);
    }
  }

  // SECOND pass: bare reporter citations. Skip any whose normalized form
  // appears as a substring of a full-form citation already captured —
  // those are the same case extracted twice (regex artifact, not a
  // distinct citation).
  for (const pattern of CASE_CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let m2: RegExpExecArray | null;
    while ((m2 = pattern.exec(text)) !== null) {
      const t = m2[0].trim();
      const k = t.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(k)) continue;
      if (fullForms.some((f) => f.includes(k))) continue;
      seen.add(k);
      out.push({ text: t, type: 'case' });
    }
  }
  return out;
}

/**
 * A citation is well-formed only when it contains an actual reporter
 * cite (volume + reporter + page) or a WL/LEXIS docket form. The old
 * check (`has a digit` + `mentions Cal/F./U.S. anywhere`) passed
 * strings like "5 California Street" straight into the verifier.
 */
function isValidCitationFormat(c: string): boolean {
  const reporterRe = new RegExp(REPORTER, 'i');
  const wlRe = /\b\d{4}\s+(?:WL|Cal\.?\s*(?:App\.?)?\s*LEXIS)\s+\d+\b/i;
  return reporterRe.test(c) || wlRe.test(c);
}

/**
 * Parse the volume/reporter/page components out of a citation string so
 * a search hit can be checked for the EXACT cite rather than trusted on
 * relevance rank. Returns null when no reporter cite is present.
 */
export function parseReporterCite(
  c: string,
): { volume: string; reporter: string; page: string } | null {
  const m = new RegExp(`(\\d+)\\s+(Cal\\.?\\s*Rptr\\.?\\s*(?:2d|3d)?|Cal\\.?\\s*(?:App\\.?)?\\s*(?:2d|3d|4th|5th)?|F\\.?\\s*(?:Supp\\.?)?\\s*(?:2d|3d)?|P\\.?\\s*(?:2d|3d)|U\\.?S\\.?|S\\.?\\s*Ct\\.?)\\s+(\\d+)`, 'i').exec(c);
  if (!m) return null;
  return { volume: m[1], reporter: m[2], page: m[3] };
}

/**
 * Pull the public case identity fields CiteLaw can cross-check. Only the
 * reporter cite, caption, and decision year leave the server; surrounding
 * client facts or asserted propositions are never included.
 */
export function parseCaseCitationIdentity(
  text: string,
): { citation: string; title?: string; year?: number } | null {
  const reporterMatch = new RegExp(REPORTER, 'i').exec(text);
  if (!reporterMatch || reporterMatch.index === undefined) return null;

  const citation = reporterMatch[0].replace(/\s+/g, ' ').trim();
  const beforeReporter = text.slice(0, reporterMatch.index).trim();
  const yearMatch =
    Array.from(text.matchAll(/\((\d{4})\)/g)).find((match) => {
      const year = Number(match[1]);
      return year >= 1600 && year <= new Date().getFullYear() + 1;
    }) ?? null;
  const year = yearMatch ? Number(yearMatch[1]) : undefined;

  const captionPrefix = beforeReporter
    .replace(/\(\d{4}\)\s*,?\s*$/u, '')
    .replace(/,\s*$/u, '')
    .replace(/^(?:but\s+see|see(?:\s+also)?|cf\.?|accord)\s+/iu, '')
    .trim();
  // Do not send arbitrary text before the reporter cite. Capture only a
  // recognizable public case caption at the END of the prefix, so a tool
  // input like "Client X relies on Navellier v. Sletten ..." transmits only
  // "Navellier v. Sletten" to CiteLaw.
  const adversarialCaption = new RegExp(
    String.raw`(${PARTY_NAME_WITH_SUFFIX}\s+v\.?\s+${PARTY_NAME_WITH_SUFFIX})$`,
  ).exec(captionPrefix);
  const matterCaption = new RegExp(
    String.raw`((?:In re(?: the)?|In the Matter of|Estate of|Marriage of)\s+${PARTY_NAME})$`,
  ).exec(captionPrefix);
  const title = adversarialCaption?.[1] ?? matterCaption?.[1];

  return {
    citation,
    title,
    year,
  };
}

function citeLawCacheKey(c: PreparedCitation): string {
  return [
    c.reporter?.toLowerCase().replace(/[.\s]/g, '') ?? '',
    c.title?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '',
    c.year ?? '',
  ].join('|');
}

function readCiteLawCache(key: string): CiteLawCitationVerification | undefined {
  const cached = citeLawCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    citeLawCache.delete(key);
    return undefined;
  }
  return cached.value;
}

function writeCiteLawCache(key: string, value: CiteLawCitationVerification): void {
  if (
    value.status !== 'confirmed' &&
    value.status !== 'possible_match' &&
    value.status !== 'no_match'
  ) {
    return;
  }
  if (citeLawCache.size >= CITELAW_CACHE_MAX_ENTRIES) {
    const oldestKey = citeLawCache.keys().next().value;
    if (typeof oldestKey === 'string') citeLawCache.delete(oldestKey);
  }
  citeLawCache.set(key, {
    expiresAt: Date.now() + CITELAW_CACHE_TTL_MS,
    value,
  });
}

/** Test/operations hook; credentials and raw provider responses are not stored. */
export function clearCiteLawVerificationCache(): void {
  citeLawCache.clear();
}

function compactCiteLawMatch(raw: unknown): CiteLawMatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const match = raw as Record<string, unknown>;
  const citations = Array.isArray(match.citation)
    ? match.citation.filter((value): value is string => typeof value === 'string').slice(0, 5)
    : typeof match.citation === 'string'
      ? [match.citation]
      : undefined;
  return {
    id:
      typeof match.id === 'string' || typeof match.id === 'number'
        ? String(match.id)
        : undefined,
    title: typeof match.title === 'string' ? match.title : undefined,
    citation: citations,
    court: typeof match.court === 'string' ? match.court : undefined,
    year: typeof match.year === 'number' ? match.year : undefined,
    url: typeof match.url === 'string' ? match.url : undefined,
    citelaw_cite:
      typeof match.citelaw_cite === 'string' ? match.citelaw_cite : undefined,
  };
}

function compactCiteLawResult(raw: unknown): CiteLawCitationVerification {
  if (!raw || typeof raw !== 'object') return { status: 'unavailable' };
  const result = raw as Record<string, unknown>;
  const status =
    result.status === 'confirmed' ||
    result.status === 'possible_match' ||
    result.status === 'no_match'
      ? result.status
      : 'unavailable';
  const candidates = Array.isArray(result.candidates)
    ? result.candidates
        .map(compactCiteLawMatch)
        .filter((candidate): candidate is CiteLawMatch => candidate !== undefined)
        .slice(0, 3)
    : undefined;
  const rawFieldMatches =
    result.field_matches && typeof result.field_matches === 'object'
      ? (result.field_matches as Record<string, unknown>)
      : undefined;
  const fieldMatches = rawFieldMatches
    ? Object.fromEntries(
        Object.entries(rawFieldMatches)
          .filter(([, value]) => typeof value === 'boolean' || value === null)
          .map(([key, value]) => [key, value as boolean | null]),
      )
    : undefined;
  return {
    status,
    detected_source:
      typeof result.detected_source === 'string' ? result.detected_source : undefined,
    reason: typeof result.reason === 'string' ? result.reason.slice(0, 600) : undefined,
    field_matches: fieldMatches,
    match: compactCiteLawMatch(result.match),
    candidates,
  };
}

function citeLawMaxCitations(): number {
  const configured = Number(process.env.CITELAW_MAX_CITATIONS_PER_REQUEST);
  if (!Number.isFinite(configured) || configured <= 0) {
    return CITELAW_DEFAULT_MAX_CITATIONS;
  }
  return Math.min(500, Math.floor(configured));
}

function compactBilling(raw: unknown): CiteLawBilling | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const billing = raw as Record<string, unknown>;
  if (
    typeof billing.citations_verified !== 'number' ||
    typeof billing.credits_charged !== 'number'
  ) {
    return undefined;
  }
  return {
    citations_verified: billing.citations_verified,
    credits_per_citation_rate:
      typeof billing.credits_per_citation_rate === 'string'
        ? billing.credits_per_citation_rate
        : undefined,
    credits_charged: billing.credits_charged,
    credits_remaining:
      typeof billing.credits_remaining === 'number'
        ? billing.credits_remaining
        : undefined,
  };
}

async function verifyCitationsWithCiteLaw(
  citations: PreparedCitation[],
  apiKey: string | undefined,
): Promise<CiteLawBatchResult> {
  const byIndex = new Map<number, CiteLawCitationVerification>();
  const requested = citations.length;
  if (!apiKey) {
    for (const citation of citations) {
      byIndex.set(citation.index, { status: 'not_configured' });
    }
    return {
      byIndex,
      summary: {
        status: 'not_configured',
        requested,
        submitted: 0,
        cache_hits: 0,
        skipped: 0,
      },
    };
  }

  let cacheHits = 0;
  const uncachedByKey = new Map<string, PreparedCitation>();
  for (const citation of citations) {
    const key = citeLawCacheKey(citation);
    const cached = readCiteLawCache(key);
    if (cached) {
      byIndex.set(citation.index, cached);
      cacheHits += 1;
    } else if (!uncachedByKey.has(key)) {
      uncachedByKey.set(key, citation);
    }
  }

  const maxCitations = citeLawMaxCitations();
  const uncached = Array.from(uncachedByKey.values());
  const submitted = uncached.slice(0, maxCitations);
  const skipped = uncached.slice(maxCitations);
  for (const citation of skipped) {
    byIndex.set(citation.index, { status: 'skipped' });
  }

  if (submitted.length === 0) {
    return {
      byIndex,
      summary: {
        status: 'cached',
        requested,
        submitted: 0,
        cache_hits: cacheHits,
        skipped: skipped.length,
        billing: {
          citations_verified: 0,
          credits_charged: 0,
        },
      },
    };
  }

  try {
    const response = await fetchWithTimeout(
      CITELAW_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AskPauli citation verification/1.0',
        },
        body: JSON.stringify({
          citations: submitted.map((citation) => ({
            citation: citation.reporter,
            ...(citation.title ? { title: citation.title } : {}),
            ...(citation.year ? { year: citation.year } : {}),
            category: 'case',
          })),
        }),
      },
      { timeoutMs: 15_000, retries: 1 },
    );
    if (!response.ok) {
      throw new Error(`CiteLaw verify http ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as {
      results?: unknown[];
      billing?: unknown;
    };
    if (!Array.isArray(body.results)) {
      throw new Error('CiteLaw verify returned no results array');
    }

    for (let i = 0; i < submitted.length; i += 1) {
      const citation = submitted[i];
      const value = compactCiteLawResult(body.results[i]);
      byIndex.set(citation.index, value);
      writeCiteLawCache(citeLawCacheKey(citation), value);
    }
    // Duplicate citations share the cached structured result.
    for (const citation of citations) {
      if (byIndex.has(citation.index)) continue;
      const cached = readCiteLawCache(citeLawCacheKey(citation));
      byIndex.set(citation.index, cached ?? { status: 'unavailable' });
    }

    return {
      byIndex,
      summary: {
        status: 'completed',
        requested,
        submitted: submitted.length,
        cache_hits: cacheHits,
        skipped: skipped.length,
        billing: compactBilling(body.billing),
      },
    };
  } catch (error) {
    for (const citation of citations) {
      if (!byIndex.has(citation.index)) {
        byIndex.set(citation.index, { status: 'unavailable' });
      }
    }
    return {
      byIndex,
      summary: {
        status: 'unavailable',
        requested,
        submitted: submitted.length,
        cache_hits: cacheHits,
        skipped: skipped.length,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/** Normalize a reporter string for comparison: lowercase, strip dots/spaces. */
function normReporter(r: string): string {
  return r.toLowerCase().replace(/[.\s]/g, '');
}

/**
 * True when one of the hit's own citation strings bears the queried
 * volume/reporter/page. This is the evidence gate: without it, the top
 * relevance hit for a hallucinated cite was stamped 'verified'.
 */
function hitBearsCite(
  hit: CLHit,
  cite: { volume: string; reporter: string; page: string },
): boolean {
  const hitCites: string[] = [];
  const c = (hit as { citation?: unknown }).citation;
  if (Array.isArray(c)) {
    for (const x of c) if (typeof x === 'string') hitCites.push(x);
  } else if (typeof c === 'string') {
    hitCites.push(c);
  }
  for (const hc of hitCites) {
    const parsed = parseReporterCite(hc);
    if (!parsed) continue;
    if (
      parsed.volume === cite.volume &&
      parsed.page === cite.page &&
      normReporter(parsed.reporter) === normReporter(cite.reporter)
    ) {
      return true;
    }
  }
  return false;
}

interface CLHit {
  id?: number | string;
  cluster_id?: number | string;
  case_name?: string;
  caseName?: string;
  court?: string;
  court_id?: string;
  date_filed?: string;
  dateFiled?: string;
  absolute_url?: string;
}

function hitToMatch(top: CLHit): CitationVerification['courtlistener_match'] {
  const clusterId = String(top.id ?? top.cluster_id ?? '');
  return {
    cluster_id: clusterId,
    url: top.absolute_url
      ? `https://www.courtlistener.com${top.absolute_url}`
      : `https://www.courtlistener.com/opinion/${clusterId}/`,
    case_name: top.case_name ?? top.caseName ?? '',
    court: top.court ?? top.court_id ?? '',
    date_filed: top.date_filed ?? top.dateFiled ?? '',
  };
}

async function clSearch(
  query: string,
  apiKey: string | undefined,
): Promise<CLHit[]> {
  const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&order_by=score+desc`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'California Law Chatbot V2/1.0',
  };
  if (apiKey) headers['Authorization'] = `Token ${apiKey}`;
  const resp = await fetchWithTimeout(url, { headers });
  if (!resp.ok) {
    // Throw rather than return [] (2026-07-04 review fix C4): an empty
    // return here used to flow through as status 'not_found' ("likely
    // fabricated"), so a CourtListener 429 burst made REAL citations
    // read as fake and the model dropped valid authority.
    throw new Error(`CourtListener search http ${resp.status}`);
  }
  const data = (await resp.json().catch(() => ({}))) as { results?: CLHit[] };
  return data.results ?? [];
}

/**
 * Verify a single citation against CourtListener by full-text search.
 * Returns the top hit when present; null otherwise.
 *
 * NOTE — verifier accuracy ceiling: CL's search-by-citation API doesn't
 * reliably return THE specific opinion at a given reporter cite — bare
 * reporter citations ("29 Cal.4th 82") can match a different opinion
 * that happens to mention the same volume/page in its text. A
 * case-name-based fallback was tried (commit history) and made things
 * worse (false-positive matches to same-named different cases). CiteLaw's
 * structured title/year/citation check now supplies the identity gate.
 * `not_found` should still be interpreted as "the configured verifiers
 * could not confirm" rather than "this case does not exist."
 */
async function verifyOne(
  citation: string,
  apiKey: string | undefined,
): Promise<Pick<CitationVerification, 'status' | 'courtlistener_match' | 'possible_match'>> {
  let hits: CLHit[];
  try {
    hits = await clSearch(citation, apiKey);
  } catch {
    return { status: 'unavailable' };
  }
  if (hits.length === 0) return { status: 'not_found' };

  // Evidence gate (2026-07-04 review fix C4): only stamp 'verified' when
  // a hit's own citation list bears the queried volume/reporter/page.
  // Previously hits[0] (top relevance hit) was returned as 'verified'
  // unconditionally — a hallucinated cite whose text matched an
  // unrelated opinion shipped with a real-looking URL and a green badge.
  const cite = parseReporterCite(citation);
  if (cite) {
    const exact = hits.find((h) => hitBearsCite(h, cite));
    if (exact) return { status: 'verified', courtlistener_match: hitToMatch(exact) };
    return { status: 'unconfirmed', possible_match: hitToMatch(hits[0]) };
  }
  // No parseable reporter components (WL/LEXIS forms): search found
  // candidates but exactness cannot be established — unconfirmed.
  return { status: 'unconfirmed', possible_match: hitToMatch(hits[0]) };
}

function prepareCitation(
  citation: { text: string; type: 'case' | 'statute' | 'unknown' },
  index: number,
): PreparedCitation {
  const isValid = isValidCitationFormat(citation.text);
  const identity = isValid ? parseCaseCitationIdentity(citation.text) : null;
  return {
    index,
    text: citation.text,
    type: citation.type,
    isValid,
    reporter: identity?.citation,
    title: identity?.title,
    year: identity?.year,
  };
}

function positiveVerificationSource(
  courtListenerStatus: CitationVerification['status'],
  citeLawStatus: CiteLawCitationVerification['status'] | undefined,
): CitationVerification['verification_source'] | undefined {
  const courtListenerVerified = courtListenerStatus === 'verified';
  const citeLawVerified = citeLawStatus === 'confirmed';
  if (courtListenerVerified && citeLawVerified) return 'courtlistener+citelaw';
  if (citeLawVerified) return 'citelaw';
  if (courtListenerVerified) return 'courtlistener';
  return undefined;
}

function applyCiteLawIdentityGate(
  base: Pick<CitationVerification, 'status' | 'courtlistener_match' | 'possible_match'>,
  citeLaw: CiteLawCitationVerification | undefined,
): Pick<
  CitationVerification,
  | 'status'
  | 'courtlistener_status'
  | 'courtlistener_match'
  | 'possible_match'
  | 'citelaw'
  | 'verification_source'
> {
  let status = base.status;
  if (citeLaw?.status === 'confirmed') {
    status = 'verified';
  } else if (citeLaw?.status === 'possible_match') {
    // A credible near-miss is an explicit request for human/provider
    // reconciliation. It must never inherit a green CourtListener badge.
    status = 'unconfirmed';
  } else if (citeLaw?.status === 'no_match') {
    // A CiteLaw corpus miss is not proof of fabrication. When both sources
    // miss, preserve the existing not_found status; otherwise surface the
    // provider conflict as unconfirmed.
    status = base.status === 'not_found' ? 'not_found' : 'unconfirmed';
  }

  return {
    ...base,
    status,
    courtlistener_status: base.status,
    citelaw: citeLaw,
    verification_source:
      status === 'verified'
        ? positiveVerificationSource(base.status, citeLaw?.status)
        : undefined,
  };
}

/**
 * Prime the short-lived CiteLaw identity cache in one paid batch. The
 * verification SSE workflow uses this before launching one sub-agent per
 * citation, avoiding the provider's one-credit minimum on every row.
 */
export async function prefetchCiteLawVerification(
  citations: string[],
  options: CitationVerifyRuntimeOptions = {},
): Promise<CiteLawRunSummary> {
  const apiKey =
    options.citelawApiKey === undefined
      ? process.env.CITELAW_API_KEY
      : options.citelawApiKey ?? undefined;
  const prepared = citations
    .map((text, index) => prepareCitation({ text, type: 'case' }, index))
    .filter((citation) => citation.isValid && citation.reporter);
  return (await verifyCitationsWithCiteLaw(prepared, apiKey)).summary;
}

export async function citationVerify(
  input: CitationVerifyInput,
  options: CitationVerifyRuntimeOptions = {},
): Promise<CitationVerifyResult> {
  const t0 = performance.now();
  const courtListenerApiKey = process.env.COURTLISTENER_API_KEY;
  const citeLawApiKey =
    options.citelawApiKey === undefined
      ? process.env.CITELAW_API_KEY
      : options.citelawApiKey ?? undefined;

  const toVerify =
    input.citations && input.citations.length > 0
      ? input.citations.map((c) => ({ text: c, type: 'case' as const }))
      : input.text
        ? extractCitations(input.text)
        : [];

  if (toVerify.length === 0) {
    return {
      citations: [],
      total_found: 0,
      verified: 0,
      unconfirmed: 0,
      unverified: 0,
      not_found: 0,
      unavailable: 0,
      citelaw: {
        status: citeLawApiKey ? 'completed' : 'not_configured',
        requested: 0,
        submitted: 0,
        cache_hits: 0,
        skipped: 0,
      },
      elapsed_ms: performance.now() - t0,
    };
  }

  const prepared = toVerify.map(prepareCitation);
  const citeLawEligible = prepared.filter(
    (citation) => citation.isValid && citation.reporter,
  );
  const [courtListenerResults, citeLawResult] = await Promise.all([
    // Stagger 100ms apart to be polite to CourtListener.
    Promise.all(
      prepared.map(async (citation, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 100));
        if (!citation.isValid) {
          return { status: 'unverified' as const };
        }
        return verifyOne(citation.text, courtListenerApiKey).catch(
          () => ({ status: 'unavailable' as const }),
        );
      }),
    ),
    verifyCitationsWithCiteLaw(citeLawEligible, citeLawApiKey),
  ]);

  const verifications: CitationVerification[] = prepared.map((citation, index) => {
    if (!citation.isValid) {
      return {
        text: citation.text,
        type: citation.type,
        is_valid_format: false,
        status: 'unverified',
        courtlistener_status: 'unverified',
      };
    }
    const combined = applyCiteLawIdentityGate(
      courtListenerResults[index],
      citeLawResult.byIndex.get(index),
    );
    return {
      text: citation.text,
      type: citation.type,
      is_valid_format: true,
      ...combined,
    };
  });

  return {
    citations: verifications,
    total_found: verifications.length,
    verified: verifications.filter((v) => v.status === 'verified').length,
    unconfirmed: verifications.filter((v) => v.status === 'unconfirmed').length,
    unverified: verifications.filter((v) => v.status === 'unverified').length,
    not_found: verifications.filter((v) => v.status === 'not_found').length,
    unavailable: verifications.filter((v) => v.status === 'unavailable').length,
    citelaw: citeLawResult.summary,
    elapsed_ms: performance.now() - t0,
  };
}

export const CITATION_VERIFY_TOOL_DEFINITION = {
  name: 'citation_verify',
  description:
    "Verify legal case citations with a structured CiteLaw identity check (reporter citation + case title + year) and CourtListener evidence. Pass either a passage of text (citations are extracted automatically) or an explicit list. Per-citation status: 'verified' (positive provider evidence and no CiteLaw identity conflict), 'unconfirmed' (near-match, title/year conflict, or candidates without sufficient identity confirmation — treat as UNRELIABLE and verify manually), 'not_found' (both configured sources missed a well-formed cite; still not standalone proof of fabrication), 'unverified' (malformed), 'unavailable' (providers errored/rate-limited; NEVER treat as evidence the case is fake). The nested citelaw field preserves confirmed / possible_match / no_match evidence and the batch-level citelaw field reports credits charged. Use before finalizing any drafted output containing case citations. Do not assert a case exists unless status is 'verified'.",
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description:
          'Text containing citations to extract and verify (e.g., a draft passage). Citations are auto-extracted by reporter patterns.',
      },
      citations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional explicit list of citations to verify directly.',
      },
    },
  },
} as const;
