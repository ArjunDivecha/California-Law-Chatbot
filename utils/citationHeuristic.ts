/**
 * utils/citationHeuristic.ts
 *
 * Lightweight browser-side detector for citation-looking text, used only to
 * decide whether to show "citations not verified" disclosures in the UI
 * (V2DraftPage banner, V2ChatPage fallback chip). It is deliberately a
 * heuristic: false positives cost one extra banner; false negatives cost a
 * missing disclosure — so it errs toward matching.
 *
 * This is NOT a parser and must not be used for verification itself — the
 * server-side extractCitations()/extractStatuteCitations() own that.
 *
 * No file I/O.
 */

// Case reporters common in California practice: "123 Cal.App.4th 456",
// "12 Cal.5th 1", "550 U.S. 544", "98 Cal.Rptr.3d 22", "123 F.3d 456",
// "456 P.3d 789" — number + reporter + number.
const CASE_REPORTER_RE =
  /\b\d{1,4}\s+(?:Cal\.(?:App\.)?\s?(?:2d|3d|4th|5th|6th)?|Cal\.Rptr\.(?:2d|3d)?|U\.S\.|S\.Ct\.|F\.(?:2d|3d|4th)|F\.Supp\.(?:2d|3d)?|P\.(?:2d|3d))\s+\d{1,5}\b/;

// Statutes: "Fam. Code § 2030", "Code Civ. Proc. § 128.5", "Family Code
// section 271", "Cal. Rules of Court, rule 5.92".
const STATUTE_RE =
  /(?:§|\bsection\s+\d)|\b(?:Fam(?:ily)?\.?|Civ(?:il)?\.?|Prob(?:ate)?\.?|Penal|Evid(?:ence)?\.?|Welf\.?|Bus\.?|Gov(?:'t|ernment)?\.?)\s?(?:&\s?(?:Prof|Inst)\.?\s?)?Code\b|\bCal\.\s?Rules\s+of\s+Court\b/i;

/**
 * True when the text plausibly contains a legal citation (case reporter or
 * California statute). Used to gate unverified-citation disclosures.
 */
export function hasCitationLikeText(text: string): boolean {
  if (!text) return false;
  return CASE_REPORTER_RE.test(text) || STATUTE_RE.test(text);
}
