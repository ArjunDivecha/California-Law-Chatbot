/**
 * Phase 2 placeholder — Drafting Magic section-state primitives.
 *
 * Tests in tests/sanitization.test.mjs (Drafting Magic section edits / lock /
 * regeneration) import these functions. Until Phase 2 ports the real
 * implementation, the stubs throw so dependent tests fail loudly with a
 * known-cause message instead of silent assertion mismatches.
 *
 * Real implementation lives on `codex/drafting-magic-sanitized` at this same
 * path. The runner-completion stub here exists only so the test file's
 * top-level `await import(...)` doesn't crash the entire suite.
 */

const NOT_IMPLEMENTED = 'Phase 2 deliverable — see codex/drafting-magic-sanitized for reference impl';

export function markSectionEdited(..._args: unknown[]): never {
  throw new Error(`draftSectionState.markSectionEdited: ${NOT_IMPLEMENTED}`);
}

export function mergeGeneratedDraftSections(..._args: unknown[]): never {
  throw new Error(`draftSectionState.mergeGeneratedDraftSections: ${NOT_IMPLEMENTED}`);
}

export function replaceDraftSectionFromGenerated(..._args: unknown[]): never {
  throw new Error(`draftSectionState.replaceDraftSectionFromGenerated: ${NOT_IMPLEMENTED}`);
}

export function toggleSectionLock(..._args: unknown[]): never {
  throw new Error(`draftSectionState.toggleSectionLock: ${NOT_IMPLEMENTED}`);
}
