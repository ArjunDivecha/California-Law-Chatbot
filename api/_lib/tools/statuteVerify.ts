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
   * 'not_found'  — source reachable, section does not exist (likely fabricated).
   * 'unavailable'— source unreachable / errored (cannot conclude; ambiguous).
   * 'unparseable'— input did not contain a recognizable statutory citation.
   */
  outcome: 'verified' | 'not_found' | 'unavailable' | 'unparseable';
  error?: string;
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
 */
async function verifyCfr(p: ParsedStatute): Promise<StatuteVerifyResult> {
  const displayUrl = `https://www.ecfr.gov/current/title-${p.code}/section-${p.section}`;
  const api = `https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(`"${p.section}"`)}&per_page=20&order=relevance`;
  try {
    const { status, body } = await fetchText(api, 'application/json');
    if (status !== 200) {
      return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'unavailable', error: `HTTP ${status}` };
    }
    const data = JSON.parse(body) as { results?: Array<{ hierarchy?: { title?: string; section?: string }; full_text_excerpt?: string }> };
    const hit = (data.results ?? []).find(
      (r) => String(r.hierarchy?.title) === String(p.code) && String(r.hierarchy?.section) === String(p.section)
    );
    if (!hit) {
      return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'not_found' };
    }
    return { parsed: p, exists: true, statute_text: hit.full_text_excerpt ? clip(hit.full_text_excerpt) : null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'verified' };
  } catch (err) {
    return { parsed: p, exists: false, statute_text: null, source: 'ecfr.gov (official)', url: displayUrl, outcome: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify a single statutory citation. Parses the jurisdiction, fetches the
 * authoritative source, and returns existence + text for content matching.
 */
export async function statuteVerify(input: StatuteVerifyInput): Promise<StatuteVerifyResult> {
  const text = input?.text?.trim();
  if (!text) throw new Error('statuteVerify: text is required');

  const parsed = parseStatuteCitation(text);
  if (!parsed) {
    return { parsed: null, exists: false, statute_text: null, source: null, url: null, outcome: 'unparseable' };
  }
  switch (parsed.jurisdiction) {
    case 'CA': return verifyCalifornia(parsed);
    case 'USC': return verifyUsc(parsed);
    case 'CFR': return verifyCfr(parsed);
    default: return { parsed, exists: false, statute_text: null, source: null, url: parsed.url, outcome: 'unparseable' };
  }
}

export const STATUTE_VERIFY_TOOL_DEFINITION = {
  name: 'statute_verify',
  description:
    "Verify a STATUTORY citation (a code section, NOT a court case) against the authoritative primary source. Covers California codes (leginfo.legislature.ca.gov), federal U.S. Code (Cornell LII), and the Code of Federal Regulations (official eCFR.gov API). Returns whether the section actually exists plus its real statutory text so you can compare what a brief CLAIMS the statute says to the actual language. Use this for cites like 'Penal Code § 187', '42 U.S.C. § 1983', or '21 C.F.R. § 101.9' — NOT for case citations like 'People v. Anderson'. outcome='not_found' means the section does not exist (likely fabricated); 'unavailable' means the source could not be reached (inconclusive).",
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
