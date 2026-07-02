/*
 * =============================================================================
 * userAllowlistGuard.test.ts — server-backstop honors the user allowlist,
 * but never for catastrophic categories.
 * =============================================================================
 *
 * Proves the fix for the reported wire-guard block: an attorney who marks a
 * (public) date "not privileged" can send it raw, while an SSN can NEVER be
 * allowlisted past the guard. Exercises detectPiiServerBackstop directly (the
 * same allowlist + NEVER_ALLOWLISTABLE logic the browser wire-guard uses).
 *
 * INPUT/OUTPUT FILES: none. RUN: ./node_modules/.bin/tsx tests/userAllowlistGuard.test.ts
 * =============================================================================
 */
import { detectPiiServerBackstop } from '../services/sanitization/detectionPipeline.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exitCode = 1; throw new Error(msg); }
  console.log(`  ok: ${msg}`);
}

const dateText = 'On December 11, 2025, the Secretary of State chaptered the bill.';
const ssnText = 'The client SSN is 123-45-6789 per the intake form.';

// 1. A date is detected when nothing is allowlisted (default privacy-first).
const noAllow = detectPiiServerBackstop(dateText);
assert(noAllow.spans.some((s) => s.category === 'date'), 'date is flagged without an allowlist');

// 2. The same date is suppressed once the attorney allowlists it.
const withDate = detectPiiServerBackstop(dateText, new Set(['december 11, 2025']));
assert(!withDate.spans.some((s) => s.category === 'date'), 'allowlisted date is suppressed server-side');

// 3. An SSN is flagged...
const ssn = detectPiiServerBackstop(ssnText);
assert(ssn.spans.some((s) => s.category === 'ssn'), 'SSN is flagged');

// 4. ...and STILL flagged even if the attorney tries to allowlist it
//    (catastrophic categories are NEVER allowlistable — no SSN bypass).
const ssnAllow = detectPiiServerBackstop(ssnText, new Set(['123-45-6789']));
assert(ssnAllow.spans.some((s) => s.category === 'ssn'), 'SSN still blocked even when allowlisted (never-allowlistable)');

console.log('\nuserAllowlistGuard: ALL CHECKS PASSED');
