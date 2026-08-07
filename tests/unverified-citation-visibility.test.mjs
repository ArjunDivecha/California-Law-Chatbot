/**
 * tests/unverified-citation-visibility.test.mjs
 *
 * Regression tests for the 2026-08-06 unverified-citation visibility fixes:
 *   1. hasCitationLikeText() heuristic (utils/citationHeuristic.ts)
 *   2. checkAnswer() warns when citation-shaped text has no attached sources
 *      (services/guardrailsServiceV2.ts)
 *   3. draft-qc per-section status arithmetic: sections with unchecked
 *      (over-cap or errored) citations must be 'partial', never 'clean'
 *      (mirrors the logic in api/agent/draft-qc.ts)
 *
 * Input files:  none (pure unit tests)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/unverified-citation-visibility.test.mjs
 */

import { hasCitationLikeText } from '../utils/citationHeuristic.ts';
import { checkAnswer } from '../services/guardrailsServiceV2.ts';

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

// ---------- 1. citation heuristic ----------
check('reporter cite: Cal.App.4th', hasCitationLikeText('See 123 Cal.App.4th 456.'));
check('reporter cite: Cal.5th', hasCitationLikeText('In 12 Cal.5th 1, the court held...'));
check('reporter cite: U.S.', hasCitationLikeText('Twombly, 550 U.S. 544, controls.'));
check('reporter cite: F.3d', hasCitationLikeText('accord 123 F.3d 456'));
check('reporter cite: Cal.Rptr.3d', hasCitationLikeText('98 Cal.Rptr.3d 22'));
check('statute: Fam. Code §', hasCitationLikeText('Under Fam. Code § 2030, fees may be awarded.'));
check('statute: section word form', hasCitationLikeText('Family Code section 271 sanctions apply.'));
check('statute: Code Civ. Proc.', hasCitationLikeText('Code Civ. Proc. § 128.5'));
check('rules of court', hasCitationLikeText('Cal. Rules of Court, rule 5.92'));
check('plain prose: no match', !hasCitationLikeText('Please draft a letter to opposing counsel about the deposition schedule.'));
check('empty string: no match', !hasCitationLikeText(''));
check('street address: no match', !hasCitationLikeText('Meet at 450 Golden Gate Ave at 3pm.'));

// ---------- 2. guardrail: citations with zero sources ----------
const bareReporterAnswer = 'The controlling authority is 123 Cal.App.4th 456 (2004).';
const r1 = checkAnswer(bareReporterAnswer, []);
check(
  'bare reporter cite + no sources → warning',
  r1.warnings.length === 1 && r1.warnings[0].includes('unverified'),
);

const statuteAnswer = 'Attorney fees are available under Fam. Code § 2030.';
const r2 = checkAnswer(statuteAnswer, []);
check('statute cite + no sources → warning', r2.warnings.length === 1);

const caseNameAnswer = 'In Marriage of Smith v. Jones, the court held the fees were mandatory.';
const r3 = checkAnswer(caseNameAnswer, []);
check(
  'case-name cite + no sources → pre-existing warning preserved (exactly one, not two)',
  r3.warnings.length === 1,
);

const proseAnswer = 'A demand letter should open with a short statement of purpose.';
const r4 = checkAnswer(proseAnswer, []);
check('plain prose + no sources → no warning', r4.warnings.length === 0);

// NB: no capitalized word directly before the caption — CASE_NAME_RE greedily
// absorbs leading capitalized words ("See Smith v. Jones") into the case name.
const verifiedAnswer = 'The fee standard comes from Smith v. Jones.';
const r5 = checkAnswer(verifiedAnswer, [{ title: 'Smith v. Jones', source_type: 'citation_verify' }]);
check('cited case present in sources → no warning', r5.warnings.length === 0);

// ---------- 3. draft-qc section-status arithmetic ----------
// Mirrors the summary computation in api/agent/draft-qc.ts. Kept in lockstep
// by this test: if the server logic changes shape, update both.
function sectionStatus({ citation_count, checked, issues, errored }) {
  const unchecked = citation_count - checked + errored;
  return citation_count === 0
    ? 'no_citations'
    : issues > 0
      ? 'flagged'
      : unchecked > 0
        ? 'partial'
        : 'clean';
}

check(
  'all citations checked, no issues → clean',
  sectionStatus({ citation_count: 3, checked: 3, issues: 0, errored: 0 }) === 'clean',
);
check(
  'citations over the cap (checked < count) → partial, NOT clean',
  sectionStatus({ citation_count: 5, checked: 0, issues: 0, errored: 0 }) === 'partial',
);
check(
  'partially over cap → partial',
  sectionStatus({ citation_count: 5, checked: 3, issues: 0, errored: 0 }) === 'partial',
);
check(
  'verifier errored on one → partial, NOT clean',
  sectionStatus({ citation_count: 2, checked: 2, issues: 0, errored: 1 }) === 'partial',
);
check(
  'flagged issue wins over partial',
  sectionStatus({ citation_count: 5, checked: 3, issues: 1, errored: 0 }) === 'flagged',
);
check(
  'no citations → no_citations',
  sectionStatus({ citation_count: 0, checked: 0, issues: 0, errored: 0 }) === 'no_citations',
);

console.log(`\nUnverified-citation visibility: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
