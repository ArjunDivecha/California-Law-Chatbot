/**
 * tests/draft-redline.test.mjs
 *
 * Unit tests for utils/draftRedline.ts (phase 2 of draft versioning):
 * word-level redline computation. The invariants that matter:
 *   1. Reconstruction: equal+del ops reproduce the old text exactly;
 *      equal+ins ops reproduce the new text exactly. (A redline that
 *      doesn't reconstruct both sides is lying about the documents.)
 *   2. Word-boundary readability: an in-word edit ("Arjun"→"Arjuna")
 *      shows both whole words, never a bare inserted letter.
 *
 * Input files:  none (pure unit tests)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/draft-redline.test.mjs
 */

import { computeRedline } from '../utils/draftRedline.ts';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`✅ ${name}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function oldSide(ops) {
  return ops.filter((o) => o.type !== 'ins').map((o) => o.text).join('');
}
function newSide(ops) {
  return ops.filter((o) => o.type !== 'del').map((o) => o.text).join('');
}
function render(ops) {
  return ops
    .map((o) => (o.type === 'ins' ? `{+${o.text}+}` : o.type === 'del' ? `[-${o.text}-]` : o.text))
    .join('');
}

// ---------- identity ----------
const same = computeRedline('The parties agree.', 'The parties agree.');
check('identical → single equal op', same.ops.length === 1 && same.ops[0].type === 'equal');
check('identical → stats.identical', same.stats.identical === true);

// ---------- reconstruction invariant over a corpus of edits ----------
const CASES = [
  ['Arjun Divecha (the "Senior Advisor")', 'Arjuna Divecha (the "Senior Advisor")'],
  ['fourteen (14) days prior written notice', 'thirty (30) days prior written notice'],
  ['The term shall commence on the Start Date.', 'The term shall commence on the Effective Date and end on December 31, 2025.'],
  ['Section 3. Term; Termination.', 'Section 3. Term.'],
  ['a b c', 'a b c d e f'],
  ['entire paragraph removed here', ''],
  ['', 'entire paragraph added here'],
  ['same start different tail one', 'same start different tail two'],
  ['GMO and the Senior Advisor acknowledge and agree', 'GMO and the Senior Advisor both specifically acknowledge and agree'],
];
for (const [a, b] of CASES) {
  const { ops } = computeRedline(a, b);
  check(`reconstructs old: "${a.slice(0, 30)}…"`, oldSide(ops) === a, JSON.stringify(oldSide(ops)));
  check(`reconstructs new: "${b.slice(0, 30)}…"`, newSide(ops) === b, JSON.stringify(newSide(ops)));
}

// ---------- word-boundary readability ----------
const arjun = computeRedline('between GMO and Arjun Divecha herein', 'between GMO and Arjuna Divecha herein');
const arjunR = render(arjun.ops);
check(
  'in-word edit shows whole words (Arjun→Arjuna)',
  arjunR.includes('[-Arjun-]') && arjunR.includes('{+Arjuna+}'),
  arjunR,
);
check('in-word edit counts 1 del + 1 ins word', arjun.stats.deletedWords === 1 && arjun.stats.insertedWords === 1);

const num = computeRedline('within fourteen (14) days', 'within thirty (30) days');
const numR = render(num.ops);
check(
  'number swap keeps words whole',
  numR.includes('[-fourteen') && numR.includes('{+thirty') && !/\{\+[a-z]\+\}/.test(numR),
  numR,
);

// Pure insertion mid-sentence stays clean.
const insOnly = computeRedline('agree to the terms herein', 'agree to all of the terms herein');
check('pure insertion reconstructs', oldSide(insOnly.ops) === 'agree to the terms herein' && newSide(insOnly.ops) === 'agree to all of the terms herein');

// Mid-word insertion ("runing"→"running") must show whole words on both sides.
const midWord = computeRedline('the runing total', 'the running total');
const midWordR = render(midWord.ops);
check('mid-word insertion reconstructs old', oldSide(midWord.ops) === 'the runing total', midWordR);
check('mid-word insertion reconstructs new', newSide(midWord.ops) === 'the running total', midWordR);
check('mid-word insertion shows whole words', midWordR.includes('[-runing-]') && midWordR.includes('{+running+}'), midWordR);

// ---------- stats ----------
const stats = computeRedline('one two three', 'one four five six').stats;
check('stats count inserted/deleted words', stats.insertedWords === 3 && stats.deletedWords === 2, JSON.stringify(stats));

console.log(`\nDraft redline: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
