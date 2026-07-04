/**
 * =============================================================================
 * FILE: glinerPostProcess.ts  (services/sanitization — PRODUCTION)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   GLiNER (the entity model) returns raw labelled spans like
 *   {label:"person", start, end, text, score}. This file turns those raw
 *   spans into the SAME categories and filtering the production Python
 *   daemon (`tools/gliner-daemon/gliner_daemon.py`) produces, so the
 *   in-browser ONNX detector (glinerWebClient.ts) behaves identically to
 *   the daemon it replaces. Pure / Node-safe (no browser or ONNX imports).
 *
 *   It is a VERBATIM port of the LABEL_MAP, STOPLIST_LOWER, PREFIX_TRIM and
 *   threshold (0.7) logic in tools/gliner-daemon/gliner_daemon.py /
 *   scripts/gliner_detect.py (synced 2026-06-30). SOURCE OF TRUTH for the
 *   stoplist remains the Python daemon — if it changes, re-sync here.
 *
 * INPUT FILES:  none (pure function library, in-memory).
 * OUTPUT FILES: none.
 * =============================================================================
 */

// GLiNER label -> V2 SpanCategory. Mirrors gliner_detect.py LABEL_MAP.
export const LABEL_MAP: Record<string, string> = {
  person: 'name',
  'full name': 'name',
  'first name': 'name',
  'last name': 'name',
  'full address': 'street_address',
  address: 'street_address',
  'phone number': 'phone',
  'email address': 'email',
  email: 'email',
  date: 'date',
  'date of birth': 'date',
  'social security number': 'ssn',
  'credit card number': 'credit_card',
  'driver license': 'driver_license',
  'medical condition': 'medical_record',
  'patient id': 'medical_record',
  'zip code': 'zip',
  'postal code': 'zip',
};

// The label list we ASK GLiNER to find (keys of LABEL_MAP).
export const GLINER_LABELS: string[] = Object.keys(LABEL_MAP);

// Detection threshold. Tuned 0.4 -> 0.7 in production (2026-05-15).
export const DETECT_THRESHOLD = 0.7;

// Stoplist — full-span, case-insensitive matches that GLiNER mis-tags as
// PII but which carry no client-identifying info. VERBATIM from
// gliner_detect.py STOPLIST_LOWER.
export const STOPLIST_LOWER: ReadonlySet<string> = new Set<string>([
  // Salutations / titles
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'hon.', 'sir', 'madam',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'hon',
  // Generic legal roles (not personal names)
  'petitioner', 'respondent', 'plaintiff', 'defendant', 'appellant',
  'appellee', 'client', 'witness', 'co-counsel', 'co-trustee',
  'co-trustees', 'executor', 'executrix', 'trustee', 'trustees',
  'beneficiary', 'beneficiaries', 'grantor', 'settlor', 'guardian',
  'conservator', 'fiduciary', 'attorney', 'counsel', 'lawyer',
  'judge', 'justice', 'magistrate', 'clerk', 'court reporter',
  'declarant', 'affiant', 'surviving spouse',
  // Generic professions
  'architect', 'engineer', 'doctor', 'physician', 'nurse', 'teacher',
  'professor', 'student', 'resident', 'partner', 'associate',
  'consultant', 'manager', 'director', 'officer', 'analyst',
  'developer', 'designer', 'accountant', 'auditor', 'pharmacist',
  'therapist', 'counselor', 'researcher', 'pilot', 'driver',
  'mechanic', 'carpenter', 'electrician', 'plumber',
  'boeing engineer', 'cisco engineer',
  // Days/months/time
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sunday', 'morning', 'afternoon', 'evening', 'night', 'noon',
  'midnight', '2 pm', '2 am', '2pm', '2am', 'am', 'pm',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  // Hyphenated ethnic/national adjectives
  'korean-american', 'vietnamese-american', 'iranian-american',
  'mexican-american', 'chinese-american', 'japanese-american',
  'indian-american', 'filipino-american', 'african-american',
  'asian-american', 'mexican american', 'iranian american',
  'korean american', 'vietnamese american', 'chinese american',
  'japanese american', 'indian american', 'filipino american',
  'african american', 'asian american',
  // Bare nationality / ethnic adjectives
  'russian', 'mexican', 'lebanese', 'chinese', 'korean', 'vietnamese',
  'japanese', 'indian', 'filipino', 'african', 'asian', 'european',
  'middle eastern', 'persian', 'arab', 'hispanic', 'latino',
  'latina', 'latinx',
  'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'colombian',
  'venezuelan', 'argentinian', 'peruvian', 'bolivian',
  'cambodian', 'thai', 'laotian', 'burmese', 'malaysian', 'indonesian',
  'singaporean', 'taiwanese', 'mongolian', 'tibetan', 'nepalese',
  'pakistani', 'bangladeshi', 'sri lankan', 'afghani', 'iraqi', 'iranian',
  'syrian', 'jordanian', 'palestinian', 'turkish', 'kurdish', 'armenian',
  'ethiopian', 'eritrean', 'somali', 'nigerian', 'ghanaian', 'kenyan',
  'south african', 'egyptian', 'moroccan',
  'brazilian', 'portuguese', 'spanish', 'italian', 'french', 'german',
  'dutch', 'irish', 'scottish', 'welsh', 'polish', 'ukrainian', 'romanian',
  'hungarian', 'czech', 'slovak', 'serbian', 'croatian', 'greek',
  'hmong', 'punjabi', 'gujarati', 'bengali', 'tamil', 'telugu',
  'cantonese', 'mandarin', 'hokkien', 'shanghainese',
  'native american',
  // Religious adjectives / clergy
  'orthodox', 'catholic', 'protestant', 'buddhist', 'muslim', 'jewish',
  'hindu', 'sikh', 'mormon', 'evangelical', 'pastor', 'priest', 'rabbi',
  'imam', 'monk', 'nun', 'bishop',
  // More generic occupations
  'restaurateur', 'proprietor', 'owner', 'founder', 'entrepreneur',
  'executive', 'ceo', 'cfo', 'cto', 'coo', 'president', 'vice president',
  // Common org names
  'wells fargo', 'cisco', 'boeing', 'google', 'apple', 'meta',
  'microsoft', 'amazon', 'tesla', 'salesforce', 'oracle', 'intel',
  'nvidia', 'ucsf', 'ucla', 'usc', 'stanford', 'berkeley', 'caltech',
  'kaiser', 'bank of america', 'chase', 'citibank',
  // CA cities/regions used as generic geographic, not addresses
  'los angeles', 'san francisco', 'san diego', 'san jose', 'sacramento',
  'fresno', 'oakland', 'long beach', 'cupertino',
  'palo alto', 'mountain view', 'sunnyvale', 'pasadena', 'beverly hills',
  'la jolla', 'malibu', 'santa monica', 'santa barbara', 'santa clara',
  'fremont', 'hayward', 'walnut creek', 'orinda', 'lafayette',
  'marin county', 'alameda county', 'orange county', 'santa clara county',
  'silicon valley', 'bay area', 'sf bay area',
  // Neighborhood / district names
  'sunset district', 'pico-union', 'koreatown', 'hollywood hills',
  'mission district', 'chinatown', 'little tokyo', 'little saigon',
  'pico-robertson', 'pasadena hills', 'beverly grove', 'east la',
  'west la', 'downtown la', 'east oakland', 'west oakland',
  'sherman oaks', 'encino', 'studio city', 'van nuys',
  'mar vista', 'venice', 'glassell park', 'silver lake',
  'echo park', 'westwood', 'culver city', 'inglewood',
  'bishop', 'roseville', 'visalia', 'bakersfield',
  'cambodia town', 'thai town',
  // Schools / institutions commonly mentioned as third-party orgs
  "bishop o'dowd",
  // Common legal phrases
  'family trust', 'common trust', 'living trust', 'revocable trust',
  'irrevocable trust', 'special needs trust', 'pot trust',
  // U.S. visa / immigration classification codes. GLiNER mis-tags these
  // short alphanumeric codes as driver_license (e.g. reported FP "EB-3").
  // They are immigration categories, not government-ID numbers. Full-span
  // match only, so a real DL like "EB-3-prefixed-number" (a longer span)
  // is unaffected. (Added 2026-06-30 with the browser-GLiNER integration.)
  'eb-1', 'eb-2', 'eb-3', 'eb-4', 'eb-5', 'eb1', 'eb2', 'eb3', 'eb4', 'eb5',
  'h-1b', 'h1b', 'h-2a', 'h-2b', 'h-4', 'l-1', 'l-1a', 'l-1b', 'o-1', 'o-1a',
  'o-1b', 'p-1', 'e-2', 'e-3', 'tn', 'tn-1', 'f-1', 'j-1', 'b-1', 'b-2',
  'k-1', 'u-visa', 't-visa', 'ead', 'green card',
  // Relationship words
  'twins', 'triplets', 'siblings',
  // possessive-attached role phrases
  'my client', 'my counsel', 'my attorney', 'my trustee',
  'her client', 'his client', 'their client',
  'the client', 'the trustee', 'the beneficiary', 'the executor',
  // Generic user/system role words GLiNER mistags as person
  'user', 'users', 'the user', 'the system', 'the model', 'the agent',
  'the assistant', 'the bot', 'the chatbot',
  // Pronouns GLiNER occasionally mis-tags as person ("I want to draft a
  // will" → "I" flagged as CLIENT_001). Full-span match only, so real
  // names containing these letters are unaffected. (Added 2026-07-04.)
  'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours',
  'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'who', 'whom', 'someone', 'somebody', 'anyone',
  'anybody', 'everyone', 'everybody', 'no one', 'nobody',
]);

// Prefix tokens GLiNER glues onto person spans; trim them off the START.
// VERBATIM from gliner_detect.py PREFIX_TRIM.
export const PREFIX_TRIM: string[] = [
  'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Hon.', 'Honorable',
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Hon',
  'Witness', 'Petitioner', 'Respondent', 'Plaintiff', 'Defendant',
  'Appellant', 'Appellee', 'Co-counsel', 'Co-trustee', 'Counsel',
  'Attorney', 'Client', 'client', 'Trustee', 'Beneficiary',
  'Executor', 'Settlor', 'Grantor', 'Guardian',
];

function trimPrefix(text: string, start: number): [string, number] {
  for (const p of PREFIX_TRIM) {
    if (text.startsWith(p + ' ')) {
      return [text.slice(p.length + 1), start + p.length + 1];
    }
  }
  return [text, start];
}

/** Raw span as returned by GLiNER.js inference (IEntityResult). */
export interface RawGlinerSpan {
  spanText: string;
  start: number;
  end: number;
  label: string;
  score: number;
}

/** A post-processed, categorized span (mirrors gliner_detect.py output). */
export interface CategorizedSpan {
  start: number;
  end: number;
  label: string;        // original GLiNER label
  category: string;     // mapped V2 SpanCategory
  text: string;         // possibly prefix-trimmed
  score: number;
}

/**
 * Apply the EXACT production post-processing: label->category map, name
 * prefix-trim, full-span stoplist filter, drop-empties. Mirrors
 * gliner_detect.py detect().
 */
export function postProcess(raw: RawGlinerSpan[]): CategorizedSpan[] {
  const out: CategorizedSpan[] = [];
  for (const r of raw) {
    const cat = LABEL_MAP[r.label.toLowerCase()];
    if (!cat) continue;
    let spanText = r.spanText;
    let spanStart = r.start;
    if (cat === 'name') {
      [spanText, spanStart] = trimPrefix(spanText, spanStart);
    }
    if (STOPLIST_LOWER.has(spanText.trim().toLowerCase())) continue;
    if (!spanText.trim()) continue;
    // A one-character "name" is never a real personal name — it's the
    // model mis-tagging a pronoun, initial, or stray letter.
    if (cat === 'name' && spanText.trim().length < 2) continue;
    out.push({
      start: spanStart,
      end: r.end,
      label: r.label,
      category: cat,
      text: spanText,
      score: r.score,
    });
  }
  return out;
}
