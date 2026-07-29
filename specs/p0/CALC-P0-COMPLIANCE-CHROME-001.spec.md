---
schema_version: 1
spec_id: CALC-P0-COMPLIANCE-CHROME-001
status: draft
target_agent: either
scope:
  in:
  - App.tsx
  - components/v2/V2DraftPage.tsx
  - components/v2/V2VerifyPage.tsx
  - components/v2/V2DraftingMagicPage.tsx
  - components/v2/V2ChatPage.tsx
  - components/v2/MatterModeSelector.tsx
  - components/ConfidentialityAttestation.tsx
  - components/v2/V2ShellChrome.tsx
  - hooks/useAttestation.ts
  - tests/sanitization.test.mjs
  - tests/complianceChrome.test.mjs
  - DISCOVER_TARGETS
  out:
  - api/_lib/agentLoop.ts
  - api/_lib/compliance/**
  - services/sanitization/**
  forbid:
  - '**/*.env'
  - .env*
  - archive-env-2026-07-01/**
  - api/_lib/agentLoop.ts
  - api/_lib/tools/**
  - services/sanitization/detectionPipeline.ts
bet:
  if: an authenticated attorney opens any of the four V2 production surfaces
    (Chat /v2, Draft /v2/draft, Verify /v2/verify, Magic /v2/magic)
  then: each surface mounts ConfidentialityAttestation and MatterModeSelector
    bound to that surface's agent session_id so matter mode and client AI consent
    can be set before client text is sent; Draft/Magic/Verify are not left as
    public_research-only with no compliance chrome
  observable: static source assertions (and any existing mount tests) prove all
    four page modules reference both components (or a shared shell that mounts
    both once for all /v2* routes); yarn build succeeds; chat regressions in
    sanitization.test.mjs stay green
invariants:
- id: INV1
  holds: ConfidentialityAttestation is reachable from Chat, Draft, Verify, and Magic
    routes (either mounted in each page or once in a shared SignedInShell /
    V2 chrome wrapper that wraps all four)
  check_intent: offline test greps or AST-checks the shipped page/shell modules
    so that no V2 route path lacks attestation; existing V2ChatPage attestation
    mount test still passes
- id: INV2
  holds: MatterModeSelector is mounted for Draft, Verify, and Magic with a real
    session_id that matches the session_id those surfaces send to /api/agent/*
    (Draft uses v2d_*; Magic uses v2m_* / v2SessionIdRef; Chat already wires
    sessionId)
  check_intent: offline test asserts each page/shell passes a session id into
    MatterModeSelector; no hard-coded empty session; Magic ref or state is shared
    with the selector
- id: INV3
  holds: Chat behavior is not regressed — attestation soft gate and matter mode
    still present; sanitization tests that assert V2ChatPage mounts attestation
    still pass
  check_intent: tsx tests/sanitization.test.mjs exits 0 (or the subset covering
    attestation)
- id: INV4
  holds: no agent-loop or sanitization pipeline logic is rewritten; this is UI
    chrome wiring only
  check_intent: git diff --name-only ⊆ scope.in and excludes every scope.forbid path
gates:
- id: G1
  intent: 'INV1 and INV2 hold: all four V2 surfaces expose attestation + matter mode'
  must_assert: offline compliance-chrome test exits 0 proving Draft, Verify, Magic
    (and Chat) each mount or inherit ConfidentialityAttestation and MatterModeSelector
    with a non-empty session binding for matter mode
  command: TODO
  requires_permission: false
- id: G2
  intent: 'INV3 holds: existing chat attestation / sanitization surface tests green'
  must_assert: tests/sanitization.test.mjs exits 0; yarn build exits 0
  command: TODO
  requires_permission: false
- id: G3
  intent: 'INV4 holds: scope clean — UI chrome only'
  must_assert: git diff --name-only is a subset of scope.in and touches no
    scope.forbid path
  command: TODO
  requires_permission: false
review:
  mode: required
  command: TODO
  sees:
  - diff
  - invariants
  - scope
budget:
  max_turns: 15
  max_consecutive_failures: 3
  preflight_estimate: required
kill:
  after_turns: 7
  gate: G1
graduate: G1–G3 exit 0 AND review verdict=pass AND no scope.forbid path touched
scale: graduated AND a manual browser pass on /v2/draft and /v2/magic shows the
  matter selector and attestation chrome without breaking send/export (product loop)
ledger:
  turns: 0
  consecutive_failures: 0
  blockers: []
  lessons: []
---

## Context

Repository: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`.

Production UI routes (App.tsx SignedInShell):

| Route | Page | Agent session id today |
|-------|------|------------------------|
| `/v2`, `/v2/:sessionId` | V2ChatPage | `sessionId` (URL or minted) |
| `/v2/draft` | V2DraftPage | local `v2d_*` state, sent as `session_id` |
| `/v2/verify` | V2VerifyPage | verify stream mints its own session (discover) |
| `/v2/magic` | V2DraftingMagicPage | `v2SessionIdRef` (`v2m_*`) |

**Live defect (2026-07-09 review):** `ConfidentialityAttestation` and `MatterModeSelector` mount **only** on V2ChatPage. Draft / Verify / Magic are the highest-PII surfaces (full documents, packets) but default to unbound public_research with no attorney-facing matter mode or consent control. Server policy still defaults missing meta to public_research, so confidential document work can run without consent chrome.

`MatterModeSelector` already talks to `/api/matter-context` with `session_id` + Clerk token. The fix is wiring, not redesigning policy. Preferred shapes (build model chooses one, keeps INV2):

1. Lift chrome into SignedInShell / a small `V2ShellChrome` that receives active session id from routes, or  
2. Mount the same two components on each of Draft / Verify / Magic with that page’s existing session id.

Do **not** change soft vs hard attestation policy in this contract (softGate remains unless a separate counsel contract says otherwise). Do **not** implement C1 Anthropic hard-block here (separate contract CALC-P0-CONSENT-ANTHROPIC-001).

Verify page currently has no long-lived session id in the page component — Build Mode must discover `useV2VerifyStream` session handling and either expose the session id to the selector or mint one the verify stream already uses so matter context sticks.

## Build Loop vs Product Loop

**Build loop:** static/offline mount tests + `yarn build` + existing sanitization attestation assertions prove all four surfaces expose chrome and Chat does not regress.

**Product loop:** attorney can set Client matter + consent on Draft/Magic before pasting a client packet; matter mode persists for that session’s agent calls. Manual browser check after ship.

## Verification Narrative

1. Run offline compliance chrome test (Build Mode resolves command — grep/AST or small test file).
2. Run `tsx tests/sanitization.test.mjs` and `yarn build`.
3. Confirm `rg -n 'MatterModeSelector|ConfidentialityAttestation' components/v2/` hits all four pages or a shared shell imported by all four.
4. Confirm git scope clean (no agentLoop / detectionPipeline edits).
5. Optional product: open `/v2/draft` and `/v2/magic`, change matter mode, confirm network call to `/api/matter-context` with the same session_id used on the next agent POST.
