/**
 * b7-specs-b.mjs
 *
 * WHAT THIS DOES
 * --------------
 * Task specifications for longcontext-006..010 of batch B7 of the
 * california-law-v1 evaluation dataset. Companion to b7-specs-a.mjs; see that
 * file's header for the shape of a spec.
 *
 * INPUT FILES:  none directly (consumed by b7-builder.mjs).
 * OUTPUT FILES: none (module).
 *
 * NOTES
 *  - Every party, firm, court department, case number, account, exhibit, and
 *    event below is invented. Nothing is drawn from any real matter.
 */

import { day } from './b7-builder-lib.mjs';
import { mkCtx } from './b7-specs-a.mjs';

const INSTRUCTION =
  'You are assisting a California family-law attorney. The complete litigation file for the matter is reproduced below. It is long, it is repetitive, and most of it is routine. Every party, document, account, and event in it is synthetic. Read the whole file, locate the facts that actually matter, and then answer the question that follows the end-of-file marker. Rely only on the case file and on the California authority supplied in the evidence packet; do not import facts or authority from outside them.';

/* ================================================================== *
 * longcontext-006 — FAM 1615 execution-timeline enforceability
 * ================================================================== */

const CTX6 = mkCtx({
  court: 'Superior Court of California, County of Los Angeles',
  caption: 'In re the Marriage of PETTIBONE-ACHEBE and NKEMELU-STRAND',
  caseNo: '26-STFL-004417',
  petitioner: 'Xiomara Pettibone-Achebe',
  respondent: 'Bartholomew Nkemelu-Strand',
  petCounsel: 'Griselda Auchincloss, Esq.',
  petFirm: 'Auchincloss Vantol LLP, 5500 Wilbraham Terrace, Suite 2200, Los Angeles, California',
  resCounsel: 'Thaddeus Mbwana-Ferrier, Esq.',
  resFirm: 'Mbwana-Ferrier & Osgood, 1310 Sandpiper Circle, Pasadena, California',
  bates: 'PA',
  fileStart: day(2026, 1, 6),
});

const T6 = {
  id: 'longcontext-006',
  anchor: 'FAM 1615(a)(1), (c), (c)(1), (c)(2)(B) premarital agreement execution timeline buried in a correspondence file',
  ctx: CTX6,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 4200 },
    { kind: 'billing', words: 7200 },
    { kind: 'correspondence', words: 14000, label: 'CORRESPONDENCE FILE — PREMARITAL AGREEMENT NEGOTIATION AND LITIGATION', inserts: [
      { frac: 0.2, text: `
------------------------------------------------------------------------------
TRANSMITTAL — DRAFT CIRCULATION LOG ENTRY 011
Auchincloss Vantol LLP
August 2, 2023

Bartholomew Nkemelu-Strand (unrepresented, sent directly)

Re:  Proposed Premarital Agreement — DRAFT VERSION 3 (NOT FINAL)
Via: Electronic mail, 11:14 a.m.

Bartholomew:

Attached is Draft Version 3 of the proposed premarital agreement. This is a working draft and is not the final agreement. Article 7 (spousal support) and Article 11 (characterization of the Sandpiper Circle property) are still open and are expected to change materially. Please do not sign this version. We will send the execution version once Xiomara has decided the two open points.

Griselda Auchincloss, Esq.` },
      { frac: 0.63, text: `
------------------------------------------------------------------------------
TRANSMITTAL — DRAFT CIRCULATION LOG ENTRY 019
Auchincloss Vantol LLP
September 12, 2023

Bartholomew Nkemelu-Strand (unrepresented, sent directly)

Re:  Premarital Agreement — FINAL EXECUTION VERSION
Via: Electronic mail, 4:47 p.m. (delivery receipt returned 4:47 p.m. the same day)

Bartholomew:

Attached is the FINAL EXECUTION VERSION of the Premarital Agreement. Articles 7 and 11 are now closed and this document supersedes Draft Version 3 circulated August 2, 2023 in substance as well as in form: Article 7 has been rewritten to add a mutual waiver of spousal support that Draft Version 3 did not contain, and Article 11 now characterizes the Sandpiper Circle property as Xiomara's separate property, which is the opposite of what Draft Version 3 provided. These are substantive changes, not nonsubstantive amendments.

This is also our advisement to you, in writing, that you should retain your own independent legal counsel to review this agreement before you sign it. You have not been represented by counsel at any point in this negotiation.

The wedding is set for October 7, 2023 and Xiomara would like the agreement signed before the rehearsal dinner.

Griselda Auchincloss, Esq.` },
      { frac: 0.79, text: `
------------------------------------------------------------------------------
NOTARY JOURNAL EXCERPT AND EXECUTION PAGE — LODGED AS EXHIBIT
Notary journal of Ardelia Winterbourne, Commission No. 2318804

Entry 1147.  Date of notarial act: September 18, 2023, 10:05 a.m.
             Document: Premarital Agreement, 31 pages, dated September 18, 2023.
             Signers appearing: Xiomara Pettibone-Achebe; Bartholomew Nkemelu-Strand.
             Identification: California driver licenses, examined.
             Note recorded by notary at signer's request: "Signer Nkemelu-Strand
             stated on the record that he received the final document on
             September 12, 2023, that he has no attorney, and that he did not
             sign any separate writing waiving representation by independent
             legal counsel."

Execution page recital: "Executed at Los Angeles, California, on September 18, 2023."

Counsel's file note: no separate writing signed by Bartholomew Nkemelu-Strand waiving representation by independent legal counsel appears anywhere in this file or in either party's document production. No writing memorializing an explanation to him of the rights and obligations he was relinquishing appears anywhere in this file or in either party's document production. The parties married on October 7, 2023.` },
    ] },
    { kind: 'declaration', words: 8600 },
    { kind: 'ledger', words: 6000 },
    { kind: 'depo', words: 5200 },
    { kind: 'discovery', words: 3200 },
    { kind: 'minutes', words: 1200 },
    { kind: 'emails', words: 900 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner seeks to enforce the premarital agreement against Respondent. Using only this case file and the supplied California Family Code authority:

(1) State the date on which Respondent was first presented with the FINAL agreement, the date he signed it, and the number of calendar days between them.
(2) Explain why the August 2, 2023 draft circulation is not the relevant starting point.
(3) State whether the agreement is deemed to have been executed voluntarily, identifying each requirement in the statute that this file satisfies or fails, and state the consequence for enforceability.`,
  prompt:
    'Long-context California premarital-agreement enforceability problem (all parties, documents, and facts synthetic). A roughly 50,000-word consolidated litigation file is embedded in the graded turn, with the operative facts buried inside a 14,000-word correspondence section at roughly 20, 63, and 79 percent of that section. The buried facts: Draft Version 3 was circulated August 2, 2023 and expressly labelled not final, with two articles still open; the FINAL EXECUTION VERSION was transmitted September 12, 2023 at 4:47 p.m. with substantive changes to Articles 7 and 11 (so the nonsubstantive-amendment carve-out does not apply) and with the written advisement to retain independent counsel given the same day; the agreement was signed September 18, 2023, six calendar days later; the respondent was unrepresented throughout, signed no separate writing waiving representation by independent legal counsel, and received no writing memorializing the rights and obligations he was relinquishing; and the parties married October 7, 2023. The graded answer must apply Family Code section 1615(c)(2)(B) for agreements executed on or after January 1, 2020, section 1615(c)(1), section 1615(c)(3), and section 1615(a)(1).',
  buriedFacts: [
    'FINAL EXECUTION VERSION first presented September 12, 2023 at 4:47 p.m., with substantive changes to Articles 7 and 11 (correspondence section, depth ~0.63)',
    'Agreement signed September 18, 2023 per the notary journal excerpt, six calendar days after first presentation (correspondence section, depth ~0.79)',
    'Advisement to seek independent legal counsel given in writing on September 12, 2023, the same day the final agreement was presented',
    'No separate writing waiving representation by independent legal counsel and no writing memorializing the rights relinquished exists anywhere in the file',
  ],
  distractors: [
    'Draft Version 3 circulated August 2, 2023, expressly labelled not final and superseded by substantive changes (correspondence section, depth ~0.20)',
  ],
  buriedChecks: ['September 12, 2023', 'September 18, 2023', 'August 2, 2023', 'October 7, 2023'],
  propositions: [
    {
      pid: 'longcontext-006-p1',
      source: 'STAT-CAL-FAM-CODE-1615',
      ascii:
        'For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.',
      proposition:
        'For a premarital agreement executed on or after January 1, 2020, the party against whom enforcement is sought must have had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of representation; the requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.',
    },
    {
      pid: 'longcontext-006-p2',
      source: 'STAT-CAL-FAM-CODE-1615',
      ascii:
        'The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed.',
      proposition:
        'Voluntary execution requires that the party against whom enforcement is sought was represented by independent legal counsel at the time of signing or, after being advised to seek independent legal counsel, expressly waived that representation in a separate writing, and the advisement shall be made at least seven calendar days before the final agreement is signed.',
    },
    {
      pid: 'longcontext-006-p3',
      source: 'STAT-CAL-FAM-CODE-1615',
      ascii:
        'The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement.',
      proposition:
        'An unrepresented party must have been fully informed of the terms and basic effect of the agreement and of the rights and obligations being given up, and the explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement.',
    },
    {
      pid: 'longcontext-006-p4',
      source: 'STAT-CAL-FAM-CODE-1615',
      ascii:
        'For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following:',
      proposition:
        'A premarital agreement is deemed not to have been executed voluntarily unless the court finds in writing or on the record all of the enumerated requirements of section 1615(c).',
    },
    {
      pid: 'longcontext-006-p5',
      source: 'STAT-CAL-FAM-CODE-1615',
      ascii:
        'A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily.',
      proposition:
        'A premarital agreement is not enforceable if the party against whom enforcement is sought proves that the party did not execute the agreement voluntarily.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-006-c1',
      description:
        'Retrieves the buried transmittal and notary entries and states that Respondent was first presented with the final agreement on September 12, 2023 and signed on September 18, 2023, an interval of six calendar days, which is less than the seven calendar days section 1615(c)(2)(B) requires for an agreement executed on or after January 1, 2020, regardless of whether the party is represented by counsel.',
      pids: ['longcontext-006-p1'],
    },
    {
      cid: 'longcontext-006-c2',
      description:
        'Explains that the August 2, 2023 circulation of Draft Version 3 does not start the seven-day clock because that draft was not the final agreement and the changes made to Articles 7 and 11 were substantive, so the statutory carve-out for nonsubstantive amendments that do not change the terms of the agreement does not apply.',
      pids: ['longcontext-006-p1'],
    },
    {
      cid: 'longcontext-006-c3',
      description:
        'Applies section 1615(c)(1) to the buried facts: Respondent was not represented by independent legal counsel at signing and signed no separate writing expressly waiving that representation, and in any event the September 12, 2023 advisement was not made at least seven calendar days before the final agreement was signed.',
      pids: ['longcontext-006-p2'],
    },
    {
      cid: 'longcontext-006-c4',
      description:
        'Applies section 1615(c)(3) to the buried fact that no writing memorializing the rights and obligations relinquished was delivered to the unrepresented Respondent before signing.',
      pids: ['longcontext-006-p3'],
    },
    {
      cid: 'longcontext-006-c5',
      description:
        'Concludes that because the court cannot find all of the section 1615(c) requirements, the agreement is deemed not to have been executed voluntarily, and that a premarital agreement is not enforceable if the party against whom enforcement is sought proves that the party did not execute it voluntarily.',
      pids: ['longcontext-006-p4', 'longcontext-006-p5'],
    },
  ],
  assertions: [
    { aid: 'longcontext-006-a1', kind: 'contains', expected: ['September 12, 2023'] },
    { aid: 'longcontext-006-a2', kind: 'statute', expected: ['1615'] },
    {
      aid: 'longcontext-006-a3',
      kind: 'contains',
      expected: ['seven calendar days'],
      hard_failure_code: 'WRONG_EFFECTIVE_DATE',
      legal_phrase: true,
    },
    {
      aid: 'longcontext-006-a4',
      kind: 'not_contains',
      expected: ['first presented with the final agreement on August 2, 2023'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-007 — FAM 2102 / 1100 / 721 fiduciary breach
 * ================================================================== */

const CTX7 = mkCtx({
  court: 'Superior Court of California, County of San Diego',
  caption: 'In re the Marriage of ASHCOMBE-NAKAGAWA and THORVALDSEN-RUIZ',
  caseNo: '24-FL-092235',
  petitioner: 'Solveig Ashcombe-Nakagawa',
  respondent: 'Emeka Thorvaldsen-Ruiz',
  petCounsel: 'Lucinda Trethewey-Obi, Esq.',
  petFirm: 'Trethewey Obi LLP, 4110 Ironwood Mesa, Suite 605, San Diego, California',
  resCounsel: 'Alaric Penhaligon, Esq.',
  resFirm: 'Penhaligon Marchetti LLP, 77 Saguaro Point Road, La Jolla, California',
  bates: 'AN',
  fileStart: day(2024, 3, 5),
});

const T7 = {
  id: 'longcontext-007',
  anchor: 'FAM 2102(a)(1)-(2), 1100(b), 721(b) post-separation fiduciary duties applied to buried transactions',
  ctx: CTX7,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'correspondence', words: 8600 },
    { kind: 'exhibits', words: 3400, inserts: [{ frac: 0.55, text: `
EX. 0208A  |  03/03/2023  |  Assignment of 5% Membership Interest, Harborline Systems LLC, from Emeka Thorvaldsen-Ruiz to Ravensmoor Holdings LLC for stated consideration of $84,000.00, WITH the written consent of Solveig Ashcombe-Nakagawa endorsed on the signature page and separately acknowledged  |  Bates AN-004118 through AN-004131
EX. 0208B  |  03/03/2023  |  Spousal written consent to the 5% assignment, signed by Solveig Ashcombe-Nakagawa  |  Bates AN-004132 through AN-004133
EX. 0208C  |  03/06/2023  |  Deposit advice, $84,000.00 wired to the parties' joint account  |  Bates AN-004134` }] },
    { kind: 'billing', words: 5600 },
    { kind: 'declaration', words: 5800 },
    { kind: 'ledger', words: 6400, label: 'ACCOUNT LEDGER DETAIL — HARBORLINE SYSTEMS LLC OPERATING ACCOUNT AND PARTY ACCOUNTS', inserts: [{ frac: 0.83, text: `
=== TRANSACTION FILE EXTRACT — PRODUCED UNDER PROTECTIVE ORDER, DEMAND SET FOUR ===

Date of separation of the parties, as stipulated by the parties on August 9, 2024: FEBRUARY 14, 2024.

Item 1.  ASSIGNMENT OF MEMBERSHIP INTEREST dated JUNE 27, 2024.
         Assignor:      Emeka Thorvaldsen-Ruiz
         Assignee:      Obadiah Thorvaldsen-Ruiz (assignor's brother)
         Interest:      40% membership interest in Harborline Systems LLC
         Consideration: $1.00
         Recital in the instrument: "The parties acknowledge that the fair market
         value of the transferred interest substantially exceeds the stated
         consideration and that the transfer is intended in part as a gift."
         Valuation in the file: the jointly retained appraiser valued the 40%
         interest at $1,410,000.00 as of June 30, 2024 (Bates AN-014902).
         Spousal consent: NONE. No writing signed by Solveig Ashcombe-Nakagawa
         consenting to this transfer appears anywhere in either party's
         production. Petitioner first learned of the transfer when the operating
         agreement amendment was produced on January 21, 2025.
         Character of the interest: Harborline Systems LLC was formed during the
         marriage with community funds and the membership interest is community
         personal property. Respondent has at all times operated and managed the
         business.

Item 2.  ROLLOVER EQUITY OFFERING, first presented to Respondent MAY 3, 2024.
         Source: Cindermill Capital Partners offered participation in a rollover
         equity tranche to Harborline Systems LLC principals. The offering arose
         directly out of the Cindermill engagement that Harborline Systems LLC
         began in November 2021, during the marriage.
         Respondent subscribed for the tranche on May 22, 2024 using $310,000.00
         drawn from the Harborline operating account.
         Written disclosure to Petitioner: NONE. No written disclosure of this
         opportunity was made to Petitioner at any time. Petitioner had no
         opportunity to decide whether she wished to participate and no dispute
         about her right to participate was presented to the court.` }] },
    { kind: 'depo', words: 4400 },
    { kind: 'discovery', words: 2800 },
    { kind: 'minutes', words: 1200 },
    { kind: 'emails', words: 900 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner intends to move for relief arising from Respondent's post-separation conduct. Using only this case file and the supplied California Family Code authority:

(1) Identify each post-separation transaction in this file that raises a fiduciary problem, with its date and the reason.
(2) State what standard governs the parties from the date of separation and what specific disclosure the statute required as to the investment opportunity.
(3) State the rule that applies to the transfer of the membership interest and why the March 3, 2023 transaction does not present the same problem.`,
  prompt:
    'Long-context California marital fiduciary-duty problem (all parties, documents, and facts synthetic). A roughly 39,000-word consolidated litigation file is embedded in the graded turn. A transaction-file extract buried at about 83 percent depth of the ledger section establishes the operative facts: the stipulated date of separation is February 14, 2024; on June 27, 2024 the respondent assigned a 40 percent community membership interest in Harborline Systems LLC, appraised at $1,410,000.00, to his brother for $1.00, with a recital that the transfer was intended in part as a gift and with no written spousal consent anywhere in the production; and on May 3, 2024 he was presented with a Cindermill Capital rollover equity opportunity arising out of a business engagement begun during the marriage, which he subscribed for on May 22, 2024 without any written disclosure to the petitioner. An exhibit insert at mid-depth shows an earlier March 3, 2023 assignment of a 5 percent interest for $84,000.00 that carried the petitioner’s written consent and predates separation. The graded answer must apply Family Code sections 2102(a), 2102(a)(2), 1100(b), and 721(b).',
  buriedFacts: [
    'Stipulated date of separation February 14, 2024 (ledger-section extract, depth ~0.83)',
    'June 27, 2024 assignment of a 40% community membership interest appraised at $1,410,000.00 to the respondent’s brother for $1.00, recited in part as a gift, with no written spousal consent',
    'May 3, 2024 rollover equity opportunity arising from a November 2021 engagement begun during the marriage, subscribed May 22, 2024, with no written disclosure to the petitioner',
  ],
  distractors: [
    'March 3, 2023 assignment of a 5% interest for $84,000.00 that predates separation and carries the petitioner’s endorsed written consent (exhibit insert, depth ~0.55)',
  ],
  buriedChecks: ['June 27, 2024', 'February 14, 2024', 'May 3, 2024', '$1,410,000.00', 'March 3, 2023'],
  propositions: [
    {
      pid: 'longcontext-007-p1',
      source: 'STAT-CAL-FAM-CODE-2102',
      ascii:
        'From the date of separation to the date of the distribution of the community or quasi-community asset or liability in question, each party is subject to the standards provided in Section 721, as to all activities that affect the assets and liabilities of the other party',
      proposition:
        'From the date of separation to the date of distribution of the community asset or liability in question, each party is subject to the standards provided in Section 721 as to all activities that affect the assets and liabilities of the other party.',
    },
    {
      pid: 'longcontext-007-p2',
      source: 'STAT-CAL-FAM-CODE-2102',
      ascii:
        'The accurate and complete written disclosure of any investment opportunity, business opportunity, or other income-producing opportunity that presents itself after the date of separation, but that results from any investment, significant business activity outside the ordinary course of business, or other income-producing opportunity of either spouse from the date of marriage to the date of separation, inclusive. The written disclosure shall be made in sufficient time for the other spouse to make an informed decision as to whether the spouse desires to participate in the investment opportunity, business, or other potential income-producing opportunity',
      proposition:
        'A party must make accurate and complete written disclosure of any investment or other income-producing opportunity presenting itself after the date of separation that results from an investment or significant business activity of either spouse between the date of marriage and the date of separation, in sufficient time for the other spouse to make an informed decision whether to participate.',
    },
    {
      pid: 'longcontext-007-p3',
      source: 'STAT-CAL-FAM-CODE-1100',
      ascii:
        'A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.',
      proposition:
        'A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.',
    },
    {
      pid: 'longcontext-007-p4',
      source: 'STAT-CAL-FAM-CODE-721',
      ascii:
        'This confidential relationship imposes a duty of the highest good faith and fair dealing on each spouse, and neither shall take any unfair advantage of the other.',
      proposition:
        'The confidential relationship between spouses imposes a duty of the highest good faith and fair dealing on each spouse, and neither shall take any unfair advantage of the other.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-007-c1',
      description:
        'Retrieves the buried transaction extract and identifies the June 27, 2024 assignment of the 40 percent Harborline Systems LLC membership interest to Respondent’s brother for $1.00, against an appraised value of $1,410,000.00 and with no written spousal consent, as a disposition of community personal property for less than fair and reasonable value and in part as a gift, which Family Code section 1100(b) prohibits without the written consent of the other spouse.',
      pids: ['longcontext-007-p3'],
    },
    {
      cid: 'longcontext-007-c2',
      description:
        'States that from the February 14, 2024 date of separation to distribution each party is subject to the standards provided in Section 721 as to all activities that affect the other party’s assets and liabilities, and that those standards impose a duty of the highest good faith and fair dealing under which neither spouse shall take any unfair advantage of the other.',
      pids: ['longcontext-007-p1', 'longcontext-007-p4'],
    },
    {
      cid: 'longcontext-007-c3',
      description:
        'Applies Family Code section 2102(a)(2) to the buried May 3, 2024 Cindermill rollover equity offering: because it presented itself after the date of separation but resulted from a business activity begun during the marriage, Respondent owed accurate and complete written disclosure in sufficient time for Petitioner to make an informed decision whether to participate, and no such written disclosure was made.',
      pids: ['longcontext-007-p2'],
    },
    {
      cid: 'longcontext-007-c4',
      description:
        'Distinguishes the March 3, 2023 assignment of the 5 percent interest, which predates the February 14, 2024 separation and carries Petitioner’s endorsed written consent, and therefore does not present the section 1100(b) written-consent problem.',
      pids: ['longcontext-007-p3'],
    },
  ],
  assertions: [
    { aid: 'longcontext-007-a1', kind: 'contains', expected: ['June 27, 2024'] },
    { aid: 'longcontext-007-a2', kind: 'statute', expected: ['1100'] },
    { aid: 'longcontext-007-a3', kind: 'contains', expected: ['written consent'] },
    {
      aid: 'longcontext-007-a4',
      kind: 'not_contains',
      expected: ['without the written consent of Petitioner on March 3, 2023'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-008 — FAM 7613 assisted reproduction consent documents
 * ================================================================== */

const CTX8 = mkCtx({
  court: 'Superior Court of California, County of Alameda',
  caption: 'In re the Parentage of the Minor Child L.F.-R.',
  caseNo: '25-FL-055102',
  petitioner: 'Naledi Fairweather-Oyelaran',
  respondent: 'Ignatius Prewitt-Moreau',
  petCounsel: 'Persephone Okuda-Vance, Esq.',
  petFirm: 'Okuda Vance LLP, 909 Wintergreen Landing, Suite 410, Berkeley, California',
  resCounsel: 'Cormac Rathbone-Ilesanmi, Esq.',
  resFirm: 'Rathbone Ilesanmi PC, 220 Foxglove Court, Alameda, California',
  bates: 'FO',
  fileStart: day(2025, 5, 12),
});

const T8 = {
  id: 'longcontext-008',
  anchor: 'FAM 7613(a)(1)-(2), (b)(1), (b)(2)(A) assisted-reproduction consent documents buried in an exhibit and declaration file',
  ctx: CTX8,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'billing', words: 4600 },
    { kind: 'correspondence', words: 7800 },
    { kind: 'exhibits', words: 3200, inserts: [{ frac: 0.7, text: `
EX. 0177A  |  04/29/2022  |  KNOWN DONOR AGREEMENT, signed and dated April 29, 2022 by Ignatius Prewitt-Moreau and by Constance Ravensbourne-Diaz, executed BEFORE the conception of the child, providing at Article 3 that "the donor shall not be a parent of any child conceived with the donated material and renounces and disclaims any parental rights, status, and obligations"  |  Bates FO-005512 through FO-005527
EX. 0177B  |  05/04/2022  |  WRITTEN CONSENT TO ASSISTED REPRODUCTION, signed and dated May 4, 2022 by Constance Ravensbourne-Diaz (the woman conceiving) and by Naledi Fairweather-Oyelaran (the intended parent and Constance's spouse), executed BEFORE conception, reciting that Naledi consents to Constance's conception by assisted reproduction and intends to be a parent of the resulting child  |  Bates FO-005528 through FO-005535
EX. 0177C  |  06/18/2022  |  Insemination log maintained by the parties, first entry June 18, 2022  |  Bates FO-005536 through FO-005544
EX. 0177D  |  09/02/2022  |  Home pregnancy confirmation and first prenatal appointment record  |  Bates FO-005545 through FO-005549` }] },
    { kind: 'declaration', words: 5200, inserts: [{ frac: 0.86, text: `
94A.  I want to correct something in the intake questionnaire our first attorney's office completed for us in 2025. That form states that we used Golden Gate Cryobank. That is wrong, and I do not know where the office got it. We never used a cryobank and we never used a fertility clinic for the insemination.

94B.  What actually happened is that Ignatius, who is a friend of ours from graduate school, provided the semen directly to us at our home on Wintergreen Landing. There was no physician involved. The semen was NOT provided to a licensed physician and surgeon and was NOT provided to a licensed sperm bank. Constance performed the insemination herself at home using a kit we bought online. Our insemination log at Exhibit 0177C records each attempt.

94C.  Before any of that happened, on April 29, 2022, Ignatius and Constance both signed the Known Donor Agreement stating that Ignatius would not be a parent. Five days later, on May 4, 2022, Constance and I both signed the written consent to assisted reproduction stating that I consented and intended to be a parent. Both documents were signed before conception. Constance and I were married in 2019 and remain married.

94D.  Ignatius filed his petition in this case in 2025 asking to be declared the child's father. He has never lived with the child and has never held the child out as his own.` }] },
    { kind: 'ledger', words: 4200 },
    { kind: 'depo', words: 3800 },
    { kind: 'discovery', words: 2400 },
    { kind: 'minutes', words: 1000 },
    { kind: 'emails', words: 800 },
  ],
  question: `QUESTION FOR ANALYSIS

Ignatius Prewitt-Moreau petitions to be declared a parent of the child. Naledi Fairweather-Oyelaran asks the court to confirm her parentage. Using only this case file and the supplied California Family Code authority:

(1) State whether the semen was provided to a licensed physician and surgeon or to a licensed sperm bank, identify the document or declaration that establishes it, and explain which statutory rule that fact selects.
(2) State whether Ignatius Prewitt-Moreau is treated in law as a parent, and why.
(3) State whether Naledi Fairweather-Oyelaran is treated in law as a parent, identifying the document and its date.`,
  prompt:
    'Long-context California assisted-reproduction parentage problem (all parties, documents, and facts synthetic). A roughly 33,000-word consolidated litigation file is embedded in the graded turn. An exhibit insert at about 70 percent of the exhibit section catalogues a Known Donor Agreement signed April 29, 2022 by the known donor and the woman conceiving, before conception, providing that the donor shall not be a parent, and a written consent to assisted reproduction signed May 4, 2022 by the woman conceiving and by her spouse, the intended parent, also before conception. A declaration insert at about 86 percent of the declaration section corrects a superseded intake questionnaire that said a cryobank was used and establishes that the semen was provided directly to the parties at home and was not provided to a licensed physician and surgeon or to a licensed sperm bank, with the insemination performed at home. The graded answer must select Family Code section 7613(b)(2)(A) rather than section 7613(b)(1), treat the donor as not a parent on the strength of the pre-conception written agreement, and treat the consenting spouse as a parent under section 7613(a)(1).',
  buriedFacts: [
    'April 29, 2022 Known Donor Agreement signed before conception by the donor and the woman conceiving, providing that the donor shall not be a parent (exhibit section, depth ~0.70)',
    'May 4, 2022 written consent to assisted reproduction signed before conception by the woman conceiving and by the intended parent spouse (exhibit section, depth ~0.70)',
    'Semen provided directly to the parties at home and not provided to a licensed physician and surgeon or to a licensed sperm bank; insemination performed at home (declaration section, depth ~0.86)',
  ],
  distractors: [
    'A 2025 intake questionnaire stating that Golden Gate Cryobank was used, expressly corrected in the declaration as wrong',
  ],
  buriedChecks: ['April 29, 2022', 'May 4, 2022', 'licensed sperm bank', 'Golden Gate Cryobank'],
  propositions: [
    {
      pid: 'longcontext-008-p1',
      source: 'STAT-CAL-FAM-CODE-7613',
      ascii:
        'If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction.',
      proposition:
        'If a woman conceives through assisted reproduction with donated semen with the consent of another intended parent, that intended parent is treated in law as the natural parent of the child, and the consent shall be in writing and signed by the intended parent and the woman conceiving.',
    },
    {
      pid: 'longcontext-008-p2',
      source: 'STAT-CAL-FAM-CODE-7613',
      ascii:
        'The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent.',
      proposition:
        'A donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as not the natural parent, unless the donor and the woman signed a written agreement before conception that the donor would be a parent.',
    },
    {
      pid: 'longcontext-008-p3',
      source: 'STAT-CAL-FAM-CODE-7613',
      ascii:
        'If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent.',
      proposition:
        'If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank, the donor is treated in law as not the natural parent if the donor and the woman signed a written agreement before conception that the donor would not be a parent.',
    },
    {
      pid: 'longcontext-008-p4',
      source: 'STAT-CAL-FAM-CODE-7613',
      ascii:
        'Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child.',
      proposition:
        'Failure to consent in writing does not preclude a finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to conception, the woman and the intended parent had an oral agreement that both would be parents.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-008-c1',
      description:
        'Retrieves the buried declaration correction and states that the semen was provided directly to the parties at home and was not provided to a licensed physician and surgeon or to a licensed sperm bank, rejecting the superseded intake questionnaire reference to a cryobank, and explains that this fact takes the case out of Family Code section 7613(b)(1) and into section 7613(b)(2).',
      pids: ['longcontext-008-p2', 'longcontext-008-p3'],
    },
    {
      cid: 'longcontext-008-c2',
      description:
        'Concludes that Ignatius Prewitt-Moreau is treated in law as not the natural parent under section 7613(b)(2)(A), because the buried April 29, 2022 Known Donor Agreement is a written agreement signed by the donor and the woman before conception that the donor would not be a parent.',
      pids: ['longcontext-008-p3'],
    },
    {
      cid: 'longcontext-008-c3',
      description:
        'Concludes that Naledi Fairweather-Oyelaran is treated in law as the natural parent under section 7613(a)(1), identifying the buried May 4, 2022 written consent signed by both the intended parent and the woman conceiving through assisted reproduction as satisfying the writing-and-signature requirement.',
      pids: ['longcontext-008-p1'],
    },
    {
      cid: 'longcontext-008-c4',
      description:
        'Notes the alternative route in section 7613(a)(2), that failure to consent in writing would not preclude a finding of consent on clear and convincing evidence of a pre-conception oral agreement that both would be parents, while making clear that on this file the written consent exists so the alternative is not needed.',
      pids: ['longcontext-008-p4'],
    },
  ],
  assertions: [
    { aid: 'longcontext-008-a1', kind: 'contains', expected: ['April 29, 2022'] },
    { aid: 'longcontext-008-a2', kind: 'statute', expected: ['7613'] },
    { aid: 'longcontext-008-a3', kind: 'contains', expected: ['May 4, 2022'] },
    {
      aid: 'longcontext-008-a4',
      kind: 'not_contains',
      expected: ['semen was provided to a licensed sperm bank'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-009 — FAM 2337 bifurcation conditions checklist
 * ================================================================== */

const CTX9 = mkCtx({
  court: 'Superior Court of California, County of Contra Costa',
  caption: 'In re the Marriage of OKONKWO-LARKSPUR and VANDERSTEEN-RUIZ',
  caseNo: '25-FL-030877',
  petitioner: 'Genevieve Okonkwo-Larkspur',
  respondent: 'Ptolemy Vandersteen-Ruiz',
  petCounsel: 'Anselm Broadwater-Ige, Esq.',
  petFirm: 'Broadwater Ige LLP, 3300 Heron Bluff Parkway, Suite 1100, Walnut Creek, California',
  resCounsel: 'Ottoline Kasprzak, Esq.',
  resFirm: 'Kasprzak Family Law Group, 145 Tanoak Crossing, Martinez, California',
  bates: 'OL',
  fileStart: day(2025, 3, 10),
});

const T9 = {
  id: 'longcontext-009',
  anchor: 'FAM 2337(a)-(b), (c)(2), (c)(5), (c)(8) bifurcation of marital status and the conditions checklist',
  ctx: CTX9,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 4400 },
    { kind: 'correspondence', words: 10200, inserts: [{ frac: 0.35, text: `
------------------------------------------------------------------------------
CORRESPONDENCE ITEM 031A
Kasprzak Family Law Group, 145 Tanoak Crossing, Martinez, California
July 30, 2025

Anselm Broadwater-Ige, Esq.
Broadwater Ige LLP

Re:  In re the Marriage of OKONKWO-LARKSPUR and VANDERSTEEN-RUIZ, Case No. 25-FL-030877
Via: Electronic mail

Dear Counsel:

Respondent objects to any motion to sever the issue of marital status on the ground that no preliminary declaration of disclosure has been served on him. As of today's date our office has received nothing. If your client intends to move, the preliminary declaration of disclosure with a completed schedule of assets and debts must accompany the noticed motion, and our client will not stipulate in writing to defer service.

Very truly yours,

Ottoline Kasprzak, Esq.` }] },
    { kind: 'billing', words: 7200 },
    { kind: 'ledger', words: 6800 },
    { kind: 'declaration', words: 8200, inserts: [
      { frac: 0.31, text: `
58A.  Attached to this declaration as Exhibit 0311 is the PROOF OF SERVICE showing that Petitioner's PRELIMINARY DECLARATION OF DISCLOSURE, together with a COMPLETED SCHEDULE OF ASSETS AND DEBTS, was served on Respondent's counsel of record by electronic service on AUGUST 15, 2025, concurrently with the noticed motion to sever the issue of the dissolution of the status of the marriage. The correspondence from Respondent's counsel dated July 30, 2025 complaining that nothing had been served predates that service by sixteen days.

58B.  Petitioner separately served her FINAL DECLARATION OF DISCLOSURE on October 2, 2025. That is a different document from the preliminary declaration of disclosure and was served on a different date.

58C.  The parties have never stipulated in writing to defer service of the preliminary declaration of disclosure to a later time, and no preliminary declaration of disclosure had been served by Petitioner at any earlier time.` },
      { frac: 0.68, text: `
77A.  I am currently covered as a named dependent under Respondent's employer group health and medical plan through Ironbridge Utilities. I have no independent coverage available to me through any employer of my own. I am fifty-eight years old and I take two maintenance medications.

77B.  I am designated as the contingent survivor annuitant under Respondent's defined benefit pension through the Ironbridge Utilities Retirement Plan. The plan administrator has written to counsel confirming that, under the plan's terms, my survivor election rights terminate on the entry of a judgment dissolving the marital status unless the court orders otherwise. That letter is produced at Bates OL-016640 through OL-016644.

77C.  Respondent holds an individual retirement account at Cobblestone Trust, account no. xxxx-8890, in which the community has an interest. Respondent also holds a nonprobate transfer account at the same institution on which he is the sole named beneficiary designator.

77D.  I currently reside in the residence at 1408 Heron Bluff Parkway. I am told that entry of a judgment of dissolution of status could affect my right to a probate homestead in that residence and my right to a probate family allowance as a surviving spouse.` },
    ] },
    { kind: 'depo', words: 5000 },
    { kind: 'discovery', words: 2800 },
    { kind: 'minutes', words: 1200 },
    { kind: 'emails', words: 900 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner has filed a noticed motion to sever and separately try the issue of the dissolution of the status of the marriage. Using only this case file and the supplied California Family Code authority:

(1) State whether the disclosure prerequisite for the motion has been satisfied, giving the document, the date, and why Respondent's July 30, 2025 objection does not defeat the motion.
(2) Identify the conditions the court may impose on granting the severance that the buried facts in this file actually put in issue, and state the specific fact supporting each.
(3) State the general authority for severing the status issue.`,
  prompt:
    'Long-context California bifurcation problem (all parties, documents, and facts synthetic). A roughly 46,000-word consolidated litigation file is embedded in the graded turn. A correspondence insert at about 35 percent of the correspondence section is a July 30, 2025 objection asserting that no preliminary declaration of disclosure has been served. A declaration insert at about 31 percent of the declaration section establishes that the preliminary declaration of disclosure with a completed schedule of assets and debts was served with the noticed motion by electronic service on August 15, 2025, sixteen days after that objection, that the final declaration of disclosure served October 2, 2025 is a different document, and that the parties never stipulated in writing to defer service. A second declaration insert at about 68 percent establishes that the petitioner is a named dependent on the respondent’s employer group health plan with no coverage of her own, is the contingent survivor annuitant under his defined benefit pension whose survivor election terminates on entry of a status judgment, that the respondent holds an IRA in which the community has an interest and a nonprobate transfer account, and that she resides in the family residence. The graded answer must apply Family Code section 2337(a), (b), (c)(2), (c)(5), and (c)(8).',
  buriedFacts: [
    'Proof of service showing the preliminary declaration of disclosure with a completed schedule of assets and debts was served with the noticed motion on August 15, 2025, and that no written stipulation to defer service exists (declaration section, depth ~0.31)',
    'Petitioner is a named dependent on Respondent’s employer group health and medical plan with no coverage of her own (declaration section, depth ~0.68)',
    'Petitioner is the contingent survivor annuitant under Respondent’s defined benefit plan and her survivor election rights terminate on entry of a status judgment unless the court orders otherwise',
    'Respondent holds a Cobblestone Trust IRA in which the community has an interest, plus a nonprobate transfer account',
  ],
  distractors: [
    'July 30, 2025 correspondence asserting that no preliminary declaration of disclosure had been served, which predates the August 15, 2025 service (correspondence section, depth ~0.35)',
    'Final declaration of disclosure served October 2, 2025, a different document from the preliminary declaration of disclosure',
  ],
  buriedChecks: ['August 15, 2025', 'October 2, 2025', 'July 30, 2025'],
  propositions: [
    {
      pid: 'longcontext-009-p1',
      source: 'STAT-CAL-FAM-CODE-2337',
      ascii:
        'In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.',
      proposition:
        'In a proceeding for dissolution of marriage the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.',
    },
    {
      pid: 'longcontext-009-p2',
      source: 'STAT-CAL-FAM-CODE-2337',
      ascii:
        'A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time.',
      proposition:
        'A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously or unless the parties stipulate in writing to defer service until a later time.',
    },
    {
      pid: 'longcontext-009-p3',
      source: 'STAT-CAL-FAM-CODE-2337',
      ascii:
        'Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so.',
      proposition:
        'The court may condition severance on the moving party maintaining, until judgment has been entered on all remaining issues and has become final, all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so.',
    },
    {
      pid: 'longcontext-009-p4',
      source: 'STAT-CAL-FAM-CODE-2337',
      ascii:
        'Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party.',
      proposition:
        'The court may condition severance on the party indemnifying and holding the other party harmless from any adverse consequences if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits, or any associated elections or options, that the other party would have been entitled to as the spouse or surviving spouse.',
    },
    {
      pid: 'longcontext-009-p5',
      source: 'STAT-CAL-FAM-CODE-2337',
      ascii:
        'In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code.',
      proposition:
        'To preserve the ability to defer distribution of an IRA upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA be assigned and transferred to the other party pursuant to Internal Revenue Code section 408(d)(6).',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-009-c1',
      description:
        'Retrieves the buried proof of service and states that the preliminary declaration of disclosure with a completed schedule of assets and debts was served with the noticed motion on August 15, 2025, so the section 2337(b) prerequisite is satisfied; explains that the July 30, 2025 objection predates that service and that the October 2, 2025 final declaration of disclosure is a different document.',
      pids: ['longcontext-009-p2'],
    },
    {
      cid: 'longcontext-009-c2',
      description:
        'States the section 2337(a) authority that in a dissolution proceeding the court may, upon noticed motion, sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.',
      pids: ['longcontext-009-p1'],
    },
    {
      cid: 'longcontext-009-c3',
      description:
        'Identifies the section 2337(c)(2) health and medical insurance condition as put in issue by the buried fact that Petitioner is covered as a named dependent under Respondent’s employer group plan and has no coverage available through an employer of her own.',
      pids: ['longcontext-009-p3'],
    },
    {
      cid: 'longcontext-009-c4',
      description:
        'Identifies the section 2337(c)(5) retirement, survivor, or deferred compensation indemnity condition as put in issue by the buried fact that Petitioner is the contingent survivor annuitant under Respondent’s defined benefit plan and that the plan administrator has confirmed her survivor election rights terminate on entry of a judgment dissolving marital status.',
      pids: ['longcontext-009-p4'],
    },
    {
      cid: 'longcontext-009-c5',
      description:
        'Identifies the section 2337(c)(8) IRA condition as put in issue by the buried fact that Respondent holds a Cobblestone Trust individual retirement account in which the community has an interest.',
      pids: ['longcontext-009-p5'],
    },
  ],
  assertions: [
    { aid: 'longcontext-009-a1', kind: 'contains', expected: ['August 15, 2025'] },
    { aid: 'longcontext-009-a2', kind: 'statute', expected: ['2337'] },
    { aid: 'longcontext-009-a3', kind: 'contains', expected: ['preliminary declaration of disclosure'] },
    {
      aid: 'longcontext-009-a4',
      kind: 'not_contains',
      expected: ['preliminary declaration of disclosure was served on October 2, 2025'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-010 — FAM 6320 / 6203 / 6211 coercive control
 * ================================================================== */

const CTX10 = mkCtx({
  court: 'Superior Court of California, County of Riverside',
  caption: 'ASHWORTH-BELLO v. KETTLEBOROUGH-NAKAMURA',
  caseNo: '26-FL-011903',
  petitioner: 'Marguerite Ashworth-Bello',
  respondent: 'Silvano Kettleborough-Nakamura',
  petCounsel: 'Rosalind Tewkesbury-Amadi, Esq.',
  petFirm: 'Tewkesbury Amadi LLP, 6600 Ocotillo Ridge, Suite 800, Riverside, California',
  resCounsel: 'Dashiell Vroomen, Esq.',
  resFirm: 'Vroomen & Achara, 2140 Palo Verde Walk, Temecula, California',
  bates: 'AB',
  fileStart: day(2025, 9, 8),
});

const T10 = {
  id: 'longcontext-010',
  anchor: 'FAM 6320(a), (c) coercive control, 6203(a)(4) and (b) abuse, 6211(a) domestic violence, pattern spread across a correspondence and message file',
  ctx: CTX10,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 4800 },
    { kind: 'billing', words: 8200 },
    { kind: 'ledger', words: 8600, label: 'ACCOUNT LEDGER DETAIL — CANYONMOUTH BANK JOINT CHECKING NO. xxxx-6612', inserts: [{ frac: 0.47, text: `
=== CUSTODIAN NOTE APPENDED TO THE JOINT ACCOUNT LEDGER ===
On March 4, 2025 the online banking credentials for joint checking no. xxxx-6612 were changed and Marguerite Ashworth-Bello's access was removed at the request of the other joint owner. From March 4, 2025 forward the only transfers to Marguerite Ashworth-Bello from this account are the weekly $60.00 transfers below, described in the transfer memo field as "allowance."
03/07/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
03/14/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
03/21/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
03/28/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
04/04/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
04/11/2025   ONLINE XFER TO M. ASHWORTH-BELLO — memo: allowance          -60.00
Custodian note continues: the account received the direct deposit of both parties' earnings throughout this period. Marguerite Ashworth-Bello's separate account at the same institution was closed on March 4, 2025 and no replacement account was opened in her name.` }] },
    { kind: 'correspondence', words: 13000, label: 'CORRESPONDENCE FILE AND MESSAGE EXPORTS', inserts: [
      { frac: 0.12, text: `
------------------------------------------------------------------------------
MESSAGE EXPORT — DEVICE BACKUP, THREAD 004, PAGES 12-13
Exported under stipulated protocol; timestamps in Pacific time.

[01/19/2025 21:14]  S.K.-N.:  I can see you are still at your sister's. The app says you have been there ninety minutes.
[01/19/2025 21:15]  S.K.-N.:  I have the location sharing on the thermostat and the car too. There is nowhere you go that I do not know about.
[01/19/2025 21:22]  M.A.-B.:  Please turn it off.
[01/19/2025 21:23]  S.K.-N.:  No. Come home now.
[02/02/2025 07:40]  S.K.-N.:  Your sister called the house again. I told her you do not want to speak to her. Do not call her back.
[02/02/2025 07:44]  S.K.-N.:  Same for Delphine and the people from the choir. You are done with them.` },
      { frac: 0.41, text: `
------------------------------------------------------------------------------
MESSAGE EXPORT — DEVICE BACKUP, THREAD 011, PAGES 58-60
[05/16/2025 22:03]  S.K.-N.:  I threw out the pills. We are not doing that anymore.
[05/16/2025 22:05]  M.A.-B.:  Those were mine. I need them.
[05/16/2025 22:06]  S.K.-N.:  You will not be getting another prescription. I called and cancelled the appointment. You are going to have another baby whether you like it or not.
[05/17/2025 06:31]  S.K.-N.:  And do not think about going to a clinic. I will know.` },
      { frac: 0.88, text: `
------------------------------------------------------------------------------
MESSAGE EXPORT — DEVICE BACKUP, THREAD 019, PAGE 141
[12/19/2025 18:52]  S.K.-N.:  I read the papers your lawyer filed. Withdraw them by Monday.
[12/19/2025 18:53]  S.K.-N.:  If you do not withdraw that request for order by Monday I will call immigration and report you and your mother. I know exactly what your status is and what hers is. One phone call and you are both gone and the children stay with me.
[12/19/2025 18:55]  M.A.-B.:  Please stop.
[12/19/2025 18:56]  S.K.-N.:  Monday. Withdraw it.

Declarant's note: the parties were married in 2016 and separated in 2025. No dissolution judgment has been entered and they remain spouses. Marguerite Ashworth-Bello did not withdraw the Request for Order.` },
    ] },
    { kind: 'declaration', words: 8800 },
    { kind: 'depo', words: 5400 },
    { kind: 'discovery', words: 3400 },
    { kind: 'minutes', words: 1600, inserts: [{ frac: 0.3, text: `
------------------------------------------------------------------------------
MINUTE ORDER — PRIOR PROCEEDING, LODGED FOR IDENTIFICATION
Superior Court of California, County of Riverside   Department 6
Ashworth-Bello v. Kettleborough-Nakamura — Case No. 19-DV-002210
Date: July 22, 2019

Petitioner's request for a domestic violence restraining order came on for hearing. Petitioner having withdrawn the request at the outset of the hearing, the request is DENIED as withdrawn. No evidence was taken. No restraining order was granted and the court made no findings.` }] },
    { kind: 'emails', words: 1000 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner seeks a restraining order. Respondent argues that nothing in the file amounts to abuse because he never hit her. Using only this case file and the supplied California Family Code authority:

(1) State whether the parties fall within the class of persons the domestic violence statutes protect, and why.
(2) Identify the categories of coercive control the buried messages and ledger entries in this file show, giving at least four with the specific supporting fact and date.
(3) Explain whether the December 19, 2025 message is enjoinable conduct, and answer Respondent's "he never hit her" argument.`,
  prompt:
    'Long-context California DVPA coercive-control problem (all parties, documents, and facts synthetic). A roughly 55,000-word consolidated litigation file is embedded in the graded turn, the largest in the batch, with the operative message exports buried at roughly 12, 41, and 88 percent of a 13,000-word correspondence-and-messages section and a bank-ledger custodian note at about 47 percent of the ledger section. The buried facts show four distinct coercive-control categories: January 19, 2025 messages establishing app-based location monitoring of the petitioner’s movements; February 2, 2025 messages isolating her from her sister and friends; a March 4, 2025 custodian note recording removal of her banking access, closure of her separate account, and $60.00 weekly "allowance" transfers; May 16, 2025 messages destroying her contraception and cancelling her appointment; and a December 19, 2025 message threatening to report her and her mother to immigration unless she withdrew her Request for Order. A distractor minute order at about 30 percent of the minute-order section records a July 22, 2019 request denied as withdrawn with no evidence taken and no findings. The graded answer must apply Family Code section 6320(a) and (c), section 6203(a)(4) and (b), and section 6211(a).',
  buriedFacts: [
    'January 19, 2025 messages establishing app-based monitoring of Petitioner’s location and movements (correspondence section, depth ~0.12)',
    'February 2, 2025 messages isolating Petitioner from her sister and friends (correspondence section, depth ~0.12)',
    'March 4, 2025 custodian note: banking access removed, separate account closed, $60.00 weekly allowance transfers (ledger section, depth ~0.47)',
    'May 16, 2025 messages destroying contraception and cancelling the medical appointment (correspondence section, depth ~0.41)',
    'December 19, 2025 message threatening to report Petitioner and her mother to immigration unless she withdrew the Request for Order (correspondence section, depth ~0.88)',
    'The parties married in 2016, separated in 2025, and remain spouses with no dissolution judgment entered',
  ],
  distractors: [
    'July 22, 2019 minute order denying a prior restraining-order request as withdrawn, with no evidence taken and no findings made (minute-order section, depth ~0.30)',
  ],
  buriedChecks: ['12/19/2025', '05/16/2025', '01/19/2025', 'July 22, 2019', '$60.00'],
  propositions: [
    {
      pid: 'longcontext-010-p1',
      source: 'STAT-CAL-FAM-CODE-6320',
      ascii:
        'The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party',
      proposition:
        'The court may issue an ex parte order enjoining a party from, among other conduct, threatening, harassing, destroying personal property, contacting directly or indirectly, or disturbing the peace of the other party.',
    },
    {
      pid: 'longcontext-010-p2',
      source: 'STAT-CAL-FAM-CODE-6320',
      ascii:
        'As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty.',
      proposition:
        'Disturbing the peace of the other party refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party, committed by any means including text messages and internet-connected devices, and includes coercive control, a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty.',
    },
    {
      pid: 'longcontext-010-p3',
      source: 'STAT-CAL-FAM-CODE-6320',
      ascii:
        'Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes.',
      proposition:
        'Examples of coercive control include isolating the other party from friends, relatives, or other sources of support; depriving the other party of basic necessities; controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services; compelling the other party by threat or intimidation, including threats based on actual or suspected immigration status, to abstain from conduct in which the other party has a right to engage; and reproductive coercion including deliberately interfering with contraception use.',
    },
    {
      pid: 'longcontext-010-p4',
      source: 'STAT-CAL-FAM-CODE-6203',
      ascii:
        'To engage in any behavior that has been or could be enjoined pursuant to Section 6320. (b) Abuse is not limited to the actual infliction of physical injury or assault.',
      proposition:
        'Abuse includes engaging in any behavior that has been or could be enjoined pursuant to Section 6320, and abuse is not limited to the actual infliction of physical injury or assault.',
    },
    {
      pid: 'longcontext-010-p5',
      source: 'STAT-CAL-FAM-CODE-6211',
      ascii:
        '"Domestic violence" is abuse perpetrated against any of the following persons: (a) A spouse or former spouse.',
      proposition:
        'Domestic violence is abuse perpetrated against a spouse or former spouse, among other listed persons.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-010-c1',
      description:
        'States that the parties are spouses, so abuse perpetrated between them is domestic violence within Family Code section 6211(a), relying on the buried declarant note that they married in 2016, separated in 2025, and remain spouses with no dissolution judgment entered.',
      pids: ['longcontext-010-p5'],
    },
    {
      cid: 'longcontext-010-c2',
      description:
        'Retrieves the buried December 19, 2025 message and identifies it as compelling the other party by threat or intimidation, including a threat based on actual or suspected immigration status, to abstain from conduct in which she has a right to engage, namely prosecuting her Request for Order.',
      pids: ['longcontext-010-p3'],
    },
    {
      cid: 'longcontext-010-c3',
      description:
        'Identifies at least three further coercive-control categories from the buried record with their supporting facts: monitoring of movements through the location application on January 19, 2025; isolation from her sister and friends on February 2, 2025; control of finances and economic resources through the March 4, 2025 removal of banking access, closure of her separate account, and $60.00 weekly allowance; and reproductive coercion through the May 16, 2025 destruction of her contraception and cancellation of her appointment.',
      pids: ['longcontext-010-p3'],
    },
    {
      cid: 'longcontext-010-c4',
      description:
        'Explains that this conduct is enjoinable because disturbing the peace of the other party means conduct that, based on the totality of the circumstances, destroys the other party’s mental or emotional calm, may be committed by text message or internet-connected device, and includes coercive control as a pattern of behavior that in purpose or effect unreasonably interferes with free will and personal liberty, and that section 6320(a) authorizes an order enjoining threatening, harassing, destroying personal property, contacting, and disturbing the peace.',
      pids: ['longcontext-010-p1', 'longcontext-010-p2'],
    },
    {
      cid: 'longcontext-010-c5',
      description:
        'Answers the "he never hit her" argument by stating that abuse includes engaging in any behavior that has been or could be enjoined pursuant to Section 6320 and is not limited to the actual infliction of physical injury or assault.',
      pids: ['longcontext-010-p4'],
    },
  ],
  assertions: [
    { aid: 'longcontext-010-a1', kind: 'contains', expected: ['coercive control'], legal_phrase: true },
    { aid: 'longcontext-010-a2', kind: 'statute', expected: ['6320'] },
    { aid: 'longcontext-010-a3', kind: 'contains', expected: ['immigration'] },
    {
      aid: 'longcontext-010-a4',
      kind: 'not_contains',
      expected: ['restraining order was granted on July 22, 2019'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

export const SPECS_B = [T6, T7, T8, T9, T10];
