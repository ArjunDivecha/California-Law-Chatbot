# Drafting Magic + Sanitization Execution Plan

**Date:** April 26, 2026  
**Base branch:** `codex/bedrock-confidentiality-migration`  
**Feature branch to integrate:** `codex/drafting-magic`  
**Recommended integration branch:** `codex/drafting-magic-sanitized`  
**Status:** Execution-ready plan; implementation not started in this document.

---

## 1. Objective

Build Drafting Magic into the existing confidentiality architecture so attorneys can ingest estate-planning packets, compare documents, generate a drafting plan, and produce a rehydrated draft while preserving the Phase 6 rule:

> Raw client-identifying facts and raw confidential document text must not leave the attorney's browser. Cloud APIs, retrieval providers, Vercel functions, Bedrock, Upstash, and Blob storage may see tokenized content only.

The Drafting Magic prototype currently proves the product workflow locally. The confidentiality branch currently provides the sanitizer, token store, rehydration, server backstop, audit logging, and Bedrock flow policy. This plan merges the two safely and then replaces local prototype-only drafting logic with a tokenized production path.

---

## 2. Source Of Truth Branches And Worktrees

| Purpose | Branch | Worktree |
|---|---|---|
| Confidentiality architecture | `codex/bedrock-confidentiality-migration` | `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-bedrock-confidentiality` |
| Drafting Magic prototype | `codex/drafting-magic` | `/Users/arjundivecha/Dropbox/AAA Backup/A Working/Drafting Magic` |
| Integration target | `codex/drafting-magic-sanitized` | new worktree recommended |

Recommended setup:

```bash
cd '/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot'
git fetch origin
git worktree add '../California-Law-Chatbot-drafting-magic-sanitized' codex/bedrock-confidentiality-migration
cd '../California-Law-Chatbot-drafting-magic-sanitized'
git switch -c codex/drafting-magic-sanitized
git merge codex/drafting-magic
```

Do not perform the merge inside the currently dirty confidentiality worktree unless the unrelated files are first intentionally handled. At the time this plan was written, the confidentiality worktree had local modifications/untracked files unrelated to Drafting Magic.

---

## 3. Non-Negotiable Requirements

1. **No raw source document text leaves the browser.**
   - Trusts, pour-over wills, AHCDs, financial POAs, prenups, attorney notes, client instructions, and uploaded file text must be tokenized before any network request.

2. **No raw Drafting Magic workspace in plain localStorage.**
   - The prototype stores source `excerpt` text in localStorage. Production must remove or replace this.

3. **Token maps never cross the network.**
   - The token-to-raw map stays in browser IndexedDB, encrypted by the existing sanitizer store.

4. **Cloud generation uses tokenized payloads only.**
   - Drafting Magic generation must use the Accuracy/client-safe flow and Bedrock path. No Speed passthrough.

5. **Server backstop is mandatory.**
   - Every Drafting Magic API route must run `scanRequest` or `scanForRawPII` before retrieval, generation, persistence, or audit.

6. **Rehydration happens only in the browser.**
   - Comparison rows, drafting plans, generated drafts, review checklists, and exports may be displayed rehydrated in the attorney's browser, but stored/sent versions remain tokenized.

7. **Fail closed.**
   - If the sanitizer store, OPF daemon, IndexedDB, or required tokenization path is unavailable, cloud analyze/generate/export-to-server actions are disabled.

8. **No console/log leakage.**
   - Drafting Magic APIs must never log raw or tokenized document payloads. Audit records store HMAC and metadata only.

---

## 4. Existing Code To Reuse

### Sanitization Branch

| Area | Files |
|---|---|
| Analyzer and tokenization | `api/_shared/sanitization/index.ts`, `patterns.ts`, `detectNames.ts`, `allowlist.ts`, `tokenize.ts` |
| Encrypted local token store | `api/_shared/sanitization/store.ts`, `crypto.ts` |
| OPF/local detector | `services/sanitization/opfClient.ts`, `detectionPipeline.ts` |
| Runtime sanitizer adapter | `services/sanitization/chatAdapter.ts`, `realSanitizer.ts` |
| Provider and status UI | `hooks/useSanitizer.tsx`, `components/ComposerPreview.tsx`, `components/TokenStoreModal.tsx`, `components/ConfidentialityAttestation.tsx` |
| Server guard | `api/_shared/sanitization/guard.ts` |
| Flow policy | `api/_shared/flowPolicy.ts` |
| Bedrock generator | `api/_shared/anthropicBedrock.ts`, `bedrockModels.ts` |
| Audit logging | `api/_shared/auditLog.ts` |
| Tests | `tests/sanitization.test.mjs`, `tests/confidentiality.test.mjs`, `tests/goldSetValidation.test.mjs` |

### Drafting Magic Branch

| Area | Files |
|---|---|
| Product page | `components/draftingMagic/DraftingMagicPage.tsx` |
| Browser extraction | `components/draftingMagic/fileTextExtraction.ts` |
| Local comparison prototype | `components/draftingMagic/localExtraction.ts` |
| Local draft generation prototype | `components/draftingMagic/localDraftGeneration.ts` |
| Routes/header/sidebar | `App.tsx`, `components/ModeSelector.tsx`, `components/Sidebar.tsx`, `types.ts` |
| Product PRD | `docs/PRD_DRAFTING_MAGIC.md` |

---

## 5. Target Architecture

### Browser

1. Attorney uploads or pastes source documents.
2. Browser extracts text locally from TXT/MD/DOCX/text PDF.
3. Browser runs Drafting Magic document sanitizer:
   - OPF/local detection
   - token assignment through existing encrypted IndexedDB store
   - tokenized text creation
   - token category counts
   - document-level confidence/status
4. Browser stores either:
   - tokenized workspace only in localStorage, or
   - raw workspace encrypted in IndexedDB/WebCrypto.
5. Browser sends tokenized workspace payloads to Drafting Magic APIs.
6. Browser receives tokenized comparison/draft/checklist.
7. Browser rehydrates for display and local export only.

### Server

1. Drafting Magic API receives tokenized payload with `flow: 'accuracy_client'`.
2. Server validates flow with `enforceFlow(..., ACCURACY_ALLOWED)`.
3. Server runs deterministic backstop on every text field that came from the attorney/browser.
4. Server optionally performs retrieval using tokenized/public legal terms only.
5. Server calls Bedrock only.
6. Server returns tokenized structured JSON.
7. Server writes audit metadata only.

### Storage

| Data | Storage | Raw or tokenized |
|---|---|---|
| Token map | Browser IndexedDB encrypted store | Raw encrypted locally only |
| Drafting Magic local workspace | Local tokenized JSON or encrypted IndexedDB | Tokenized or encrypted raw |
| Saved workspace, if server-backed | Vercel Blob/Upstash | Tokenized only |
| Audit | Upstash Redis/S3 later | HMAC + metadata only |
| Generated draft export | Browser download | Rehydrated locally at download time |

---

## 6. Implementation Phases

## Phase 0: Branch Integration And Conflict Resolution

**Goal:** Merge Drafting Magic onto the confidentiality branch without losing the sanitizer shell.

### Tasks

1. Create `codex/drafting-magic-sanitized` from `codex/bedrock-confidentiality-migration`.
2. Merge `codex/drafting-magic`.
3. Resolve expected conflicts:
   - `App.tsx`
   - `components/Sidebar.tsx`
   - `components/ModeSelector.tsx`
   - `types.ts`
   - `package.json`
   - `yarn.lock`
   - `package-lock.json`
   - `.yarn/install-state.gz`
4. Preserve from confidentiality branch:
   - `SanitizerProvider`
   - `DaemonGate`
   - `ConfidentialityAttestation`
   - `SanitizationBanner`
   - `TokenStoreModal`
   - existing route protection
5. Add from Drafting Magic branch:
   - `/drafting-magic`
   - `/drafting-magic-preview` if we still want unauthenticated design preview
   - Mode selector option
   - Sidebar shortcut
   - `components/draftingMagic/*`
   - `docs/PRD_DRAFTING_MAGIC.md`
6. Decide preview route posture:
   - Option A: keep `/drafting-magic-preview` public for UI mock only, with samples and no real uploads.
   - Option B: remove public preview because Drafting Magic is confidential by nature.
   - Recommended: keep preview only if it hard-disables upload/paste and labels itself as sample-only.

### Acceptance Criteria

- App builds with both sanitizer shell and Drafting Magic routes.
- Signed-in `/drafting-magic` shows the sanitizer banner/status.
- Drafting Magic can be opened from header and sidebar.
- Existing research chat still works.
- Existing tests still pass.

### Validation

```bash
npm run build
npm run test:sanitization
npm run test:confidentiality
npm run test:goldset
```

---

## Phase 1: Shared Document Sanitization Service

**Goal:** Create a reusable sanitizer path for multi-document drafting, not just chat messages.

### New File

`services/sanitization/documentSanitizer.ts`

### API Shape

```ts
export interface SanitizedDocumentInput {
  id: string;
  role: 'Trust' | 'Pour-over will' | 'Advance directive' | 'Financial POA' | 'Prenup' | 'Other';
  name: string;
  text: string;
}

export interface SanitizedDocument {
  id: string;
  role: string;
  name: string;
  sanitizedText: string;
  tokenCategoryCounts: Record<string, number>;
  usedOpf: boolean;
  opfElapsedMs: number | null;
  status: 'sanitized' | 'needs_review' | 'blocked';
  warnings: string[];
}

export async function sanitizeDocument(input: SanitizedDocumentInput): Promise<SanitizedDocument>;
export async function sanitizeDocumentBatch(inputs: SanitizedDocumentInput[]): Promise<SanitizedDocument[]>;
export function rehydrateDraftingText(text: string): string;
```

### Implementation Notes

- Use the same store installed by `SanitizerProvider`.
- Prefer OPF detection through `RealChatSanitizer.tokenizeMessageWithDetection`.
- If OPF falls back to heuristic detection, mark `status: 'needs_review'` unless current product policy allows heuristic-only drafting.
- If sanitizer is unavailable, return `status: 'blocked'`.
- Keep token category counts for audit and UI.

### Acceptance Criteria

- Five source documents can be sanitized in one batch.
- Same name across trust/prenup/POA receives the same token.
- Rehydration restores display text in browser.
- Token maps are not serialized into workspace payloads.

### Tests

Add to `tests/sanitization.test.mjs` or a new `tests/draftingMagicSanitization.test.mjs`:

- Same entity across five docs gets stable token.
- Raw name does not appear in sanitized batch.
- Rehydrated batch contains original synthetic names.
- Sanitizer unavailable returns blocked status.

---

## Phase 2: Workspace Data Model Rewrite

**Goal:** Replace raw prototype workspace persistence with a confidentiality-safe workspace model.

### Current Risk

`DraftingMagicPage.tsx` currently stores `sources[].excerpt` and generated outputs in `localStorage` under:

```ts
drafting-magic:estate-workspace:v1
```

That can include raw trust/prenup/POA text.

### New Data Model

```ts
interface DraftingMagicSource {
  id: string;
  role: SourceRole;
  displayName: string;
  originalFileName?: string;
  format: string;
  included: boolean;
  base: boolean;
  status: 'empty' | 'extracting' | 'needs_sanitization' | 'sanitized' | 'needs_review' | 'blocked';

  // Local display only, never persisted to server.
  rawTextTransient?: string;

  // Safe to persist or send.
  sanitizedText?: string;
  tokenCategoryCounts?: Record<string, number>;
  usedOpf?: boolean;
  opfElapsedMs?: number | null;
  warnings?: string[];
}

interface DraftingMagicWorkspaceSnapshot {
  version: 2;
  savedAt: string;
  activeTab: WorkflowTab;
  sources: Omit<DraftingMagicSource, 'rawTextTransient'>[];
  attorneyUpdateSanitized: string;
  strategy: DraftingMagicStrategy;
  rows: SanitizedComparisonRow[];
  draftSections: SanitizedDraftSection[];
  complianceItems: SanitizedComplianceItem[];
}
```

### Tasks

1. Bump workspace storage key to `drafting-magic:estate-workspace:v2`.
2. Stop writing raw text to localStorage.
3. Keep raw extracted text in React state only until sanitized.
4. On refresh, restore tokenized workspace and rehydrate display from local token map.
5. Add migration behavior:
   - If a v1 raw workspace is found, do not silently load it.
   - Show a one-time warning and offer "Clear old workspace".
6. Update export:
   - `Export secure workspace` exports tokenized JSON only.
   - `Export rehydrated draft` generates local DOCX/HTML later and never uploads raw text.

### Acceptance Criteria

- Browser localStorage never contains synthetic raw names after creating a Drafting Magic workspace.
- Refresh restores tokenized workspace and rehydrates display if local token map exists.
- New device or cleared token map shows tokens rather than raw names.

### Tests

- Playwright: paste synthetic estate packet, sanitize, refresh, inspect localStorage and assert raw names absent.
- Unit: workspace snapshot serializer omits `rawTextTransient`.

---

## Phase 3: Drafting Magic Sanitized UI

**Goal:** Make sanitization visible and controllable at the document level.

### UI Changes

1. Add a "Confidentiality" band to Drafting Magic header:
   - OPF status
   - token count
   - documents sanitized count
   - blocked/needs-review count
2. Add per-source status:
   - `Extracted`
   - `Sanitized`
   - `Needs review`
   - `Blocked`
3. Add document-level preview panel:
   - raw text excerpt, local display only
   - tokenized preview
   - token category counts
   - "Open token map" button
4. Add "Sanitize packet" primary action.
5. Disable "Generate comparison" until:
   - included documents are sanitized
   - attorney update is sanitized
   - sanitizer is ready
   - server/cloud generation is allowed
6. Add manual review warnings:
   - "OPF unavailable; heuristic fallback used"
   - "Structured PII still detected"
   - "This document has not been sanitized"

### Acceptance Criteria

- Attorney can see exactly which source docs are safe to use.
- Generate buttons are disabled when any included doc is blocked.
- UI never suggests raw documents are being sent to the cloud.

### Browser Tests

- OPF healthy: five docs move to sanitized.
- OPF unavailable: generation disabled or marked needs review according to policy.
- Token map modal reflects entities from all estate documents.

---

## Phase 4: Server APIs For Tokenized Drafting Magic

**Goal:** Move analysis/generation out of local prototype helpers and into server APIs that accept tokenized payloads only.

### New API Routes

| Route | Purpose |
|---|---|
| `api/drafting-magic/analyze.ts` | Produce extracted units and comparison matrix from tokenized sources |
| `api/drafting-magic/generate.ts` | Produce drafting plan and draft sections from approved tokenized rows |
| `api/drafting-magic/verify.ts` | Verify generated draft against checklist, source lineage, and new-law requirements |
| `api/drafting-magic/workspaces.ts` | Optional tokenized workspace persistence; can defer |

### Shared Server Service

New folder:

```text
services/draftingMagic/
  schema.ts
  promptBuilders.ts
  compareSources.ts
  generateDraft.ts
  verifyDraft.ts
  audit.ts
```

### Request Contract

```ts
interface DraftingMagicAnalyzeRequest {
  flow: 'accuracy_client';
  workspaceId?: string;
  attorneyUpdate: string; // tokenized
  sources: Array<{
    id: string;
    role: SourceRole;
    name: string; // tokenized if needed
    sanitizedText: string;
    included: boolean;
    base: boolean;
    tokenCategoryCounts?: Record<string, number>;
  }>;
}
```

### Server Guards

Every route must:

1. Reject non-POST/invalid JSON.
2. Enforce `flow: 'accuracy_client'`.
3. Run deterministic backstop on:
   - `attorneyUpdate`
   - every `source.sanitizedText`
   - approved row content
   - generated draft text if it is about to be persisted
4. Reject on any backstop hit.
5. Call Bedrock only.
6. Write audit metadata:
   - route
   - flow
   - HMAC of combined sanitized prompt
   - token category counts
   - source count and roles
   - backstop status
   - latency

### Prompting Requirements

Prompts must instruct Bedrock:

- Treat all `CLIENT_001`, `ADDRESS_001`, etc. tokens as placeholders for confidential facts.
- Preserve tokens exactly.
- Do not invent new token values.
- Do not infer real names or addresses.
- Output structured JSON with comparison rows, draft sections, and checklist items.

### Acceptance Criteria

- Direct POST with raw phone/address/SSN to any Drafting Magic route returns `400 backstop_triggered`.
- Direct POST with tokenized source packet reaches Bedrock path.
- Response preserves tokens exactly.
- Audit record contains no raw text.

### Tests

Add `tests/draftingMagicApi.test.mjs`:

- flow missing -> 400
- speed flow -> 403
- raw PII source -> 400
- tokenized packet -> accepted with mocked Bedrock
- response schema validation

---

## Phase 5: Replace Local Prototype Comparison And Draft Generation

**Goal:** Keep the local prototype as sample/demo fallback, but production Drafting Magic uses tokenized API responses.

### Tasks

1. Convert `buildPacketComparisonRows` into:
   - `buildLocalSampleComparisonRows` for preview/sample-only mode, or
   - remove after API is complete.
2. Wire `Generate comparison` to `/api/drafting-magic/analyze`.
3. Wire `Generate draft` to `/api/drafting-magic/generate`.
4. Wire `Review checklist` to `/api/drafting-magic/verify` or a local structured verifier initially.
5. Store tokenized API responses.
6. Rehydrate rows/draft/checklist for display using the local token map.
7. Add "Show tokenized view" toggle for compliance/debug review.

### Acceptance Criteria

- Generated matrix includes source lineage and tokenized IDs internally.
- User sees rehydrated display in the browser.
- Exported secure workspace contains tokens, not raw facts.
- New laptop/no token map shows tokens, not raw names.

---

## Phase 6: Secure Export

**Goal:** Allow attorneys to export useful work product without breaking the trust boundary.

### Export Types

1. **Secure workspace JSON**
   - tokenized only
   - safe to store in firm systems
   - no token map

2. **Attorney local draft**
   - rehydrated in browser
   - DOCX/HTML generated locally
   - no server round-trip

3. **Review packet**
   - generated locally from tokenized + rehydrated display
   - includes source lineage and checklist

### Tasks

1. Implement local DOCX export for draft sections.
2. Ensure export path uses browser-side rehydration only.
3. Add pre-export warning:
   - "This export is rehydrated locally and may contain client-confidential information."
4. Add secure JSON export:
   - explicitly says "tokenized; safe to upload/store".

### Acceptance Criteria

- Secure workspace export contains no synthetic raw names.
- Local DOCX export contains rehydrated names when token map is present.
- Local DOCX export shows tokens when token map is missing.

---

## Phase 7: Optional Server-Side Workspace Persistence

**Goal:** Persist Drafting Magic workspaces across sessions without raw-client leakage.

This can be deferred until the local tokenized workspace is solid.

### Route

`api/drafting-magic/workspaces.ts`

### Storage

- Upstash metadata
- Vercel Blob tokenized workspace body
- no raw facts
- no token map

### Server Backstop

- Scan every text field in the tokenized workspace before write.
- Refuse to save if deterministic PII appears.

### Browser Behavior

- On load, fetch tokenized workspace.
- Rehydrate if local token map exists.
- If no token map, display tokenized workspace with clear warning.

### Acceptance Criteria

- Saved Blob body contains no raw synthetic names.
- Reopening on same browser rehydrates.
- Reopening after token map reset shows tokens only.

---

## Phase 8: End-To-End Validation And Launch Gate

**Goal:** Prove the exact confidentiality story for Drafting Magic.

### Required Tests

```bash
npm run build
npm run test:sanitization
npm run test:confidentiality
npm run test:goldset
npm run test:drafting-magic
```

Add `test:drafting-magic` once API/browser tests exist.

### Manual Browser Proof

Use a synthetic estate packet with:

- client name
- spouse name
- child/beneficiary name
- trustee/agent names
- home address
- brokerage account name/number
- phone/email
- date of birth
- prenup property description

Flow:

1. Open `/drafting-magic`.
2. Upload/paste five synthetic estate documents.
3. Sanitize packet.
4. Confirm token map shows entities.
5. Generate comparison.
6. Approve rows.
7. Generate draft.
8. Verify checklist.
9. Export secure workspace.
10. Inspect localStorage and secure export for raw names.
11. Reload page.
12. Confirm rehydrated display works.
13. Reset token map.
14. Confirm workspace shows tokens, not raw names.

### Evidence Required Before "Done"

- Build output.
- Unit test output.
- Browser screenshot of sanitized packet status.
- Browser screenshot of generated rehydrated draft.
- localStorage/export inspection proving no raw synthetic names.
- Direct API rejection proof for raw PII.

---

## 7. Detailed Task Checklist

### Merge And Shell

- [ ] Create `codex/drafting-magic-sanitized`.
- [ ] Merge `codex/drafting-magic`.
- [ ] Preserve `SanitizerProvider` wrapping the app.
- [ ] Preserve `DaemonGate`.
- [ ] Preserve `ConfidentialityAttestation`.
- [ ] Preserve `SanitizationBanner`.
- [ ] Add Drafting Magic mode to `AppMode`.
- [ ] Add Drafting Magic to `ModeSelector`.
- [ ] Add Drafting Magic to sidebar.
- [ ] Add protected `/drafting-magic` route.
- [ ] Decide and lock `/drafting-magic-preview` behavior.

### Client Sanitization

- [ ] Add `services/sanitization/documentSanitizer.ts`.
- [ ] Add batch sanitization support.
- [ ] Expose document sanitizer through `useSanitizer` or a new hook.
- [ ] Add status and warning fields to Drafting Magic sources.
- [ ] Add token category counts to sources.
- [ ] Rehydrate display text from token map.
- [ ] Disable cloud actions when sanitizer unavailable.

### Workspace Safety

- [ ] Bump workspace schema to v2.
- [ ] Remove raw `excerpt` from persisted snapshots.
- [ ] Add old-v1 raw-workspace warning/clear path.
- [ ] Ensure export workspace is tokenized only.
- [ ] Add localStorage inspection test.

### API

- [ ] Add `api/drafting-magic/analyze.ts`.
- [ ] Add `api/drafting-magic/generate.ts`.
- [ ] Add `api/drafting-magic/verify.ts`.
- [ ] Add `services/draftingMagic/schema.ts`.
- [ ] Add request schema validation.
- [ ] Enforce `accuracy_client`.
- [ ] Add server backstop.
- [ ] Add audit records.
- [ ] Use Bedrock helper only.
- [ ] Ensure prompts require exact token preservation.

### UI

- [ ] Add document-level sanitized preview.
- [ ] Add packet-level confidentiality summary.
- [ ] Add "Show tokenized view" toggle.
- [ ] Add blocked/needs-review states.
- [ ] Add token map shortcut from Drafting Magic.
- [ ] Add secure export and local rehydrated export controls.

### Tests

- [ ] Unit test stable tokens across five docs.
- [ ] Unit test workspace serializer omits raw text.
- [ ] API test raw PII rejection.
- [ ] API test invalid flow rejection.
- [ ] API test tokenized packet accepted.
- [ ] Browser test sanitize packet -> generate comparison -> generate draft.
- [ ] Browser test localStorage contains no raw names.
- [ ] Browser test token map reset shows tokens.
- [ ] Browser test OPF unavailable disables generation.

---

## 8. Merge Conflict Resolution Guide

### `App.tsx`

Keep the confidentiality branch app wrapper:

```tsx
<SanitizerProvider>
  <DaemonGate />
  <Routes>...</Routes>
</SanitizerProvider>
```

Then add Drafting Magic routes inside the signed-in protected route group.

Do not revert:

- `SanitizerProvider`
- `DaemonGate`
- `ConfidentialityAttestation`
- `SanitizationBanner`
- `TokenStoreModal`

### `ModeSelector.tsx`

Keep Drafting Magic's three-mode selector, but ensure it works inside the confidentiality header.

### `Sidebar.tsx`

Merge both:

- confidentiality tokenized-title behavior
- Drafting Magic shortcut

### `types.ts`

`AppMode` should include:

```ts
export type AppMode = 'research' | 'drafting' | 'magic';
```

Preserve any sanitizer/confidentiality metadata added to message types.

### `package.json`

Keep confidentiality scripts:

- `build:shared`
- `typecheck:api`
- `test:sanitization`
- `test:confidentiality`
- `test:goldset`

Add Drafting Magic dependencies:

- `mammoth`
- `pdfjs-dist`

If lockfiles diverge, regenerate intentionally using the package manager that the branch actually uses. The confidentiality branch uses Yarn 4 via `packageManager`, but also has `package-lock.json` in the repo. Do not accept a giant accidental lockfile conversion without verifying install/build behavior.

---

## 9. Product Decisions To Lock Before Coding

1. **Public preview route**
   - Keep sample-only preview, or remove it?
   - Recommendation: sample-only preview is okay for design review, but no upload/paste on public route.

2. **Heuristic fallback policy**
   - If OPF is unavailable, should Drafting Magic block generation or allow attorney-reviewed heuristic fallback?
   - Recommendation: block cloud generation; allow local sample/demo only.

3. **Workspace persistence**
   - Tokenized localStorage only, encrypted IndexedDB raw workspace, or both?
   - Recommendation: tokenized localStorage for v1; no raw workspace persistence.

4. **Server-backed Drafting Magic workspaces**
   - Build now or defer?
   - Recommendation: defer until tokenized local workspace passes leak tests.

5. **Preview route upload**
   - If preview stays public, should upload be disabled?
   - Recommendation: yes.

6. **OCR for scanned PDFs**
   - Local OCR or approved AWS trust-boundary OCR?
   - Recommendation: defer scanned PDF OCR; support selectable-text PDFs only.

---

## 10. Definition Of Done

Drafting Magic is not done until all are true:

1. `/drafting-magic` runs inside the signed-in sanitizer shell.
2. Source documents are sanitized before comparison/generation.
3. No raw source text is sent to any API.
4. No raw source text is persisted in localStorage, Blob, Upstash, or audit logs.
5. Drafting Magic APIs enforce `accuracy_client`.
6. Drafting Magic APIs reject direct raw PII submissions.
7. Bedrock sees tokenized content only.
8. Generated comparison/draft/checklist returns tokenized content.
9. Browser rehydrates for display/export only.
10. Secure workspace export is tokenized.
11. Local rehydrated export is generated in browser only.
12. Build and all confidentiality tests pass.
13. Browser leak test proves synthetic raw names are absent from network payloads and persisted tokenized workspace.

---

## 11. Recommended Commit Sequence

1. `Merge Drafting Magic into confidentiality shell`
2. `Add document sanitization service for Drafting Magic`
3. `Make Drafting Magic workspace tokenized-only`
4. `Add Drafting Magic confidentiality UI states`
5. `Add tokenized Drafting Magic analyze API`
6. `Add tokenized Drafting Magic generate API`
7. `Add Drafting Magic verification and secure export`
8. `Add Drafting Magic confidentiality tests`

Keep each commit testable. Do not combine merge-conflict resolution with API implementation.

