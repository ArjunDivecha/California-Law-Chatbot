/**
 * b9b-repair.ts -- B9b round-1 attestation repair, tasks.jsonl rebuild step.
 *
 * WHAT THIS DOES
 *   Round 1 of the cross-vendor machine attestation (verifier-claude-opus-5 and
 *   verifier-gpt-5.6-sol) rejected 18 of the 120 canonical tasks in four defect
 *   classes, listed in provenance/b9b-round1-reconciliation.json. This script
 *   applies the task-side repairs:
 *
 *     A  HEADNOTE/SYNOPSIS EXCERPTS -- CIT-REAL-6/7/8/10/12/13/14 were
 *        re-excerpted to verbatim opinion text by
 *        provenance/b9b-repair-sources.py; every dependent proposition is
 *        re-grounded here on a single uninterrupted run of the court's own
 *        language, and each dependent criterion is reworded to the court's
 *        terms while preserving its legal content.
 *     B  WRONG HARD-FAILURE CODE -- FABRICATED_AUTHORITY on a POSITIVE
 *        presence assertion (the answer must CONTAIN a citation the packet
 *        proves genuine) is incoherent: omitting a real citation is not
 *        fabrication. Those five assertions become
 *        MISSED_CONTROLLING_CONTRARY_AUTHORITY.
 *     C  STATUS NOT ENTAILED -- criteria asserting published / precedential /
 *        citable status are re-grounded on a California Official Reports
 *        volume-index entry (publication in the Official Reports IS what the
 *        index entry records) plus Cal. Rules of Court, rule 8.1115(d) ("A
 *        published California opinion may be cited or relied on as soon as it
 *        is certified for publication or ordered published"). Where no index
 *        entry exists (Geiser v. Kuhns, 13 Cal.5th 1238: CourtListener indexes
 *        only 11 entries for volume 13 Cal.5th, topping out at page 974) the
 *        criterion is grounded on the official federal citation-metadata
 *        record already in the packet plus rule 8.1115(d).
 *     D  OPTIONAL BRANCH -- multiturn-014 C4 and multiturn-015 C3 contained an
 *        "if the purported authority is addressed at all ..." branch that
 *        collided with the task's own not_contains hard assertion; the branch
 *        is deleted and the criterion now names only the reporter page, never
 *        the fabricated caption.
 *
 *   Every rebuilt task is re-assembled through
 *   evals/kimi-k3/datasetTools/authorTasks.ts::assembleEvalTask so the
 *   source-entailment guard, the evidence packet, and task_content_sha256 are
 *   recomputed by the same code path that authored the dataset in B1-B7. Task
 *   ids, categories, prompts, turns and expected_tools are untouched.
 *   Non-affected task lines are copied through byte-identically.
 *
 * INPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl
 *
 * OUTPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl (atomic rewrite)
 *   stdout: JSON summary (old/new task_content_sha256 and evidence ids per rebuilt task)
 *
 * USAGE
 *   ./node_modules/.bin/tsx "evals/kimi-k3/datasets/california-law-v1/provenance/b9b-repair.ts"
 *
 * NOTES
 *   Run provenance/b9b-repair-sources.py FIRST; this script's excerpts are
 *   asserted against the repaired registry by assembleEvalTask and it will
 *   throw SOURCE_ENTAILMENT_FAILED against the pre-repair registry.
 *   Idempotent: re-running against already-repaired data reproduces identical
 *   bytes. No network, no Date.now(), no Math.random().
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleEvalTask } from '../../../datasetTools/authorTasks.js';
import { loadSourceRegistry } from '../../../datasetTools/sourceRegistry.js';
import { atomicWriteFileSync } from '../../../journal.js';
import type { EvalTask, PrimarySourceRecord } from '../../../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, '..');
const SOURCES = join(DATASET, 'sources.jsonl');
const TASKS = join(DATASET, 'tasks.jsonl');

/* -------------------------------------------------------------------------
 * Verbatim excerpt constants. Every string below is asserted by
 * assembleEvalTask's SOURCE_ENTAILMENT_FAILED guard to be a
 * whitespace-normalized substring of its named registry record's excerpt.
 * Each one is a single uninterrupted run of the source; none contains an
 * inserted ellipsis.
 * ---------------------------------------------------------------------- */

/* Cal. Rules of Court, rule 8.1115(d) -- the citability half of every
 * publication-status criterion repaired in class C. */
const CRC_CITABLE =
  'A published California opinion may be cited or relied on as soon as it is '
  + 'certified for publication or ordered published.';
const CRC_CITABLE_PROP =
  'Under California Rules of Court, rule 8.1115(d), a published California '
  + 'opinion may be cited or relied on as soon as it is certified for '
  + 'publication or ordered published.';

/* CIT-REAL-6 -- Stewart v. Colonial Western Agency, Inc. (2001) 87 Cal.App.4th 1006 */
const STEWART_OBJECTIONS =
  '“Objections to the competency of the deponent, or to the relevancy, '
  + 'materiality, or admissibility at trial of the testimony or of the '
  + 'materials produced are unnecessary and are not waived by failure to make '
  + 'them before or during the deposition.” (Italics added.) In other words, '
  + 'the deponent’s counsel should not even raise an objection to a question '
  + 'counsel believes will elicit irrelevant testimony at the deposition. '
  + 'Relevance objections should be held in abeyance until an attempt is made '
  + 'to use the testimony at trial.';
const STEWART_PROTECTIVE_ORDER =
  'Code of Civil Procedure section 2025, subdivision (n) goes on to state that '
  + 'the deposition may be suspended if “any party attending the deposition or '
  + 'the deponent demands the taking of testimony be suspended to enable that '
  + 'party or deponent to move for a protective order on the ground that the '
  + '*1015 examination is being conducted in bad faith or in a manner that '
  + 'unreasonably annoys, embarrasses, or oppresses that deponent or party.” '
  + 'Deposing counsel’s insistence on inquiring into irrelevant areas could '
  + 'justify suspension under this standard, but only if it reaches the point '
  + 'where it could legitimately be said that counsel’s intent was to harass, '
  + 'annoy, embarrass, or oppress. Taken as a whole, these provisions clearly '
  + 'contemplate that deponents not be prevented by counsel from answering a '
  + 'question unless it pertains to privileged matters or deposing counsel’s '
  + 'conduct has reached a stage where suspension is warranted.';

/* CIT-REAL-7 -- Costco Wholesale Corp. v. Superior Court (2009) 47 Cal.4th 725 */
const COSTCO_915 =
  'In this case we consider whether the trial court erred by directing a '
  + 'referee to conduct an in camera review of an opinion letter sent by '
  + 'outside counsel to a corporate client, allowing the referee to redact the '
  + 'letter to conceal that portion the referee believed to be privileged, and '
  + 'ordering the client to disclose the remainder to the opposing party. We '
  + 'conclude the court’s directions and order violated the attorney-client '
  + 'privilege, and violated as well the statutory prohibition against '
  + 'requiring disclosure of information claimed to be subject to the '
  + 'attorney-client privilege in order to rule on a claim of privilege. '
  + '(Evid. Code, § 915, subd. (a).)';
const COSTCO_ENTIRE_COMMUNICATION =
  'when the communication is a confidential one between attorney and client, '
  + 'the entire communication, including its recitation or summary of factual '
  + 'material, is privileged';

/* CIT-REAL-8 -- Cembrook v. Superior Court (1961) 56 Cal.2d 423 */
const CEMBROOK_CAPTION =
  '56 Cal.2d 423 (1961) MICHAEL CEMBROOK, Petitioner, v. SUPERIOR COURT OF THE '
  + 'CITY AND COUNTY OF SAN FRANCISCO, Respondent; STERLING DRUG, INC., Real '
  + 'Party in Interest. Supreme Court of California. Aug. 3, 1961.';
const CEMBROOK_IN_TOTO =
  'neither ambiguity nor burden are of themselves sufficient grounds for '
  + 'denying the right to discovery in toto';
const CEMBROOK_ABUSE =
  'But neither ambiguity nor burden are of themselves sufficient grounds for '
  + 'denying the right to discovery in toto, although either may, if present '
  + 'in sufficient degree, constitute an abuse of the discovery process which '
  + "can and should be limited or eliminated under the court's discretionary "
  + 'power to make any order consistent with justice.';
const CEMBROOK_NARROW =
  'The trial court possesses ample power under sections 2033 and 2019 to '
  + 'correct any abuses that may exist in the requests without sustaining the '
  + 'objections in toto, and thus depriving the petitioner of the right to '
  + 'admissions granted to him by the statute as a matter of right. If the '
  + 'trial court, in its discretion, finds any of the requests impose an '
  + 'unfair burden on the real party in interest because they are repetitious, '
  + 'it possesses the statutory power to make its order sustaining objections '
  + 'to the repetitive portions. If it finds some requests too ambiguous to '
  + 'allow intelligent reply, it may sustain objection to them or, more '
  + 'consistently with justice, it may order such questions to be rephrased.';

/* CIT-REAL-10 -- Bridgestone/Firestone, Inc. v. Superior Court (1992) 7 Cal.App.4th 1384 */
const BRIDGESTONE_CAPTION =
  '7 Cal.App.4th 1384 (1992) 9 Cal. Rptr.2d 709 BRIDGESTONE/FIRESTONE, INC., '
  + 'Petitioner, v. THE SUPERIOR COURT OF ALAMEDA COUNTY, Respondent; NATHAN '
  + 'RIOS, a Minor, etc., et al., Real Parties in Interest. Docket No. '
  + 'A053717. Court of Appeals of California, First District, Division One. '
  + 'June 24, 1992.';
const BRIDGESTONE_RELEVANT =
  'the party seeking discovery must make a prima facie, particularized showing '
  + 'that the information sought is relevant and necessary to the proof of, or '
  + 'defense against, a material element of one or more causes of action '
  + 'presented in the case';
const BRIDGESTONE_ESSENTIAL =
  'and that it is reasonable to conclude that the information sought is '
  + 'essential to a fair resolution of the lawsuit.';

/* CIT-REAL-12 -- In re Marriage of Lippel (1990) 51 Cal.3d 1160 */
const LIPPEL_CAPTION =
  '51 Cal.3d 1160 (1990) 801 P.2d 1041 276 Cal. Rptr. 290 In re the Marriage '
  + 'of ANGELA and RONALD LIPPEL. RONALD LIPPEL, Appellant, v. CITY AND COUNTY '
  + 'OF SAN FRANCISCO, Respondent. Docket No. S013741. Supreme Court of '
  + 'California. December 17, 1990.';
const LIPPEL_QUESTION =
  'In this action we are asked to decide whether it is a denial of due '
  + 'process, as embodied in Code of Civil Procedure section 580 (section '
  + '580), to enter a default judgment ordering a husband to pay child '
  + "support, where the wife's petition for marital dissolution, which was "
  + 'served on the husband, did not request child support and no notice of any '
  + 'such request was ever served on the husband.';
const LIPPEL_HOLDING =
  'In this action we are asked to decide whether it is a denial of due '
  + 'process, as embodied in Code of Civil Procedure section 580 (section '
  + '580), to enter a default judgment ordering a husband to pay child '
  + "support, where the wife's petition for marital dissolution, which was "
  + 'served on the husband, did not request child support and no notice of any '
  + 'such request was ever served on the husband. For the reasons that follow, '
  + 'we conclude that such a default judgment is void for lack of notice and '
  + 'therefore subject to collateral attack by the husband.';
const LIPPEL_VOID =
  'such a default judgment is void for lack of notice and therefore subject to '
  + 'collateral attack by the husband';
const LIPPEL_MORE_RELIEF =
  'that a plaintiff cannot be granted more relief than is asked for in the '
  + 'complaint';

/* CIT-REAL-13 -- Briggs v. Eden Council for Hope & Opportunity (1999) 19 Cal.4th 1106 */
const BRIGGS_CAPTION =
  '81 Cal.Rptr.2d 471 (1999) 19 Cal.4th 1106 969 P.2d 564 Dan BRIGGS et al., '
  + 'Plaintiffs and Appellants, v. EDEN COUNCIL FOR HOPE AND OPPORTUNITY, '
  + 'Defendant and Respondent. No. S062156. Supreme Court of California. '
  + 'January 21, 1999.';
const BRIGGS_HOLDING =
  'Under section 425.16, a defendant moving to strike a cause of action '
  + 'arising from a statement made before, or in connection with an issue '
  + 'under consideration by, a legally authorized official proceeding need not '
  + 'separately demonstrate that the statement concerned an issue of public '
  + 'significance.';
const BRIGGS_HOLDING_INNER =
  'a defendant moving to strike a cause of action arising from a statement '
  + 'made before, or in connection with an issue under consideration by, a '
  + 'legally authorized official proceeding need not separately demonstrate '
  + 'that the statement concerned an issue of public significance';

/* CIT-REAL-14 -- Equilon Enterprises v. Consumer Cause, Inc. (2002) 29 Cal.4th 53 */
const EQUILON_QUESTION =
  'WERDEGAR, J. Must a defendant, in order to obtain a dismissal of a '
  + 'strategic lawsuit against public participation (SLAPP) [1] under Code of '
  + 'Civil Procedure section 425.16 (section 425.16; the anti-SLAPP statute), '
  + 'demonstrate that the action was brought with the intent to chill the '
  + "defendant's exercise of constitutional speech or petition rights? For the "
  + 'following reasons, we conclude not.';
const EQUILON_HOLDING =
  'The Court of Appeal correctly held that Consumer Cause, having satisfied '
  + 'its initial burden under the anti-SLAPP statute of demonstrating that '
  + "Equilon's action was one arising from protected activity (§ 425.16, subd. "
  + "(b)(1)), faced no additional requirement of proving Equilon's subjective "
  + 'intent.';

/* CIT-INDEX-* Official Reports volume-index entries (citation metadata only). */
const IDX_COSTCO =
  'Costco Wholesale Corp. v. Superior Court | Date Filed: November 30th, 2009 '
  + '| Citations: 219 P.3d 736, 47 Cal. 4th 725, 101 Cal. Rptr. 3d 758, 2009 '
  + 'Cal. LEXIS 12375 | Docket Number: No. S163335';
const IDX_CEMBROOK =
  'Cembrook v. Superior Court | Date Filed: August 3rd, 1961 | Citations: 364 '
  + 'P.2d 303, 56 Cal. 2d 423, 15 Cal. Rptr. 127, 1961 Cal. LEXIS 305 | Docket '
  + 'Number: S. F. 20707';
const IDX_BRIGGS =
  'Briggs v. Eden Council for Hope & Opportunity | Date Filed: January 21st, '
  + '1999 | Citations: 969 P.2d 564, 81 Cal. Rptr. 2d 471, 19 Cal. 4th 1106, '
  + '99 Daily Journal DAR 687, 1999 Cal. LEXIS 7, 99 Cal. Daily Op. Serv. 554 '
  + '| Docket Number: S062156';
const IDX_NAVELLIER =
  'Navellier v. Sletten | Date Filed: August 29th, 2002 | Citations: 52 P.3d '
  + '703, 124 Cal. Rptr. 2d 530, 29 Cal. 4th 82, 2002 Daily Journal DAR 9954, '
  + '2002 Cal. LEXIS 5700, 2002 Cal. Daily Op. Serv. 7964 | Docket Number: '
  + 'S095000';
const IDX_BRIDGESTONE =
  'Bridgestone/Firestone, Inc. v. Superior Court | Date Filed: June 24th, 1992 '
  + '| Citations: 7 Cal. App. 4th 1384, 9 Cal. Rptr. 2d 709, 92 Daily Journal '
  + 'DAR 8763, 1992 Cal. App. LEXIS 815, 92 Cal. Daily Op. Serv. 5610 | Docket '
  + 'Number: A053717';
const IDX_FILMON =
  'Filmon.Com. Inc. v. Doubleverify Inc. | Date Filed: May 6th, 2019 | '
  + 'Citations: 439 P.3d 1156, 246 Cal. Rptr. 3d 591, 7 Cal. 5th 133 | Docket '
  + 'Number: S244157';

interface CriterionPatch {
  criterion_id: string;
  description?: string;
  material?: boolean;
  proposition_ids?: string[];
}
interface PropositionPatch {
  proposition_id: string;
  source_id: string;
  proposition: string;
  authoritative_excerpt: string;
}
interface AssertionPatch {
  assertion_id: string;
  hard_failure_code: string;
}
interface TaskPatch {
  criteria?: CriterionPatch[];
  provenance?: PropositionPatch[];
  drop_propositions?: string[];
  assertions?: AssertionPatch[];
}

const PATCHES: Record<string, TaskPatch> = {
  /* ---------------------------------------------------------------- class C */
  'verification-real-001': {
    criteria: [{
      criterion_id: 'verification-real-001-c2',
      description:
        'States that the opinion is published in the California Official '
        + 'Reports at 13 Cal.5th 1238 and, as a published California opinion, '
        + 'may be cited or relied on; it is an opinion of the Court authored '
        + 'for the California Supreme Court by Justice Liu.',
      proposition_ids: [
        'verification-real-001-p2',
        'verification-real-001-p4',
        'verification-real-001-p5',
      ],
    }],
    provenance: [{
      proposition_id: 'verification-real-001-p5',
      source_id: 'CRC-8-1115',
      proposition: CRC_CITABLE_PROP,
      authoritative_excerpt: CRC_CITABLE,
    }],
  },

  'verification-real-002': {
    criteria: [
      {
        criterion_id: 'verification-real-002-c1',
        description:
          'Confirms that the citation 47 Cal.4th 725 corresponds to Costco '
          + 'Wholesale Corp. v. Superior Court, docket No. S163335, filed '
          + 'November 30, 2009.',
        proposition_ids: ['verification-real-002-p1'],
      },
      {
        criterion_id: 'verification-real-002-c2',
        description:
          'Confirms the opinion holds that where the communication is a '
          + 'confidential one between attorney and client, the entire '
          + 'communication, including its recitation or summary of factual '
          + 'material, is privileged.',
        proposition_ids: ['verification-real-002-p2'],
      },
      {
        criterion_id: 'verification-real-002-c3',
        description:
          'States that the decision is published in the California Official '
          + 'Reports at 47 Cal.4th 725 and, as a published California opinion, '
          + 'may be cited or relied on.',
        proposition_ids: [
          'verification-real-002-p1',
          'verification-real-002-p3',
        ],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-002-p1',
        source_id: 'CIT-INDEX-CAL-4TH-47',
        proposition:
          'Official-reporter citation index metadata places Costco Wholesale '
          + 'Corp. v. Superior Court (docket No. S163335, filed November 30, '
          + '2009) at 47 Cal. 4th 725 in the California Official Reports, with '
          + 'parallel citations 219 P.3d 736 and 101 Cal. Rptr. 3d 758.',
        authoritative_excerpt: IDX_COSTCO,
      },
      {
        proposition_id: 'verification-real-002-p2',
        source_id: 'CIT-REAL-7',
        proposition:
          'The opinion states that when the communication is a confidential '
          + 'one between attorney and client, the entire communication, '
          + 'including its recitation or summary of factual material, is '
          + 'privileged.',
        authoritative_excerpt: COSTCO_ENTIRE_COMMUNICATION,
      },
      {
        proposition_id: 'verification-real-002-p3',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  'verification-real-003': {
    criteria: [
      {
        criterion_id: 'verification-real-003-c1',
        description:
          'Confirms that the citation 56 Cal.2d 423 corresponds to Cembrook v. '
          + 'Superior Court of the City and County of San Francisco (Sterling '
          + 'Drug, Inc., real party in interest), California Supreme Court '
          + 'docket No. S.F. 20707, decided August 3, 1961.',
        proposition_ids: [
          'verification-real-003-p1',
          'verification-real-003-p3',
        ],
      },
      {
        criterion_id: 'verification-real-003-c3',
        description:
          'States that the decision is published in the California Official '
          + 'Reports at 56 Cal.2d 423 and, as a published California opinion, '
          + 'may be cited or relied on.',
        proposition_ids: [
          'verification-real-003-p3',
          'verification-real-003-p4',
        ],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-003-p1',
        source_id: 'CIT-REAL-8',
        proposition:
          'The reported decision at 56 Cal.2d 423 is captioned MICHAEL '
          + 'CEMBROOK, Petitioner, v. SUPERIOR COURT OF THE CITY AND COUNTY OF '
          + 'SAN FRANCISCO, Respondent; STERLING DRUG, INC., Real Party in '
          + 'Interest, decided by the Supreme Court of California on August 3, '
          + '1961.',
        authoritative_excerpt: CEMBROOK_CAPTION,
      },
      {
        proposition_id: 'verification-real-003-p3',
        source_id: 'CIT-INDEX-CAL-2D-56',
        proposition:
          'Official-reporter citation index metadata places Cembrook v. '
          + 'Superior Court (docket No. S. F. 20707, filed August 3, 1961) at '
          + '56 Cal. 2d 423 in the California Official Reports, with parallel '
          + 'citations 364 P.2d 303 and 15 Cal. Rptr. 127.',
        authoritative_excerpt: IDX_CEMBROOK,
      },
      {
        proposition_id: 'verification-real-003-p4',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  'verification-real-007': {
    criteria: [
      {
        criterion_id: 'verification-real-007-c1',
        description:
          'Confirms that the citation 19 Cal.4th 1106 corresponds to Briggs v. '
          + 'Eden Council for Hope and Opportunity, California Supreme Court '
          + 'docket No. S062156, decided January 21, 1999.',
        proposition_ids: [
          'verification-real-007-p1',
          'verification-real-007-p3',
        ],
      },
      {
        criterion_id: 'verification-real-007-c3',
        description:
          'States that the decision is published in the California Official '
          + 'Reports at 19 Cal.4th 1106 and, as a published California '
          + 'opinion, may be cited or relied on.',
        proposition_ids: [
          'verification-real-007-p3',
          'verification-real-007-p4',
        ],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-007-p1',
        source_id: 'CIT-REAL-13',
        proposition:
          'The reported decision at 19 Cal.4th 1106 is captioned Dan BRIGGS et '
          + 'al., Plaintiffs and Appellants, v. EDEN COUNCIL FOR HOPE AND '
          + 'OPPORTUNITY, Defendant and Respondent, No. S062156, decided by '
          + 'the Supreme Court of California on January 21, 1999.',
        authoritative_excerpt: BRIGGS_CAPTION,
      },
      {
        proposition_id: 'verification-real-007-p2',
        source_id: 'CIT-REAL-13',
        proposition:
          'The court concludes that under section 425.16 a defendant moving to '
          + 'strike a cause of action arising from a statement made before, or '
          + 'in connection with an issue under consideration by, a legally '
          + 'authorized official proceeding need not separately demonstrate '
          + 'that the statement concerned an issue of public significance.',
        authoritative_excerpt: BRIGGS_HOLDING,
      },
      {
        proposition_id: 'verification-real-007-p3',
        source_id: 'CIT-INDEX-CAL-4TH-19',
        proposition:
          'Official-reporter citation index metadata places Briggs v. Eden '
          + 'Council for Hope & Opportunity (docket No. S062156, filed January '
          + '21, 1999) at 19 Cal. 4th 1106 in the California Official Reports, '
          + 'with parallel citations 969 P.2d 564 and 81 Cal. Rptr. 2d 471.',
        authoritative_excerpt: IDX_BRIGGS,
      },
      {
        proposition_id: 'verification-real-007-p4',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  'verification-real-008': {
    criteria: [{
      criterion_id: 'verification-real-008-c3',
      description:
        'States that the decision is published in the California Official '
        + 'Reports at 7 Cal.5th 871 and, as a published California opinion, '
        + 'may be cited or relied on; it is an opinion of the Court of the '
        + 'California Supreme Court authored by Justice Kruger.',
      proposition_ids: [
        'verification-real-008-p1',
        'verification-real-008-p3',
        'verification-real-008-p4',
        'verification-real-008-p5',
      ],
    }],
    provenance: [{
      proposition_id: 'verification-real-008-p5',
      source_id: 'CRC-8-1115',
      proposition: CRC_CITABLE_PROP,
      authoritative_excerpt: CRC_CITABLE,
    }],
  },

  'verification-real-009': {
    criteria: [{
      criterion_id: 'verification-real-009-c2',
      description:
        'States that the opinion is published in the California Official '
        + 'Reports at 7 Cal.5th 133 and, as a published California opinion, '
        + 'may be cited or relied on; it is the opinion of the court authored '
        + 'by Justice Cuellar.',
      proposition_ids: [
        'verification-real-009-p2',
        'verification-real-009-p4',
        'verification-real-009-p5',
      ],
    }],
    provenance: [
      {
        proposition_id: 'verification-real-009-p4',
        source_id: 'CIT-INDEX-CAL-5TH-7',
        proposition:
          'Official-reporter citation index metadata places FilmOn.com Inc. v. '
          + 'DoubleVerify Inc. (docket No. S244157, filed May 6, 2019) at 7 '
          + 'Cal. 5th 133 in the California Official Reports, with parallel '
          + 'citations 439 P.3d 1156 and 246 Cal. Rptr. 3d 591.',
        authoritative_excerpt: IDX_FILMON,
      },
      {
        proposition_id: 'verification-real-009-p5',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  /* --------------------------------------------------- class A dependents */
  'verification-real-005': {
    criteria: [{
      criterion_id: 'verification-real-005-c1',
      description:
        'Confirms the citation corresponds to Bridgestone/Firestone, Inc. v. '
        + 'The Superior Court of Alameda County (Nathan Rios, a minor, et al., '
        + 'real parties in interest), Court of Appeal, First District, '
        + 'Division One, docket No. A053717, decided June 24, 1992.',
      proposition_ids: ['verification-real-005-p1'],
    }],
    provenance: [{
      proposition_id: 'verification-real-005-p1',
      source_id: 'CIT-REAL-10',
      proposition:
        'The reported decision at 7 Cal.App.4th 1384 is captioned '
        + 'BRIDGESTONE/FIRESTONE, INC., Petitioner, v. THE SUPERIOR COURT OF '
        + 'ALAMEDA COUNTY, Respondent; NATHAN RIOS, a Minor, etc., et al., '
        + 'Real Parties in Interest, Docket No. A053717, decided by the Court '
        + 'of Appeal of California, First District, Division One, on June 24, '
        + '1992.',
      authoritative_excerpt: BRIDGESTONE_CAPTION,
    }],
  },

  'verification-real-006': {
    criteria: [
      {
        criterion_id: 'verification-real-006-c2',
        description:
          'States the holding that entering a default judgment ordering child '
          + 'support where the dissolution petition served on the respondent '
          + 'did not request it, and no notice of any such request was served, '
          + 'is a denial of due process as embodied in Code of Civil Procedure '
          + 'section 580, so that the judgment is void for lack of notice and '
          + 'subject to collateral attack.',
        proposition_ids: ['verification-real-006-p2'],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-006-p1',
        source_id: 'CIT-REAL-12',
        proposition:
          'The reported decision at 51 Cal.3d 1160 is captioned In re the '
          + 'Marriage of ANGELA and RONALD LIPPEL; RONALD LIPPEL, Appellant, '
          + 'v. CITY AND COUNTY OF SAN FRANCISCO, Respondent, Docket No. '
          + 'S013741, decided by the Supreme Court of California on December '
          + '17, 1990.',
        authoritative_excerpt: LIPPEL_CAPTION,
      },
      {
        proposition_id: 'verification-real-006-p2',
        source_id: 'CIT-REAL-12',
        proposition:
          'The court frames the question as whether it is a denial of due '
          + 'process, as embodied in Code of Civil Procedure section 580, to '
          + 'enter a default judgment ordering a husband to pay child support '
          + 'where the dissolution petition served on him did not request it '
          + 'and no notice of any such request was served, and concludes that '
          + 'such a default judgment is void for lack of notice and therefore '
          + 'subject to collateral attack.',
        authoritative_excerpt: LIPPEL_HOLDING,
      },
      {
        proposition_id: 'verification-real-006-p3',
        source_id: 'CIT-REAL-12',
        proposition:
          'The court states that section 580 means what it says: that a '
          + 'plaintiff cannot be granted more relief than is asked for in the '
          + 'complaint.',
        authoritative_excerpt: LIPPEL_MORE_RELIEF,
      },
    ],
  },

  'drafting-011': {
    provenance: [{
      proposition_id: 'drafting-011-p4',
      source_id: 'CIT-REAL-13',
      proposition:
        'Briggs v. Eden Council for Hope and Opportunity (1999) 19 Cal.4th '
        + '1106 concludes that under section 425.16 a defendant moving to '
        + 'strike a cause of action arising from a statement made before, or '
        + 'in connection with an issue under consideration by, a legally '
        + 'authorized official proceeding need not separately demonstrate that '
        + 'the statement concerned an issue of public significance.',
      authoritative_excerpt: BRIGGS_HOLDING,
    }],
  },

  /* ------------------------------------------------- research (A + B + C) */
  'research-016': {
    assertions: [{
      assertion_id: 'research-016-a3',
      hard_failure_code: 'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
    }],
    criteria: [
      {
        criterion_id: 'research-016-c3',
        description:
          'Cites Navellier v. Sletten (2002) 29 Cal.4th 82 — published in the '
          + 'California Official Reports at that citation and therefore '
          + 'citable authority — as stating that same '
          + 'special-motion-to-strike standard.',
        proposition_ids: [
          'research-016-p4',
          'research-016-p6',
          'research-016-p7',
        ],
      },
      {
        criterion_id: 'research-016-c4',
        description:
          'States, on the authority of Equilon Enterprises v. Consumer Cause, '
          + 'Inc. (2002) 29 Cal.4th 53, that a defendant seeking dismissal '
          + 'under section 425.16 need not demonstrate that the action was '
          + "brought with the intent to chill the defendant's exercise of "
          + 'constitutional speech or petition rights: having satisfied its '
          + 'initial burden of showing the claim arises from protected '
          + 'activity, the defendant faces no additional requirement of '
          + "proving the plaintiff's subjective intent.",
        proposition_ids: ['research-016-p5', 'research-016-p8'],
      },
    ],
    provenance: [
      {
        proposition_id: 'research-016-p5',
        source_id: 'CIT-REAL-14',
        proposition:
          'Equilon Enterprises, LLC v. Consumer Cause, Inc. (2002) 29 Cal.4th '
          + '53 holds that the defendant, having satisfied its initial burden '
          + 'under the anti-SLAPP statute of demonstrating that the action was '
          + 'one arising from protected activity, faced no additional '
          + "requirement of proving the plaintiff's subjective intent.",
        authoritative_excerpt: EQUILON_HOLDING,
      },
      {
        proposition_id: 'research-016-p8',
        source_id: 'CIT-REAL-14',
        proposition:
          'The Equilon court frames the question as whether a defendant, in '
          + 'order to obtain dismissal of a SLAPP under section 425.16, must '
          + 'demonstrate that the action was brought with the intent to chill '
          + "the defendant's exercise of constitutional speech or petition "
          + 'rights, and concludes not.',
        authoritative_excerpt: EQUILON_QUESTION,
      },
      {
        proposition_id: 'research-016-p6',
        source_id: 'CIT-INDEX-CAL-4TH-29',
        proposition:
          'Official-reporter citation index metadata places Navellier v. '
          + 'Sletten (docket No. S095000, filed August 29, 2002) at 29 Cal. '
          + '4th 82 in the California Official Reports, with parallel '
          + 'citations 52 P.3d 703 and 124 Cal. Rptr. 2d 530.',
        authoritative_excerpt: IDX_NAVELLIER,
      },
      {
        proposition_id: 'research-016-p7',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  'research-017': {
    provenance: [{
      proposition_id: 'research-017-p5',
      source_id: 'CIT-REAL-13',
      proposition:
        'Briggs v. Eden Council for Hope and Opportunity (1999) 19 Cal.4th '
        + '1106 concludes that under section 425.16 a defendant moving to '
        + 'strike a cause of action arising from a statement made before, or '
        + 'in connection with an issue under consideration by, a legally '
        + 'authorized official proceeding need not separately demonstrate that '
        + 'the statement concerned an issue of public significance.',
      authoritative_excerpt: BRIGGS_HOLDING_INNER,
    }],
  },

  'research-018': {
    assertions: [{
      assertion_id: 'research-018-a1',
      hard_failure_code: 'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
    }],
  },

  'research-020': {
    criteria: [
      {
        criterion_id: 'research-020-c3',
        description:
          'Cites Costco Wholesale Corp. v. Superior Court (2009) 47 Cal.4th '
          + '725 for the holding that where the communication is a '
          + 'confidential one between attorney and client, the entire '
          + 'communication, including its recitation or summary of factual '
          + 'material, is privileged.',
        proposition_ids: ['research-020-p3'],
      },
      {
        criterion_id: 'research-020-c4',
        description:
          'States, on the authority of Costco, that directing a referee to '
          + 'conduct an in camera review of the letter and ordering redacted '
          + 'disclosure of the remainder violated the attorney-client '
          + 'privilege and the statutory prohibition against requiring '
          + 'disclosure of information claimed to be privileged in order to '
          + 'rule on a claim of privilege (Evid. Code, § 915, subd. (a)).',
        proposition_ids: ['research-020-p4'],
      },
    ],
    provenance: [
      {
        proposition_id: 'research-020-p3',
        source_id: 'CIT-REAL-7',
        proposition:
          'Costco Wholesale Corp. v. Superior Court (2009) 47 Cal.4th 725 '
          + 'states that when the communication is a confidential one between '
          + 'attorney and client, the entire communication, including its '
          + 'recitation or summary of factual material, is privileged.',
        authoritative_excerpt: COSTCO_ENTIRE_COMMUNICATION,
      },
      {
        proposition_id: 'research-020-p4',
        source_id: 'CIT-REAL-7',
        proposition:
          'Costco holds that the order directing a referee to conduct an in '
          + 'camera review of the opinion letter, redact it, and order '
          + 'disclosure of the remainder violated the attorney-client '
          + 'privilege and the statutory prohibition against requiring '
          + 'disclosure of information claimed to be subject to that privilege '
          + 'in order to rule on a claim of privilege (Evid. Code, § 915, '
          + 'subd. (a)).',
        authoritative_excerpt: COSTCO_915,
      },
    ],
  },

  'research-021': {
    criteria: [{
      criterion_id: 'research-021-c4',
      description:
        'States, on the authority of Stewart v. Colonial Western Agency, Inc. '
        + '(2001) 87 Cal.App.4th 1006, that objections to the relevancy, '
        + 'materiality, or admissibility at trial of deposition testimony are '
        + 'unnecessary and are not waived by failure to make them at the '
        + 'deposition, and that a deponent must not be prevented by counsel '
        + 'from answering a question unless it pertains to privileged matters '
        + "or deposing counsel's conduct has reached a stage warranting "
        + 'suspension of the deposition to permit a motion for a protective '
        + 'order.',
      proposition_ids: ['research-021-p4', 'research-021-p5'],
    }],
    provenance: [
      {
        proposition_id: 'research-021-p4',
        source_id: 'CIT-REAL-6',
        proposition:
          'Stewart v. Colonial Western Agency, Inc. (2001) 87 Cal.App.4th 1006 '
          + 'states that objections to the competency of the deponent, or to '
          + 'the relevancy, materiality, or admissibility at trial of the '
          + 'testimony or materials produced, are unnecessary and are not '
          + 'waived by failure to make them before or during the deposition, '
          + 'and that relevance objections should be held in abeyance until an '
          + 'attempt is made to use the testimony at trial.',
        authoritative_excerpt: STEWART_OBJECTIONS,
      },
      {
        proposition_id: 'research-021-p5',
        source_id: 'CIT-REAL-6',
        proposition:
          'Stewart states that the deposition may be suspended to enable a '
          + 'party or deponent to move for a protective order, and that these '
          + 'provisions contemplate that deponents not be prevented by counsel '
          + 'from answering a question unless it pertains to privileged '
          + "matters or deposing counsel's conduct has reached a stage where "
          + 'suspension is warranted.',
        authoritative_excerpt: STEWART_PROTECTIVE_ORDER,
      },
    ],
  },

  'research-022': {
    assertions: [{
      assertion_id: 'research-022-a1',
      hard_failure_code: 'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
    }],
    criteria: [{
      criterion_id: 'research-022-c2',
      description:
        'Notes that under Cembrook, although ambiguity or burden may — if '
        + 'present in sufficient degree — constitute an abuse of the discovery '
        + "process, the remedy is the trial court's discretionary power to "
        + 'limit or eliminate that abuse by an order consistent with justice '
        + '(sustaining objections to repetitive portions, or ordering '
        + 'ambiguous questions rephrased), not denial of discovery in toto.',
      proposition_ids: ['research-022-p2', 'research-022-p6'],
    }],
    provenance: [
      {
        proposition_id: 'research-022-p2',
        source_id: 'CIT-REAL-8',
        proposition:
          'Cembrook states that although ambiguity or burden may, if present '
          + 'in sufficient degree, constitute an abuse of the discovery '
          + 'process, such abuse can and should be limited or eliminated under '
          + "the court's discretionary power to make any order consistent with "
          + 'justice, rather than by denying the right to discovery in toto.',
        authoritative_excerpt: CEMBROOK_ABUSE,
      },
      {
        proposition_id: 'research-022-p6',
        source_id: 'CIT-REAL-8',
        proposition:
          'Cembrook states that the trial court possesses ample power to '
          + 'correct abuses in the requests without sustaining the objections '
          + 'in toto — sustaining objections to repetitive portions, or '
          + 'ordering questions that are too ambiguous to allow intelligent '
          + 'reply to be rephrased.',
        authoritative_excerpt: CEMBROOK_NARROW,
      },
    ],
  },

  'research-023': {
    assertions: [{
      assertion_id: 'research-023-a1',
      hard_failure_code: 'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
    }],
    criteria: [
      {
        criterion_id: 'research-023-c1',
        description:
          'States, on the authority of Bridgestone/Firestone, Inc. v. Superior '
          + 'Court (1992) 7 Cal.App.4th 1384, that the party seeking '
          + 'trade-secret discovery must make a prima facie, particularized '
          + 'showing that the information sought is relevant and necessary to '
          + 'the proof of, or defense against, a material element of one or '
          + 'more causes of action presented in the case.',
        proposition_ids: ['research-023-p1'],
      },
      {
        criterion_id: 'research-023-c3',
        description:
          'Identifies Bridgestone/Firestone as published in the California '
          + 'Official Reports at 7 Cal.App.4th 1384 — a Court of Appeal, First '
          + 'District, Division One decision, docket No. A053717, decided June '
          + '24, 1992 — and therefore citable.',
        proposition_ids: [
          'research-023-p3',
          'research-023-p5',
          'research-023-p6',
        ],
      },
    ],
    provenance: [
      {
        proposition_id: 'research-023-p1',
        source_id: 'CIT-REAL-10',
        proposition:
          'Under Bridgestone/Firestone, Inc. v. Superior Court (1992) 7 '
          + 'Cal.App.4th 1384, the party seeking discovery must make a prima '
          + 'facie, particularized showing that the information sought is '
          + 'relevant and necessary to the proof of, or defense against, a '
          + 'material element of one or more causes of action presented in the '
          + 'case.',
        authoritative_excerpt: BRIDGESTONE_RELEVANT,
      },
      {
        proposition_id: 'research-023-p2',
        source_id: 'CIT-REAL-10',
        proposition:
          'Bridgestone/Firestone also requires a showing that it is reasonable '
          + 'to conclude that the information sought is essential to a fair '
          + 'resolution of the lawsuit.',
        authoritative_excerpt: BRIDGESTONE_ESSENTIAL,
      },
      {
        proposition_id: 'research-023-p3',
        source_id: 'CIT-REAL-10',
        proposition:
          'Bridgestone/Firestone, Inc. v. Superior Court was decided by the '
          + 'Court of Appeal of California, First District, Division One, '
          + 'Docket No. A053717, on June 24, 1992.',
        authoritative_excerpt: BRIDGESTONE_CAPTION,
      },
      {
        proposition_id: 'research-023-p5',
        source_id: 'CIT-INDEX-CAL-APP-4TH-7',
        proposition:
          'Official-reporter citation index metadata places '
          + 'Bridgestone/Firestone, Inc. v. Superior Court (docket No. '
          + 'A053717, filed June 24, 1992) at 7 Cal. App. 4th 1384 in the '
          + 'California Official Reports, with parallel citation 9 Cal. Rptr. '
          + '2d 709.',
        authoritative_excerpt: IDX_BRIDGESTONE,
      },
      {
        proposition_id: 'research-023-p6',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  'research-029': {
    assertions: [{
      assertion_id: 'research-029-a2',
      hard_failure_code: 'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
    }],
    criteria: [
      {
        criterion_id: 'research-029-c2',
        description:
          'States, on the authority of In re Marriage of Lippel (1990) 51 '
          + 'Cal.3d 1160, that entering a default judgment ordering child '
          + 'support where the dissolution petition served on the respondent '
          + 'did not request it, and no notice of any such request was served, '
          + 'is a denial of due process as embodied in Code of Civil Procedure '
          + 'section 580.',
        proposition_ids: ['research-029-p2'],
      },
      {
        criterion_id: 'research-029-c3',
        description:
          'States that under Lippel such a default judgment is void for lack '
          + 'of notice and therefore subject to collateral attack — which is '
          + 'why the passage of time and the absence of an appeal do not '
          + 'foreclose relief.',
        proposition_ids: ['research-029-p3'],
      },
    ],
    provenance: [
      {
        proposition_id: 'research-029-p2',
        source_id: 'CIT-REAL-12',
        proposition:
          'In re Marriage of Lippel (1990) 51 Cal.3d 1160 addresses whether it '
          + 'is a denial of due process, as embodied in Code of Civil '
          + 'Procedure section 580, to enter a default judgment ordering a '
          + 'husband to pay child support where the dissolution petition '
          + 'served on him did not request child support and no notice of any '
          + 'such request was ever served on him.',
        authoritative_excerpt: LIPPEL_QUESTION,
      },
      {
        proposition_id: 'research-029-p3',
        source_id: 'CIT-REAL-12',
        proposition:
          'Lippel concludes that such a default judgment is void for lack of '
          + 'notice and therefore subject to collateral attack.',
        authoritative_excerpt: LIPPEL_VOID,
      },
      {
        proposition_id: 'research-029-p4',
        source_id: 'CIT-REAL-12',
        proposition:
          'Lippel states the principle that a plaintiff cannot be granted more '
          + 'relief than is asked for in the complaint.',
        authoritative_excerpt: LIPPEL_MORE_RELIEF,
      },
    ],
  },

  /* ---------------------------------------------------------------- class D */
  'multiturn-014': {
    criteria: [{
      criterion_id: 'multiturn-014-c4',
      description:
        'Does not cite or rely on the purported authority at 18 Cal.4th 1107: '
        + 'the supplied volume-18 Cal.4th index places page 1107 inside '
        + 'Broadman v. Commission on Judicial Performance (18 Cal.4th 1079), '
        + 'with the next indexed case beginning at 18 Cal.4th 1114, so no '
        + 'separate case occupies that citation.',
      proposition_ids: ['multiturn-014-p4', 'multiturn-014-p5'],
    }],
  },

  'multiturn-015': {
    criteria: [{
      criterion_id: 'multiturn-015-c3',
      description:
        'Does not cite or rely on the purported authority at 43 Cal.3d 421: '
        + 'the supplied volume-43 Cal.3d index places page 421 inside People '
        + 'v. Bloyd (43 Cal.3d 333), with the next indexed case beginning at '
        + '43 Cal.3d 472, so no separate case occupies that citation.',
      proposition_ids: ['multiturn-015-p4', 'multiturn-015-p5'],
    }],
  },
};

function main(): void {
  const sourceRecords = loadSourceRegistry(SOURCES);
  const sources = new Map<string, PrimarySourceRecord>(
    sourceRecords.map((record) => [record.source_id, record]),
  );
  const lines = readFileSync(TASKS, 'utf8').split('\n');
  const summary: Record<string, unknown>[] = [];
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const task = JSON.parse(line) as EvalTask;
    const patch = PATCHES[task.id];
    if (!patch) {
      out.push(line);
      continue;
    }
    const criteria = task.criteria.map((criterion) => {
      const replacement = (patch.criteria ?? []).find(
        (item) => item.criterion_id === criterion.criterion_id,
      );
      return replacement ? { ...criterion, ...replacement } : criterion;
    });
    const dropped = new Set(patch.drop_propositions ?? []);
    const provenance = task.provenance
      .filter((item) => !dropped.has(item.proposition_id))
      .map((proposition) => {
        const replacement = (patch.provenance ?? []).find(
          (item) => item.proposition_id === proposition.proposition_id,
        );
        return replacement
          ? {
            proposition_id: replacement.proposition_id,
            source_id: replacement.source_id,
            proposition: replacement.proposition,
            authoritative_excerpt: replacement.authoritative_excerpt,
          }
          : {
            proposition_id: proposition.proposition_id,
            source_id: proposition.source_id,
            proposition: proposition.proposition,
            authoritative_excerpt: proposition.authoritative_excerpt,
          };
      });
    const knownIds = new Set(provenance.map((item) => item.proposition_id));
    for (const addition of patch.provenance ?? []) {
      if (!knownIds.has(addition.proposition_id)) {
        provenance.push({
          proposition_id: addition.proposition_id,
          source_id: addition.source_id,
          proposition: addition.proposition,
          authoritative_excerpt: addition.authoritative_excerpt,
        });
      }
    }
    const deterministic_assertions = task.deterministic_assertions.map(
      (assertion) => {
        const replacement = (patch.assertions ?? []).find(
          (item) => item.assertion_id === assertion.assertion_id,
        );
        return replacement
          ? { ...assertion, hard_failure_code: replacement.hard_failure_code }
          : assertion;
      },
    );
    const draft = {
      id: task.id,
      category: task.category,
      workflow: task.workflow,
      track: task.track,
      prompt: task.prompt,
      turns: task.turns,
      criteria,
      deterministic_assertions,
      expected_tools: task.expected_tools,
      data_class: task.data_class,
      provenance,
    };
    const rebuilt = assembleEvalTask(draft, sources);
    out.push(JSON.stringify(rebuilt));
    summary.push({
      task_id: task.id,
      old_task_content_sha256: task.task_content_sha256,
      new_task_content_sha256: rebuilt.task_content_sha256,
      criteria: rebuilt.criteria.length,
      propositions: rebuilt.provenance.length,
      evidence_source_ids: rebuilt.evidence.map((item) => item.source_id),
    });
  }
  atomicWriteFileSync(TASKS, `${out.join('\n')}\n`, { mode: 0o644 });
  console.log(JSON.stringify({
    rebuilt_count: summary.length,
    rebuilt: summary,
  }, null, 1));
}

main();
