---
schema_version: 1
spec_id: CALC-P0-CONSENT-ANTHROPIC-001
status: draft
target_agent: either
scope:
  in:
  - api/_lib/agentLoop.ts
  - api/_lib/compliance/policyEngine.ts
  - api/_lib/compliance/turnManifest.ts
  - tests/p6Compliance.test.mjs
  - tests/turnPolicy.test.mjs
  - tests/consentHardBlock.test.mjs
  - DISCOVER_TARGETS
  out:
  - components/**
  - services/sanitization/**
  - api/_lib/tools/**
  - api/agent/**
  forbid:
  - '**/*.env'
  - .env*
  - archive-env-2026-07-01/**
  - services/sanitization/**
  - components/**
  - api/chats.ts
bet:
  if: a session is bound to client_confidential or protected_discovery and client
    AI-use consent is not_obtained, prohibited, or revoked (so decidePolicy sets
    externalCallsAllowed=false and policy.block)
  then: runTurn and runTurnStream must NOT call Anthropic messages.create or stream;
    they return a structured policy-blocked result (tools already empty) and still
    write a turn manifest that records blocked_reason / external_calls_allowed=false
  observable: a unit test with a mocked Anthropic client proves zero create/stream
    invocations on consent-blocked sessions, and proves create IS invoked when
    consent is allowed; existing p6Compliance / turnPolicy / toolGating suites stay green
invariants:
- id: INV1
  holds: when computeTurnPolicy yields externalCallsAllowed=false, neither runTurn
    nor runTurnStream invokes Anthropic Messages create or stream
  check_intent: offline unit test injects a mock Anthropic client that throws if
    create/stream is called; consent-blocked sessions complete without throw and
    without model call
- id: INV2
  holds: the blocked path returns a structured failure the UI can surface (non-empty
    error or final_text explaining the consent/policy block) and records the block
    in the turn manifest fields (blocked_reason and/or external_calls_allowed false)
  check_intent: unit assertion on return shape + manifest builder inputs or stored
    meta; no raw client text required
- id: INV3
  holds: public_research sessions that only escalate on detected PII still allow
    externalCallsAllowed=true (DPA-covered Anthropic answer continues; tools hardened)
  check_intent: existing p6Compliance case "public session escalated by PII ⇒ NOT
    hard-blocked" still passes; new hard-block does not fire on that path
- id: INV4
  holds: consent allowed on bound confidential still reaches Anthropic (mock create
    is called at least once)
  check_intent: unit test with client_ai_consent=allowed and bound confidential
    proves mock create/stream is invoked (or preflight passes into the call site)
- id: INV5
  holds: change stays inside trust-boundary loop/policy/tests; no sanitization or
    UI surface rewrites
  check_intent: git diff --name-only is a subset of scope.in and excludes every
    scope.forbid path
gates:
- id: G1
  intent: 'INV1 holds: consent-blocked sessions never call Anthropic create/stream'
  must_assert: offline test exits 0 proving zero Anthropic create/stream on
    not_obtained/prohibited/revoked confidential sessions for both non-stream and
    stream entry paths (or a shared preflight both paths call)
  command: TODO
  requires_permission: false
- id: G2
  intent: 'INV2 holds: blocked path surfaces structured policy block + manifest fields'
  must_assert: test asserts structured block result and blocked_reason /
    external_calls_allowed=false are recorded; exit nonzero on missing fields
  command: TODO
  requires_permission: false
- id: G3
  intent: 'INV3 and INV4 hold: escalate-only public still answers; allowed consent still calls model'
  must_assert: p6Compliance + new consent hard-block tests exit 0 including public-PII
    escalate and confidential+allowed paths
  command: TODO
  requires_permission: false
- id: G4
  intent: 'INV5 holds: regression suite for policy/tool gating still green; scope clean'
  must_assert: turnPolicy, toolGating, policyEngine, approvedModels unit tests exit 0;
    git diff names ⊆ scope.in and exclude scope.forbid
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
  max_turns: 18
  max_consecutive_failures: 3
  preflight_estimate: required
kill:
  after_turns: 8
  gate: G1
graduate: G1–G4 exit 0 AND review verdict=pass AND no scope.forbid path touched
scale: graduated AND a manual smoke on a confidential session without consent shows
  a clear UI/API block without an Anthropic billable call (product loop)
ledger:
  turns: 0
  consecutive_failures: 0
  blockers: []
  lessons: []
---

## Context

Repository: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`.

California Law Chatbot V4 runs attorney turns through `api/_lib/agentLoop.ts` (`runTurn` / `runTurnStream`). Before tools are built, `computeTurnPolicy(sessionId, userText)` calls pure `decidePolicy()` in `api/_lib/compliance/policyEngine.ts`.

`PolicyDecision.externalCallsAllowed` is documented as: when false, **no external model or tool call** may be made. Consent hard-blocks (`prohibited`, `revoked`, or confidential/protected with `not_obtained`) and staff+protected set `externalCallsAllowed: false` and `block: { reason }`.

**Live defect (2026-07-09 review):** `agentLoop.ts` never reads `externalCallsAllowed` or `policy.block`. Tools empty out via `allowedTools: []` and `guardToolQuery`, but Anthropic `messages.create` / stream still runs. That contradicts the policy contract and COPRAC-style consent gating for bound confidential/protected matters.

**Intentional non-goal:** public_research that *escalates* on hard PII keeps `externalCallsAllowed: true` so the DPA-covered Anthropic channel still answers while tools harden (web_search dropped). Do not hard-block that path.

Implementation intent for the build model (not a step list): after `computeTurnPolicy`, if `!policy.externalCallsAllowed`, short-circuit **both** loops before any Anthropic call; return a structured block; still write audit/manifest with `blocked_reason`. Prefer one shared preflight helper so stream and non-stream cannot drift.

Tests already prove decision objects (`tests/p6Compliance.test.mjs`). This contract requires **enforcement at the call site**, with a mock Anthropic client so gates stay offline (no `ANTHROPIC_API_KEY`, no live credits).

## Build Loop vs Product Loop

**Build loop (provable now):** offline unit tests with mocked Redis meta + mocked Anthropic client prove create/stream are skipped on consent-blocked sessions and still invoked when consent allows; existing policy unit suites stay green; git scope stays clean.

**Product loop (not claimed by gates):** attorneys using the live app on confidential matters without recorded consent see a clear block and produce no Anthropic usage for that turn. Confirm after ship with a manual or smoke probe if desired (`scale`).

## Verification Narrative

From repo root after Build Mode resolves gates:

1. Run the new consent hard-block unit file (Build Mode names it; Author expects something like `tsx tests/consentHardBlock.test.mjs` or an extension of `p6Compliance.test.mjs`).
2. Run `tsx tests/p6Compliance.test.mjs`, `tsx tests/turnPolicy.test.mjs`, `tsx tests/toolGating.test.mjs`, `tsx tests/policyEngine.test.mjs`.
3. Confirm `rg -n 'externalCallsAllowed|policy\\.block' api/_lib/agentLoop.ts` shows a pre-Anthropic check on both loop paths (or one shared helper both call).
4. Confirm git status paths ⊆ scope.in and none match scope.forbid.
5. Reviewer inspects that short-circuit does not skip audit/manifest and does not change public-PII escalate behavior.
