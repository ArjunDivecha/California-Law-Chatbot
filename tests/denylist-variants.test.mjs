/**
 * tests/denylist-variants.test.mjs
 *
 * Regression tests for the 2026-08-17 privileged-name leak: a denylist
 * entry "First Last" failed to match "FIRST MIDDLE LAST" (OCR all-caps with
 * middle name) and "First Last_Suffix" (filename separators), so a client's
 * name reached the model raw. findUserDenylistSpans must catch these
 * variants; over-matching is acceptable, under-matching is not.
 *
 * Input files:  none (localStorage stubbed)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/denylist-variants.test.mjs
 */

// Stub browser localStorage before importing the module under test.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  },
  dispatchEvent: () => true,
};

const { findUserDenylistSpans, addToUserDenylist } = await import('../services/sanitization/userDenylist.ts');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log(`✅ ${name}`); }
  else { failed += 1; console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
const covers = (text, needle) => {
  const spans = findUserDenylistSpans(text);
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  return spans.some((s) => s.start <= i && s.end >= i + needle.length);
};

addToUserDenylist('Arjun Divecha');
addToUserDenylist('Fresno');

// ---------- the production leak shapes ----------
check('exact name still matches', covers('client Arjun Divecha appeared', 'Arjun Divecha'));
check('OCR all-caps with middle name', covers('holder: ARJUN BHAGWAN DIVECHA is the owner', 'ARJUN BHAGWAN DIVECHA'));
check('middle name, normal case', covers('Arjun Bhagwan Divecha owns the shares', 'Arjun Bhagwan Divecha'));
check('middle initial', covers('Arjun B. Divecha signed', 'Arjun B. Divecha'));
check('filename with underscores', covers('ATTACHED DOCUMENT: Arjun Bhagwan Divecha_Kalpen_ShareCertificate.pdf', 'Arjun Bhagwan Divecha'));
check('underscore-joined pair', covers('file Arjun_Divecha_notes.txt', 'Arjun_Divecha'));
check('hyphen separators', covers('arjun-divecha-agreement.docx', 'arjun-divecha'));

// ---------- must NOT match (boundaries) ----------
check('no match inside larger word', findUserDenylistSpans('Karjun Divechab').length === 0);
check('unrelated text clean', findUserDenylistSpans('The settlement agreement between the parties.').length === 0);
check('two intervening words do NOT bridge', !covers('Arjun and also Divecha met', 'Arjun and also Divecha'));

// ---------- single-word terms keep exact semantics ----------
check('single word exact', covers('moved to Fresno last year', 'Fresno'));
check('single word not substring', findUserDenylistSpans('Fresnoville').length === 0);

console.log(`\nDenylist variants: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
