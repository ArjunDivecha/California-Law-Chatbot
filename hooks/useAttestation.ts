/**
 * Phase 4 / §Y placeholder — confidentiality attestation hook.
 *
 * Tests in tests/sanitization.test.mjs reference `_internals` (storageKey,
 * readAttestation, writeAttestation) and `ATTESTATION_VERSION`. Until the
 * real hook ships with the §Y per-session attestation generator (Phase 4
 * UI integration), this stub satisfies the dynamic import so the test
 * runner completes. The dependent tests fail loudly with a known-cause
 * message instead of silent assertion mismatches.
 *
 * Real implementation lives on `codex/drafting-magic-sanitized` at this
 * same path.
 */

const NOT_IMPLEMENTED = 'Phase 4 / §Y deliverable — see codex/drafting-magic-sanitized for reference impl';

export const ATTESTATION_VERSION = 0;

function notImplemented(method: string): never {
  throw new Error(`useAttestation._internals.${method}: ${NOT_IMPLEMENTED}`);
}

export const _internals = {
  storageKey: (..._args: unknown[]): never => notImplemented('storageKey'),
  readAttestation: (..._args: unknown[]): never => notImplemented('readAttestation'),
  writeAttestation: (..._args: unknown[]): never => notImplemented('writeAttestation'),
};

export function useAttestation(..._args: unknown[]): never {
  throw new Error(`useAttestation: ${NOT_IMPLEMENTED}`);
}
