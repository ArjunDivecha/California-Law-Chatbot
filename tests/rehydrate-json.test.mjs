/**
 * tests/rehydrate-json.test.mjs
 *
 * Regression test for the 2026-08-17 Draft-page failure: every proposal
 * request returned "The reply could not be read as a list of changes."
 * Cause — rehydration substituted RAW client values into the model's JSON
 * text; a value containing a double quote (a trust named `... ("the Trust")`)
 * or a newline corrupted the JSON, so parsing failed on a perfectly good
 * model response. Fix: for JSON payloads, parse first and rehydrate each
 * string leaf, then re-serialize.
 *
 * This test pins the semantics of that helper (mirrored from
 * hooks/useV2AgentStream.ts — keep in lockstep).
 *
 * Input files:  none
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/rehydrate-json.test.mjs
 */

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log(`✅ ${name}`); }
  else { failed += 1; console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

// Token map with values that are hostile to naive substitution.
const MAP = new Map([
  ['CLIENT_001', 'ARJUN B. DIVECHA'],
  ['CLIENT_003', 'Divecha Revocable Trust dated December 7, 2012 ("the Trust")'],
  ['CLIENT_004', 'Successor Executors'],
  ['CLIENT_005', 'Line one\nLine two'],
  ['CLIENT_006', 'Back\\slash Name'],
]);
const sanitizer = {
  rehydrateMessage: (text) => {
    let out = text;
    for (const [tok, raw] of MAP) out = out.split(tok).join(raw);
    return out;
  },
};

// Mirror of rehydrateMaybeJson in hooks/useV2AgentStream.ts.
function rehydrateMaybeJson(s, text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return s.rehydrateMessage(text);
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return s.rehydrateMessage(text); }
  const walk = (v) => {
    if (typeof v === 'string') return s.rehydrateMessage(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  try { return JSON.stringify(walk(parsed)); } catch { return s.rehydrateMessage(text); }
}

// ---------- the production failure ----------
const modelJson = JSON.stringify({
  changes: [
    {
      section: 'ARTICLE FIVE: CLIENT_004',
      description: 'Change the successor executor named in CLIENT_003',
      rationale: 'Per instruction from CLIENT_001',
      find: 'I appoint Zai Divecha as my Successor Executor.',
      replace: 'I appoint Kiran Divecha as my Successor Executor.',
    },
  ],
});

// Naive substitution (the old behavior) must be shown to break...
let naive = modelJson;
for (const [tok, raw] of MAP) naive = naive.split(tok).join(raw);
let naiveBroke = false;
try { JSON.parse(naive); } catch { naiveBroke = true; }
check('old behavior demonstrably corrupts JSON (quote in value)', naiveBroke);

// ...and the fix must keep it parseable with values restored.
const fixed = rehydrateMaybeJson(sanitizer, modelJson);
let parsed = null;
try { parsed = JSON.parse(fixed); } catch { /* stays null */ }
check('fixed output still parses', parsed !== null, fixed.slice(0, 120));
check('token in section rehydrated', parsed?.changes?.[0]?.section === 'ARTICLE FIVE: Successor Executors');
check('quote-bearing value rehydrated intact', parsed?.changes?.[0]?.description.includes('("the Trust")'));
check('non-token fields untouched', parsed?.changes?.[0]?.find === 'I appoint Zai Divecha as my Successor Executor.');

// ---------- other hostile values ----------
const nl = rehydrateMaybeJson(sanitizer, JSON.stringify({ changes: [{ section: 'CLIENT_005', find: 'x', replace: 'y' }] }));
check('newline-bearing value survives', JSON.parse(nl).changes[0].section === 'Line one\nLine two');
const bs = rehydrateMaybeJson(sanitizer, JSON.stringify({ changes: [{ section: 'CLIENT_006' }] }));
check('backslash-bearing value survives', JSON.parse(bs).changes[0].section === 'Back\\slash Name');

// ---------- plain text unaffected ----------
const prose = rehydrateMaybeJson(sanitizer, 'The successor for CLIENT_001 is unchanged.');
check('plain prose rehydrates as before', prose === 'The successor for ARJUN B. DIVECHA is unchanged.');
const notJson = rehydrateMaybeJson(sanitizer, '{ this is not json, CLIENT_004 }');
check('brace-prefixed non-JSON falls back to direct substitution', notJson.includes('Successor Executors'));

console.log(`\nRehydrate JSON: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
