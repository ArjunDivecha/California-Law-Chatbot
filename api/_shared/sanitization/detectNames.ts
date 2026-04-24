/**
 * Name Detection Heuristics
 *
 * Deterministic signals for personal names in attorney prompts. No ML.
 * Designed to be over-eager: we'd rather tokenize "Justice Kennedy" in a
 * citation and un-tokenize it via the preview (one click) than miss
 * "Mary C." and send it raw.
 *
 * The caller (index.ts) is expected to remove any spans that overlap an
 * allowlist match — so justices and public officials get filtered back out
 * before tokenization happens.
 */

export interface NameSpan {
  start: number;
  end: number;
  raw: string;
  /** The signal that flagged this span, for debugging/auditing. */
  signal:
    | 'title_prefix'       // Mr./Ms./Dr./Prof./Hon./Justice X
    | 'possessive'         // X's
    | 'relational'         // client X, my spouse X, decedent X
    | 'capitalized_bigram' // Fallback: two capitalized words in a row
    | 'address_cue';       // Mr./Ms. X or X residing at ...
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Capitalized name word: starts with uppercase, rest are letters. */
const NAME_WORD = `[A-Z][a-zA-Z'\\-]*`;

/** Up to four name words (First Middle Last Suffix). */
const NAME_PHRASE = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,3}`;

/** Common honorifics / titles. */
const TITLE_WORD = `(?:Mr|Mrs|Ms|Miss|Dr|Prof|Hon|Justice|Sen|Rep|Gov|Sheriff|Officer|Deputy|Attorney|Judge)`;

// ---------------------------------------------------------------------------
// Individual signal scanners
// ---------------------------------------------------------------------------

function scanTitlePrefix(text: string): NameSpan[] {
  const re = new RegExp(`\\b${TITLE_WORD}\\.?\\s+(${NAME_PHRASE})`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Span covers the name portion only, not the title.
    const start = m.index + m[0].indexOf(m[1]);
    out.push({
      start,
      end: start + m[1].length,
      raw: m[1],
      signal: 'title_prefix',
    });
  }
  return out;
}

/**
 * Possessives: a capitalized name phrase immediately followed by 's or '.
 * Example: "Esperanza's estate", "Maria Esperanza's son".
 */
function scanPossessive(text: string): NameSpan[] {
  const re = new RegExp(`\\b(${NAME_PHRASE})(?:'s|'s)\\b`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    out.push({
      start,
      end: start + m[1].length,
      raw: m[1],
      signal: 'possessive',
    });
  }
  return out;
}

/**
 * Relational / descriptive cues: "client X", "decedent X", "my spouse X",
 * "testator X", "trustor X", etc.
 */
function scanRelational(text: string): NameSpan[] {
  // Relational cue words are usually lowercase. We lowercase the input for
  // cue matching but preserve original case for the captured name. Avoids
  // the `i`-flag problem where [A-Z] would match lowercase letters.
  const relationWord =
    `(?:client|ward|decedent|deceased|testator|testatrix|trustor|settlor|trustee|beneficiary|guardian|conservator|conservatee|personal\\s+representative|executor|executrix|administrator|administratrix|petitioner|respondent|plaintiff|defendant|debtor|creditor|assignor|assignee|opposing\\s+party|husband|wife|spouse|son|daughter|child|children|sibling|brother|sister|mother|father|parent|partner|fiance|fiancee|niece|nephew|cousin|aunt|uncle)`;
  const cueRe = new RegExp(
    `\\b(?:[Mm]y\\s+|[Oo]ur\\s+|[Tt]he\\s+|[Aa]\\s+|[Hh]is\\s+|[Hh]er\\s+)?${relationWord}(?:\\s+named)?\\s+`,
    'gi'
  );
  const nameRe = new RegExp(`^(${NAME_PHRASE})`);
  const out: NameSpan[] = [];
  let cueMatch: RegExpExecArray | null;
  while ((cueMatch = cueRe.exec(text)) !== null) {
    const nameStart = cueMatch.index + cueMatch[0].length;
    const tail = text.slice(nameStart);
    const nameMatch = nameRe.exec(tail);
    if (!nameMatch) continue;
    const raw = nameMatch[1];
    // Skip trivial pronouns if casing made them look name-ish.
    if (/^(He|She|They|It|We|You|I)$/.test(raw)) continue;
    out.push({
      start: nameStart,
      end: nameStart + raw.length,
      raw,
      signal: 'relational',
    });
  }
  return out;
}

/**
 * "X residing at" / "X, age N" / "X of [city]" patterns.
 */
function scanAddressCue(text: string): NameSpan[] {
  const re = new RegExp(`\\b(${NAME_PHRASE})(?=\\s*(?:,\\s*age\\s+\\d+|,?\\s*residing\\s+at|,?\\s*of\\s+[A-Z]))`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[1].length,
      raw: m[1],
      signal: 'address_cue',
    });
  }
  return out;
}

/**
 * Fallback: capitalized bigrams (two or more capitalized words in a row,
 * not at sentence start). High recall; high false-positive rate — the
 * analyzer filters overlaps with the allowlist (case captions, agency
 * names, etc.) before tokenizing.
 */
function scanCapitalizedBigram(text: string): NameSpan[] {
  // Bigram names at sentence start ("Maria Esperanza arrived...") must be
  // caught — those are exactly the ones that matter. We rely on the
  // COMMON_NON_NAME_STARTS filter below to suppress "The X", "Section Y",
  // etc. rather than a position-based exclusion.
  const re = new RegExp(`\\b(${NAME_WORD}\\s+${NAME_WORD}(?:\\s+${NAME_WORD})?)\\b`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const firstWord = raw.split(/\s+/)[0];
    if (COMMON_NON_NAME_STARTS.has(firstWord)) continue;
    out.push({
      start: m.index,
      end: m.index + raw.length,
      raw,
      signal: 'capitalized_bigram',
    });
  }
  return out;
}

/**
 * Words that commonly appear capitalized but are not name starts. Not
 * exhaustive — the allowlist handles most legal terms; this just filters
 * obvious noise from the bigram scanner.
 */
const COMMON_NON_NAME_STARTS = new Set<string>([
  // Determiners / pronouns
  'The',
  'A',
  'An',
  'My',
  'Our',
  'Their',
  'His',
  'Her',
  'This',
  'That',
  'These',
  'Those',
  'No',
  'Yes',
  // Numbering
  'First',
  'Second',
  'Third',
  // Time words
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  // Role / party / relation words — must not eat the next capitalized
  // word(s) into a bigram name span. The relational scanner handles
  // these as *cues* and captures only the actual name portion.
  'Client',
  'Clients',
  'Defendant',
  'Defendants',
  'Plaintiff',
  'Plaintiffs',
  'Petitioner',
  'Petitioners',
  'Respondent',
  'Respondents',
  'Executor',
  'Executrix',
  'Trustee',
  'Trustees',
  'Settlor',
  'Trustor',
  'Beneficiary',
  'Guardian',
  'Guardians',
  'Conservator',
  'Conservators',
  'Conservatee',
  'Testator',
  'Testatrix',
  'Decedent',
  'Administrator',
  'Administratrix',
  'Ward',
  'Creditor',
  'Debtor',
  'Assignor',
  'Assignee',
  'Attorney',
  'Counsel',
  'Husband',
  'Wife',
  'Spouse',
  'Son',
  'Daughter',
  'Mother',
  'Father',
  'Parent',
  'Child',
  'Children',
  'Sibling',
  'Brother',
  'Sister',
  'Partner',
  'Fiance',
  'Fiancee',
  'Niece',
  'Nephew',
  'Cousin',
  'Aunt',
  'Uncle',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectNames(text: string): NameSpan[] {
  return [
    ...scanTitlePrefix(text),
    ...scanPossessive(text),
    ...scanRelational(text),
    ...scanAddressCue(text),
    ...scanCapitalizedBigram(text),
  ];
}
