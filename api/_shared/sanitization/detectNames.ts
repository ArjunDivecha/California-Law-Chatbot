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
    | 'address_cue'        // Mr./Ms. X or X residing at ...
    | 'cue_lowercase';     // help/represent/client + lowercase 2-word name
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
    const raw = m[1];
    const words = raw.split(/\s+/);
    if (COMMON_NON_NAME_STARTS.has(words[0])) continue;
    if (words.some((w) => COMMON_LEGAL_PHRASE_WORDS.has(w))) continue;
    if (words.some((w) => US_STATE_ABBR.has(w))) continue;
    const start = m.index;
    out.push({
      start,
      end: start + raw.length,
      raw,
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
  // Two narrow signals: "X, age NN" and "X residing at ...". The
  // earlier "X of [A-Z]" lookahead matched too many topic phrases
  // ("Code of Civil", "Department of Justice") and was dropped.
  const re = new RegExp(`\\b(${NAME_PHRASE})(?=\\s*(?:,\\s*age\\s+\\d+|,?\\s*residing\\s+at\\b))`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const words = raw.split(/\s+/);
    if (COMMON_NON_NAME_STARTS.has(words[0])) continue;
    if (words.some((w) => COMMON_LEGAL_PHRASE_WORDS.has(w))) continue;
    out.push({
      start: m.index,
      end: m.index + raw.length,
      raw,
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
  // etc. rather than a position-based exclusion. We also drop any span
  // whose words intersect the US state abbreviation set or the
  // common-legal-phrase set, which are common false positives in
  // public-research prompts.
  const re = new RegExp(`\\b(${NAME_WORD}\\s+${NAME_WORD}(?:\\s+${NAME_WORD})?)\\b`, 'g');
  const out: NameSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const words = raw.split(/\s+/);
    const firstWord = words[0];
    if (COMMON_NON_NAME_STARTS.has(firstWord)) continue;
    // If any word in the candidate is a US state abbreviation, this is
    // almost certainly an address fragment (e.g. "Francisco CA 94123"),
    // not a personal name.
    if (words.some((w) => US_STATE_ABBR.has(w))) continue;
    // If any word is a public-legal phrase token (Code, Court,
    // Constitution, Procedure, Rights, etc.), the bigram is a topic
    // phrase, not a personal name. The allowlist catches the
    // canonical forms; this catches the long-tail.
    if (words.some((w) => COMMON_LEGAL_PHRASE_WORDS.has(w))) continue;
    out.push({
      start: m.index,
      end: m.index + raw.length,
      raw,
      signal: 'capitalized_bigram',
    });
  }
  return out;
}

const US_STATE_ABBR = new Set<string>([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
]);

/**
 * Words that, when present in a bigram span, mark it as a topic phrase
 * rather than a personal name. Keeps "California Probate Code",
 * "Superior Court", "Civil Procedure", "Privacy Act", etc. from being
 * tokenized by the broad bigram scanner. The allowlist still does the
 * heavy lifting for canonical statute and case citations.
 */
const COMMON_LEGAL_PHRASE_WORDS = new Set<string>([
  'Code',
  'Court',
  'Courts',
  'Procedure',
  'Procedures',
  'Constitution',
  'Constitutional',
  'Act',
  'Acts',
  'Rights',
  'Rule',
  'Rules',
  'Section',
  'Article',
  'Amendment',
  'Probate',
  'Civil',
  'Criminal',
  'Family',
  'Penal',
  'Government',
  'Corporations',
  'Evidence',
  'Labor',
  'Welfare',
  'Health',
  'Education',
  'Insurance',
  'Vehicle',
  'Water',
  'Public',
  'Federal',
  'State',
  'Superior',
  'Supreme',
  'Appellate',
  'District',
  'Privacy',
  'Tax',
  'Taxation',
  'Business',
  'Professions',
  'Department',
  'Bureau',
  'Commission',
  'Board',
  'Agency',
  'Office',
  'County',
  'City',
  'Statute',
  'Statutes',
  'Reporter',
  'Reports',
]);

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
  // Topic phrases that commonly start California legal questions but are
  // never personal names.
  'California',
  "California's",
  'Cal',
  'Federal',
  // Imperative verbs that commonly anchor research prompts.
  'Summarize',
  'Explain',
  'Outline',
  'Describe',
  'Identify',
  'List',
  'Compare',
  'Define',
  'Analyze',
  'Discuss',
  'Provide',
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

/**
 * Case-insensitive scanner for the common attorney pattern of writing a
 * client name in lowercase: "help james donde", "represent maria garcia",
 * "client john smith", "advising bob lee". The capitalized scanners miss
 * these completely, so they were leaking through to Bedrock and to chat
 * persistence as raw names.
 *
 * To keep false positives down we require BOTH:
 *   - A strong cue word immediately before the candidate (a verb like
 *     `help`/`represent`/`advise`/`defend`/`sue`, or a relational role
 *     like `client`/`spouse`/`son`).
 *   - A multi-word candidate (two to four word-tokens). Single-word
 *     lowercase capture would fire on "help me", "client wants", etc.
 *
 * Each captured token is filtered against a stop-word set (pronouns,
 * determiners, modal verbs, common follow-on words). If any token in the
 * candidate is a stop word, the whole span is dropped.
 */
const STRONG_VERB_CUE = `(?:help|helping|helped|represent|representing|represented|advise|advising|advised|defend|defending|defended|prosecute|prosecuting|prosecuted|sue|suing|sued|file\\s+against|talk\\s+to|meet\\s+with|consult\\s+with|interview|interviewing|deposed?|deposition\\s+of|on\\s+behalf\\s+of|engage|engaging|engaged|retain|retaining|retained|hire|hiring|hired|want|wants|wanted|need|needs|needed|ask|asks|asked|asking|tell|tells|told|call|calls|called|email|emails|emailed|contact|contacted|paid|pay|pays|owe|owes|owed)`;

const RELATIONAL_CUE_CI =
  `(?:client|ward|decedent|deceased|testator|testatrix|trustor|settlor|trustee|beneficiary|guardian|conservator|conservatee|personal\\s+representative|executor|executrix|administrator|administratrix|petitioner|respondent|plaintiff|defendant|debtor|creditor|assignor|assignee|opposing\\s+party|husband|wife|spouse|son|daughter|child|sibling|brother|sister|mother|father|parent|partner|fiance|fiancee|niece|nephew|cousin|aunt|uncle|friend|colleague|coworker|employee|tenant|landlord)`;

const LOWERCASE_NAME_STOPWORDS = new Set<string>([
  // Pronouns
  'me', 'you', 'him', 'her', 'it', 'us', 'them', 'i', 'we', 'they', 'he', 'she',
  'my', 'your', 'his', 'their', 'our', 'its',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
  // Determiners / quantifiers
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'all',
  'no', 'each', 'every', 'either', 'neither', 'both', 'one', 'two', 'three',
  'such', 'same', 'other', 'another', 'much', 'many', 'more', 'less', 'most',
  // Common verbs / aux
  'is', 'was', 'are', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
  'might', 'must', 'shall', 'need', 'needs', 'needed', 'wants', 'wanted',
  'want', 'going', 'gets', 'got', 'getting',
  // Prepositions / conjunctions (extended — many prepositions appear in
  // legal phrasing like "waived under California Code")
  'with', 'to', 'for', 'from', 'at', 'by', 'of', 'in', 'on', 'about', 'as',
  'and', 'or', 'but', 'if', 'then', 'so', 'because', 'when', 'while', 'until',
  'under', 'over', 'above', 'below', 'between', 'against', 'through',
  'during', 'before', 'after', 'around', 'within', 'without', 'beyond',
  'into', 'onto', 'upon', 'across', 'along', 'beside', 'besides',
  // Wh-words
  'who', 'what', 'whom', 'whose', 'which', 'where', 'why', 'how',
  // Polite / time
  'please', 'today', 'tomorrow', 'yesterday', 'now', 'soon', 'later',
  // Generic referents
  'someone', 'somebody', 'anyone', 'anybody', 'everyone', 'everybody',
  'nobody', 'noone',
  // Role words (the cue itself shouldn't be re-captured as the name)
  'client', 'clients', 'spouse', 'son', 'daughter', 'child', 'children',
  'wife', 'husband', 'partner', 'sibling', 'brother', 'sister', 'mother',
  'father', 'parent', 'friend', 'colleague',
  // Common legal nouns / verbs that surface in lowercase contexts
  'privilege', 'waived', 'granted', 'denied', 'filed', 'served', 'arrived',
  'court', 'case', 'matter', 'issue', 'claim', 'motion', 'order', 'judgment',
  'serve', 'file', 'sue', 'settle', 'settled', 'discovery', 'request',
  'requests', 'subpoena', 'deposition', 'pleading', 'pleadings', 'objection',
  'objections', 'response', 'responses', 'pay', 'pays', 'paid', 'owe',
  'owes', 'owed', 'sign', 'signs', 'signed', 'signed.',
]);

function scanLowercaseCue(text: string): NameSpan[] {
  const cueRe = new RegExp(
    `\\b(?:[Mm]y\\s+|[Oo]ur\\s+|[Tt]he\\s+|[Aa]\\s+|[Hh]is\\s+|[Hh]er\\s+|[Tt]heir\\s+)?(?:${STRONG_VERB_CUE}|${RELATIONAL_CUE_CI})(?:\\s+named|\\s+called)?\\s+`,
    'gi'
  );
  // Try the longest plausible name first (3 tokens) and fall back to 2.
  // Greedy matching with a single regex would capture stop-word tails like
  // "james donde with" and then reject the whole span — losing the valid
  // 2-word slice. Cascading matches keep "james donde" while still
  // letting "first middle last" through when no stop word follows.
  // Token character class accepts upper- or lowercase first letter so
  // mixed-case names like "arjun Divecha" or "John smith" qualify. The
  // stop-word filter still applies to all tokens lowercased.
  const tokenCandidates = [
    /^([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){2})\b/,
    /^([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){1})\b/,
  ];
  const out: NameSpan[] = [];
  let cueMatch: RegExpExecArray | null;
  while ((cueMatch = cueRe.exec(text)) !== null) {
    // If the cue is part of a hyphenated compound (e.g. "attorney-client"),
    // the leading word boundary fires between the `-` and the cue, but the
    // semantics are not relational. Reject when the char immediately
    // preceding the cue is a hyphen.
    const cueAbsStart = cueMatch.index;
    if (cueAbsStart > 0 && text[cueAbsStart - 1] === '-') continue;
    const nameStart = cueAbsStart + cueMatch[0].length;
    const tail = text.slice(nameStart);
    for (const re of tokenCandidates) {
      const m = re.exec(tail);
      if (!m) continue;
      const raw = m[1];
      const words = raw.split(/\s+/);
      const lowered = words.map((w) => w.toLowerCase());
      if (lowered.some((w) => LOWERCASE_NAME_STOPWORDS.has(w))) continue;
      if (lowered.some((w) => /ing$/.test(w) && w.length > 4)) continue;
      // Reject candidates whose tokens look like past-tense verbs
      // ("called", "asked", "filed"). Names ending in -ed are rare and
      // typically <5 chars ("Reed", "Fred"); 5+ char -ed words are
      // overwhelmingly verbs.
      if (lowered.some((w) => /ed$/.test(w) && w.length >= 5)) continue;
      // Filter known topic-phrase / legal-noun tokens regardless of case.
      const canonicalize = (w: string) =>
        w[0].toUpperCase() + w.slice(1).toLowerCase();
      if (words.some((w) => COMMON_LEGAL_PHRASE_WORDS.has(canonicalize(w)))) continue;
      if (words.some((w) => COMMON_NON_NAME_STARTS.has(canonicalize(w)))) continue;
      if (words.some((w) => US_STATE_ABBR.has(w.toUpperCase()))) continue;
      out.push({
        start: nameStart,
        end: nameStart + raw.length,
        raw,
        signal: 'cue_lowercase',
      });
      break;
    }
  }
  return out;
}

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
    ...scanLowercaseCue(text),
  ];
}
