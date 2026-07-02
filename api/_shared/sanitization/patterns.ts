/**
 * Deterministic PII Patterns
 *
 * Regex-based detectors for the categories of private identifier that the
 * sanitizer recognizes without needing ML. Kept conservative — over-eager
 * tokenization is safe (one click to undo); under-eager leaks data.
 *
 * Each pattern is exported individually so tests can exercise them in
 * isolation, and together via ALL_PATTERNS for bulk scanning.
 *
 * The server-side backstop (utils/sanitizationGuard.ts) imports from here
 * so browser and server agree on the exact pattern set.
 */

export type PIICategory =
  | 'ssn'
  | 'tin'
  | 'phone'
  | 'email'
  | 'street_address'
  | 'zip'
  | 'date'
  | 'credit_card'
  | 'bank_account'
  | 'driver_license'
  | 'medical_record'
  | 'client_matter'
  | 'dollar_amount'
  | 'bar_number'
  | 'court_case';

export interface PIIPattern {
  category: PIICategory;
  regex: RegExp;
  /** Human-readable name for audit logs. Never logged with raw match. */
  label: string;
}

// ---------------------------------------------------------------------------
// Government identifiers
// ---------------------------------------------------------------------------

/** US Social Security Number. Hyphenated form is confident; bare 9-digit is too noisy — omit. */
export const SSN: PIIPattern = {
  category: 'ssn',
  label: 'Social Security Number',
  regex: /\b\d{3}-\d{2}-\d{4}\b/g,
};

/** Taxpayer ID (EIN/FEIN). NN-NNNNNNN. */
export const TIN: PIIPattern = {
  category: 'tin',
  label: 'Taxpayer Identification Number',
  regex: /\b\d{2}-\d{7}\b/g,
};

/** California driver license: one letter + seven digits. */
export const CA_DRIVER_LICENSE: PIIPattern = {
  category: 'driver_license',
  label: 'California Driver License',
  regex: /\b[A-Z]\d{7}\b/g,
};

// ---------------------------------------------------------------------------
// Contact identifiers
// ---------------------------------------------------------------------------

/** US phone numbers in several formats. Requires area code to limit noise. */
export const PHONE: PIIPattern = {
  category: 'phone',
  label: 'Phone Number',
  // +1 (415) 555-0123, (415) 555-0123, 415-555-0123, 415.555.0123, 415 555 0123
  regex: /(?<!\d)(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b(?!\d)/g,
};

/**
 * International phone numbers (non-US). Requires explicit + prefix with a
 * non-1 country code to disambiguate from US numbers (those use PHONE above).
 * Accepts space, dot, or hyphen separators between digit groups.
 */
export const INTERNATIONAL_PHONE: PIIPattern = {
  category: 'phone',
  label: 'International Phone Number',
  // +XX (1-3 digit country code, not 1) then 6-15 more digits with separators.
  regex: /(?<!\d)\+(?:[2-9]|[1-9]\d{1,2})(?:[\s.-]?\d){6,14}(?!\d)/g,
};

/** Email addresses. Reasonably standard pattern — not RFC-strict. */
export const EMAIL: PIIPattern = {
  category: 'email',
  label: 'Email Address',
  regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
};

// ---------------------------------------------------------------------------
// Addresses and locations
// ---------------------------------------------------------------------------

/** US street address: number + street-name words + street suffix. */
export const STREET_ADDRESS: PIIPattern = {
  category: 'street_address',
  label: 'Street Address',
  regex:
    /\b\d{1,6}\s+(?:[A-Z][a-z]+\.?\s+){1,5}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Parkway|Terr|Terrace|Cir|Circle|Hwy|Highway)\b\.?/g,
};

/**
 * US ZIP. Bare 5-digit sequences are too noisy — they collide with
 * statute section numbers (§ 15610, § 12345). So we require either:
 *   - a ZIP+4 form (`94115-2045`, unambiguous), or
 *   - a 5-digit number preceded by a 2-letter state abbreviation or the
 *     literal "ZIP".
 */
export const ZIP: PIIPattern = {
  category: 'zip',
  label: 'ZIP Code',
  // State-prefix branch is restricted to real US 2-letter state abbreviations
  // so "SF 94112" (city abbrev) doesn't get swallowed by the regex. The full
  // US-state list is duplicated here from detectNames.ts; keep both in sync.
  regex:
    /\b(?:ZIP\s+\d{5}(?:-\d{4})?|(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?|\d{5}-\d{4})\b/g,
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Numeric dates in M/D/YYYY, M-D-YY, and variants. Over-eager by design:
 * statute enactment dates in an attorney's prompt are rare and harmless to
 * tokenize; client DOBs are the dangerous failure mode we must catch.
 */
export const DATE_NUMERIC: PIIPattern = {
  category: 'date',
  label: 'Date',
  // MM/DD/YY through MM/DD/YYYYY — accept 2-4 digit years so typos like
  // "12/26/155" (clearly meant as a date but with a malformed year) still
  // get caught. The shape is the strong signal, not the exact year width.
  regex: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-]\d{2,4}\b/g,
};

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------

/** Credit-card-shaped number: 13–19 digits, grouped 4s common. Skips Luhn check. */
export const CREDIT_CARD: PIIPattern = {
  category: 'credit_card',
  label: 'Credit Card Number',
  regex: /\b(?:\d[ -]?){13,19}\b/g,
};

/**
 * Bank account numbers: only caught when accompanied by "account" or "acct"
 * language nearby. Bare 9–17 digit strings are too ambiguous.
 */
export const BANK_ACCOUNT: PIIPattern = {
  category: 'bank_account',
  label: 'Bank Account Number',
  regex: /\b(?:account|acct|routing)(?:\s*(?:number|no\.?|#))?\s*[:#]?\s*\d{6,17}\b/gi,
};

// ---------------------------------------------------------------------------
// Medical + firm-specific
// ---------------------------------------------------------------------------

/** Medical record number: MRN prefix or 6-10 digit sequence labeled "MRN".
 * Accepts ":", "#", "-", or whitespace between the prefix and digits. */
export const MEDICAL_RECORD: PIIPattern = {
  category: 'medical_record',
  label: 'Medical Record Number',
  regex: /\bMRN[\s:#-]*\d{6,10}\b/gi,
};

/**
 * Firm client-matter codes. Default catches forms like `DE-2025-001234` and
 * ampersand-prefix firms like `F&F-2024-1187`. Firms can extend at runtime
 * via registerFirmPattern().
 */
export const FIRM_CLIENT_MATTER: PIIPattern = {
  category: 'client_matter',
  label: 'Client-Matter Code',
  regex: /\b[A-Z](?:[A-Z&]{1,3})-\d{2,4}-\d{2,6}\b/g,
};


// ---------------------------------------------------------------------------
// Dollar amounts (W3 fix — financial identifiers)
// ---------------------------------------------------------------------------

/**
 * Dollar amounts: "$4.3M", "$237,500", "$1,234.56", "2 million dollars".
 * These are among the most common compound-identifier components in legal
 * queries — e.g., "$4.3M Marin County wage claim" could uniquely identify
 * a client even when no name is present. Catch them all; let the attorney
 * preview decide.
 */
export const DOLLAR_AMOUNT: PIIPattern = {
  category: 'dollar_amount',
  label: 'Dollar Amount',
  // Branches:
  //   $1,234.56 / $4.3M / $48K / $8.5MM    — $ prefix with optional scale suffix
  //   4.3 million dollars                  — digit + scale word + "dollars"
  //   two million dollars                  — word-number + scale word + "dollars"
  //   750k / 48K (no $)                    — bare digit + k/K suffix (limited
  //                                          to k/K to avoid e.g. matching
  //                                          "32M" in a license plate)
  regex:
    /\$\s*\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:thousand|million|billion|trillion|MM|[kMBT]))?\b|\b\d[\d,]*(?:\.\d+)?\s*(?:thousand|million|billion|trillion)\s+dollars?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred))*\s+(?:thousand|million|billion|trillion)\s+dollars?\b|\b\d[\d,]*(?:\.\d+)?[kK]\b/gi,
};

// ---------------------------------------------------------------------------
// California-specific legal identifiers (W8, audit §8 item 6)
// ---------------------------------------------------------------------------

/**
 * California State Bar Number in common attorney-letter formats:
 * "SBN 123456", "Bar No. 234567", "Cal. Bar # 345678".
 * Public record but identifies the specific attorney on a matter.
 */
export const CA_BAR_NUMBER: PIIPattern = {
  category: 'bar_number',
  label: 'California Bar Number',
  regex:
    /\bSBN\s*[:#]?\s*\d{4,6}\b|\b(?:Cal(?:ifornia)?\.?\s*)?(?:State\s+)?Bar\s+(?:No\.?|Number|#)\s*[:#]?\s*\d{4,6}\b/gi,
};

/**
 * California superior court case numbers not caught by FIRM_CLIENT_MATTER:
 *   BC712345        — LA Superior (old alpha-prefix style)
 *   23STCV12345     — LA Superior (year + district + CV + seq)
 *   24CV-067894     — LASC short form (year + CV + seq, with hyphen)
 *   24-CCH-067894   — LASC alternate hyphenated form (year + dept + seq)
 *   S280445         — CA Supreme Court docket
 * Hyphenated firm-style forms (CGC-24-123456) are caught by FIRM_CLIENT_MATTER.
 */
export const CA_COURT_CASE: PIIPattern = {
  category: 'court_case',
  label: 'California Court Case Number',
  regex:
    /\bBC\d{6}\b|\b\d{2}[A-Z]{2,6}CV\d{4,8}\b|\b\d{2}CV-\d{4,8}\b|\b\d{2}-[A-Z]{2,5}-\d{4,8}\b|\bS\d{6}\b/g,
};

// ---------------------------------------------------------------------------
// Additional date formats (W9 fix — ISO dates and verbose dates)
// ---------------------------------------------------------------------------

/** ISO 8601 date: 2024-01-15. Not caught by DATE_NUMERIC's M/D/Y pattern. */
export const DATE_ISO: PIIPattern = {
  category: 'date',
  label: 'ISO Date',
  regex: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
};

/** Verbose dates: "January 15, 2024", "15 January 2024", "Jan. 15, 2024". */
export const DATE_VERBOSE: PIIPattern = {
  category: 'date',
  label: 'Verbose Date',
  regex:
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Oct\.?|Nov\.?|Dec\.?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Oct\.?|Nov\.?|Dec\.?),?\s+(?:19|20)\d{2}\b/gi,
};

// ---------------------------------------------------------------------------
// Collected list
// ---------------------------------------------------------------------------

export const ALL_PATTERNS: readonly PIIPattern[] = [
  SSN,
  TIN,
  CA_DRIVER_LICENSE,
  PHONE,
  INTERNATIONAL_PHONE,
  EMAIL,
  STREET_ADDRESS,
  ZIP,
  DATE_NUMERIC,
  DATE_ISO,
  DATE_VERBOSE,
  CREDIT_CARD,
  BANK_ACCOUNT,
  MEDICAL_RECORD,
  FIRM_CLIENT_MATTER,
  DOLLAR_AMOUNT,
  CA_BAR_NUMBER,
  CA_COURT_CASE,
];

/** Allow a firm to register an extra client-matter pattern at runtime. */
const firmPatterns: PIIPattern[] = [];

export function registerFirmPattern(regex: RegExp, label: string): void {
  firmPatterns.push({ category: 'client_matter', label, regex });
}

export function effectivePatterns(): PIIPattern[] {
  return [...ALL_PATTERNS, ...firmPatterns];
}

/**
 * Run every pattern and return every match span. Spans may overlap; the
 * analyzer is responsible for merging.
 */
export interface PatternMatch {
  start: number;
  end: number;
  category: PIICategory;
  raw: string;
  label: string;
}

export function runPatterns(text: string): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const p of effectivePatterns()) {
    p.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.regex.exec(text)) !== null) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        category: p.category,
        raw: m[0],
        label: p.label,
      });
    }
  }
  return out;
}
