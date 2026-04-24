/**
 * Citation Grounding
 *
 * Post-generation safety net: every specific legal citation that appears in
 * the answer text must also appear in at least one retrieved source. If it
 * does not, the citation is ungrounded — a hallucination candidate — and
 * the caller should downgrade the verification status.
 *
 * We intentionally parse loosely. It is better to flag a borderline citation
 * as ungrounded than to let a hallucinated one through silently.
 */

export interface Citation {
  kind: 'bill' | 'statute';
  raw: string;        // exact matched text
  normalized: string; // canonical form used for lookup, e.g. "AB2989"
}

export interface UngroundedCitationResult {
  citations: Citation[];
  ungrounded: Citation[];
  groundedCount: number;
}

const BILL_PATTERNS: RegExp[] = [
  // AB 2989, AB2989, A.B. 2989
  /\b(A\.?B\.?|S\.?B\.?|A\.?C\.?A\.?|S\.?C\.?A\.?|A\.?J\.?R\.?|S\.?J\.?R\.?)\s*\.?\s*(\d{1,4})\b/gi,
];

const STATUTE_PATTERN =
  /\b(Family|Probate|Civil|Penal|Government|Corporations|Evidence|Labor|Business and Professions|Welfare and Institutions|Code of Civil Procedure|Code Civ\.? Proc\.?|Bus\.? & Prof\.?|Welf\.? & Inst\.?)\s*(?:Code)?\s*(?:§|sec(?:tion)?\.?)\s*(\d+(?:\.\d+)?(?:\([a-z0-9]+\))*)/gi;

function normalizeBill(prefix: string, number: string): string {
  // "AB 2989" -> "AB2989", "A.B. 2989" -> "AB2989"
  return `${prefix.replace(/[.\s]/g, '').toUpperCase()}${number}`;
}

function normalizeStatute(code: string, section: string): string {
  const canonicalCode = code
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${canonicalCode}|${section}`;
}

/**
 * Extract every bill and statute citation from the answer.
 */
export function extractCitations(answerText: string): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();

  for (const pattern of BILL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(answerText)) !== null) {
      const raw = m[0];
      const normalized = normalizeBill(m[1], m[2]);
      if (seen.has(`bill:${normalized}`)) continue;
      seen.add(`bill:${normalized}`);
      out.push({ kind: 'bill', raw, normalized });
    }
  }

  STATUTE_PATTERN.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = STATUTE_PATTERN.exec(answerText)) !== null) {
    const raw = sm[0];
    const normalized = normalizeStatute(sm[1], sm[2]);
    if (seen.has(`statute:${normalized}`)) continue;
    seen.add(`statute:${normalized}`);
    out.push({ kind: 'statute', raw, normalized });
  }

  return out;
}

/**
 * Flatten a source bundle into a single searchable text haystack. We look at
 * title, url, excerpt, and any obviously citation-carrying fields. Case
 * insensitive, punctuation tolerant.
 */
export function buildSourceHaystack(
  sources: Array<{ title?: string; url?: string; excerpt?: string; cebCitation?: string }>
): string {
  return sources
    .map((s) =>
      [s.title, s.url, s.excerpt, (s as { cebCitation?: string }).cebCitation]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join(' | ')
    )
    .join(' || ')
    .toLowerCase();
}

function haystackContainsBill(haystack: string, normalized: string): boolean {
  // normalized looks like "AB2989". Match either the compact form or any
  // spaced/dotted variant on either side.
  const prefix = normalized.replace(/\d/g, '');
  const number = normalized.replace(/\D/g, '');
  const variants = [
    normalized.toLowerCase(),
    `${prefix.toLowerCase()} ${number}`,
    `${prefix.toLowerCase()} ${number}`,
    `${prefix.split('').join('.').toLowerCase()} ${number}`,
  ];
  return variants.some((v) => haystack.includes(v));
}

function haystackContainsStatute(haystack: string, normalized: string): boolean {
  const [code, section] = normalized.split('|');
  if (!code || !section) return false;
  // Require both the code and the section to appear (not necessarily adjacent,
  // but both present — a conservative proxy for "this source references the
  // statute").
  return haystack.includes(code) && haystack.includes(section);
}

/**
 * Determine which answer citations are NOT supported by any retrieved source.
 * Returns the full extraction report so the caller can log it.
 */
export function findUngroundedCitations(
  answerText: string,
  sources: Array<{ title?: string; url?: string; excerpt?: string; cebCitation?: string }>
): UngroundedCitationResult {
  const citations = extractCitations(answerText);
  const haystack = buildSourceHaystack(sources);
  const ungrounded: Citation[] = [];

  for (const c of citations) {
    const grounded =
      c.kind === 'bill'
        ? haystackContainsBill(haystack, c.normalized)
        : haystackContainsStatute(haystack, c.normalized);
    if (!grounded) ungrounded.push(c);
  }

  return {
    citations,
    ungrounded,
    groundedCount: citations.length - ungrounded.length,
  };
}

export interface CebDominanceResult {
  cebCitedCount: number;
  nonCebCitedCount: number;
  isCebDominant: boolean;
}

/**
 * Count bracketed `[N]` citations in the answer and classify each cited
 * source as CEB or non-CEB. The "CEB Verified" amber badge should only
 * appear when the *cited* source mix is CEB-dominant — not merely because
 * CEB embeddings happened to show up in the retrieval set.
 *
 * Rule: CEB-dominant if cebCitedCount > 0 AND cebCitedCount >= nonCebCitedCount.
 * A tie resolves in favor of CEB (attorney-friendly: if CEB backs half the
 * answer, the authoritative-source framing is reasonable).
 */
export function analyzeCebDominance(
  answerText: string,
  sources: Array<{ id?: string; isCEB?: boolean }>
): CebDominanceResult {
  const citationPattern = /\[(\d+)\]/g;
  const cited = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = citationPattern.exec(answerText)) !== null) {
    cited.add(m[1]);
  }

  let cebCitedCount = 0;
  let nonCebCitedCount = 0;
  for (const id of cited) {
    const source = sources.find((s) => s.id === id);
    if (!source) continue;
    if (source.isCEB === true) cebCitedCount += 1;
    else nonCebCitedCount += 1;
  }

  const isCebDominant = cebCitedCount > 0 && cebCitedCount >= nonCebCitedCount;
  return { cebCitedCount, nonCebCitedCount, isCebDominant };
}

/**
 * Short human-facing caveat when ungrounded citations are present.
 * Lists up to 4 so the UI has something concrete to show.
 */
export function ungroundedCitationCaveat(result: UngroundedCitationResult): string {
  if (result.ungrounded.length === 0) return '';
  const shown = result.ungrounded.slice(0, 4).map((c) => c.raw).join(', ');
  const more = result.ungrounded.length > 4 ? ` and ${result.ungrounded.length - 4} more` : '';
  return `⚠️ These citations in the answer are not in the retrieved source list: ${shown}${more}. They may be hallucinated — verify before relying on them.`;
}
