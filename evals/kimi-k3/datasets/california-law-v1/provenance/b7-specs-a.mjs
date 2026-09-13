/**
 * b7-specs-a.mjs
 *
 * WHAT THIS DOES
 * --------------
 * Task specifications for longcontext-001..005 of batch B7 of the
 * california-law-v1 evaluation dataset. Each spec supplies the synthetic
 * matter context, the section plan (which controls packet size and the burial
 * depth of the operative facts), the buried-fact insert blocks, the graded
 * question, the registry-grounded propositions and criteria, and the
 * deterministic assertions.
 *
 * INPUT FILES:  none directly (consumed by b7-builder.mjs).
 * OUTPUT FILES: none (module).
 *
 * NOTES
 *  - Every party, firm, court department, case number, account, exhibit, and
 *    event below is invented. Nothing is drawn from any real matter.
 *  - `ascii` strings are search keys into registered primary sources; the
 *    builder slices the registry's own characters and throws if not found.
 */

import { day } from './b7-builder-lib.mjs';

export function mkCtx(o) {
  return {
    timekeepers: [
      { initials: 'SRD', rate: 695 },
      { initials: 'MKV', rate: 520 },
      { initials: 'ABT', rate: 385 },
      { initials: 'PLQ', rate: 245 },
    ],
    ...o,
  };
}

const INSTRUCTION =
  'You are assisting a California family-law attorney. The complete litigation file for the matter is reproduced below. It is long, it is repetitive, and most of it is routine. Every party, document, account, and event in it is synthetic. Read the whole file, locate the facts that actually matter, and then answer the question that follows the end-of-file marker. Rely only on the case file and on the California authority supplied in the evidence packet; do not import facts or authority from outside them.';

/* ================================================================== *
 * longcontext-001 — FAM 771 / 760 / 770: post-separation earnings and
 * the operative date of separation buried in a stipulation and order
 * ================================================================== */

const CTX1 = mkCtx({
  court: 'Superior Court of California, County of Alameda',
  caption: 'In re the Marriage of OYELARAN-CASTAVERDE and MARCHETTI-SANDOVAL',
  caseNo: '23-FL-041882',
  petitioner: 'Wilhelmina Oyelaran-Castaverde',
  respondent: 'Dov Marchetti-Sandoval',
  petCounsel: 'Perpetua Vandenbroucke, Esq.',
  petFirm: 'Vandenbroucke & Achterberg LLP, 1180 Kestrel Plaza, Suite 700, Oakland, California',
  resCounsel: 'Casimir Whitlock, Esq.',
  resFirm: 'Whitlock & Perenna LLP, 4402 Fennimore Street, Suite 210, Hayward, California',
  bates: 'OC',
  fileStart: day(2023, 1, 9),
});

const T1 = {
  id: 'longcontext-001',
  anchor: 'FAM 771(a) post-separation earnings; FAM 760; FAM 770(a)(2)-(3); operative date of separation buried in a stipulation and order',
  ctx: CTX1,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 2200, inserts: [{ frac: 0.34, text: `
EX. 0119A  |  03/09/2023  |  Petition (FL-100) as originally filed, page 2, item 4.a., which recites "Date of separation: 02/03/2021"  |  Bates OC-002214 through OC-002219
EX. 0119B  |  11/14/2023  |  Amended Petition (FL-100), page 2, item 4.a., which strikes the originally pleaded date and recites "Date of separation: reserved; to be established by stipulation or by the court"  |  Bates OC-002220 through OC-002226
EX. 0119C  |  11/14/2023  |  Notice of Errata re: originally pleaded date of separation  |  Bates OC-002227 through OC-002228` }] },
    { kind: 'correspondence', words: 6800, inserts: [{ frac: 0.09, text: `
------------------------------------------------------------------------------
CORRESPONDENCE ITEM 004A
Whitlock & Perenna LLP, 4402 Fennimore Street, Suite 210, Hayward, California
February 22, 2023

Perpetua Vandenbroucke, Esq.
Vandenbroucke & Achterberg LLP

Re:  In re the Marriage of OYELARAN-CASTAVERDE and MARCHETTI-SANDOVAL
     Superior Court of California, County of Alameda, Case No. 23-FL-041882
Via: Electronic mail

Dear Counsel:

Respondent's pleaded position, as stated in the Response filed in this matter, is that the parties' date of separation is February 3, 2021, that being the date on which Respondent moved a portion of his personal belongings to the unit on Fennimore Street. Petitioner has pleaded the same date in her original Petition.

We recognize that neither party has yet taken discovery on the point and that the pleaded date was entered by our respective offices from client intake notes rather than from documents. Both sides reserve the right to amend. If your client's investigation produces a different date we will consider it in good faith rather than litigate the question on the pleadings.

Very truly yours,

Casimir Whitlock, Esq.
Whitlock & Perenna LLP` }] },
    { kind: 'declaration', words: 4200, inserts: [{ frac: 0.62, text: `
44A.  In April 2019 my aunt, Theodora Oyelaran, died and left me by will her one-bedroom condominium at 2280 Sparrowgrass Court, Unit 14, San Leandro. Probate closed and title was distributed to me alone on August 30, 2019. Neither my spouse nor I contributed any money to acquiring that unit, and no community funds have ever been used to pay its mortgage, because there is no mortgage on it.

44B.  Since October 2019 the Sparrowgrass Court unit has been rented to an unrelated tenant. The rent is currently $2,950 per month. The rent is deposited into Meridian Credit Union account no. xxxx-4408, which is titled in my name alone and which I opened before the marriage. The rent has never been deposited into any joint account and has never been used for household expenses.` }] },
    { kind: 'billing', words: 3600 },
    { kind: 'ledger', words: 3200, label: 'ACCOUNT LEDGER DETAIL — MERIDIAN CREDIT UNION ACCOUNT NO. xxxx-7731 (PETITIONER, SOLE NAME)', inserts: [{ frac: 0.42, text: `
--- CONSULTING DEPOSIT DETAIL, PRODUCED IN RESPONSE TO DEMAND SET THREE ---
11/01/2022   ACH CREDIT  KESTREL BRIDGE ADVISORY LLC - CONSULTING FEE      18,400.00
12/01/2022   ACH CREDIT  KESTREL BRIDGE ADVISORY LLC - CONSULTING FEE      18,400.00
01/03/2023   ACH CREDIT  KESTREL BRIDGE ADVISORY LLC - CONSULTING FEE      18,400.00
02/01/2023   ACH CREDIT  KESTREL BRIDGE ADVISORY LLC - CONSULTING FEE      18,400.00
03/01/2023   ACH CREDIT  KESTREL BRIDGE ADVISORY LLC - CONSULTING FEE      18,400.00
Custodian note: Petitioner's consulting engagement with Kestrel Bridge Advisory LLC commenced on November 1, 2022 under a written statement of work executed October 26, 2022. All services billed under that engagement were performed by Petitioner personally after that date. The engagement has continued without interruption through the date of this production. Petitioner performed no services for Kestrel Bridge Advisory LLC at any time before November 1, 2022.` }] },
    { kind: 'depo', words: 2600 },
    { kind: 'discovery', words: 1800 },
    { kind: 'minutes', words: 900, inserts: [{ frac: 0.5, text: `
------------------------------------------------------------------------------
STIPULATION AND ORDER RE: DATE OF SEPARATION
Superior Court of California, County of Alameda   Department 19
In re the Marriage of OYELARAN-CASTAVERDE and MARCHETTI-SANDOVAL — Case No. 23-FL-041882
Filed and entered: November 14, 2023

The parties, by and through their respective counsel of record, having completed the deposition of each party and having reviewed the lease for the Fennimore Street unit, the parties' text message exports, and the parties' joint account records, hereby STIPULATE as follows, and the Court, finding good cause, so ORDERS:

1.  The date of separation of the parties, for all purposes in this proceeding, is OCTOBER 17, 2022. That is the date on which the parties' complete and final break in the marital relationship occurred, as evidenced by Respondent's written notice of that date, Petitioner's contemporaneous conduct, and the parties' agreed cessation of all shared finances.

2.  The date of February 3, 2021 pleaded in the original Petition and in the Response was entered in error from intake notes. That date is superseded by this stipulation. Both parties withdraw any contention that the date of separation is February 3, 2021, and neither party may rely on that date for any purpose in this proceeding.

3.  Petitioner shall file an Amended Petition conforming item 4.a. to this stipulation.

IT IS SO ORDERED.` }] },
    { kind: 'emails', words: 700 },
  ],
  question: `QUESTION FOR ANALYSIS

Using only this case file and the supplied California Family Code authority, answer all three parts:

(1) State the operative date of separation this file establishes, and say what document establishes it.
(2) Characterize the consulting fees Petitioner has received from Kestrel Bridge Advisory LLC. Explain which of those payments, if any, are community property and which are her separate property, and why.
(3) Characterize the Sparrowgrass Court condominium and the rent it produces.

Cite the Family Code sections you rely on.`,
  prompt:
    'Long-context California characterization problem (all parties, documents, and facts synthetic). A roughly 27,000-word consolidated litigation file is embedded in the graded turn: exhibit index, counsel correspondence, declaration paragraphs, attorney billing detail, an account ledger, deposition excerpts, interrogatory responses, minute orders, and e-mail. Three legally operative facts are buried at different depths: an early letter and the original FL-100 plead a February 3, 2021 date of separation; a Stipulation and Order entered November 14, 2023 and buried in the minute-order section fixes the operative date of separation as October 17, 2022 and expressly supersedes the pleaded date; a ledger insert shows the petitioner performed no consulting services before November 1, 2022 and has received $18,400 monthly since; and declaration paragraphs disclose a condominium inherited by will in 2019 and its rents. The graded answer must retrieve the stipulated date, characterize all of the consulting income as post-separation separate property under Family Code section 771(a), and characterize the inherited condominium and its rents as separate property under section 770, against the section 760 general rule.',
  buriedFacts: [
    'Stipulation and Order entered November 14, 2023 fixing the date of separation as October 17, 2022 (buried in the minute-order section at depth ~0.95 of the packet)',
    'Kestrel Bridge Advisory LLC consulting engagement commenced November 1, 2022; no services performed before that date; $18,400 monthly (ledger section, depth ~0.69)',
    'Condominium at 2280 Sparrowgrass Court inherited by will in 2019, distributed August 30, 2019, rented since October 2019 for $2,950 per month (declaration section, depth ~0.44)',
  ],
  distractors: [
    'February 3, 2021 date of separation pleaded in the original FL-100 and asserted in correspondence item 004A, expressly superseded and withdrawn by the stipulation',
  ],
  buriedChecks: ['October 17, 2022', 'November 1, 2022', 'August 30, 2019', '18,400.00'],
  propositions: [
    {
      pid: 'longcontext-001-p1',
      source: 'STAT-CAL-FAM-CODE-771',
      ascii:
        'The earnings and accumulations of a spouse and the minor children living with, or in the custody of, the spouse, after the date of separation of the spouses, are the separate property of the spouse.',
      proposition:
        'The earnings and accumulations of a spouse after the date of separation of the spouses are the separate property of that spouse.',
    },
    {
      pid: 'longcontext-001-p2',
      source: 'STAT-CAL-FAM-CODE-760',
      ascii:
        'Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.',
      proposition:
        'Except as otherwise provided by statute, all property acquired by a married person during the marriage while domiciled in California is community property.',
    },
    {
      pid: 'longcontext-001-p3',
      source: 'STAT-CAL-FAM-CODE-770',
      ascii:
        'Separate property of a married person includes all of the following: (1) All property owned by the person before marriage. (2) All property acquired by the person after marriage by gift, bequest, devise, or descent. (3) The rents, issues, and profits of the property described in this section.',
      proposition:
        'Separate property of a married person includes all property acquired by the person after marriage by gift, bequest, devise, or descent, and the rents, issues, and profits of that property.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-001-c1',
      description:
        'Retrieves the buried operative fact and states that the date of separation is October 17, 2022, as fixed by the Stipulation and Order entered November 14, 2023, rather than the February 3, 2021 date pleaded in the original FL-100 and asserted in the early correspondence, which the stipulation expressly supersedes and withdraws.',
      pids: ['longcontext-001-p1'],
    },
    {
      cid: 'longcontext-001-c2',
      description:
        'Characterizes the Kestrel Bridge Advisory consulting fees as Petitioner’s separate property because the earnings and accumulations of a spouse after the date of separation are the separate property of that spouse (Fam. Code, sec. 771(a)), and connects that rule to the buried fact that the engagement began November 1, 2022 and no services were performed before that date, so all of the payments post-date the October 17, 2022 separation.',
      pids: ['longcontext-001-p1'],
    },
    {
      cid: 'longcontext-001-c3',
      description:
        'States the Family Code section 760 baseline that, except as otherwise provided by statute, property acquired by a married person during the marriage while domiciled in California is community property, and uses it as the default against which the separate-property characterizations are made.',
      pids: ['longcontext-001-p2'],
    },
    {
      cid: 'longcontext-001-c4',
      description:
        'Characterizes the Sparrowgrass Court condominium as Petitioner’s separate property because it was acquired after marriage by devise or bequest, and characterizes the rent it produces as separate property because the rents, issues, and profits of separate property are themselves separate property (Fam. Code, sec. 770(a)(2), (a)(3)).',
      pids: ['longcontext-001-p3'],
    },
  ],
  assertions: [
    { aid: 'longcontext-001-a1', kind: 'contains', expected: ['October 17, 2022'] },
    { aid: 'longcontext-001-a2', kind: 'statute', expected: ['771'] },
    { aid: 'longcontext-001-a3', kind: 'statute', expected: ['770'] },
    {
      aid: 'longcontext-001-a4',
      kind: 'not_contains',
      expected: ['date of separation is February 3, 2021'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-002 — FAM 2640 tracing through a buried escrow statement
 * ================================================================== */

const CTX2 = mkCtx({
  court: 'Superior Court of California, County of San Mateo',
  caption: 'In re the Marriage of BROCKHURST-OJUKWU and VILLALPANDO-REYES',
  caseNo: '25-FL-007740',
  petitioner: 'Anneliese Brockhurst-Ojukwu',
  respondent: 'Tadeusz Villalpando-Reyes',
  petCounsel: 'Odalys Fairbrother, Esq.',
  petFirm: 'Fairbrother Ng LLP, 88 Marsh Harrier Way, Suite 1400, San Mateo, California',
  resCounsel: 'Ignatius Tremblay-Bosco, Esq.',
  resFirm: 'Tremblay-Bosco Family Law, 3311 Cormorant Boulevard, Redwood City, California',
  bates: 'BO',
  fileStart: day(2025, 2, 3),
});

const T2 = {
  id: 'longcontext-002',
  anchor: 'FAM 2640(a)-(b) separate-property reimbursement traced through a buried escrow settlement statement',
  ctx: CTX2,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'correspondence', words: 7200 },
    { kind: 'exhibits', words: 2600 },
    { kind: 'billing', words: 4200 },
    { kind: 'declaration', words: 4600, inserts: [{ frac: 0.5, text: `
51A.  I did not at any time sign a waiver of my right to be reimbursed for the money I put into the Larkspur Terrace purchase. I have searched my records and I have found no such document. Counsel has confirmed to me that no waiver of reimbursement appears anywhere in the parties' document production, that there is no premarital agreement in this case, and that the parties have never signed a marital settlement agreement or any other writing addressing reimbursement.

51B.  I opened Coastline Savings account no. xxxx-3390 in 2009, five years before the marriage. Between the date of marriage and the close of escrow the only deposits into that account were interest postings. No community earnings were ever deposited into it.` }] },
    { kind: 'ledger', words: 5200, label: 'ACCOUNT LEDGER DETAIL — HARBOR UNION JOINT CHECKING NO. xxxx-2214', inserts: [{ frac: 0.72, text: `
=== ESCROW FILE EXCERPT — FIDELITY PACIFIC ESCROW COMPANY, ESCROW NO. 24-118804 ===
Property:            1147 Larkspur Terrace, Alameda, California
Buyers:              Anneliese Brockhurst-Ojukwu and Tadeusz Villalpando-Reyes, as joint tenants
Date of marriage:    July 19, 2014
Close of escrow:     April 22, 2016
Total purchase price:                                             $1,242,500.00
First deed of trust, Northline Mortgage Corporation:                $993,850.00

BUYER FUNDS RECEIVED BY ESCROW HOLDER
  03/28/2016  Incoming wire, Coastline Savings account no. xxxx-3390,
              titled in the sole name of Anneliese Brockhurst-Ojukwu,
              opened 2009 (premarital account) ....................  $187,450.00
  04/14/2016  Incoming wire, Harbor Union joint checking no. xxxx-2214,
              funded exclusively by the parties' post-marriage
              employment earnings ..................................   $61,200.00
                                                       Total buyer funds  $248,650.00

ESCROW HOLDER CERTIFICATION: The escrow holder certifies that the $187,450.00 wire received March 28, 2016 originated from Coastline Savings account no. xxxx-3390 and from no other source, and that the funds in that account on the date of the wire consisted entirely of the balance carried in that account before July 19, 2014 together with interest posted to it.

PAYMENTS MADE FROM THE HARBOR UNION JOINT ACCOUNT AFTER CLOSE OF ESCROW
  Mortgage interest paid, 04/2016 through 12/2024 ..................  $296,411.08
  Principal reduction paid, 04/2016 through 12/2024 ................  $118,940.22
  County property taxes paid, 2016 through 2024 ....................   $131,802.55
  Hazard insurance premiums paid, 2016 through 2024 ................    $22,614.90
  Routine maintenance and repairs, 2016 through 2024 ...............    $46,308.71` }] },
    { kind: 'depo', words: 3400 },
    { kind: 'discovery', words: 2000 },
    { kind: 'minutes', words: 800 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner asserts a reimbursement claim against the Larkspur Terrace property in the division of the community estate. Using only this case file and the supplied California Family Code authority:

(1) State the dollar amount Petitioner is entitled to be reimbursed, and identify the document in the file that establishes it.
(2) Explain which of the payments listed in the escrow file excerpt qualify as "contributions to the acquisition of property" and which do not.
(3) State the condition that would defeat the reimbursement claim and whether this file shows it.`,
  prompt:
    'Long-context California reimbursement-tracing problem (all parties, documents, and facts synthetic). A roughly 30,000-word consolidated litigation file is embedded in the graded turn. Buried at about 72 percent depth inside an account-ledger section is a Fidelity Pacific escrow settlement excerpt for the April 22, 2016 purchase of 1147 Larkspur Terrace showing two buyer wires: $187,450.00 from a premarital sole-name Coastline Savings account, certified by the escrow holder as traceable entirely to pre-marriage funds, and $61,200.00 from a joint account funded exclusively by post-marriage earnings, for a total down payment of $248,650.00. The same excerpt lists post-closing payments of mortgage interest, principal reduction, property taxes, insurance, and maintenance. A declaration insert at mid-depth establishes that no written waiver of reimbursement exists. The graded answer must compute the Family Code section 2640(b) reimbursement as $187,450.00, exclude the community $61,200.00 wire, apply section 2640(a) to include downpayments and principal reduction while excluding interest, maintenance, insurance, and taxation, and address the written-waiver condition.',
  buriedFacts: [
    'Escrow No. 24-118804 excerpt showing a $187,450.00 wire from premarital sole-name Coastline Savings account no. xxxx-3390, with escrow-holder certification of the source (ledger section, depth ~0.72)',
    '$61,200.00 second wire from the Harbor Union joint account funded exclusively by post-marriage employment earnings',
    'Post-closing payments: $296,411.08 mortgage interest, $118,940.22 principal reduction, $131,802.55 property taxes, $22,614.90 insurance, $46,308.71 maintenance',
    'Declaration paragraphs 51A-51B: no written waiver of reimbursement exists anywhere in the file (declaration section, depth ~0.50)',
  ],
  distractors: [
    'Total buyer funds of $248,650.00, which a careless reading would treat as the reimbursable contribution',
    'The large community mortgage-interest, tax, insurance, and maintenance figures, which section 2640(a) expressly excludes from contributions to acquisition',
  ],
  buriedChecks: ['$187,450.00', '$61,200.00', '$248,650.00', '$296,411.08'],
  propositions: [
    {
      pid: 'longcontext-002-p1',
      source: 'STAT-CAL-FAM-CODE-2640',
      ascii:
        '"Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property.',
      proposition:
        'Contributions to the acquisition of property include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property, but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property.',
    },
    {
      pid: 'longcontext-002-p2',
      source: 'STAT-CAL-FAM-CODE-2640',
      ascii:
        'In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party’s contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.',
      proposition:
        'In the division of the community estate, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party’s contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.',
    },
    {
      pid: 'longcontext-002-p3',
      source: 'STAT-CAL-FAM-CODE-760',
      ascii:
        'all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property',
      proposition:
        'All property acquired by a married person during the marriage while domiciled in California is community property except as otherwise provided by statute.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-002-c1',
      description:
        'Retrieves the buried escrow settlement figures and states that the reimbursable separate-property contribution is $187,450.00, the March 28, 2016 wire from the premarital sole-name Coastline Savings account no. xxxx-3390, and not the $248,650.00 total buyer funds.',
      pids: ['longcontext-002-p2'],
    },
    {
      cid: 'longcontext-002-c2',
      description:
        'Excludes the $61,200.00 April 14, 2016 wire from the reimbursement because it came from the joint account funded exclusively by post-marriage employment earnings and therefore cannot be traced to a separate property source, and identifies the Larkspur Terrace property as community property acquired during the marriage under Family Code section 760.',
      pids: ['longcontext-002-p2', 'longcontext-002-p3'],
    },
    {
      cid: 'longcontext-002-c3',
      description:
        'Applies the Family Code section 2640(a) definition to the buried payment schedule: downpayments, payments for improvements, and payments that reduce loan principal count as contributions to the acquisition of property, while payments of interest on the loan and payments for maintenance, insurance, or taxation do not, so the $296,411.08 of mortgage interest, the $131,802.55 of property taxes, the $22,614.90 of insurance, and the $46,308.71 of maintenance are excluded.',
      pids: ['longcontext-002-p1'],
    },
    {
      cid: 'longcontext-002-c4',
      description:
        'States the statutory condition that reimbursement is owed unless the party has made a written waiver of the right to reimbursement or signed a writing that has the effect of a waiver, and finds on this file that no such waiver exists, so the claim is not defeated.',
      pids: ['longcontext-002-p2'],
    },
  ],
  assertions: [
    { aid: 'longcontext-002-a1', kind: 'contains', expected: ['$187,450'] },
    { aid: 'longcontext-002-a2', kind: 'statute', expected: ['2640'] },
    { aid: 'longcontext-002-a3', kind: 'contains', expected: ['written waiver'] },
    {
      aid: 'longcontext-002-a4',
      kind: 'not_contains',
      expected: ['reimbursed $248,650'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-003 — FAM 4058 income items scattered across schedules
 * ================================================================== */

const CTX3 = mkCtx({
  court: 'Superior Court of California, County of Sacramento',
  caption: 'FENWICK-ADEYEMI v. HALLORAN-BAPTISTE',
  caseNo: '24-FL-113206',
  petitioner: 'Marisol Fenwick-Adeyemi',
  respondent: 'Grigor Halloran-Baptiste',
  petCounsel: 'Delphine Auerbach-Nwosu, Esq.',
  petFirm: 'Auerbach Nwosu PC, 705 Tule Elk Road, Suite 320, Sacramento, California',
  resCounsel: 'Rutherford Peake, Esq.',
  resFirm: 'Peake & Salvatierra LLP, 12 Bannerwood Court, Roseville, California',
  bates: 'FA',
  fileStart: day(2024, 4, 2),
});

const T3 = {
  id: 'longcontext-003',
  anchor: 'FAM 4058(a)(1) inclusions and 4058(c) exclusions applied to income items scattered across buried schedules',
  ctx: CTX3,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 3000 },
    { kind: 'billing', words: 5200 },
    { kind: 'correspondence', words: 7600, inserts: [{ frac: 0.22, text: `
------------------------------------------------------------------------------
CORRESPONDENCE ITEM 018A
Peake & Salvatierra LLP, 12 Bannerwood Court, Roseville, California
June 11, 2024

Delphine Auerbach-Nwosu, Esq.
Auerbach Nwosu PC

Re:  FENWICK-ADEYEMI v. HALLORAN-BAPTISTE, Case No. 24-FL-113206
Via: Electronic mail

Dear Counsel:

Enclosed is Respondent's Income and Expense Declaration served this date. Item 5.a. states Respondent's annual base salary as $186,000.00. That figure was taken from Respondent's 2022 offer letter and, as we now know from the payroll records produced last week, it is stale. Respondent will serve an amended Income and Expense Declaration correcting item 5.a. Please disregard the $186,000.00 figure for all purposes; it does not reflect Respondent's current base salary and should not be used in any guideline calculation.

Very truly yours,

Rutherford Peake, Esq.
Peake & Salvatierra LLP` }] },
    { kind: 'declaration', words: 5000 },
    { kind: 'ledger', words: 5400 },
    { kind: 'discovery', words: 3200, inserts: [{ frac: 0.66, text: `
=== ATTACHMENT TO AMENDED INCOME AND EXPENSE DECLARATION OF GRIGOR HALLORAN-BAPTISTE ===
=== SCHEDULE C — ALL AMOUNTS RECEIVED, TWELVE MONTHS ENDED DECEMBER 31, 2025 ===

  Line C-1   Base salary, Cordwainer Analytics Inc. (W-2 box 1 wages,
             confirmed against payroll register) .....................  $214,000.00
  Line C-2   Annual performance bonus, paid February 2025, same employer
             (W-2, separately itemized on the payroll register) .......   $38,500.00
  Line C-3   Gross rents received, duplex at 4419 Coyote Willow Lane,
             tenant-occupied both units, no business operated ..........   $54,000.00
  Line C-4   Veterans disability compensation, service-connected,
             NOT based on financial need (award letter attached) ......   $19,200.00
  Line C-5   County general assistance benefits, eligibility for which is
             based on a determination of financial need ...............    $4,800.00
  Line C-6   Child support actually received by Respondent for Respondent's
             child from a prior relationship, who is not a child of this
             proceeding (order in Case No. 19-FL-088211) ..............   $14,400.00

  Preparer note: Line C-1 supersedes the $186,000.00 base salary figure stated at item
  5.a. of the original Income and Expense Declaration served June 11, 2024, which was
  taken from a 2022 offer letter and is stale. The $214,000.00 figure is the current
  base salary and is confirmed by the W-2 and by the payroll register produced at
  Bates FA-011840 through FA-011897.` }] },
    { kind: 'depo', words: 3400 },
    { kind: 'minutes', words: 1000 },
    { kind: 'emails', words: 800 },
  ],
  question: `QUESTION FOR ANALYSIS

The court must determine Respondent's annual gross income for guideline child support. Using only this case file and the supplied California Family Code authority:

(1) Go through each of the six amounts on Schedule C and state whether it is included in, or excluded from, annual gross income, with the reason for each.
(2) State Respondent's correct current base salary figure and explain why the other base salary figure in this file is not the right one.
(3) State the total annual gross income that results.`,
  prompt:
    'Long-context California guideline-support income problem (all parties, documents, and facts synthetic). A roughly 34,000-word consolidated litigation file is embedded in the graded turn. Buried at about 66 percent depth inside the interrogatory-response section is Schedule C to an amended Income and Expense Declaration listing six amounts: $214,000.00 base salary, $38,500.00 annual bonus, $54,000.00 gross rents, $19,200.00 veterans disability compensation expressly not based on need, $4,800.00 county general assistance whose eligibility is based on a determination of need, and $14,400.00 of child support actually received for a child of a prior relationship who is not a child of this proceeding. An earlier correspondence insert at about 22 percent depth states a superseded $186,000.00 base salary taken from a 2022 offer letter. The graded answer must include the first four items under Family Code section 4058(a)(1), exclude the last two under section 4058(c), use the $214,000.00 figure, and reach $325,700.00.',
  buriedFacts: [
    'Schedule C lines C-1 through C-6 with the six itemized amounts (interrogatory-response section, depth ~0.66)',
    'Line C-5 county general assistance of $4,800.00, eligibility based on a determination of financial need',
    'Line C-6 child support of $14,400.00 actually received for a child of a prior relationship who is not a child of this proceeding',
    'Preparer note establishing that $214,000.00 supersedes the earlier $186,000.00 base salary',
  ],
  distractors: [
    'The superseded $186,000.00 base salary stated in the original Income and Expense Declaration and in correspondence item 018A at depth ~0.22',
  ],
  buriedChecks: ['$214,000.00', '$38,500.00', '$54,000.00', '$19,200.00', '$4,800.00', '$14,400.00', '$186,000.00'],
  propositions: [
    {
      pid: 'longcontext-003-p1',
      source: 'STAT-CAL-FAM-CODE-4058',
      ascii:
        'The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need',
      proposition:
        'The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c), and includes but is not limited to salaries, wages, bonuses, rents, and veterans benefits that are not based on need.',
    },
    {
      pid: 'longcontext-003-p2',
      source: 'STAT-CAL-FAM-CODE-4058',
      ascii:
        'Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income.',
      proposition:
        'Annual gross income does not include income derived from child support payments actually received or income derived from any public assistance program the eligibility for which is based on a determination of need, and child support received by a party for children from another relationship is not included in that party’s gross or net income.',
    },
    {
      pid: 'longcontext-003-p3',
      source: 'STAT-CAL-FAM-CODE-4058',
      ascii: 'This section shall be operative September 1, 2024.',
      proposition:
        'Family Code section 4058 in its current form is operative September 1, 2024.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-003-c1',
      description:
        'Retrieves the buried Schedule C and includes in annual gross income the $214,000.00 base salary, the $38,500.00 bonus, the $54,000.00 of rents, and the $19,200.00 of veterans disability compensation, correctly relying on the fact stated on the schedule that the veterans benefit is not based on need, because section 4058(a)(1) lists salaries, bonuses, rents, and veterans benefits that are not based on need.',
      pids: ['longcontext-003-p1'],
    },
    {
      cid: 'longcontext-003-c2',
      description:
        'Excludes the $4,800.00 of county general assistance because annual gross income does not include income derived from any public assistance program the eligibility for which is based on a determination of need (Fam. Code, sec. 4058(c)).',
      pids: ['longcontext-003-p2'],
    },
    {
      cid: 'longcontext-003-c3',
      description:
        'Excludes the $14,400.00 of child support actually received for a child of a prior relationship, because annual gross income does not include income derived from child support payments actually received and child support received for children from another relationship is not part of that party’s gross or net income (Fam. Code, sec. 4058(c)).',
      pids: ['longcontext-003-p2'],
    },
    {
      cid: 'longcontext-003-c4',
      description:
        'Uses the $214,000.00 current base salary rather than the superseded $186,000.00 figure from the original Income and Expense Declaration, and identifies the buried preparer note and the payroll register as the basis for that correction.',
      pids: ['longcontext-003-p1'],
    },
    {
      cid: 'longcontext-003-c5',
      description:
        'Applies the version of Family Code section 4058 that is operative September 1, 2024 rather than an earlier formulation of the income definition.',
      pids: ['longcontext-003-p3'],
    },
  ],
  assertions: [
    { aid: 'longcontext-003-a1', kind: 'contains', expected: ['$14,400'] },
    { aid: 'longcontext-003-a2', kind: 'statute', expected: ['4058'] },
    { aid: 'longcontext-003-a3', kind: 'contains', expected: ['$214,000'] },
    {
      aid: 'longcontext-003-a4',
      kind: 'not_contains',
      expected: ['base salary is $186,000'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-004 — FAM 4320 factors spread through declarations
 * ================================================================== */

const CTX4 = mkCtx({
  court: 'Superior Court of California, County of Santa Clara',
  caption: 'In re the Marriage of OYELOWO-KRISHNAMURTHY and TANNENBAUM-ESPINOZA',
  caseNo: '24-FL-208813',
  petitioner: 'Beatriz Oyelowo-Krishnamurthy',
  respondent: 'Aurelio Tannenbaum-Espinoza',
  petCounsel: 'Sunniva Delacroix-Bhatt, Esq.',
  petFirm: 'Delacroix Bhatt LLP, 2001 Quailbrush Avenue, Suite 900, San Jose, California',
  resCounsel: 'Ozias Fenwright, Esq.',
  resFirm: 'Fenwright Legal Group, 640 Manzanita Row, Los Gatos, California',
  bates: 'OK',
  fileStart: day(2024, 1, 16),
});

const T4 = {
  id: 'longcontext-004',
  anchor: 'FAM 4320(a)-(b), (c), (f), (i)(4) spousal-support factors spread through buried declaration paragraphs',
  ctx: CTX4,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'exhibits', words: 3600, inserts: [{ frac: 0.18, text: `
EX. 0143A  |  01/16/2024  |  Petition (FL-100) as originally filed, page 1, item 3.a., which recites "Date of marriage: 06/08/2009" — a typographical entry error  |  Bates OK-003318 through OK-003324
EX. 0143B  |  05/02/2024  |  Amended Petition (FL-100), page 1, item 3.a., conforming the date of marriage to the certified marriage certificate  |  Bates OK-003325 through OK-003331
EX. 0143C  |  05/02/2024  |  Certified copy of Certificate of Registry of Marriage, County Clerk, showing the marriage solemnized June 8, 1999  |  Bates OK-003332 through OK-003333` }] },
    { kind: 'billing', words: 6200 },
    { kind: 'correspondence', words: 9800 },
    { kind: 'ledger', words: 6400 },
    { kind: 'declaration', words: 8600, label: 'DECLARATION OF BEATRIZ OYELOWO-KRISHNAMURTHY IN SUPPORT OF REQUEST FOR ORDER — CONTINUED PARAGRAPHS', inserts: [
      { frac: 0.28, text: `
72A.  Aurelio and I were married on June 8, 1999 in Santa Clara County. The certified Certificate of Registry of Marriage produced at Bates OK-003332 confirms that date. The date of June 8, 2009 that appears on the originally filed Petition was a typing error in our office, and the Amended Petition filed May 2, 2024 corrected it.

72B.  We separated on January 30, 2024, the date on which I moved to the apartment on Quailbrush Avenue and told Aurelio the marriage was over. Neither party disputes the separation date.` },
      { frac: 0.55, text: `
88A.  I graduated from the nursing program at the community college in 1996 and worked as a registered nurse until 2003. In 2003, when our second child was born, Aurelio and I agreed that I would stop working so that I could care for the children and manage the household. I did not work outside the home again at any time during the marriage. My nursing license lapsed in 2008 and has not been renewed.

88B.  A vocational evaluator retained jointly by the parties reported that, to return to clinical nursing, I would have to complete a refresher program of approximately nine months, sit for the licensing examination, and then complete a supervised preceptorship. The evaluator estimated the direct cost of the refresher program at $18,400 and estimated that I would not reach the entry-level clinical wage for the local market until roughly two years after beginning the program.

88C.  While Aurelio was in dental school from 1999 through 2003 I worked full time as a nurse and my earnings paid our rent, our food, our health insurance, and all of Aurelio's tuition and laboratory fees other than the amounts he borrowed. He obtained his dental license in 2004. He now practices as a partner in a four-dentist group.` },
      { frac: 0.86, text: `
121A.  On September 12, 2019, after a contested evidentiary hearing at which both parties testified and were represented by counsel, Judge Prewitt of Department 74 granted my request for a restraining order after hearing under Family Code section 6340 and issued a five-year protective order against Aurelio. The court found that Aurelio had intentionally caused bodily injury to me on two occasions and had disturbed my peace over an extended period. A certified copy of the order after hearing is produced at Bates OK-009442 through OK-009451, and the reporter's transcript of the court's findings is produced at Bates OK-009452 through OK-009488.

121B.  I did not seek renewal of the protective order when it expired. I make no request for a new restraining order in this proceeding. I raise the 2019 order only because it is documented evidence of the history between us and because I am told the court must consider it in setting support.` },
    ] },
    { kind: 'depo', words: 4200 },
    { kind: 'discovery', words: 2600 },
    { kind: 'minutes', words: 1000 },
    { kind: 'emails', words: 800 },
  ],
  question: `QUESTION FOR ANALYSIS

Petitioner requests spousal support. Using only this case file and the supplied California Family Code authority:

(1) State the date of marriage and the date of separation this file establishes, and the resulting duration of the marriage.
(2) Identify each Family Code section 4320 circumstance that the buried facts in this file put in issue, and state the specific fact from the file that supports it.
(3) Explain the significance of the September 12, 2019 order after hearing to the section 4320 analysis.`,
  prompt:
    'Long-context California spousal-support factor problem (all parties, documents, and facts synthetic). A roughly 43,000-word consolidated litigation file is embedded in the graded turn, with the operative facts split across three declaration inserts at roughly 28, 55, and 86 percent depth of an 8,600-word declaration section that itself sits in the second half of the packet. Buried facts: the marriage was solemnized June 8, 1999 per a certified marriage certificate and the parties separated January 30, 2024 (a nearly 25-year marriage); Petitioner left registered nursing in 2003 to devote time to domestic duties, her license lapsed in 2008, and a joint vocational evaluator priced a nine-month refresher program at $18,400 with roughly two years to entry-level wage; Petitioner worked full time to pay Respondent through dental school from 1999 to 2003 and he was licensed in 2004; and on September 12, 2019, after a contested evidentiary hearing, the court issued a restraining order after hearing under section 6340 on findings of intentionally caused bodily injury. A distractor exhibit at about 18 percent depth reproduces an originally filed FL-100 stating a June 8, 2009 marriage date, corrected by amended petition. The graded answer must map these facts onto Family Code section 4320(a)(1), (a)(2), (b), (c), (f), and (i)(4).',
  buriedFacts: [
    'Date of marriage June 8, 1999 confirmed by certified Certificate of Registry of Marriage; date of separation January 30, 2024 (declaration insert, depth ~0.28 of the declaration section)',
    'Petitioner left nursing in 2003 to devote time to domestic duties; license lapsed 2008; nine-month refresher program costing $18,400 and roughly two years to entry-level wage (declaration insert, depth ~0.55)',
    'Petitioner worked full time and paid Respondent’s dental school tuition 1999-2003; Respondent licensed 2004 (declaration insert, depth ~0.55)',
    'September 12, 2019 restraining order after hearing under Family Code section 6340 following a contested evidentiary hearing, on findings of intentionally caused bodily injury (declaration insert, depth ~0.86)',
  ],
  distractors: [
    'Originally filed FL-100 reciting a June 8, 2009 date of marriage, corrected by the Amended Petition and the certified marriage certificate (exhibit insert, depth ~0.18)',
  ],
  buriedChecks: ['June 8, 1999', 'January 30, 2024', 'September 12, 2019', '$18,400', 'June 8, 2009'],
  propositions: [
    {
      pid: 'longcontext-004-p1',
      source: 'STAT-CAL-FAM-CODE-4320',
      ascii:
        'The marketable skills of the supported party; the job market for those skills; the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills; and the possible need for retraining or education to acquire other, more marketable skills or employment.',
      proposition:
        'In ordering spousal support the court shall consider the marketable skills of the supported party, the job market for those skills, the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills, and the possible need for retraining or education to acquire other, more marketable skills or employment.',
    },
    {
      pid: 'longcontext-004-p2',
      source: 'STAT-CAL-FAM-CODE-4320',
      ascii:
        'The extent to which the supported party’s present or future earning capacity is impaired by periods of unemployment that were incurred during the marriage to permit the supported party to devote time to domestic duties.',
      proposition:
        'The court shall consider the extent to which the supported party’s present or future earning capacity is impaired by periods of unemployment incurred during the marriage to permit the supported party to devote time to domestic duties.',
    },
    {
      pid: 'longcontext-004-p3',
      source: 'STAT-CAL-FAM-CODE-4320',
      ascii:
        'The extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.',
      proposition:
        'The court shall consider the extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.',
    },
    {
      pid: 'longcontext-004-p4',
      source: 'STAT-CAL-FAM-CODE-4320-B',
      ascii: 'The duration of the marriage.',
      proposition: 'The court shall consider the duration of the marriage.',
    },
    {
      pid: 'longcontext-004-p5',
      source: 'STAT-CAL-FAM-CODE-4320-B',
      ascii:
        'All documented evidence of any history of domestic violence, as defined in Section 6211, between the parties or perpetrated by either party against either party’s child, including, but not limited to, consideration of: (1) A plea of nolo contendere. (2) Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party. (3) Any history of violence against the supporting party by the supported party. (4) Issuance of a protective order after a hearing pursuant to Section 6340.',
      proposition:
        'The court shall consider all documented evidence of any history of domestic violence as defined in Section 6211 between the parties, including the issuance of a protective order after a hearing pursuant to Section 6340.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-004-c1',
      description:
        'Retrieves the buried marriage and separation dates and states that the marriage ran from June 8, 1999 to the January 30, 2024 separation, a duration of roughly twenty-four years and seven months, rejecting the June 8, 2009 date on the originally filed FL-100 as a corrected typographical error, and identifies duration of the marriage as a section 4320(f) circumstance.',
      pids: ['longcontext-004-p4'],
    },
    {
      cid: 'longcontext-004-c2',
      description:
        'Applies section 4320(a)(1) to the buried vocational evidence: the lapsed nursing license, the nine-month refresher program, the $18,400 cost, and the roughly two-year runway to entry-level wage go to marketable skills, the job market for those skills, and the time and expenses required to acquire the appropriate education or training.',
      pids: ['longcontext-004-p1'],
    },
    {
      cid: 'longcontext-004-c3',
      description:
        'Applies section 4320(a)(2) to the buried fact that Petitioner stopped working in 2003 and did not work outside the home again during the marriage, treating that as a period of unemployment incurred during the marriage to permit her to devote time to domestic duties that impairs her present or future earning capacity.',
      pids: ['longcontext-004-p2'],
    },
    {
      cid: 'longcontext-004-c4',
      description:
        'Applies section 4320(b) to the buried fact that Petitioner worked full time as a nurse from 1999 through 2003 and paid Respondent’s dental school tuition and the household expenses, treating that as a contribution to the attainment of an education, training, a career position, or a license by the supporting party.',
      pids: ['longcontext-004-p3'],
    },
    {
      cid: 'longcontext-004-c5',
      description:
        'Applies section 4320(i) to the buried September 12, 2019 order, treating the issuance of a protective order after a hearing pursuant to Section 6340 as documented evidence of a history of domestic violence the court must consider, and does so notwithstanding that the order has expired and no new restraining order is sought.',
      pids: ['longcontext-004-p5'],
    },
  ],
  assertions: [
    { aid: 'longcontext-004-a1', kind: 'contains', expected: ['June 8, 1999'] },
    { aid: 'longcontext-004-a2', kind: 'statute', expected: ['4320'] },
    { aid: 'longcontext-004-a3', kind: 'contains', expected: ['September 12, 2019'] },
    {
      aid: 'longcontext-004-a4',
      kind: 'not_contains',
      expected: ['married on June 8, 2009'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

/* ================================================================== *
 * longcontext-005 — FAM 3044 presumption triggered by a buried finding
 * ================================================================== */

const CTX5 = mkCtx({
  court: 'Superior Court of California, County of Ventura',
  caption: 'RAVENSWORTH-MBEKI v. DULHUNTY-ARROYO',
  caseNo: '26-FL-000914',
  petitioner: 'Ilse Ravensworth-Mbeki',
  respondent: 'Casimir Dulhunty-Arroyo',
  petCounsel: 'Marisol Quintanilla-Osei, Esq.',
  petFirm: 'Quintanilla Osei LLP, 316 Saltmarsh Lane, Suite 240, Ventura, California',
  resCounsel: 'Barnaby Ellingwood, Esq.',
  resFirm: 'Ellingwood & Trask, 1900 Chaparral Bend, Camarillo, California',
  bates: 'RM',
  fileStart: day(2026, 1, 12),
});

const T5 = {
  id: 'longcontext-005',
  anchor: 'FAM 3044(a)-(b), (f)(2) custody presumption triggered by a DVRO finding buried in the minute-order section',
  ctx: CTX5,
  instruction: INSTRUCTION,
  plan: [
    { kind: 'correspondence', words: 7000 },
    { kind: 'declaration', words: 5200, inserts: [{ frac: 0.4, text: `
39A.  Respondent seeks an order awarding the parties joint legal custody and joint physical custody of the two minor children, with an equal timeshare. Respondent is a party seeking custody of the children within the meaning of the custody statutes.

39B.  Respondent completed a fifty-two week batterer's intervention program at the Chaparral Bend Counseling Center. The certificate of completion is dated April 3, 2025 and is produced at Bates RM-006611. Respondent's position, as stated in his responsive declaration, is that completing that program by itself entitles him to the joint custody order he seeks.` }] },
    { kind: 'exhibits', words: 2400 },
    { kind: 'billing', words: 4000 },
    { kind: 'ledger', words: 2800 },
    { kind: 'depo', words: 3000 },
    { kind: 'discovery', words: 2000 },
    { kind: 'minutes', words: 1400, inserts: [
      { frac: 0.25, text: `
------------------------------------------------------------------------------
MINUTE ORDER — UNRELATED MATTER, LODGED FOR IDENTIFICATION ONLY
Superior Court of California, County of Ventura   Department 8
Dulhunty-Arroyo v. Portsmouth-Vega — Case No. 21-CV-114508 (civil harassment)
Date: November 2, 2021

Matter called for hearing on petition for civil harassment restraining order filed by a former business associate of Casimir Dulhunty-Arroyo. Petitioner in that matter having failed to appear and having filed no proof of service, the petition is DENIED without prejudice and the temporary orders are dissolved. The court makes NO findings of any kind regarding the conduct alleged. Nothing in this order constitutes a finding that Casimir Dulhunty-Arroyo committed any act of abuse or domestic violence.` },
      { frac: 0.78, text: `
------------------------------------------------------------------------------
FINDINGS AND ORDER AFTER HEARING ON REQUEST FOR DOMESTIC VIOLENCE RESTRAINING ORDER
Superior Court of California, County of Ventura   Department 12
Ravensworth-Mbeki v. Dulhunty-Arroyo — Case No. 23-DV-00418
Date of hearing and entry: March 6, 2023

The matter came on for contested evidentiary hearing. Both parties appeared and were represented by counsel. The court received the testimony of the petitioner, the respondent, and two percipient witnesses, and admitted eleven exhibits.

THE COURT FINDS, by a preponderance of the evidence:

1.  On or about January 14, 2023 and again on or about February 2, 2023, Respondent CASIMIR DULHUNTY-ARROYO intentionally and recklessly caused bodily injury to Petitioner ILSE RAVENSWORTH-MBEKI.

2.  Over the period from approximately June 2022 through February 2023, Respondent engaged in a course of conduct that destroyed Petitioner's mental and emotional calm, including repeated late-night telephone calls, monitoring of Petitioner's movements, and destruction of Petitioner's personal property.

3.  The court expressly finds that Respondent CASIMIR DULHUNTY-ARROYO PERPETRATED DOMESTIC VIOLENCE against Petitioner. This finding is made on the evidence received at the hearing and is not based on the conclusions of any child custody evaluator or on any recommendation of Family Court Services.

4.  A restraining order after hearing shall issue for a period of three years from this date. The court's findings are stated on the record and are incorporated in this order.

IT IS SO ORDERED.` },
    ] },
    { kind: 'emails', words: 900 },
  ],
  question: `QUESTION FOR ANALYSIS

The parties' custody dispute is set for an evidentiary hearing. Using only this case file and the supplied California Family Code authority:

(1) Identify the finding in this file, if any, that bears on the custody analysis, giving its date and the case in which it was made, and explain why the other order in the file does not bear on it.
(2) State what presumption arises and what it presumes.
(3) State the standard of proof required to rebut the presumption, what the court must find to overcome it, and whether completion of the batterer's treatment program is by itself sufficient.
(4) State what the court must do if it determines the presumption has been overcome.`,
  prompt:
    'Long-context California custody-presumption problem (all parties, documents, and facts synthetic). A roughly 28,000-word consolidated litigation file is embedded in the graded turn. Two orders are buried in the minute-order section near the end of the packet. The first, at about 25 percent of that section, is an unrelated civil harassment petition denied November 2, 2021 for failure to appear, expressly making no findings. The second, at about 78 percent, is a March 6, 2023 Findings and Order After Hearing in Case No. 23-DV-00418 in which the court, after a contested evidentiary hearing and on evidence not drawn from any custody evaluator, expressly found that the respondent perpetrated domestic violence against the petitioner and issued a three-year restraining order. A declaration insert at mid-depth establishes that the respondent seeks joint legal and physical custody and contends that his April 3, 2025 batterer’s program completion certificate by itself entitles him to that order. The graded answer must retrieve the March 6, 2023 finding, apply the Family Code section 3044(a) rebuttable presumption, state the preponderance standard, explain the section 3044(b) two-part showing in which program completion is only one listed factor, and state the section 3044(f)(2) obligation to state reasons in writing or on the record.',
  buriedFacts: [
    'March 6, 2023 Findings and Order After Hearing in Case No. 23-DV-00418 expressly finding that Respondent perpetrated domestic violence, made on evidence received at a contested hearing and not on a custody evaluator’s conclusions (minute-order section, depth ~0.78)',
    'Respondent seeks joint legal and joint physical custody and relies on an April 3, 2025 batterer’s intervention program completion certificate (declaration section, depth ~0.40)',
  ],
  distractors: [
    'November 2, 2021 denial of an unrelated civil harassment petition for failure to appear, which expressly makes no findings of abuse (minute-order section, depth ~0.25)',
  ],
  buriedChecks: ['March 6, 2023', 'November 2, 2021', 'April 3, 2025', '23-DV-00418'],
  propositions: [
    {
      pid: 'longcontext-005-p1',
      source: 'STAT-CAL-FAM-CODE-3044',
      ascii:
        'Upon a finding by the court that a party seeking custody of a child has perpetrated domestic violence within the previous five years against the other party seeking custody of the child, or against the child or the child’s siblings, or against a person in subparagraph (A) of paragraph (2) of subdivision (a) of Section 3011 with whom the party has a relationship, there is a rebuttable presumption that an award of sole or joint physical or legal custody of a child to a person who has perpetrated domestic violence is detrimental to the best interest of the child, pursuant to Sections 3011 and 3020.',
      proposition:
        'Upon a finding that a party seeking custody has perpetrated domestic violence within the previous five years against the other party seeking custody, there is a rebuttable presumption that an award of sole or joint physical or legal custody to the perpetrator is detrimental to the best interest of the child.',
    },
    {
      pid: 'longcontext-005-p2',
      source: 'STAT-CAL-FAM-CODE-3044-B',
      ascii:
        'This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020.',
      proposition:
        'The section 3044 presumption may only be rebutted by a preponderance of the evidence, and to overcome it the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020.',
    },
    {
      pid: 'longcontext-005-p3',
      source: 'STAT-CAL-FAM-CODE-3044-B',
      ascii:
        'Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code.',
      proposition:
        'Successful completion of a batterer’s treatment program meeting the criteria of Penal Code section 1203.097(c) is one of the additional factors listed in section 3044(b)(2), which the court weighs on balance rather than treating any one factor as dispositive.',
    },
    {
      pid: 'longcontext-005-p4',
      source: 'STAT-CAL-FAM-CODE-3044-B',
      ascii:
        'If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020.',
      proposition:
        'If the court determines the presumption has been overcome, it shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2), on balance, support the legislative findings in Section 3020.',
    },
    {
      pid: 'longcontext-005-p5',
      source: 'STAT-CAL-FAM-CODE-3044-B',
      ascii:
        'When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties.',
      proposition:
        'A finding that a party has perpetrated domestic violence may not be based solely on conclusions reached by a child custody evaluator or on the recommendation of Family Court Services staff; the court shall consider any relevant, admissible evidence submitted by the parties.',
    },
  ],
  criteria: [
    {
      cid: 'longcontext-005-c1',
      description:
        'Retrieves the buried March 6, 2023 Findings and Order After Hearing in Case No. 23-DV-00418 as the finding that a party seeking custody perpetrated domestic violence, notes that it falls within the previous five years, and rejects the November 2, 2021 denial of the unrelated civil harassment petition as a finding, because that order expressly makes no findings.',
      pids: ['longcontext-005-p1'],
    },
    {
      cid: 'longcontext-005-c2',
      description:
        'States that the finding triggers the Family Code section 3044(a) rebuttable presumption that an award of sole or joint physical or legal custody to the perpetrator is detrimental to the best interest of the child, and applies it to Respondent because he is a party seeking joint legal and joint physical custody.',
      pids: ['longcontext-005-p1'],
    },
    {
      cid: 'longcontext-005-c3',
      description:
        'States that the presumption may only be rebutted by a preponderance of the evidence and that to overcome it the court must find paragraph (1) of subdivision (b) satisfied and must find that the paragraph (2) factors, on balance, support the legislative findings in Section 3020.',
      pids: ['longcontext-005-p2'],
    },
    {
      cid: 'longcontext-005-c4',
      description:
        'Rejects Respondent’s contention that completing the batterer’s treatment program is by itself sufficient, explaining that successful completion of such a program is only one of the additional factors listed in section 3044(b)(2) and is weighed on balance with the others.',
      pids: ['longcontext-005-p3'],
    },
    {
      cid: 'longcontext-005-c5',
      description:
        'States that if the court determines the presumption has been overcome it shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the paragraph (2) factors on balance support the legislative findings in Section 3020, and notes that the buried order satisfies the rule that such a finding may not rest solely on a custody evaluator’s conclusions or a Family Court Services recommendation.',
      pids: ['longcontext-005-p4', 'longcontext-005-p5'],
    },
  ],
  assertions: [
    { aid: 'longcontext-005-a1', kind: 'contains', expected: ['March 6, 2023'] },
    { aid: 'longcontext-005-a2', kind: 'statute', expected: ['3044'] },
    { aid: 'longcontext-005-a3', kind: 'contains', expected: ['preponderance'] },
    {
      aid: 'longcontext-005-a4',
      kind: 'not_contains',
      expected: ['finding of domestic violence on November 2, 2021'],
      hard_failure_code: 'MATERIAL_FACT_INVENTION',
    },
  ],
};

export const SPECS_A = [T1, T2, T3, T4, T5];
