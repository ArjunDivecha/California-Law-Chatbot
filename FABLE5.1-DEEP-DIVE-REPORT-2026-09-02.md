# California Law Chatbot (AskPauli / DancingElephant) — Fable 5.1 Deep Dive

**Author:** Claude Fable 5.1 (`claude-fable-5-1`), 2026-09-02
**Checkout reviewed:** `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`, branch `codex/citelaw-workflow-validation` at `7daeacc` plus ~990 lines of uncommitted UI changes
**Method:** six parallel reviews (concept/docs, server agent core, compliance + sanitization, auth/data/infra, front end, tests/build/quality), every finding grounded in `file:line`, and every P0 re-verified by hand in the main session against the code, the git remotes, the Vercel environment, and the live production bundle. Anything not verified is marked *(reviewer claim)*. The prior review in `FABLE5-DEEP-DIVE-REPORT.md` (2026-06-12) covered the pre-V4 state; this report does not repeat it.

---

## 1. Bottom line

The product's *idea* is right and its architecture is unusually well drawn for a two-partner firm's tool: a browser-side PII tokenizer, a server-authoritative policy engine, a fail-closed exfiltration guard, five independent sanitization layers, a counsel-approved model allowlist, and a signed/notarized desktop variant with zero cloud stores. Everything that can be run is green: build, typecheck, all 17 test files, both 120-trap suites, and a live agent smoke test after the API limit was raised.

But the review found a cluster of problems that the green tests cannot see, and several are urgent:

| # | Finding | Status | Severity |
|---|---|---|---|
| 1 | **Client matter documents are on a public GitHub repo right now.** `Morgan v V2X Inc.pdf` (a protective-order matter), three Femme & Femme internal memos, the 2026-04-24 meeting memo, and 34 agent-conversation transcripts are tracked on `origin/main` of `github.com/ArjunDivecha/California-Law-Chatbot`, which `gh` reports as **PUBLIC**. | **Verified live** | P0 |
| 2 | **The live Anthropic API key is committed on this branch** in two installer scripts (`installer-pkg/stage-*/Install *.command`). The key matches `.env` byte-for-byte. It is in two local-only commits (2026-07-24, 2026-08-21) that are **not** on any remote, so it is not public yet. A `git push` of this branch would publish it. | **Verified: one push away** | P0 |
| 3 | **Rachel's browser crash has a root cause.** Production ships the PII detector as a **1.157 GB fp32 ONNX model downloaded into the browser tab on app mount**, double-buffered during download (~2.3 GB peak), then copied into the WASM heap, on the main thread, with no memory gate. An 8 GB Mac cannot survive it. | **Verified live** (bundle + Blob `content-length: 1157129714`) | P0 |
| 4 | **The server-side PII backstop can be switched off by the client.** The request body carries a `user_allowlist`; the server honors it with a bidirectional 3-character substring match, so one allowlist entry equal to the message text zeroes out every category except SSN/card/bank/DL/MRN/TIN. | **Verified in code** | P0 |
| 5 | **The policy engine's hard block is never enforced at the Anthropic call.** `decidePolicy()` computes `externalCallsAllowed: false` for revoked/prohibited consent and for staff on protected matters; nothing in `agentLoop.ts` reads it before calling Anthropic. The turn manifest then records `external_calls_allowed: false` beside a completed external call. | **Verified in code** (grep: zero reads) | P0 |
| 6 | **Verification tooling has correctness bugs that flip verdicts.** leginfo 403/404 → "statute is fake"; the verifier sub-agent reads a `results` field CourtListener never returns, so case-name evidence is always ignored; `draft-qc` badges unverified sections "clean"; `draft-qc` runs under a 60 s limit for a ~270 s workload. | **Verified in code** | P0/P1 |
| 7 | **This branch and `main` have forked.** 52 commits ahead (CiteLaw provider, workflow validation) and 55 behind (the AskPauli → DancingElephant rebrand of 2026-08-18, landing page, DNS cutover). The CLAUDE.md in this checkout is one rebrand stale. | **Verified** | P1 |

Everything else in this report is secondary to those seven. Section 9 gives the order of work.

---

## 2. What this program is

### 2.1 Thesis

A Clerk-authenticated legal research and drafting workbench for a California family-law / LGBTQ practice, built on one premise: **client identifiers never leave the attorney's device in raw form**. Names, addresses, SSNs, dates and case numbers are tokenized in the browser (`CLIENT_001`, `ADDRESS_002`) before any request is sent; the model only ever sees placeholders; responses are rehydrated locally for display. Around that wedge sit hallucination controls (every case and statute citation verified against CourtListener, CiteLaw, leginfo, Cornell LII, eCFR), a seven-year metadata-only audit chain, and a matter-mode ratchet (`public_research` → `client_confidential` → `protected_discovery`) that tightens tool access as sensitivity rises.

The design principles, each traceable to a document:

1. **Gating fails closed, plumbing fails open.** Policy, PII backstop and exfiltration guard throw and block; audit writes, rate limiting and session-ownership degrade gracefully, with a comment at each site explaining why (`api/_lib/httpGuard.ts:186-190, 205-211`; `api/_lib/compliance/toolQueryGuard.ts:61-95`).
2. **Tokenize on-device; the server regex is a backstop, not the control** (`README.md:33-39`, `api/_lib/agentProxy.ts:111-120`).
3. **Contract over ZDR.** After Anthropic zero-data-retention was priced out (~$100k/yr, `docs/PRD_COPRAC_ZDR_COMPLIANCE.md` addendum, 2026-07-01), standard commercial terms plus DPA became the operative posture, justified against *Morgan v. V2X* (`docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md`, tenth addendum).
4. **Counsel-approved models only, fail closed** (`api/_lib/approvedModels.ts:41-53`).
5. **CEB content is permanently off-limits** for legal, not technical, reasons (`api/_lib/tools/index.ts:19-23`).
6. **Narrow vertical; the moat is compliance depth, not corpus size** (`ARJUN.md`).

### 2.2 How it got here

| Date | Pivot |
|---|---|
| 2026-05-03 → 06-02 | V1 (Gemini + OpenRouter, no wire sanitization) → V2 plan with ten dated addenda; GLiNER replaces OPF; *Morgan v. V2X* reframes ZDR as optional |
| 2026-06-12 | Fable 5 engine; first deep-dive report |
| 2026-07-01/03 | V1 purged; ZDR premise withdrawn; CEB retired |
| 2026-07-06 | Fable 5 regenerates CLAUDE.md/FABLE.md/ARJUN.md; flags T-PII-032 wire regression (fixed 07-07) |
| 2026-07-16/17 | Tauri desktop app: Node sidecar + SQLite, zero cloud stores, signed and notarized |
| 2026-07-22 | Renamed AskPauli; automatic latest-model resolution (`modelResolver.ts`) |
| 2026-07-29 | CiteLaw added as second citation provider (**this branch only**) |
| 2026-08-18 | Renamed DancingElephant, full reskin, landing page, DNS (**`main` only**) |
| 2026-08-30 | Anthropic usage limit hit; raised; smoke test green again |

### 2.3 The request path as built

```
BROWSER                                   VERCEL FUNCTION                       ANTHROPIC
keystroke → 300ms debounce → GLiNER      requireUser (Clerk) → CORS allowlist
  preview chips (informational)          → session ownership → rate limit
send → tokenizeForWire():                → PII regex backstop (fail-closed 503)
  GLiNER spans + regex + compound-risk   → readMeta → decidePolicy()
  + allowlists → IndexedDB token map     → buildToolsForPolicy → agentLoop
→ assertNoRawPii() → POST turn-stream      ↳ per tool: guardToolQuery → dispatch
                                             → sanitizeToolOutput → cache
                                           ↳ audit HMAC + turn manifest
SSE tokens → rehydrate locally           ← stream
```

What is genuinely strong (and worth protecting while fixing the rest): matter mode really is server-authoritative and ratcheted (`api/matter-context.ts:40-54`, `api/_lib/compliance/matterContext.ts:47-62`); `decidePolicy` is a pure, exhaustively tested function; `guardToolQuery` runs before the cache read so a newly blocked tool cannot be served a stale allowed result (`agentLoop.ts:714-735`); the cache stores sanitized output so its contract is self-enforcing; `NEVER_ALLOWLISTABLE_CATEGORIES` held under adversarial testing; the regex layer has no catastrophic backtracking (570 KB input in 105 ms); the desktop build chain signs its native addon and fails loudly at every step; and `workflowValidation.ts` is strict, total and path-traversal-safe.

---

## 3. Verification results (2026-09-02)

| Check | Result |
|---|---|
| `yarn build` | exit 0, 9.4 s, 2,698 modules |
| `tsc --noEmit` | 0 errors (but `tsconfig.json` has no `strict`, and nothing runs typecheck in CI) |
| `yarn test:sanitization` | 153/153 |
| `yarn test:traps` (analyze pipeline) | 120/120 → `reports/traps-baseline-2026-09-02.json` |
| `tsx tests/traps/runTrapsWire.mjs` (wire pipeline) | 120/120, 0 leaks → `reports/traps-wire-2026-09-02.json` |
| 14 other test files run directly | all pass, ~370 assertions total |
| `yarn agent:smoke` (2026-08-30, live) | 2/3; scenario 3 blocked by the server PII backstop because the script sends a raw phone number bypassing browser tokenization (guard working; script expectation stale) → `reports/agent-loop-smoke-2026-08-30.json` |
| `yarn npm audit --severity high` | 11 advisories: `@clerk/clerk-react` 5.61.4 authz bypass (fix 5.61.9), `jspdf` 4.0.0 **critical** HTML injection (fix 4.2.1), `postcss` 8.5.15, `vite` 6.4.1 |

Coverage shape: 14 of 17 test files are wired to no npm script; 43 of 83 modules under `api/_lib`, `api/_shared`, `services`, `hooks`, `components` have no test importing them; the React layer has zero tests; there is no lint or format tooling; the only GitHub Action is a docs bot. Green means "the tested surface is fine", not "the product is fine".

---

## 4. Findings — P0

### P0-A. Client matter material on a public repository *(verified live)*
`origin/main` of `https://github.com/ArjunDivecha/California-Law-Chatbot` (visibility PUBLIC) tracks: `Morgan v V2X Inc.pdf`, `F&F_Meeting_Memo_2026-04-24.md`, `docs/morgan-memo-to-rachel-lyla-2026-06-02.md`, `docs/q-ff-communication-memo-2026-05-15.md`, `docs/f-and-f-lawyer-memo-ca-guidance-zdr.md`, `docs/PRD_MORGAN_PROTECTIVE_ORDER_COMPLIANCE.md`, and 34 files under `.pks/agent-context/`. Also tracked locally (not yet on `main`): `docs/Family Known Donor Engagement Letter (1).docx`, `.playwright-mcp/drafting-magic-draft-2026-04-27.docx`.
**Why it matters:** the repo of a tool whose purpose is keeping client text off third-party infrastructure publishes matter documents from a protective-order case. This is a Rule 1.6 exposure, not a code bug.
**Fix:** make the repo private today; remove the paths from tracking and from history (`git filter-repo`); move them to the Dropbox tree; gitignore `.pks/`, `.playwright-mcp/`, `installer-pkg/`.

### P0-B. Live Anthropic key committed on this branch *(verified: local-only, one push away)*
`installer-pkg/stage-2026-07-22/Install AskPauli.command:13-17` and `installer-pkg/stage-archive-2026-08-18/Install California Law Chatbot.command:13` contain `ANTHROPIC_API_KEY`, `COURTLISTENER_API_KEY`, `OPENSTATES_API_KEY`, `LEGISCAN_API_KEY` in plaintext. The Anthropic key equals the one in `.env`. Introduced in commits `a46bfdb` and `3079a65`; neither is reachable from `origin/main` or `origin/codex/citelaw-workflow-validation-publish`; the key prefix does not appear at either remote tip. `.gitignore:43-44` covers `installer-pkg/{build,payload,dist}/` but not `stage-*/`.
**Fix:** do not push this branch until the two commits are rewritten out; gitignore `installer-pkg/` wholesale (it is also 491 MB of tracked binaries including a 114 MB Node executable, which GitHub would reject anyway); add a `gitleaks` pre-commit hook. Rotating the key is prudent even though it has not left the machine.

### P0-C. Browser OOM: 1.157 GB fp32 GLiNER model loaded into the tab on mount *(verified live)*
- Vercel Production has `VITE_DETECTOR` and `VITE_GLINER_MODEL_URL` set. The live bundle `assets/index-BpkfhCoe.js` references `model_fp32-…onnx` on Vercel Blob and contains **zero** occurrences of the daemon port `47842` — the local-daemon path was tree-shaken out; production is web-detector only.
- `curl -I` on the model URL: `content-length: 1157129714`.
- `services/sanitization/glinerWebClient.ts:208-228`: the download accumulates all chunks (1.16 GB), allocates a second 1.16 GB `Uint8Array` and copies (`:217-219`), then `cache.put(new Response(bytes.buffer))` (`:228`), then hands the buffer to ONNX which copies it into the WASM heap (`:249-256`, `multiThread: false`). The warm-cache path (`:182`) does a fresh 1.16 GB `arrayBuffer()` on every page load. No `dispose()` exists (`:301-309`, `idleUnloadSeconds: 0`).
- `hooks/useSanitizer.tsx:299-311` calls `opfWarmup()` on `SanitizerProvider` mount, which wraps every route (`App.tsx:81`). `glinerWebClient.ts:336 → :368` loads the engine *before* honoring `warmupOnly`.
- `services/sanitization/deviceCapability.ts:26-38` gates on user-agent (iPhone/iPad/Android) only; its own header (`:11-15`) states the 1.15 GB requirement. There is no `navigator.deviceMemory` check.
- Inference uses `engine.inference()` (`:372`) instead of the package's `inference_with_chunking(…, max_words=512)`; with `maxWidth=12` and 17 labels the span tensors scale with `tokens × 12 × labels`, and `V2DraftingMagicPage.tsx:1360` tokenizes every source document concatenated.
- All of this is on the main thread; there is no Web Worker anywhere in `services/`, `hooks/`, `components/v2`.
**Failure matches the report exactly:** open the app → warmup starts → type a question → renderer holds ~2.3 GB at the copy step, ~3.5 GB after ORT init → macOS kills the browser. No `try/catch` sees an OOM kill, so no error banner. Reload → warm cache → 1.16 GB allocation → dies again.
**Fixes, by leverage:**
1. Today, no code: set `VITE_GLINER_MODEL_URL` in Vercel Production to the **int8** (349 MB) or **fp16** (580 MB) variant already enumerated at `glinerWebClient.ts:168-174`; redeploy; re-run both trap suites to confirm 120/120 holds.
2. Stop double-buffering (stream into `cache.put(resp.clone())` and read back, or null chunks as they are copied).
3. Add a memory gate: `navigator.deviceMemory < 8` → treat as unsupported like mobile.
4. Switch to `inference_with_chunking`, cap input size, add a timeout.
5. Move ORT into a Web Worker; stop warming on mount (warm on matter-mode escalation or first send — `public_research` relies on the server backstop anyway).

### P0-D. Client-supplied `user_allowlist` disables the server backstop *(verified in code)*
`api/_lib/agentProxy.ts:57` takes `user_allowlist` from the body (fed by `turn-stream.ts:128`, `draft-stream.ts:158`, `drafting-magic.ts:193`, `revise-section.ts:124`, `verify-stream.ts:85`, `draft-qc.ts:149`). `services/sanitization/detectionPipeline.ts:599-611` matches with `a.includes(raw) || raw.includes(a)` at a 3-char floor. Reviewer test: allowlist `["com"]` removes email; `["415"]` removes phone; an entry equal to the whole message → **0 spans, `privileged: false`**. Names have no server-side detector at all (`detectionPipeline.ts:584-591`), so once this is set, names/emails/phones/addresses/DOBs/ZIPs/case numbers have zero server defense; only the six `NEVER_ALLOWLISTABLE_CATEGORIES` (`api/_shared/sanitization/index.ts:109-116`) still block. The same flag also flips `privileged` false in the audit record and MCP gating.
**Fix:** never accept an allowlist from the client; persist per-user allowlist server-side and look up by `userId`. Replace substring matching with exact, whole-span, case-folded equality; reject entries shorter than ~4 chars or that themselves match a PII pattern. Mirror in `wireGuard.ts:40-48`.

### P0-E. `externalCallsAllowed` / `policy.block` never enforced *(verified: zero reads in agentLoop.ts)*
`api/_lib/compliance/policyEngine.ts:108, 222-242` sets `externalCallsAllowed = false` for `consent ∈ {prohibited, revoked}`, for `not_obtained` on confidential/protected matters, and for staff on `protected_discovery`. `agentLoop.ts` consumes the decision only for `allowedTools` and `mcpServers` (`:1070-1077`, `:1099-1117`). `guardToolQuery` honors the flag for third-party tools, but the Anthropic inference call proceeds, and `turnManifest.ts:83` records `external_calls_allowed: false` on a turn that made an external call.
**Fix:** after `computeTurnPolicy`, if `!policy.externalCallsAllowed || policy.block` abort with a structured `policy_blocked` error before constructing the client, and audit the blocked turn. Add a unit test asserting no `messages.create` for each hard-block input.

### P0-F. Verification bugs that flip verdicts *(verified in code)*
- **leginfo non-200 → "fake".** `api/_lib/tools/statuteVerify.ts:239-249`: only `status >= 500` returns `unavailable`; 403/404/WAF pages fall into the paragraph scrape, find nothing, return `not_found`, which the tool description (`:390`) and verifier prompt (`verifierSubAgent.ts:97`) map to `fake` at confidence ≥ 0.9. The USC branch (`:271-276`) does it right. A rate-limit on Vercel's egress IP would mark every real California statute in a brief as fabricated.
- **Verifier never sees CourtListener evidence.** `verifierSubAgent.ts:206-211` reads `.results`; `courtlistenerSearch.ts:156` returns `{ hits, total_count, elapsed_ms }`. `positiveEvidence` is always false, so the C4 gate (`:353-361`) downgrades real cases found by case-name search to `ambiguous` ≤ 0.4.
- **`draft-qc` missing from `vercel.json`** (`vercel.json:8-45` lists six functions; `draft-qc` falls to the `api/**/*.ts` 60 s cap) while running up to 15 sequential ~18 s verifications (`draft-qc.ts:41-43, 76`). The function is killed after ~3 verdicts; the UI hangs on partial badges.
- **`draft-qc` badges unverified sections "clean".** `draft-qc.ts:208` slices the first 15 citations in section order; `:267-278` derives status purely from `issueCount`, so later sections render `clean` with `issue_count: 0`. In a hallucination-QC tool this is the worst failure direction.
**Fixes:** mirror the USC branch in the CA branch and require a positive page marker before `not_found`; read `r.hits`; add `draft-qc.ts` at `maxDuration: 300`; track which sections received verdicts and render `not_checked` otherwise.

---

## 5. Findings — P1

**Server agent loop** (`api/_lib/agentLoop.ts` unless noted)
- `stop_reason: 'pause_turn'` unhandled (`:1138-1142`, `:1532-1543`); `web_search` is a server-side tool in the default tools array (`tools/index.ts:80-84`), so long research turns return partial text recorded as complete.
- `max_tokens` truncation mid-`tool_use` dispatches the truncated input (`:1123-1149`, `:1518-1594`); `agent.json:5` sets `max_tokens: 8192`, shared with adaptive thinking at effort `high` (`:1412-1418`) — long motion drafts are cut off and misreported as `missing_sections`.
- No `finally` around the streaming loop (`:1396-1685`): on client disconnect the Anthropic stream is never aborted and **no audit record or turn manifest is written** for a turn that reached Anthropic. The comment at `turn-stream.ts:113-115` describes cleanup that does not exist. The error path (`:1679-1685`) also writes no audit record.
- `draft-stream`, `drafting-magic`, `revise-section` append to session history without the single-flight lock; only `turn`/`turn-stream` acquire it. Interleaved appends break `repairAndWindowHistory` (`:605-657`) and drop tool rounds.
- Client-disconnect detection exists in one of five SSE routes (`turn-stream.ts:117-120`); the others run 12-round loops or 20 verifier sub-agents to completion for a closed tab.
- `web_search` results bypass `sanitizeToolOutput` (`:269-296` mandates it; only in-process tools reach it via `:766`); results persist verbatim (`:1523`).
- `verify-stream.ts:144-145` schedules 20 × ~18 s = 360 s under a 300 s limit.
- CiteLaw batch results correlated by array index with no identity check (`citationVerify.ts:517-522`); a filtered/reordered row lets citation A inherit B's `confirmed` and be stamped `verified` (`:727-728`).
- `citation_verify` has no cap on citations and no type guard (`citationVerify.ts:782-827`, `tools/index.ts:275-284`); non-string input throws a JS internal into the tool result and the SSE stream, unscrubbed (`:317-324`).
- `parseStatuteCitation` returns the first cite in jurisdiction order, not text order (`statuteVerify.ts:138-200, 363-364`).
- Matter mode fails open: `readMeta(...).catch(() => null)` → `public_research` with consent `allowed` (`:989-997`). A Redis blip turns a protected matter into the most permissive mode. (`readMessages(...).catch(() => [])` at `:1039`/`:1340` similarly erases conversation context silently.)

**Sanitization / trust boundary**
- IndexedDB lookup key is an unsalted SHA-256 of the raw PII (`api/_shared/sanitization/crypto.ts:133-142`, `store.ts:79-88`); SSN/date/phone keyspaces fall to offline brute force with the category label attached. Use HMAC under a derived key or a per-store pepper.
- The at-rest key is in `localStorage['cla-sanitization-device-key']` (`hooks/useSanitizer.tsx:95-105`) while `store.ts:8-16` says "never persisted anywhere / NO RECOVERY". Fix the docstring and any partner-facing claim; optionally wrap with a non-extractable `CryptoKey`.
- Regex recall gaps in the last line of defense (`api/_shared/sanitization/patterns.ts`, all reproduced): unhyphenated/spaced SSN; DD/MM, dotted and ISO-slash dates (`:139`); lowercase, numbered (`42nd Street`), PO Box and Trail/Ter/Sq addresses (`:104`); case-sensitive `CA DL` (`:61`) and `ZIP` (`:121`); bank cue with words between (`:160`); non-ASCII email locals (`:92`) leave `marí` raw on the wire while both guards see a clean payload; international phone mis-categorized as `credit_card`.
- `toolQueryGuard.ts:53-58` scans only top-level string values; nested objects/arrays egress unexamined, and the PII re-check is skipped entirely in `public_research` (`:83`).
- Mobile "best-effort" detector downgrade (`services/sanitization/realSanitizer.ts:128`) is gated only by client-held `matterMode` (`V2ChatPage.tsx:344-353`); the server never correlates detector posture with the bound mode.
- Client can override the entire system prompt via `system_prompt` in the body (`turn-stream.ts:130` → `agentLoop.ts:1021-1025`), stripping compliance disclosures.

**Auth / infra**
- Desktop sidecar is an unauthenticated local API holding the firm's key: `authEnforced()` is `VERCEL || NODE_ENV=production` (`httpGuard.ts:120-123`), neither set in the packaged app, so every request is `dev-user`; no `Host` check (DNS rebinding reads all local sessions); Tauri `csp: null` and the window loads `http://localhost:8477` (`src-tauri/tauri.conf.json`, `tauri.desktop.conf.json`) so one XSS de-tokenizes the IndexedDB token map. The `httpGuard.ts:21-29` comment ("impossible to be not-on-Vercel in production") is now false.
- Protected-matter lock is unlockable by a body boolean: `api/matter-context.ts:71-73` → `matterContext.ts:50-59` `attorney_override: Boolean(req.body?.attorney_override)`, no re-auth, and despite the message saying "(logged)" the route imports no audit module.
- `.github/workflows/openwiki-update.yml` runs an unpinned `npm install --global openwiki` with `contents: write` and pushes to the deploy branch — a supply-chain path to production.
- One shared Anthropic key across all desktop installs; per-install random `AUDIT_HMAC_KEY` means audit records across devices can never be cross-verified.

**Front end**
- Three of four stream hooks never abort on unmount (`useV2DraftStream.ts`, `useV2VerifyStream.ts`, `useV2DraftQC.ts`; only `useV2AgentStream.ts:150-154` does); the Drafting Magic inline fetch passes no `signal` (`V2DraftingMagicPage.tsx:1518-1525`).
- Full transcript re-renders and re-parses markdown per SSE token: zero `React.memo` in `components/v2/`; `ReactMarkdown` `components` object recreated every render (`V2ChatPage.tsx:1273-1288`); `daemonStatus` context churn re-renders everything every 30 s (`useSanitizer.tsx:314, 394-396`) and ~1.4×/s during model load (`:340,345`).
- `useV2DraftingMagicStream` is dead code; the page reimplements the SSE loop (`V2DraftingMagicPage.tsx:1461-1580`) and its own comment records a divergence bug from exactly this.
- Compare/Strategy tabs show estate-planning analysis ("No pour-over will language detected") for family-law packets because `localExtraction.ts:198-203` roles never match the templates at `V2DraftingMagicPage.tsx:629-651`.
- `ConfidentialityAttestation.tsx` claims an Esc handler (`:6`) it does not have; no focus trap on the consent gate.

---

## 6. Findings — P2 and P3 (condensed)

**Data retention:** `session:{id}:messages`, `session:{id}:meta`, `user:{id}:sessions` have no TTL and no delete path; `sessionStore.ts:314` refers to a `deleteSession` that does not exist; `isSessionExpired()` (`securityHeaders.ts:51`) has zero callers. Retention is "forever, by accident" while the audit layer advertises 90-day/7-year windows.
**Audit robustness:** missing `AUDIT_ENVELOPE_DEK` silently drops envelope records (`auditLog.ts:274`); no key id in envelopes or HMAC records so rotation orphans seven years of history; `nextUlid()` uses `Math.random()` with plain `SET` (`:190-199, 282`); `input_sha256 === sanitized_sha256` (`agentProxy.ts:145-146`) so the envelope cannot evidence redaction; turn manifests always record `toolsCalled: []` (`agentLoop.ts:1219, 1652`); cached tool results replay with no attestation and lose `is_error` (`:744-749`).
**Dead controls:** `storagePolicy.ts`, `reviewGate.ts`, `providerRegistry.isProviderApprovedFor`, `attestations.consentSatisfiedFor` have no callers — `protected_discovery` messages are written to Upstash despite `storagePolicy.ts:50-53` saying the DPA forbids it. Four compliance modules read as controls and gate nothing.
**Session ownership fails open** on KV error with client-minted ids (`httpGuard.ts:186-190`) — a cross-tenant read, not just a relaxed lock. Retry, then fail closed for existing sessions.
**CSP** is applied only to JSON/SSE responses (`routeSecurity.ts:67`) and absent from `vercel.json` document headers, where it would matter.
**`api/chats.ts`** duplicates Clerk auth, skips rate limiting, and is the most expensive unmetered route. **`api/export-document.ts`** is authenticated but has no PII gate and no caller; if wired, it ships the *rehydrated* document to a Vercel function.
**Tool-result idempotency cache can never hit** (keyed on Anthropic's per-response `tool_use.id`, `agentLoop.ts:737`); one Redis write per tool call, zero reads, and `turn-stream.ts:25-27` promises clients a retry safety it does not provide.
**Streaming path dispatches parallel tool calls sequentially** (`:1565-1594`) while the non-streaming twin uses `Promise.all`.
**Quick mode pays for thinking:** omitting `thinking` on Sonnet 5 runs adaptive (`:1113`, `:1418`); send `{type:'disabled'}` there.
**`sanitizeToolOutput` splices `[REDACTED]` into serialized JSON**, corrupting it (`:405-412`, acknowledged at `:756-758`).
**Fetched upstream text reaches the model unframed** as untrusted (`statuteVerify.ts:250-328`, `citationVerify.ts:387, 608-619`); naive `<[^>]+>` stripping leaves `<script>` bodies. Combined with unsanitized `web_search` results, this is the real prompt-injection surface.
**`CREDIT_CARD` over-matches any 13-19 digit run** and is never-allowlistable, so a false positive hard-blocks the send with no way out except editing client content (`patterns.ts:147-151`).
**Preview ≠ wire:** three span-merge implementations (`previewSession.ts:229-239`, `detectionPipeline.ts:110-151`, `index.ts:184-216`) and two allowlist semantics; the attorney's preview under-reports exposure.
**Wire hygiene:** SDK `timeout: 280_000, maxRetries: 2` → 840 s worst case under a 300 s function (`:1336-1337`); `unavailableModels` never expires (`:94`); `releaseLock` has no owner token (`sessionStore.ts:379-382`); `web_search_20250305` is the pre-4.6 tool variant (`tools/index.ts:71`); verifier bypasses `assertApprovedModel` and sends a ~7 KB system prompt with no `cache_control` on every round (`verifierSubAgent.ts:56-58, 295`).
**Repo hygiene:** 491 MB tracked under `installer-pkg/` (`.git` is 372 MB); eleven root-level screenshots; dual lockfiles (`package-lock.json` stale since 07-01); `.env.example` documents retired Vertex/Gemini vars and omits `ANTHROPIC_API_KEY`, `AUDIT_HMAC_KEY`, `AUDIT_ENVELOPE_DEK`; `localhost:3000/5173` in the production CORS allowlist; `dev-server.js:65` wildcard CORS with the dev-user bypass; `types.ts:46-468` orphaned V1 types; `runTurn` duplicates `runTurnStream` and has drifted, with no caller.
**UI copy:** `V2DraftingMagicPage.tsx:2582` tells the attorney it is "sending to the Bedrock drafter" — there is no Bedrock; `V2VerifyPage.tsx:1-9` calls itself a placeholder; the chat footnote still says "V2 preview … persists to Upstash KV".
**Accessibility:** no `aria-live` on streaming verdicts or chips; unlabeled textareas; `role="button"` on a `<Link>`.

---

## 7. The uncommitted diff (8 files, +987/−173)

A visual rebrand — pink/Georgia → neutral black-on-white, emoji glyphs → text, per-element Tailwind chains → 805 lines of semantic `.app-*` classes in `index.css`, plus real mobile responsiveness (the app previously had none). Zero behavioural change to any stream, gate or sanitization path (checked specifically). Quality is good: every `app-*` class used is defined, focus-visible rings and `prefers-reduced-motion` are added, and `PrivacyListsModal` gains proper dialog semantics with an Esc handler.

It is incomplete and would ship a visually bisected app:
1. `V2DraftingMagicPage.tsx` untouched (34 `pink-*` classes) and reachable from the restyled sidebar; `SignInPage.tsx` untouched (the first screen every user sees).
2. `index.html:34` inline `font-family` on `<body>` and `class="bg-gray-50"` override the new `:root` typography and `body` background; Inter is never loaded.
3. Residual pink in touched files: `V2SanitizationChip.tsx:79,83,95`, `V2DraftPage.tsx:529,611`, `V2VerifyPage.tsx:217`.
4. `.app-shell { height: 100vh; overflow: hidden }` (`index.css:66-71`) traps the composer below the fold on mobile Safari; use `100dvh`.
5. Half the internal-preview scaffolding was de-branded, half was not.

**Recommendation:** fix `index.html`, the residual pink and `100dvh`, commit; follow with a second commit for Drafting Magic + SignIn; verify with Playwright at 375 px and 1440 px on all four routes. And note this diff restyles the *AskPauli* UI while `main` already carries the *DancingElephant* reskin — reconcile with `main` before spending more on styling here (Section 9, step 4).

---

## 8. What Fable 5.1 changes for this product

Grounded against the current Claude API reference (loaded this session), not memory. The engine is `claude-fable-5` today (`agentLoop.ts:71`); `claude-fable-5-1` is the same tier at the same per-token price ($10 / $50 per MTok), same tokenizer, with these consequences for this codebase:

**Breaking or behavior-changing on migration**
- **Forced `tool_choice` (`any` / `tool`) returns 400.** The loop never sets `tool_choice` (good), but any future "force the verifier to call `citation_verify`" idea must use `auto` + instruction, `strict: true`, or structured outputs.
- **Thinking blocks are bound to the producing model** and **editing earlier turns invalidates them** ("preserved thinking"; new accounts from 2026-08-31 get a 400 on edited history). `repairAndWindowHistory` (`agentLoop.ts:605-657`) rewrites history by stripping orphaned `tool_use` blocks and windowing to 40 messages — that is exactly the kind of edit that must become append-only or move to server-side compaction before switching the engine. The Opus 5 automatic failover (`:84`) will silently drop Fable's thinking blocks on replay, which is allowed but should be understood.
- **`refusal` stop reason with `stop_details`**: already handled and surfaced well (`useV2AgentStream.ts:342-352`, `V2ChatPage.tsx:561-585`). The API now offers server-side `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) which would replace the hand-rolled 404-only failover — but the firm's ratified single-engine, refusals-must-surface policy means this is a *decision for counsel*, not a drop-in.
- **30-day data retention is required**; ZDR orgs get a 400. The firm already withdrew the ZDR premise (2026-07-01), so this is consistent, but the compliance narrative should state it explicitly.

**Free wins that plug into existing code**
| Feature | Where | Why |
|---|---|---|
| `pause_turn` continuation | `agentLoop.ts:1138`, `:1532` | Required for correctness with `web_search`; today's turns truncate silently |
| `web_search_20260209` with `allowed_domains`/`blocked_domains` | `tools/index.ts:80-84` | Domain allowlisting is a direct compliance control (leginfo, courts.ca.gov, CourtListener only) |
| Per-message `effort` (beta `mid-conversation-output-config-2026-07-01`) and mid-conversation `{role:'system'}` messages | `revise-section.ts:97`, `drafting-magic.ts:160`, `skills.ts:238-243` | Mode/skill instructions are concatenated into the top-level `system` today, invalidating the prompt cache every turn; system messages in `messages[]` preserve the cached prefix and are the injection-safe operator channel |
| Cache reads at $0.25/MTok; `usage.cache_read_input_tokens` | `:1119-1122`, `:1513-1517` | Nobody reads the cache fields, so nobody knows whether the two breakpoints ever hit (the 2.3 KB core skill is likely below the minimum cacheable prefix) |
| `thinking.display: "summarized"` or `"updates"` (beta) | `buildWireBody:897` | Fable defaults to `omitted`, so high-effort research shows a long silent pause; `updates` gives between-tool-call progress notes for the UI |
| `strict: true` on tool schemas | every `tools/*.ts` definition | Removes `requireStringField`/`clampInt` coercion and fixes the non-string `citations[]` crash at the source |
| Server-side compaction (`compact-2026-01-12`) or context editing | replaces `repairAndWindowHistory` | Ends the 40-message window that drops whole tool rounds, and is the append-only-compatible path |
| `task_budget` (`output_config.task_budget`) | `:1412` | Lets a 12-round draft pace itself instead of being cut by `max_tokens: 8192` |
| Message Batches (50% off) | `draft-qc.ts`, `verify-stream.ts` | Citation QC is not latency-critical and is the largest cost centre; batching also dissolves the 60 s/300 s timeout problems |
| Typed SDK errors (`Anthropic.RateLimitError`, `NotFoundError`) | `agentProxy.ts:168`, `agentLoop.ts:116-122` | Failover currently sniffs message text |
| 1M context | product | The June report's "matter workspace" (ingest the whole client file once, tokenized on-device) remains the highest-leverage product build and reuses the sanitization pipeline unchanged — but only after P0-C makes the tokenizer survivable on ordinary laptops |

**Prompting.** Fable 5.1 turns run longer on hard tasks and prompts written for prior models tend to be too prescriptive. The core skill (`agents/california-legal/skills/california-legal-core.md`) is compact and should port well; the verifier prompt (~7 KB, `verifierSubAgent.ts:83-151`) and the drafting skills deserve a `prompt-audit` pass. Effort should be tuned per route: `low`/`medium` for Quick and verifier sub-agents, `high` for research, `xhigh` only where drafting quality measurably improves.

---

## 9. Order of work

**Today (hours)**
1. Make the GitHub repo private. Then remove the matter documents, `.pks/agent-context/`, and `.playwright-mcp/` from tracking and history.
2. Do not push this branch. Rewrite `a46bfdb` and `3079a65` to drop the installer scripts; gitignore `installer-pkg/`; add a secret-scanning pre-commit hook; rotate the four keys anyway.
3. Set `VITE_GLINER_MODEL_URL` (Vercel Production) to the int8 or fp16 model; redeploy; re-run `runTraps.mjs` and `runTrapsWire.mjs`; ask Rachel to hard-reload. This alone should stop the crashes.
4. Bump `@clerk/clerk-react` → 5.61.9 and `jspdf` → 4.2.1.

**This week**
5. Server-side allowlist (P0-D); enforce `externalCallsAllowed` (P0-E); fail-closed `readMeta` (P1); both with unit tests in the existing harness.
6. Fix the four verification bugs (P0-F): leginfo status mapping, `r.hits`, `draft-qc` in `vercel.json`, `not_checked` badges.
7. Reconcile this branch with `main`: rebase or merge so CiteLaw + workflow validation land on the DancingElephant mainline, then regenerate CLAUDE.md.
8. Add `try/finally` to the streaming generator (abort + audit); take the single-flight lock and disconnect guard in all five SSE routes; handle `pause_turn` and `max_tokens`; raise `max_tokens` on drafting routes.
9. Wire a CI test gate: a `test:all` script running all 17 files plus both trap runners, on push and PR.

**This month**
10. Fix the GLiNER client properly (no double-buffer, chunked inference, memory gate, Web Worker, lazy warmup).
11. Desktop: per-launch bearer token + `Host` check in `requireUser`; explicit Tauri CSP; per-user keys or a broker.
12. Retention: `deleteSession`, TTLs on messages/meta, wire or delete the dead compliance modules, key-version the audit records.
13. Front end: `React.memo` on `MessageBubble`, hoist the markdown `components`, split the sanitizer status context, abort on unmount in all hooks, `ErrorBoundary` → audit log; then finish and commit the rebrand diff against whichever brand survives step 7.
14. Migration to `claude-fable-5-1` behind `V2_PRIMARY_MODEL`, after the history path is append-only (step 8/10 compaction), with `pause_turn`, `web_search_20260209`, per-route effort, and cache-hit telemetry.

---

## 10. Open questions for Arjun / counsel

1. Which brand is canonical — DancingElephant on `main`, or is the AskPauli restyle on this branch intentional for the Femme & Femme deployment? This determines how step 7 is done.
2. Is the web (in-browser) detector meant to be the production default, or was the local daemon the intended path for the firm's machines? Production is web-only today; the daemon code is tree-shaken out.
3. Server-side refusal fallbacks: the ratified policy is single-engine with refusals surfaced. Fable 5.1 makes a category-routed fallback a one-line opt-in. Does counsel want to revisit?
4. Retention: how long should session content live in Upstash? Today it is unbounded. The audit layer assumes 90 days / 7 years.
5. `public_research` deliberately allows raw PII to reach Anthropic under the DPA. Given P0-D showed the server backstop can be neutralized from the client, is the firm comfortable that the *browser* is the only real control in that mode?

---

*Reports written this session:* `reports/traps-baseline-2026-09-02.json`, `reports/traps-wire-2026-09-02.json`, `reports/agent-loop-smoke-2026-08-30.json`. *Prior review:* `FABLE5-DEEP-DIVE-REPORT.md` (2026-06-12).
