/**
 * b9e-repair.ts -- B9b round-4 attestation repair, tasks.jsonl rebuild step.
 *
 * WHAT THIS DOES
 *   Round 4 of the cross-vendor machine attestation (verifier-gpt-5.6-sol; the
 *   verdict file is scratchpad attest/gpt56-round4.jsonl) re-reviewed the two
 *   tasks the round-3 micro-repair rebuilt. research-029 was APPROVED. The one
 *   remaining rejection is research-021:
 *
 *     UNSUPPORTED_PROPOSITION / CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY /
 *     AMBIGUOUS_AUTHORITY_STATUS -- "C4 attributes the quoted rules to Stewart
 *     (2001) 87 Cal.App.4th 1006 and labels the decision published/certified,
 *     but the case excerpt contains no caption, court, citation, decision
 *     date/year, or publication language."
 *
 *   The substantive half of C4 (what the deposition rules are) was never in
 *   doubt and its two pinpoints are untouched. What was ungrounded is the
 *   IDENTITY of the authority and its PUBLICATION STATUS. C4 is re-grounded
 *   exactly the way round 1 re-grounded research-023 C3 and round 2 re-grounded
 *   verification-real-005 C1 -- both APPROVED by both vendors afterwards:
 *
 *     p6 (new)  the opinion's own opening identification passage, added to the
 *               CIT-REAL-6 excerpt by provenance/b9e-repair-sources.py --
 *               authoring justice, appellate posture, and both party names in
 *               the court's own words.
 *     p7 (new)  the opinion's own Disposition and concurrence block -- the
 *               three-justice appellate panel (a presiding justice plus two
 *               associate justices) and the affirmance.
 *     p8 (new)  the California Official Reports volume-index entry
 *               (CIT-INDEX-CAL-APP-4TH-87, window covering 87 Cal.App.4th
 *               1006), which supplies the case caption, the reporter citation,
 *               the March 14, 2001 filing date and docket No. B139311, and
 *               which IS what publication in the Official Reports consists of.
 *     p9 (new)  Cal. Rules of Court, rule 8.1115(d) -- "A published California
 *               opinion may be cited or relied on as soon as it is certified
 *               for publication or ordered published."
 *
 *   C4's description now states the identity and citability in the terms those
 *   four propositions entail, and drops the bare "(2001) 87 Cal.App.4th 1006"
 *   attribution that rested on registry metadata alone. It deliberately does
 *   NOT say "Court of Appeal": no packet excerpt uses that phrase, so the
 *   criterion says "appellate opinion published in the California Official
 *   Reports at 87 Cal.App.4th 1006", every word of which is quoted underneath
 *   it. Criteria C1-C3, all four deterministic assertions (a4's contains-"2001"
 *   check is now packet-grounded rather than requiring outside knowledge), the
 *   prompt, the turns and expected_tools are untouched, as are propositions
 *   p1-p5.
 *
 *   research-021 is the ONLY dependent of CIT-REAL-6 in the dataset and
 *   CIT-INDEX-CAL-APP-4TH-87 is new, so no other task's evidence packet moves.
 *
 *   The task is re-assembled through
 *   evals/kimi-k3/datasetTools/authorTasks.ts::assembleEvalTask so the
 *   source-entailment guard, the evidence packet and task_content_sha256 are
 *   recomputed by the same code path that authored the dataset in B1-B7, and
 *   the result is then re-checked against the canonical
 *   evals/kimi-k3/integrity.ts::taskContentHash helper (a stale hash fails
 *   BENCHMARK_INTEGRITY). Non-affected task lines are copied through
 *   byte-identically.
 *
 * INPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl
 *
 * OUTPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl (atomic rewrite)
 *   stdout: JSON summary (old/new task_content_sha256, criteria/proposition counts, evidence ids)
 *
 * USAGE
 *   ./node_modules/.bin/tsx "evals/kimi-k3/datasets/california-law-v1/provenance/b9e-repair.ts"
 *
 * NOTES
 *   Run order is b9b-repair-sources.py, b9c-repair-sources.py,
 *   b9e-repair-sources.py, datasetTools/ingestSources.ts (index candidate),
 *   b9b-repair.ts, b9c-repair.ts, b9d-round3-repair.ts, then this script, then
 *   review-bundles/buildBundles.ts. The excerpts below are asserted against the
 *   EXTENDED CIT-REAL-6 record and the new index record by assembleEvalTask;
 *   this script throws SOURCE_ENTAILMENT_FAILED or UNKNOWN_SOURCE_ID against
 *   the pre-round-4 registry.
 *   Idempotent: re-running against already-repaired data reproduces identical
 *   bytes. No network, no Date.now(), no Math.random().
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleEvalTask } from '../../../datasetTools/authorTasks.js';
import { loadSourceRegistry } from '../../../datasetTools/sourceRegistry.js';
import { taskContentHash } from '../../../integrity.js';
import { atomicWriteFileSync } from '../../../journal.js';
import type { EvalTask, PrimarySourceRecord } from '../../../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, '..');
const SOURCES = join(DATASET, 'sources.jsonl');
const TASKS = join(DATASET, 'tasks.jsonl');
const TARGET = 'research-021';

/* -------------------------------------------------------------------------
 * Verbatim excerpt constants. Every string below is asserted by
 * assembleEvalTask's SOURCE_ENTAILMENT_FAILED guard to be a
 * whitespace-normalized substring of its named registry record's excerpt.
 * Each one is a single uninterrupted run of the source; none contains an
 * inserted ellipsis.
 * ---------------------------------------------------------------------- */

/* CIT-REAL-6 run 1 -- the opinion's own opening identification passage. */
const STEWART_OPENING =
  'Opinion CURRY, J.— Background This is an appeal from an order imposing '
  + 'sanctions in the amount of $2,400 on appellant Colonial Western Agency, '
  + 'Inc.’s counsel. The underlying matter involves a complaint by '
  + 'respondent Mary Martha Stewart against Colonial Western.';

/* CIT-REAL-6 run 4 -- the opinion's own Disposition and concurrence block. */
const STEWART_DISPOSITION =
  'Disposition The January 18, 2000, order imposing sanctions on Colonial '
  + 'Western’s counsel as corrected nunc pro tunc on September 20, 2000, '
  + 'is affirmed. Vogel (C. S.), P. J., and Hastings, J., concurred.';

/* CIT-INDEX-CAL-APP-4TH-87 -- California Official Reports volume 87
 * Cal.App.4th citation index, window covering page 1006 (citation metadata
 * only). */
const IDX_STEWART =
  'Stewart v. Colonial Western Agency, Inc. | Date Filed: March 14th, 2001 | '
  + 'Citations: 87 Cal. App. 4th 1006, 105 Cal. Rptr. 2d 115, 2001 Daily '
  + 'Journal DAR 2663, 2001 Cal. App. LEXIS 197, 2001 Cal. Daily Op. Serv. '
  + '2090 | Docket Number: No. B139311';

/* Cal. Rules of Court, rule 8.1115(d) -- the citability half of every
 * publication-status criterion, identical to the round-1 and round-2 repairs. */
const CRC_CITABLE =
  'A published California opinion may be cited or relied on as soon as it is '
  + 'certified for publication or ordered published.';
const CRC_CITABLE_PROP =
  'Under California Rules of Court, rule 8.1115(d), a published California '
  + 'opinion may be cited or relied on as soon as it is certified for '
  + 'publication or ordered published.';

const C4_DESCRIPTION =
  'States, on the authority of Stewart v. Colonial Western Agency, Inc. — the '
  + 'appellate opinion published in the California Official Reports at 87 '
  + 'Cal.App.4th 1006, filed March 14, 2001 in docket No. B139311, and '
  + 'citable as a published California opinion — that objections to the '
  + 'competency of the deponent, or to the relevancy, materiality, or '
  + 'admissibility at trial of the testimony or of the materials produced, are '
  + 'unnecessary and are not waived by failure to make them before or during '
  + 'the deposition, and that a deponent must not be prevented by counsel from '
  + 'answering a question unless it pertains to privileged matters or deposing '
  + "counsel's conduct has reached a stage where suspension of the deposition "
  + 'to permit a motion for a protective order is warranted.';

interface PropositionPatch {
  proposition_id: string;
  source_id: string;
  proposition: string;
  authoritative_excerpt: string;
}

const NEW_PROPOSITIONS: PropositionPatch[] = [
  {
    proposition_id: 'research-021-p6',
    source_id: 'CIT-REAL-6',
    proposition:
      'The opinion reported at 87 Cal.App.4th 1006 was authored by Curry, J., '
      + 'and is an appeal from an order imposing sanctions in the amount of '
      + "$2,400 on appellant Colonial Western Agency, Inc.'s counsel in a "
      + 'matter brought by respondent Mary Martha Stewart against Colonial '
      + 'Western.',
    authoritative_excerpt: STEWART_OPENING,
  },
  {
    proposition_id: 'research-021-p7',
    source_id: 'CIT-REAL-6',
    proposition:
      'The appellate panel deciding the case affirmed the January 18, 2000 '
      + 'sanctions order as corrected nunc pro tunc on September 20, 2000, '
      + 'with Vogel (C. S.), P. J., and Hastings, J., concurring in the '
      + 'opinion.',
    authoritative_excerpt: STEWART_DISPOSITION,
  },
  {
    proposition_id: 'research-021-p8',
    source_id: 'CIT-INDEX-CAL-APP-4TH-87',
    proposition:
      'Official-reporter citation index metadata places Stewart v. Colonial '
      + 'Western Agency, Inc. (docket No. B139311, filed March 14, 2001) at 87 '
      + 'Cal. App. 4th 1006 in the California Official Reports, with parallel '
      + 'citation 105 Cal. Rptr. 2d 115.',
    authoritative_excerpt: IDX_STEWART,
  },
  {
    proposition_id: 'research-021-p9',
    source_id: 'CRC-8-1115',
    proposition: CRC_CITABLE_PROP,
    authoritative_excerpt: CRC_CITABLE,
  },
];

const C4_PROPOSITION_IDS = [
  'research-021-p4',
  'research-021-p5',
  'research-021-p6',
  'research-021-p7',
  'research-021-p8',
  'research-021-p9',
];

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
    if (task.id !== TARGET) {
      out.push(line);
      continue;
    }
    const criteria = task.criteria.map((criterion) =>
      criterion.criterion_id === 'research-021-c4'
        ? {
          ...criterion,
          description: C4_DESCRIPTION,
          proposition_ids: C4_PROPOSITION_IDS,
        }
        : criterion
    );
    const provenance = task.provenance.map((proposition) => ({
      proposition_id: proposition.proposition_id,
      source_id: proposition.source_id,
      proposition: proposition.proposition,
      authoritative_excerpt: proposition.authoritative_excerpt,
    }));
    const knownIds = new Set(provenance.map((item) => item.proposition_id));
    for (const addition of NEW_PROPOSITIONS) {
      if (!knownIds.has(addition.proposition_id)) provenance.push(addition);
    }
    const draft = {
      id: task.id,
      category: task.category,
      workflow: task.workflow,
      track: task.track,
      prompt: task.prompt,
      turns: task.turns,
      criteria,
      deterministic_assertions: task.deterministic_assertions,
      expected_tools: task.expected_tools,
      data_class: task.data_class,
      provenance,
    };
    const rebuilt = assembleEvalTask(draft, sources);
    const canonical = taskContentHash(rebuilt);
    if (rebuilt.task_content_sha256 !== canonical) {
      throw new Error(
        `task_content_sha256 disagrees with integrity.taskContentHash for `
        + `${task.id}: ${rebuilt.task_content_sha256} vs ${canonical}`,
      );
    }
    out.push(JSON.stringify(rebuilt));
    summary.push({
      task_id: task.id,
      old_task_content_sha256: task.task_content_sha256,
      new_task_content_sha256: rebuilt.task_content_sha256,
      canonical_helper_agrees: true,
      unchanged: task.task_content_sha256 === rebuilt.task_content_sha256,
      criteria: rebuilt.criteria.length,
      propositions: rebuilt.provenance.length,
      evidence_source_ids: rebuilt.evidence.map((item) => item.source_id),
    });
  }
  if (summary.length !== 1) {
    throw new Error(`expected to rebuild exactly ${TARGET}, got ${summary.length}`);
  }
  atomicWriteFileSync(TASKS, `${out.join('\n')}\n`, { mode: 0o644 });
  console.log(JSON.stringify({ rebuilt_count: summary.length, rebuilt: summary }, null, 1));
}

main();
