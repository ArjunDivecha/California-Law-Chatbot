const SSN = {
  category: "ssn",
  label: "Social Security Number",
  regex: /\b\d{3}-\d{2}-\d{4}\b/g
};
const TIN = {
  category: "tin",
  label: "Taxpayer Identification Number",
  regex: /\b\d{2}-\d{7}\b/g
};
const CA_DRIVER_LICENSE = {
  category: "driver_license",
  label: "California Driver License",
  regex: /\b[A-Z]\d{7}\b/g
};
const PHONE = {
  category: "phone",
  label: "Phone Number",
  // +1 (415) 555-0123, (415) 555-0123, 415-555-0123, 415.555.0123, 415 555 0123
  regex: /(?<!\d)(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b(?!\d)/g
};
const EMAIL = {
  category: "email",
  label: "Email Address",
  regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
};
const STREET_ADDRESS = {
  category: "street_address",
  label: "Street Address",
  regex: /\b\d{1,6}\s+(?:[A-Z][a-z]+\.?\s+){1,5}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Parkway|Terr|Terrace|Cir|Circle|Hwy|Highway)\b\.?/g
};
const ZIP = {
  category: "zip",
  label: "ZIP Code",
  regex: /\b\d{5}(?:-\d{4})?\b/g
};
const DATE_NUMERIC = {
  category: "date",
  label: "Date",
  regex: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{2}|\d{4})\b/g
};
const CREDIT_CARD = {
  category: "credit_card",
  label: "Credit Card Number",
  regex: /\b(?:\d[ -]?){13,19}\b/g
};
const BANK_ACCOUNT = {
  category: "bank_account",
  label: "Bank Account Number",
  regex: /\b(?:account|acct|routing)(?:\s*(?:number|no\.?|#))?\s*[:#]?\s*\d{6,17}\b/gi
};
const MEDICAL_RECORD = {
  category: "medical_record",
  label: "Medical Record Number",
  regex: /\bMRN\s*[:#]?\s*\d{6,10}\b/gi
};
const FIRM_CLIENT_MATTER = {
  category: "client_matter",
  label: "Client-Matter Code",
  regex: /\b[A-Z]{2,4}-\d{2,4}-\d{2,6}\b/g
};
const ALL_PATTERNS = [
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
  FIRM_CLIENT_MATTER
];
const firmPatterns = [];
function registerFirmPattern(regex, label) {
  firmPatterns.push({ category: "client_matter", label, regex });
}
function effectivePatterns() {
  return [...ALL_PATTERNS, ...firmPatterns];
}
function runPatterns(text) {
  const out = [];
  for (const p of effectivePatterns()) {
    p.regex.lastIndex = 0;
    let m;
    while ((m = p.regex.exec(text)) !== null) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        category: p.category,
        raw: m[0],
        label: p.label
      });
    }
  }
  return out;
}
export {
  ALL_PATTERNS,
  BANK_ACCOUNT,
  CA_DRIVER_LICENSE,
  CREDIT_CARD,
  DATE_NUMERIC,
  EMAIL,
  FIRM_CLIENT_MATTER,
  MEDICAL_RECORD,
  PHONE,
  SSN,
  STREET_ADDRESS,
  TIN,
  ZIP,
  effectivePatterns,
  registerFirmPattern,
  runPatterns
};
