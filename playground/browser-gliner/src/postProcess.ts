/**
 * =============================================================================
 * FILE: postProcess.ts  (browser-gliner prototype)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   GLiNER (the entity model) returns raw labelled spans like
 *   {label:"person", start, end, text, score}. This file turns those raw
 *   spans into the SAME shape, categories, and filtering that the
 *   production Python detector (`scripts/gliner_detect.py`) and the local
 *   daemon (`tools/gliner-daemon/gliner_daemon.py`) produce, so that the
 *   in-browser ONNX model is judged on identical post-processing. The only
 *   variable we are testing is the model engine (Python fp32 -> browser
 *   int8 ONNX); everything downstream of the model must match byte-for-byte
 *   in behaviour.
 *
 *   It is a VERBATIM port of the LABEL_MAP, STOPLIST_LOWER, PREFIX_TRIM and
 *   threshold logic in scripts/gliner_detect.py (read 2026-06-30). If that
 *   file changes, re-sync this one.
 *
 * INPUT FILES:  none (pure function library, in-memory).
 * OUTPUT FILES: none.
 *
 * SOURCE OF TRUTH:
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-V2/scripts/gliner_detect.py
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-V2/tools/gliner-daemon/gliner_daemon.py
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
  // Relationship words
  'twins', 'triplets', 'siblings',
  // possessive-attached role phrases
  'my client', 'my counsel', 'my attorney', 'my trustee',
  'her client', 'his client', 'their client',
  'the client', 'the trustee', 'the beneficiary', 'the executor',
  // Generic user/system role words GLiNER mistags as person
  'user', 'users', 'the user', 'the system', 'the model', 'the agent',
  'the assistant', 'the bot', 'the chatbot',
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
