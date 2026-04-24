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
  | 'client_matter';

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

/** US ZIP (5-digit or ZIP+4). */
export const ZIP: PIIPattern = {
  category: 'zip',
  label: 'ZIP Code',
  regex: /\b\d{5}(?:-\d{4})?\b/g,
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
  regex: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{2}|\d{4})\b/g,
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

/** Medical record number: MRN prefix or 6-10 digit sequence labeled "MRN". */
export const MEDICAL_RECORD: PIIPattern = {
  category: 'medical_record',
  label: 'Medical Record Number',
  regex: /\bMRN\s*[:#]?\s*\d{6,10}\b/gi,
};

/**
 * Firm client-matter codes. Default catches forms like `DE-2025-001234`.
 * Firms can extend this at runtime by adding their own pattern via
 * registerFirmPattern(). Left permissive by default.
 */
export const FIRM_CLIENT_MATTER: PIIPattern = {
  category: 'client_matter',
  label: 'Client-Matter Code',
  regex: /\b[A-Z]{2,4}-\d{2,4}-\d{2,6}\b/g,
};

// ---------------------------------------------------------------------------
// Collected list
// ---------------------------------------------------------------------------

export const ALL_PATTERNS: readonly PIIPattern[] = [
  SSN,
  TIN,
  CA_DRIVER_LICENSE,
  PHONE,
  EMAIL,
  STREET_ADDRESS,
  ZIP,
  DATE_NUMERIC,
  CREDIT_CARD,
  BANK_ACCOUNT,
  MEDICAL_RECORD,
  FIRM_CLIENT_MATTER,
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
