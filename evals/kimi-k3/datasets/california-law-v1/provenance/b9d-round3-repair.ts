/**
 * b9d-round3-repair.ts -- B9b round-3 attestation repair, tasks.jsonl edit step.
 *
 * WHAT THIS DOES
 *   Preserves, in the provenance chain, the three micro-repairs that round 3 of
 *   the cross-vendor machine attestation produced (commit ca1a9f1, "Dataset B9b
 *   round-3 micro-repairs"). They were originally applied by an ad-hoc script in
 *   the session scratchpad rather than by a provenance script, which left the
 *   documented rebuild chain unable to reproduce the committed dataset. This
 *   file closes that gap; the logic is identical to the script that was run.
 *
 *     1  research-021-a3 -- a POSITIVE contains("protective order") check that
 *        carried hard_failure_code MISSED_CONTROLLING_CONTRARY_AUTHORITY.
 *        Failing to mention a phrase is not missing contrary authority, so the
 *        code cannot be earned by failure of this check; it is deleted. Both
 *        vendors flagged it (gpt-5.6-sol as INCOHERENT_HARD_FAILURE_CODE and a
 *        reject ground, claude-opus-5 as a nit on an approval).
 *
 *     2  research-029-a3 -- the identical defect on contains("void"); the code
 *        is deleted for the same reason.
 *
 *     3  research-029-c3 -- the criterion extended Lippel's "void ... subject
 *        to collateral attack" holding with an unqualified passage-of-time
 *        rider that the excerpt does not state. The description is trimmed back
 *        to the text the excerpt entails.
 *
 *   The assertions themselves are kept in both cases and still count toward
 *   all_pass -- they simply no longer map to a hard-failure class.
 *
 *   Unlike b9b/b9c/b9e-repair.ts this script edits the parsed task objects in
 *   place and recomputes task_content_sha256 with the canonical helper
 *   evals/kimi-k3/integrity.ts::taskContentHash rather than re-assembling
 *   through authorTasks.ts::assembleEvalTask -- that is what the original run
 *   did, and re-assembling would reorder nothing but is not worth the risk of a
 *   byte difference against the committed dataset.
 *
 * INPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl
 *
 * OUTPUT FILES (absolute paths)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/tasks.jsonl (atomic rewrite)
 *   stdout: JSON summary (fixes applied, per-task old/new task_content_sha256)
 *
 * USAGE
 *   ./node_modules/.bin/tsx "evals/kimi-k3/datasets/california-law-v1/provenance/b9d-round3-repair.ts"
 *
 * NOTES
 *   Run order is b9b-repair-sources.py, b9c-repair-sources.py,
 *   b9e-repair-sources.py, ingestSources.ts, b9b-repair.ts, b9c-repair.ts, this
 *   script, then b9e-repair.ts, then buildBundles.ts.
 *   Idempotent: applying it to already-repaired data is a no-op that reproduces
 *   identical bytes (the original script threw instead; this one reports
 *   fixes: 0). No network, no Date.now(), no Math.random().
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskContentHash } from '../../../integrity.js';
import { atomicWriteFileSync } from '../../../journal.js';
import type { EvalTask } from '../../../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, '..', 'tasks.jsonl');

/** assertion_ids whose hard_failure_code is deleted. */
const CLEAR_CODES = new Set(['research-021-a3', 'research-029-a3']);

/** research-029 C3, trimmed to what the Lippel excerpt entails. */
const C3_TRIMMED =
  'States that under Lippel such a default judgment is void for lack of '
  + 'notice and therefore subject to collateral attack.';

function main(): void {
  const lines = readFileSync(TASKS, 'utf8').split('\n');
  const summary: Record<string, unknown>[] = [];
  let fixes = 0;
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const task = JSON.parse(line) as EvalTask;
    if (task.id !== 'research-021' && task.id !== 'research-029') {
      out.push(line);
      continue;
    }
    let taskFixes = 0;
    for (const assertion of task.deterministic_assertions ?? []) {
      if (
        CLEAR_CODES.has(assertion.assertion_id) &&
        assertion.hard_failure_code !== undefined
      ) {
        delete assertion.hard_failure_code;
        taskFixes += 1;
      }
    }
    if (task.id === 'research-029') {
      for (const criterion of task.criteria ?? []) {
        if (
          criterion.criterion_id.endsWith('c3') &&
          criterion.description.includes('passage of time')
        ) {
          criterion.description = C3_TRIMMED;
          taskFixes += 1;
        }
      }
    }
    const before = task.task_content_sha256;
    task.task_content_sha256 = taskContentHash(task);
    fixes += taskFixes;
    summary.push({
      task_id: task.id,
      fixes: taskFixes,
      old_task_content_sha256: before,
      new_task_content_sha256: task.task_content_sha256,
      unchanged: before === task.task_content_sha256,
    });
    out.push(JSON.stringify(task));
  }
  atomicWriteFileSync(TASKS, `${out.join('\n')}\n`, { mode: 0o644 });
  console.log(JSON.stringify({ fixes, tasks: summary }, null, 1));
}

main();
