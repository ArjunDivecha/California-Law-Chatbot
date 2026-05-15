# V2 Sanitization Rebuild — Implementation Plan (2026-05-14)

**Companion to** `docs/v1-v2-audit-2026-05-14.md`. Read the audit first;
this plan turns its findings into work items.

**Mandate**: No V2 deploy, no Phase 5 cutover, no Phase 4.5 shadow-run
flip on V1 until every CRITICAL item in the audit §8 is closed with the
proof artifact named in this plan.

---

## Decisions you must make before we touch code

Five questions need explicit answers from you. Each shapes the work
below. Defaults shown; tell me if any are wrong.

1. **§9.1 — Browser tokenizes; proxy backstops?** Default YES. The
   browser runs OPF + IndexedDB; the proxy gets sanitized text and only
   re-checks via deterministic regex. *Confirm*.

2. **§9.2 — §S CI assertion runs in the browser?** Default YES. The
   final outbound-payload check vs. the live token map runs in the
   browser immediately before `fetch()`. The proxy never sees the
   map. *Confirm*.

3. **§9.3 — Confidence-hold-back gate (D19)?** Pick one:
   - (a) **Implement** (`confidence < 0.98` queues for mandatory human
     review, default-deny). Adds ~1 phase of work.
   - (b) **Formally drop** (record decision in an 8th addendum;
     attestation says "human-review gate not enforced; attorney is the
     only decision authority"). Faster; matches the 7th addendum's
     "informational only" direction.
   - **Default**: (b) drop. Confirm or override.

4. **§9.4 — MCP tool gating by privileged (D14)?** The 5th addendum
   gates MCP servers (Free Law Project, Thomson Reuters, Solve
   Intelligence) on `privileged=true`; the 7th addendum dropped the
   web_search gate but didn't explicitly re-extend to MCP. Default:
   **keep MCP gating** until F&F counsel re-rules. Confirm or override.

5. **§9.5 — Evaluate fine-tuned `run_b_weighted` checkpoint before V2
   ships?** A separately-trained OPF checkpoint exists on the
   `codex/privacy-filter-prd-run` branch. On the AI4Privacy held-out
   test (260K examples in 15 languages), it improved detection F1
   from 0.6199 → 0.9832. The PRD recommends NOT deploying it blindly
   — it needs a real-world hard eval set first. F&F's California
   matter mix (including immigrant clients with non-English names
   and addresses) is exactly the distribution this checkpoint was
   trained to improve. Three options:
   - (a) **Evaluate during Phase A** (adds ~3-5 hours of eval-set
     authoring + a measurement step in A.6.5). Adopt if it wins,
     stay on stock OPF if it doesn't.
   - (b) **Defer to a later phase**. Ship V2 on stock OPF first;
     evaluate the fine-tune as a follow-up improvement.
   - (c) **Skip entirely**. Ship V2 on stock OPF; treat the
     fine-tuned checkpoint as research output that doesn't reach
     production.
   - **Default**: (a) evaluate during Phase A. The eval is cheap
     and the upside is large for the F&F practice mix. Confirm or
     override.

I will not start Phase A until these five are confirmed.

---

## Phase A — Sanitization architecture rebuild (BLOCKS EVERYTHING)

Goal: V2 satisfies "raw never leaves laptop." Browser tokenizes
before send; server is a regex-only backstop.

### A.1 — Wire SanitizerProvider into V2 root

**Files**: `App.tsx` (one file).
**Change**: Wrap the `<Routes>` tree in `<SanitizerProvider>` from
`hooks/useSanitizer.tsx`. Existing provider lives in the V2 codebase
already (pulled with the codex/drafting-magic-sanitized port); it just
isn't mounted in the React tree.
**Verification**: a DevTools React-tree screenshot showing
`SanitizerProvider` above `V2ChatPage`. `useSanitizer()` returns
`{ready: true, unlocked: true, daemonStatus: 'healthy'}` after first
mount once OPF daemon is running locally.

### A.2 — Browser hooks tokenize before fetch

**Files** (4):
- `hooks/useV2AgentStream.ts`
- `hooks/useV2DraftStream.ts`
- `hooks/useV2DraftingMagicStream.ts`
- `hooks/useV2VerifyStream.ts`

**Change** in each: import `tokenizeForWire` from
`services/sanitization/chatAdapter.ts`. Before the `fetch()` call,
tokenize every field that may contain user text (user_text /
instructions / variables / packet[i].text / passage). Replace the
fetch body with the tokenized version. Add an `await sanitizer.ready`
guard — if the sanitizer isn't unlocked, surface a structured error
to the UI instead of silently sending raw.

**Streamed response handling**: On every `token` SSE event, call
`getChatSanitizer().rehydrateMessage(token)` before accumulating to
the visible state. Final assembled text shown to the user is
rehydrated.

**Verification**:
- `scripts/probe-wire-no-raw.mjs` (new) — Playwright that opens
  `/v2`, types a PII-containing message (5 distinct synthetic SSNs +
  party names + addresses), monitors network requests, and asserts
  none of the 5 PII strings appear in any outbound POST body. Hard
  assertion — fails the script if any one appears.
- `tests/traps/manifest-v1.json` (existing, 120 traps) — re-author
  the harness to drive the full browser pipeline, not just
  `analyze()`. Each trap must show zero raw leakage in the
  network capture.
- Manual: Chrome DevTools network tab, send "John Smith, SSN
  123-45-6789, lives at 123 Main St" — confirm request body shows
  `@@NAME_0001@@`, `@@SSN_0002@@`, `@@ADDRESS_0003@@`.

### A.3 — Server-side gate reduced to regex backstop only

**Files**: `api/_lib/agentProxy.ts`, `services/sanitization/detectionPipeline.ts`.

**Change**: `detectPii()` in strict mode now (a) accepts already-tokenized
input as the expected case, (b) runs ONLY the deterministic regex
patterns (no OPF call, no name heuristics), (c) returns
`OpfUnavailableError` only when even the regex backstop fails to
load. The agentProxy's role is to verify-the-browser-did-its-job, not
to be the primary detector.

Remove the server-side `import` of `opfClient` from the proxy path.
The `opfClient` module remains in the codebase but is browser-only
(loaded only by `services/sanitization/chatAdapter.ts` and the
`useSanitizer` hook).

**Verification**:
- `npx tsc --noEmit` clean.
- A unit test in `tests/sanitization/server-backstop.test.mjs` that
  feeds the backstop a sanitized message + an unsanitized message
  with embedded SSN and asserts: sanitized passes, unsanitized fails
  closed with `OpfUnavailableError` (or new `RawInputDetectedError`).

### A.4 — Remove the DraftingMagic identity stubs

**File**: `components/v2/V2DraftingMagicPage.tsx` (lines 82-87 plus the
helper comment).

**Change**: Delete the identity stubs for `tokenizeForWire` and
`getChatSanitizer`. Import the real ones from
`services/sanitization/chatAdapter.ts`. The page already calls them
in the codex-original code path (now restored once the imports are
real).

**Verification**: same `probe-wire-no-raw.mjs` script extended to
exercise `/v2/magic` with a sample packet whose source-document text
contains PII; confirm the network body has tokens, not raw text.

### A.5 — Token-map persistence

Already mostly done: `services/sanitization/store.ts` is in the
codebase, the `useSanitizer` hook opens IndexedDB on mount. What's
missing is the wiring (A.1) and the proof.

**Verification**:
- `scripts/probe-token-map-persists.mjs` — Playwright that types a
  message containing a name, sends it, refreshes the page, types a
  message referencing the same name, and confirms the SECOND
  message reuses the SAME token (e.g. both turns serialize as
  `@@NAME_0001@@`, not `@@NAME_0001@@` then `@@NAME_0002@@`).

### A.6.5 — (Optional, recommended) Swap stock OPF for fine-tuned `run_b_weighted` checkpoint

**Source**: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-prd-run/PRIVACY_FILTER_TRAINING_README.md` — branch `codex/privacy-filter-prd-run`. A separate worktree fine-tuned OPF on the AI4Privacy multilingual PII dataset (es/fr/de/it/pt/nl/pl/tr/ar/hi/te/ru/zh/ja/ko, 261,664 examples). The trained checkpoint lives at `remote_artifacts/runs/privacy_filter_full/run_b_weighted/model.safetensors` (2.6 GB).

**Why it matters here**: F&F handles California legal matters that touch immigrant families, international transactions, and clients with non-English names and addresses. Stock OPF's detection F1 on that distribution was 0.6199. The fine-tuned `run_b_weighted` checkpoint hit 0.9832 on the held-out test set — a 36-point F1 jump. Span F1 went from 0.4775 → 0.8974.

**But it's not deploy-ready as-is.** The PRD's own recommendation (lines 264–276): "Do not deploy it blindly... manual examples show potential issues with span fragmentation and some non-Latin / locale-specific edge cases." Required pre-deploy work:

**A.6.5.1 — Build a real-world hard eval set.**
- 50–100 examples that approximate F&F's actual matter mix:
  - Spanish/Mandarin/Vietnamese/Tagalog/Korean names common in California (esp. SF Bay Area + LA county).
  - California addresses including non-standard forms (apartment suffixes, suite numbers, PO boxes).
  - Mixed Latin + non-Latin in the same passage (e.g. "客户 María Liu 住在 Palo Alto, 1234 University Ave").
  - Privileged compound risks (name + DOB + matter-type) that stock OPF misses.
- Each example is a `{text, expected_spans}` JSONL row.
- Authoring pace: ~30 min/10 examples, so ~3-5 hours total.

**A.6.5.2 — Run both models on the hard eval set.**
```bash
# Baseline (stock OPF)
opf eval --device cuda hard-eval.jsonl
# Fine-tuned candidate
opf eval --device cuda hard-eval.jsonl \
  --checkpoint remote_artifacts/runs/privacy_filter_full/run_b_weighted
```
Compare detection P/R/F1, span P/R/F1, and category-level breakdowns. Manual review every divergence.

**A.6.5.3 — Decision gate.**
- If fine-tuned **clearly** wins (e.g., ≥5pt F1 improvement, no new false positives in CA-specific spans, no critical regressions) → adopt with feature flag. Keep stock OPF available as fallback.
- If results are mixed → stay on stock OPF for v1 production. Re-train with additional CA-specific data later.
- If results are worse → stay on stock OPF, document the negative outcome, retire the checkpoint.

**A.6.5.4 — If adopted: deploy the checkpoint in the local OPF daemon.**
The OPF daemon (`/usr/local/bin/opf` or wherever the user installed it) accepts a `--checkpoint` flag at startup. Update the daemon launch config (probably a launchd plist or systemd unit) to point to `run_b_weighted/`. Browser code in `services/sanitization/opfClient.ts` doesn't need to change — it still calls `https://localhost:47822/v1/detect`; the daemon transparently uses the new checkpoint.

**A.6.5.5 — Add the 120-trap suite to the eval.**
Run the existing 120-trap manifest (`tests/traps/manifest-v1.json`) against the fine-tuned model. Trap pass rate should match or exceed stock OPF. Any trap regression is a hard blocker; the goal is not to trade better recall on foreign names for worse recall on the F&F-specific patterns the trap suite enforces.

**Verification artifacts** (all must exist before flipping the flag):
- `reports/hard-eval-stock-opf.json`
- `reports/hard-eval-finetuned-b-weighted.json`
- `reports/trap-suite-finetuned.json` (120/120 pass)
- A written decision (committed) recording: adopted / mixed / rejected.

**Scope reality**: this is optional in the sense that V2 can ship correctly with stock OPF. It's recommended in the sense that the F1 jump on foreign-name detection is material for a California legal practice that serves immigrant clients. If you choose to adopt, A.6.5 adds ~2 phases of work (hard eval authoring + decision + flag plumbing), not a full re-training round.

### A.7 — Tool-output sanitization stays server-side but uses rehydrated names from request context

**File**: `api/_lib/agentLoop.ts` (`sanitizeToolOutput`).
**Change**: When the request-scoped sanitization attestation arrives
with the user's tokens, the tool-output sanitizer can use that list
to also redact occurrences of those names in tool outputs (e.g. a
CourtListener record that happens to mention the same name). Today
the sanitizer only re-runs OPF-style detection on tool outputs;
adding the request-scoped token vocabulary tightens the gate without
exposing the map.

**Verification**: an existing trap from the 120-set that exercises
"tool output reintroduces user's name" must still pass.

### Phase A exit criteria (all must pass)

| ID | Criterion | Proof artifact |
|---|---|---|
| A-exit-1 | SanitizerProvider mounted in V2 root | DevTools React-tree screenshot |
| A-exit-2 | All 4 V2 hooks tokenize before send | `probe-wire-no-raw.mjs` passes on 5 PII inputs |
| A-exit-3 | Server proxy has no OPF import; uses regex backstop only | `grep "opfClient" api/_lib/` returns 0 |
| A-exit-4 | DraftingMagic stubs deleted, page uses real sanitizer | `probe-wire-no-raw.mjs` extends to `/v2/magic` |
| A-exit-5 | Token map persists across reload | `probe-token-map-persists.mjs` passes |
| A-exit-6 | (Optional, only if §9.5 = adopt) Fine-tuned checkpoint adopted with no trap regressions | `reports/hard-eval-finetuned-b-weighted.json` + `reports/trap-suite-finetuned.json` (120/120) + written decision |
| A-exit-7 | Tool-output sanitizer uses request-scoped tokens | Trap pass on the relevant 120-set entry |

**Until A-exit-{1,2,3,4,5,7} all pass: V2 is non-deployable.**
A-exit-6 is only required if you say YES to §9.5 below.

---

## Phase B — Verify endpoint + log scrubbing + CI assertion

### B.1 — Verify-stream sanitization gate

**File**: `api/agent/verify-stream.ts`.
**Change**: Add the same regex-backstop check the chat path uses.
Reject any request body whose `text` field, after attempted
tokenization on the browser side (the browser sends tokens here too),
still contains regex-detectable raw PII. Browser hook
(`useV2VerifyStream`) is already updated in A.2.

**Verification**: a test case in `scripts/probe-verify-citations.mjs`
(existing) that pastes a passage containing "John Doe, SSN
123-45-6789" → assert no raw SSN appears in the network request.

### B.2 — Log scrubbing

**Files**: `api/_lib/agentProxy.ts`, `api/_shared/auditLog.ts`, any
function-level error handlers.

**Change**: Centralize the error-emission path through a `scrubError`
helper that strips known-tokenized strings (when the request had a
token map context) and applies a final regex pass against
HIGH_RISK_CATEGORIES. Anything that fails the final pass is replaced
with `[redacted]`.

**Verification**: a synthetic test that throws an error mid-stream
with a payload containing raw PII; assert the stderr/log output is
sanitized.

### B.3 — §S CI assertion (browser-side outbound check)

**File**: new helper in `services/sanitization/wireGuard.ts`.
Browser-side: before each `fetch()`, run the assembled body through
a final pass that maps to the live token map and asserts that no
known-mapped raw term remains. If it does, abort the send and surface
a clear "internal sanitization assertion failed; please report"
error.

**Verification**: same `probe-wire-no-raw.mjs` extended to inject a
test that bypasses tokenization on purpose, asserts the wireGuard
catches it and prevents send.

### B.4 — Confidence-hold-back decision (D19)

Depends on §9.3 decision. If implement: code goes here. If drop:
write an 8th addendum recording the decision.

### Phase B exit criteria

| ID | Criterion | Proof artifact |
|---|---|---|
| B-exit-1 | verify-stream gates raw PII | extension to `probe-verify-citations.mjs` |
| B-exit-2 | Error/log paths scrub raw text | new `tests/log-scrubbing.test.mjs` |
| B-exit-3 | Browser wire-guard active | `probe-wire-no-raw.mjs` injection test |
| B-exit-4 | D19 confidence-hold-back: decided + (implemented OR addendum written) | code or addendum |

---

## Phase C — 120-trap zero-leak gate re-run

### C.1 — Re-author the trap harness for the full wire path

**File**: `tests/traps/runTraps.mjs` (extend).
**Change**: Today the harness calls `analyze()` directly. Re-author
it to drive Playwright through the full V2 wire path: open `/v2`,
type each trap input, intercept the network request, assert the body
contains zero raw matches against the trap's expected PII strings.

### C.2 — Run twice; both zero leak

Plan §0.c hard gate. Two consecutive full-suite runs. Any non-zero
result blocks Phase D.

### Phase C exit criteria

| ID | Criterion | Proof artifact |
|---|---|---|
| C-exit-1 | Wire-path trap harness exists | `tests/traps/runTraps.mjs` updated, smoke-runs the first trap |
| C-exit-2 | Two consecutive full-suite zero-leak runs | `reports/traps-{date}-1.json` + `-2.json` both show `passed: 120/120, leaks: 0` |

---

## Phase D — Resume Phase 4.5 shadow + Phase 5 cutover

Now (and only now) the previously-pending tasks #126 (Phase 4.5
follow-through — V1 flips `NEXT_PUBLIC_V2_SHADOW_URL`) and #127 (V1
cutover + deletion) can proceed.

### Phase D exit criteria

| ID | Criterion | Proof artifact |
|---|---|---|
| D-exit-1 | Phase 4.5 shadow run shows 7-day parity against new V2 wire path | `reports/shadow-run-{week}.json` |
| D-exit-2 | Phase 5 cutover complete | V1 routes 410-gone; V2 routes own `/c/:chatId` |

---

## Hard deployment-blocker statement (codex-requested)

**No production deploy of V2 is permitted until Phase C is complete.**
The 120-trap zero-leak gate is the binding criterion (plan §0.c,
2nd addendum 2026-05-10). A single confirmed sanitization failure in
production triggers immediate rollback per plan §M. The shadow run
(Phase D) and the V1 cutover (Phase D) require Phase C clear.

This blocker applies even if F&F partners ask for an earlier rollout.

---

## Out of scope for this plan

Things the audit identified but that are NOT in this plan because they
are documented intentional V2 design (not failures to remediate):

- New endpoints (`/api/agent/turn-stream`, `/api/agent/draft-stream`,
  `/api/agent/drafting-magic`, `/api/agent/verify-stream`,
  `/api/agent/session*`, `/api/agent/shadow`) — these are V2-by-design.
- Session persistence to Upstash KV (plan §D).
- Anthropic-only inference (1st addendum).
- Opus 4.7 default + Sonnet 4.6 verifier carve-out (5th+6th addenda).
- Verifier sub-agent (Phase 3).
- Drafting Skills imported as markdown (Phase 2).
- Live sanitization preview (P1.1) — already correct.

If any of these turn out to also be defective, they become new audit
items, not in scope for this plan.

---

## What I'm asking you to approve

1. Confirm the 4 decisions at top (§9.1–§9.4 defaults).
2. Approve the phasing A → B → C → D.
3. Approve the "no deploy until Phase C" blocker.
4. Tell me to start Phase A.

I will not write any code until you approve. The existing V2 branch
stays as-is (with the sanitization gap) until you say go.
