/**
 * utils/draftRedline.ts
 *
 * Redline computation for the V2 Draft page (phase 2 of the draft
 * versioning system): given two document versions, produce a word-level
 * diff a lawyer can read — insertions and deletions on word boundaries,
 * not character soup.
 *
 * Engine: diff-match-patch (character-level, O(nd)) followed by
 * `cleanupSemantic` and a word-boundary snap pass: any ins/del whose edges
 * fall mid-word are widened to the whole word, with the overlap re-emitted
 * on both sides, so "Arjun" → "Arjuna" renders as [-Arjun-]{+Arjuna+}
 * rather than an insertion of a bare "a".
 *
 * Output is a flat op list ({type: 'equal'|'ins'|'del', text}) consumed by
 * the RedlineView component (and, in phase 3, the tracked-changes DOCX
 * exporter).
 *
 * No file I/O.
 */

import DiffMatchPatch from 'diff-match-patch';

export type RedlineOpType = 'equal' | 'ins' | 'del';

export interface RedlineOp {
  type: RedlineOpType;
  text: string;
}

export interface RedlineStats {
  insertedWords: number;
  deletedWords: number;
  /** True when the two texts are identical. */
  identical: boolean;
}

const WORD_CHAR = /[A-Za-z0-9_'’À-ɏ]/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

const MAX_SNAP_FRAG = 40;

/**
 * Snap a raw DMP diff to word boundaries so in-word edits render as whole
 * words on BOTH sides ("Arjun" → "Arjuna" shows [-Arjun-]{+Arjuna+}, never a
 * bare inserted "a").
 *
 * For each changed run (maximal block of consecutive ins/del ops): if the
 * run's boundary with a neighbouring equal op falls inside a word, the word
 * fragment is moved out of the equal op and onto every op in the run —
 * prefixed from the left equal, suffixed from the right equal. When the run
 * has only one side (insertion-only or deletion-only), a synthetic op of the
 * missing type is added carrying just the fragment, so the reconstruction
 * invariant holds: equal+del ops always rebuild the old text, equal+ins ops
 * always rebuild the new text.
 */
export function snapToWordBoundaries(diffs: Array<[number, string]>): Array<[number, string]> {
  const out: Array<[number, string]> = diffs.map((d) => [d[0], d[1]]);

  for (let i = 0; i < out.length; i += 1) {
    if (out[i][0] === 0) continue;
    const runStart = i;
    let runEnd = i; // exclusive
    while (runEnd < out.length && out[runEnd][0] !== 0) runEnd += 1;

    // --- Left boundary ---
    const leftEq = runStart > 0 && out[runStart - 1][0] === 0 ? out[runStart - 1] : null;
    if (leftEq && isWordChar(leftEq[1][leftEq[1].length - 1])) {
      const runStartsMidWord =
        rangeSome(out, runStart, runEnd, (t) => isWordChar(t[0])) ||
        // insertion/deletion that lands inside a word: the text after the
        // run continues the word the equal ended with.
        (runEnd < out.length && isWordChar(out[runEnd][1][0]));
      if (runStartsMidWord) {
        let k = leftEq[1].length;
        while (k > 0 && isWordChar(leftEq[1][k - 1])) k -= 1;
        const frag = leftEq[1].slice(k);
        if (frag && frag.length <= MAX_SNAP_FRAG) {
          leftEq[1] = leftEq[1].slice(0, k);
          for (let m = runStart; m < runEnd; m += 1) out[m][1] = frag + out[m][1];
          // Keep both sides reconstructable when the run is one-sided.
          if (!rangeHasType(out, runStart, runEnd, -1)) {
            out.splice(runStart, 0, [-1, frag]);
            runEnd += 1;
            i = runStart;
          } else if (!rangeHasType(out, runStart, runEnd, 1)) {
            out.splice(runEnd, 0, [1, frag]);
            runEnd += 1;
          }
        }
      }
    }

    // --- Right boundary ---
    const rightEq = runEnd < out.length && out[runEnd][0] === 0 ? out[runEnd] : null;
    if (rightEq && isWordChar(rightEq[1][0])) {
      const runEndsMidWord =
        rangeSome(out, runStart, runEnd, (t) => isWordChar(t[t.length - 1])) ||
        (runStart > 0 && out[runStart - 1][0] === 0 && isWordChar(out[runStart - 1][1][out[runStart - 1][1].length - 1] ?? ''));
      if (runEndsMidWord) {
        let k = 0;
        while (k < rightEq[1].length && isWordChar(rightEq[1][k])) k += 1;
        const frag = rightEq[1].slice(0, k);
        if (frag && frag.length <= MAX_SNAP_FRAG) {
          rightEq[1] = rightEq[1].slice(k);
          for (let m = runStart; m < runEnd; m += 1) out[m][1] = out[m][1] + frag;
          if (!rangeHasType(out, runStart, runEnd, -1)) {
            out.splice(runStart, 0, [-1, frag]);
            runEnd += 1;
          } else if (!rangeHasType(out, runStart, runEnd, 1)) {
            out.splice(runEnd, 0, [1, frag]);
            runEnd += 1;
          }
        }
      }
    }

    i = runEnd - 1;
  }

  return out.filter((d) => d[1].length > 0);
}

function rangeHasType(ops: Array<[number, string]>, from: number, to: number, type: number): boolean {
  for (let i = from; i < to; i += 1) if (ops[i][0] === type) return true;
  return false;
}

function rangeSome(ops: Array<[number, string]>, from: number, to: number, pred: (text: string) => boolean): boolean {
  for (let i = from; i < to; i += 1) if (ops[i][1] && pred(ops[i][1])) return true;
  return false;
}

/** Merge adjacent ops of the same type. */
function coalesce(ops: RedlineOp[]): RedlineOp[] {
  const out: RedlineOp[] = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (last && last.type === op.type) last.text += op.text;
    else out.push({ ...op });
  }
  return out.filter((o) => o.text.length > 0);
}

/** Word-level redline between two documents. */
export function computeRedline(oldText: string, newText: string): { ops: RedlineOp[]; stats: RedlineStats } {
  if (oldText === newText) {
    return {
      ops: [{ type: 'equal', text: newText }],
      stats: { insertedWords: 0, deletedWords: 0, identical: true },
    };
  }
  const dmp = new DiffMatchPatch();
  dmp.Diff_Timeout = 5;
  const raw = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(raw);
  const snapped = snapToWordBoundaries(raw);
  const ops = coalesce(
    snapped.map(([t, text]) => ({
      type: t === 0 ? ('equal' as const) : t === 1 ? ('ins' as const) : ('del' as const),
      text,
    })),
  );
  let insertedWords = 0;
  let deletedWords = 0;
  for (const op of ops) {
    const words = (op.text.match(/\S+/g) ?? []).length;
    if (op.type === 'ins') insertedWords += words;
    else if (op.type === 'del') deletedWords += words;
  }
  return { ops, stats: { insertedWords, deletedWords, identical: false } };
}
