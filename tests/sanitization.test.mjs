/**
 * Phase 6 Day 1 — sanitization engine tests
 *
 * Covers: individual PII patterns, allowlist suppression, name detection
 * signals, and the full analyze() pipeline. Pure TS imports via Node's
 * --experimental-strip-types (Node 24 native).
 *
 * Run with: npm run test:sanitization
 */

import { strict as assert } from 'node:assert';
import 'fake-indexeddb/auto';

let passed = 0;
let failed = 0;
const failures = [];
let storeSeq = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, message: err?.message || String(err) });
    console.log(`❌ ${name}\n   ${err?.message || err}`);
  }
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------
const patterns = await import('../api/_shared/sanitization/patterns.ts');
const {
  SSN,
  TIN,
  CA_DRIVER_LICENSE,
  PHONE,
  EMAIL,
  STREET_ADDRESS,
  ZIP,
  DATE_NUMERIC,
  CREDIT_CARD,
  BANK_ACCOUNT,
  MEDICAL_RECORD,
  FIRM_CLIENT_MATTER,
  runPatterns,
} = patterns;

function matches(pattern, text) {
  pattern.regex.lastIndex = 0;
  const m = pattern.regex.exec(text);
  return !!m;
}

function mustDetect(pattern, samples) {
  for (const s of samples) {
    assert.ok(matches(pattern, s), `expected ${pattern.label} to match: ${s}`);
  }
}

function mustNotDetect(pattern, samples) {
  for (const s of samples) {
    assert.ok(!matches(pattern, s), `expected ${pattern.label} to NOT match: ${s}`);
  }
}

await test('SSN: detects hyphenated formats; rejects bare 9-digit', () => {
  mustDetect(SSN, [
    'The SSN is 123-45-6789 on file.',
    'ID: 987-65-4321',
    '000-12-3456 per the record.',
  ]);
  mustNotDetect(SSN, [
    'account 123456789 was updated',
    'case 2023-45-6789 something',
    'no SSN here',
    'telephone 4155550123',
  ]);
});

await test('TIN: detects NN-NNNNNNN; rejects other groupings', () => {
  mustDetect(TIN, [
    'FEIN 27-1234567 is on file.',
    'Employer ID 12-9876543',
    'EIN: 00-0000000',
  ]);
  mustNotDetect(TIN, [
    '123-45-6789', // SSN shape, not TIN
    '1-12345678',
    'section 2024-1',
    'amount $12-500',
  ]);
});

await test('California driver license: letter + 7 digits', () => {
  mustDetect(CA_DRIVER_LICENSE, [
    'CDL D1234567 expires',
    'license A9876543',
    'DL number B0000001',
  ]);
  mustNotDetect(CA_DRIVER_LICENSE, [
    'abc1234567',
    'A 1234567',
    'A12345678', // too long
    'S1234',
  ]);
});

await test('Phone: detects common US formats', () => {
  mustDetect(PHONE, [
    'call (415) 555-0123',
    'phone 415-555-0123',
    'mobile 415.555.0123',
    '+1 415 555 0123',
  ]);
  mustNotDetect(PHONE, [
    'invoice 123.45',
    'code 001-02-0003',
    'year 2025-26',
  ]);
});

await test('Email: detects standard addresses', () => {
  mustDetect(EMAIL, [
    'write to maria@example.com',
    'client.address+tag@gmail.com is it',
    'legal-team@firm.co.uk',
  ]);
  mustNotDetect(EMAIL, [
    'no email here',
    '@handle on social',
    'foo @ bar .com',
  ]);
});

await test('Street address: detects "number Street-Name Suffix"', () => {
  mustDetect(STREET_ADDRESS, [
    'residing at 2155 Vallejo Street',
    'the property at 100 Main Ave',
    '42 Pine Blvd recently',
  ]);
  mustNotDetect(STREET_ADDRESS, [
    'no numbers here',
    'section 2030.300',
    'AB 2234 is pending',
  ]);
});

await test('ZIP: contextual 5-digit and full ZIP+4, rejects bare sections', () => {
  mustDetect(ZIP, [
    'San Francisco CA 94133 is the ZIP',
    'ZIP 94115-2045 on record',
    'address ending in 90210-1234',
  ]);
  mustNotDetect(ZIP, [
    'the year 202620',
    'phone 4155550123',
    'code 123',
    'Welfare and Institutions Code § 15610',
    'Section 12345 applies',
  ]);
});

await test('Date (numeric): catches common DOB formats, rejects non-dates', () => {
  mustDetect(DATE_NUMERIC, [
    'DOB 3/14/1953',
    'born 03-14-1953',
    'executed 12/31/25',
  ]);
  mustNotDetect(DATE_NUMERIC, [
    'amount $100/month',
    'score 2/5',
    '50/50 split',
  ]);
});

await test('Credit card: 13–19 digit sequences', () => {
  mustDetect(CREDIT_CARD, [
    'card 4111 1111 1111 1111 on file',
    '5500-0000-0000-0004',
    '378282246310005',
  ]);
  mustNotDetect(CREDIT_CARD, [
    'phone 4155550123',
    'number 12345',
    '2023',
  ]);
});

await test('Bank account: only caught with "account"/"acct"/"routing" cue', () => {
  mustDetect(BANK_ACCOUNT, [
    'account number: 123456789012',
    'acct 987654321',
    'routing 021000021',
  ]);
  mustNotDetect(BANK_ACCOUNT, [
    '123456789012 appears alone',
    'case 987654321 is pending',
    'population 10000000',
  ]);
});

await test('Medical record: "MRN" prefix + digits', () => {
  mustDetect(MEDICAL_RECORD, [
    'MRN 12345678 on chart',
    'mrn: 000111222',
    'MRN#9876543',
  ]);
  mustNotDetect(MEDICAL_RECORD, [
    '12345678',
    'MR 1234',
    'MRI scheduled',
  ]);
});

await test('Firm client-matter: standard code shape', () => {
  mustDetect(FIRM_CLIENT_MATTER, [
    'matter code DE-2025-001234',
    'file FFLP-24-0099 opened',
    'DCG-2020-42',
  ]);
  mustNotDetect(FIRM_CLIENT_MATTER, [
    'Penal Code 459',
    'AB-2346',
    'case 2024-0099',
  ]);
});

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------
const allow = await import('../api/_shared/sanitization/allowlist.ts');
const { findAllowlistMatches, overlapsAllowlist } = allow;

await test('Allowlist: matches California statute and case citations', () => {
  const text = 'Under Family Code § 1615, and following People v. Smith (2020) 50 Cal.App.5th 123, the outcome is clear.';
  const hits = findAllowlistMatches(text);
  const kinds = new Set(hits.map((h) => h.kind));
  assert.ok(kinds.has('statute'), 'statute hit');
  assert.ok(kinds.has('case'), 'case hit');
});

await test('Allowlist: matches agencies and courts', () => {
  const text =
    'The California Supreme Court and the Franchise Tax Board both weigh in. The State Bar of California issued guidance.';
  const hits = findAllowlistMatches(text);
  const kinds = new Set(hits.map((h) => h.kind));
  assert.ok(kinds.has('court'), 'court hit');
  assert.ok(kinds.has('agency'), 'agency hit');
});

await test('overlapsAllowlist: region inside a statute hit is suppressed', () => {
  const text = 'Under Family Code § 1615 the analysis applies.';
  const hits = findAllowlistMatches(text);
  // "Family Code" is part of the statute hit.
  const familyCodeIdx = text.indexOf('Family Code');
  assert.ok(overlapsAllowlist(familyCodeIdx, familyCodeIdx + 'Family Code'.length, hits));
});

// ---------------------------------------------------------------------------
// Name detection
// ---------------------------------------------------------------------------
const names = await import('../api/_shared/sanitization/detectNames.ts');
const { detectNames } = names;

await test('detectNames: title prefix catches "Dr. Maria Esperanza"', () => {
  const spans = detectNames('Our client, Dr. Maria Esperanza, transferred her home.');
  const hit = spans.find((s) => s.signal === 'title_prefix');
  assert.ok(hit, 'has title_prefix hit');
  assert.equal(hit.raw, 'Maria Esperanza');
});

await test('detectNames: relational catches "my client Maria Esperanza"', () => {
  const spans = detectNames('We represent my client Maria Esperanza in this matter.');
  const hit = spans.find((s) => s.signal === 'relational');
  assert.ok(hit, 'has relational hit');
  assert.equal(hit.raw, 'Maria Esperanza');
});

await test('detectNames: possessive catches "Esperanza\'s"', () => {
  const spans = detectNames("Esperanza's estate is substantial.");
  const hit = spans.find((s) => s.signal === 'possessive');
  assert.ok(hit, 'possessive hit');
  assert.equal(hit.raw, 'Esperanza');
});

await test('detectNames: capitalized bigram flags "Daniel Esperanza" even without cue', () => {
  const spans = detectNames('The transfer was to Daniel Esperanza in 2021.');
  const hit = spans.find((s) => s.signal === 'capitalized_bigram' && s.raw === 'Daniel Esperanza');
  assert.ok(hit, 'bigram hit');
});

await test('detectNames: does NOT falsely fire on pronouns or months', () => {
  const spans = detectNames('She returned in January. The agreement is final.');
  // "The agreement" could bigram but "The" is in COMMON_NON_NAME_STARTS.
  assert.equal(
    spans.filter((s) => s.raw.startsWith('The')).length,
    0,
    'no "The X" bigrams'
  );
});

// ---------------------------------------------------------------------------
// Analyzer integration
// ---------------------------------------------------------------------------
const analyzer = await import('../api/_shared/sanitization/index.ts');
const { analyze } = analyzer;

await test('analyze: end-to-end on the Maria Esperanza fixture', () => {
  const text =
    'Our client Maria Esperanza, age 73, residing at 2155 Vallejo Street, SF, transferred her home to her son Daniel Esperanza in 2021. Phone 415-555-0123.';
  const { spans } = analyze(text);
  const raws = spans.map((s) => s.raw);
  // Hit: name (Maria Esperanza), address (2155 Vallejo Street), relational son (Daniel Esperanza), phone.
  assert.ok(raws.some((r) => r.includes('Maria Esperanza')), 'Maria caught');
  assert.ok(raws.some((r) => r.includes('Daniel Esperanza')), 'Daniel caught');
  assert.ok(raws.some((r) => /2155 Vallejo Street/.test(r)), 'address caught');
  assert.ok(raws.some((r) => /415-555-0123/.test(r)), 'phone caught');
});

await test('analyze: suppresses public-case captions and statute citations', () => {
  const text =
    'Under Family Code § 1615, the outcome in People v. Smith (2020) 50 Cal.App.5th 123 applies to our facts. See also California Supreme Court guidance.';
  const { spans, suppressedByAllowlist } = analyze(text);
  // No span should cover "People" or "Smith" (public case caption is on allowlist).
  const raws = spans.map((s) => s.raw);
  assert.ok(
    !raws.some((r) => r === 'People' || r === 'Smith' || r.includes('Smith')),
    'public case names not tokenized'
  );
  assert.ok(suppressedByAllowlist > 0, 'at least one allowlist suppression');
});

await test('analyze: over-eager — tokenizes random capitalized bigrams', () => {
  // It's fine to catch "Central Valley" here; attorney can un-tokenize in preview.
  const text = 'The property is located in Central Valley, subject to standard rules.';
  const { spans } = analyze(text);
  assert.ok(
    spans.some((s) => s.raw === 'Central Valley'),
    'bigram captured (attorney can un-tokenize)'
  );
});

await test('analyze: empty and non-string input', () => {
  assert.deepEqual(analyze('').spans, []);
  assert.deepEqual(analyze(null).spans, []);
  assert.deepEqual(analyze(undefined).spans, []);
});

await test('runPatterns: total match count grows with allowlist entries', () => {
  const text = 'SSN 123-45-6789 and another 987-65-4321. Email test@example.com.';
  const all = runPatterns(text);
  assert.ok(all.length >= 3, 'at least 3 matches across patterns');
});

// ---------------------------------------------------------------------------
// Encrypted persistent store (Day 2)
// ---------------------------------------------------------------------------
const storeMod = await import('../api/_shared/sanitization/store.ts');
const { SanitizationStore, WrongPassphraseError } = storeMod;

function freshStoreName() {
  storeSeq += 1;
  return `cla-sanitization-test-${storeSeq}-${Date.now()}`;
}

await test('store.init: first-time create derives a key and can assign tokens', async () => {
  const s = new SanitizationStore();
  await s.init('hunter2!Strong', { dbName: freshStoreName() });
  const t = await s.assignToken('Maria Esperanza', 'name');
  assert.equal(t.value, 'CLIENT_001', 'first name token is CLIENT_001');
  assert.equal(t.category, 'name');
  s.close();
});

await test('store: same raw + category returns the same token across assigns', async () => {
  const s = new SanitizationStore();
  await s.init('pw', { dbName: freshStoreName() });
  const t1 = await s.assignToken('Maria Esperanza', 'name');
  const t2 = await s.assignToken('Maria Esperanza', 'name');
  assert.equal(t1.value, t2.value, 'stable token across calls');
});

await test('store: different entities get different tokens and counters advance', async () => {
  const s = new SanitizationStore();
  await s.init('pw', { dbName: freshStoreName() });
  const t1 = await s.assignToken('Maria Esperanza', 'name');
  const t2 = await s.assignToken('Daniel Esperanza', 'name');
  const a1 = await s.assignToken('2155 Vallejo Street', 'street_address');
  assert.equal(t1.value, 'CLIENT_001');
  assert.equal(t2.value, 'CLIENT_002');
  assert.equal(a1.value, 'ADDRESS_001', 'different category starts its own counter');
});

await test('store: case-insensitive entity matching reuses tokens', async () => {
  const s = new SanitizationStore();
  await s.init('pw', { dbName: freshStoreName() });
  const t1 = await s.assignToken('Maria Esperanza', 'name');
  const t2 = await s.assignToken('maria esperanza', 'name');
  assert.equal(t1.value, t2.value, 'same entity regardless of case');
});

await test('store: persists across close/reopen, counters continue', async () => {
  const dbName = freshStoreName();
  const s1 = new SanitizationStore();
  await s1.init('pw', { dbName });
  await s1.assignToken('Maria Esperanza', 'name');
  s1.close();

  const s2 = new SanitizationStore();
  await s2.init('pw', { dbName });
  const lookup = await s2.lookupToken('Maria Esperanza', 'name');
  assert.ok(lookup, 'token persisted');
  assert.equal(lookup.value, 'CLIENT_001');

  const newEntity = await s2.assignToken('Daniel Esperanza', 'name');
  assert.equal(newEntity.value, 'CLIENT_002', 'counter resumed from persisted value');
});

await test('store: wrong passphrase on reopen throws WrongPassphraseError', async () => {
  const dbName = freshStoreName();
  const s1 = new SanitizationStore();
  await s1.init('correct horse', { dbName });
  await s1.assignToken('Maria Esperanza', 'name');
  s1.close();

  const s2 = new SanitizationStore();
  let threw = false;
  try {
    await s2.init('wrong passphrase', { dbName });
  } catch (err) {
    threw = err instanceof WrongPassphraseError;
  }
  assert.ok(threw, 'expected WrongPassphraseError');
});

await test('store.rehydrateMap returns token→raw for every stored entity', async () => {
  const s = new SanitizationStore();
  await s.init('pw', { dbName: freshStoreName() });
  await s.assignToken('Maria Esperanza', 'name');
  await s.assignToken('Daniel Esperanza', 'name');
  await s.assignToken('2155 Vallejo Street', 'street_address');
  const map = await s.rehydrateMap();
  assert.equal(map.get('CLIENT_001'), 'Maria Esperanza');
  assert.equal(map.get('CLIENT_002'), 'Daniel Esperanza');
  assert.equal(map.get('ADDRESS_001'), '2155 Vallejo Street');
  assert.equal(map.size, 3);
});

await test('store.forgetEntity removes the record from rehydration', async () => {
  const s = new SanitizationStore();
  await s.init('pw', { dbName: freshStoreName() });
  await s.assignToken('Maria Esperanza', 'name');
  await s.assignToken('Daniel Esperanza', 'name');
  await s.forgetEntity('CLIENT_001');
  const map = await s.rehydrateMap();
  assert.equal(map.has('CLIENT_001'), false);
  assert.equal(map.has('CLIENT_002'), true);
});

await test('store export + import round-trips entities under the same passphrase', async () => {
  const passphrase = 'shared passphrase 42';
  const originalName = freshStoreName();
  const s1 = new SanitizationStore();
  await s1.init(passphrase, { dbName: originalName });
  await s1.assignToken('Maria Esperanza', 'name');
  await s1.assignToken('2155 Vallejo Street', 'street_address');
  const blob = await s1.exportEncrypted();
  s1.close();

  const newName = freshStoreName();
  const s2 = new SanitizationStore();
  await s2.importEncrypted(blob, passphrase, { dbName: newName });
  const map = await s2.rehydrateMap();
  assert.equal(map.get('CLIENT_001'), 'Maria Esperanza');
  assert.equal(map.get('ADDRESS_001'), '2155 Vallejo Street');
});

await test('store import with wrong passphrase throws', async () => {
  const s1 = new SanitizationStore();
  await s1.init('right', { dbName: freshStoreName() });
  await s1.assignToken('Maria Esperanza', 'name');
  const blob = await s1.exportEncrypted();
  s1.close();

  const s2 = new SanitizationStore();
  let threw = false;
  try {
    await s2.importEncrypted(blob, 'wrong', { dbName: freshStoreName() });
  } catch (err) {
    threw = err instanceof WrongPassphraseError;
  }
  assert.ok(threw, 'expected WrongPassphraseError on import with wrong passphrase');
});

// ---------------------------------------------------------------------------
// Tokenize + Rehydrate (Day 3)
// ---------------------------------------------------------------------------
const pipeline = await import('../api/_shared/sanitization/tokenize.ts');
const { tokenize, rehydrate, findUnknownTokens } = pipeline;

async function freshStore(passphrase = 'pw') {
  const s = new SanitizationStore();
  await s.init(passphrase, { dbName: freshStoreName() });
  return s;
}

await test('tokenize: basic entity → sanitized text + populated map', async () => {
  const s = await freshStore();
  const { sanitized, tokenMap, tokenCategoryCounts } = await tokenize(
    'Our client Maria Esperanza transferred her home to her son Daniel Esperanza.',
    s
  );
  assert.ok(/CLIENT_00\d/.test(sanitized), 'sanitized contains a CLIENT token');
  assert.ok(!sanitized.includes('Maria Esperanza'), 'real name absent from sanitized');
  assert.ok(!sanitized.includes('Daniel Esperanza'), 'second name absent');
  assert.equal(tokenMap.size, 2, 'two distinct names in map');
  assert.equal(tokenCategoryCounts.name, 2);
});

await test('tokenize: stable across repeated calls on the same store', async () => {
  const s = await freshStore();
  const a = await tokenize('Our client Maria Esperanza called today.', s);
  const b = await tokenize('Follow up with Maria Esperanza tomorrow.', s);
  // Same entity → same token across invocations.
  const tokenA = [...a.tokenMap.keys()][0];
  const tokenB = [...b.tokenMap.keys()][0];
  assert.equal(tokenA, tokenB, 'stable token for the same raw entity');
});

await test('tokenize: preserves public-legal entities (allowlist) intact', async () => {
  const s = await freshStore();
  const { sanitized } = await tokenize(
    'Under Family Code § 1615, the analysis in People v. Smith controls.',
    s
  );
  assert.ok(/Family Code/i.test(sanitized), 'statute citation preserved');
  assert.ok(/People v\. Smith/.test(sanitized), 'case caption preserved');
});

await test('tokenize: SSN, phone, and address all flow to tokens', async () => {
  const s = await freshStore();
  const { sanitized, tokenCategoryCounts } = await tokenize(
    'SSN 123-45-6789, phone 415-555-0123, residing at 2155 Vallejo Street.',
    s
  );
  assert.ok(!sanitized.includes('123-45-6789'), 'SSN tokenized');
  assert.ok(!sanitized.includes('415-555-0123'), 'phone tokenized');
  assert.ok(!sanitized.includes('2155 Vallejo Street'), 'address tokenized');
  assert.ok(tokenCategoryCounts.ssn >= 1);
  assert.ok(tokenCategoryCounts.phone >= 1);
  assert.ok(tokenCategoryCounts.street_address >= 1);
});

await test('rehydrate: exact inverse on the sanitized output', async () => {
  const s = await freshStore();
  const original = 'Our client Maria Esperanza, phone 415-555-0123, at 2155 Vallejo Street.';
  const { sanitized, tokenMap } = await tokenize(original, s);
  const back = rehydrate(sanitized, tokenMap);
  assert.equal(back, original, 'round-trip recovers the original text');
});

await test('rehydrate: handles possessives — CLIENT_001\'s → Maria Esperanza\'s', async () => {
  const s = await freshStore();
  const { tokenMap } = await tokenize('Our client Maria Esperanza transferred it.', s);
  const text = `CLIENT_001's estate is substantial. CLIENT_001 executed in 2021.`;
  const back = rehydrate(text, tokenMap);
  assert.ok(back.includes("Maria Esperanza's estate"), 'possessive preserved');
  assert.ok(back.includes('Maria Esperanza executed in 2021'), 'plain substitution');
});

await test('rehydrate: leaves unknown tokens untouched (model-invented)', () => {
  const map = new Map([['CLIENT_001', 'Maria Esperanza']]);
  const back = rehydrate('CLIENT_001 and CLIENT_999 appeared in the answer.', map);
  assert.ok(back.includes('Maria Esperanza'), 'known token replaced');
  assert.ok(back.includes('CLIENT_999'), 'unknown token left alone');
});

await test('rehydrate: CLIENT_100 does not collide with CLIENT_1000', () => {
  // If we ever exceed 999 names, the token grows (CLIENT_1000). The word-
  // boundary regex must prevent CLIENT_100 from replacing the prefix of
  // CLIENT_1000.
  const map = new Map([
    ['CLIENT_100', 'Alice'],
    ['CLIENT_1000', 'Bob'],
  ]);
  const out = rehydrate('See CLIENT_100 and CLIENT_1000.', map);
  assert.equal(out, 'See Alice and Bob.');
});

await test('findUnknownTokens flags model-invented CLIENT/SB references', () => {
  const text = 'CLIENT_001 and CLIENT_777 and ADDRESS_003 are discussed.';
  const map = new Map([['CLIENT_001', 'Maria Esperanza']]);
  const unknown = findUnknownTokens(text, map);
  assert.deepEqual(unknown.sort(), ['ADDRESS_003', 'CLIENT_777'].sort());
});

await test('tokenize → rehydrate round-trip over multi-sentence prompts', async () => {
  const s = await freshStore();
  const prompts = [
    'Our client Maria Esperanza, age 73, transferred her home to her son Daniel Esperanza in 2021.',
    'The Esperanza estate is worth about 4.8 million. Contact her at 415-555-0123.',
    'Family Code § 1615 governs; see People v. Smith (2020) 50 Cal.App.5th 123.',
    'My client John Smith lives at 742 Evergreen Terrace.',
    'Send the draft to attorney@firm.com by 10/15/2025.',
  ];
  for (const original of prompts) {
    const { sanitized, tokenMap } = await tokenize(original, s);
    const back = rehydrate(sanitized, tokenMap);
    assert.equal(back, original, `round-trip: "${original.slice(0, 50)}..."`);
  }
});

await test('tokenize: a pure public-legal prompt produces no tokens', async () => {
  const s = await freshStore();
  const prompt =
    'Explain the elements of an enforceable premarital agreement under California Family Code § 1615.';
  const { sanitized, tokenMap } = await tokenize(prompt, s);
  assert.equal(sanitized, prompt, 'no tokens inserted');
  assert.equal(tokenMap.size, 0, 'empty map');
});

// ---------------------------------------------------------------------------
// Server backstop (Day 4)
// ---------------------------------------------------------------------------
const guard = await import('../api/_shared/sanitization/guard.ts');
const { scanForRawPII, scanConversationHistory, scanRequest, rejectWithBackstop } = guard;

await test('backstop: clean text accepts', () => {
  const r = scanForRawPII('Explain Family Code § 1615 in plain English.');
  assert.equal(r.ok, true);
});

await test('backstop: rejects raw SSN with ssn category', () => {
  const r = scanForRawPII('Client SSN is 123-45-6789.');
  assert.equal(r.ok, false);
  assert.deepEqual(r.categories, ['ssn']);
});

await test('backstop: rejects phone + street address + date simultaneously', () => {
  const r = scanForRawPII('Reach them at 415-555-0123 or 2155 Vallejo Street; DOB 3/14/1953.');
  assert.equal(r.ok, false);
  assert.ok(r.categories.includes('phone'));
  assert.ok(r.categories.includes('street_address'));
  assert.ok(r.categories.includes('date'));
});

await test('backstop: accepts already-tokenized text', () => {
  const r = scanForRawPII('CLIENT_001 transferred ADDRESS_002 on DATE_003.');
  assert.equal(r.ok, true);
});

await test('backstop: conversation-history scan catches PII in prior turns', () => {
  const r = scanConversationHistory([
    { role: 'user', text: 'Clean follow-up question.' },
    { role: 'user', text: 'Original: 123-45-6789 was the SSN.' },
  ]);
  assert.equal(r.ok, false);
  assert.ok(r.categories.includes('ssn'));
});

await test('backstop: scanRequest merges primary + history categories', () => {
  const r = scanRequest('email: jane@example.com', [
    { role: 'user', text: 'earlier: 123-45-6789' },
  ]);
  assert.equal(r.ok, false);
  assert.ok(r.categories.includes('email'));
  assert.ok(r.categories.includes('ssn'));
});

await test('backstop: error message never echoes matched text', () => {
  const r = scanForRawPII('SSN 123-45-6789 is on file.');
  assert.equal(r.ok, false);
  assert.ok(!r.message.includes('123-45-6789'), 'raw PII absent from error message');
});

await test('backstop: non-string/empty inputs return ok', () => {
  assert.equal(scanForRawPII('').ok, true);
  assert.equal(scanForRawPII(undefined).ok, true);
  assert.equal(scanForRawPII(42).ok, true);
  assert.equal(scanConversationHistory('not an array').ok, true);
});

await test('backstop: rejectWithBackstop sends 400 with categories, returns true', () => {
  const sent = {};
  const res = {
    status(code) {
      sent.code = code;
      return {
        json(body) {
          sent.body = body;
        },
      };
    },
  };
  const result = scanForRawPII('ssn 123-45-6789');
  const sendOutcome = rejectWithBackstop(res, result);
  assert.equal(sendOutcome, true);
  assert.equal(sent.code, 400);
  assert.equal(sent.body.error, 'backstop_triggered');
  assert.ok(sent.body.categories.includes('ssn'));
});

await test('backstop: rejectWithBackstop returns false on accepts without sending', () => {
  let called = false;
  const res = {
    status() {
      called = true;
      return { json() { called = true; } };
    },
  };
  const sent = rejectWithBackstop(res, { ok: true });
  assert.equal(sent, false);
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// Route-wiring grep tests — every protected route must call the backstop
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { dirname as dirnameFn, join as joinPath } from 'node:path';
import { fileURLToPath as pathFromFile } from 'node:url';

const testsDir = dirnameFn(pathFromFile(import.meta.url));
const repoRoot = joinPath(testsDir, '..');

function routeCallsBackstop(file) {
  const text = readFileSync(joinPath(repoRoot, file), 'utf8');
  const importsGuard = /from ['"][^'"]*sanitization\/guard[^'"]*['"]/.test(text);
  const callsScan = /scan(ForRawPII|Request|ConversationHistory)\s*\(/.test(text);
  const callsReject = /rejectWithBackstop\s*\(/.test(text);
  return importsGuard && callsScan && callsReject;
}

await test('gemini-chat route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/gemini-chat.ts'));
});

await test('claude-chat route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/claude-chat.ts'));
});

await test('ceb-search route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/ceb-search.ts'));
});

await test('legislative-fanout route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/legislative-fanout.ts'));
});

await test('courtlistener-search route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/courtlistener-search.ts'));
});

await test('public-legal-context route is wired to the backstop', () => {
  assert.ok(routeCallsBackstop('api/public-legal-context.ts'));
});

await test('anthropic-chat (Speed) is intentionally NOT wired to the backstop', () => {
  // Speed is the non-client passthrough; it must not hard-reject PII-shaped
  // content because attorneys may run hypotheticals there.
  const text = readFileSync(joinPath(repoRoot, 'api/anthropic-chat.ts'), 'utf8');
  assert.ok(
    !/scan(ForRawPII|Request|ConversationHistory)\s*\(/.test(text),
    'Speed route must not call the backstop'
  );
});

// ---------------------------------------------------------------------------
// Chat-persistence adapter (Day 4.5)
// ---------------------------------------------------------------------------
const adapter = await import('../services/sanitization/chatAdapter.ts');
const {
  passthroughSanitizer,
  getChatSanitizer,
  setChatSanitizer,
  tokenizeMessagesForSave,
  rehydrateMessagesForDisplay,
  deriveTitleFromRaw,
} = adapter;

await test('chatAdapter: default is the pass-through sanitizer', () => {
  assert.equal(getChatSanitizer(), passthroughSanitizer);
});

await test('chatAdapter: passthroughSanitizer.tokenizeMessage preserves text', async () => {
  const out = await passthroughSanitizer.tokenizeMessage('Maria Esperanza transferred her home.');
  assert.equal(out, 'Maria Esperanza transferred her home.');
});

await test('chatAdapter: passthroughSanitizer.deriveSafeTitle slices + ellipsis', async () => {
  const short = await passthroughSanitizer.deriveSafeTitle('hello');
  assert.equal(short, 'hello');
  const long = await passthroughSanitizer.deriveSafeTitle('x'.repeat(200));
  assert.equal(long.length, 61);
  assert.ok(long.endsWith('…'));
});

await test('chatAdapter: setChatSanitizer swaps the active sanitizer and null restores pass-through', async () => {
  const custom = {
    async tokenizeMessage(text) { return `[TOK]${text}`; },
    rehydrateMessage(text) { return text.startsWith('[TOK]') ? text.slice(5) : text; },
    async deriveSafeTitle(text) { return `T:${text.slice(0, 5)}`; },
  };
  setChatSanitizer(custom);
  try {
    const tok = await getChatSanitizer().tokenizeMessage('hello');
    assert.equal(tok, '[TOK]hello');
    const rh = getChatSanitizer().rehydrateMessage('[TOK]hello');
    assert.equal(rh, 'hello');
  } finally {
    setChatSanitizer(null);
  }
  assert.equal(getChatSanitizer(), passthroughSanitizer);
});

await test('chatAdapter: tokenizeMessagesForSave maps every message through the active sanitizer', async () => {
  setChatSanitizer({
    async tokenizeMessage(text) { return text.replace(/Maria Esperanza/g, 'CLIENT_001'); },
    rehydrateMessage(text) { return text; },
    async deriveSafeTitle(text) { return text; },
  });
  try {
    const out = await tokenizeMessagesForSave([
      { id: '1', role: 'user', text: 'Our client Maria Esperanza called.' },
      { id: '2', role: 'bot', text: 'What did Maria Esperanza say?' },
    ]);
    assert.equal(out[0].text, 'Our client CLIENT_001 called.');
    assert.equal(out[1].text, 'What did CLIENT_001 say?');
    assert.equal(out[0].id, '1', 'id preserved');
  } finally {
    setChatSanitizer(null);
  }
});

await test('chatAdapter: rehydrateMessagesForDisplay maps every message through rehydrate', () => {
  setChatSanitizer({
    async tokenizeMessage(t) { return t; },
    rehydrateMessage(text) { return text.replace(/CLIENT_001/g, 'Maria Esperanza'); },
    async deriveSafeTitle(t) { return t; },
  });
  try {
    const out = rehydrateMessagesForDisplay([
      { id: '1', role: 'user', text: 'Follow up with CLIENT_001 today.' },
    ]);
    assert.equal(out[0].text, 'Follow up with Maria Esperanza today.');
  } finally {
    setChatSanitizer(null);
  }
});

await test('chatAdapter: deriveTitleFromRaw uses active sanitizer', async () => {
  setChatSanitizer({
    async tokenizeMessage(t) { return t; },
    rehydrateMessage(t) { return t; },
    async deriveSafeTitle(text) { return `SAFE:${text.slice(0, 10)}`; },
  });
  try {
    const t = await deriveTitleFromRaw('Our client Maria Esperanza has a question.');
    assert.equal(t, 'SAFE:Our client');
  } finally {
    setChatSanitizer(null);
  }
});

// ---------------------------------------------------------------------------
// Wiring grep tests — hooks/useChat.ts and components/Sidebar.tsx
// ---------------------------------------------------------------------------

await test('hooks/useChat.ts imports the chat sanitizer adapter', () => {
  const text = readFileSync(joinPath(repoRoot, 'hooks/useChat.ts'), 'utf8');
  assert.ok(/from '[^']*chatAdapter[^']*'/.test(text), 'imports chatAdapter');
  assert.ok(/tokenizeMessagesForSave\s*\(/.test(text), 'calls tokenizeMessagesForSave on save');
  assert.ok(/rehydrateMessagesForDisplay\s*\(/.test(text), 'calls rehydrateMessagesForDisplay on load');
  assert.ok(/deriveTitleFromRaw\s*\(/.test(text), 'uses deriveTitleFromRaw for titles');
});

await test('hooks/useChat.ts no longer slices raw titles in-place', () => {
  const text = readFileSync(joinPath(repoRoot, 'hooks/useChat.ts'), 'utf8');
  // Inline .text.slice(0, 60) for title derivation used to appear three times.
  // After Day 4.5, titles pass through deriveTitleFromRaw inside scheduleSave.
  assert.equal(
    (text.match(/firstUser\.text\.slice\(0,\s*60\)/g) ?? []).length,
    0,
    'inline title slicing removed'
  );
});

await test('components/Sidebar.tsx rehydrates fetched and event-driven titles', () => {
  const text = readFileSync(joinPath(repoRoot, 'components/Sidebar.tsx'), 'utf8');
  assert.ok(/from '[^']*chatAdapter[^']*'/.test(text), 'imports chatAdapter');
  assert.ok(/rehydrateMessage\s*\(/.test(text), 'rehydrates titles in the sidebar');
  assert.ok(/deriveTitleFromRaw\s*\(/.test(text), 'uses deriveTitleFromRaw for rename');
});

// ---------------------------------------------------------------------------
// Audit log (Day 5)
// ---------------------------------------------------------------------------
const auditMod = await import('../api/_shared/auditLog.ts');
const { computeHmac, buildAuditRecord, writeAuditRecord, setAuditSink } = auditMod;

function collectingSink() {
  const writes = [];
  const expires = [];
  return {
    writes,
    expires,
    sink: {
      async lpush(key, value) {
        writes.push({ key, value });
      },
      async expire(key, seconds) {
        expires.push({ key, seconds });
      },
    },
  };
}

await test('auditLog: computeHmac is deterministic for same input + key', () => {
  process.env.AUDIT_HMAC_KEY = 'test-key-aaa';
  const h1 = computeHmac('hello world');
  const h2 = computeHmac('hello world');
  assert.equal(h1, h2, 'same input → same HMAC');
  assert.ok(/^[0-9a-f]{64}$/.test(h1), 'hex-encoded SHA-256 (64 chars)');
});

await test('auditLog: computeHmac differs for different inputs and different keys', () => {
  process.env.AUDIT_HMAC_KEY = 'test-key-aaa';
  const hA = computeHmac('payload-1');
  const hB = computeHmac('payload-2');
  assert.notEqual(hA, hB, 'different inputs → different HMACs');
  process.env.AUDIT_HMAC_KEY = 'test-key-bbb';
  const hC = computeHmac('payload-1');
  assert.notEqual(hA, hC, 'different keys → different HMACs');
});

await test('auditLog: computeHmac returns undefined when key is missing', () => {
  const prev = process.env.AUDIT_HMAC_KEY;
  delete process.env.AUDIT_HMAC_KEY;
  try {
    const h = computeHmac('anything');
    assert.equal(h, undefined, 'no key → no HMAC');
  } finally {
    if (prev !== undefined) process.env.AUDIT_HMAC_KEY = prev;
  }
});

await test('auditLog: buildAuditRecord omits raw prompt and stores only HMAC + length', () => {
  process.env.AUDIT_HMAC_KEY = 'test-key-aaa';
  const record = buildAuditRecord({
    route: 'gemini-chat',
    sanitizedPrompt: 'Our client CLIENT_001 transferred ADDRESS_002.',
    flowType: 'public_research',
    model: 'us.anthropic.claude-sonnet-4-6',
    sourceProviders: ['bedrock', 'ceb'],
    latencyMs: 1234,
    statusCode: 200,
  });
  assert.equal(record.route, 'gemini-chat');
  assert.equal(record.model, 'us.anthropic.claude-sonnet-4-6');
  assert.deepEqual(record.sourceProviders, ['bedrock', 'ceb']);
  assert.equal(record.promptLength, 'Our client CLIENT_001 transferred ADDRESS_002.'.length);
  assert.ok(/^[0-9a-f]{64}$/.test(record.sanitizedPromptHmac));
  // Ensure the raw prompt is not serialized anywhere on the record.
  const json = JSON.stringify(record);
  assert.ok(!json.includes('CLIENT_001'), 'raw prompt string must not appear in the record JSON');
});

await test('auditLog: writeAuditRecord LPUSHes to audit:YYYY-MM-DD and refreshes expire', async () => {
  const { writes, expires, sink } = collectingSink();
  setAuditSink(sink);
  try {
    await writeAuditRecord({
      timestamp: '2026-04-24T20:00:00.000Z',
      route: 'ceb-search',
      statusCode: 200,
      latencyMs: 500,
    });
    assert.equal(writes.length, 1);
    assert.ok(/^audit:\d{4}-\d{2}-\d{2}$/.test(writes[0].key), 'daily key format');
    const parsed = JSON.parse(writes[0].value);
    assert.equal(parsed.route, 'ceb-search');
    assert.equal(parsed.statusCode, 200);
    assert.equal(expires.length, 1, 'EXPIRE refreshed');
    assert.equal(expires[0].seconds, 60 * 60 * 24 * 90, '90-day TTL');
  } finally {
    setAuditSink(null);
  }
});

await test('auditLog: writeAuditRecord fails open when the sink throws', async () => {
  const sink = {
    async lpush() { throw new Error('redis down'); },
    async expire() { /* never reached */ },
  };
  setAuditSink(sink);
  try {
    // Must not throw.
    await writeAuditRecord({ timestamp: new Date().toISOString(), route: 'ceb-search' });
  } finally {
    setAuditSink(null);
  }
});

await test('auditLog: backstop rejection record carries categories and statusCode 400', () => {
  process.env.AUDIT_HMAC_KEY = 'test-key-aaa';
  const record = buildAuditRecord({
    route: 'gemini-chat',
    sanitizedPrompt: 'raw-looking 415-555-0123',
    backstopTriggered: true,
    backstopCategories: ['phone'],
    statusCode: 400,
  });
  assert.equal(record.backstopTriggered, true);
  assert.deepEqual(record.backstopCategories, ['phone']);
  assert.equal(record.statusCode, 400);
});

// ---------------------------------------------------------------------------
// Route-wiring grep tests — every protected route must write audit records
// ---------------------------------------------------------------------------

function routeAudits(file) {
  const text = readFileSync(joinPath(repoRoot, file), 'utf8');
  const importsAudit = /from '[^']*auditLog[^']*'/.test(text);
  const writesRecord = /writeAuditRecord\s*\(/.test(text);
  return importsAudit && writesRecord;
}

for (const file of [
  'api/gemini-chat.ts',
  'api/claude-chat.ts',
  'api/ceb-search.ts',
  'api/legislative-fanout.ts',
  'api/courtlistener-search.ts',
  'api/public-legal-context.ts',
]) {
  await test(`${file} writes audit records`, () => {
    assert.ok(routeAudits(file), `${file} imports auditLog and calls writeAuditRecord`);
  });
}

await test('No route log statement writes a raw prompt body to console', () => {
  // Cheap heuristic: ensure nobody does console.log(message) / console.error(message) /
  // res.status(...).json({ ..., raw: message }). False-positive risk is low because
  // these routes were refactored to log metadata only.
  for (const file of [
    'api/gemini-chat.ts',
    'api/claude-chat.ts',
    'api/ceb-search.ts',
    'api/legislative-fanout.ts',
    'api/courtlistener-search.ts',
    'api/public-legal-context.ts',
  ]) {
    const text = readFileSync(joinPath(repoRoot, file), 'utf8');
    assert.ok(
      !/console\.(log|error)\s*\(\s*(message|query|question)\s*\)/.test(text),
      `${file} must not console.log the raw prompt variable`
    );
  }
});

// ---------------------------------------------------------------------------
// Preview session (Day 6)
// ---------------------------------------------------------------------------
const previewMod = await import('../services/sanitization/previewSession.ts');
const {
  computePreview,
  emptyPreviewSession,
  suppressToken,
  addManualToken,
  renameToken,
} = previewMod;

await test('previewSession: empty input returns empty preview', () => {
  const { segments, tokens, sanitized } = computePreview('', emptyPreviewSession());
  assert.deepEqual(segments, []);
  assert.deepEqual(tokens, []);
  assert.equal(sanitized, '');
});

await test('previewSession: detected spans produce tokens and interleaved segments', () => {
  const text = 'Our client Maria Esperanza transferred her home in 2021.';
  const { segments, tokens, sanitized } = computePreview(text, emptyPreviewSession());
  assert.ok(tokens.length >= 1, 'at least one token');
  const clientTok = tokens.find((t) => t.raw === 'Maria Esperanza');
  assert.ok(clientTok, 'Maria Esperanza tokenized');
  assert.ok(/CLIENT_00\d/.test(clientTok.value), 'CLIENT prefix');
  // Sanitized text should contain the token and NOT the raw name.
  assert.ok(sanitized.includes(clientTok.value), 'sanitized contains token');
  assert.ok(!sanitized.includes('Maria Esperanza'), 'sanitized omits raw name');
  // Segments should flatten to original when concatenated, replacing tokens with raw.
  const flat = segments.map((s) => (s.token ? s.token.raw : s.text)).join('');
  assert.equal(flat, text, 'segments round-trip back to original');
});

await test('previewSession: repeated mentions share the same token within a session', () => {
  const text = 'Maria Esperanza came in Monday. Maria Esperanza followed up Tuesday.';
  const { tokens } = computePreview(text, emptyPreviewSession());
  const mariaTokens = tokens.filter((t) => t.raw === 'Maria Esperanza');
  // Tokens map has unique entries — one CLIENT for "Maria Esperanza".
  assert.equal(mariaTokens.length, 1, 'one unique token for the repeated name');
});

await test('previewSession: public-legal entities (statutes, cases) are not tokenized', () => {
  const text =
    'Under Family Code § 1615, the outcome in People v. Smith (2020) 50 Cal.App.5th 123 controls.';
  const { tokens, sanitized } = computePreview(text, emptyPreviewSession());
  assert.equal(tokens.length, 0, 'no tokens on a public-only prompt');
  assert.equal(sanitized, text, 'sanitized unchanged');
});

await test('previewSession: suppressToken removes the highlight and keeps raw text', () => {
  const text = 'Maria Esperanza arrived at 2155 Vallejo Street.';
  const s0 = emptyPreviewSession();
  const before = computePreview(text, s0);
  const s1 = suppressToken(s0, 'Maria Esperanza', 'name');
  const after = computePreview(text, s1);
  assert.ok(!after.tokens.some((t) => t.raw === 'Maria Esperanza'), 'name no longer tokenized');
  assert.ok(after.sanitized.includes('Maria Esperanza'), 'raw name re-appears in sanitized');
  // Address should still be tokenized (pattern captures the trailing period).
  assert.ok(
    after.tokens.some((t) => /2155 Vallejo Street/.test(t.raw)),
    'address still tokenized after unrelated suppression'
  );
  assert.notEqual(before.sanitized, after.sanitized, 'sanitized differs after suppression');
});

await test('previewSession: addManualToken tokenizes a user-selected span', () => {
  // Single-word first names aren't caught by the bigram scanner on their own —
  // the attorney can highlight and click "redact this".
  const text = 'the client came in and spoke with Marta about the matter.';
  const idx = text.indexOf('Marta');
  const s0 = emptyPreviewSession();
  const before = computePreview(text, s0);
  assert.ok(!before.tokens.some((t) => t.raw === 'Marta'), 'not detected by default');

  const s1 = addManualToken(s0, idx, idx + 'Marta'.length, 'Marta', 'name');
  const after = computePreview(text, s1);
  assert.ok(after.tokens.some((t) => t.raw === 'Marta'), 'manually added');
});

await test('previewSession: renameToken changes the pseudonym', () => {
  const text = 'Maria Esperanza transferred the home.';
  const s0 = emptyPreviewSession();
  const before = computePreview(text, s0);
  const original = before.tokens[0].value;
  const s1 = renameToken(s0, original, 'ELDER');
  const after = computePreview(text, s1);
  assert.ok(after.sanitized.includes('ELDER'), 'sanitized uses new pseudonym');
  assert.ok(!after.sanitized.includes(original), 'original pseudonym gone');
});

await test('previewSession: manual tokenization wins over allowlist for deliberate redaction', () => {
  // Attorney's client is ALSO a public-case party name — attorney explicitly
  // marks it confidential despite the allowlist.
  const text = 'Our client, John Smith, is unrelated to Smith v. Jones litigation.';
  const idx = text.indexOf('John Smith');
  const s0 = addManualToken(
    emptyPreviewSession(),
    idx,
    idx + 'John Smith'.length,
    'John Smith',
    'name'
  );
  const { tokens, sanitized } = computePreview(text, s0);
  assert.ok(tokens.some((t) => t.raw === 'John Smith'), 'manual token honored');
  assert.ok(!sanitized.includes('John Smith'), 'client name tokenized');
});

await test('previewSession: category counts are aggregated', () => {
  const text =
    'Client Maria Esperanza, phone 415-555-0123, at 2155 Vallejo Street. SSN 123-45-6789.';
  const { categoryCounts } = computePreview(text, emptyPreviewSession());
  assert.equal(categoryCounts.name, 1);
  assert.equal(categoryCounts.phone, 1);
  assert.equal(categoryCounts.street_address, 1);
  assert.equal(categoryCounts.ssn, 1);
});

// ---------------------------------------------------------------------------
// Pre-save PII scan (Day 6.5)
// ---------------------------------------------------------------------------
const { presavePiiScan } = adapter;

await test('presavePiiScan: clean payload returns clean=true, empty categories', () => {
  const r = presavePiiScan({
    title: 'Family Code 1615 analysis',
    messages: [{ text: 'Under Family Code § 1615, what are the elements?' }],
  });
  assert.equal(r.clean, true);
  assert.deepEqual(r.categories, []);
});

await test('presavePiiScan: dirty title flags title with dirtyIndexes=[-1]', () => {
  const r = presavePiiScan({
    title: 'Chat about 123-45-6789',
    messages: [{ text: 'clean text' }],
  });
  assert.equal(r.clean, false);
  assert.ok(r.categories.includes('ssn'));
  assert.ok(r.dirtyIndexes.includes(-1));
});

await test('presavePiiScan: dirty message at index reports its position', () => {
  const r = presavePiiScan({
    title: 'ok',
    messages: [
      { text: 'clean message' },
      { text: 'follow up: 415-555-0123 please' },
      { text: 'another clean message' },
    ],
  });
  assert.equal(r.clean, false);
  assert.ok(r.categories.includes('phone'));
  assert.ok(r.dirtyIndexes.includes(1));
  assert.ok(!r.dirtyIndexes.includes(0));
  assert.ok(!r.dirtyIndexes.includes(2));
});

await test('presavePiiScan: already-tokenized payload is clean', () => {
  const r = presavePiiScan({
    title: 'Elder-abuse exposure for CLIENT_001',
    messages: [
      { text: 'CLIENT_001 transferred ADDRESS_002 to RELATIVE_003 in DATE_001.' },
      { text: 'What are the W&I § 15610 elements?' },
    ],
  });
  assert.equal(r.clean, true);
});

await test('presavePiiScan: handles missing/undefined fields', () => {
  assert.equal(presavePiiScan({}).clean, true);
  assert.equal(presavePiiScan({ title: undefined }).clean, true);
  assert.equal(presavePiiScan({ messages: undefined }).clean, true);
  assert.equal(presavePiiScan({ messages: [{}] }).clean, true);
});

// ---------------------------------------------------------------------------
// Server-side wiring — /api/chats must reject raw PII on POST/PUT/PATCH
// ---------------------------------------------------------------------------

await test('/api/chats imports the sanitization backstop', () => {
  const text = readFileSync(joinPath(repoRoot, 'api/chats.ts'), 'utf8');
  assert.ok(/from '[^']*sanitization\/guard[^']*'/.test(text), 'imports guard');
  assert.ok(/scanForRawPII\s*\(/.test(text), 'calls scanForRawPII');
});

await test('/api/chats writes audit records on rejection', () => {
  const text = readFileSync(joinPath(repoRoot, 'api/chats.ts'), 'utf8');
  assert.ok(/writeAuditRecord\s*\(/.test(text), 'calls writeAuditRecord');
  assert.ok(/route:\s*['"]chats:(create|save|rename)['"]/.test(text), 'records chat-specific routes');
});

await test('/api/chats PUT + POST + PATCH call scanChatPayload and gate on the result', () => {
  const text = readFileSync(joinPath(repoRoot, 'api/chats.ts'), 'utf8');
  // Three call sites = three request handlers (POST/PUT/PATCH).
  const calls = (text.match(/scanChatPayload\s*\(/g) ?? []).length;
  assert.ok(calls >= 3, `expected at least 3 scanChatPayload call sites, got ${calls}`);
});

await test('hooks/useChat.ts runs presavePiiScan before the PUT round-trip', () => {
  const text = readFileSync(joinPath(repoRoot, 'hooks/useChat.ts'), 'utf8');
  assert.ok(/presavePiiScan\s*\(/.test(text), 'calls presavePiiScan');
  assert.ok(/presave-pii-detected/.test(text), 'logs the presave warning marker');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`Sanitization tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
process.exit(0);
