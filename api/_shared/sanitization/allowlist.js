const CASE_PATTERNS = [
  // People v. Smith (2020) 50 Cal.App.5th 123
  /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z&.]+)*\s+v\.\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z&.]+)*(?:\s*\(\d{4}\))?(?:\s+\d+\s+[A-Z][a-z.]*\.?(?:\s*[A-Z][a-z.]*\.?)*\s*\d+[a-z]{2}?\s*\d+)?/g,
  // In re Marriage of Clarke
  /\bIn\s+re\s+(?:Marriage\s+of\s+)?[A-Z][a-zA-Z]+(?:\s+(?:and|&)\s+[A-Z][a-zA-Z]+)?/g,
  // Estate of X
  /\bEstate\s+of\s+[A-Z][a-zA-Z]+/g
];
const STATUTE_PATTERNS = [
  // Family Code § 1615, Probate Code section 859
  /\b(?:Family|Probate|Civil|Penal|Government|Corporations|Evidence|Labor|Business and Professions|Welfare and Institutions|Code of Civil Procedure|Elections|Fish and Game|Food and Agricultural|Revenue and Taxation|Streets and Highways|Vehicle|Water|Public Utilities|Public Resources|Health and Safety|Education|Insurance|Harbor and Navigation)\s+Code\s*(?:§+|sec(?:tion)?\.?)\s*\d+(?:\.\d+)?(?:\([a-z0-9]+\))?/gi,
  // Short abbreviations: CCP § 2030.300, Bus. & Prof. § 17200
  /\b(?:CCP|CCR|C\.?C\.?P\.?|Bus\.?\s*&\s*Prof\.?|Welf\.?\s*&\s*Inst\.?|Fam\.?|Prob\.?|Pen\.?|Gov\.?|Corp\.?|Evid\.?)\s*(?:§+|sec(?:tion)?\.?)\s*\d+(?:\.\d+)?/gi,
  // Federal citations: 42 U.S.C. § 1983
  /\b\d+\s+U\.?\s*S\.?\s*C\.?\s*§?\s*\d+[a-z]?/gi
];
const COURTS = [
  "California Supreme Court",
  "Supreme Court of California",
  "California Court of Appeal",
  "California Courts of Appeal",
  "Superior Court of California",
  "Ninth Circuit",
  "United States Supreme Court",
  "U.S. Supreme Court",
  "Supreme Court"
];
const AGENCIES = [
  "California Attorney General",
  "Attorney General",
  "California Secretary of State",
  "Secretary of State",
  "Franchise Tax Board",
  "FTB",
  "California Department of Tax and Fee Administration",
  "CDTFA",
  "Department of Motor Vehicles",
  "DMV",
  "California Department of Fair Employment and Housing",
  "DFEH",
  "California Civil Rights Department",
  "CRD",
  "State Bar of California",
  "California State Bar",
  "California Bar",
  "California Public Utilities Commission",
  "CPUC",
  "California Air Resources Board",
  "CARB",
  "Employment Development Department",
  "EDD",
  "California Department of Health Care Services",
  "DHCS",
  "California Legislature",
  "California State Senate",
  "California Assembly",
  "State Assembly",
  "California State Assembly",
  "California State Treasurer",
  "California State Controller",
  "California State Auditor",
  "Governor of California",
  "Governor Newsom",
  "Governor Gavin Newsom"
];
const CEB_SOURCES = [
  "California Business Law Reporter",
  "Estate Planning And California Probate Reporter",
  "Practice Under The California Family Code",
  "California Marital Settlement And Other Family Law Agreements",
  "California Civil Discovery Practice",
  "California Trust Administration",
  "California Will Drafting",
  "California Elder Law"
];
function scanExactPhrases(text, phrases, kind) {
  const out = [];
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      out.push({
        start: idx,
        end: idx + phrase.length,
        raw: text.slice(idx, idx + phrase.length),
        kind
      });
      idx += phrase.length;
    }
  }
  return out;
}
function scanPatterns(text, patterns, kind) {
  const out = [];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(text)) !== null) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        raw: m[0],
        kind
      });
    }
  }
  return out;
}
function findAllowlistMatches(text) {
  const hits = [
    ...scanPatterns(text, CASE_PATTERNS, "case"),
    ...scanPatterns(text, STATUTE_PATTERNS, "statute"),
    ...scanExactPhrases(text, COURTS, "court"),
    ...scanExactPhrases(text, AGENCIES, "agency"),
    ...scanExactPhrases(text, CEB_SOURCES, "ceb")
  ];
  hits.sort((a, b) => a.start - b.start);
  return hits;
}
function overlapsAllowlist(start, end, allowlistMatches) {
  for (const a of allowlistMatches) {
    if (start < a.end && end > a.start) return true;
  }
  return false;
}
export {
  findAllowlistMatches,
  overlapsAllowlist
};
