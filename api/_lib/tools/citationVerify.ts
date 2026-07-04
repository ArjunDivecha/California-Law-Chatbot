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
  courtlistener_match?: {
    cluster_id: string;
    url: string;
    case_name: string;
    court?: string;
    date_filed?: string;
  };
  /** Top search hit when status='unconfirmed' — a lead, not a match. */
  possible_match?: CitationVerification['courtlistener_match'];
}

export interface CitationVerifyResult {
  citations: CitationVerification[];
  total_found: number;
  verified: number;
  unconfirmed: number;
  unverified: number;
  not_found: number;
  unavailable: number;
  elapsed_ms: number;
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
// A reporter cite: 1+ digits + space + (Cal[.App][.Xd|th] | F[.Supp][.Xd] | U.S.) + space + 1+ digits.
// Note we explicitly enumerate the period-bearing forms instead of using
// a generic [^,;.\n]+ — that earlier pattern choked on multi-period
// reporters like "Cal.App.5th".
const REPORTER = String.raw`\d+\s+(?:Cal\.?\s*Rptr\.?\s*(?:2d|3d)?|Cal\.?\s*(?:App\.?)?\s*(?:2d|3d|4th|5th)?|F\.?\s*(?:Supp\.?)?\s*(?:2d|3d)?|P\.?\s*(?:2d|3d)|U\.?S\.?|S\.?\s*Ct\.?)\s+\d+`;

export function extractCitations(text: string): Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> = [];

  // FIRST pass: full case-name+reporter ("Williams v. Superior Court (2017) 3 Cal.5th 531").
  // Capture these BEFORE the bare-reporter pass so their sub-reporter parts
  // can be deduped against the full form in the next pass.
  const fullPattern = new RegExp(
    String.raw`(${PARTY_NAME}\s+v\.?\s+${PARTY_NAME})` +
      String.raw`\s*(?:\((\d{4})\))?\s*,?\s*(${REPORTER})`,
    'gi',
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
 * worse (false-positive matches to same-named different cases). The
 * right fix is the Phase 3 path: replace this verifier with Solve
 * Intelligence MCP (per plan §Phase 3 branched-path note). Until then,
 * `not_found` should be interpreted as "this verifier could not
 * confirm" rather than "this case does not exist."
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
      unconfirmed: 0,
      unverified: 0,
      not_found: 0,
      unavailable: 0,
      elapsed_ms: performance.now() - t0,
    };
  }

  // Stagger 100ms apart to be polite to CourtListener.
  const verifications: CitationVerification[] = await Promise.all(
    toVerify.map(async (c, i) => {
      await new Promise((r) => setTimeout(r, i * 100));
      const isValid = isValidCitationFormat(c.text);
      if (!isValid) {
        return { text: c.text, type: c.type, is_valid_format: false, status: 'unverified' as const };
      }
      const verdict = await verifyOne(c.text, apiKey).catch(
        () => ({ status: 'unavailable' as const }),
      );
      return {
        text: c.text,
        type: c.type,
        is_valid_format: true,
        ...verdict,
      };
    }),
  );

  return {
    citations: verifications,
    total_found: verifications.length,
    verified: verifications.filter((v) => v.status === 'verified').length,
    unconfirmed: verifications.filter((v) => v.status === 'unconfirmed').length,
    unverified: verifications.filter((v) => v.status === 'unverified').length,
    not_found: verifications.filter((v) => v.status === 'not_found').length,
    unavailable: verifications.filter((v) => v.status === 'unavailable').length,
    elapsed_ms: performance.now() - t0,
  };
}

export const CITATION_VERIFY_TOOL_DEFINITION = {
  name: 'citation_verify',
  description:
    "Verify legal citations against CourtListener. Pass either a passage of text (citations are extracted automatically) or an explicit list of citations. Per-citation status: 'verified' (a CourtListener opinion's own citation list bears this exact volume/reporter/page — safe to cite), 'unconfirmed' (candidates found but the exact cite could not be confirmed — treat as UNRELIABLE: do not present it as verified, and do not claim it is fabricated), 'not_found' (well-formed but zero hits — likely fabricated), 'unverified' (malformed), 'unavailable' (verifier errored/rate-limited — verification did not run; NEVER treat as evidence the case is fake). Use this tool before finalizing any drafted output containing case citations. Do not assert a case exists unless status is 'verified'.",
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
