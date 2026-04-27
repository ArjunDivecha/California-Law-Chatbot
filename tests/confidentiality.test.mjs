/**
 * Confidentiality Test Harness
 *
 * Pure unit-style checks against the safety modules introduced in the
 * bedrock-confidentiality migration. No network, no Bedrock calls, no
 * Vercel runtime. Each check is intentionally narrow so that a regression
 * is easy to attribute.
 *
 * Run with:  npm run test:confidentiality
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        () => {
          passed += 1;
          console.log(`✅ ${name}`);
        },
        (err) => {
          failed += 1;
          failures.push({ name, message: err?.message || String(err) });
          console.log(`❌ ${name}\n   ${err?.message || err}`);
        }
      );
    }
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, message: err?.message || String(err) });
    console.log(`❌ ${name}\n   ${err?.message || err}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message || 'expected truthy');
}

function assertThrows(fn, pattern, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (pattern && !pattern.test(err?.message || '')) {
      throw new Error(`${message || 'assertThrows pattern mismatch'}: ${err?.message}`);
    }
  }
  if (!threw) throw new Error(message || 'expected function to throw');
}

function loadFixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
}

// ---------------------------------------------------------------------------
// 1. Flow policy
// ---------------------------------------------------------------------------
const flowPolicy = await import('../api/_shared/flowPolicy.ts');
const { enforceFlow, SPEED_ALLOWED, ACCURACY_ALLOWED, ALL_FLOW_TYPES } = flowPolicy;

test('flowPolicy exposes the three documented flow types', () => {
  assertEqual(ALL_FLOW_TYPES.length, 3, 'flow type count');
  for (const flow of ['accuracy_client', 'public_research', 'speed_passthrough']) {
    assertTrue(ALL_FLOW_TYPES.includes(flow), `missing flow ${flow}`);
  }
});

test('Speed route rejects accuracy_client (client-safe payload)', () => {
  const result = enforceFlow({ flow: 'accuracy_client', message: 'hi' }, SPEED_ALLOWED);
  assertEqual(result.ok, false, 'should reject');
  assertEqual(result.status, 403, 'should be 403');
});

test('Speed route rejects public_research', () => {
  const result = enforceFlow({ flow: 'public_research', message: 'hi' }, SPEED_ALLOWED);
  assertEqual(result.ok, false, 'should reject');
  assertEqual(result.status, 403, 'should be 403');
});

test('Speed route accepts speed_passthrough', () => {
  const result = enforceFlow({ flow: 'speed_passthrough', message: 'hi' }, SPEED_ALLOWED);
  assertEqual(result.ok, true, 'should accept');
  assertEqual(result.flow, 'speed_passthrough', 'echo flow');
});

test('Accuracy route rejects speed_passthrough (no client-confidential bypass)', () => {
  const result = enforceFlow({ flow: 'speed_passthrough', message: 'hi' }, ACCURACY_ALLOWED);
  assertEqual(result.ok, false, 'should reject');
  assertEqual(result.status, 403, 'should be 403');
});

test('Accuracy route accepts accuracy_client and public_research', () => {
  for (const flow of ['accuracy_client', 'public_research']) {
    const result = enforceFlow({ flow, message: 'hi' }, ACCURACY_ALLOWED);
    assertEqual(result.ok, true, `should accept ${flow}`);
  }
});

test('Missing flow field returns 400', () => {
  const result = enforceFlow({ message: 'hi' }, ACCURACY_ALLOWED);
  assertEqual(result.ok, false, 'should reject');
  assertEqual(result.status, 400, 'should be 400');
});

test('Unknown flow string returns 400', () => {
  const result = enforceFlow({ flow: 'something_else' }, ACCURACY_ALLOWED);
  assertEqual(result.ok, false, 'should reject');
  assertEqual(result.status, 400, 'should be 400');
});

// ---------------------------------------------------------------------------
// 2. Bedrock model resolution
// ---------------------------------------------------------------------------
const bedrockModels = await import('../api/_shared/bedrockModels.ts');
const {
  validateBedrockModelId,
  resolveBedrockModel,
  assertNoPromptCacheMetadata,
  BedrockConfigError,
} = bedrockModels;

test('Bedrock config rejects empty/missing model ID', () => {
  assertThrows(
    () => validateBedrockModelId('verifier', 'BEDROCK_VERIFIER_MODEL', undefined),
    /Missing required Bedrock model ID/i,
    'missing should throw'
  );
});

test('Bedrock config rejects gemini aliases', () => {
  assertThrows(
    () => validateBedrockModelId('primary', 'BEDROCK_PRIMARY_MODEL', 'gemini-3-pro'),
    /legacy Gemini\/OpenRouter alias/i
  );
  assertThrows(
    () => validateBedrockModelId('primary', 'BEDROCK_PRIMARY_MODEL', 'google/gemini-2.5-pro'),
    /legacy Gemini\/OpenRouter alias/i
  );
});

test('Bedrock config rejects openrouter google/* aliases', () => {
  assertThrows(
    () => validateBedrockModelId('verifier', 'BEDROCK_VERIFIER_MODEL', 'google/gemini-pro-via-or'),
    /legacy Gemini\/OpenRouter alias/i
  );
});

test('Bedrock config requires anthropic/claude in the ID', () => {
  assertThrows(
    () => validateBedrockModelId('primary', 'BEDROCK_PRIMARY_MODEL', 'us.foo.bar-model'),
    /does not look like an Anthropic Bedrock model/i
  );
});

test('Bedrock config accepts a verified Bedrock profile ID', () => {
  const id = validateBedrockModelId(
    'primary',
    'BEDROCK_PRIMARY_MODEL',
    'us.anthropic.claude-sonnet-4-6'
  );
  assertEqual(id, 'us.anthropic.claude-sonnet-4-6', 'echo id');
});

test('resolveBedrockModel reads from the documented env var and fails closed if unset', () => {
  const prevPrimary = process.env.BEDROCK_PRIMARY_MODEL;
  delete process.env.BEDROCK_PRIMARY_MODEL;
  try {
    assertThrows(() => resolveBedrockModel('primary'), /BEDROCK_PRIMARY_MODEL/);
  } finally {
    if (prevPrimary !== undefined) process.env.BEDROCK_PRIMARY_MODEL = prevPrimary;
  }

  const prevVerifier = process.env.BEDROCK_VERIFIER_MODEL;
  process.env.BEDROCK_VERIFIER_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
  try {
    const resolved = resolveBedrockModel('verifier');
    assertEqual(resolved.envVar, 'BEDROCK_VERIFIER_MODEL', 'env var name');
    assertEqual(resolved.id, 'us.anthropic.claude-haiku-4-5-20251001-v1:0', 'resolved id');
  } finally {
    if (prevVerifier === undefined) delete process.env.BEDROCK_VERIFIER_MODEL;
    else process.env.BEDROCK_VERIFIER_MODEL = prevVerifier;
  }
});

test('BedrockConfigError preserves role + envVar metadata', () => {
  try {
    validateBedrockModelId('research', 'BEDROCK_RESEARCH_MODEL', 'gemini-2.5-pro');
  } catch (err) {
    assertTrue(err instanceof BedrockConfigError, 'expected BedrockConfigError');
    assertEqual(err.role, 'research', 'role');
    assertEqual(err.envVar, 'BEDROCK_RESEARCH_MODEL', 'envVar');
    return;
  }
  throw new Error('expected throw');
});

// ---------------------------------------------------------------------------
// 3. Prompt-cache static guard
// ---------------------------------------------------------------------------
test('assertNoPromptCacheMetadata passes on a clean Bedrock payload', () => {
  assertNoPromptCacheMetadata(
    {
      model: 'us.anthropic.claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      systemInstruction: 'you are a lawyer',
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
    'unit-test'
  );
});

test('assertNoPromptCacheMetadata throws when cache_control sneaks into messages', () => {
  assertThrows(
    () =>
      assertNoPromptCacheMetadata(
        {
          model: 'us.anthropic.claude-sonnet-4-6',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'confidential', cache_control: { type: 'ephemeral' } },
              ],
            },
          ],
        },
        'unit-test'
      ),
    /cache_control/i
  );
});

test('assertNoPromptCacheMetadata throws when cacheControl appears in nested config', () => {
  assertThrows(
    () =>
      assertNoPromptCacheMetadata(
        {
          model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
          system: 'system',
          options: { cacheControl: { type: 'persistent' } },
        },
        'unit-test'
      ),
    /cacheControl/
  );
});

// ---------------------------------------------------------------------------
// 4. Legislative retention regression
//    (Pure data check: the fixture must round-trip into LegislativeSource shape.)
// ---------------------------------------------------------------------------
test('legislative-results.json fixture is well-formed', () => {
  const data = loadFixture('legislative-results.json');
  assertTrue(Array.isArray(data.bills) && data.bills.length > 0, 'bills array');
  for (const bill of data.bills) {
    assertTrue(typeof bill.billNumber === 'string' && bill.billNumber.length > 0, 'billNumber');
    assertTrue(typeof bill.title === 'string', 'title');
    assertTrue(typeof bill.url === 'string', 'url');
  }
});

test('current-law-prompts.json contains the three documented regression prompts', () => {
  const data = loadFixture('current-law-prompts.json');
  const ids = data.prompts.map((p) => p.id);
  for (const id of ['cur-1', 'cur-2', 'cur-3']) {
    assertTrue(ids.includes(id), `missing ${id}`);
  }
});

test('confidential-prompts.json contains synthetic PII (so sanitizer tests have something to hide)', () => {
  const data = loadFixture('confidential-prompts.json');
  assertTrue(data.prompts.length >= 3, 'at least 3 prompts');
  // Any kind of identifying detail — this is a smoke-check, not a PII validator.
  const looksConfidential = (text) =>
    /\b(SSN|FEIN|account|aged?\s+\d{2}|client\b|residence at|\$[\d,]+M?)\b/i.test(text);
  for (const p of data.prompts) {
    assertTrue(looksConfidential(p.text), `prompt ${p.id} should contain confidential markers`);
  }
});

// ---------------------------------------------------------------------------
// 4b. Phase 5 — research planner heuristics
// ---------------------------------------------------------------------------
const planner = await import('../api/_shared/researchPlanner.ts');
const { extractEntitiesHeuristic, mergeEntities, EMPTY_ENTITIES } = planner;

test('planner heuristic extracts Family Code statute lookups', () => {
  const e = extractEntitiesHeuristic(
    'What are the elements of an enforceable premarital agreement under California Family Code § 1615?'
  );
  assertEqual(e.statutes.length, 1, 'one statute lookup');
  assertEqual(e.statutes[0].code, 'Family Code', 'code');
  assertEqual(e.statutes[0].section, '1615', 'section');
  assertTrue(e.practice_areas.includes('family_law'), 'family_law practice area');
});

test('planner heuristic flags current-law queries + session year', () => {
  const e = extractEntitiesHeuristic('what new laws have been passed in 2026 in CA');
  assertEqual(e.is_current_law_query, true, 'current-law flag');
  assertEqual(e.legislative_session_year, '2026', 'session year');
});

test('planner heuristic extracts legislative terms from bill references', () => {
  const e = extractEntitiesHeuristic(
    'what California bills about electric bicycles were active in 2025-2026'
  );
  assertTrue(e.legislative_terms.some((t) => /bills?/i.test(t)), 'legislative term present');
  assertEqual(e.is_current_law_query, true, 'current-law flag');
});

test('planner heuristic infers trusts_estates practice area from probate language', () => {
  const e = extractEntitiesHeuristic(
    'Explain Probate Code § 859 double damages for trustee self-dealing.'
  );
  assertTrue(e.practice_areas.includes('trusts_estates'), 'trusts_estates area');
  assertEqual(e.statutes[0].code, 'Probate Code', 'probate code');
  assertEqual(e.statutes[0].section, '859', 'section 859');
});

test('planner mergeEntities dedupes and preserves heuristic hits', () => {
  const h = extractEntitiesHeuristic('Family Code § 1615 and Civil Code § 1668');
  const l = {
    ...EMPTY_ENTITIES,
    statutes: [
      { code: 'Family Code', section: '1615' }, // dup
      { code: 'Probate Code', section: '859' }, // new
    ],
    practice_areas: ['trusts_estates'],
    is_current_law_query: false,
  };
  const merged = mergeEntities(h, l);
  assertEqual(merged.statutes.length, 3, 'family+civil+probate');
  assertTrue(
    merged.practice_areas.includes('family_law') && merged.practice_areas.includes('trusts_estates'),
    'both practice areas'
  );
});

test('gold-recall-prompts.json contains 10 well-formed entries', () => {
  const data = loadFixture('gold-recall-prompts.json');
  assertEqual(data.prompts.length, 10, 'ten prompts');
  for (const p of data.prompts) {
    assertTrue(typeof p.id === 'string' && p.id.startsWith('gold-'), `id ${p.id}`);
    assertTrue(typeof p.text === 'string' && p.text.length > 10, `text ${p.id}`);
  }
});

test('heuristic extraction satisfies every fixture expectation', () => {
  const data = loadFixture('gold-recall-prompts.json');
  for (const p of data.prompts) {
    const e = extractEntitiesHeuristic(p.text);
    const exp = p.expectedHeuristic || {};
    if (typeof exp.statuteCount === 'number') {
      assertTrue(e.statutes.length >= exp.statuteCount, `${p.id} statuteCount ≥ ${exp.statuteCount}`);
    }
    if (exp.practiceAreasInclude) {
      assertTrue(
        e.practice_areas.includes(exp.practiceAreasInclude),
        `${p.id} practice area ${exp.practiceAreasInclude}`
      );
    }
    if (exp.isCurrentLawQuery === true) {
      assertTrue(e.is_current_law_query, `${p.id} is current-law`);
    }
    if (exp.legislativeSessionYear) {
      assertEqual(
        e.legislative_session_year,
        exp.legislativeSessionYear,
        `${p.id} session year`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 4c. Citation grounding (hallucination safety net)
// ---------------------------------------------------------------------------
const grounding = await import('../api/_shared/citationGrounding.ts');
const { extractCitations, findUngroundedCitations, ungroundedCitationCaveat, analyzeCebDominance } = grounding;

test('extractCitations pulls AB/SB/statute references from prose', () => {
  const text =
    'Under California Family Code § 1615, this is governed. Also see AB 2989 (Dixon) and SB 1456 (Blakespear). AB 2234 passed.';
  const cites = extractCitations(text);
  const bills = cites.filter((c) => c.kind === 'bill').map((c) => c.normalized).sort();
  const statutes = cites.filter((c) => c.kind === 'statute').map((c) => c.normalized);
  assertEqual(bills.join(','), 'AB2234,AB2989,SB1456', 'bill citations');
  assertEqual(statutes.length, 1, 'one statute citation');
  assertEqual(statutes[0], 'family|1615', 'statute canonicalization (code prefix only)');
});

test('findUngroundedCitations flags AB 2989 hallucination against real e-bike sources', () => {
  const answer =
    'Key 2025-2026 bills include AB 2989 (Dixon), SB 1456 (Blakespear), and AB 2234 (Boerner). See prior AB 2346.';
  const sources = [
    { title: 'AB 2234 - Vehicles: electric bicycles', url: 'https://leginfo.legislature.ca.gov/AB2234' },
    { title: 'AB 2346 - Vehicles: electric bicycles and speed limits', url: 'https://legiscan.com/CA/bill/AB2346' },
    { title: 'SB 1283 - Electric vehicle charging stations', url: 'https://openstates.org/SB1283' },
  ];
  const result = findUngroundedCitations(answer, sources);
  const ungroundedNums = result.ungrounded.map((c) => c.normalized).sort();
  assertEqual(ungroundedNums.join(','), 'AB2989,SB1456', 'AB 2989 and SB 1456 are ungrounded');
  assertEqual(result.groundedCount, 2, 'AB 2234 and AB 2346 are grounded');
});

test('findUngroundedCitations grounds statute citations when code+section both appear in any source', () => {
  const answer =
    'Under Family Code § 1615 this is clear. Cited as well: Probate Code § 859.';
  const sources = [
    { title: 'Family Code 1615', url: 'https://leginfo.legislature.ca.gov/1615' },
    { title: 'California Probate Code § 859 double damages', url: 'https://leginfo.../Probate859' },
  ];
  const result = findUngroundedCitations(answer, sources);
  assertEqual(result.ungrounded.length, 0, 'both statutes grounded');
});

test('findUngroundedCitations flags a statute whose section is not in sources', () => {
  const answer = 'See Penal Code § 459 for burglary.';
  const sources = [{ title: 'Some unrelated CEB chunk', url: 'https://ceb/x' }];
  const result = findUngroundedCitations(answer, sources);
  assertEqual(result.ungrounded.length, 1, 'penal code § 459 ungrounded');
  assertEqual(result.ungrounded[0].kind, 'statute', 'kind');
});

test('analyzeCebDominance: CEB-heavy question keeps CEB badge', () => {
  const answer =
    'Under Family Code § 1615, a premarital agreement must be in writing [1]. Independent counsel matters [2]. See also Clarke [3]. The statute text [5].';
  const sources = [
    { id: '1', isCEB: true, title: 'CEB Estate Planning' },
    { id: '2', isCEB: true, title: 'CEB Marital Settlement' },
    { id: '3', isCEB: true, title: 'CEB Probate' },
    { id: '4', isCEB: true, title: 'CEB Family Code' },
    { id: '5', isCEB: false, title: 'Family Code § 1615' },
  ];
  const { cebCitedCount, nonCebCitedCount, isCebDominant } = analyzeCebDominance(answer, sources);
  assertEqual(cebCitedCount, 3, 'three CEB cites');
  assertEqual(nonCebCitedCount, 1, 'one non-CEB cite');
  assertEqual(isCebDominant, true, 'CEB dominant');
});

test('analyzeCebDominance: legislative-heavy question drops CEB dominance', () => {
  const answer =
    'See AB 382 [7], AB 1327 [8], SB 517 [9], AB 2313 [10], AB 2110 [11]. Also CEB background [1]. More CEB [2].';
  const sources = [
    { id: '1', isCEB: true, title: 'CEB Business Law Reporter' },
    { id: '2', isCEB: true, title: 'CEB Business Law Reporter' },
    { id: '7', isCEB: false, title: 'AB 382' },
    { id: '8', isCEB: false, title: 'AB 1327' },
    { id: '9', isCEB: false, title: 'SB 517' },
    { id: '10', isCEB: false, title: 'AB 2313' },
    { id: '11', isCEB: false, title: 'AB 2110' },
  ];
  const { cebCitedCount, nonCebCitedCount, isCebDominant } = analyzeCebDominance(answer, sources);
  assertEqual(cebCitedCount, 2, 'two CEB cites');
  assertEqual(nonCebCitedCount, 5, 'five legislative cites');
  assertEqual(isCebDominant, false, 'NOT CEB dominant — badge must drop');
});

test('analyzeCebDominance: zero citations yields not dominant', () => {
  const answer = 'Narrative answer with no numbered citations.';
  const sources = [{ id: '1', isCEB: true, title: 'CEB' }];
  const { isCebDominant } = analyzeCebDominance(answer, sources);
  assertEqual(isCebDominant, false, 'no citations → not dominant');
});

test('ungroundedCitationCaveat lists up to 4 of the offenders', () => {
  const answer = 'AB 1. AB 2. AB 3. AB 4. AB 5. AB 6.';
  const result = findUngroundedCitations(answer, []);
  const caveat = ungroundedCitationCaveat(result);
  assertTrue(/AB 1/.test(caveat), 'includes AB 1');
  assertTrue(/and \d+ more/.test(caveat), 'mentions overflow count');
});

// ---------------------------------------------------------------------------
// 4d. Legislative query planner shape
// ---------------------------------------------------------------------------
const legPlanner = await import('../api/_shared/researchPlanner.ts');
const { EMPTY_LEGISLATIVE_PLAN } = legPlanner;

test('EMPTY_LEGISLATIVE_PLAN is well-formed for fail-open callers', () => {
  assertEqual(Array.isArray(EMPTY_LEGISLATIVE_PLAN.variants), true, 'variants array');
  assertEqual(EMPTY_LEGISLATIVE_PLAN.variants.length, 0, 'empty variants');
  assertEqual(EMPTY_LEGISLATIVE_PLAN.rationale, '', 'empty rationale');
});

// ---------------------------------------------------------------------------
// 5. Source-code grep checks for forbidden patterns on Bedrock paths
// ---------------------------------------------------------------------------
test('No production Bedrock call site falls back to a GEMINI_* model env var', () => {
  const filesToCheck = [
    'api/anthropic-chat.ts',
    'api/gemini-chat.ts',
    'api/claude-chat.ts',
    'api/drafting-magic.ts',
    'api/orchestrate-document.ts',
    'agents/researchAgent.ts',
    'agents/verifierAgent.ts',
    'agents/drafterAgent.ts',
  ];
  const forbidden = /process\.env\.GEMINI_(PRIMARY|FALLBACK|VERIFIER|RESEARCH|DRAFTER)_MODEL/;
  const repoRoot = join(__dirname, '..');
  const offenders = [];
  for (const file of filesToCheck) {
    const text = readFileSync(join(repoRoot, file), 'utf8');
    if (forbidden.test(text)) offenders.push(file);
  }
  if (offenders.length) {
    throw new Error('GEMINI_* fallback still present in: ' + offenders.join(', '));
  }
});

test('Speed route declares only speed_passthrough flow', () => {
  const text = readFileSync(join(__dirname, '..', 'api/anthropic-chat.ts'), 'utf8');
  assertTrue(/SPEED_ALLOWED/.test(text), 'must import SPEED_ALLOWED');
  assertTrue(/enforceFlow\(\s*req\.body,\s*SPEED_ALLOWED/.test(text), 'must enforce SPEED_ALLOWED');
});

test('Accuracy routes enforce ACCURACY_ALLOWED', () => {
  for (const file of ['api/gemini-chat.ts', 'api/claude-chat.ts', 'api/drafting-magic.ts']) {
    const text = readFileSync(join(__dirname, '..', file), 'utf8');
    assertTrue(/enforceFlow\(\s*req\.body,\s*ACCURACY_ALLOWED/.test(text), `${file} must enforce ACCURACY_ALLOWED`);
  }
});

test('Drafting Magic uses the Bedrock drafter role and preserves tokenized response boundary', () => {
  const text = readFileSync(join(__dirname, '..', 'api/drafting-magic.ts'), 'utf8');
  assertTrue(/resolveBedrockModel\(\s*['"]drafter['"]\s*\)/.test(text), 'must resolve BEDROCK_DRAFTER_MODEL');
  assertTrue(/response intentionally remains tokenized/i.test(text), 'must document browser-only rehydration boundary');
  assertTrue(/assertNoPromptCacheMetadata\(\s*requestPayload,\s*['"]drafting-magic['"]/.test(text), 'must reject prompt-cache metadata');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`Confidentiality tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.message}`);
  }
  process.exit(1);
}
process.exit(0);
