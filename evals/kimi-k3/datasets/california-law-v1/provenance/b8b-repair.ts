/**
 * b8b-repair.ts -- B8b excerpt repair, tasks.jsonl rebuild step (reproducible builder).
 *
 * WHAT THIS DOES
 *   Rebuilds the three canonical tasks whose criteria/propositions depended on
 *   the two EXCERPT_MISMATCH source records repaired in sources.jsonl by
 *   provenance/b8b-repair-sources.py (CIT-REAL-3 Geiser v. Kuhns, CIT-REAL-15
 *   Wilson v. Cable News Network). Each affected proposition's
 *   authoritative_excerpt is replaced with the corresponding OFFICIAL verbatim
 *   language; criterion descriptions are re-worded to the official language
 *   while preserving legal content; and each task is re-assembled through
 *   evals/kimi-k3/datasetTools/authorTasks.ts::assembleEvalTask so that the
 *   source-entailment guard, the evidence packet, and task_content_sha256 are
 *   recomputed by the same code path that authored the dataset in B1-B7.
 *
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
 *   ./node_modules/.bin/tsx "evals/kimi-k3/datasets/california-law-v1/provenance/b8b-repair.ts"
 *
 * NOTES
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
 * Official verbatim excerpts. Every string below is asserted by
 * assembleEvalTask's SOURCE_ENTAILMENT_FAILED guard to be a
 * whitespace-normalized substring of its named registry record's excerpt.
 * ---------------------------------------------------------------------- */

const GEISER_CAPTION =
  'GREGORY GEISER, Plaintiff and Appellant, v. PETER KUHNS et al., '
  + 'Defendants and Appellants. S262032';
const GEISER_AUTHORSHIP = 'Opinion of the Court by Liu, J.';
const GEISER_PURPOSE =
  'The Legislature enacted Code of Civil Procedure section 425.16 to combat '
  + '“a disturbing increase” in Strategic Lawsuits Against Public '
  + 'Participation (SLAPPs): “lawsuits brought primarily to chill the '
  + 'valid exercise of the constitutional rights of freedom of speech and '
  + 'petition for the redress of grievances.”';
const GEISER_REPORTER_META =
  'In Geiser v. Kuhns, 13 Cal. 5th 1238, 1253–54 (2022), the California '
  + 'Supreme Court clarified';

const WILSON_CAPTION =
  'IN THE SUPREME COURT OF CALIFORNIA STANLEY WILSON, Plaintiff and '
  + 'Appellant, v. CABLE NEWS NETWORK, INC., et al., Defendants and '
  + 'Respondents. S239686';
const WILSON_AUTHORSHIP =
  'July 22, 2019 Justice Kruger authored the opinion of the Court, in which '
  + 'Chief Justice Cantil-Sakauye and Justices Chin, Corrigan, Liu, '
  + 'Cuéllar, and Groban concurred.';
const WILSON_HOLDING =
  'We hold otherwise. The statute contains no exception for discrimination or '
  + 'retaliation claims, and in some cases the actions a plaintiff alleges in '
  + 'support of his or her claim may qualify as protected speech or '
  + 'petitioning activity under section 425.16. In such cases, the '
  + 'plaintiff’s allegations about the defendant’s invidious motives '
  + 'will not shield the claim from the same preliminary screening for minimal '
  + 'merit that would apply to any other claim arising from protected activity.';
const WILSON_REPORTER_META =
  'Wilson v. Cable News Network, Inc. | Date Filed: July 22nd, 2019 | '
  + 'Citations: 444 P.3d 706, 249 Cal. Rptr. 3d 569, 7 Cal. 5th 871 | '
  + 'Docket Number: S239686';

interface CriterionPatch {
  criterion_id: string;
  description: string;
  material: boolean;
  proposition_ids: string[];
}
interface PropositionPatch {
  proposition_id: string;
  source_id: string;
  proposition: string;
  authoritative_excerpt: string;
}
interface TaskPatch {
  criteria: CriterionPatch[];
  provenance: PropositionPatch[];
}

const PATCHES: Record<string, TaskPatch> = {
  'verification-real-001': {
    criteria: [
      {
        criterion_id: 'verification-real-001-c1',
        description:
          'Confirms that a real California Supreme Court decision captioned '
          + 'Geiser v. Kuhns (GREGORY GEISER, Plaintiff and Appellant, v. '
          + 'PETER KUHNS et al., Defendants and Appellants), docket No. '
          + 'S262032, is reported at 13 Cal.5th 1238.',
        material: true,
        proposition_ids: [
          'verification-real-001-p1',
          'verification-real-001-p4',
        ],
      },
      {
        criterion_id: 'verification-real-001-c2',
        description:
          'States that the opinion is a published, precedential California '
          + 'Supreme Court opinion that may be cited.',
        material: true,
        proposition_ids: ['verification-real-001-p2'],
      },
      {
        criterion_id: 'verification-real-001-c3',
        description:
          'Confirms the decision supports the stated anti-SLAPP '
          + 'legislative-purpose point.',
        material: true,
        proposition_ids: ['verification-real-001-p3'],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-001-p1',
        source_id: 'CIT-REAL-3',
        proposition:
          'The official California Supreme Court opinion is captioned GREGORY '
          + 'GEISER, Plaintiff and Appellant, v. PETER KUHNS et al., '
          + 'Defendants and Appellants, and bears docket number S262032.',
        authoritative_excerpt: GEISER_CAPTION,
      },
      {
        proposition_id: 'verification-real-001-p2',
        source_id: 'CIT-REAL-3',
        proposition:
          'The opinion is an opinion of the Court — a published, '
          + 'precedential opinion of the California Supreme Court — '
          + 'authored for the court by Justice Liu.',
        authoritative_excerpt: GEISER_AUTHORSHIP,
      },
      {
        proposition_id: 'verification-real-001-p3',
        source_id: 'CIT-REAL-3',
        proposition:
          'The opinion states that the Legislature enacted Code of Civil '
          + 'Procedure section 425.16 to combat “a disturbing '
          + 'increase” in Strategic Lawsuits Against Public Participation '
          + '(SLAPPs).',
        authoritative_excerpt: GEISER_PURPOSE,
      },
      {
        proposition_id: 'verification-real-001-p4',
        source_id: 'CIT-META-GEISER-CAL5TH-1238',
        proposition:
          'Official citation metadata places the California Supreme Court’s '
          + '2022 decision in Geiser v. Kuhns at 13 Cal. 5th 1238 in the '
          + 'California Official Reports.',
        authoritative_excerpt: GEISER_REPORTER_META,
      },
    ],
  },
  'verification-real-008': {
    criteria: [
      {
        criterion_id: 'verification-real-008-c1',
        description:
          'Confirms that the official-reports citation 7 Cal.5th 871 '
          + 'corresponds to Wilson v. Cable News Network, Inc., California '
          + 'Supreme Court docket No. S239686, decided July 22, 2019.',
        material: true,
        proposition_ids: [
          'verification-real-008-p1',
          'verification-real-008-p3',
          'verification-real-008-p4',
        ],
      },
      {
        criterion_id: 'verification-real-008-c2',
        description:
          'States the holding that the anti-SLAPP statute contains no '
          + 'exception for discrimination or retaliation claims, and that '
          + 'where the alleged actions qualify as protected speech or '
          + 'petitioning activity the plaintiff’s allegations of invidious '
          + 'motive will not shield the claim from the same preliminary '
          + 'screening for minimal merit that applies to any other claim '
          + 'arising from protected activity.',
        material: true,
        proposition_ids: ['verification-real-008-p2'],
      },
      {
        criterion_id: 'verification-real-008-c3',
        description:
          'Identifies the decision as a published, precedential opinion of the '
          + 'California Supreme Court (an opinion of the Court authored by '
          + 'Justice Kruger).',
        material: true,
        proposition_ids: [
          'verification-real-008-p1',
          'verification-real-008-p3',
        ],
      },
    ],
    provenance: [
      {
        proposition_id: 'verification-real-008-p1',
        source_id: 'CIT-REAL-15',
        proposition:
          'Wilson v. Cable News Network, Inc. is a decision of the Supreme '
          + 'Court of California bearing docket number S239686.',
        authoritative_excerpt: WILSON_CAPTION,
      },
      {
        proposition_id: 'verification-real-008-p2',
        source_id: 'CIT-REAL-15',
        proposition:
          'The decision holds that the anti-SLAPP statute contains no '
          + 'exception for discrimination or retaliation claims, and that '
          + 'where the actions a plaintiff alleges qualify as protected speech '
          + 'or petitioning activity under section 425.16, the '
          + 'plaintiff’s allegations about the defendant’s invidious '
          + 'motives will not shield the claim from the same preliminary '
          + 'screening for minimal merit that would apply to any other claim '
          + 'arising from protected activity.',
        authoritative_excerpt: WILSON_HOLDING,
      },
      {
        proposition_id: 'verification-real-008-p3',
        source_id: 'CIT-REAL-15',
        proposition:
          'The opinion was filed July 22, 2019 and is an opinion of the Court '
          + 'authored by Justice Kruger, in which the Chief Justice and every '
          + 'other associate justice concurred.',
        authoritative_excerpt: WILSON_AUTHORSHIP,
      },
      {
        proposition_id: 'verification-real-008-p4',
        source_id: 'CIT-INDEX-CAL-5TH-7',
        proposition:
          'Official-reporter citation index metadata places Wilson v. Cable '
          + 'News Network, Inc. (docket S239686, filed July 22, 2019) at '
          + '7 Cal. 5th 871, with parallel citations 444 P.3d 706 and '
          + '249 Cal. Rptr. 3d 569.',
        authoritative_excerpt: WILSON_REPORTER_META,
      },
    ],
  },
  'research-018': {
    criteria: [
      {
        criterion_id: 'research-018-c3',
        description:
          'States, on the authority of Wilson v. Cable News Network, Inc. '
          + '(2019) 7 Cal.5th 871, that the anti-SLAPP statute contains no '
          + 'exception for discrimination or retaliation claims, and that '
          + 'where the alleged actions qualify as protected activity such '
          + 'claims remain subject to the same preliminary screening for '
          + 'minimal merit that applies to any other claim arising from '
          + 'protected activity.',
        material: true,
        proposition_ids: ['research-018-p3'],
      },
    ],
    provenance: [
      {
        proposition_id: 'research-018-p3',
        source_id: 'CIT-REAL-15',
        proposition:
          'Wilson v. Cable News Network, Inc. (2019) 7 Cal.5th 871 held that '
          + 'the anti-SLAPP statute contains no exception for discrimination '
          + 'or retaliation claims, and that where the actions a plaintiff '
          + 'alleges qualify as protected speech or petitioning activity under '
          + 'section 425.16 the plaintiff’s allegations of invidious '
          + 'motive will not shield the claim from the same preliminary '
          + 'screening for minimal merit that would apply to any other claim '
          + 'arising from protected activity.',
        authoritative_excerpt: WILSON_HOLDING,
      },
    ],
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
      const replacement = patch.criteria.find(
        (item) => item.criterion_id === criterion.criterion_id,
      );
      return replacement ? { ...criterion, ...replacement } : criterion;
    });
    const provenance = task.provenance.map((proposition) => {
      const replacement = patch.provenance.find(
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
    for (const addition of patch.provenance) {
      if (!knownIds.has(addition.proposition_id)) {
        provenance.push({
          proposition_id: addition.proposition_id,
          source_id: addition.source_id,
          proposition: addition.proposition,
          authoritative_excerpt: addition.authoritative_excerpt,
        });
      }
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
  console.log(JSON.stringify({ rebuilt: summary }, null, 1));
}

main();
