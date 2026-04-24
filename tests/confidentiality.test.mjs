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
const flowPolicy = await import('../utils/flowPolicy.ts');
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
const bedrockModels = await import('../utils/bedrockModels.ts');
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
// 5. Source-code grep checks for forbidden patterns on Bedrock paths
// ---------------------------------------------------------------------------
test('No production Bedrock call site falls back to a GEMINI_* model env var', () => {
  const filesToCheck = [
    'api/anthropic-chat.ts',
    'api/gemini-chat.ts',
    'api/claude-chat.ts',
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
  for (const file of ['api/gemini-chat.ts', 'api/claude-chat.ts']) {
    const text = readFileSync(join(__dirname, '..', file), 'utf8');
    assertTrue(/enforceFlow\(\s*req\.body,\s*ACCURACY_ALLOWED/.test(text), `${file} must enforce ACCURACY_ALLOWED`);
  }
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
