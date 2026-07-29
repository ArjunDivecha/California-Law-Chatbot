---
schema_version: 1
spec_id: CALC-DESKTOP-ELECTRON-001
status: draft
target_agent: either

scope:
  in:
    - electron/**
    - src-electron/**
    - scripts/local-api-server.mjs
    - scripts/desktop-smoke.mjs
    - package.json
    - vite.config.ts
    - App.tsx
    - index.tsx
    - components/v2/**
    - hooks/**
    - services/api/**
    - services/sanitization/chatAdapter.ts
    - tests/desktop-electron.test.mjs
    - tests/sanitization.test.mjs
    - tests/traps/**
    - .gitignore
    - build/**
    - DISCOVER_TARGETS
  out:
    - openwiki/**
    - docs/**
    - .github/**
    - playground/**
  forbid:
    - '**/.env'
    - '.env*'
    - '**/*.env'
    - archive-env-2026-07-01/**
    - '**/secrets*'
    - '**/id_*'
    - '**/*.pem'
    - '**/*.p12'
    - dist/**
    - release/**
    - '**/node_modules/**'
    - api/_shared/sanitization/patterns.ts
    - api/_shared/sanitization/index.ts
    - services/sanitization/glinerPostProcess.ts
    - services/sanitization/glinerWebClient.ts

bet:
  if: the product is packaged as a desktop app
  then: a single macOS user can launch it, and it serves the same four V2
    surfaces (Chat /v2, Draft /v2/draft, Verify /v2/verify, Magic /v2/magic)
    with the same agent turn engine, the same fail-closed compliance gate, and
    the same on-device PII sanitization — while making ZERO network calls to
    Vercel, Upstash, Clerk, or Vercel Blob; the only egress is api.anthropic.com
    plus the public-law search APIs (CourtListener / LegiScan / OpenStates) and
    a one-time HuggingFace model fetch
  observable: a static test proves no production import of @clerk/*,
    @upstash/redis, or @vercel/blob survives in the served bundle; yarn build
    exits 0; the three offline suites (sanitization, analyze traps, wire traps)
    exit 0; and a manual runtime check shows chat works fully offline except
    the Anthropic stream

invariants:
  - id: INV1
    holds: a local loopback or IPC server hosts every route the client calls
      (/api/agent/turn, /turn-stream, /draft-stream, /verify-stream,
      /revise-section, /drafting-magic, /session(s), /matter-context,
      /export-document) and replaces the Clerk auth, Upstash rate-limit, and
      session-ownership layers of httpGuard with local single-user no-ops,
      while still calling agentProxy -> agentLoop -> decidePolicy unchanged
    check_intent: a static test asserts the local server registers every route
      the client code fetches, and that each handler delegates to the same
      agentProxy/agentLoop functions the Vercel route used
  - id: INV2
    holds: session state, session meta, the 24h tool-result idempotency cache,
      the single-flight turn lock, the rate-limit counter, and chat-history
      persistence all move from Upstash Redis + Vercel Blob to local storage
      (better-sqlite3 and/or the filesystem) under the app support dir, with
      no Redis/Blob dependency remaining
    check_intent: a test exercises save/load of a session and chat history
      against the local store with no network, and greps prove no
      @upstash/redis or @vercel/blob import remains in production code
  - id: INV3
    holds: the Anthropic API key is read from the OS keychain or a local
      untracked secrets file at runtime — never bundled into the app, never
      committed — and Clerk auth is fully removed from client and server
    check_intent: a static test greps that no ANTHROPIC_API_KEY literal and no
      @clerk import appears in the served bundle or any committed file, and
      that the main process resolves the key from keychain/local file only
  - id: INV4
    holds: the fail-closed compliance gate is preserved end-to-end —
      policyEngine.decidePolicy, toolQueryGuard, and the server-side PII
      backstop (agentProxy's fail-closed 503 path) still run inside the local
      server process on every turn; nothing about the move makes a blocked
      tool or a raw-PII payload succeed
    check_intent: existing compliance/trap suites still exit 0 against the
      ported pipeline, and a test asserts the local turn route passes through
      agentProxy's backstop rather than bypassing it
  - id: INV5
    holds: PII sanitization behavior is identical or better — the wire
      pipeline uses the in-page GLiNER detector (VITE_DETECTOR=web) so no
      external GLiNER daemon is required, and BOTH trap suites pass at 100%,
      including the currently-failing T-PII-032 California driver-license wire
      trap (which must be FIXED, not skipped)
    check_intent: tsx tests/traps/runTraps.mjs exits 0 at 100/100 AND
      tests/traps/runTrapsWire.mjs exits 0 at 120/120 with zero skips
  - id: INV6
    holds: no AI-model or sanitization-pipeline logic is rewritten — the
      change is transport, storage, and auth only; agentLoop.ts,
      policyEngine.ts, toolQueryGuard.ts, tools/index.ts, and both shared
      sanitizer cores stay byte-for-byte compatible in behavior
    check_intent: git diff --name-only stays inside scope.in and off
      scope.forbid, and no scope.forbid sanitizer-core file is touched
  - id: INV7
    holds: the production web bundle builds and serves with no Vercel/Clerk/
      Upstash globals, and the app can be packaged as an unsigned macOS
      artifact whose only runtime egress is api.anthropic.com plus public-law
      APIs plus a one-time HuggingFace fetch
    check_intent: yarn build exits 0; a static test greps the built bundle for
      clerk/upstash/vercel endpoints and finds none; a packaging smoke check
      produces the artifact

gates:
  - id: G1
    intent: 'INV1, INV2, INV3 hold: a desktop smoke harness boots the local
      server and runs a full agent turn against a stubbed Anthropic client,
      proving the route parity, local storage round-trip, and keychain/local
      key resolution with NO network'
    must_assert: the smoke harness exits 0; it asserts every client-called
      route is registered, a session saves and reloads from local storage, and
      no @clerk/@upstash/@vercel-blob import resolved during boot
    command: TODO
    requires_permission: false
  - id: G2
    intent: 'INV4, INV5 hold: the three offline suites pass against the ported
      pipeline with zero skips — sanitization unit tests, analyze traps, and
      wire traps (incl. the T-PII-032 fix)'
    must_assert: tsx tests/sanitization.test.mjs exits 0 AND
      tsx tests/traps/runTraps.mjs exits 0 at 100/100 AND
      tsx tests/traps/runTrapsWire.mjs exits 0 at 120/120 with no skipped or
      todo traps
    command: TODO
    requires_permission: false
  - id: G3
    intent: 'INV7 holds: the production web bundle builds clean and contains no
      hosted-service references'
    must_assert: yarn build exits 0 AND a grep of the built output finds no
      clerk.accounts.dev, upstash.io, or vercel blob endpoints
    command: TODO
    requires_permission: false
  - id: G4
    intent: 'INV1, INV7 hold: the macOS artifact is packaged (unsigned) and
      boots the local server'
    must_assert: the packaging command exits 0 and produces a .app/.dmg whose
      launch smoke check confirms the local API server responds
    command: TODO
    requires_permission: false
  - id: G5
    intent: 'INV2 holds: chat history and sessions persist across an app
      restart using only local storage'
    must_assert: a test saves a chat + session, tears down the store,
      re-initializes it, and reloads the identical payload with no network
    command: TODO
    requires_permission: false
  - id: G6
    intent: 'INV6 holds: scope clean — transport/storage/auth only'
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
  max_turns: 40
  max_consecutive_failures: 3
  preflight_estimate: required

kill:
  after_turns: 18
  gate: G1

graduate: G1–G6 exit 0 AND review verdict=pass AND scope clean, rerun from a
  fresh clone of the repo
scale: graduated AND a manual runtime pass on the packaged artifact completes a
  real chat turn, a draft export, and a verify run offline-except-Anthropic, and
  confirms a macOS keychain entry holds the Anthropic key (product loop)

ledger:
  turns: 0
  consecutive_failures: 0
  blockers: []
  lessons: []
---

## Context

Repository: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`.
Node v24, yarn 4 (`packageManager: yarn@4.9.1`). Package the existing V4
California Law Chatbot as a self-contained Electron macOS app. This is a
transport + storage + auth change, **not** a rewrite of the AI or compliance
logic. Do not move or delete any existing file; add new files and adapt wiring
only.

**Current production architecture (what exists today):**

- Front end: React 19 + Vite, SPA in `App.tsx` / `index.tsx`, four routes into
  `components/v2/V2{Chat,Draft,Verify,DraftingMagic}Page.tsx`.
- Serverless API (`api/`, runs on Vercel):
  - Entry/guard: `api/_lib/httpGuard.ts` (Clerk `requireUser`, CORS allowlist,
    session-ownership, Upstash rate limit). `api/chats.ts` reimplements Clerk
    auth locally instead of using httpGuard (change both, or route both through
    one local auth shim).
  - Turn engine: `api/_lib/agentProxy.ts` (fail-closed server-side PII regex
    backstop → 503) then `api/_lib/agentLoop.ts` (the ONLY code that calls the
    Anthropic Messages API; primary model claude-fable-5, automatic failover
    claude-opus-5 on model-unavailable 404; bounds iterations, dispatches
    tools, computes per-turn policy, writes audit/manifest).
  - Compliance (fail-closed, server-authoritative): `api/_lib/compliance/policyEngine.ts`
    (`decidePolicy`), `api/_lib/compliance/toolQueryGuard.ts` (last-mile
    outbound exfiltration guard; every branch defaults to allowed:false).
  - Tool registry: `api/_lib/tools/index.ts` (`dispatchTool`, per-tool
    try/catch → `is_error` tool_results). Public-law tools:
    `courtlistenerSearch.ts`, `legiscanSearch.ts`, `openstatesSearch.ts`,
    plus `statuteVerify.ts`, `citationVerify.ts`, `californiaCodeLookupTool.ts`.
  - State: `api/_lib/sessionStore.ts` (Upstash Redis — session messages/meta,
    24h tool-result idempotency cache, `acquireLock`/`releaseLock` single-flight
    turn lock, `rateLimitHit` counter). Chat payloads also persist to Vercel
    Blob via `api/chats.ts`. Audit: `api/_shared/auditLog.ts` (Upstash +
    HMAC chain, fail-open by design).
  - Models: `api/_lib/approvedModels.ts` (`assertApprovedModel` throws on any
    non-listed id — keep fail-closed).
- On-device sanitization (BEFORE any text leaves the browser):
  - Shared deterministic regexes: `api/_shared/sanitization/patterns.ts` (SSN,
    phone, card, CA_DRIVER_LICENSE `A1234567`, …), analyzer
    `api/_shared/sanitization/index.ts` (the "analyze" pipeline).
  - Wire pipeline the browser runs before fetch:
    `services/sanitization/detectionPipeline.ts` (`detectPii`) +
    `services/sanitization/wireGuard.ts` (`assertNoRawPii`).
  - On-device NER: `services/sanitization/glinerWebClient.ts` runs the
    `urchade/gliner_multi_pii-v1` fp32 ONNX model (~1.15 GB) entirely in-page
    via the `gliner` npm package when `VITE_DETECTOR=web`; falls back to a local
    Python GLiNER daemon (`tools/gliner-daemon/`) otherwise. For the desktop
    app, standardize on the in-page detector so NO external daemon is needed.
  - The two pipelines share `patterns.ts` and CAN DRIFT — that drift is exactly
    the live T-PII-032 bug. Keep them in sync.
- Legal-search egress (the ONLY non-Anthropic network calls, and they are
  intentional product value): CourtListener, LegiScan, OpenStates public-law
  APIs, gated by `toolQueryGuard`.

**Known-live bug this contract MUST fix (not work around):**
`./node_modules/.bin/tsx tests/traps/runTrapsWire.mjs` currently fails trap
**T-PII-032** — a California driver-license number (`A1234567`) is NOT
tokenized by the on-device wire pipeline (119/120). In a self-contained desktop
app the on-device tokenizer is the ONLY PII gate before Anthropic, so this must
be fixed and BOTH trap runners (`runTraps.mjs` and `runTrapsWire.mjs`) must exit
0 at 100% with zero skips before the app is considered done.

**Electron packaging notes:**
- `electron` + `electron-builder` are NOT yet in `package.json`; Build Mode adds
  them (devDependency) and a `main` entry. Electron main process runs Node, so
  `better-sqlite3` (already a dependency) works natively.
- Use Electron `safeStorage` (macOS Keychain) for the Anthropic key; fall back
  to a gitignored local file only with an explicit code comment.
- The in-page GLiNER model is fetched once from HuggingFace and cached; the app
  may either bundle it via `electron-builder` `extraResources` or download on
  first run — Build Mode chooses, but runtime must work after that one fetch.
- CSP collapses to `connect-src 'self' http://localhost:* https://api.anthropic.com`
  plus the three public-law API hosts.

## Build Loop vs Product Loop

**Build loop (provable now, offline):** static route-parity and no-hosted-import
tests, local storage round-trip, keychain/local key resolution, the three
offline suites (sanitization + both trap runners at 100% incl. T-PII-032),
`yarn build` clean, and an unsigned packaging smoke artifact. All of this runs
with a stubbed Anthropic client and zero network.

**Product loop (only after ship):** a real attorney launches the packaged app,
completes a real streaming chat turn, a DOCX/PDF draft export, and a citation
verify with NO connectivity except the Anthropic stream; the Anthropic key sits
in macOS Keychain; chat history survives an app restart. The build model may NOT
claim this from gate success.

## Verification Narrative

1. Run the desktop smoke harness (Build Mode resolves `scripts/desktop-smoke.mjs`
   or equivalent): boots the local server, runs a stubbed turn, asserts route
   parity + local storage round-trip + key resolution, exits 0.
2. Run `tsx tests/sanitization.test.mjs` → exit 0.
3. Run `tsx tests/traps/runTraps.mjs` → 100/100, exit 0.
4. Run `./node_modules/.bin/tsx tests/traps/runTrapsWire.mjs` → **120/120, exit
   0, zero skips** (T-PII-032 fixed).
5. Run `yarn build` → exit 0; `rg -i 'clerk|upstash|vercel' dist/` (or the
   built output dir) returns no hosted-service endpoint references.
6. Run the packaging command (Build Mode resolves, e.g.
   `electron-builder --mac --dir` or a scripted equivalent) → exit 0 and a
   launch smoke check confirms the local API server responds.
7. Persistence: save a chat + session, kill the store, re-init, reload identical
   payload with no network.
8. Confirm `git diff --name-only` ⊆ scope.in and no scope.forbid path touched.
9. Manual product check (post-graduate): install the artifact, complete a real
   chat/draft/verify offline-except-Anthropic, confirm the key is in Keychain.
