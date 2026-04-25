/**
 * Phase 6 Gold-Set Validation
 *
 * Measures two properties of the Day 1 analyzer against curated fixtures:
 *
 * 1. PII RECALL — tests/fixtures/confidential-gold.json. For each prompt
 *    with a labeled set of categories that must be detected, we check
 *    that the analyzer flagged at least one span in each required
 *    category. A single missing category on a single prompt is a
 *    recall miss. Target: ≥95%.
 *
 * 2. PRESERVATION PRECISION — tests/fixtures/public-legal-gold.json.
 *    These prompts contain no client-confidential material. Analyzer
 *    output on them must be empty (no tokenization). Any span flagged
 *    on a public-legal prompt is a false positive. Target: ≥99%
 *    (public-legal prompts with zero false-positive spans).
 *
 * Run: npm run test:goldset
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { analyze } = await import('../api/_shared/sanitization/index.ts');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
}

// ---------------------------------------------------------------------------
// PII recall over the 30-prompt confidential gold set
// ---------------------------------------------------------------------------
const confidential = loadFixture('confidential-gold.json');
let totalRequiredCategories = 0;
let hitCategories = 0;
const recallMisses = [];

for (const p of confidential.prompts) {
  const { spans } = analyze(p.text);
  const flaggedCategories = new Set(spans.map((s) => s.category));
  for (const required of p.mustDetect) {
    totalRequiredCategories += 1;
    if (flaggedCategories.has(required)) {
      hitCategories += 1;
    } else {
      recallMisses.push({
        id: p.id,
        requiredCategory: required,
        flagged: Array.from(flaggedCategories),
      });
    }
  }
}

const recall = hitCategories / totalRequiredCategories;
console.log(
  `\nPII recall on confidential gold set: ${hitCategories}/${totalRequiredCategories} = ${(recall * 100).toFixed(1)}%`
);
if (recallMisses.length > 0) {
  console.log('Missed:');
  for (const m of recallMisses) {
    console.log(`  - ${m.id}: needed ${m.requiredCategory}; got ${m.flagged.join(',')}`);
  }
}

// ---------------------------------------------------------------------------
// Preservation precision over the 50-prompt public-legal gold set
// ---------------------------------------------------------------------------
const publicLegal = loadFixture('public-legal-gold.json');
let cleanPrompts = 0;
const preservationFailures = [];

for (const p of publicLegal.prompts) {
  const { spans } = analyze(p.text);
  if (spans.length === 0) {
    cleanPrompts += 1;
  } else {
    preservationFailures.push({
      id: p.id,
      falseFlags: spans.map((s) => ({ raw: s.raw, category: s.category })),
    });
  }
}

const preservation = cleanPrompts / publicLegal.prompts.length;
console.log(
  `\nPreservation on public-legal gold set: ${cleanPrompts}/${publicLegal.prompts.length} = ${(preservation * 100).toFixed(1)}%`
);
if (preservationFailures.length > 0) {
  console.log('False positives:');
  for (const f of preservationFailures) {
    console.log(`  - ${f.id}: ${f.falseFlags.map((s) => `${s.raw}(${s.category})`).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Thresholds — Phase 6 exit criteria
// ---------------------------------------------------------------------------
const RECALL_TARGET = 0.95;
const PRESERVATION_TARGET = 0.99;

const recallPassed = recall >= RECALL_TARGET;
const preservationPassed = preservation >= PRESERVATION_TARGET;

console.log('\n' + '='.repeat(60));
console.log(
  `Recall ≥${(RECALL_TARGET * 100).toFixed(0)}%: ${recallPassed ? '✅' : '❌'}  (actual ${(recall * 100).toFixed(1)}%)`
);
console.log(
  `Preservation ≥${(PRESERVATION_TARGET * 100).toFixed(0)}%: ${preservationPassed ? '✅' : '❌'}  (actual ${(preservation * 100).toFixed(1)}%)`
);

if (!recallPassed || !preservationPassed) {
  process.exit(1);
}
process.exit(0);
