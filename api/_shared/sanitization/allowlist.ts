/**
 * Public-Legal Entity Allowlist
 *
 * Spans matching these patterns are *never* tokenized, even if they look
 * like a name to the detector. Covers:
 *   • California statute and case citations.
 *   • California courts and public officials by office.
 *   • Major California state agencies.
 *   • CEB source titles (partial — expanded over time).
 *
 * Anything *not* here that looks like a name or personal identifier falls
 * through to tokenization. Missing an entry here means an over-eager
 * tokenization of a public figure's name (false positive — cheap to fix);
 * the opposite direction would leak a client name (false negative — not ok).
 */

export interface AllowlistMatch {
  start: number;
  end: number;
  raw: string;
  kind: 'case' | 'statute' | 'court' | 'agency' | 'ceb' | 'public_official';
}

// ---------------------------------------------------------------------------
// Citation patterns
// ---------------------------------------------------------------------------

const CASE_PATTERNS: RegExp[] = [
  // People v. Smith (2020) 50 Cal.App.5th 123
  /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z&.]+)*\s+v\.\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z&.]+)*(?:\s*\(\d{4}\))?(?:\s+\d+\s+[A-Z][a-z.]*\.?(?:\s*[A-Z][a-z.]*\.?)*\s*\d+[a-z]{2}?\s*\d+)?/g,
  // In re Marriage of Clarke
  /\bIn\s+re\s+(?:Marriage\s+of\s+)?[A-Z][a-zA-Z]+(?:\s+(?:and|&)\s+[A-Z][a-zA-Z]+)?/g,
  // Estate of X
  /\bEstate\s+of\s+[A-Z][a-zA-Z]+/g,
];

const STATUTE_PATTERNS: RegExp[] = [
  // Family Code § 1615, Probate Code section 859
  /\b(?:Family|Probate|Civil|Penal|Government|Corporations|Evidence|Labor|Business and Professions|Welfare and Institutions|Code of Civil Procedure|Elections|Fish and Game|Food and Agricultural|Revenue and Taxation|Streets and Highways|Vehicle|Water|Public Utilities|Public Resources|Health and Safety|Education|Insurance|Harbor and Navigation)\s+Code\s*(?:§+|sec(?:tion)?\.?)\s*\d+(?:\.\d+)?(?:\([a-z0-9]+\))?/gi,
  // Short abbreviations: CCP § 2030.300, Bus. & Prof. § 17200
  /\b(?:CCP|CCR|C\.?C\.?P\.?|Bus\.?\s*&\s*Prof\.?|Welf\.?\s*&\s*Inst\.?|Fam\.?|Prob\.?|Pen\.?|Gov\.?|Corp\.?|Evid\.?)\s*(?:§+|sec(?:tion)?\.?)\s*\d+(?:\.\d+)?/gi,
  // Federal citations: 42 U.S.C. § 1983
  /\b\d+\s+U\.?\s*S\.?\s*C\.?\s*§?\s*\d+[a-z]?/gi,
];

// ---------------------------------------------------------------------------
// Named public institutions / offices
// ---------------------------------------------------------------------------

const COURTS: string[] = [
  'California Supreme Court',
  'Supreme Court of California',
  'California Court of Appeal',
  'California Courts of Appeal',
  'Superior Court of California',
  'Ninth Circuit',
  'United States Supreme Court',
  'U.S. Supreme Court',
  'Supreme Court',
];

const AGENCIES: string[] = [
  'California Attorney General',
  'Attorney General',
  'California Secretary of State',
  'Secretary of State',
  'Franchise Tax Board',
  'FTB',
  'California Department of Tax and Fee Administration',
  'CDTFA',
  'Department of Motor Vehicles',
  'DMV',
  'California Department of Fair Employment and Housing',
  'DFEH',
  'California Civil Rights Department',
  'CRD',
  'State Bar of California',
  'California State Bar',
  'California Bar',
  'California Public Utilities Commission',
  'CPUC',
  'California Air Resources Board',
  'CARB',
  'Employment Development Department',
  'EDD',
  'California Department of Health Care Services',
  'DHCS',
  'California Legislature',
  'California State Senate',
  'California Assembly',
  'State Assembly',
  'California State Assembly',
  'California State Treasurer',
  'California State Controller',
  'California State Auditor',
  'Governor of California',
  'Governor Newsom',
  'Governor Gavin Newsom',
];

const CEB_SOURCES: string[] = [
  'California Business Law Reporter',
  'Estate Planning And California Probate Reporter',
  'Practice Under The California Family Code',
  'California Marital Settlement And Other Family Law Agreements',
  'California Civil Discovery Practice',
  'California Trust Administration',
  'California Will Drafting',
  'California Elder Law',
];

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scanExactPhrases(text: string, phrases: readonly string[], kind: AllowlistMatch['kind']): AllowlistMatch[] {
  const out: AllowlistMatch[] = [];
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      out.push({
        start: idx,
        end: idx + phrase.length,
        raw: text.slice(idx, idx + phrase.length),
        kind,
      });
      idx += phrase.length;
    }
  }
  return out;
}

function scanPatterns(
  text: string,
  patterns: readonly RegExp[],
  kind: AllowlistMatch['kind']
): AllowlistMatch[] {
  const out: AllowlistMatch[] = [];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        raw: m[0],
        kind,
      });
    }
  }
  return out;
}

/**
 * Scan the text for every allowlist match. Spans may overlap; the analyzer
 * merges them. Returns all hits in sorted order.
 */
export function findAllowlistMatches(text: string): AllowlistMatch[] {
  const hits: AllowlistMatch[] = [
    ...scanPatterns(text, CASE_PATTERNS, 'case'),
    ...scanPatterns(text, STATUTE_PATTERNS, 'statute'),
    ...scanExactPhrases(text, COURTS, 'court'),
    ...scanExactPhrases(text, AGENCIES, 'agency'),
    ...scanExactPhrases(text, CEB_SOURCES, 'ceb'),
  ];
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

/**
 * Returns true if any part of `[start, end)` overlaps an allowlist match.
 * The analyzer uses this to suppress tokenization over public-legal spans.
 */
export function overlapsAllowlist(
  start: number,
  end: number,
  allowlistMatches: readonly AllowlistMatch[]
): boolean {
  for (const a of allowlistMatches) {
    if (start < a.end && end > a.start) return true;
  }
  return false;
}
