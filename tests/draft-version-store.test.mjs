/**
 * tests/draft-version-store.test.mjs
 *
 * Unit tests for the pure logic in utils/draftVersionStore.ts (phase 1 of
 * the draft versioning system): retention planning, version numbering, and
 * word-delta computation. The IndexedDB/crypto plumbing is exercised by the
 * Playwright browser E2E, not here (Node has no IndexedDB).
 *
 * Input files:  none (pure unit tests)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/draft-version-store.test.mjs
 */

import {
  planPrune,
  nextVersionNumber,
  countWords,
  wordDelta,
  MAX_VERSIONS_PER_SESSION,
} from '../utils/draftVersionStore.ts';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`✅ ${name}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}`);
  }
}

// ---------- word counting ----------
check('countWords basic', countWords('one two  three\n four') === 4);
check('countWords empty', countWords('   ') === 0);
check('wordDelta from null (initial)', wordDelta(null, 'a b c') === 3);
check('wordDelta insertion', wordDelta('a b', 'a b c d') === 2);
check('wordDelta deletion', wordDelta('a b c d', 'a') === -3);

// ---------- version numbering ----------
check('nextVersionNumber empty → 1', nextVersionNumber([]) === 1);
check(
  'nextVersionNumber uses max, not count (pruned chains)',
  nextVersionNumber([{ version: 2 }, { version: 7 }, { version: 5 }]) === 8,
);

// ---------- prune planning ----------
const metas = (n, kind) => Array.from({ length: n }, (_, i) => ({ version: i + 1, kind }));

check('under cap → no prune', planPrune(metas(MAX_VERSIONS_PER_SESSION, 'auto')).length === 0);

const over = metas(MAX_VERSIONS_PER_SESSION + 3, 'auto');
const pruned = planPrune(over);
check('over cap by 3 → prune exactly 3', pruned.length === 3);
check('prunes the OLDEST autos', JSON.stringify(pruned) === JSON.stringify([1, 2, 3]));

// Protected kinds survive: 60 versions where the first 20 are manual.
const mixed = [
  ...Array.from({ length: 20 }, (_, i) => ({ version: i + 1, kind: 'manual' })),
  ...Array.from({ length: 40 }, (_, i) => ({ version: i + 21, kind: 'auto' })),
];
const prunedMixed = planPrune(mixed);
check('manual versions never pruned', prunedMixed.every((v) => v > 20));
check('prunes oldest autos only (21..30)', JSON.stringify(prunedMixed) === JSON.stringify([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]));

// All-protected over cap: nothing pruned (history is precious).
const allManual = metas(MAX_VERSIONS_PER_SESSION + 5, 'manual');
check('all-protected chain over cap → prune nothing', planPrune(allManual).length === 0);

// initial + restore also protected.
const withInitial = [
  { version: 1, kind: 'initial' },
  ...Array.from({ length: MAX_VERSIONS_PER_SESSION + 1 }, (_, i) => ({ version: i + 2, kind: 'auto' })),
  { version: MAX_VERSIONS_PER_SESSION + 3, kind: 'restore' },
];
const prunedInit = planPrune(withInitial);
check('initial/restore protected; autos pruned', !prunedInit.includes(1) && !prunedInit.includes(MAX_VERSIONS_PER_SESSION + 3) && prunedInit.length === 3);

console.log(`\nDraft version store: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
