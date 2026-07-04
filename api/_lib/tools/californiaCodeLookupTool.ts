/**
 * California code lookup — in-process agent-loop tool wrapping
 * utils/californiaCodeLookup.ts (V1 utility, unchanged).
 *
 * Takes a free-text query that mentions a California statutory cite
 * (e.g., "Family Code section 4337" or "Code Civ. Proc. § 2030.300")
 * and returns the parsed code/section + a leginfo URL for each match.
 *
 * Pure local parsing — no network call, no rate limits. The leginfo URL
 * is deterministic from the parsed code+section.
 */

import {
  parseCodeCitation,
  buildLeginfoUrl,
  getCodeFullName,
  CALIFORNIA_CODES,
} from '../../../utils/californiaCodeLookup.js';

export interface CaCodeLookupInput {
  /** Text containing one or more CA-statute references. Required. */
  text: string;
}

export interface CaCodeLookupHit {
  code_full_name: string;
  code_abbrev: string;
  section: string;
  url: string;
  raw_match: string;
}

/**
 * NOTE (contract): `error` / `ambiguous` are populated when a code-name token in
 * the input cannot be resolved to a SINGLE California code under strict matching
 * (exact canonical name or exact abbreviation). The underlying V1 parser resolves
 * ambiguous abbreviations (e.g. "Pub.") by bidirectional substring match — the
 * first code it iterates past wins, silently guessing. This tool re-checks each
 * match strictly and, on ambiguity, refuses to guess: it drops the ambiguous hit
 * and reports the candidates so the caller can disambiguate. Unambiguous hits are
 * still returned.
 */
export interface CaCodeLookupResult {
  hits: CaCodeLookupHit[];
  total_count: number;
  /** Human-readable summary when one or more tokens were ambiguous. */
  error?: string;
  /** Per-token ambiguity detail: the raw token and the candidate code names. */
  ambiguous?: Array<{ token: string; candidates: string[] }>;
}

/** Normalize a code-name token for strict comparison. */
function normCode(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*code$/, '') // "family code" → "family"
    .trim();
}

/**
 * Strictly resolve a code-name token to the set of California law codes it
 * matches. A match requires EXACT equality (after normalization) against a
 * canonical full name or an explicit abbreviation — never substring
 * containment. Returns every matching lawCode; the caller treats size 0 as
 * "unresolved" and size > 1 as "ambiguous".
 */
function resolveCodeStrict(token: string): string[] {
  const n = normCode(token);
  if (!n) return [];
  const matches: string[] = [];
  for (const [lawCode, info] of Object.entries(CALIFORNIA_CODES)) {
    const names = new Set<string>([normCode(info.fullName), lawCode.toLowerCase()]);
    for (const abbr of info.abbreviations) names.add(normCode(abbr));
    if (names.has(n)) matches.push(lawCode);
  }
  return matches;
}

/**
 * Isolate the code-name portion of a raw citation match (everything before the
 * section number / § / "section" keyword). E.g. "Public Resources Code § 5093"
 * → "Public Resources Code"; "PROB § 6111" → "PROB".
 */
function codeTokenFromRaw(raw: string): string {
  return raw
    .replace(/\s*(?:§§?|[Ss]ec(?:tion|\.)?)\s*\d.*$/, '')
    .replace(/\s+\d.*$/, '')
    .replace(/^Cal(?:ifornia)?\.?\s+/i, '')
    .trim();
}

export async function californiaCodeLookup(
  input: CaCodeLookupInput,
): Promise<CaCodeLookupResult> {
  const text = input.text?.trim();
  if (!text) throw new Error('californiaCodeLookup: text is required');

  const parsed = parseCodeCitation(text);
  const hits: CaCodeLookupHit[] = [];
  const ambiguous: Array<{ token: string; candidates: string[] }> = [];

  for (const p of parsed) {
    const raw = p.fullText ?? '';
    const token = codeTokenFromRaw(raw);
    const strict = resolveCodeStrict(token);
    // strict.length === 0 → the token isn't in our strict maps; trust the V1
    // parser's resolution rather than drop a valid hit (conservative). Only
    // ADD ambiguity detection here — never remove otherwise-good matches.
    if (strict.length > 1) {
      ambiguous.push({
        token,
        candidates: strict.map((lc) => getCodeFullName(lc) ?? lc),
      });
      continue; // refuse to guess — omit this hit
    }
    const lawCode = strict.length === 1 ? strict[0] : p.lawCode;
    hits.push({
      code_full_name: getCodeFullName(lawCode) ?? lawCode,
      code_abbrev: lawCode,
      section: p.section,
      url: strict.length === 1 ? buildLeginfoUrl(lawCode, p.section) : p.url || buildLeginfoUrl(lawCode, p.section),
      raw_match: raw,
    });
  }

  const result: CaCodeLookupResult = { hits, total_count: hits.length };
  if (ambiguous.length > 0) {
    result.ambiguous = ambiguous;
    result.error = ambiguous
      .map((a) => `ambiguous code name "${a.token}", candidates: [${a.candidates.join(', ')}]`)
      .join('; ');
  }
  return result;
}

export const CALIFORNIA_CODE_LOOKUP_TOOL_DEFINITION = {
  name: 'california_code_lookup',
  description:
    "Parse California statute citations from a passage of text and return the official leginfo.legislature.ca.gov URL for each. Covers all 29 California Codes (Family, Probate, Civil, CCP, Penal, Government, Evidence, etc.). Use when the attorney mentions a CA statute by name or abbreviation and you want the authoritative source link. Pure parsing — no network call, no rate limits, very fast.",
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description:
          'Text containing one or more California-statute references — e.g., "Family Code section 4337", "Cal. Code Civ. Proc. § 2030.300", "Probate Code 6111".',
      },
    },
    required: ['text'],
  },
} as const;
