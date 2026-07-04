/**
 * =============================================================================
 * statute_verify — agent-loop tool that VERIFIES statutory citations against
 * the authoritative primary source for each jurisdiction.
 * =============================================================================
 *
 * WHAT THIS DOES (plain English):
 * A "statutory citation" points to a section of a code enacted by a
 * legislature (e.g. "Penal Code § 187", "42 U.S.C. § 1983", "21 C.F.R.
 * § 101.9"). This is DIFFERENT from a "case citation," which points to a
 * court decision (e.g. "People v. Anderson (1972) 6 Cal.3d 628") and is
 * verified separately against CourtListener.
 *
 * AI models hallucinate statute section numbers just like they invent
 * cases. This tool catches that by actually FETCHING the section from the
 * official source and confirming (a) the section exists and (b) returning
 * its real text so the verifier model can compare it to what a brief
 * CLAIMS the statute says (content match).
 *
 * Jurisdictions covered:
 *   - California codes (all 29) → leginfo.legislature.ca.gov (official)
 *   - Federal U.S. Code        → law.cornell.edu/uscode (LII mirror of OLRC;
 *                                clean 200/404 existence signal + full text)
 *   - Code of Federal Regs     → ecfr.gov official JSON API
 *
 * Real-vs-fake signals (probed 2026-06-12):
 *   - leginfo: a real section's server-rendered HTML contains
 *     <p style="margin..."> statutory paragraphs; a nonexistent section
 *     returns the page shell with zero such paragraphs.
 *   - Cornell USC: real section → HTTP 200 with body text; fake → HTTP 404.
 *   - eCFR: the search API returns a result whose hierarchy.section exactly
 *     equals the queried section; a fabricated section returns no match.
 *
 * NETWORK I/O ONLY — no local files read or written. All fetches are GET
 * requests to the public sources above.
 *
 * INPUT FILES:  none.
 * OUTPUT FILES: none.
 *
 * Used by:
 *   - api/_lib/verifierSubAgent.ts  (statute branch of the citation verifier)
 *   - api/agent/verify-stream.ts    (extractStatuteCitations for the manifest)
 * =============================================================================
 */

import {
  parseCodeCitation,
  buildLeginfoUrl,
  getCodeFullName,
} from '../../../utils/californiaCodeLookup.js';

const FETCH_TIMEOUT_MS = 15000;
/** Cap statute text returned to the model so content-match stays cheap. */
const MAX_STATUTE_TEXT = 4000;

export type StatuteJurisdiction = 'CA' | 'USC' | 'CFR';

export interface ParsedStatute {
  jurisdiction: StatuteJurisdiction;
  /** CA: law code (e.g. "PEN"). USC/CFR: title number (e.g. "42", "21"). */
  code: string;
  /** Human-readable code/title name. */
  code_name: string;
  /** Section number as cited (e.g. "187", "1983", "101.9"). */
  section: string;
  /** Original matched citation text. */
  raw: string;
  /** Authoritative source URL for this section. */
  url: string;
}

export interface StatuteVerifyInput {
  /** Text containing exactly one statutory citation to verify. Required. */
  text: string;
}

export interface StatuteVerifyResult {
  parsed: ParsedStatute | null;
  /** True if the section was confirmed to exist at the official source. */
  exists: boolean;
  /** The actual statutory text fetched (truncated), for content matching. */
  statute_text: string | null;
  /** Which source answered. */
  source: string | null;
  url: string | null;
  /**
   * 'verified'   — section exists, text retrieved.
   * 'not_found'  — source reachable AND the search space was EXHAUSTED, yet the
   *                section does not exist (likely fabricated). Never emitted
   *                when the source may hold the section beyond what was scanned.
   * 'unconfirmed'— source reachable but existence could NOT be decided: e.g. an
   *                eCFR match may lie past the relevance-ranked results we
   *                scanned, or a Cornell page returned HTTP 200 without the
   *                expected section marker (repealed / omitted / redirect
   *                landing). Treat as inconclusive — NOT as fabricated.
   * 'unavailable'— source unreachable / errored (cannot conclude; ambiguous).
   * 'unparseable'— input did not contain a recognizable statutory citation.
   */
  outcome: 'verified' | 'not_found' | 'unconfirmed' | 'unavailable' | 'unparseable';
  error?: string;
  /**
   * Raw text of the single citation that was actually checked. When the input
   * contains more than one statutory citation, ONLY THE FIRST is verified — this
   * field names which one, so a caller never mistakes partial coverage for full.
   */
  checked_citation?: string;
  /** Count of additional citations present in the input that were NOT checked. */
  unchecked_citation_count?: number;
  /** Raw texts of those unchecked citations, for transparency. */
  unchecked_citations?: string[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Federal U.S. Code: "42 U.S.C. § 1983", "42 USC 1983", "42 U. S. C. 1983a". */
const USC_RE =
  /\b(\d{1,2})\s*U\.?\s?S\.?\s?C\.?(?:A\.?)?\s*(?:§+|sec(?:tion|\.)?|§)?\s*(\d+[A-Za-z]?(?:-\d+)?)/gi;

/** Code of Federal Regulations: "21 C.F.R. § 101.9", "29 CFR 1604.11". */
const CFR_RE =
  /\b(\d{1,2})\s*C\.?\s?F\.?\s?R\.?\s*(?:§+|sec(?:tion|\.)?|part|§)?\s*(\d+(?:\.\d+)?)/gi;

const USC_TITLE_NAMES: Record<string, string> = {
  '11': 'Bankruptcy', '15': 'Commerce and Trade', '17': 'Copyrights',
  '18': 'Crimes and Criminal Procedure', '26': 'Internal Revenue Code',
  '28': 'Judiciary and Judicial Procedure', '29': 'Labor',
  '42': 'The Public Health and Welfare',
};

/**
 * Extract every statutory citation (CA / USC / CFR) from free text.
 * CFR is matched before USC because a bare "29 CFR 1604" must not be
 * mis-read; the two abbreviations are distinct so ordering only affects
 * de-duplication of overlapping spans.
 */
export function extractStatuteCitations(text: string): ParsedStatute[] {
  if (!text || typeof text !== 'string') return [];
  const out: ParsedStatute[] = [];
  const seen = new Set<string>();

  // CFR
  for (const m of text.matchAll(CFR_RE)) {
    const title = m[1];
    const section = m[2];
    const key = `CFR:${title}:${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      jurisdiction: 'CFR',
      code: title,
      code_name: `Title ${title} C.F.R.`,
      section,
      raw: m[0].trim(),
      url: `https://www.ecfr.gov/current/title-${title}/section-${section}`,
    });
  }

  // USC
  for (const m of text.matchAll(USC_RE)) {
    const title = m[1];
    const section = m[2];
    const key = `USC:${title}:${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      jurisdiction: 'USC',
      code: title,
      code_name: USC_TITLE_NAMES[title]
        ? `Title ${title} U.S.C. — ${USC_TITLE_NAMES[title]}`
        : `Title ${title} U.S.C.`,
      section,
      raw: m[0].trim(),
      url: `https://www.law.cornell.edu/uscode/text/${title}/${section}`,
    });
  }

  // California
  for (const p of parseCodeCitation(text)) {
    const key = `CA:${p.lawCode}:${p.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      jurisdiction: 'CA',
      code: p.lawCode,
      code_name: getCodeFullName(p.lawCode) ?? p.fullName ?? p.lawCode,
      section: p.section,
      raw: p.fullText,
      url: p.url || buildLeginfoUrl(p.lawCode, p.section),
    });
  }

  return out;
}

/** Parse the FIRST statutory citation found, or null. */
export function parseStatuteCitation(text: string): ParsedStatute | null {
  return extractStatuteCitations(text)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchText(url: string, accept = 'text/html'): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: accept,
        // A descriptive UA — some gov sites reject empty/unknown agents.
        'User-Agent': 'FFLP-CitationVerifier/1.0 (legal citation verification)',
      },
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function clip(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > MAX_STATUTE_TEXT ? `${t.slice(0, MAX_STATUTE_TEXT)}…` : t;
}

/**
 * California — leginfo. A real section's HTML carries the statutory text in
 * <p style="margin..."> paragraphs following an <h6><b>{section}.</b></h6>
 * header. Zero such paragraphs ⇒ the section does not exist.
 */
async function verifyCalifornia(p: ParsedStatute): Promise<StatuteVerifyResult> {
  const url = buildLeginfoUrl(p.code, p.section);
  try {
    const { status, body } = await fetchText(url);
    if (status >= 500) {
      return { parsed: p, exists: false, statute_text: null, source: 'leginfo.legislature.ca.gov', url, outcome: 'unavailable', error: `HTTP ${status}` };
    }
    // Pull the statutory paragraphs out of the rendered section.
    const paras = Array.from(
      body.matchAll(/<p[^>]*style="margin[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
    ).map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim())
     .filter((t) => t.length > 0);
    if (paras.length === 0) {
      return { parsed: p, exists: false, statute_text: null, source: 'leginfo.legislature.ca.gov', url, outcome: 'not_found' };
    }
    return { parsed: p, exists: true, statute_text: clip(paras.join('\n')), source: 'leginfo.legislature.ca.gov', url, outcome: 'verified' };
  } catch (err) {
    return { parsed: p, exists: false, statute_text: null, source: 'leginfo.legislature.ca.gov', url, outcome: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Federal U.S.C. via Cornell LII — a respected full-text mirror of the
 * Office of Law Revision Counsel's official code. Real section → HTTP 200
 * with the statute body; fabricated section → HTTP 404.
 *
 * A bare HTTP 200 is NOT sufficient to call a section 'verified': repealed,
 * omitted, or redirected sections also land on a 200 page that lacks the
 * statute body. We require the expected section marker ("§ {section}") to
 * actually appear in the page text; otherwise the result is 'unconfirmed'
 * (inconclusive), never 'verified'.
 */
async function verifyUsc(p: ParsedStatute): Promise<StatuteVerifyResult> {
  const url = `https://www.law.cornell.edu/uscode/text/${p.code}/${p.section}`;
  try {
    const { status, body } = await fetchText(url);
    if (status === 404) {
      return { parsed: p, exists: false, statute_text: null, source: 'law.cornell.edu/uscode (LII)', url, outcome: 'not_found' };
    }
    if (status !== 200) {
      return { parsed: p, exists: false, statute_text: null, source: 'law.cornell.edu/uscode (LII)', url, outcome: 'unavailable', error: `HTTP ${status}` };
    }
    // Extract the statute body from the main content region.
    const m = body.match(/<div[^>]*class="[^"]*tab-pane[^"]*"[^>]*id="tab_default_1"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
      || body.match(/<div[^>]*id="field-body-content"[^>]*>([\s\S]*?)<\/div>/i);
    const text = m ? clip(m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')) : null;
    // Confirm the queried section marker is actually present on the page.
    const secEsc = p.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const markerFound = new RegExp(`§\\s*(?:&nbsp;)?\\s*${secEsc}\\b`, 'i').test(body);
    if (!markerFound) {
      return {
        parsed: p, exists: false, statute_text: text, source: 'law.cornell.edu/uscode (LII)', url,
        outcome: 'unconfirmed',
        error: `HTTP 200 but the expected section marker "§ ${p.section}" was not found in the page — the section may be repealed, omitted, or the request redirected to a landing page. Existence could not be confirmed.`,
      };
    }
    return { parsed: p, exists: true, statute_text: text, source: 'law.cornell.edu/uscode (LII)', url, outcome: 'verified' };
  } catch (err) {
    return { parsed: p, exists: false, statute_text: null, source: 'law.cornell.edu/uscode (LII)', url, outcome: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * CFR via the official eCFR.gov JSON API. The search endpoint returns
 * structured results; we accept the citation as real only when a result's
 * hierarchy.title and hierarchy.section EXACTLY match the cited title and
 * section (guards against a fuzzy text hit on an unrelated section).
 *
 * Existence is decided over a RELEVANCE-RANKED page (per_page=20). A real
 * regulation ranked beyond position 20 would otherwise read as 'not_found'
 * (= likely fabricated). To avoid that, 'not_found' is emitted ONLY when the
 * search space was exhausted (total_count ≤ what we scanned). When the API
 * reports more matches than we scanned — or does not report a total at all —
 * a miss is 'unconfirmed' (inconclusive), never 'not_found'.
 */
async function verifyCfr(p: ParsedStatute): Promise<StatuteVerifyResult> {
  const displayUrl = `https://www.ecfr.gov/current/title-${p.code}/section-${p.section}`;
  const SCANNED = 20;
  const api = `https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(`"${p.section}"`)}&per_page=${SCANNED}&order=relevance`;
  try {
    const { status, body } = await fetchText(api, 'application/json');
    if (status !== 200) {
      return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'unavailable', error: `HTTP ${status}` };
    }
    const data = JSON.parse(body) as {
      results?: Array<{ hierarchy?: { title?: string; section?: string }; full_text_excerpt?: string }>;
      meta?: { total_count?: number };
    };
    const results = data.results ?? [];
    const hit = results.find(
      (r) => String(r.hierarchy?.title) === String(p.code) && String(r.hierarchy?.section) === String(p.section)
    );
    if (hit) {
      return { parsed: p, exists: true, statute_text: hit.full_text_excerpt ? clip(hit.full_text_excerpt) : null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'verified' };
    }
    // No match among the results we scanned. Only conclude "does not exist"
    // if the search space was actually exhausted.
    const total = data.meta?.total_count;
    const exhausted = typeof total === 'number' && total <= results.length;
    if (exhausted) {
      return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'not_found' };
    }
    return {
      parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl,
      outcome: 'unconfirmed',
      error: `No exact hierarchy match among the top ${results.length} relevance-ranked results${
        typeof total === 'number' ? ` (of ${total} total)` : ' (total match count not reported by the API)'
      }; a matching section may lie beyond the scanned results. Existence could not be confirmed.`,
    };
  } catch (err) {
    return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify a statutory citation. Parses the jurisdiction, fetches the
 * authoritative source, and returns existence + text for content matching.
 *
 * IMPORTANT — SINGLE-CITATION COVERAGE: if the input text contains MORE THAN
 * ONE statutory citation, ONLY THE FIRST is verified. The returned result
 * always reports `checked_citation` (which one was checked) and, when
 * applicable, `unchecked_citation_count` / `unchecked_citations` so callers
 * never read a first-citation result as if it covered the whole input.
 */
export async function statuteVerify(input: StatuteVerifyInput): Promise<StatuteVerifyResult> {
  const text = input?.text?.trim();
  if (!text) throw new Error('statuteVerify: text is required');

  const all = extractStatuteCitations(text);
  const parsed = all[0] ?? null;
  if (!parsed) {
    return { parsed: null, exists: false, statute_text: null, source: null, url: null, outcome: 'unparseable' };
  }

  let result: StatuteVerifyResult;
  switch (parsed.jurisdiction) {
    case 'CA': result = await verifyCalifornia(parsed); break;
    case 'USC': result = await verifyUsc(parsed); break;
    case 'CFR': result = await verifyCfr(parsed); break;
    default: result = { parsed, exists: false, statute_text: null, source: null, url: parsed.url, outcome: 'unparseable' };
  }

  // Report exactly what was checked, and flag any citations left unchecked.
  result.checked_citation = parsed.raw;
  const others = all.slice(1);
  if (others.length > 0) {
    result.unchecked_citation_count = others.length;
    result.unchecked_citations = others.map((o) => o.raw);
  }
  return result;
}

export const STATUTE_VERIFY_TOOL_DEFINITION = {
  name: 'statute_verify',
  description:
    "Verify a STATUTORY citation (a code section, NOT a court case) against the authoritative primary source. Covers California codes (leginfo.legislature.ca.gov), federal U.S. Code (Cornell LII), and the Code of Federal Regulations (official eCFR.gov API). Returns whether the section actually exists plus its real statutory text so you can compare what a brief CLAIMS the statute says to the actual language. If the input contains more than one citation, ONLY THE FIRST is checked — see checked_citation / unchecked_citations. Use this for cites like 'Penal Code § 187', '42 U.S.C. § 1983', or '21 C.F.R. § 101.9' — NOT for case citations like 'People v. Anderson'. outcome='not_found' means the section does not exist AND the search space was exhausted (likely fabricated); 'unconfirmed' means existence could NOT be decided (a match may lie beyond scanned results, or a 200 page lacked the section marker) — treat as inconclusive, NOT as fabricated; 'unavailable' means the source could not be reached (inconclusive).",
  input_schema: {
    type: 'object' as const,
    properties: {
      text: {
        type: 'string',
        description: 'Text containing exactly one statutory citation to verify.',
      },
    },
    required: ['text'],
  },
};
