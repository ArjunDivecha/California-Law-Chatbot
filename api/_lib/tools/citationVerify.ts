/**
 * In-process citation verification tool for the V2 agent loop. Extracts
 * case citations from a passage of text and verifies each against
 * CourtListener's REST v4 /search/ endpoint. Mirrors V1's
 * api/verify-citations.ts but called directly from the dispatcher.
 *
 * The model uses this tool BEFORE finalizing any drafting output that
 * contains citations — per the drafting Skills, every cited case must be
 * retrievable here or it must not appear in the draft.
 *
 * Per 5th-addendum Phase 3 plan: this is a candidate for replacement by
 * Solve Intelligence MCP later. For now the V1 verifier covers the same
 * ground.
 */

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
  status: 'verified' | 'unverified' | 'not_found';
  courtlistener_match?: {
    cluster_id: string;
    url: string;
    case_name: string;
    court?: string;
    date_filed?: string;
  };
}

export interface CitationVerifyResult {
  citations: CitationVerification[];
  total_found: number;
  verified: number;
  unverified: number;
  not_found: number;
  elapsed_ms: number;
}

// California + federal reporter patterns — same as V1.
const CASE_CITATION_PATTERNS: RegExp[] = [
  /(\d+)\s+(Cal\.?\s*(?:App\.?)?\s*(?:2d|3d|4th|5th)?)\s+(\d+)/gi,
  /(\d+)\s+(F\.?\s*(?:Supp\.?)?\s*(?:2d|3d)?)\s+(\d+)/gi,
  /(\d+)\s+(U\.?S\.?)\s+(\d+)/gi,
  /(\d{4})\s+(WL|Cal\.?\s*(?:App\.?)?\s*LEXIS)\s+(\d+)/gi,
];

export function extractCitations(text: string): Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> = [];

  // FIRST pass: full case-name+reporter ("Williams v. Superior Court (2017) 3 Cal.5th 531").
  // Capture these BEFORE the bare-reporter pass so their sub-reporter parts
  // can be deduped against the full form in the next pass.
  const fullPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\((\d{4})\))?\s*,?\s*(\d+\s+(?:Cal|F|U\.?S)\.?[^,;.\n]+\d+)/gi;
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

function isValidCitationFormat(c: string): boolean {
  return /\d+/.test(c) && /Cal|F\.|U\.?S\.|WL|LEXIS/i.test(c);
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
  const resp = await fetch(url, { headers });
  if (!resp.ok) return [];
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
 * worse (false-positive matches to same-named different cases). The
 * right fix is the Phase 3 path: replace this verifier with Solve
 * Intelligence MCP (per plan §Phase 3 branched-path note). Until then,
 * `not_found` should be interpreted as "this verifier could not
 * confirm" rather than "this case does not exist."
 */
async function verifyOne(
  citation: string,
  apiKey: string | undefined,
): Promise<CitationVerification['courtlistener_match'] | null> {
  const hits = await clSearch(citation, apiKey);
  if (hits.length === 0) return null;
  return hitToMatch(hits[0]);
}

export async function citationVerify(input: CitationVerifyInput): Promise<CitationVerifyResult> {
  const t0 = performance.now();
  const apiKey = process.env.COURTLISTENER_API_KEY;

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
      unverified: 0,
      not_found: 0,
      elapsed_ms: performance.now() - t0,
    };
  }

  // Stagger 100ms apart to be polite to CourtListener.
  const verifications: CitationVerification[] = await Promise.all(
    toVerify.map(async (c, i) => {
      await new Promise((r) => setTimeout(r, i * 100));
      const isValid = isValidCitationFormat(c.text);
      if (!isValid) {
        return { text: c.text, type: c.type, is_valid_format: false, status: 'unverified' };
      }
      const match = await verifyOne(c.text, apiKey).catch(() => null);
      return {
        text: c.text,
        type: c.type,
        is_valid_format: true,
        courtlistener_match: match ?? undefined,
        status: match ? 'verified' : 'not_found',
      };
    }),
  );

  return {
    citations: verifications,
    total_found: verifications.length,
    verified: verifications.filter((v) => v.status === 'verified').length,
    unverified: verifications.filter((v) => v.status === 'unverified').length,
    not_found: verifications.filter((v) => v.status === 'not_found').length,
    elapsed_ms: performance.now() - t0,
  };
}

export const CITATION_VERIFY_TOOL_DEFINITION = {
  name: 'citation_verify',
  description:
    "Verify legal citations against CourtListener. Pass either a passage of text (citations are extracted automatically) or an explicit list of citations. Returns per-citation status: 'verified' (found on CourtListener), 'not_found' (well-formed but no match), or 'unverified' (malformed). Use this tool before finalizing any drafted document that contains case citations. Do not assert a case exists unless this tool returns 'verified'.",
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
