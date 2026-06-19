# California Law Chatbot — Ultrathink Review
Date: 2026-06-16
Reviewer: Claude (Opus 4.8), executing `ca-law-chatbot-review.skill`

## How this review was run (two deviations from the skill, stated up front)

1. **Source of truth = the on-disk working tree, not GitHub.** The skill instructs pulling files via a `PM:github` / `PM:search` knowledge-base tool that is not available in this session. The live working tree is *more* current than GitHub anyway — the Fable-5 engine switch and the new `statute_verify` tool are uncommitted (`git status`: `M api/_lib/agentLoop.ts`, `M agents/california-legal/agent.json`, `?? api/_lib/tools/statuteVerify.ts`, …). Every finding below is grounded in a file path I read directly.
2. **Target = V2, not the V1 repo the skill names.** The skill's "Known Codebase Context" block is stale: it says LLM = **Gemini 2.5 Pro**, frontend = **Next.js**, and names the repo `ArjunDivecha/California-Law-Chatbot`. None of that matches the live product. The active codebase is **V2** (branch `V2`): Anthropic-only **Claude Fable 5** primary engine, **Vite + React 19** (not Next.js), an in-process agent loop on the Messages API, and on-device GLiNER PII tokenization. V1 `main` is frozen (last meaningful commit 2026-05-16) and slated for deletion in "Phase 5b." Per the skill's own ultrathink rule — *"assume nothing works until proven; verify every claim against actual code"* — I did not load the stale context as fact. **I reviewed V2.** If you wanted the frozen V1 `main`, say so and I'll repoint. **The skill itself needs updating** (model, framework, and the V1→V2 architecture pivot); I note specific corrections at the end.

---

## Executive Summary

V2 is a genuinely well-built privilege-first legal-AI workbench whose core invariant — client identifiers never leave the attorney's laptop in raw form — is real, implemented, and empirically gated (120/120 trap pass re-validated 2026-06-10). The sanitization layer, the single inference call-site, and the metadata-only audit chain are senior-grade work with an unusually strong evidence culture. **But the product is not deployment-safe today for one blunt reason: the inference and write endpoints have no authentication.** Anyone who learns the production URL can spend Fable-5 tokens and append turns into any session, with a forged `user_id` landing in the 7-year audit record — the single largest gap between what the design documents promise (plan §A.1) and what the code does. Two further pre-deploy issues compound it: a model **refusal renders as a blank screen** (no handling of `stop_reason: "refusal"`), and the State Bar **disclosure modal is a soft, dismissable, placeholder-copy gate mounted on only one of four pages**. Everything else is the normal debt of a fast-moving rewrite — thin test coverage outside sanitization, no timeouts/retries on most external tools, no rate limiting, no prompt caching, and ~7,800 lines of frozen V1 code still in the tree.

Overall health: **strong core, unsafe edges.** Do not flip the Phase 5a cutover until the Immediate list below is closed.

---

## Pass 1: Architecture & System Design

### Strengths
- **One file talks to the model.** `api/_lib/agentLoop.ts` (`runTurn` / `runTurnStream`) is the only caller of `messages.create`/`stream`; `api/_lib/agentProxy.ts` wraps it with the sanitization gate + audit writes; five thin routes under `api/agent/*` consume it. Clean choke point — exactly what you want for a privilege-critical system.
- **Separation of concerns is clean**: detection (`services/sanitization/*`, `api/_shared/sanitization/*`) ↔ tools (`api/_lib/tools/*`, uniform `dispatchTool` switch) ↔ sessions (`api/_lib/sessionStore.ts`, Upstash KV) ↔ prompt composition (`api/_lib/skills.ts`, markdown skills). No god-file; the largest module (`agentLoop.ts`, ~1,221 lines) is cohesive.
- **System prompts are data, not code.** `agents/california-legal/agent.json` + `skills/*.md`, composed per-turn by intent — deliberately shaped to mirror Anthropic's plugin format (the "portability principle") so the runtime can be swapped without a product rewrite. Validated by the industry: CoCounsel's 2026 rebuild is the same shape (one agent loop + tools).
- **Env vars are consistently server-side** and centralized through `process.env` reads inside each module's lazy getter (e.g., `cebSearch.getIndex()`, `auditLog.resolveSink()`); no client bundle leakage of secrets.

### Issues
- **[Medium]** Query routing is split between an *explicit* UI workflow toggle (`V2ChatPage` Quick/Research) — good — and a *keyword* intent classifier in `skills.ts` (`INTENT_PATTERNS` regex → matter-intake/claim-chart/etc.). The keyword router is brittle and will silently mis-route as the skill catalog grows. → For matter-type workflows, prefer explicit selection (a button sets the skill); reserve detection for soft hints. The `agent.json` `schema_note` already anticipates "promote to model-based intent routing."
- **[Medium]** MCP plumbing (`api/_lib/tools/mcpRegistry.ts`, beta header wiring in `agentLoop.ts`) ships **disabled** (`V2_MCP_ENABLED` unset; the one registered server's transport path is unconfirmed). It's dead-but-wired surface area carrying its own privilege-gating logic. Fine to keep, but it's untested code in the critical loop — flag it as not-yet-load-bearing so nobody assumes it works.
- **[Low]** Two parallel `getUserId` implementations exist — `utils/auth.ts` and an inlined copy in `api/agent/session.ts`/`sessions.ts`. Consolidate on `utils/auth.ts` before adding auth to the write routes (see Pass 3) so there's one audited code path.
- **[Low]** ~7,800 lines of V1 stack (`agents/*`, `api/orchestrate-document.ts`, `gemini/chatService.ts`, `api/gemini-chat.ts`, `api/claude-chat.ts`) still in the tree, plus ~25 root-level ad-hoc `test-*.js` scripts. Documented as "Phase 5b teardown," but it inflates the audit/discovery surface for a tool whose §W posture assumes adversarial review of the repo.

---

## Pass 2: Code Quality

### Strengths
- **Comments are why-grade**, repeatedly citing the governing plan addendum for non-obvious decisions (e.g., the Task #71 caption carve-out, the Option-C retention model). This is rare and valuable.
- **Error handling is deliberate and mostly fail-closed**: `agentProxy` returns structured errors and never echoes raw input; `scrubError.scrubMessage` strips HIGH_RISK regex matches from any error before it can reach logs or the client. Tool failures become `tool_result {is_error:true}` rather than crashing the loop.
- **Tech debt markers are essentially nil** — a repo-wide grep for `TODO/FIXME/HACK` in source returns only the 5 intentional `[FFLP-TODO: compliance counsel …]` placeholders in `ConfidentialityAttestation.tsx`. Clean.

### Issues
- **[High]** **Test coverage is deep on sanitization and absent everywhere else.** `tests/sanitization.test.mjs` (2,163 lines) + `tests/traps/*` (749 lines) thoroughly exercise the privilege layer — excellent. But a grep for tests of `agentLoop`/`runTurn`/the `/api/agent/*` endpoints/React components finds **none**. The agent loop, the auth/CORS behavior, the SSE event contract, and every UI surface are validated only by ad-hoc `scripts/probe-*.mjs` / `v2-*-e2e.mjs` Playwright scripts — not a CI gate. → Add (a) an `agentLoop` integration test with a fake Anthropic client covering tool rounds + refusal + max_tokens, and (b) the §A.1 auth/CORS/405 route tests. There is no CI config in-repo; wire `yarn test:traps` + these as a pre-merge gate (plan §S describes this; it doesn't exist).
- **[Medium]** **`acquireLock`/`releaseLock` are defined in `sessionStore.ts` but never called.** No single-flight protection exists, so two concurrent turns on the same `session_id` can interleave `appendMessage` writes and corrupt the `sequence`/turn ordering. Either wire the lock into `runTurn`/`runTurnStream` or delete the dead helper.
- **[Medium]** **`ConfidentialityAttestation.handleDismiss()` calls `acknowledge()`** (`components/ConfidentialityAttestation.tsx:43-47`) — the "Not now" / dismiss path *permanently records the attorney as having attested*, contradicting the component's own "soft gate, re-shows on reload" comment. Either make dismiss a no-op (don't persist) or remove the dismiss affordance.
- **[Low]** Stale doc-comment: `RunTurnOptions.model` says *"defaults to claude-sonnet-4-6"* while `DEFAULT_MODEL` is now `claude-fable-5`. Minor, but in a system that treats prompts/config as legal artifacts, stale comments are a real liability.
- **[Low]** **Uncommitted privilege-critical changes.** `agentLoop.ts`, `skills.ts`, `agent.json`, `tools/index.ts`, `verify-stream.ts` are modified and `statuteVerify.ts` is untracked — the entire Fable-5 + statute-verification change set is un-versioned (last commit `9063d37`, 2026-05-23). For a §W "full version history retained 7 years" posture, three-plus weeks of uncommitted changes to the inference path is itself a finding. Commit them.

---

## Pass 3: Security & API Safety

### Strengths
- **No client-side keys**; all provider keys read server-side. **PII-in-logs risk is low**: the only `console.warn` on a hot path (`cebSearch.ts:150`) logs a namespace + error message, not user content, and error paths run through `scrubMessage`.
- **Prompt-injection surface is well-contained**: user text flows into the `messages` array, never concatenated into the system prompt (which is built from trusted skill files). **Tool outputs are re-sanitized** before re-entering `messages` (`agentLoop.sanitizeToolOutput`, the 2nd-addendum mandate).
- The **server-side regex backstop is fail-closed** (`agentProxy` → 503 on any raw PII), and the browser **wire-guard** (`wireGuard.assertNoRawPii`) is a second deterministic check before `fetch`.

### Issues
- **[CRITICAL] The inference/write endpoints are unauthenticated.** `api/agent/turn.ts`, `turn-stream.ts`, `draft-stream.ts`, `drafting-magic.ts`, `revise-section.ts`, `verify-stream.ts`, and `shadow.ts` perform **no Clerk verification** and trust a body-supplied `user_id`. `turn.ts:7` says so outright: *"Auth, CORS, rate-limiting … (Phase 1 stub — proper Clerk auth wiring follows in Phase 4)."* Phase 4 shipped; this didn't. Consequences: (1) unmetered Fable-5 spend for anyone with the URL; (2) **cross-user session pollution** — POST a turn into any guessed/known `session_id` and `runTurn` appends without an ownership check; (3) forged `user_id` in the 7-year audit chain. The *read* endpoints (`session.ts`, `sessions.ts`) already verify Clerk + ownership correctly — apply the same `utils/auth.ts` `getUserId` guard to the seven write routes, add session-ownership verification on `session_id`, and confirm a first-turn claim of an unowned id. **This is the #1 blocker.** → fix in Pass-1's consolidated `getUserId`.
- **[CRITICAL] CORS is `Access-Control-Allow-Origin: *`** on every agent route (per-route headers + the blanket rule in `vercel.json`). Plan §A.1: *"That is unacceptable for the new agent surface … set explicitly to the production domain. No wildcards."* → replace `*` with the prod + Vercel-preview allowlist, route-side and in `vercel.json`.
- **[High] No rate limiting anywhere.** `acquireLock` is unused (Pass 2) and there is no per-user/IP throttle on `POST /api/agent/sessions` or the turn routes (plan §A.1 specified 60/min). Combined with the missing auth, a single script can run up an unbounded Fable-5 bill. → add an Upstash-ratelimit guard once auth lands (per-`user_id`).
- **[Medium] The verifier sub-agent bypasses tool-output sanitization.** `verifierSubAgent.dispatchVerifierTool` returns raw tool JSON straight into `tool_result` blocks, while the main loop routes everything through `sanitizeToolOutput`. Exposure is low (public-record sources, tokenized inputs) but it's a documented-control gap on the exact class the W5 traps test. → route verifier tool output through the same wrapper (with the caption-safe carve-out).
- **[Low] Client-minted `session_id` is interpolated into Redis keys unvalidated** (`sessionStore` key builders). Harmless once auth + ownership land, but add a `^[\w-]{1,64}$` guard to prevent key-shape abuse.
- **[Low] The server backstop scans `user_text` but not the client-suppliable `system_prompt` field** that several routes accept (`draft-stream`, `revise-section`, `drafting-magic`). The browser wire-guard covers it; server defense-in-depth doesn't. → run the backstop over all client-supplied text fields.

---

## Pass 4: California State Bar AI Compliance

**Calibration note (ultrathink: verify against actual deployment context).** The skill's checklist is written for a *public-facing* legal-information chatbot, where "this is not legal advice / no attorney-client relationship" disclaimers are load-bearing. V2 is a **different animal**: an *internal workbench* whose only users are F&F's own attorneys (Clerk-gated), producing work product *for the firm's existing clients within an attorney-client relationship*. The skill files even encode this correctly — `skills/drafting/legal-memo.md:89` and `client-letter.md:116` deliberately instruct the model **not** to add "this is not legal advice" disclaimers because the output *is* the firm's advice. So several checklist items are partly mis-targeted, and the firm's repo (plan §W) makes a defensible argument that "may hallucinate" disclaimers inside the system prompt would themselves become "evidence of a known defect." **The real, load-bearing compliance risks for this tool are confidentiality (RPC 1.6) — heavily addressed by sanitization — competence/supervision (RPC 1.1), and candor/no-fabricated-citations — addressed by the verifier.** I score the checklist literally below, then separate the genuine gaps. This is an engineering observation; the legal judgment is counsel's.

### Compliance Checklist (literal)
- ⚠️ **Blocking disclosure modal before first use** — `ConfidentialityAttestation` exists but is a **soft gate** (dismissable; `softGate` default true), uses **placeholder copy** (4 unresolved `[FFLP-TODO: compliance counsel …]` markers), is mounted **only on `V2ChatPage`** (an attorney landing on `/v2/draft`, `/v2/verify`, or `/v2/magic` never sees it), and its dismiss path **incorrectly records attestation** (Pass 2). Not a true blocking gate.
- ❌ **"Not legal advice" disclaimer on every response** — none in the V2 UI. *(Defensible by design for an internal tool — see calibration — but unmet as written.)*
- ✅ **Source attribution on every answer** — `SourcesPanel` renders CEB/CourtListener/statute/citation sources with clickable links; the `checkAnswer` guardrail warns when a cited case name is absent from the sources panel (`guardrailsServiceV2.ts`). This is a real strength.
- ❌ **Human attorney supervision notice** — not surfaced in-product (implicit: the user *is* the attorney).
- ❌ **Mechanism to flag/report AI errors** — none found.
- ✅ **No claim of legal expertise / attorney-client relationship** — the model is prompted to cite and not over-claim; no false-expertise language.
- ⚠️ **Hallucination risk disclosure** — handled obliquely via the citation verifier (real/fake/ambiguous) and the sources-mismatch warning, not via an explicit user-facing statement.

### Issues
- **[High]** The attestation gate, as the firm's *documented* compliance control (§Q memo, partner sign-off packet), is materially weaker than described: soft, placeholder-copy, single-page, and self-defeating on dismiss. → finalize counsel copy, mount it app-wide (move `<ConfidentialityAttestation>` into the shared `/v2*` shell in `App.tsx`, not per-page), fix the dismiss bug, and decide soft-vs-hard with counsel.
- **[High]** **No UPL / jurisdictional guardrail in the live V2 UI.** Plan §X specifies a jurisdictional banner + refusal patterns for non-CA legal questions; `guardrailsServiceV2.checkAnswer` only does case-name containment (the V1 `guardrailsService.checkJurisdiction` is not wired into V2). Low-probability for this CA-only practice, but it's a documented control that isn't implemented. → port the jurisdiction check into the V2 guardrail or formally drop it via an addendum.
- **[Medium]** **Audit chain is weaker than the partner-facing docs imply.** `auditLog.ts` LPUSHes independent records with **no SHA-256 hash chaining and no signed daily digest** (plan §G specifies both); the daily list TTL is **90 days**, not the §I "7-year" retention (only the AES-GCM envelopes get 7 years); and the writer **deliberately fails open**. The §Y per-session attestation generator + `verify-attestation` CLI (the artifact a court/bar panel would receive) **do not exist yet**. → implement hash-chaining + the §Y generator before the cutover the docs are written to support, or soften the docs.
- **[Medium]** **Docs-vs-code trust-model mismatch.** Plan + audit scorecard say the token store is *"passphrase-encrypted per attorney device"*; the code ships a **random device key in `localStorage`** (`useSanitizer.tsx`, "intentionally no attorney-facing passphrase"). The §Q memo describes the real behavior honestly (so partners signed the real design), but the binding plan text still says passphrase. → correct the plan/scorecard language; §W assumes adversarial counsel will read both.

---

## Pass 5: Functionality & UX

### Strengths
- **Streaming with progressive affordances**: tool pills flip running → ✓{ms}, a privilege chip and live sanitization preview paint before tokens, and the answer renders markdown with clickable source links. Good time-to-first-token UX.
- **Error banner exists** and distinguishes gate errors from stream errors (`V2ChatPage` `state.error`). Session reload re-tokenizes→rehydrates bubbles (the 2026-05-18 fix).
- **No-model-fallback is correctly a policy choice, not a gap** — when Fable fails the error surfaces; the system does not silently reroute to another model (matches the single-engine policy).

### Issues
- **[High] A refusal renders as a blank screen.** `agentLoop` exits with `final_text = ''` on `stop_reason: "refusal"`, and `V2ChatPage` only folds a message `if (state.done && state.tokens)` — so the attorney sees nothing but a gray `stop=refusal` footer. Fable returns structured `stop_details` (`category`, `explanation`) for exactly this. → emit a first-class `refusal` SSE event; render an amber "Fable declined ([category]) — [explanation] — your message was not sent to any other model" banner with Edit-&-resend. (Specified in `FABLE5-DEEP-DIVE-REPORT.md` §4.G.)
- **[Medium] `max_tokens` and `pause_turn` stops are unhandled.** A truncated long draft just stops; there's no "Continue" affordance, and once a server-side tool (e.g., code execution) ever enters the loop, `pause_turn` will need re-invocation. → branch on both in the loop + surface a continue control.
- **[Medium] A "Stop" control exists in the hook but is wired to nothing.** `useV2AgentStream.cancel()` is defined; no UI button calls it, and the server runs the turn to completion regardless (by §D design). → either add a Stop button (and document that the server still finishes + persists) or remove the dead `cancel`.
- **[Low] V2 is not mobile-responsive.** `V2Sidebar` is an always-present flex column with no responsive/collapse classes (V1 had a collapsible sidebar; V2 dropped it). Low priority for desktop-bound attorneys, but the skill asks. → add a collapse breakpoint if mobile matters.
- **[Low] No-results / empty states are thin** outside the chat error banner — e.g., a CourtListener zero-hit or an empty CEB result is handled inside the tool but not given a distinct user-facing "nothing found, try X" state. → add explicit empty states on the Verify and Draft surfaces.

---

## Pass 6: Performance & Reliability

### Strengths
- **Tool-result idempotency cache** (`sessionStore.readToolResult/writeToolResult`, 24h TTL) stores the *sanitized* form, so a retry can't bypass the sanitizer — correct and thoughtful.
- **Streaming** is the default chat path (good TTFT); `vercel.json` sets `maxDuration: 300` on agent routes with `includeFiles: agents/**` so the skill tree is bundled.
- `statuteVerify.ts` is the model citizen for external calls: `AbortController` + 15s timeout, clean 200/404/unavailable mapping.

### Issues
- **[High] 4 of 6 external tools have no timeout and no retry.** `courtlistenerSearch`, `cebSearch`, `legiscanSearch`, `openstatesSearch` all use bare `await fetch(...)` with no `AbortController` and no backoff (verified: `timeout-signals:0 retry-signals:0` each). A single hung upstream call blocks the whole turn until the Vercel 300s ceiling, burning a function-minute and stranding the attorney. The repo even *has* `utils/fetchWithRetry.ts` / `utils/retry.ts` — they're just not used in the tool layer. → wrap every tool fetch in `fetchWithRetry` + a ~10–15s `AbortController`, mirroring `statuteVerify`.
- **[High] Prompt caching is not used at all.** No `cache_control` anywhere in `agentLoop`'s `messages.create` calls. At Fable-5 pricing ($10/MTok input) and ~18–26K-token research turns with a stable system prompt + append-only history, this is the single largest avoidable cost — ~90% off the dominant term. → add breakpoints (tools → system/skills → last history block); this becomes mandatory, not optional, once the Matter Workspace puts a 300K-token matter in context.
- **[Medium] No adaptive thinking / effort is sent.** `agentLoop` passes no `thinking` parameter, so Fable runs in no-thinking default for appellate-grade drafting and research. → add `thinking:{type:"adaptive"}` + per-workflow `output_config.effort` (research `high`, quick stays Sonnet/low).
- **[Medium] No monitoring, error tracking, or alerting.** Zero observability deps in `package.json` (no Sentry/Datadog/OTel); the audit log is metadata-only and fails open, so a production inference error leaves no alert and a thin trail. → add error tracking (scrubbed — reuse `scrubMessage` on the way out) and an uptime/latency monitor.
- **[Low] No concurrency control** (the unused `acquireLock`, Pass 2/3) means rapid double-submits on one session can race.
- **[Low] Cold start**: the on-device GLiNER daemon has a ~7s cold load (handled client-side with health polling + warmup — fine), and Vercel functions are stateless with KV as truth (fine). No server-side cold-start issue; noting for completeness.

---

## Prioritized Action Plan

### Immediate (fix before the Phase 5a cutover / before any real-matter traffic)
1. **Authenticate the seven write endpoints** (`turn`, `turn-stream`, `draft-stream`, `drafting-magic`, `revise-section`, `verify-stream`, `shadow`): Clerk JWT via the consolidated `utils/auth.ts getUserId`, derive `user_id` from the token (delete the body field), verify session ownership on `session_id`. **[CRITICAL]**
2. **Replace CORS `*` with the prod + preview allowlist**, route-side and in `vercel.json`. **[CRITICAL]**
3. **Handle `stop_reason: "refusal"`** (and `max_tokens`) in `agentLoop` + the four stream hooks + UI banner — stop rendering refusals as blank screens. **[High]**
4. **Commit the uncommitted Fable-5 + `statute_verify` change set** (and add an addendum recording the engine decision + cost delta), so the inference path is version-controlled. **[High/process]**
5. **Add per-user rate limiting** on the agent routes once auth lands. **[High]**

### Short-term (next sprint)
1. **Tool resilience**: wrap `courtlistener`/`ceb`/`legiscan`/`openstates` fetches in `fetchWithRetry` + `AbortController` timeouts. **[High]**
2. **Prompt caching** + adaptive thinking/effort in `agentLoop`. **[High cost / Medium]**
3. **Compliance gate hardening**: finalize counsel copy, mount `ConfidentialityAttestation` app-wide, fix the dismiss-records-attestation bug, decide soft-vs-hard. **[High]**
4. **Test + CI**: an `agentLoop` integration test (tool rounds, refusal, max_tokens) + the §A.1 auth/CORS/405 route tests; wire `yarn test:traps` + these as a pre-merge gate. **[High]**
5. **Route verifier tool output through `sanitizeToolOutput`.** **[Medium]**
6. **Wire or delete `acquireLock`**; validate `session_id` shape. **[Medium]**

### Nice-to-have
1. Audit-chain upgrade: SHA-256 hash chaining + signed daily digest + the §Y attestation generator/CLI (or soften the partner-facing docs to match current reality). **[Medium]**
2. Port or formally drop the §X UPL/jurisdiction guardrail in V2. **[Medium]**
3. Add error tracking + uptime monitoring (scrubbed). **[Medium]**
4. Correct stale doc-comments + the "passphrase" language in the plan/scorecard. **[Low]**
5. Mobile-responsive sidebar; explicit empty states on Verify/Draft. **[Low]**
6. Phase 5b: delete the ~7,800 V1 lines + root `test-*.js` clutter. **[Low]**

---

## Corrections the skill itself needs (so the next run is accurate)
- **LLM**: not "Gemini 2.5 Pro (primary), Anthropic fallback." V2 is **Anthropic-only, Claude Fable 5 primary**, Sonnet 4.6 for Quick + the citation verifier, **no fallback by policy**.
- **Frontend**: **Vite + React 19**, not Next.js. No `app/api` or `pages/api`; routes are Vercel functions under `api/agent/*` and `api/*`.
- **Repo/target**: the live product is the **V2 worktree/branch**, not `California-Law-Chatbot` `main` (frozen, slated for deletion).
- **Mechanics**: the `PM:search` / `PM:github` steps assume a knowledge-base + GitHub MCP tool not present in Claude Code; the review runs against the on-disk tree.
- **Add a Pass for the privilege architecture** — the on-device GLiNER tokenization, the wire-guard, the 120-trap zero-leak gate, and the on-device token map are V2's defining property and aren't represented in the six current passes.

---

*Run per the skill's protocol. Findings are specific and file-grounded; severities use the skill's definitions. Compliance findings are engineering observations, not legal advice — the RPC 1.1/1.6 calls are counsel's.*

**Which issues would you like me to fix first? I can write the code for any of these — the auth fix (Immediate #1–2) and the refusal handler (#3) are the natural starting pair, and I can do them as one branch.**
