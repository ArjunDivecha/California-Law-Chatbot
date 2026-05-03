# Managed Agents Reconstruction Plan

**Plan file destination:** `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md`
**Date:** 2026-05-03
**Status:** Final, post Opus + Codex (3 rounds, approved) + Ultraplan + Council review.

---

## Context

The chatbot currently runs an OpenRouter dual-model pipeline (Gemini generator + Claude verifier) plus a custom 4-agent orchestrator under `agents/` for document drafting. Combined orchestration footprint: ~7,800 lines that exist purely to manage what Anthropic Managed Agents now manages natively (agent loop, session state, tool-call sequencing, streaming).

**This plan migrates to Anthropic Managed Agents as the sole production runtime.** Anthropic owns the agent loop and session; we own the legal-data tool endpoints, the sanitization boundary, the audit mirror, and the UI. If Managed Agents fails Phase 1 (latency, reliability, or beta-API behavior), the explicit fallback is the Anthropic Agent SDK self-hosted loop — but that is a fallback, not a hedge.

**Why now:** ZDR/BAA/SOC 2 paperwork is in flight separately and gates only Phase 5 cutover. Phases 1–4 may run against staging/non-confidential data while paperwork closes.

**Intended outcome:** Delete ~7,800 lines of orchestration. Replace with one Managed Agent + one verifier sub-agent + a thin Vercel proxy (~400 lines of shared helpers + 5 thin route files) + tool callback handlers for the existing legal-data endpoints. Keep the existing CEB RAG, CourtListener/legislative integrations, sanitization layer, and drafting UI. Net result: lower maintenance burden, cleaner audit trail, and no in-house orchestration code in the malpractice critical path.

**Supersedes:** This plan supersedes the in-flight `utils/googleGenAI.ts` Google GenAI direct migration referenced in `CLAUDE.md`. That untracked file and its branch will not merge. The stale `CLAUDE.md` reference is scrubbed in Phase 5.

---

## Ground Truth (verified 2026-05-03)

| Claim | Reality |
|---|---|
| `gemini/chatService.ts` | **3,085 lines** |
| `agents/` folder | **8 files, 2,521 lines** on main. Custom 4-agent orchestrator (researchAgent 507, drafterAgent 409, citationAgent 279, verifierAgent 332, orchestrator 369, tools 350, types 262, index 13). All call OpenRouter. Largest single deletion target. |
| `api/orchestrate-document.ts` | 1,239 lines, drives drafting pipeline |
| `api/gemini-chat.ts` / `api/claude-chat.ts` / `api/anthropic-chat.ts` | 327 / 197 / 85 lines (three Claude/Gemini endpoints with overlapping responsibilities) |
| `services/verifierService.ts` | 447 lines, JSON-from-text parsing of Claude verifier output |
| `components/drafting/` | **9 files, 2,991 lines on branch** — working DocumentPreview/OrchestrationModal/VariableInputPanel flow |
| `services/sanitization/` | Lives on `codex/drafting-magic-sanitized` branch, not main |
| `api/ceb-search.ts` | OpenAI native embeddings (line 527), not OpenRouter; queries Upstash Vector across 5 CEB namespaces |
| `@anthropic-ai/sdk@0.68.0` | Confirmed; Managed Agents beta methods to be verified pre-Phase-1 |
| `vercel.json` | `maxDuration: 300` for heavy endpoints; Pro plan ceiling is higher and not yet configured |

### Deletion target

| File / dir | Lines | Disposition |
|---|---|---|
| `gemini/chatService.ts` | 3,085 | Shrinks to ~300–600 lines (final number is a Phase 1 deliverable to be measured, not asserted up front). Bundles session bootstrap, polling loop, event reconciliation against the Upstash mirror, sanitization-confidence UI state, source-mode advanced toggle, CEB badge rendering. |
| `agents/` (8 files) | 2,521 | **Deleted** — Anthropic runs the agent loop |
| `api/orchestrate-document.ts` | 1,239 | Deleted — agent runs the drafting loop in one session |
| `api/gemini-chat.ts` | 327 | Deleted — generator collapses into the agent |
| `api/claude-chat.ts` | 197 | Deleted — verifier collapses into the agent |
| `api/anthropic-chat.ts` | 85 | Folded into a single `api/agent-proxy.ts` |
| `services/verifierService.ts` | 447 | Deleted — verifier sub-agent replaces it |
| **Net deletion** | **~7,800 lines** |

**Kept and rewired:** `api/ceb-search.ts` (582), `api/courtlistener-search.ts`, `api/legislative-search.ts`, `api/legislative-billtext.ts`, `api/verify-citations.ts` (266), `api/serper-scholar.ts`, `services/confidenceGating.ts` (149), `services/guardrailsService.ts` (247), `services/retrievalPruner.ts` (171), `gemini/cebIntegration.ts`, `components/drafting/*` (per §10).

**Other API endpoints (not touched by this migration, listed for completeness):** `api/chats.ts` (276) — chat history persistence, required for §N in-flight chat compatibility; `api/templates.ts` (522) — drafting template CRUD, drives Phase 2 template selection; `api/export-document.ts` (670) — Word/PDF export, called from drafting UI; `api/config.ts` (15) — client-side config; `api/debug.ts` (38) — env diagnostic. All kept; none rewired.

**Empty stub to delete during cleanup:** `services/geminiService.ts` (0 lines on main).

**Ground-truth correction:** Of the 8 files in `agents/`, all but `agents/citationAgent.ts` (279 lines) call OpenRouter directly. `citationAgent.ts` is regex- and tool-driven via `verifyCitationTool` from `tools.ts`. Doesn't change deletion math — all 8 still go.

---

## Architecture: Before vs After

```
BEFORE:
  UI → chatService (3,085 lines, regex query classification)
     → api/gemini-chat + api/claude-chat → OpenRouter → Gemini/Claude
  UI → DraftingMode → api/orchestrate-document (1,239)
     → agents/{research,drafter,citation,verifier} (2,521) → OpenRouter

AFTER (Managed Agents):
  UI → chatService thin (~300)
     → api/agent-proxy (~400)
     → Anthropic Managed Agent (loop + session state on Anthropic)
                                  ↑ tool callbacks
                              api/ceb-search, api/courtlistener-search,
                              api/legislative-*, api/verify-citations
```

**Two agents, separate sessions:**

- **Workbench Agent (Opus 4.7):** handles research, drafting, citing, self-review. One agent, different system prompts for the workflows in §11 below.
- **Verifier Agent (Sonnet 4.6):** runs after the workbench finishes. Sees only the final answer + sources, not the workbench's reasoning. Adversarial check: every citation must (a) resolve to a real authority and (b) the proposition stated by the agent must match an exact-or-near-exact quote from that authority.

**One Vercel proxy:** `api/agent-proxy.ts` creates sessions, mirrors events to Upstash KV, answers tool callbacks, returns events to the client.

---

## Phase 0 — Compliance + Privilege Pre-flight (parallel workstream)

Runs in parallel with Phase 1 design; gates only Phase 5 cutover.

**0.a — Compliance paperwork (user-driven):**
- Anthropic enterprise ZDR DPA, signed
- BAA, signed
- SOC 2 Type II report, current
- Malpractice carrier UPL review: written confirmation that AI-summarized non-CA authority is covered, and that the policy doesn't exclude AI-assisted legal work
- F&F two-paragraph memo (§17) explaining Bedrock → direct Anthropic API pivot

**0.b — Engineering smoke test (Arjun, ~1 day):**
- Author ~30 compound-query "privilege traps" — innocuous-looking queries that combine to identify a hypothetical client (e.g., "$4.3M claim, Marin County, tech founder")
- Run them through the existing `services/sanitization/` layer (after pulling `codex/drafting-magic-sanitized` to main)
- Fix any obvious leakage in the sanitization rules before Phase 1 code
- This is a pre-flight engineering check, not a legal-defensibility audit

**0.c — Pre-production privilege review gate (before Phase 5 cutover):**
- Before any real client-confidential work runs through the new system, run a structured privilege review with both F&F lawyers
- Test set: 100 traps, half drawn from real (sanitized) F&F matter patterns, half synthetic compound queries
- Pass criterion: zero confirmed leaks across all 100 on the production sanitization configuration
- This is the formal gate; the Phase 0.b smoke test is just to catch obvious bugs early
- If the review surfaces a real leak, cutover is paused until the boundary is fixed

**Phase 0 fallback:** If Anthropic enterprise terms don't close, fall back to AWS Bedrock with the Anthropic Agent SDK self-hosted loop (Bedrock does not offer Managed Agents). Smaller deletion win — `agents/` still goes, `chatService.ts` shrinks less. Document this contingency; do not return to OpenRouter.

---

## Phase 1 — Spike (2 weeks)

**Goal:** Prove one Managed Agent with `ceb_search` and `courtlistener_search` tools beats the current `chatService.ts` pipeline on a 50-question gold set.

**Phase 1 first gate (Day 0–1, before any other Phase 1 work): SDK capability audit.**

Verify that the installed `@anthropic-ai/sdk` (0.68.0 today, or latest) actually exposes Managed Agents primitives — `beta.agents.create`, `beta.sessions.create`, tool-callback streaming, session resumption. If the SDK does not expose what this plan assumes, the entire architecture from §A onward is invalidated and **Phase 1 immediately becomes the Agent SDK self-hosted fallback (§P)**, not the Managed Agents path. This audit must be the first deliverable; all other Phase 1 work waits on it.

This is not a 0.5-day chore in a long open-items list — it is the single biggest unverified premise in the plan. Time-boxed: 1 day max. Output: written go/no-go on Managed Agents vs Agent SDK fallback, posted before any agent-proxy code is written.

**Build (after SDK audit passes):**
- One Managed Agent, Opus 4.7, system prompt for California legal research
- `ceb_search` and `courtlistener_search` as custom tools (LegiScan / OpenStates added in Phase 2)
- The five `/api/agent/*` route files + `api/_lib/agentProxy.ts` (per §A)
- App-side event mirror in Upstash KV (per §D below)
- Test harness: run all 50 questions through both the current pipeline and the new agent

**Evaluate:**
- 50 gold questions drawn from sanitized F&F query history + CEB topic distribution
- **Both F&F lawyers grade independently, blind to which system produced which response**
- Inter-rater agreement reported (Cohen's κ); disagreements resolved by discussion
- Per-question rubric:
  - (a) citation accuracy
  - (b) source coverage (relative to a curated "ideal" source set)
  - (c) legal-analysis correctness
  - (d1) citation resolution: every cited case/statute resolves to a real authority via CourtListener/leginfo
  - (d2) proposition fidelity: agent's stated proposition for that citation is supported by an exact-or-near-exact quote from the authority
  - (e) end-to-end latency (machine-measured: p50, p95, p99)

**Latency budget:**
- Per-tool callback round-trip measured separately (agent → proxy → tool → proxy → agent)
- **Hard threshold:** p95 latency for a 4-tool research query ≤ 1.4× current pipeline. If breached, redesign tool layer (bundled calls, parallel tool calls where order doesn't matter) before Phase 2.

**Go / no-go:**
- New agent must be ≥ current on (a), (b), (c), (d1), (d2)
- Latency within budget
- κ ≥ 0.6
- If failed: one more 2-week iteration with bundled-call tool design. Hard stop at two iterations.

---

## Phase 2 — Drafting workflows (1 week)

**Goal:** Replace `api/orchestrate-document.ts` with the same Managed Agent using a drafting system prompt.

- Drafting system prompt variant per template (legal_memo, demand_letter, motion_compel, client_letter)
- `POST /api/agent/draft` endpoint
- Structured template variables passed as the first user message
- Agent generates all sections in one session — no 5-phase pipeline, no four sub-agents
- Tool set: research tools (Phase 1) + LegiScan + OpenStates + citation_verify
- Stream sections as they're generated via the polling endpoint
- Existing Word/PDF export endpoint (`api/export-document.ts`, 670 lines) reused as-is; drafting UI calls into it unchanged

**Go / no-go:** All 4 templates produce complete drafts with verified citations; word count within ±50% of target; zero hallucinated cases on a 10-document spot-check.

---

## Phase 3 — Verifier sub-agent (1 week)

**Goal:** Adversarial verification as a separate Managed Agent session.

- Separate agent, separate session per verification run, no shared context with workbench
- System prompt: extract every citation + the proposition the workbench attached to it; verify each via tools; output a structured report
- Tools: `citation_verify`, `courtlistener_search`, `statute_lookup`, `ceb_search` (cross-reference)
- Output schema: per-claim verification status (verified / partially_verified / unsupported) with exact quote evidence
- UI: verification report panel inline with the answer

**Go / no-go:** On a test set including intentionally fabricated citations, the verifier flags ≥95% of hallucinations.

---

## Phase 4 — UI integration (1 week)

**Goal:** Replace source-mode UX with workflow-based UX. Wire existing drafting UI to the new agent endpoint.

**Workflows replacing the CEB/AI/Hybrid source toggle:**
| Workflow | Use case |
|---|---|
| Quick Answer | Direct response with sources |
| Research Memo | Multi-step research with structured authority ranking |
| Draft Document | Drafting flow (Phase 2) |
| Verify Citation | Adversarial check on lawyer-pasted text |
| Analyze Document | Read uploaded file, identify legal issues |
| Find Cases / Statutes | Search-only |

Source mode becomes an advanced toggle; agent picks sources by default.

**Drafting UI disposition** (`components/drafting/`, 2,991 lines on branch):
| Component | Lines | Action |
|---|---|---|
| `DraftingMode.tsx` | 472 | Keep, rewire endpoint |
| `OrchestrationModal.tsx` | 603 | Keep, simplify (drop 5-phase progress UI; agent runs one session) |
| `OrchestrationVisual.tsx` | 652 | Audit — likely coupled to deleted phase semantics; reduce or remove |
| `DocumentPreview.tsx` | 565 | Keep |
| `VariableInputPanel.tsx` | 187 | Keep |
| `ProgressIndicator.tsx` | 242 | Audit — same coupling concern |
| `TemplateSelector.tsx` | 149 | Keep |
| `defaultTestData.ts` | 108 | Keep |
| `index.ts` | 13 | Keep |

Sanitization UI from `codex/drafting-magic-sanitized` audited and merged in this phase.

---

## Phase 4.5 — Shadow run (1 week)

Inserted between Phase 4 and Phase 5.

- Both old and new systems receive every production query
- Only old-system response shown to the user
- New-system response logged with full trace (tools called, sources, citations, verification report)
- Daily diff report: response divergence rate, citation overlap, latency comparison
- Lawyers spot-check 10 divergences/day with structured feedback
- **Cutover gate:** ≤ 20% material divergence on a representative sample, no critical hallucinations in the new system, formal privilege review (§0.c) passed

---

## Phase 5 — Cutover (1 week)

- Phase 0 paperwork all signed
- Phase 0.c formal privilege review passed
- Deploy to Vercel preview, full Playwright run on all 6 workflows
- Deploy to production behind a single feature flag (`USE_LEGACY_PIPELINE` defaults `false`)
- Legacy stack kept hot for 30 days; rollback by flipping the flag (~3 min redeploy)
- Delete: `agents/`, `api/orchestrate-document.ts`, `api/gemini-chat.ts`, `api/claude-chat.ts`, `services/verifierService.ts`
- Replace with thin client: `gemini/chatService.ts` (3,085 → ~300), `api/anthropic-chat.ts` → renamed `api/agent-proxy.ts` (~400)
- Drop `OPENROUTER_API_KEY` and `@google/genai`
- Update `CLAUDE.md`

---

## Architecture details

### A. Two agents, one Vercel proxy

Vercel uses file-system routing, so the five endpoints below live as separate files under `api/agent/` with shared logic factored into `api/_lib/agentProxy.ts` (~400 lines of shared helpers: session create, mirror, sanitize, rehydrate, tool dispatch). Each route file is a thin handler that imports from the shared lib.

```
api/agent/sessions.ts                              POST  /api/agent/sessions
api/agent/sessions/[id]/events.ts                  GET   /api/agent/sessions/:id/events
api/agent/sessions/[id]/tools/[tool_call_id].ts    POST  /api/agent/sessions/:id/tools/:tool_call_id
api/agent/draft.ts                                 POST  /api/agent/draft
api/agent/verify.ts                                POST  /api/agent/verify
api/_lib/agentProxy.ts                             shared helpers
```

Endpoint behaviors:

- `POST /api/agent/sessions` — sanitize input, create Managed Agent session, return `{session_id, mirror_id}`
- `GET /api/agent/sessions/:id/events?after=:event_id` — poll for new events from Anthropic, mirror to Upstash KV, return events to client (with privileged tokens rehydrated for the client view)
- `POST /api/agent/sessions/:id/tools/:tool_call_id` — internal tool-callback handler; dispatched to the tool endpoints below
- `POST /api/agent/draft` — same shape, drafting system prompt
- `POST /api/agent/verify` — verifier sub-agent session, sees only the final answer + sources

### B. Tool layer — what Anthropic calls back into

Tool definitions registered with the Managed Agent:

| Tool | Backend | Notes |
|---|---|---|
| `ceb_search` | Upstash Vector via `api/ceb-search.ts` | OpenAI embeddings (kept for now per §6) |
| `courtlistener_search` | CourtListener v4 REST | |
| `statute_lookup` | leginfo.legislature.ca.gov | |
| `legiscan_search` | LegiScan API | |
| `openstates_search` | OpenStates API | |
| `citation_verify` | CourtListener citation lookup | Used by verifier sub-agent |

Tool permissions (default-deny):
- All custom tools: allow, log
- `web_search` / `web_fetch` (built-in): allow + log; **blocked** when any privileged marker is present in the session
- `bash` (built-in): require explicit lawyer confirmation
- `file_read` / `file_write`: allow within session workspace; cross-session blocked
- `file_delete`: never allowed

### C. Connection / streaming model

Managed Agent sessions can run for many minutes. Vercel function timeouts force a split between the long-lived agent session (on Anthropic) and the short-lived HTTP requests our proxy handles.

| Option | When | Cost |
|---|---|---|
| **Polling (Phase 1 default)** | Latency budget allows ≥ 2s tick | $0 — Vercel Pro |
| Vercel Pro streaming function (raise `maxDuration` to 800s) | Sessions < 13 min, single-region | already on Pro |
| Cloudflare Worker streaming proxy | Sessions > 13 min or multi-region | ~$5/month |

Default to polling. Promote to streaming only if Phase 1 latency benchmarks show polling adds > 3s perceived delay.

### D. Session durability — Managed Agents ownership model

| State | Owner | Storage |
|---|---|---|
| Live conversation + tool-call log | **Anthropic** | Managed Agent session, addressed by `session_id` |
| Event mirror (every Anthropic event echoed to our store) | **App** | Upstash KV append-only list keyed by `session_id` |
| Sanitization token map | **App** | Encrypted Upstash entry, scoped to session, deleted on session end |
| Final agent output | **App** | Audit log + chat-history store |
| Agent config snapshot | **App** | Tamper-evident audit log per §G |

The mirror exists for two reasons: (1) audit/discovery — every event must be reconstructable from our own store, not Anthropic's; (2) outage recovery — if Anthropic drops the session, the mirror lets us re-create context and start a fresh session.

**Failure modes:**

| Failure | Behavior |
|---|---|
| Browser close mid-session | Anthropic preserves session; client reload sends `session_id`, resumes from last event |
| Network flap | Polling client reconnects with `session_id` + `last_event_id`; missed events replayed from mirror |
| Vercel function cold-start | Function is stateless; nothing to recover |
| Tool execution timeout | Tool handler returns `{error: "timeout"}` to agent; agent decides retry/report |
| Anthropic API outage mid-session | Mirror lets us surface "service interrupted" with full transcript-to-date; resume when API recovers (within retention window) |
| Anthropic session expiry | Mirror replayed into a fresh session |
| Tool callback fails after partial work | Idempotency key on tool_call_id ensures safe retry |

**Phase 1 deliverable additions:** mirror schema in Upstash KV, idempotency keys on every tool callback, client-side `session_id` URL persistence, recovery UX.

### E. Sanitization & privilege boundary

Sanitization runs in the Vercel proxy *before* any input reaches the Managed Agent.

- Per-input output: `{sanitized_text, token_map, privileged: bool, confidence: 0..1}`
- Token map held in app memory + encrypted Upstash entry, never sent to Anthropic
- **Privilege hold-back:** if `confidence < 0.98`, the request is queued for mandatory human review with a UI banner; user must explicitly approve sanitized form OR rewrite. Default-deny on ambiguity.
- **Compound-query defense:** beyond per-token detection, sanitizer runs an n-gram entity-correlation pass; combinations seeded from F&F matter index. Adversarial smoke test (§0.b) and formal review (§0.c) are the empirical checks.
- **When sanitization is active, web_search and web_fetch are blocked** — we cannot risk client facts leaking into a search query.
- Audit log records every redaction decision: input hash, redacted spans, replacement tokens, confidence, timestamp, *combination* that triggered a flag (not just individual tokens).

### F. Data-classification per tool

| Tool | May receive | Blocked |
|---|---|---|
| `ceb_search` | Sanitized legal queries | Raw client names, matter numbers, financial figures |
| `courtlistener_search` | Public-record case names, citations, generic legal terms | Anything client-identifying |
| `statute_lookup` | Code + section identifiers | (lookup args are public refs) |
| `legiscan_search` / `openstates_search` | Bill numbers, generic policy terms | Client-identifying terms |
| `citation_verify` | Citation strings | Surrounding privileged context |
| `web_search` / `web_fetch` | Sanitized queries / public URLs | **Blocked** when privileged marker present |
| `bash` | Synthetic / derived data | Client-originated content |
| `file_read` / `file_write` | Session workspace | Cross-session access |

Agent receives only `privileged: false` content. Privileged terms held in app-boundary token map; rehydrated only into the final response shown to the user.

### G. Audit log — tamper-evident

- Append-only log (Upstash list or Postgres with INSERT-only role)
- Each entry: monotonic ID, NTP-synced timestamp, SHA-256 hash chain (each entry references prior entry's hash)
- Daily digest signed and offsite-backed-up
- Per-session chain-of-custody: who-accessed, when, why, output served
- Retention 7 years (matches CA Bar record retention)
- Phase 5 acceptance: prove a Phase 1 week-1 agent config is still retrievable

### H. Agent versioning

- On every agent config change (system prompt, tool list, model, temperature), app code snapshots the full definition to the audit log, content-addressed by SHA-256
- Every chat session response stores the SHA of the agent version that produced it
- Verification at Phase 5: a Phase 1 week-1 SHA can still be retrieved and replayed

### I. Retention matrix

| Data class | Staging | Production |
|---|---|---|
| Chat transcripts | 30 days | 7 years (CA Bar) |
| Tool call payloads (input + output) | 30 days | 7 years |
| Agent config snapshots | 7 years | 7 years |
| Verification reports | 30 days | 7 years |
| Audit logs (auth, access, redaction decisions) | 90 days | 7 years |
| Web search/fetch query logs | 30 days | 7 years (privilege-sensitive) |
| Anonymized eval gold-set | indefinite | indefinite |

All production retention: tamper-evident storage with daily clock-synced timestamps and SHA-256 chain-of-custody.

### J. Beta API churn

Managed Agents are gated by `anthropic-beta: managed-agents-2026-04-01` (or current). Anthropic ships breaking-change beta versions ~quarterly.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Beta API breaking change | High | Medium | Pin `anthropic-beta` header explicitly; subscribe to Anthropic changelog; budget 0.5 engineer-day/quarter for re-validation; never auto-upgrade in production |

### K. Memory stores — dropped

The original plan listed firm style guide, attorney preferences, known-bad-sources, common templates as separate "memory stores." None had a maintenance owner; "known-bad sources" is a moving target (cases get vacated, good cases get overruled). For 2 lawyers, premature scope. Templates already live as system-prompt fragments and as files under `templates/`. Revisit memory after Phase 5 if a real need emerges.

---

## Operational sections

### L. Cost estimate

Steady-state monthly at F&F volume (~800 sessions/month):

| Line item | Estimate |
|---|---|
| Anthropic API tokens (Opus 4.7 + Sonnet 4.6 mix) | $80–200 |
| Managed Agent session-hours ($0.08/hr × ~200hrs) | $16 |
| Vercel Pro | already paid |
| Upstash Vector + KV | $40–100 |
| Clerk | $25 |
| OpenAI embeddings (per §6, kept) | $5–15 |
| **Total monthly steady-state** | **~$170–360** |

Refine in Phase 1 with telemetry.

### M. Rollback mechanics

Objective rollback triggers (any one fires → roll back):
- Hallucination rate > 2× Phase 1 baseline over rolling 24h
- p95 latency > 2× Phase 1 baseline over rolling 6h
- Two or more lawyer-reported "wrong answer" tickets in 24h
- Any privacy/sanitization failure (immediate, no threshold)

**Rollback procedure:**
- Flip `USE_LEGACY_PIPELINE=true` in Vercel env, redeploy (~3 min)
- Legacy stack kept hot for 30 days post-cutover
- Owner: Arjun. Backup: documented runbook in repo.
- Post-rollback: incident review within 48h before any retry

### N. Backward compatibility for in-flight chats

- Legacy chat transcripts remain readable in the new UI (read-only view)
- In-flight legacy sessions on cutover day allowed to complete on legacy stack for 24h, then archived; users start new sessions on new stack
- Chat history sidebar shows both legacy and new sessions with a visual marker

### O. Lawyer rollout

- Week before cutover: 1-hour walkthrough with both lawyers, recording archived
- Cutover day: side-by-side `/legacy` route for 1 week with explicit sunset date
- First 2 weeks post-cutover: daily 15-min check-in per lawyer; log every complaint/missing-feature
- Documentation: short README per workflow + inline "what does this do?" tooltips on the workflow selector

### P. Phase 1 failure fallback

If the Phase 1 spike fails the gold set or latency budget:
1. Diagnose where the agent underperforms
2. Tool-layer issues → one more 2-week iteration with bundled-call tool design
3. Agent-quality issues → fall back to **Anthropic Agent SDK self-hosted loop** (still deletes ~3,500 lines, no beta-API dependency). Plan continues from Phase 2 against Agent SDK; only the orchestration runtime changes.
4. **Hard stop:** maximum two Phase 1 iterations. If both fail and Agent SDK fallback is also unviable, the migration is dead.

### Q. F&F communication memo (sent before Phase 5)

> "We are migrating the chatbot's AI infrastructure from AWS Bedrock to direct Anthropic API. The original Bedrock choice was driven by a specific compliance posture — zero Anthropic operator access to inference. Anthropic's current enterprise terms (Zero Data Retention agreement, signed BAA, SOC 2 Type II report) now provide equivalent posture. Signed copies of all three are on file."
>
> "The migration replaces our custom orchestration layer with Anthropic Managed Agents and reduces our internal codebase by approximately 7,800 lines. There is no change to data residency, retention, or access controls visible to clients. The change is internal-architecture only. Effective date: [DATE]."

### R. Incident response drill (before Phase 5)

Tabletop drill scenarios:
- A: privileged client text accidentally sent to web_search tool
- B: agent hallucinates a case citation that lawyer files in court
- C: Anthropic API key leaks
- D: Sanitization layer fails open (client name reaches agent)

For each: detection mechanism, response steps, notification path (F&F partners, Anthropic Trust & Safety, affected client if applicable), post-incident review template.

### S. Prompt & guardrail regression tests (CI)

- Confidentiality: agent never echoes back sanitized tokens
- No-external-search-with-client-facts: when sanitization active, `web_search` and `web_fetch` blocked
- Fail-closed: when any guardrail check throws, request returns error (not partial response)
- Privilege markers: privileged-tagged inputs never appear in outbound tool calls
- Refusal preservation: jurisdictional refusals ("not licensed in [state]") remain intact
- UPL banner: every response involving non-CA authority wrapped with "for reference only — confirm with [jurisdiction]-licensed counsel"

Runs on every PR. Failure blocks merge.

### T. Tool determinism contract tests (CI)

Pinned-fixture tests per tool:

| Tool | Fixture |
|---|---|
| `ceb_search` | 10 queries with frozen Upstash snapshot → expected top-K with stable ordering |
| `courtlistener_search` | 10 queries with VCR cassettes → expected case list |
| `statute_lookup` | 10 (code, section) pairs with cached HTML → expected canonical text |
| `legiscan_search` | 5 bills with cached responses |
| `openstates_search` | 5 queries with cached responses |
| `citation_verify` | 20 citations (10 real, 10 fabricated) → expected verified/unverified |

Tests fail if tool output drifts. Run on every PR touching tool callbacks.

### U. Key management runbook

- **Rotation cadence:** Anthropic and OpenAI keys rotated every 90 days; CourtListener / OpenStates / LegiScan annually
- **Storage:** 1Password vault scoped to F&F engineering; Vercel env vars sourced from 1Password CLI on deploy
- **Emergency revoke:** documented runbook (revoke at provider, rotate Vercel env, redeploy, audit log) — target time-to-revoke < 15 min
- **Egress allowlist:** Vercel function fetch restricted to: `api.anthropic.com`, `api.openai.com`, `*.upstash.io`, `courtlistener.com`, `openstates.org`, `legiscan.com`. Block all others by default.
- **Break-glass access:** any human read of production transcripts logged with reason, reviewed weekly

### V. DPIA addendum

Produced before Phase 5:
- Data flow diagram (client → Vercel → Anthropic; client → Vercel → OpenAI for embeddings; client → Vercel → CourtListener / OpenStates / LegiScan)
- Data classifications at each hop
- New/changed processors vs prior architecture
- ZDR scope per endpoint (inference, logs, telemetry, abuse-monitoring, support workflows) with exceptions documented
- Risk register update
- Owner: Arjun. Reviewer: F&F managing partner. Sign-off required before Phase 5.

### W. Evidentiary discovery hardening

In a malpractice action, plaintiff's counsel can subpoena: source code, system prompts, evaluation logs, redaction decisions, agent versions, tool-call traces. Plan must assume everything written here will be read by an adversarial expert witness.

- **System prompts:** Treated as legal artifacts. Every change reviewed and signed off; full version history retained 7 years; no disclaimers like "the model may hallucinate" inside the system prompt itself (becomes evidence of known defect).
- **Eval logs:** Every gold-set grading preserved as evidentiary record showing the system was tested before deployment. Failed evals not deleted — they show the firm caught problems pre-cutover.
- **Tool-call traces:** Per-session trace stored with chain-of-custody (per §G) so any output is reconstructable from inputs.
- **Privileged work-product marking:** Internal eval discussions and design docs subject to attorney work-product privilege are marked accordingly and stored separately from operational logs.
- **Litigation hold capability:** Runbook for freezing all logs/configs related to a specific session or matter on subpoena receipt — tested in §R IR drill.

### X. UPL exposure controls

Most malpractice policies have a UPL (Unauthorized Practice of Law) exclusion. If the bot is interpreted as practicing non-CA law, coverage may be voided.

- **Jurisdictional banner** on every response involving non-CA authority (system-prompt-enforced, verifier-checked)
- **Refusal patterns** for queries that look like a request for legal advice on non-CA law (vs reference research)
- **Insurance review** — Phase 0 deliverable confirms in writing that the policy covers AI-summarized non-CA authority
- **Audit:** every cross-jurisdictional response logged with its jurisdiction tag

---

## Files that change at implementation time

| Action | Files |
|---|---|
| **Delete entirely** | `agents/` (8 files, 2,521 lines), `api/orchestrate-document.ts` (1,239), `api/gemini-chat.ts` (327), `api/claude-chat.ts` (197), `services/verifierService.ts` (447), `services/geminiService.ts` (0, empty stub) |
| **Replace with thin client** | `gemini/chatService.ts` (3,085 → ~300–600, measured at Phase 1), `api/anthropic-chat.ts` (85 → folded into the new `api/agent/*` route files; helpers in `api/_lib/agentProxy.ts`) |
| **New** | `api/agent/sessions.ts`, `api/agent/sessions/[id]/events.ts`, `api/agent/sessions/[id]/tools/[tool_call_id].ts`, `api/agent/draft.ts`, `api/agent/verify.ts`, `api/_lib/agentProxy.ts` (~400 lines shared) |
| **Keep, rewire** | `components/drafting/*` (per Phase 4 audit), `gemini/cebIntegration.ts`, `services/confidenceGating.ts`, `services/guardrailsService.ts`, `services/retrievalPruner.ts` |
| **Keep as tool callback targets** | `api/ceb-search.ts` (582), `api/courtlistener-search.ts`, `api/legislative-search.ts`, `api/legislative-billtext.ts`, `api/verify-citations.ts` (266), `api/serper-scholar.ts` |
| **Keep, untouched by migration** | `api/chats.ts` (276, chat history), `api/templates.ts` (522, drafting templates), `api/export-document.ts` (670, Word/PDF), `api/config.ts` (15), `api/debug.ts` (38) |
| **Env updates** | Drop `OPENROUTER_API_KEY`. Keep `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_*`, `COURTLISTENER_API_KEY`, `OPENSTATES_API_KEY`, `LEGISCAN_API_KEY` |
| **Dependencies** | Drop `@google/genai`. `@anthropic-ai/sdk` upgraded if needed for Managed Agents beta methods. |
| **CLAUDE.md** | Remove stale `utils/googleGenAI.ts` reference; document new architecture |

---

## Verification (when Phase 1 begins)

The plan-revision phase is not code-verified. The next gate is **Phase 1 spike completion**:

1. 50-question gold set scored against rubric (a)–(e), including (d1) citation resolution + (d2) proposition fidelity
2. Inter-rater κ ≥ 0.6 reported
3. Per-tool callback latency p50/p95/p99 logged
4. End-to-end latency comparison vs current `chatService.ts` pipeline
5. Agent-config SHA retrievable from audit log
6. Written go/no-go decision before Phase 2 starts

---

## Open Items

**Pre-Phase-1 engineering (each ~0.5 day, all owned by Arjun):**

1. **Sanitization branch audit** — pull `codex/drafting-magic-sanitized`, inventory `services/sanitization/`, confirm contents before relying on them in §E and §F
2. **Self-administered privilege smoke test** (§0.b) — author 30 traps, run against sanitization, fix obvious leaks
3. **Upstash KV mirror schema** — schema for §D, write-pattern load test
4. **Tool-callback latency baseline** — measure current `chatService.ts` round-trips for Phase 1 comparison

(SDK capability audit was previously in this list; promoted to Phase 1's first gate — see "Phase 1 — Spike" §"Phase 1 first gate".)

**User decisions (Arjun):**

5. **ZDR / BAA / SOC 2 status** — closing separately; gates Phase 5
6. **Malpractice carrier UPL review** — written confirmation required before Phase 5
7. **Gold question set source** — sanitized F&F query logs vs newly constructed; affects Phase 1 timeline

**Deferred to post-Phase-5:**

8. **Embeddings re-evaluation (Voyage vs OpenAI)** — separate project after migration is stable
