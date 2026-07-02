<!--
=============================================================================
DOCUMENT: reports/overnight-report-2026-07-02.md
WHAT THIS IS: The overnight work + comprehensive test report for Arjun,
covering the V1 purge (one front end, one link) and the full functional test
of the production app, run while he slept on 2026-07-01 → 07-02.
INPUT SOURCES: live test runs against http://localhost:5173 / :3000 (same
code as production, real Anthropic/Upstash/CourtListener backends) and
https://california-law-chatbot-v2.vercel.app (production).
OUTPUT FILE: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/overnight-report-2026-07-02.md
=============================================================================
-->

# Overnight Report — July 2, 2026

**TL;DR: Done. There is now ONE link — https://california-law-chatbot-v2.vercel.app — and ONE front end (the V2 app; the root and every old path redirect into it). All V1 code is deleted and deployed. The full test battery is green for the first time ever (153/153 sanitization, 12 compliance suites, 120/120 PII traps), and I live-tested every major feature end-to-end against real backends. Three real security/compliance gaps were found and FIXED along the way.**

---

## 1. The V1 purge (shipped to production)

- **One front end.** `App.tsx` rewritten: `/` and legacy `/c/:chatId` (and any unknown path) redirect to `/v2`. The V1 chat UI is gone.
- **Deleted:** the whole V1 client layer (ChatPage, Sidebar, ChatWindow, Message, ModeSelector, drafting/, useChat, useDrafting, the gemini/ chatService pipeline, V1 verifier/confidence/guardrails/retrievalPruner services, V1 agents/*.ts, chatStore, retry/fetchWithRetry, shadowRun) · 14 legacy API routes (the OpenRouter gemini-chat / claude-chat / orchestrate-document, plus anthropic-chat, ceb-search, courtlistener-search, legislative-*, verify-citations, serper-scholar, templates, config, debug, agent/shadow) · 24 root-level V1 test scripts · 18 stale tech-note docs (borderline legal/report docs moved to `docs/archive-v1/`, not deleted).
- **Deps dropped:** `@google/genai`, `openai`, `@vercel/kv`, `@clerk/testing` (all unused).
- Everything is recoverable from git history and the 18 `archive/*` tags.

## 2. Three real problems found & fixed during the purge

1. **Platform-level wildcard CORS.** `vercel.json` was injecting `Access-Control-Allow-Origin: *` on every `/api/*` response at the edge — silently overriding all the F8 per-route CORS hardening. Removed; per-route strict CORS now governs (verified live: an evil origin does not get its origin reflected).
2. **`/api/chats` had NO PII backstop.** The Phase-6 pre-save scan (reject raw PII in titles/messages before they hit Blob storage) had been lost in a V2-era rewrite of the route. Restored: POST/PUT/PATCH now scan and reject with an audit record (`chats:create|save|rename`).
3. **`/api/export-document` was unauthenticated.** Found by probing production: it processed POSTs with no Clerk token (the exact PRD §8 gap — F8 had added CORS but not auth). Fixed; production now returns 401 unauthenticated (verified live).

Also ported during the purge: the **invented-token hallucination warning** from V1's Message.tsx into the V2 chat surface (it existed only on a dead branch), and `agent.json` synced to `claude-fable-5`.

## 3. Comprehensive functional test results

Authenticated flows were tested **locally against the identical code + real production backends** (real Anthropic API, real Upstash Redis/Vector, real CourtListener) because your Clerk session lives in your Chrome, which I can't drive. Production itself was tested on every unauthenticated surface. FAIL IS FAIL — these are actual observed results:

| # | Test | Result |
|---|------|--------|
| 1 | Root + legacy paths redirect to /v2 (one link) | ✅ `/` → `/v2`, `/c/:id` → `/v2`, unknown → `/v2` |
| 2 | Quick Answer turn (Sonnet 4.6, UI end-to-end) | ✅ Correct anti-SLAPP answer, no page errors |
| 3 | Research turn, streaming (Fable 5 + tools + KV persistence) | ✅ 2/2 streamed scenarios; correct probate answer with CEB citations. TTFT ≈ 40 s (see §5) |
| 4 | **PII wire test (the flagship)** | ✅ Typed "María González, 415-555-0148" into the UI; the wire body read `CLIENT_001 (phone PHONE_001)` — **raw PII never left the browser**; answer arrived; UI rehydrated the real name locally |
| 5 | Server PII backstop (raw PII sent straight to the API, bypassing the browser) | ✅ Blocked: `sanitizer_unavailable / Raw PII detected (phone)` |
| 6 | Matter mode: client_confidential without recorded consent | ✅ Fail-closed: **all 8 external tools blocked** (`consent_required`), tokenization escalated to strict-er, model answered from own knowledge only (correctly: CCP §337, 4 years) |
| 7 | Matter mode: protected_discovery lock | ✅ Escalation locks the matter; downgrade rejected: "requires explicit attorney confirmation (logged)" |
| 8 | Per-turn compliance manifest | ✅ Emitting to Redis per turn — `model_policy: anthropic_direct`, allowed/blocked tools, provider snapshot with the new de-ZDR retention facts, hashes only |
| 9 | Citation verifier (structured outputs — new Fable path) | ✅ Real citation (Navellier v. Sletten) → **real, 0.99**, with CourtListener URL. Fabricated citation (Hendricks v. California Probate Bureau) → **fake, 0.92**, with reasoning |
| 10 | Draft route | ✅ Alive + validates input (`template_id must be one of: legal_memo, demand_letter, client_letter, motion_compel`) |
| 11 | Chats API auth | ✅ Strict Clerk auth (401 without token, even in local dev — fail-closed) |
| 12 | Prod: deleted V1 routes | ✅ All 11 probed routes → 404 |
| 13 | Prod: unauthenticated API access | ✅ chats/matter-context/sessions/turn-stream → 401; export-document → 401 (after tonight's fix) |
| 14 | Prod: security headers | ✅ X-Frame-Options DENY, nosniff, referrer-policy, permissions-policy; no wildcard ACAO |
| 15 | Prod: sign-in gate | ✅ Bare domain shows Clerk sign-in when logged out |
| 16 | Test battery | ✅ **Fully green, first time**: sanitization 153/153 (was 137 pass / 29 stale fails), 12 compliance suites (113 checks), traps 120/120 zero leaks, allowlist + workspace-crypto suites, tsc clean, build clean |

## 4. What I could NOT test (honesty section)

- **Authenticated flows on production itself** — your Clerk session is in your Chrome; I verified the same code locally against real backends instead. A 2-minute human pass on prod (send one chat, one verify) would close that gap.
- **Full Draft / Drafting Magic generation** — routes are alive and validated, sanitization of those flows is covered by the green suite, but I didn't run a complete multi-section draft generation overnight.
- **In-browser GLiNER detector (`VITE_DETECTOR=web`)** — tests ran on the daemon detector (running on your Mac). The web detector is flag-gated and was validated 120/120 on 2026-06-30.
- **Model failover** — can't force an Anthropic 404 on demand; covered by unit tests.

## 5. Observations for when you're up

1. **Research-turn latency:** TTFT ≈ 40 s on Fable 5 research turns (adaptive thinking + tools). Quick mode is snappy. If research feels slow in daily use, we can tune `output_config.effort` per workflow — one-line change.
2. **Clerk shows a "Development mode" badge on production** — pre-existing; switch the Clerk instance to production when convenient.
3. **The old `california-law-chatbot` (V1) Vercel project** still auto-builds from main with stale env vars — retire it in the dashboard.
4. `/api/agent/sessions` and `/api/chats` require real Clerk tokens even in local dev (no dev bypass) — intentional fail-closed, but it means the local sidebar shows no history unless signed in.

## 6. Where everything is

- Live app: https://california-law-chatbot-v2.vercel.app (→ `/v2`)
- Commits on `main`: `e7db198` (V1 purge) + export-auth fix, both pushed and deployed
- This report: `reports/overnight-report-2026-07-02.md`
- Smoke reports: `reports/agent-loop-stream-smoke-2026-07-02.json`, `reports/agent-loop-smoke-2026-07-02.json`, `reports/traps-baseline-2026-07-02.json`
