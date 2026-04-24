# Bedrock Confidentiality Implementation Plan

**Date:** April 24, 2026  
**Branch:** `codex/bedrock-confidentiality-migration`  
**Source PRD:** `Santization.md`  
**Status:** Implementation-ready plan, before code hardening pass

---

## 1. Build Principle

The migration should be implemented as two clearly separated products inside the same app:

1. **Accuracy / client-safe workflow:** sanitized legal research through Bedrock, CEB, official legal sources, and approved sanitized current-data providers.
2. **Speed / non-client passthrough workflow:** fast broad-web research, explicitly not for client-confidential facts.

The critical rule is simple: **client-confidential text never reaches broad external search or non-Bedrock generative models.** The UI may explain that rule, but the backend must enforce it.

---

## 2. Immediate Release Blockers

These should be fixed before adding larger features.

| Priority | Blocker | Current Risk | Required Outcome |
|---|---|---|---|
| P0 | Speed route is policy-only | `/api/anthropic-chat` can be directly called with raw client text and broad search can trigger | Server-side flow authorization blocks client-safe/Accuracy requests from Speed and prevents hidden-route bypass |
| P0 | Legislative search result discarded | Legislative lookup adds latency without contributing sources | Legislative results are retained, ranked, summarized, and rendered as first-class sources |
| P1 | Bedrock model IDs unverified | Guessed or stale Gemini aliases can reach Bedrock calls | Exact Bedrock profile IDs are verified from AWS account evidence and pinned; `GEMINI_*` fallbacks removed |
| P1 | Research-agent recall regression | Deterministic one-pass retrieval loses old tool-calling behavior | Restore tool-calling/refinement or prove no material regression on gold set |

---

## 3. Phase 0 — Stabilize The Branch

**Goal:** Make the branch safe to iterate on without disturbing production.

### Tasks
- Keep all work in `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-bedrock-confidentiality`.
- Leave the original production checkout on `main`.
- Add a branch-local `IMPLEMENTATION_STATUS.md` or update this file after each completed phase.
- Decide whether the two local compliance files should stay local-only or move to a private compliance store:
  - `AWS Artifact Agreement Inventory — Account ...md`
  - `CyberVadis+Third+Party+Risk+Management+Assessment.pdf`

### Validation
- `git status --short` shows only intentional worktree changes.
- Remote branch remains `codex/bedrock-confidentiality-migration`.
- Public GitHub repo does not contain the local compliance/vendor artifacts.

---

## 4. Phase 1 — Test Harness And Safety Gates

**Goal:** Add repeatable tests before touching the most sensitive paths.

### Tasks
- Add a lightweight Node/TypeScript test harness for API helpers and agent functions.
- Add fixture folders:
  - `tests/fixtures/confidential-prompts.json`
  - `tests/fixtures/public-legal-prompts.json`
  - `tests/fixtures/current-law-prompts.json`
  - `tests/fixtures/legislative-results.json`
- Add tests for:
  - Speed rejects client-safe flow markers.
  - Accuracy rejects unsanitized external-search calls.
  - Bedrock requests omit prompt-cache `cache_control`.
  - Bedrock model config refuses guessed IDs and stale `GEMINI_*` aliases.
  - Legislative search results are retained when provider data exists.
- Add a script such as `npm run test:confidentiality`.

### Validation
- `npm run build`
- `npm run test:verification`
- `npm run test:confidentiality`

### Exit Criteria
- Tests fail against the current unsafe behavior before fixes.
- Tests pass after Phases 2-5.

---

## 5. Phase 2 — Structural Flow Enforcement

**Goal:** Make Speed vs Accuracy a server-enforced boundary.

### Tasks
- Introduce a shared flow policy module, likely `utils/flowPolicy.ts`.
- Define explicit flow types:
  - `accuracy_client`
  - `public_research`
  - `speed_passthrough`
- Require every model/retrieval route to declare and validate its flow.
- Guard or rename `/api/anthropic-chat` as the Speed-only route.
- Ensure direct POSTs cannot bypass the intended route:
  - Require authenticated session or explicit local-dev bypass.
  - Require allowed origin in production.
  - Reject `accuracy_client` and `public_research` on Speed.
  - Reject `speed_passthrough` on client-safe Accuracy routes.
- Preserve broad web search for Speed, but only behind `speed_passthrough`.

### Validation
- Direct POST to Speed with `accuracy_client` returns a non-2xx rejection.
- Direct POST to Accuracy with `speed_passthrough` returns a non-2xx rejection.
- Non-client Speed prompt still streams normally.
- Current UI cannot accidentally label a client workflow as Speed.

### Exit Criteria
- No route can send client-flow payloads to Exa, Serper, Google Search, or other broad-web providers.

---

## 6. Phase 3 — Bedrock Adapter Hardening

**Goal:** Make Bedrock the only production generative model path for client-related flows.

### Tasks
- Verify current Bedrock model/profile IDs using AWS account evidence:
  - `aws bedrock list-inference-profiles`
  - AWS console screenshot or saved compliance note if CLI is unavailable.
- Replace guessed defaults with explicit environment variables:
  - `BEDROCK_CLAUDE_SONNET_MODEL_ID`
  - `BEDROCK_CLAUDE_HAIKU_MODEL_ID`
  - `BEDROCK_AWS_REGION`
- Remove `GEMINI_*` fallbacks from Bedrock paths.
- Fail closed if required Bedrock IDs are missing or look like legacy Gemini/OpenRouter aliases.
- Add static request checks to ensure no prompt-cache `cache_control` metadata is attached to client-confidential prompts.
- Keep embeddings migration separate unless explicitly approved; the PRD wants Titan v2 later, but the earlier migration boundary allowed OpenAI embeddings temporarily.

### Validation
- Bedrock smoke test for Sonnet profile.
- Bedrock smoke test for Haiku or approved low-latency Claude profile.
- Config test proves `GEMINI_*` variables are ignored by Bedrock code.
- Request-construction test proves prompt-cache metadata is absent.

### Exit Criteria
- Client-related generation and verification use only verified AWS Bedrock Claude model/profile IDs.

---

## 7. Phase 4 — Legislative And Current-Data Retrieval

**Goal:** Restore current-law behavior without leaking raw client facts.

### Tasks
- Fix `agents/researchAgent.ts` so `runLegislativeSearch` stores and returns `legislativeSearchTool` results.
- Normalize legislative results into the same source package shape used by CEB, statutes, and cases.
- Add provider labels and source URLs for OpenStates/LegiScan results.
- Build a sanitized current-data query broker:
  - Input: sanitized prompt plus extracted public legal terms.
  - Output: provider-specific public search queries.
  - Providers: OpenStates, LegiScan, CourtListener, optionally Exa/Google Search API after approval.
- Restrict broad current-data search to official/legal domains for Accuracy.
- Keep Speed broad-web behavior separate and unchanged for non-client prompts.

### Validation
- Query: “what new laws have been passed in 2026 in CA” returns current legislative sources when providers return data.
- Legislative fixture test fails if returned bill data is dropped.
- External-search privacy test logs/records the provider query and proves it contains no synthetic client PII.

### Exit Criteria
- Accuracy can reach current data through sanitized public legal terms.
- Legislative sources appear in the final answer and source list.

---

## 8. Phase 5 — Research-Agent Recall Restoration

**Goal:** Avoid the regression from the old Google/tool-calling path.

### Preferred Path
- Restore a Bedrock Claude tool loop for research planning:
  - Tool: CEB search.
  - Tool: statute lookup.
  - Tool: legislative search.
  - Tool: CourtListener search.
  - Tool: sanitized current-data broker.
- Allow the model to infer missing statute names and request follow-up searches.
- Keep tool inputs constrained to sanitized/public legal terms.

### Fallback Path
- If Bedrock tool calling is too slow or too complex for v1, implement deterministic retrieval plus one Claude refinement pass:
  - First pass extracts public legal entities and likely legal concepts.
  - Retrieval pass searches all allowed sources.
  - Refinement pass identifies gaps and runs one additional retrieval round.

### Validation
- Compare old Google/tool-calling behavior against the new Bedrock path on a 50-query pilot set first.
- Expand to the 200-query gold set once fixtures are stable.
- Track at least:
  - Statute recall.
  - Case recall.
  - Legislative/current-law recall.
  - CEB source relevance.
  - Latency.

### Exit Criteria
- No material recall regression on the gold set, or documented F&F acceptance of the tradeoff.

---

## 9. Phase 6 — Sanitization Layer

**Goal:** Build the client-confidentiality boundary before production UAT.

### Tasks
- Add `services/sanitization/` modules:
  - `preserveLegalEntities.ts`
  - `detectPII.ts`
  - `reconcile.ts`
  - `tokenize.ts`
  - `rehydrate.ts`
  - `audit.ts`
- Start with deterministic preservation:
  - Case citations and captions.
  - California and federal court names.
  - California statutory citations.
  - Public agencies and officials from an allowlist.
- Add PII detection:
  - Start with local/self-hosted Privacy Filter or gliner-PII benchmark.
  - Do not call OpenAI API for production PII filtering.
- Store token maps session-scoped and encrypted.
- Add post-flight regex audit.

### Validation
- Gold-set sanitizer tests:
  - ≥99% legal entity preservation.
  - ≥95% private PII recall.
- Case caption preservation tests:
  - Preserve public case captions.
  - Tokenize private party names when not part of a public authority.
- Rehydration tests prove token maps never leave the app trust boundary.

### Exit Criteria
- Client-related Accuracy routes cannot call external retrieval or Bedrock unless sanitization succeeds.

---

## 10. Phase 7 — Audit, Logging, And Observability

**Goal:** Make supervision useful without storing client facts.

### Tasks
- Add audit event schema:
  - attorney/user ID.
  - timestamp.
  - KMS-keyed HMAC of sanitized query.
  - flow type.
  - model/profile ID.
  - source providers used.
  - PII category counts.
  - warning flags.
  - latency.
- Scrub request/response bodies from app logs.
- Replace query-body console logs.
- Add incident event for Pass 6 audit warnings.
- Decide initial storage:
  - v1 local/dev JSON log for testing.
  - production S3 Object Lock after AWS setup.

### Validation
- Test prompt containing synthetic PII does not appear in console output.
- Audit log contains metadata and HMAC only.
- Pass 6 warning creates an incident event.

### Exit Criteria
- Debuggability exists without payload leakage.

---

## 11. Phase 8 — UI And Product Boundary

**Goal:** Make the safe path obvious to attorneys.

### Tasks
- Add confidentiality banner.
- Add first-session attestation.
- Add sanitization preview UI.
- Make Speed visibly “Non-client research only.”
- Disable or hide Speed in F&F client-workflow configuration.
- Add warning copy next to current-data retrieval when sanitized external search is enabled.

### Validation
- Browser test for Accuracy query with preview.
- Browser test for Speed non-client query.
- Browser test proving client workflow cannot select Speed if disabled.

### Exit Criteria
- The UI communicates the rule, but backend tests prove the rule does not depend on user behavior.

---

## 12. Phase 9 — Deployment And Production Readiness

**Goal:** Ship only after the exact confidentiality and research behaviors are tested.

### Tasks
- Configure Vercel environment variables for the branch/preview.
- Configure AWS credentials/profile for Bedrock in the deployment environment.
- Confirm Bedrock invocation logging is disabled.
- Confirm approved current-data providers and sub-processor status.
- Run full synthetic UAT before real attorney queries.
- Prepare rollback plan to current production `main`.

### Validation
- `npm run build`
- `npm run test:verification`
- `npm run test:confidentiality`
- Bedrock live smoke tests.
- Current-law live test.
- Speed live test.
- Accuracy sanitized live test.
- Browser smoke test against preview deployment.

### Exit Criteria
- Use `ITS_DONE_TESTED` only after the deployed preview exercises the full user-visible flow end to end.

---

## 13. Recommended Work Order

1. Add the test harness and confidentiality fixtures.
2. Fix Speed route enforcement.
3. Verify and pin Bedrock model/profile IDs.
4. Remove Gemini/OpenRouter fallback aliases from Bedrock paths.
5. Fix legislative search retention.
6. Restore research-agent recall with Bedrock tool calling or refinement.
7. Build the sanitization service.
8. Add audit/log scrubbing.
9. Add UI preview/attestation/banners.
10. Run live Bedrock, current-data, and browser tests.

This order intentionally fixes the known P0/P1 review findings before adding the heavier sanitizer and SSO work.

---

## 14. Concrete Next Sprint

### Sprint Objective
Turn the current branch from “migration prototype” into “safe to test internally with synthetic data.”

### Sprint Tasks
- Add `test:confidentiality`.
- Add flow policy helper and route guards.
- Rename or guard `/api/anthropic-chat` as Speed-only.
- Verify Bedrock IDs and remove guessed defaults.
- Remove `GEMINI_*` fallback behavior from Bedrock code.
- Fix legislative result retention.
- Add three synthetic current-law regression prompts:
  - “what new laws have been passed in 2026 in CA”
  - “what California bills about electric bicycles were active in 2025-2026”
  - “has California changed its lemon law procedures recently”

### Sprint Done Means
- Build passes.
- Confidentiality tests pass.
- Legislative test proves returned bill data is surfaced.
- Speed still works for non-client broad-web prompts.
- Accuracy no longer sends raw client text to broad external search.

---

## 15. Decisions Needed From Arjun / F&F

1. Should Speed be available inside the F&F deployment at all, or only kept for Arjun/dev non-client use?
2. For sanitized current data, should v1 default to official-only sources or allow Exa/Google Search API after vendor approval?
3. Should the API layer stay on Vercel for v1, or move to AWS Lambda before F&F UAT?
4. Which SSO provider will F&F use?
5. Is Titan v2 embedding migration required before launch, or can OpenAI embeddings remain temporarily while no client prompts are embedded?

