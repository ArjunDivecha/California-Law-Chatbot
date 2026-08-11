---
type: Reference
title: Compliance and storage layer
description: "The server-authoritative compliance and storage layer under api/_lib/compliance/: PRD-phase P3 policy decision + tool gating, P4 provider registry + per-turn manifest, P5 storage policy + firm-controlled store + local embeddings, P6 attestations + review gates + conflicts, P7 billing + bias review + governance. Wiring status per module, fail-closed vs fail-open conventions, invariants, and focused tests."
tags: [compliance, policy-engine, provider-registry, storage-policy, firm-controlled-store, attestations, review-gate, conflicts, billing, bias-review, governance, matter-mode]
openwiki:
  roles: [architecture, domain, operations, workflow]
  change_kinds: [lifecycle, public-api]
  source_paths:
    - api/_lib/compliance/policyEngine.ts
    - api/_lib/compliance/toolQueryGuard.ts
    - api/_lib/compliance/turnManifest.ts
    - api/_lib/compliance/providerRegistry.ts
    - api/_lib/compliance/storagePolicy.ts
    - api/_lib/compliance/sqliteVecStore.ts
    - api/_lib/compliance/localEmbeddings.ts
    - api/_lib/compliance/attestations.ts
    - api/_lib/compliance/reviewGate.ts
    - api/_lib/compliance/conflicts.ts
    - api/_lib/compliance/billing.ts
    - api/_lib/compliance/biasReview.ts
    - api/_lib/compliance/governance.ts
    - api/_lib/compliance/securityHeaders.ts
    - api/_lib/compliance/matterContext.ts
    - api/_lib/agentLoop.ts
    - api/matter-context.ts
  symbols:
    - decidePolicy
    - PolicyDecision
    - ALL_TOOLS
    - ToolId
    - guardToolQuery
    - buildTurnManifest
    - providerSnapshot
    - selectStore
    - FirmControlledStore
    - getFirmControlledStore
    - setFirmControlledStore
    - consentSatisfiedFor
    - recordClientConsent
    - evaluateReviewGates
    - validateMatterTransition
  test_paths:
    - tests/toolGating.test.mjs
    - tests/turnPolicy.test.mjs
    - tests/providerRegistry.test.mjs
    - tests/storagePolicy.test.mjs
    - tests/sqliteVecStore.test.mjs
    - tests/localEmbeddings.test.mjs
    - tests/p6Compliance.test.mjs
    - tests/p7Compliance.test.mjs
    - tests/matterContext.test.mjs
    - tests/approvedModels.test.mjs
    - tests/routeSecurity.test.mjs
  invariants:
    - "Matter binding drives the mode; detection may only ESCALATE the mode, never lower it."
    - "protected_discovery is a locked flag; downgrading out of it requires an explicit attorney override (logged)."
    - "Gating is fail-CLOSED (policyEngine, toolQueryGuard, PII backstop); audit/manifest/rate-limit/ownership plumbing is deliberately fail-OPEN."
    - "The turn manifest stores hashes + structured metadata only — never raw client text, the token map, or the prompt."
    - "getFirmControlledStore() throws rather than silently falling back to a third-party store for protected/restricted data."
    - "public_research lets raw PII reach Anthropic by design; confidential/protected modes behave differently."
  validation_commands:
    - "npx tsx tests/toolGating.test.mjs"
    - "npx tsx tests/turnPolicy.test.mjs"
    - "npx tsx tests/providerRegistry.test.mjs"
    - "npx tsx tests/storagePolicy.test.mjs"
    - "npx tsx tests/p6Compliance.test.mjs"
    - "npx tsx tests/p7Compliance.test.mjs"
---

# Compliance and storage layer

AskPauli treats legal compliance as a first-class product constraint, not a deployment footnote. The modules under `api/_lib/compliance/` encode the server-authoritative trust boundary described in `docs/PRD_COPRAC_ZDR_COMPLIANCE.md`: which tools may run, which providers may receive which data, where data may live, which human-review gates are required, and what must be disclosed. They are organized by PRD phase (P3–P7). The policy engine is the decision point the agent loop consults every turn; the surrounding modules refine, enforce, or evidence that decision.

This page is the canonical code home for the compliance layer. The policy engine's role in the request flow and the matter-mode/consent concepts are explained in [architecture](architecture.md) and the [domain model](domain-model.md); the user-facing matter-mode/consent workflow is in [workflows](workflows.md). This page covers the modules, their wiring status, invariants, and how to change them.

## Phase map and wiring status

Each module is pure (no I/O) unless noted. "Wired" means a production call path reaches it; "policy-supporting" means it has focused tests and a clear contract but no production caller yet — it is provisioned infrastructure or a gate that export/file/send routes will call.

| Phase | Module | Role | Wired by | Test |
|---|---|---|---|---|
| P3 | `policyEngine.ts` | `decidePolicy()` — the server-authoritative decision point | `agentLoop.ts` | `turnPolicy.test.mjs` |
| P3 | `toolQueryGuard.ts` | outbound exfiltration guard (fail-closed re-check at dispatch) | `agentLoop.ts` | `toolGating.test.mjs` |
| P4 | `turnManifest.ts` | per-turn structured compliance record (hashes + metadata only) | `agentLoop.ts` + `auditLog.ts` | `providerRegistry.test.mjs` |
| P4 | `providerRegistry.ts` | evidence-backed truth for which provider may receive which data class/mode | `storagePolicy.ts`, `turnManifest.ts` | `providerRegistry.test.mjs` |
| P5 | `storagePolicy.ts` | where data may live, retention, matter-scoped isolation, firm-store adapter | policy-supporting | `storagePolicy.test.mjs` |
| P5-infra | `sqliteVecStore.ts` | firm-controlled sqlite-vec vector store (protected/restricted data) | injected via `setFirmControlledStore` | `sqliteVecStore.test.mjs` |
| P5-infra | `localEmbeddings.ts` | loopback BGE-M3 embeddings daemon client (no third-party egress) | policy-supporting (zero callers) | `localEmbeddings.test.mjs` |
| P6 | `matterContext.ts` | "locked protected flag" transition logic (no accidental downgrade) | `matter-context.ts` (API) | `matterContext.test.mjs` |
| P6 | `attestations.ts` | server-side client AI consent + attorney policy ack | `matter-context.ts` | `p6Compliance.test.mjs` |
| P6 | `reviewGate.ts` | lawyer review gates for copy/print/export/file/send | policy-supporting | `p6Compliance.test.mjs` |
| P6 | `conflicts.ts` | ethical walls / adverse-party cross-matter signals | policy-supporting | `p6Compliance.test.mjs` |
| P6 | `securityHeaders.ts` | response hardening headers | `routeSecurity.ts` | `routeSecurity.test.mjs` |
| P7 | `billing.ts` | fee-rule guards (Rules 1.5 / B&P 6147-6148) | policy-supporting | `p7Compliance.test.mjs` |
| P7 | `biasReview.ts` | COPRAC 8.4.1 deterministic bias/discrimination review gates | policy-supporting | `p7Compliance.test.mjs` |
| P7 | `governance.ts` | recertification/staleness (reads providerRegistry) | policy-supporting | `p7Compliance.test.mjs` |

The `approvedModels.ts` family-scoped model guard (P3, fail-closed at the Anthropic call site) is documented in [architecture](architecture.md) and the [domain model](domain-model.md); its test is `tests/approvedModels.test.mjs`.

## P3 — Policy decision and tool gating

`policyEngine.ts` `decidePolicy(input: PolicyInput): PolicyDecision` is the gate the agent loop consults every turn. It takes the bound matter mode, client consent, detected data classes, requested action, and user role, and returns the effective mode (after detection-driven escalation), whether external calls are allowed, the tokenization level, allowed/blocked tool ids, required review gates, evidence sinks, and disclosures. `ALL_TOOLS` is the seven logical tool ids (`web_search`, `courtlistener`, `legiscan`, `openstates`, `citation_verify`, `ca_code`, `mcp`); the tools registry maps each Anthropic tool name to one of these via `TOOL_POLICY_ID` and `buildToolsForPolicy` includes a tool only when its id is in `decision.allowedTools`. See the tool registry table in the [domain model](domain-model.md).

`toolQueryGuard.ts` `guardToolQuery` is the defense-in-depth re-check at dispatch time: every outbound tool query is checked against the policy id, and the guard is fail-closed — every branch defaults to `allowed: false`. The agent loop calls it before any in-process tool runs.

The P3 wiring is exercised by two tests. `turnPolicy.test.mjs` verifies `computeTurnPolicy()` (the live-path glue in `agentLoop.ts`): it reads the session matter mode from Redis, escalates on unambiguous PII (not bare names), and produces a `PolicyDecision` whose `allowedTools` gate `web_search` correctly. `toolGating.test.mjs` exercises `buildToolsForPolicy()` and `guardToolQuery()` against real `PolicyDecision` values.

## P4 — Provider registry and per-turn manifest

`providerRegistry.ts` is a single source of truth for which third-party providers may receive which data classes in which matter modes, backed by evidence (not marketing claims). It encodes the mid-2026 verified facts: Anthropic Messages API under standard commercial terms + DPA (no training on API content; F&F declined the ZDR at its ~$100k/yr commitment); Upstash Redis DPA §12.4 prohibits "Restricted Data" (`sensitive_personal_data`); CourtListener/LegiScan/OpenStates are public-law APIs with query logs. The `openai_embeddings` and `upstash_vector` entries were removed when CEB search was retired (2026-07-03). `isProviderApprovedFor(providerId, mode, dataClass, asOf)` is the predicate `storagePolicy.ts` consults; `providerSnapshot()` feeds the turn manifest.

`turnManifest.ts` `buildTurnManifest(input)` produces the per-turn record a lawyer or court would need: matter mode, the policy decision, providers/tools permitted vs. actually called, model id, review gates, evidence sinks, and a **HMAC of the sanitized prompt**. The governance invariant (PRD §5.9a — "the audit trail is itself discoverable") is that the manifest stores hashes + structured metadata only: `buildTurnManifest` takes a precomputed HMAC, not the prompt, so raw text cannot leak in by construction. The agent loop persists it via `writeTurnManifest` in `api/_shared/auditLog.ts`.

## P5 — Storage policy and the firm-controlled store

`storagePolicy.ts` decides where a matter's conversation/vector data may live, for how long, and whether it must be tokenized first (PRD §5.7):

- `protected_discovery` ⇒ firm-controlled store only (Upstash DPA §12.4 forbids Restricted Data).
- `client_confidential` with `sensitive_personal_data` ⇒ firm-controlled too.
- `client_confidential` (non-sensitive) ⇒ cloud (Upstash) permissible only if approved, and — finding F3 — client content must be **tokenized before it lands** in the cloud store (`tokenizeBeforeStore: true`), because the cloud store retains at rest whatever it is given.
- `public_research` ⇒ cloud, no tokenization needed.

`selectStore(mode, dataClass, asOf)` returns `{ target, reason, tokenizeBeforeStore }`; `effectiveRetention(mode, litigationHold)` returns retention windows (public 90d, confidential 365d, protected retain-until-resolved; a litigation hold forces retain); `matterScopedKey(matterId, base)` namespaces keys so one matter's data can't be read under another.

The firm-controlled store itself is represented by a fail-closed adapter interface `FirmControlledStore` (`put`/`get`): `getFirmControlledStore()` **throws** rather than silently falling back to a third-party store for protected/restricted data ("FAIL IS FAIL — no unauthorized fallbacks"). It is provisioned at boot via `setFirmControlledStore()`.

`sqliteVecStore.ts` is the firm-controlled store implementation: an embedded SQLite database with the `sqlite-vec` extension for vector kNN, matter-scoped upsert/query, implementing `FirmControlledStore`. It runs on the **firm's host** (a local/on-prem process), not Vercel serverless (which is ephemeral and can't hold a persistent SQLite file or reach the local embedding daemon). It is wired via `storagePolicy.setFirmControlledStore(new SqliteVecStore(...))`.

`localEmbeddings.ts` is the loopback embeddings daemon client: for protected_discovery, embeddings must be computed without sending client text to a third party, so this client talks to a LOCAL BGE-M3 / Qwen3-Embedding daemon over loopback (same pattern as the OPF/GLiNER daemon). It is **fail-closed**: if `EMBEDDINGS_DAEMON_URL` is unset or the daemon is unreachable/malformed, it throws — it never silently falls back to a cloud embedding provider. It has zero callers today (the CEB re-embed script it originally supported was removed with CEB retirement); it is general-purpose infra for future firm-controlled protected-discovery content.

## P6 — Attestations, review gates, conflicts, matter transitions

`attestations.ts` records and reads — server-side, versioned, per session — the two things COPRAC requires before confidential AI work (PRD §5.10): the client's AI-use consent status and the supervising attorney's policy acknowledgment. `consentSatisfiedFor(mode, status)` is the pure predicate: `public_research` needs no consent; confidential/protected work requires `allowed` or `restricted`. `recordClientConsent` / `recordAttorneyPolicyAck` persist into session meta via `sessionStore.ts`. The matter-context API (`api/matter-context.ts`) calls these on every POST.

`matterContext.ts` `validateMatterTransition(current, requestedMode, opts)` is the "locked protected flag" safety logic: entering `protected_discovery` locks it on, and downgrading out of a locked protected matter requires an explicit `attorneyOverride` (logged by the caller). Escalation is always allowed. The matter-context API enforces this and returns 409 on a locked downgrade.

`reviewGate.ts` `evaluateReviewGates(required, satisfied)` is the chokepoint the export/file/send routes will call: before a draft is copied, printed, exported, filed, or sent, COPRAC requires meaningful lawyer review (PRD §5.11). An action with unmet gates is not permitted — no autonomous filing/sending. It is pure and test-covered but not yet on a production call path.

`conflicts.ts` adds the ethics layer on top of matter isolation (PRD §5.13): a conflict signal when a client of one matter is an adverse party in another, and a rule that cross-matter retrieval is blocked unless an authorized attorney recorded a link with a conflict/joint-representation basis. The firm's practice-management system remains the system of record for conflicts; this module ensures the chatbot never breaches a wall. Pure, test-covered, not yet wired.

`securityHeaders.ts` exports `securityHeaders` applied by `api/_shared/routeSecurity.ts` `applyResponseSecurity` to every response (hardening headers + exact-origin allowlist).

## P7 — Billing, bias review, governance

`billing.ts` classifies costs and validates entries against COPRAC + Rules 1.5 / B&P §§6147-6148 (PRD §5.14): don't bill AI runtime as attorney time; general AI subscription/infra is non-billable overhead; matter-specific provider pass-through may be billed only at actual cost, disclosed, with no markup absent informed written consent. The chatbot exports billing-support metadata, not invoices.

`biasReview.ts` implements COPRAC Rule 8.4.1 / PRD §5.15 with deterministic refusal/review rules (no unvalidated bias classifier): workflows with bias/discrimination risk (`BIAS_SENSITIVE_WORKFLOWS` — intake prioritization, case valuation, employment, housing, immigration, family, criminal, disability/medical, credibility assessment, settlement recommendation, client selection) require a human review gate, and certain protected-class-sensitive decisions may not be made autonomously by the AI.

`governance.ts` computes whether a recertification is due and surfaces stale provider-registry entries (COPRAC competence/supervision, Rules 1.1 / 5.1; PRD §5.4, §12 Epic 12), so an admin can export the current governance state for counsel review and a CI/runtime gate can block on staleness. It reads the in-memory provider registry via `staleProviders` / `listProviders`.

## Fail-closed vs fail-open convention

This convention is load-bearing and documented in `CLAUDE.md` gotcha 4. Do not "harden" a fail-open path into fail-closed without understanding the availability tradeoff:

- **Fail-CLOSED** (block on error): `policyEngine`, `toolQueryGuard`, the PII regex backstop in `agentProxy.ts` (returns 503), `localEmbeddings`, `getFirmControlledStore`, `approvedModels`.
- **Fail-OPEN** (by design, with comments saying so): rate limiting (`httpGuard.ts`), session-ownership on a KV blip (`httpGuard.ts`), and audit/manifest writes (`api/_shared/auditLog.ts`) — a turn should not fail because an audit write blipped.

A related intentional design choice: `public_research` matter mode lets raw PII reach Anthropic by design (the DPA-covered direct channel is treated as safe); escalation only strips third-party tool egress, it does not hard-block the Anthropic call. Confidential/protected modes behave differently. Know this before changing matter-mode logic.

## Invariants

1. **Matter mode escalation floor.** Matter binding drives the mode; detection may only escalate it, never lower it (PRD §5.1, §5.3).
2. **Locked protected flag.** `protected_discovery` locks on entry; downgrading requires an explicit, logged attorney override (`validateMatterTransition`).
3. **Gating fail-closed, plumbing fail-open.** Policy/tool/PII gates block on error; rate-limit/ownership/audit plumbing fails open by design.
4. **Manifest stores hashes only.** `buildTurnManifest` takes a precomputed HMAC, never the prompt; the audit trail is itself discoverable (PRD §5.9a).
5. **No unauthorized store fallback.** `getFirmControlledStore()` throws if unprovisioned rather than falling back to a third-party store for protected/restricted data.
6. **No unauthorized embedding fallback.** `localEmbeddings` throws if the daemon is unreachable; it never falls back to a cloud embedding provider for protected data.

## Focused tests

None of these tests are wired to npm scripts (per `CLAUDE.md` gotcha 7 — only `test:sanitization` and `test:traps` are). Run them directly via `tsx`:

```bash
npx tsx tests/toolGating.test.mjs        # P3 buildToolsForPolicy + guardToolQuery
npx tsx tests/turnPolicy.test.mjs        # P3b agent-loop computeTurnPolicy wiring
npx tsx tests/providerRegistry.test.mjs # P4 provider registry + turn manifest
npx tsx tests/storagePolicy.test.mjs    # P5 selectStore, retention, matter-scoped keys, fail-closed store
npx tsx tests/sqliteVecStore.test.mjs   # P5-infra firm-controlled vector store
npx tsx tests/localEmbeddings.test.mjs  # P5-infra local embeddings daemon client (fail-closed)
npx tsx tests/p6Compliance.test.mjs     # P6 attestations + review gates + conflicts + security headers + wiring
npx tsx tests/p7Compliance.test.mjs     # P7 billing + bias review + governance
npx tsx tests/matterContext.test.mjs    # P6 matter-mode transitions (locked protected flag)
npx tsx tests/approvedModels.test.mjs   # P3 family-scoped model approval guard
npx tsx tests/routeSecurity.test.mjs    # P6 route security (CORS + hardening headers)
```

`storagePolicy.test.mjs` is the canonical place to verify the F3 tokenization rule (confidential non-sensitive ⇒ cloud but `tokenizeBeforeStore: true`) and the fail-closed firm-store behavior (throws when unprovisioned). `p6Compliance.test.mjs` is the canonical place for the consent predicate, review-gate arithmetic, and conflict signals.

## Change guidance

### Adding a provider or updating provider approval

This is a compliance event, not a code-only change. Update `providerRegistry.ts` with evidence-backed `ProviderEvidence` (source, url, retrievedAt), set `dataClassesAllowed` / `mattersAllowed` / `trainsOnData`, and record counsel sign-off. If the provider changes where data may live, also update `storagePolicy.ts` `selectStore`. Run `npx tsx tests/providerRegistry.test.mjs` and `npx tsx tests/storagePolicy.test.mjs`. If the provider is a model, see the model-add guidance in [architecture](architecture.md) (update `approvedModels.ts` evidence and disclosure copy; record counsel sign-off per `docs/PRD_COPRAC_ZDR_COMPLIANCE.md` §5.8).

### Adding a firm-controlled storage target

Implement the `FirmControlledStore` interface (or extend `sqliteVecStore.ts`), provision it at boot via `setFirmControlledStore()`, and confirm `getFirmControlledStore()` throws when unprovisioned. Keep matter isolation: every read filtered by `matter_id`. Run `npx tsx tests/sqliteVecStore.test.mjs` and `npx tsx tests/storagePolicy.test.mjs`.

### Adding a review gate or bias-sensitive workflow

Add the gate id to the policy engine's `requiredReviewGates` for the relevant action/mode, confirm `evaluateReviewGates` covers it, and — for bias — add the workflow to `BIAS_SENSITIVE_WORKFLOWS` in `biasReview.ts`. Run `npx tsx tests/p6Compliance.test.mjs` (review gates) or `npx tsx tests/p7Compliance.test.mjs` (bias). Wire the gate into the export/file/send route when the action goes live.

### Changing matter-mode transitions

Edit `validateMatterTransition` in `matterContext.ts`. The non-negotiable contract is the locked-protected-flag: a locked `protected_discovery` must not downgrade without an explicit, logged override. Add cases to `tests/matterContext.test.mjs` covering: escalation, downgrade without override (blocked), downgrade with override (allowed, unlocks), entering protected (locks on). Run `npx tsx tests/matterContext.test.mjs`.

## Scope boundaries

- The policy-supporting modules (`reviewGate`, `conflicts`, `billing`, `biasReview`, `governance`, `localEmbeddings`) are pure and test-covered but not yet on a production call path; they are provisioned scaffolding for export/file/send routes and firm-controlled infra. A module having a focused test does not imply it is wired into the agent loop.
- `sqliteVecStore.ts` and `localEmbeddings.ts` run on the firm's host, not Vercel serverless; they cannot be exercised in a Vercel function cold start.
- The firm's practice-management system remains the system of record for conflicts and invoices; these modules exist so the chatbot does not breach a wall or mis-bill, not to replace it.
