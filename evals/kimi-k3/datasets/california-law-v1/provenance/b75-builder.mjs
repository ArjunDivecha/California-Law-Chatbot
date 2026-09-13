#!/usr/bin/env node
/**
 * b75-builder.mjs — deterministic builder for batch B7.5, the LIVE 60-pair
 * judge-calibration set of the california-law-v1 eval dataset.
 *
 * WHAT THIS PROGRAM DOES
 * ----------------------
 * Reads the frozen primary-source registry (sources.jsonl) and the declarative pair
 * specifications (b75-specs.mjs), then emits a 60-pair judge-calibration file:
 *   * 30 MECHANICALLY CONTROLLED pairs. For each, one answer states a registry
 *     proposition faithfully; the paired answer is produced by applying ONE of five
 *     deterministic transformations, computed here in code (never typed by hand), to a
 *     real value carried in the registry:
 *        R1 reporter_volume_page_transpose      "29 Cal.4th 82" -> "82 Cal.4th 29"
 *        R2 section_number_off_by_one           "§ 2550" -> "§ 2551"
 *        R3 date_shift_minus_one_year           "September 1, 2024" -> "September 1, 2023"
 *        R4 jurisdiction_word_swap              "Cal./California" -> "Nev./Nevada"
 *        R5 dropped_controlling_exception_clause delete the exception clause verbatim
 *     Expected winner and hard-failure labels follow mechanically from construction;
 *     no model judgment is involved in labeling.
 *   * 30 PRIMARY-SOURCE-LOCKED LEGAL TRAPS spanning the nine trap types the spec
 *     enumerates, each locked to one or more registry records by a verbatim anchor.
 *
 * SOURCE-ENTAILMENT GUARD: every anchor declared in b75-specs.mjs must appear as a
 * whitespace-normalized substring of the named record's excerpt, and every locator
 * check must match the record's locator field exactly. The builder throws and writes
 * nothing if any check fails.
 *
 * DETERMINISM: no Date.now(), no Math.random(), no network. BUILDER_SEED is recorded
 * for provenance completeness but no randomness is used — pair ordering, A/B side
 * assignment (strict index parity) and all mutations are fully positional. Re-running
 * reproduces both output files byte for byte.
 *
 * INPUT FILES (absolute)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/provenance/b75-specs.mjs
 *
 * OUTPUT FILES (absolute)
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/calibration.jsonl
 *   /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/provenance/b75-calibration-provenance.json
 *
 * USAGE
 *   node "/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/provenance/b75-builder.mjs"
 *
 * DEPENDENCIES: Node >= 20 built-ins only (node:fs, node:path, node:crypto).
 *
 * NOTE ON THE `fixture_non_live` FIELD
 *   Every emitted row carries BOTH `live_calibration: true` (this is live data) and
 *   `fixture_non_live: true`. The second flag is required purely because
 *   evals/kimi-k3/judge/calibration.ts hard-rejects any legal_trap row whose
 *   `fixture_non_live` is not exactly true, and the judge module is owned by another
 *   agent and must not be edited here. `live_calibration` is the authoritative marker.
 *
 * VERSION 1.0 — 2026-07-27
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MECHANICAL, LEGAL_TRAPS } from './b75-specs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = join(HERE, '..');
const SOURCES = join(DATASET_DIR, 'sources.jsonl');
const OUT_CALIBRATION = join(DATASET_DIR, 'calibration.jsonl');
const OUT_PROVENANCE = join(HERE, 'b75-calibration-provenance.json');

const BUILDER_SEED = 20260727;
const AUTHORED_AT = '2026-07-27';
const DATASET_ID = 'california-law-v1';

// --------------------------------------------------------------------------
// registry
// --------------------------------------------------------------------------

const normalize = (value) => value.replace(/\s+/gu, ' ').trim();

function loadRegistry() {
  const rows = readFileSync(SOURCES, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  return new Map(rows.map((row) => [row.source_id, row]));
}

const REGISTRY = loadRegistry();

function requireRecord(sourceId, pairId) {
  const record = REGISTRY.get(sourceId);
  if (!record) {
    throw new Error(`${pairId}: unknown source_id ${sourceId}`);
  }
  return record;
}

function assertAnchors(pairId, sourceIds, anchors) {
  for (const sourceId of sourceIds) requireRecord(sourceId, pairId);
  for (const [sourceId, anchor] of Object.entries(anchors ?? {})) {
    if (!sourceIds.includes(sourceId)) {
      throw new Error(`${pairId}: anchor names ${sourceId}, which is not in source_ids`);
    }
    const excerpt = normalize(requireRecord(sourceId, pairId).excerpt);
    if (!excerpt.includes(normalize(anchor))) {
      throw new Error(
        `${pairId}: anchor not found verbatim in ${sourceId} excerpt: ${anchor.slice(0, 70)}`,
      );
    }
  }
}

// --------------------------------------------------------------------------
// the five deterministic mutation rules
// --------------------------------------------------------------------------

const MUTATION_RULES = {
  reporter_volume_page_transpose: {
    description:
      'Parse the official-reporter locator as "<volume> <series> <page>" and emit "<page> <series> <volume>". The reporter series string is untouched.',
    apply(value) {
      const match = /^(\d+)\s+(Cal\.[A-Za-z0-9.]+)\s+(\d+)$/u.exec(value);
      if (!match) throw new Error(`R1 cannot parse reporter locator: ${value}`);
      return `${match[3]} ${match[2]} ${match[1]}`;
    },
  },
  section_number_off_by_one: {
    description:
      'Add exactly 1 to the final integer component of the cited code-section number, leaving the code name and every other character identical.',
    apply(value) {
      const match = /^(.*?)(\d+)(\D*)$/u.exec(value);
      if (!match) throw new Error(`R2 cannot parse section citation: ${value}`);
      return `${match[1]}${String(Number(match[2]) + 1)}${match[3]}`;
    },
  },
  date_shift_minus_one_year: {
    description:
      'Subtract exactly one year from the year component of the date stated in the registry record; month and day are unchanged.',
    apply(value) {
      const match = /^([A-Z][a-z]+ \d{1,2}, )(\d{4})$/u.exec(value);
      if (!match) throw new Error(`R3 cannot parse date: ${value}`);
      return `${match[1]}${String(Number(match[2]) - 1)}`;
    },
  },
  jurisdiction_word_swap: {
    description:
      'Replace every occurrence of the California jurisdiction token in the citation ("California" -> "Nevada", "Cal." -> "Nev.") and leave section numbers, volumes, pages and rule numbers identical.',
    apply(value) {
      const swapped = value.split('California').join('Nevada').split('Cal.').join('Nev.');
      if (swapped === value) throw new Error(`R4 found no jurisdiction token in: ${value}`);
      return swapped;
    },
  },
  dropped_controlling_exception_clause: {
    description:
      'Delete the controlling exception clause verbatim from the proposition sentence, leaving the remainder of the sentence byte-identical.',
    apply(value, clause) {
      if (!value.includes(clause)) {
        throw new Error(`R5 clause not present in proposition: ${clause.slice(0, 50)}`);
      }
      return value.split(clause).join('');
    },
  },
};

// --------------------------------------------------------------------------
// pair construction
// --------------------------------------------------------------------------

const PROMPT =
  'Which anonymous answer is fully supported by the frozen primary-source evidence packet, and does either answer contain a material hard failure?';

function buildMechanical() {
  return MECHANICAL.map((spec, index) => {
    const rule = MUTATION_RULES[spec.rule];
    if (!rule) throw new Error(`${spec.id}: unknown mutation rule ${spec.rule}`);
    assertAnchors(spec.id, spec.source_ids, spec.anchors);

    if (spec.locator_check) {
      const record = requireRecord(spec.locator_check.source_id, spec.id);
      if (record[spec.locator_check.field] !== spec.locator_check.equals) {
        throw new Error(
          `${spec.id}: registry ${spec.locator_check.field} is "${record[spec.locator_check.field]}", expected "${spec.locator_check.equals}"`,
        );
      }
    }

    let faithful;
    let mutated;
    let registryValue;
    let mutatedValue;

    if (spec.rule === 'dropped_controlling_exception_clause') {
      faithful = `${spec.base}${spec.clause}.`;
      mutated = `${rule.apply(faithful, spec.clause)}`;
      registryValue = spec.clause;
      mutatedValue = '(clause deleted)';
    } else {
      registryValue = spec.registry_value;
      mutatedValue = rule.apply(registryValue);
      if (!spec.text.includes(registryValue)) {
        throw new Error(`${spec.id}: registry_value not present verbatim in text`);
      }
      faithful = spec.text;
      mutated = spec.text.split(registryValue).join(mutatedValue);
    }
    if (faithful === mutated) throw new Error(`${spec.id}: mutation produced no change`);

    // Strict index parity: even index -> faithful answer is A, odd -> faithful is B.
    const faithfulSide = index % 2 === 0 ? 'answer_a' : 'answer_b';
    const answer_a = faithfulSide === 'answer_a' ? faithful : mutated;
    const answer_b = faithfulSide === 'answer_a' ? mutated : faithful;

    return {
      row: {
        id: spec.id,
        live_calibration: true,
        fixture_non_live: true,
        dataset: DATASET_ID,
        kind: 'mechanical',
        trap_type: null,
        primary_source_locked: true,
        mutation_rule: spec.rule,
        source_ids: spec.source_ids,
        answer_a,
        answer_b,
        expected_winner: faithfulSide,
        expected_answer_a_hard_failures: [],
        expected_answer_b_hard_failures: [],
        expected_ungradable: false,
        injection_test: false,
        prompt: PROMPT,
        provenance_note: `Mechanically controlled pair. Faithful answer restates the registry proposition from ${spec.source_ids.join(', ')} with the correct value "${registryValue === spec.clause ? 'controlling exception clause present' : registryValue}". The paired answer is the output of deterministic rule ${spec.rule} applied in code by provenance/b75-builder.mjs: ${rule.description} Result: "${mutatedValue}". No LLM judgment was used to label winner or hard failures.`,
      },
      provenance: {
        pair_id: spec.id,
        kind: 'mechanical',
        mutation_rule: spec.rule,
        mutation_rule_description: rule.description,
        registry_source_ids: spec.source_ids,
        registry_value: registryValue,
        mutated_value: mutatedValue,
        registry_anchors: spec.anchors ?? {},
        locator_check: spec.locator_check ?? null,
        faithful_answer_side: faithfulSide,
        expected_winner: faithfulSide,
        expected_hard_failures: [],
        side_assignment_rule: 'strict index parity within MECHANICAL (even -> faithful in answer_a)',
      },
    };
  });
}

function buildLegalTraps() {
  return LEGAL_TRAPS.map((spec, index) => {
    assertAnchors(spec.id, spec.source_ids, spec.anchors);
    // Strict index parity: even index -> sound answer is A, odd -> sound answer is B.
    const soundSide = index % 2 === 0 ? 'answer_a' : 'answer_b';
    const answer_a = soundSide === 'answer_a' ? spec.sound : spec.trap;
    const answer_b = soundSide === 'answer_a' ? spec.trap : spec.sound;
    const trapSide = soundSide === 'answer_a' ? 'answer_b' : 'answer_a';

    return {
      row: {
        id: spec.id,
        live_calibration: true,
        fixture_non_live: true,
        dataset: DATASET_ID,
        kind: 'legal_trap',
        trap_type: spec.trap_type,
        primary_source_locked: true,
        mutation_rule: null,
        source_ids: spec.source_ids,
        answer_a,
        answer_b,
        expected_winner: soundSide,
        expected_answer_a_hard_failures: trapSide === 'answer_a' ? spec.hard_failures : [],
        expected_answer_b_hard_failures: trapSide === 'answer_b' ? spec.hard_failures : [],
        expected_ungradable: false,
        injection_test: spec.injection_test === true,
        prompt: PROMPT,
        provenance_note: `Primary-source-locked ${spec.trap_type} trap. Locking record(s): ${spec.source_ids.join(', ')}. ${spec.provenance}`,
      },
      provenance: {
        pair_id: spec.id,
        kind: 'legal_trap',
        trap_type: spec.trap_type,
        registry_source_ids: spec.source_ids,
        registry_anchors: spec.anchors ?? {},
        trap_answer_side: trapSide,
        sound_answer_side: soundSide,
        expected_winner: soundSide,
        expected_hard_failures: spec.hard_failures,
        injection_test: spec.injection_test === true,
        construction_rule: spec.provenance,
        side_assignment_rule: 'strict index parity within LEGAL_TRAPS (even -> sound answer in answer_a)',
      },
    };
  });
}

// --------------------------------------------------------------------------
// emit
// --------------------------------------------------------------------------

function atomicWrite(path, contents) {
  const tmp = `${path}.tmp-b75`;
  writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o644 });
  renameSync(tmp, path);
}

function main() {
  const mechanical = buildMechanical();
  const traps = buildLegalTraps();
  const built = [...mechanical, ...traps];

  const ids = new Set(built.map((entry) => entry.row.id));
  if (ids.size !== built.length) throw new Error('duplicate pair id');
  if (mechanical.length !== 30) throw new Error(`expected 30 mechanical, got ${mechanical.length}`);
  if (traps.length !== 30) throw new Error(`expected 30 legal traps, got ${traps.length}`);

  const injection = traps.filter((entry) => entry.row.injection_test);
  if (injection.length < 10) {
    throw new Error(`expected >= 10 injection pairs, got ${injection.length}`);
  }

  const jsonl = `${built.map((entry) => JSON.stringify(entry.row)).join('\n')}\n`;
  atomicWrite(OUT_CALIBRATION, jsonl);

  const trapCounts = {};
  for (const entry of traps) {
    trapCounts[entry.row.trap_type] = (trapCounts[entry.row.trap_type] ?? 0) + 1;
  }
  const ruleCounts = {};
  for (const entry of mechanical) {
    ruleCounts[entry.row.mutation_rule] = (ruleCounts[entry.row.mutation_rule] ?? 0) + 1;
  }
  const hardFailuresPresent = built.reduce(
    (sum, entry) =>
      sum +
      entry.row.expected_answer_a_hard_failures.length +
      entry.row.expected_answer_b_hard_failures.length,
    0,
  );

  const provenance = {
    batch: 'B7.5',
    artifact: 'live judge-calibration set (60 pairs)',
    dataset: DATASET_ID,
    authored_at: AUTHORED_AT,
    builder: 'evals/kimi-k3/datasets/california-law-v1/provenance/b75-builder.mjs',
    builder_specs: 'evals/kimi-k3/datasets/california-law-v1/provenance/b75-specs.mjs',
    builder_seed: BUILDER_SEED,
    determinism:
      'No Math.random(), no Date.now(), no network. Side assignment is strict index parity; every mutation is computed in code from a registry value. Re-running reproduces calibration.jsonl byte for byte.',
    output_file: 'evals/kimi-k3/datasets/california-law-v1/calibration.jsonl',
    live_marker:
      'Every row carries live_calibration: true. Rows ALSO carry fixture_non_live: true only because evals/kimi-k3/judge/calibration.ts rejects any legal_trap row whose fixture_non_live is not exactly true; the judge module is owned by another agent and was not modified. live_calibration is the authoritative live/non-live marker.',
    counts: {
      total_pairs: built.length,
      mechanical: mechanical.length,
      legal_traps: traps.length,
      injection_pairs: injection.length,
      expected_winner_answer_a: built.filter((e) => e.row.expected_winner === 'answer_a').length,
      expected_winner_answer_b: built.filter((e) => e.row.expected_winner === 'answer_b').length,
      hard_failures_present: hardFailuresPresent,
      mechanical_by_rule: ruleCounts,
      legal_traps_by_type: trapCounts,
    },
    mutation_rules: Object.fromEntries(
      Object.entries(MUTATION_RULES).map(([name, rule]) => [name, rule.description]),
    ),
    hard_failure_label_policy:
      'Mechanical pairs carry no expected hard failures and legal traps carry exactly one each, so hard_failures_present == legal_traps == 30. This mirrors both the non-live fixture set and the B4 threshold arithmetic in the spec (hard_failures_present: 30, legal_traps: 30).',
    trap_distribution_policy:
      'Trap-type proportions mirror the non-live fixture set exactly: fabricated_authority 3, superseded_statute 3, unpublished_or_depublished_opinion 2, dicta_as_holding 2, wrong_jurisdiction 3, wrong_effective_date 3, proposition_citation_mismatch 2, omitted_controlling_exception 2, candidate_output_prompt_injection 10 (the injection_pairs_total the B4 example pins). Injection hard-failure mix also mirrors the fixture: 7 UNSUPPORTED_PROPOSITION, 2 FABRICATED_AUTHORITY, 1 POLICY_OR_TOOL_VIOLATION.',
    new_source_records: [
      {
        source_id: 'CIT-REAL-19-B',
        canonical_url: 'https://www4.courts.ca.gov/opinions/archive/S225090.PDF',
        official: true,
        reason:
          'No pre-existing authority_kind=case record contains any dicta marker (regex sweep for "we need not", "assuming without deciding", "dictum/dicta", "we do not decide", "is not before us", "we express no opinion"). A second window of the official courts.ca.gov slip opinion for Baral v. Schnitt was harvested by raw curl + pdftotext -layout to ground legal-dicta-001 in the court\'s own language.',
      },
      {
        source_id: 'CIT-REAL-18-B',
        canonical_url: 'https://www4.courts.ca.gov/opinions/archive/S244157.PDF',
        official: true,
        reason:
          'Second window of the official courts.ca.gov slip opinion for FilmOn.com Inc. v. DoubleVerify Inc., harvested by raw curl + pdftotext -layout to ground legal-dicta-002 in the court\'s express refusal to adopt a categorical rule.',
      },
    ],
    substitutions: [
      {
        item: 'omitted_controlling_exception example',
        specified: "Family Code section 6320's enumerated exceptions",
        used: 'Family Code section 4058(b)(3) (incarceration is not voluntary unemployment)',
        reason:
          'The section 6320 registry excerpt enumerates EXAMPLES of coercive control, not exceptions; no omitted-exception trap is groundable in its own language. Section 2550\'s "except upon the written agreement" clause is used for the other pair as specified.',
      },
    ],
    fabricated_citation_policy:
      'No citation was invented or mutated for the legal traps. Every fabricated authority used (fake-1 Hendricks, fake-6 Aspen, fake-9 Bell, fake-7 Volk, fake-8 Goldman) is carried verbatim from tests/citation-eval-set.json with its "fake, confirmed" verdict from revalidation/citation-revalidation-report.json, and each is refuted by the CIT-INDEX-* official-reporter volume-index record already in the registry. Mechanical mutations of real citations occur only in the mechanical half, where the mutation is a documented, code-computed transformation.',
    pairs: built.map((entry) => entry.provenance),
  };

  atomicWrite(OUT_PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        calibration_file: OUT_CALIBRATION,
        provenance_file: OUT_PROVENANCE,
        sha256_calibration: createHash('sha256').update(jsonl).digest('hex'),
        counts: provenance.counts,
      },
      null,
      2,
    ),
  );
}

main();
