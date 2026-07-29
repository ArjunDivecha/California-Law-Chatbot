---
schema_version: 1
spec_id: CALC-P0-VERIFIER-EVIDENCE-001
status: draft
target_agent: either
scope:
  in:
  - api/_lib/verifierSubAgent.ts
  - api/_lib/approvedModels.ts
  - api/_lib/tools/courtlistenerSearch.ts
  - tests/verifierEvidence.test.mjs
  - tests/approvedModels.test.mjs
  - DISCOVER_TARGETS
  out:
  - components/**
  - services/**
  - api/_lib/agentLoop.ts
  forbid:
  - '**/*.env'
  - .env*
  - archive-env-2026-07-01/**
  - components/**
  - services/sanitization/**
  - api/chats.ts
bet:
  if: the citation verifier sub-agent dispatches courtlistener_search and the tool
    returns a non-empty hits array (the shape courtlistenerSearch actually returns)
  then: positiveEvidence is true for that tool result so a grounded real verdict is
    not forced to ambiguous by a field-name mismatch; and every Anthropic model id
    the verifier uses is checked with assertApprovedModel (fail-closed on unapproved ids)
  observable: offline unit tests prove (1) hits-shaped results set positiveEvidence,
    (2) empty hits do not, (3) assertApprovedModel is invoked / unapproved env model
    cannot silently proceed; approvedModels + existing unit suites stay green
invariants:
- id: INV1
  holds: >-
    dispatchVerifierTool (or its extracted pure helper) treats courtlistener
    results with non-empty hits as positiveEvidence=true
  check_intent: >-
    offline unit test feeds a mock return shape with a non-empty hits array
    and asserts positiveEvidence true; empty hits implies false
- id: INV2
  holds: >-
    reading only results is not the sole evidence path for courtlistener_search
    (either map hits correctly or accept both hits and results for defense in depth)
  check_intent: >-
    test fails if only results is checked and hits is ignored
- id: INV3
  holds: >-
    the verifier model path calls assertApprovedModel on the resolved model id
    before messages.create (default claude-sonnet-5 and any V2_VERIFIER_MODEL override)
  check_intent: >-
    unit or static+behavioral test proves unapproved model id is refused;
    approved sonnet-4-6 is accepted
- id: INV4
  holds: >-
    change is confined to verifier + allowlist + offline tests; no main agent
    loop or UI rewrite
  check_intent: >-
    git diff --name-only is a subset of scope.in and excludes scope.forbid
gates:
- id: G1
  intent: 'INV1 and INV2 hold: CourtListener hits map to positiveEvidence'
  must_assert: >-
    offline verifier evidence unit test exits 0; non-empty hits implies true;
    empty hits implies false; a results-only-wrong path does not leave hits ignored
  command: TODO
  requires_permission: false
- id: G2
  intent: 'INV3 holds: verifier model is allowlist-gated fail-closed'
  must_assert: >-
    test or module-level guard proves assertApprovedModel is applied to
    the verifier model; unapproved id throws or is refused; approvedModels suite green
  command: TODO
  requires_permission: false
- id: G3
  intent: 'INV4 holds: no regressions outside verifier; scope clean'
  must_assert: >-
    yarn build or targeted tsx compile of touched modules succeeds;
    git diff names are a subset of scope.in excluding forbid
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
  max_turns: 12
  max_consecutive_failures: 3
  preflight_estimate: required
kill:
  after_turns: 6
  gate: G1
graduate: G1–G3 exit 0 AND review verdict=pass AND no scope.forbid path touched
scale: graduated AND a live verify-stream smoke on a known real CA cite yields real
  (not forced ambiguous) when CourtListener returns hits (product loop; spends credits)
ledger:
  turns: 0
  consecutive_failures: 0
  blockers: []
  lessons: []
---

## Context

Repository: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`.

The citation verifier sub-agent lives in `api/_lib/verifierSubAgent.ts`. It is used by `api/agent/verify-stream.ts` and the Verify UI. Architecture: separate Anthropic conversation, tools `citation_verify`, `courtlistener_search`, `statute_verify` (no web_search).

**Defect 1 — evidence field mismatch (2026-07-09 review):**  
`courtlistenerSearch` (`api/_lib/tools/courtlistenerSearch.ts`) returns `{ hits, total_count, elapsed_ms }`.  
`dispatchVerifierTool` currently does:

```ts
const hits = (r as { results?: unknown[] }).results;
positiveEvidence: Array.isArray(hits) && hits.length > 0
```

So CourtListener successes almost never set `positiveEvidence`. The code-level gate that refuses ungrounded `real` verdicts then forces many real cites toward `ambiguous`, defeating the C4 grounding fix.

Note: `agentLoop.ts` already summarizes CourtListener via `.hits` correctly — only the verifier path is wrong.

**Defect 2 — model allowlist gap:**  
Main agent loop routes every model through `assertApprovedModel` in `resolveModel`. The verifier uses `process.env.V2_VERIFIER_MODEL ?? 'claude-sonnet-5'` and calls `client.messages.create` without `assertApprovedModel`. An env misconfig can send citation text (sometimes client-adjacent pasted context) to an unreviewed model id.

Default `claude-sonnet-5` is already on `APPROVED_MODELS`. The fix is the fail-closed chokepoint, not changing the default.

Gates must stay offline — mock the tool return shape; do not call CourtListener or Anthropic in CI.

## Build Loop vs Product Loop

**Build loop:** pure/offline unit tests on the evidence helper and model guard prove hits→positiveEvidence and allowlist enforcement.

**Product loop:** live Verify page / `yarn agent`-style smokes showing real cites mark `real` when CL returns hits. Not required for DONE.

## Verification Narrative

1. Run the new offline verifier evidence test file (Build Mode names command).
2. Run `tsx tests/approvedModels.test.mjs`.
3. Confirm `rg -n 'hits|assertApprovedModel' api/_lib/verifierSubAgent.ts` shows both fixes.
4. Confirm git scope clean.
5. Optional product check: paste a well-known CA case cite on `/v2/verify` after deploy.
