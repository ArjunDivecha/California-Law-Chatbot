/**
 * Compound-identifier risk detector — minimum-viable W1 mechanism.
 *
 * Sanitization-audit §8 item #3 calls for an n-gram correlation pass that
 * flags inputs where multiple non-PII facts co-occur and together identify
 * a specific client. The "ideal" implementation seeds from F&F matter
 * patterns. Until that seed list is available, this minimum-viable version
 * uses a fixed dictionary of compound-risk signal buckets:
 *
 *   ethnicity / nationality / religion
 *   small or specific geographic markers
 *   immigration status / visa class
 *   legal-program markers (Section 8, conservatorship, paternity action)
 *   niche occupations / professions
 *   language / linguistic-community markers
 *   family-structure markers (widow, single mother, etc.)
 *   institution markers (specific schools, mosques, hospitals)
 *
 * When ≥3 DISTINCT buckets are hit by the input, the prompt is treated as
 * compound-identifier-risk and `analyze()` sets `privileged: true` even if
 * no individual span-producing PII detector fired. Single-bucket hits are
 * not load-bearing on their own — many ordinary legal-research prompts
 * mention one ethnicity, one program, or one location without identifying
 * any specific client.
 *
 * Terms are matched case-insensitively with word-boundary precision. Each
 * term lives in exactly one bucket — no term can inflate the count by
 * counting toward two buckets.
 */

/**
 * Master dictionary: term → bucket name. Order does not matter; the
 * detector groups by bucket and counts distinct buckets that fired.
 */
const TERM_TO_BUCKET: ReadonlyArray<[string, string]> = [
  // ────────────────────────────────────────────────────────────────────
  // ethnicity / nationality / religion
  // ────────────────────────────────────────────────────────────────────
  ['Vietnamese', 'ethnicity'],
  ['Cantonese', 'ethnicity'],
  ['Salvadoran', 'ethnicity'],
  ['Iranian', 'ethnicity'],
  ['Sikh', 'ethnicity'],
  ['Hmong', 'ethnicity'],
  ['Korean', 'ethnicity'],
  ['Pakistani', 'ethnicity'],
  ['Cambodian', 'ethnicity'],
  ['Filipino', 'ethnicity'],
  ['Mexican', 'ethnicity'],
  ['Chinese', 'ethnicity'],
  ['Japanese', 'ethnicity'],
  ['Indian', 'ethnicity'],
  ['Brazilian-American', 'ethnicity'],
  ['Lebanese-American', 'ethnicity'],
  ['African-American', 'ethnicity'],
  ['Native American', 'ethnicity'],
  ['Russian-speaking', 'ethnicity'],
  ['Spanish-speaking', 'ethnicity'],
  ['Orthodox Jewish', 'ethnicity'],
  // Hyphenated-American forms commonly used in F&F intake (added v2 2026-05-13)
  ['Korean-American', 'ethnicity'],
  ['Mexican-American', 'ethnicity'],
  ['Vietnamese-American', 'ethnicity'],
  ['Iranian-American', 'ethnicity'],
  ['Chinese-American', 'ethnicity'],
  ['Japanese-American', 'ethnicity'],
  ['Indian-American', 'ethnicity'],
  ['Pakistani-American', 'ethnicity'],
  ['Filipino-American', 'ethnicity'],
  ['Cuban-American', 'ethnicity'],
  ['Italian-American', 'ethnicity'],
  ['Irish-American', 'ethnicity'],
  ['Asian-American', 'ethnicity'],
  ['Pacific Islander', 'ethnicity'],
  ['Hispanic', 'ethnicity'],
  ['Latino', 'ethnicity'],
  ['Latina', 'ethnicity'],
  ['Latinx', 'ethnicity'],
  ['Yoruba', 'ethnicity'],
  ['Igbo', 'ethnicity'],
  ['Ghanaian', 'ethnicity'],
  ['Ethiopian', 'ethnicity'],
  ['Eritrean', 'ethnicity'],
  ['Lebanese', 'ethnicity'],
  ['Brazilian', 'ethnicity'],

  // ────────────────────────────────────────────────────────────────────
  // small / specific California geographic markers
  // ────────────────────────────────────────────────────────────────────
  ['Bishop', 'small_location'],
  ['Yuba City', 'small_location'],
  ['Pico-Union', 'small_location'],
  ['Pico-Robertson', 'small_location'],
  ['La Habra', 'small_location'],
  ['Daly City', 'small_location'],
  ['Sherman Oaks', 'small_location'],
  ['Encino', 'small_location'],
  ['Koreatown', 'small_location'],
  ['Cambodia Town', 'small_location'],
  ['Sunset District', 'small_location'],
  ['Hollywood Hills', 'small_location'],
  ['Mid-City', 'small_location'],
  ['Petaluma', 'small_location'],
  ['South LA', 'small_location'],
  ['Glendale', 'small_location'],
  ['Roseville', 'small_location'],
  ['Burbank', 'small_location'],
  ['Cupertino', 'small_location'],
  ['Sunnyvale', 'small_location'],
  ['Fremont', 'small_location'],
  ['Bakersfield', 'small_location'],
  ['San Bernardino', 'small_location'],
  ['Westwood', 'small_location'],
  ['Fresno', 'small_location'],
  ['Fresno County', 'small_location'],
  // Bay-Area / California locations common in F&F intake (added v2 2026-05-13)
  ['Berkeley', 'small_location'],
  ['Oakland', 'small_location'],
  ['Sacramento', 'small_location'],
  ['Palo Alto', 'small_location'],
  ['Mountain View', 'small_location'],
  ['Menlo Park', 'small_location'],
  ['Alameda', 'small_location'],
  ['Walnut Creek', 'small_location'],
  ['Lafayette', 'small_location'],
  ['Orinda', 'small_location'],
  ['Marin County', 'small_location'],
  ['Marin', 'small_location'],
  ['Santa Cruz', 'small_location'],
  ['Pasadena', 'small_location'],
  ['Alhambra', 'small_location'],

  // ────────────────────────────────────────────────────────────────────
  // immigration / visa status
  // ────────────────────────────────────────────────────────────────────
  ['TPS', 'immigration_status'],
  ['H1B', 'immigration_status'],
  ['H-1B', 'immigration_status'],
  ['EB-3', 'immigration_status'],
  ['EB3', 'immigration_status'],
  ['asylum', 'immigration_status'],
  ['green card pending', 'immigration_status'],
  ['green card', 'immigration_status'],
  ['undocumented', 'immigration_status'],
  ['DACA', 'immigration_status'],
  ['naturalization', 'immigration_status'],

  // ────────────────────────────────────────────────────────────────────
  // legal-program / matter markers
  // ────────────────────────────────────────────────────────────────────
  ['Section 8', 'legal_program'],
  ['S-corp', 'legal_program'],
  ['paternity action', 'legal_program'],
  ['conservatorship', 'legal_program'],
  ['embezzlement', 'legal_program'],
  ['malpractice', 'legal_program'],
  ['immigration matter', 'legal_program'],
  ['DUI', 'legal_program'],
  ['DUIs', 'legal_program'],
  ['custody dispute', 'legal_program'],
  ['child custody', 'legal_program'],
  ['license revocation', 'legal_program'],
  ['CDPH licensing', 'legal_program'],
  ['licensing inspection', 'legal_program'],
  ['arbitration', 'legal_program'],
  ['estate planning', 'legal_program'],
  ['restructuring', 'legal_program'],
  ['casino-tribe', 'legal_program'],
  ['per-capita', 'legal_program'],
  ['per-capita distribution', 'legal_program'],
  ['tribal lands', 'legal_program'],
  ['tribal', 'legal_program'],

  // ────────────────────────────────────────────────────────────────────
  // niche occupations
  // ────────────────────────────────────────────────────────────────────
  ['orthodontist', 'niche_occupation'],
  ['imam', 'niche_occupation'],
  ['pastor', 'niche_occupation'],
  ['restaurateur', 'niche_occupation'],
  ['taxi driver', 'niche_occupation'],
  ['landscaper', 'niche_occupation'],
  ['bookkeeper', 'niche_occupation'],
  ['chef de cuisine', 'niche_occupation'],
  ['post-doc', 'niche_occupation'],
  ['radiology resident', 'niche_occupation'],
  ['nursing-home owner', 'niche_occupation'],
  ['nursing home owner', 'niche_occupation'],
  ['dry-cleaning operator', 'niche_occupation'],
  ['day laborer', 'niche_occupation'],
  ['software engineer', 'niche_occupation'],
  ['DJ', 'niche_occupation'],
  ['almond orchard', 'niche_occupation'],
  ['dental practice', 'niche_occupation'],
  ['nursing home', 'niche_occupation'],
  ['shop owner', 'niche_occupation'],
  ['farmer', 'niche_occupation'],
  // Specific F&F-shape professional specialties (added v2 2026-05-13).
  // Note: kept compound to avoid firing on generic "physician" or
  // "engineer" alone — only the specialty-qualified forms count.
  ['family-medicine physician', 'niche_occupation'],
  ['child psychiatrist', 'niche_occupation'],
  ['principal engineer', 'niche_occupation'],
  ['in-house attorney', 'niche_occupation'],
  ['tax attorney', 'niche_occupation'],
  ['plaintiffs attorney', 'niche_occupation'],
  ['plaintiff\'s attorney', 'niche_occupation'],
  ['estate planning attorney', 'niche_occupation'],
  ['nurse practitioner', 'niche_occupation'],
  ['Boeing engineer', 'niche_occupation'],
  ['Cisco principal engineer', 'niche_occupation'],
  ['UCSF child psychiatrist', 'niche_occupation'],

  // ────────────────────────────────────────────────────────────────────
  // language / linguistic-community markers (distinct from ethnicity —
  // e.g. "Mandarin-language" is about service-need context, not heritage)
  // ────────────────────────────────────────────────────────────────────
  ['Mandarin-language', 'language_marker'],
  ['Mandarin', 'language_marker'],
  ['Khmer-language', 'language_marker'],
  ['Khmer', 'language_marker'],
  ['Portuguese-language', 'language_marker'],
  ['Portuguese', 'language_marker'],
  ['language access', 'language_marker'],
  ['interpreter', 'language_marker'],

  // ────────────────────────────────────────────────────────────────────
  // family structure
  // ────────────────────────────────────────────────────────────────────
  ['widow', 'family_role'],
  ['widower', 'family_role'],
  ['single mother', 'family_role'],
  ['single father', 'family_role'],
  ['orphan', 'family_role'],

  // ────────────────────────────────────────────────────────────────────
  // specific institutions (schools/places of worship/hospitals)
  // ────────────────────────────────────────────────────────────────────
  ['LAUSD', 'institution_marker'],
  ['UCSF', 'institution_marker'],
  ['UC Davis', 'institution_marker'],
  ['Stanford', 'institution_marker'],
  ['Harker', 'institution_marker'],
  ['yeshiva', 'institution_marker'],
  ['mosque', 'institution_marker'],
  ['Talmudic-court', 'institution_marker'],
  ['Talmudic court', 'institution_marker'],
  ['diocese', 'institution_marker'],
  // Bay-Area tech / corporate employers + schools common in F&F intake
  // (added v2 2026-05-13). Specific enough to fire compound-risk when
  // combined with location + ethnicity; not so generic as to false-positive
  // on legal-research queries (no "tech company" / "engineer" alone).
  ['Boeing', 'institution_marker'],
  ['Cisco', 'institution_marker'],
  ['Google', 'institution_marker'],
  ['Apple', 'institution_marker'],
  ['Meta', 'institution_marker'],
  ['Genentech', 'institution_marker'],
  ['Tesla', 'institution_marker'],
  ['Kaiser', 'institution_marker'],
  ['UCSF Medical', 'institution_marker'],
  ['Stanford Hospital', 'institution_marker'],
  ['Bishop O\'Dowd', 'institution_marker'],
  ['Mark Keppel', 'institution_marker'],
  ['Lowell', 'institution_marker'],
  ['San Marin', 'institution_marker'],
  ['Berkeley High', 'institution_marker'],
  ['Lick-Wilmerding', 'institution_marker'],
  ['College Prep', 'institution_marker'],
];

/**
 * Returns the buckets that fired (deduplicated) and the specific term
 * matches that triggered each bucket.
 */
export interface CompoundRiskResult {
  /** Number of DISTINCT buckets matched by the input. */
  bucketsHit: number;
  /** The set of bucket names that fired. */
  bucketNames: string[];
  /** Term-level matches for telemetry / audit. */
  matches: ReadonlyArray<{ bucket: string; term: string }>;
}

const EMPTY_RESULT: CompoundRiskResult = { bucketsHit: 0, bucketNames: [], matches: [] };

/**
 * Default threshold for the compound-risk privileged flag. ≥3 distinct
 * buckets is the audit §9 recommendation for a viable W1 minimum.
 */
export const COMPOUND_RISK_BUCKET_THRESHOLD = 3;

/**
 * Scan `text` and count which compound-risk buckets fired. Bucket count
 * does not double-count buckets — a single term hit counts its bucket once
 * even if the same term appears multiple times in the input.
 */
export function detectCompoundRisk(text: string): CompoundRiskResult {
  if (!text || typeof text !== 'string') return EMPTY_RESULT;
  const lower = text.toLowerCase();
  const bucketsSeen = new Set<string>();
  const matches: Array<{ bucket: string; term: string }> = [];
  for (const [term, bucket] of TERM_TO_BUCKET) {
    const lowerTerm = term.toLowerCase();
    // Word-boundary-ish containment: require the term to be surrounded by
    // non-letter characters (or by start/end of string). Avoids "Indian"
    // matching inside "Indianapolis" or "indica".
    if (containsAsWord(lower, lowerTerm)) {
      bucketsSeen.add(bucket);
      matches.push({ bucket, term });
    }
  }
  return {
    bucketsHit: bucketsSeen.size,
    bucketNames: [...bucketsSeen],
    matches,
  };
}

function containsAsWord(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return false;
    const before = idx === 0 ? ' ' : haystack[idx - 1];
    const after = idx + needle.length === haystack.length ? ' ' : haystack[idx + needle.length];
    if (!isLetterOrDigit(before) && !isLetterOrDigit(after)) return true;
    from = idx + 1;
  }
  return false;
}

function isLetterOrDigit(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch);
}

/** Public helper: true when the compound-risk threshold is met. */
export function isCompoundRisk(text: string): boolean {
  return detectCompoundRisk(text).bucketsHit >= COMPOUND_RISK_BUCKET_THRESHOLD;
}
