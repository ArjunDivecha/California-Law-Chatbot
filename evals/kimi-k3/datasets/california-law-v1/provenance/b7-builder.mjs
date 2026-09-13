/**
 * b7-builder.mjs
 *
 * WHAT THIS DOES
 * --------------
 * Builds the 10 LONG_CONTEXT task drafts (longcontext-001..010) for batch B7
 * of the california-law-v1 evaluation dataset, plus the batch provenance file.
 *
 * Each task embeds a large synthetic California family-law case file
 * (25,000-60,000 words) generated DETERMINISTICALLY from template pools by
 * b7-builder-lib.mjs under a fixed seed. The legally operative facts are
 * buried inside that packet at varying depths; the graded question requires
 * the model to (a) retrieve the buried facts and (b) apply registry-grounded
 * California statutory law to them.
 *
 * Every proposition excerpt is sliced PROGRAMMATICALLY out of an already
 * registered primary-source record in sources.jsonl: the author supplies an
 * ASCII-normalized search string, the script locates it inside the registry
 * excerpt (whitespace- and curly-punctuation-insensitive) and emits the
 * registry's own characters back. If a search string is not found the script
 * THROWS rather than emit a paraphrase, so no proposition can drift from its
 * source. Zero new source records are created.
 *
 * INPUT FILES (absolute paths)
 *  - /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
 *  - ./b7-builder-lib.mjs, ./b7-lib-pools.mjs, ./b7-specs-a.mjs, ./b7-specs-b.mjs
 *
 * OUTPUT FILES (absolute paths; overridable with --out / --prov)
 *  - <scratchpad>/b7/b7-drafts.json
 *  - <scratchpad>/b7/b7-longcontext-provenance.json
 *
 * USAGE
 *   node b7-builder.mjs [--out <path>] [--prov <path>]
 *
 * NOTES
 *  - BUILDER SEED: 20260727 (see SEED below). Per-task seed = SEED + 7919*i.
 *  - All parties, documents, accounts, and facts in the packets are invented.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPacket, countWords } from './b7-builder-lib.mjs';
import { SPECS_A } from './b7-specs-a.mjs';
import { SPECS_B } from './b7-specs-b.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET =
  '/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1';

export const SEED = 20260727;

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : fallback;
};
const OUT = arg('--out', join(HERE, 'b7-drafts.json'));
const PROV = arg('--prov', join(HERE, 'b7-longcontext-provenance.json'));

const sources = new Map(
  readFileSync(`${DATASET}/sources.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .map((record) => [record.source_id, record]),
);

const normalizeWhitespace = (value) => value.replace(/\s+/gu, ' ').trim();
const asciiFold = (value) =>
  value
    .replace(/[‘’ʼ]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[–—]/gu, '-');

/** Slice the registry excerpt verbatim (whitespace-normalized) by ASCII search. */
function slice(sourceId, ascii) {
  const source = sources.get(sourceId);
  if (!source) throw new Error(`Unknown source_id: ${sourceId}`);
  const norm = normalizeWhitespace(source.excerpt);
  const key = asciiFold(norm);
  const needle = asciiFold(normalizeWhitespace(ascii));
  const index = key.indexOf(needle);
  if (index < 0) {
    throw new Error(
      `EXCERPT NOT FOUND in ${sourceId}:\n  wanted: ${needle}\n  source: ${key.slice(0, 500)}...`,
    );
  }
  return norm.slice(index, index + needle.length);
}

const specs = [...SPECS_A, ...SPECS_B];
if (specs.length !== 10) {
  throw new Error(`Expected 10 B7 specs, got ${specs.length}`);
}

const tasks = [];
const provTasks = [];

specs.forEach((spec, index) => {
  const taskSeed = SEED + 7919 * index;
  const packet = buildPacket(taskSeed, spec.ctx, spec.plan);
  const content = `${spec.instruction.trim()}\n\n${packet}\n\n${'='.repeat(78)}\nEND OF CASE FILE\n${'='.repeat(78)}\n\n${spec.question.trim()}`;

  const packetWords = countWords(packet);
  if (packetWords < 25000 || packetWords > 60000) {
    throw new Error(
      `${spec.id}: packet is ${packetWords} words, outside the 25,000-60,000 target`,
    );
  }

  const provenance = spec.propositions.map((p) => ({
    proposition_id: p.pid,
    source_id: p.source,
    proposition: p.proposition,
    authoritative_excerpt: slice(p.source, p.ascii),
  }));
  const criteria = spec.criteria.map((c) => ({
    criterion_id: c.cid,
    description: c.description,
    material: true,
    proposition_ids: c.pids,
  }));
  if (criteria.length < 3 || criteria.length > 5) {
    throw new Error(`${spec.id}: needs 3-5 material criteria, has ${criteria.length}`);
  }
  for (const p of provenance) {
    if (!criteria.some((c) => c.proposition_ids.includes(p.proposition_id))) {
      throw new Error(`Unlinked proposition ${p.proposition_id} in ${spec.id}`);
    }
  }
  for (const c of criteria) {
    for (const pid of c.pids ?? c.proposition_ids) {
      if (!provenance.some((p) => p.proposition_id === pid)) {
        throw new Error(`Criterion ${c.criterion_id} references unknown proposition ${pid}`);
      }
    }
  }
  // Retrieval integrity: every buried operative string a `contains` assertion
  // grades on must actually appear in the assembled packet, and every
  // not_contains distractor must NOT be produced by the correct reading.
  // Scoring is case-insensitive (see evals/kimi-k3/scoring.ts textIncludes),
  // so the packet-presence check is too.
  const haystack = content.toLocaleLowerCase();
  for (const a of spec.assertions) {
    if (a.kind !== 'contains' || a.legal_phrase) continue;
    for (const value of a.expected) {
      if (!haystack.includes(value.toLocaleLowerCase())) {
        throw new Error(
          `${spec.id}: assertion ${a.aid} expects "${value}" but it is absent from the packet`,
        );
      }
    }
  }
  for (const value of spec.buriedChecks ?? []) {
    if (!haystack.includes(value.toLocaleLowerCase())) {
      throw new Error(`${spec.id}: buried fact "${value}" missing from packet`);
    }
  }

  tasks.push({
    id: spec.id,
    category: 'long_context',
    workflow: 'research',
    track: 'frozen_evidence',
    prompt: spec.prompt.trim(),
    turns: [{ role: 'user', content }],
    criteria,
    deterministic_assertions: spec.assertions.map((a) => ({
      assertion_id: a.aid,
      kind: a.kind,
      expected: a.expected,
      ...(a.hard_failure_code ? { hard_failure_code: a.hard_failure_code } : {}),
    })),
    expected_tools: [],
    data_class: 'synthetic',
    provenance,
  });

  provTasks.push({
    task_id: spec.id,
    anchor: spec.anchor,
    task_seed: taskSeed,
    packet_words: packetWords,
    packet_characters: packet.length,
    turn_characters: content.length,
    section_plan: spec.plan.map((s) => ({
      kind: s.kind,
      label: s.label ?? null,
      target_words: s.words,
      insert_depths: (s.inserts ?? []).map((i) => i.frac),
    })),
    buried_operative_facts: spec.buriedFacts,
    distractor_facts: spec.distractors ?? [],
    source_ids: [...new Set(spec.propositions.map((p) => p.source))].sort(),
    criteria_count: spec.criteria.length,
    proposition_count: spec.propositions.length,
  });
});

writeFileSync(OUT, `${JSON.stringify(tasks, null, 2)}\n`);

const totalWords = provTasks.reduce((s, t) => s + t.packet_words, 0);
writeFileSync(
  PROV,
  `${JSON.stringify(
    {
      batch: 'B7',
      category: 'long_context',
      task_ids: tasks.map((t) => t.id),
      builder: {
        script: 'evals/kimi-k3/datasets/california-law-v1/provenance/b7-builder.mjs',
        modules: [
          'provenance/b7-builder-lib.mjs',
          'provenance/b7-lib-pools.mjs',
          'provenance/b7-specs-a.mjs',
          'provenance/b7-specs-b.mjs',
        ],
        prng: 'mulberry32',
        seed: SEED,
        per_task_seed_formula: 'SEED + 7919 * task_index',
        deterministic: true,
        note:
          'Re-running the builder with the same seed reproduces every packet byte for byte. No Date.now(), no Math.random(), no network access.',
      },
      new_source_records: [],
      source_policy:
        'Zero new source records. Every proposition excerpt is a programmatic verbatim (whitespace-normalized) slice of an already-registered official leginfo Family Code record; the builder throws rather than paraphrase. B8a constraint respected: no aggregator-hosted case excerpt is used anywhere in this batch.',
      data_class: 'synthetic',
      synthetic_notice:
        'All parties, counsel, firms, courts, departments, case numbers, account numbers, exhibits, dates, transactions, and events in every packet are invented for evaluation purposes.',
      totals: {
        tasks: tasks.length,
        packet_words_total: totalWords,
        packet_words_min: Math.min(...provTasks.map((t) => t.packet_words)),
        packet_words_max: Math.max(...provTasks.map((t) => t.packet_words)),
        criteria_total: provTasks.reduce((s, t) => s + t.criteria_count, 0),
        propositions_total: provTasks.reduce((s, t) => s + t.proposition_count, 0),
      },
      tasks: provTasks,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      seed: SEED,
      tasks: provTasks.map((t) => ({ id: t.task_id, words: t.packet_words })),
      total_words: totalWords,
      drafts: OUT,
      provenance: PROV,
    },
    null,
    2,
  ),
);
