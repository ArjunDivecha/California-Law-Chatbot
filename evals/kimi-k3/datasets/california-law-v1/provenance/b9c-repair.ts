/**
 * b9c-repair.ts -- B9b round-2 attestation repair, tasks.jsonl rebuild step.
 *
 * WHAT THIS DOES
 *   Round 2 of the cross-vendor machine attestation (verifier-gpt-5.6-sol; the
 *   verdict file is scratchpad attest/gpt56-round2.jsonl) re-reviewed the 19
 *   tasks the B9b round-1 repair rebuilt and rejected 5 of them. This script
 *   applies the task-side round-2 repairs:
 *
 *     1  INCOHERENT HARD-FAILURE CODE ON A POSITIVE YEAR CHECK -- research-018
 *        a4 (contains "2002"), research-021 a4 ("2001"), research-023 a3
 *        ("1992") and research-029 a4 ("1990") are POSITIVE presence checks
 *        that carried hard_failure_code WRONG_EFFECTIVE_DATE. Failing to
 *        MENTION a date is not ASSERTING a wrong one, so the classification is
 *        incoherent; the code is removed. The assertions themselves are kept
 *        and still count toward all_pass -- they simply no longer map to a
 *        hard-failure class. Hard-failure codes are retained everywhere the
 *        semantics genuinely fit (citation-presence checks mapped to
 *        MISSED_CONTROLLING_CONTRARY_AUTHORITY, and the not_contains checks on
 *        invented captions mapped to FABRICATED_AUTHORITY).
 *
 *     2  PINPOINT TOO SHORT FOR THE CRITERION -- research-018 C4 asserts the
 *        Legislature's broad-construction command, but its pinpoint stopped at
 *        the "disturbing increase in lawsuits" sentence. The pinpoint is
 *        extended along the same uninterrupted run of section 425.16(a)
 *        through "To this end, this section shall be construed broadly.",
 *        which is already in the registry excerpt verbatim.
 *
 *     3  CRITERION GROUNDED ON THE QUESTION, NOT THE ANSWER -- research-029 C2
 *        asserted Lippel's due-process holding while quoting only the sentence
 *        posing the question. C2 is re-grounded on the court's own answer: p2
 *        now quotes the opening question TOGETHER WITH "For the reasons that
 *        follow, we conclude that such a default judgment is void for lack of
 *        notice and therefore subject to collateral attack by the husband.",
 *        and two new propositions (p5, p6) quote the due-process analysis in
 *        part II.A that provenance/b9c-repair-sources.py added to the
 *        CIT-REAL-12 excerpt.
 *
 *     4  PUBLICATION STATUS ASKED BUT NOT ENTAILED -- verification-real-005's
 *        prompt asks whether Bridgestone/Firestone is "a real published Court
 *        of Appeal decision", but the packet carried only aggregator-hosted
 *        case text. C1 is re-grounded exactly the way research-023 C3 and
 *        verification-real-002/003/007 were in round 1: the California
 *        Official Reports volume-index entry (CIT-INDEX-CAL-APP-4TH-7, window
 *        covering 7 Cal.App.4th 1384 -- publication in the Official Reports IS
 *        what the index entry records) plus Cal. Rules of Court, rule 8.1115(d)
 *        ("A published California opinion may be cited or relied on as soon as
 *        it is certified for publication or ordered published"). No new source
 *        record was needed: CIT-INDEX-CAL-APP-4TH-7 was ingested in round 1
 *        and already names verification-real-005 as a dependent.
 *
 *   verification-real-006 is rebuilt unchanged (no criterion, proposition or
 *   assertion edit) purely so its embedded evidence packet and source_sha256
 *   track the extended CIT-REAL-12 record; its three proposition excerpts are
 *   still verbatim substrings of the longer excerpt.
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
 *   ./node_modules/.bin/tsx "evals/kimi-k3/datasets/california-law-v1/provenance/b9c-repair.ts"
 *
 * NOTES
 *   Run order is b9b-repair-sources.py, b9c-repair-sources.py, b9b-repair.ts,
 *   then this script. The research-029 excerpts below are asserted against the
 *   EXTENDED CIT-REAL-12 record by assembleEvalTask; this script throws
 *   SOURCE_ENTAILMENT_FAILED against the pre-round-2 registry.
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
 * publication-status criterion, identical to the round-1 repair. */
const CRC_CITABLE =
  'A published California opinion may be cited or relied on as soon as it is '
  + 'certified for publication or ordered published.';
const CRC_CITABLE_PROP =
  'Under California Rules of Court, rule 8.1115(d), a published California '
  + 'opinion may be cited or relied on as soon as it is certified for '
  + 'publication or ordered published.';

/* STAT-CAL-CIV-PROC-CODE-425-16-A -- section 425.16(a) legislative findings,
 * now carried through the broad-construction command research-018 C4 asserts. */
const CCP_425_16_A_FINDINGS =
  'The Legislature finds and declares that there has been a disturbing '
  + 'increase in lawsuits brought primarily to chill the valid exercise of the '
  + 'constitutional rights of freedom of speech and petition for the redress '
  + 'of grievances. The Legislature finds and declares that it is in the '
  + 'public interest to encourage continued participation in matters of public '
  + 'significance, and that this participation should not be chilled through '
  + 'abuse of the judicial process. To this end, this section shall be '
  + 'construed broadly.';

/* CIT-REAL-12 -- In re Marriage of Lippel (1990) 51 Cal.3d 1160. */
const LIPPEL_HOLDING =
  'In this action we are asked to decide whether it is a denial of due '
  + 'process, as embodied in Code of Civil Procedure section 580 (section '
  + '580), to enter a default judgment ordering a husband to pay child '
  + "support, where the wife's petition for marital dissolution, which was "
  + 'served on the husband, did not request child support and no notice of any '
  + 'such request was ever served on the husband. For the reasons that follow, '
  + 'we conclude that such a default judgment is void for lack of notice and '
  + 'therefore subject to collateral attack by the husband.';
const LIPPEL_DUE_PROCESS =
  'It is a fundamental concept of due process that a judgment against a '
  + 'defendant cannot be entered unless he was given proper notice and an '
  + 'opportunity to defend. (U.S. Const., art. XIV; Mullane v. Central '
  + 'Hanover Bank (1950) 339 U.S. 306, 313-315 [94 L.Ed. 865, 872-874, 70 '
  + 'S.Ct. 652].) California satisfies these due process requirements in '
  + 'default cases through section 580.';
const LIPPEL_SPECIFIC_RELIEF =
  'It is fundamental to the concept of due process that a defendant be given '
  + 'notice of the existence of a lawsuit and notice of the specific relief '
  + 'which is sought in the complaint served upon him. The logic underlying '
  + 'this principle is simple: a defendant who has been served with a lawsuit '
  + 'has the right, in view of the relief which the complainant is seeking '
  + 'from him, to decide not to appear and defend. However, a defendant is not '
  + 'in a position to make such a decision if he or she has not been given '
  + 'full notice. The instant case is a prime example of the foregoing; the '
  + 'petition which was served on Ronald sought no monetary relief from him. '
  + 'Therefore, there was no incentive for Ronald to appear and defend.';

/* CIT-INDEX-CAL-APP-4TH-7 -- California Official Reports volume 7 Cal.App.4th
 * citation index, window covering page 1384 (citation metadata only). */
const IDX_BRIDGESTONE =
  'Bridgestone/Firestone, Inc. v. Superior Court | Date Filed: June 24th, 1992 '
  + '| Citations: 7 Cal. App. 4th 1384, 9 Cal. Rptr. 2d 709, 92 Daily Journal '
  + 'DAR 8763, 1992 Cal. App. LEXIS 815, 92 Cal. Daily Op. Serv. 5610 | Docket '
  + 'Number: A053717';

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
interface TaskPatch {
  criteria?: CriterionPatch[];
  provenance?: PropositionPatch[];
  /** assertion_ids whose hard_failure_code is deleted (kept as ordinary
   *  deterministic assertions that still affect all_pass). */
  clear_hard_failure_codes?: string[];
  /** Rebuilt with no edit, so the evidence packet tracks a changed source. */
  rebuild_only?: true;
}

const PATCHES: Record<string, TaskPatch> = {
  /* ------------------------------------------------------------ defect 1+2 */
  'research-018': {
    clear_hard_failure_codes: ['research-018-a4'],
    provenance: [{
      proposition_id: 'research-018-p4',
      source_id: 'STAT-CAL-CIV-PROC-CODE-425-16-A',
      proposition:
        'The Legislature declared that there has been a disturbing increase in '
        + 'lawsuits brought primarily to chill the valid exercise of the '
        + 'constitutional rights of freedom of speech and petition for the '
        + 'redress of grievances, that it is in the public interest to '
        + 'encourage continued participation in matters of public '
        + 'significance, and that to this end section 425.16 shall be '
        + 'construed broadly.',
      authoritative_excerpt: CCP_425_16_A_FINDINGS,
    }],
  },

  /* -------------------------------------------------------------- defect 1 */
  'research-021': {
    clear_hard_failure_codes: ['research-021-a4'],
  },

  'research-023': {
    clear_hard_failure_codes: ['research-023-a3'],
  },

  /* ------------------------------------------------------------ defect 1+3 */
  'research-029': {
    clear_hard_failure_codes: ['research-029-a4'],
    criteria: [{
      criterion_id: 'research-029-c2',
      description:
        'States, on the authority of In re Marriage of Lippel (1990) 51 '
        + 'Cal.3d 1160, that the court answered the due-process question it '
        + 'posed — whether it is a denial of due process, as embodied in Code '
        + 'of Civil Procedure section 580, to enter a default judgment '
        + 'ordering child support where the dissolution petition served on the '
        + 'respondent did not request it and no notice of any such request was '
        + 'served — by concluding that such a default judgment is void for '
        + 'lack of notice and therefore subject to collateral attack: due '
        + 'process forbids entering a judgment against a defendant who was not '
        + 'given proper notice of the existence of the lawsuit and of the '
        + 'specific relief sought in the complaint served on him, and '
        + 'California satisfies those due process requirements in default '
        + 'cases through section 580.',
      proposition_ids: [
        'research-029-p2',
        'research-029-p5',
        'research-029-p6',
      ],
    }],
    provenance: [
      {
        proposition_id: 'research-029-p2',
        source_id: 'CIT-REAL-12',
        proposition:
          'In re Marriage of Lippel (1990) 51 Cal.3d 1160 decides whether it '
          + 'is a denial of due process, as embodied in Code of Civil '
          + 'Procedure section 580, to enter a default judgment ordering a '
          + 'husband to pay child support where the dissolution petition '
          + 'served on him did not request child support and no notice of any '
          + 'such request was ever served on him, and concludes that such a '
          + 'default judgment is void for lack of notice and therefore subject '
          + 'to collateral attack by the husband.',
        authoritative_excerpt: LIPPEL_HOLDING,
      },
      {
        proposition_id: 'research-029-p5',
        source_id: 'CIT-REAL-12',
        proposition:
          'Lippel states that it is a fundamental concept of due process that '
          + 'a judgment against a defendant cannot be entered unless he was '
          + 'given proper notice and an opportunity to defend, and that '
          + 'California satisfies these due process requirements in default '
          + 'cases through Code of Civil Procedure section 580.',
        authoritative_excerpt: LIPPEL_DUE_PROCESS,
      },
      {
        proposition_id: 'research-029-p6',
        source_id: 'CIT-REAL-12',
        proposition:
          'Lippel states that it is fundamental to the concept of due process '
          + 'that a defendant be given notice of the existence of a lawsuit '
          + 'and notice of the specific relief which is sought in the '
          + 'complaint served upon him, and that the case before it is a prime '
          + 'example: the petition served on the husband sought no monetary '
          + 'relief from him, so there was no incentive for him to appear and '
          + 'defend.',
        authoritative_excerpt: LIPPEL_SPECIFIC_RELIEF,
      },
    ],
  },

  /* -------------------------------------------------------------- defect 4 */
  'verification-real-005': {
    criteria: [{
      criterion_id: 'verification-real-005-c1',
      description:
        'Confirms the citation corresponds to Bridgestone/Firestone, Inc. v. '
        + 'The Superior Court of Alameda County (Nathan Rios, a minor, et al., '
        + 'real parties in interest), Court of Appeal, First District, '
        + 'Division One, docket No. A053717, decided June 24, 1992, and states '
        + 'that the decision is published in the California Official Reports '
        + 'at 7 Cal.App.4th 1384 and, as a published California opinion, may '
        + 'be cited or relied on.',
      proposition_ids: [
        'verification-real-005-p1',
        'verification-real-005-p4',
        'verification-real-005-p5',
      ],
    }],
    provenance: [
      {
        proposition_id: 'verification-real-005-p4',
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
        proposition_id: 'verification-real-005-p5',
        source_id: 'CRC-8-1115',
        proposition: CRC_CITABLE_PROP,
        authoritative_excerpt: CRC_CITABLE,
      },
    ],
  },

  /* ------------------------- rebuilt only, to track the extended CIT-REAL-12 */
  'verification-real-006': { rebuild_only: true },
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
    const provenance = task.provenance.map((proposition) => {
      const replacement = (patch.provenance ?? []).find(
        (item) => item.proposition_id === proposition.proposition_id,
      );
      const chosen = replacement ?? proposition;
      return {
        proposition_id: chosen.proposition_id,
        source_id: chosen.source_id,
        proposition: chosen.proposition,
        authoritative_excerpt: chosen.authoritative_excerpt,
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
    const cleared = new Set(patch.clear_hard_failure_codes ?? []);
    const deterministic_assertions = task.deterministic_assertions.map(
      (assertion) => {
        if (!cleared.has(assertion.assertion_id)) return assertion;
        const { hard_failure_code: _dropped, ...rest } = assertion;
        return rest;
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
      unchanged: task.task_content_sha256 === rebuilt.task_content_sha256,
      criteria: rebuilt.criteria.length,
      propositions: rebuilt.provenance.length,
      hard_failure_codes_cleared: [...cleared],
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
