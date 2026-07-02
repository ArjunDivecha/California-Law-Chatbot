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

export interface CaCodeLookupResult {
  hits: CaCodeLookupHit[];
  total_count: number;
}

export async function californiaCodeLookup(
  input: CaCodeLookupInput,
): Promise<CaCodeLookupResult> {
  const text = input.text?.trim();
  if (!text) throw new Error('californiaCodeLookup: text is required');

  const parsed = parseCodeCitation(text);
  const hits: CaCodeLookupHit[] = parsed.map((p) => ({
    code_full_name: getCodeFullName(p.lawCode) ?? p.lawCode,
    code_abbrev: p.lawCode,
    section: p.section,
    url: p.url || buildLeginfoUrl(p.lawCode, p.section),
    raw_match: p.fullText ?? '',
  }));
  return {
    hits,
    total_count: hits.length,
  };
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
