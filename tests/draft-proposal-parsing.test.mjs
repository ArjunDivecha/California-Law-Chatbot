/**
 * tests/draft-proposal-parsing.test.mjs
 *
 * Regression tests for the Draft page proposal parsing
 * (utils/draftProposals.ts), added after the 2026-08-07 "brain fart": a
 * max_tokens-truncated reply failed strict JSON parsing and the UI dumped
 * raw JSON at the attorney. salvageChanges() must recover every complete
 * proposal from a truncated reply.
 *
 * Input files:  none (pure unit tests)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/draft-proposal-parsing.test.mjs
 */

import { parseChangesJson, salvageChanges } from '../utils/draftProposals.ts';

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

const change = (n) =>
  `{"section":"Section ${n}","description":"desc ${n}","rationale":"why ${n}","find":"find text ${n}","replace":"replace text ${n}"}`;

// ---------- strict parse ----------
const complete = `{"changes":[${change(1)},${change(2)}]}`;
const p1 = parseChangesJson(complete);
check('complete JSON parses to 2 changes', p1?.length === 2 && p1[0].section === 'Section 1');

const fenced = '```json\n' + complete + '\n```';
check('fenced JSON parses', parseChangesJson(fenced)?.length === 2);

const prose = `Here are my suggestions:\n${complete}\nLet me know.`;
check('JSON with surrounding prose parses', parseChangesJson(prose)?.length === 2);

check('empty changes array parses to []', parseChangesJson('{"changes":[]}')?.length === 0);
check('non-JSON returns null', parseChangesJson('I cannot help with that.') === null);

// ---------- salvage from truncation ----------
// Cut mid-way through the third change — exactly the production failure.
const third = change(3);
const truncated = `{"changes":[${change(1)},${change(2)},${third.slice(0, 40)}`;
check('strict parse fails on truncated reply', parseChangesJson(truncated) === null);
const s1 = salvageChanges(truncated);
check('salvage recovers the 2 complete changes', s1.length === 2);
check('salvaged change fields intact', s1[1].find === 'find text 2' && s1[1].replace === 'replace text 2');

// Truncation inside a string containing escaped quotes and braces (the
// production reply had \"20254\" and {}-looking text inside strings).
const tricky =
  '{"changes":[{"section":"Preamble","description":"Fix the year","rationale":"\\"20254\\" is a typo {obviously}","find":"is made and entered into on [__________], 20254","replace":"is made and entered into on [__________], 2025"},{"section":"Sec 2","description":"cut off here';
const s2 = salvageChanges(tricky);
check('salvage handles escaped quotes + braces inside strings', s2.length === 1 && s2[0].find.includes('20254'));

// A complete object missing "find" is unusable — salvage must drop it.
const noFind = '{"changes":[{"section":"A","description":"d","rationale":"r","replace":"x"},' + change(2) + ']}';
const s3 = salvageChanges(noFind);
check('salvage drops proposals without a usable find', s3.length === 1 && s3[0].section === 'Section 2');

// Degenerate inputs.
check('salvage of empty string → []', salvageChanges('').length === 0);
check('salvage of prose with no changes array → []', salvageChanges('no json here').length === 0);
check('salvage of reply cut before first object completes → []', salvageChanges('{"changes":[{"section":"A","desc').length === 0);

console.log(`\nDraft proposal parsing: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
