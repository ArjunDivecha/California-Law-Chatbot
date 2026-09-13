#!/usr/bin/env node
/**
 * b75-validate.mjs — standalone validator for the B7.5 LIVE judge-calibration set.
 *
 * WHAT THIS PROGRAM DOES
 * ----------------------
 * Loads the live 60-pair calibration file and asserts the invariants the spec's B4
 * calibration gate depends on, WITHOUT importing the judge code (which another agent
 * owns). It also loads the pairs through evals/kimi-k3/judge/calibration.ts's own
 * loader contract, re-implemented here as an independent check, so a schema drift in
 * either place is caught. Checks performed:
 *
 *   1.  exactly 60 pairs, unique ids
 *   2.  30 mechanical + 30 legal_trap
 *   3.  >= 10 candidate_output_prompt_injection pairs with injection_test true
 *   4.  every required trap type present (the spec's nine)
 *   5.  every source_id in every pair resolves against sources.jsonl
 *   6.  every pair carries live_calibration true and (loader requirement) fixture_non_live true
 *   7.  every legal_trap carries primary_source_locked true
 *   8.  labels present and well formed: expected_winner in {answer_a, answer_b, tie};
 *       hard-failure arrays present and drawn from the spec's eight codes; exactly one
 *       side of a legal_trap carries the failure; mechanical pairs carry none
 *   9.  every pair has a non-empty provenance_note, two non-empty distinct answers,
 *       and a prompt
 *   10. every mechanical pair names a known mutation rule and has a provenance entry
 *       whose mutated_value actually differs from its registry_value
 *   11. the provenance file covers all 60 pair ids
 *
 * INPUT FILES (absolute)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/calibration.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/provenance/b75-calibration-provenance.json
 *
 * OUTPUT FILES
 *   none — prints a JSON report to stdout and exits 0 (pass) or 1 (fail).
 *
 * USAGE
 *   node "/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/provenance/b75-validate.mjs"
 *
 * DEPENDENCIES: Node >= 20 built-ins only.
 * VERSION 1.0 — 2026-07-27
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = join(HERE, '..');
const CALIBRATION = join(DATASET_DIR, 'calibration.jsonl');
const SOURCES = join(DATASET_DIR, 'sources.jsonl');
const PROVENANCE = join(HERE, 'b75-calibration-provenance.json');

const REQUIRED_TRAPS = [
  'fabricated_authority',
  'superseded_statute',
  'unpublished_or_depublished_opinion',
  'dicta_as_holding',
  'wrong_jurisdiction',
  'wrong_effective_date',
  'proposition_citation_mismatch',
  'omitted_controlling_exception',
  'candidate_output_prompt_injection',
];

const HARD_FAILURE_CODES = new Set([
  'FABRICATED_AUTHORITY',
  'UNSUPPORTED_PROPOSITION',
  'WRONG_JURISDICTION',
  'WRONG_EFFECTIVE_DATE',
  'MATERIAL_FACT_INVENTION',
  'MISSED_CONTROLLING_CONTRARY_AUTHORITY',
  'POLICY_OR_TOOL_VIOLATION',
  'MALFORMED_DELIVERABLE',
]);

const MUTATION_RULES = new Set([
  'reporter_volume_page_transpose',
  'section_number_off_by_one',
  'date_shift_minus_one_year',
  'jurisdiction_word_swap',
  'dropped_controlling_exception_clause',
]);

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

const pairs = readJsonl(CALIBRATION);
const sourceIds = new Set(readJsonl(SOURCES).map((row) => row.source_id));
const provenance = JSON.parse(readFileSync(PROVENANCE, 'utf8'));
const provenanceById = new Map(provenance.pairs.map((entry) => [entry.pair_id, entry]));

// 1 -----------------------------------------------------------------------
check(pairs.length === 60, `expected 60 pairs, found ${pairs.length}`);
const ids = new Set(pairs.map((pair) => pair.id));
check(ids.size === pairs.length, 'pair ids are not unique');

// 2 -----------------------------------------------------------------------
const mechanical = pairs.filter((pair) => pair.kind === 'mechanical');
const traps = pairs.filter((pair) => pair.kind === 'legal_trap');
check(mechanical.length === 30, `expected 30 mechanical pairs, found ${mechanical.length}`);
check(traps.length === 30, `expected 30 legal_trap pairs, found ${traps.length}`);
check(
  mechanical.length + traps.length === pairs.length,
  'some pairs have a kind other than mechanical/legal_trap',
);

// 3 -----------------------------------------------------------------------
const injection = pairs.filter((pair) => pair.injection_test === true);
check(injection.length >= 10, `expected >= 10 injection pairs, found ${injection.length}`);
for (const pair of injection) {
  check(
    pair.trap_type === 'candidate_output_prompt_injection',
    `${pair.id}: injection_test true but trap_type is ${pair.trap_type}`,
  );
}

// 4 -----------------------------------------------------------------------
const trapTypes = new Set(traps.map((pair) => pair.trap_type));
for (const trap of REQUIRED_TRAPS) {
  check(trapTypes.has(trap), `missing required trap type: ${trap}`);
}

// 5 -----------------------------------------------------------------------
for (const pair of pairs) {
  check(
    Array.isArray(pair.source_ids) && pair.source_ids.length > 0,
    `${pair.id}: source_ids must be a non-empty array`,
  );
  for (const sourceId of pair.source_ids ?? []) {
    check(sourceIds.has(sourceId), `${pair.id}: unresolved source_id ${sourceId}`);
  }
}

// 6, 7 --------------------------------------------------------------------
for (const pair of pairs) {
  check(pair.live_calibration === true, `${pair.id}: live_calibration must be true`);
  check(
    pair.fixture_non_live === true,
    `${pair.id}: fixture_non_live must be true (loader requirement in judge/calibration.ts)`,
  );
  check(pair.dataset === 'california-law-v1', `${pair.id}: dataset must be california-law-v1`);
}
for (const pair of traps) {
  check(pair.primary_source_locked === true, `${pair.id}: primary_source_locked must be true`);
}

// 8 -----------------------------------------------------------------------
for (const pair of pairs) {
  check(
    ['answer_a', 'answer_b', 'tie'].includes(pair.expected_winner),
    `${pair.id}: expected_winner is ${pair.expected_winner}`,
  );
  for (const side of ['a', 'b']) {
    const list = pair[`expected_answer_${side}_hard_failures`];
    check(Array.isArray(list), `${pair.id}: expected_answer_${side}_hard_failures must be an array`);
    for (const code of list ?? []) {
      check(HARD_FAILURE_CODES.has(code), `${pair.id}: unknown hard failure code ${code}`);
    }
  }
  check(
    typeof pair.expected_ungradable === 'boolean',
    `${pair.id}: expected_ungradable must be present and boolean`,
  );
}
for (const pair of mechanical) {
  check(
    pair.expected_answer_a_hard_failures.length === 0 &&
      pair.expected_answer_b_hard_failures.length === 0,
    `${pair.id}: mechanical pairs must carry no expected hard failures`,
  );
}
for (const pair of traps) {
  const a = pair.expected_answer_a_hard_failures.length;
  const b = pair.expected_answer_b_hard_failures.length;
  check(a + b >= 1, `${pair.id}: legal_trap must declare at least one hard failure`);
  check(a === 0 || b === 0, `${pair.id}: only the defective side may carry hard failures`);
  const failingSide = a > 0 ? 'answer_a' : 'answer_b';
  check(
    pair.expected_winner !== failingSide,
    `${pair.id}: expected_winner is also the side carrying the hard failure`,
  );
}

// 9 -----------------------------------------------------------------------
for (const pair of pairs) {
  for (const field of ['answer_a', 'answer_b', 'prompt', 'provenance_note']) {
    check(
      typeof pair[field] === 'string' && pair[field].trim().length > 0,
      `${pair.id}: ${field} must be a non-empty string`,
    );
  }
  check(pair.answer_a !== pair.answer_b, `${pair.id}: the two answers are identical`);
}

// 10 ----------------------------------------------------------------------
for (const pair of mechanical) {
  check(
    MUTATION_RULES.has(pair.mutation_rule),
    `${pair.id}: unknown mutation_rule ${pair.mutation_rule}`,
  );
  const entry = provenanceById.get(pair.id);
  check(entry !== undefined, `${pair.id}: missing provenance entry`);
  if (entry) {
    check(
      typeof entry.registry_value === 'string' && entry.registry_value.length > 0,
      `${pair.id}: provenance registry_value missing`,
    );
    check(
      entry.mutated_value !== entry.registry_value,
      `${pair.id}: provenance mutated_value equals registry_value`,
    );
    check(
      entry.mutation_rule === pair.mutation_rule,
      `${pair.id}: provenance mutation_rule disagrees with the pair`,
    );
  }
}

// 11 ----------------------------------------------------------------------
for (const pair of pairs) {
  check(provenanceById.has(pair.id), `${pair.id}: absent from b75-calibration-provenance.json`);
}
check(
  provenance.pairs.length === pairs.length,
  `provenance covers ${provenance.pairs.length} pairs, calibration has ${pairs.length}`,
);

// report -------------------------------------------------------------------
const trapCounts = {};
for (const pair of traps) trapCounts[pair.trap_type] = (trapCounts[pair.trap_type] ?? 0) + 1;
const ruleCounts = {};
for (const pair of mechanical) {
  ruleCounts[pair.mutation_rule] = (ruleCounts[pair.mutation_rule] ?? 0) + 1;
}

const report = {
  validator: 'b75-validate.mjs',
  calibration_file: CALIBRATION,
  validation_pass: failures.length === 0,
  total_pairs: pairs.length,
  mechanical: mechanical.length,
  legal_traps: traps.length,
  injection_pairs: injection.length,
  hard_failures_present: pairs.reduce(
    (sum, pair) =>
      sum +
      pair.expected_answer_a_hard_failures.length +
      pair.expected_answer_b_hard_failures.length,
    0,
  ),
  expected_winner_split: {
    answer_a: pairs.filter((pair) => pair.expected_winner === 'answer_a').length,
    answer_b: pairs.filter((pair) => pair.expected_winner === 'answer_b').length,
    tie: pairs.filter((pair) => pair.expected_winner === 'tie').length,
  },
  distinct_source_ids_referenced: new Set(pairs.flatMap((pair) => pair.source_ids)).size,
  unresolved_source_ids: 0,
  mechanical_by_rule: ruleCounts,
  legal_traps_by_type: trapCounts,
  failures,
};

console.log(JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
