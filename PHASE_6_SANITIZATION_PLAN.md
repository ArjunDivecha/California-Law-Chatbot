# Phase 6 — Client-Side Sanitization Plan

**Date:** April 24, 2026
**Branch:** `codex/bedrock-confidentiality-migration`
**Status:** Locked. Build starts on "go" from Arjun. One open question (§12).
**Supersedes Phase 6 in:** `BEDROCK_CONFIDENTIALITY_IMPLEMENTATION_PLAN.md`

---

## 1. Goal

Client-identifying facts never leave the attorney's browser in raw form. Tokens replace real names/addresses/identifiers before any network request. Vercel and every external retrieval provider (OpenStates, LegiScan, CourtListener, OpenAI embeddings) see only tokenized text. Bedrock is the only generative model in the trust boundary.

The token map that could re-identify anyone is persisted **on the attorney's own device**, encrypted at rest, and never crosses the network. Attorneys get continuity of tokens across chats and days (same entity → same token forever) while the firm gets a sub-processor footprint that sees only tokenized content.

This is Option B from the design discussion. Option C (full AWS migration to eliminate Vercel as a sub-processor entirely) is scoped to Phase 9 after UAT.

---

## 2. Locked Design Decisions

| Decision | Choice |
|---|---|
| Storage location | Per-attorney, per-device. Browser IndexedDB + WebCrypto. |
| Encryption at rest | AES-GCM, key derived from attorney passphrase via PBKDF2. |
| Token format | Stable sequential IDs: `CLIENT_001`, `ADDRESS_012`, `DATE_003`. |
| Persistence | Indefinite. Same entity always resolves to the same token across time. |
| Retention limits | None in v1. F&F to decide policy later. |
| Cross-device sync | None in v1. Manual encrypted export/import deferred to v2. |
| Failure mode | Fail closed. If IndexedDB unavailable or passphrase fails, composer disables; no silent degradation. |
| Chat persistence | Tokenized content saved to Blob; rehydration happens only in the attorney's browser on reopen. |
| Server backstop | Re-scans every `/api/*` request; rejects with 400 on any deterministic PII match. |
| Audit log | HMAC of sanitized prompt + metadata only. Raw prompts and token maps never written anywhere. |
| Passphrase recovery | **Decision pending — §12.** |

---

## 3. End-to-End Flow

1. Attorney opens the app; sanitizer unlock modal asks for passphrase (once per browser session).
2. Attorney types a prompt containing client facts.
3. Browser-side sanitizer runs debounced as they type. No network call.
4. Sanitized preview appears next to the composer with the tokenized prompt and the token map (`Maria Esperanza → CLIENT_001`).
5. Attorney can click highlighted text to un-tokenize, click plain text to tokenize, click a token to rename its pseudonym.
6. Attorney clicks Submit. The browser sends only the tokenized prompt to Vercel.
7. Vercel server backstop re-runs deterministic patterns. Any PII-shaped content → 400 rejection with visible caveat.
8. Vercel retrieves from CEB / CourtListener / legislative providers using only the tokenized prompt.
9. Vercel calls Bedrock (generator + verifier) with tokenized prompt and retrieved sources.
10. Vercel writes an audit record (HMAC only) and returns the tokenized response.
11. Browser rehydrates the response against the local token map and displays the result with real names.
12. On chat save: the tokenized messages and a tokenized title are persisted to Vercel Blob + Upstash Redis. The local map never crosses the wire.
13. On chat reopen: tokenized messages load from Blob → browser rehydrates with the local map. If opened on a device without the map (e.g., new laptop), the attorney sees tokens — a correct compliance outcome.

---

## 4. Architecture Components

### 4.1 `services/sanitization/` — pure engine (no UI, no network)

| File | Responsibility |
|---|---|
| `patterns.ts` | Deterministic detectors: SSN, TIN/FEIN, phone, email, full US addresses, DOB formats, credit-card/bank-account/routing shapes, medical record numbers, driver-license patterns, firm client-matter codes (configurable). |
| `allowlist.ts` | Public-legal entities that must never be tokenized: CA statute citations, case citations, court names, public officials, CA state agencies, CEB source titles. |
| `detectNames.ts` | Deterministic name heuristics: title prefixes (Mr./Ms./Dr./Mrs.), possessives (`X's son`), relational patterns (`my client X`), capitalized bigrams not on the allowlist. |
| `index.ts` | Public API: `analyze(prompt) → { spans: [{start, end, category, raw}] }`. Identifies spans but does not tokenize. |

### 4.2 `services/sanitization/store.ts` — encrypted persistent map

```ts
initStore(passphrase: string): Promise<void>
lookupToken(raw: string, category): Promise<Token | null>
assignToken(raw: string, category): Promise<Token>
rehydrateMap(): Promise<Map<Token, string>>
forgetEntity(token: Token): Promise<void>
exportEncrypted(): Promise<Blob>
importEncrypted(blob: Blob, passphrase: string): Promise<void>
```

- IndexedDB database `cla-sanitization-v1`, object stores `entities` (encrypted raw→token) and `meta` (key-derivation params + version).
- WebCrypto: PBKDF2 from passphrase → AES-GCM for field encryption. Salt and IV stored per record.
- One AES key per attorney derived from their passphrase. Passphrase never stored anywhere.

### 4.3 `services/sanitization/tokenize.ts` + `rehydrate.ts`

- `tokenize(prompt)` consumes span analysis + store; returns `{ sanitized, tokenMap }`. Sorts spans longest-first to avoid substring collisions.
- `rehydrate(text, tokenMap)` replaces tokens with real values. Handles possessives (`CLIENT_012's`) and partial references.

### 4.4 `utils/sanitizationGuard.ts` — server backstop

Exports `assertNoRawPII(prompt)` which re-runs the same pattern set from §4.1 server-side. Wired into all six text-accepting routes:

- `api/gemini-chat.ts`
- `api/claude-chat.ts`
- `api/ceb-search.ts`
- `api/legislative-fanout.ts`
- `api/courtlistener-search.ts`
- `api/public-legal-context.ts`

On rejection: `400 { error: 'backstop_triggered', categories: ['ssn', 'phone'] }`. Visible caveat surfaces in the chat UI: *"The request still contained what looked like a phone number. Please re-sanitize and resubmit."*

### 4.5 `utils/auditLog.ts` — audit trail

Each gated request writes:

```ts
{
  timestamp,
  userId,                      // Clerk user ID
  flowType,                    // 'accuracy_client' | 'public_research'
  model,                       // resolved Bedrock profile ID
  sourceProviders,             // which retrievals ran
  sanitizedPromptHmac,         // KMS-keyed HMAC (new env var AUDIT_HMAC_KEY)
  tokenCategoryCounts,         // { names: 2, addresses: 1, dates: 1 }
  backstopTriggered,
  latencyMs,
  warningFlags,                // e.g. ['ungrounded-citation']
}
```

Storage: Upstash Redis `audit:YYYY-MM-DD` list, 90-day TTL in v1. Production target S3 Object Lock in F&F's AWS (Phase 7).

### 4.6 Chat persistence changes

All three server routes that touch chat storage (`GET/POST/PUT/PATCH/DELETE /api/chats`) receive **tokenized** content. No changes to the server logic — the client just sends tokenized messages now.

**Client-side changes in `gemini/chatService.ts`:**
- On send: tokenize before submit, tokenize the chat-title-generating path.
- On receive: rehydrate response for display only. Save the tokenized version to server.
- On chat reopen: fetch tokenized messages, rehydrate against local map, display.

**Before-save guard:** deterministic PII regex runs over outgoing message content. If any raw PII slips through, warn and re-tokenize before allowing the save.

### 4.7 UI components

| Component | Responsibility |
|---|---|
| `components/SanitizationUnlock.tsx` | Passphrase modal on first visit per browser session. First-time: create flow with strength meter + explanation. Subsequent visits: unlock flow. |
| `components/SanitizedPreview.tsx` | Split-pane next to the composer. Left = raw input. Right = sanitized prompt with tokenized spans highlighted. Below = token-map table with rename/remove actions. Footer: *"This preview is what will be sent. Your copy of the real names stays in this browser."* |
| Attestation modal (one-time) | *"This tool tokenizes client-identifying facts inside your browser before sending. The map of real names stays on this computer, encrypted. Sanitization does not replace your professional obligations under California Rule 1.6. [I understand, continue]"* |
| `hooks/useSanitizer.ts` | React context exposing the analyzer/tokenizer once the store is unlocked. |

---

## 5. Build Plan — 15 Working Days

### Sprint 1 — Core engine + server + chat persistence (no UI yet)

- **Day 1** — `services/sanitization/patterns.ts`, `allowlist.ts`, `detectNames.ts`, `index.ts`. Pure functions, unit tests covering ≥3 positive + ≥3 negative cases per pattern.
- **Day 2** — `services/sanitization/store.ts`: IndexedDB + WebCrypto. Tests: round-trip after close/reopen, wrong-passphrase rejection, export/import round-trip.
- **Day 3** — `tokenize.ts` + `rehydrate.ts`. Round-trip `rehydrate(tokenize(x).sanitized, tokenMap) === x` for the full 200-prompt fixture.
- **Day 4** — `utils/sanitizationGuard.ts` + wiring into all six `/api/*` routes. Synthetic-PII rejection tests per route.
- **Day 4.5** — Chat-save rework: `gemini/chatService.ts` sends tokenized messages; title derived from sanitized first message; reopen rehydrates locally.
- **Day 5** — `utils/auditLog.ts` + Redis writes from every gated route. Test: audit record created, contains no substring of any input prompt.

**Sprint 1 done:** functional sanitizer, backstop, audit, and tokenized chat persistence. Exercisable via DevTools but no attorney-facing UI yet.

### Sprint 2 — UI, passphrase, rehydration, validation

- **Day 6** — `components/SanitizedPreview.tsx`. Split-pane, click-to-tokenize, click-to-untokenize, rename-token.
- **Day 6.5** — Pre-save PII scan: deterministic re-check of outgoing messages. If anything PII-shaped present, refuse save or re-tokenize with audit-log warning.
- **Day 7** — `SanitizationUnlock.tsx` + `useSanitizer` context. Passphrase flow on app load.
- **Day 8** — First-session attestation modal. localStorage keyed by Clerk user ID.
- **Day 9** — Rehydration wired into chat display. "Invented-token" warning when model references a token not in the local map.
- **Day 10** — Gold-set validation:
  - 50-prompt confidential fixture → ≥95% PII recall.
  - 200-prompt legal fixture → ≥99% public-legal-entity preservation.
  - Manual browser pass: 3 end-to-end flows with screenshots.
  - Headless Playwright: preview renders, tokens highlight, passphrase unlock works.

---

## 6. Exit Criteria

- ≥99% preservation of public legal entities on the 200-prompt gold set.
- ≥95% PII recall on the 50-prompt confidential set.
- Zero `console.log`/`console.error` call sites in `/api/` that can write a raw prompt to logs.
- All six `/api/*` routes listed in §4.4 reject synthetic PII at the backstop.
- Chat-save path writes tokenized content only (verified by reading a saved Blob and confirming no real-name substrings).
- End-to-end manual test documented with screenshots.
- F&F compliance counsel has reviewed the pattern list in §4.1.

---

## 7. Known Failure Modes

| Failure | Mitigation |
|---|---|
| Detector misses a name (e.g., "Mary C.") | Preview + attorney edit. |
| Attorney bypasses preview by bug | Server backstop re-scans. 400 on any pattern hit. |
| Long transcript with 30+ entity mentions | Grouped token map + inline highlighting. |
| Model invents a token not in the map | Rehydrator leaves it as-is and flags visually in the message. |
| Hypothetical with no real client | Over-eager tokenization is safe — false positives cost one click, false negatives leak data. |
| Client name matches a public figure | Allowlist keeps it un-tokenized by default. Attorney can explicitly flag as confidential. |
| Attorney forgets passphrase | Per §12 decision: no recovery / recovery phrase / admin reset. |
| Attorney opens chat on new device | Rehydration shows tokens — correct outcome. They can import an encrypted export if they carried one. |
| Browser clears IndexedDB | Same as forgotten passphrase: rely on §12 recovery mechanism. |
| Model invents a raw name in response text (not a token) | Pre-save PII scan (Day 6.5) re-tokenizes or rejects before persistence. |

---

## 8. What This Lets F&F Say

> *"Client-identifying facts are tokenized inside the attorney's browser before any network request. No third-party retrieval provider — OpenStates, LegiScan, CourtListener, OpenAI for embeddings — ever receives client names, addresses, or identifiers. Our serverless functions on Vercel see only tokenized text. Generative and verification models run on AWS Bedrock under a no-operator-access contract. The map of tokens to real names lives only on the attorney's computer, encrypted with a passphrase only the attorney knows. Chat history is stored tokenized; reopening on a different device shows tokens, not real names. Every request is audited with a keyed hash of the sanitized prompt; no raw payloads are retained in any log."*

Strong posture. Not as strong as Option C (no Vercel exposure at all in any form), which is the Phase 9 target.

---

## 9. Explicitly Out of Scope for Phase 6

- Full AWS migration (Option C). Phase 9.
- Domain-restricted web search for regulations/agency content. Phase 7 (depends on Phase 6).
- SSO replacement for Clerk. Phase 8/9.
- Titan v2 embedding migration. Deferred.
- S3 Object Lock audit archive with 7-year retention. Phase 7.
- UI redesign beyond preview + attestation. Phase 8.
- Token-map cross-device sync via firm-owned storage. v2.
- Automatic retention policy. F&F records-management decision.

---

## 10. Dependencies on Prior Phases

- **Phase 2 (flow policy)** — ✅ live. `flowPolicy.enforceFlow` already gates routes.
- **Phase 3 (Bedrock hardening)** — ✅ live. Bedrock is the only generative path.
- **Phase 5 (research recall)** — ✅ live. Phase 6 works independently but benefits from better retrieval.
- **Phase 5.5 (citation grounding)** — ✅ live. Complements the pre-save PII scan.
- **`AUDIT_HMAC_KEY`** — new env var, to be provisioned on "go" (either reuse Bedrock key or create a dedicated one).

---

## 11. Chat Persistence Implications (Critical)

Chats are currently saved to:
- **Upstash Redis** — metadata (title, timestamps, ownership, blob URL pointer).
- **Vercel Blob** — full message history at `chats/<userId>/<chatId>.json`.

Existing content (pre-Phase-6) is test data only; no real client facts in production. Purging is not required per F&F direction — existing chats stay as-is and new chats are persisted tokenized.

Post-Phase-6:
- Sidebar titles are tokenized (*"Elder-abuse exposure for CLIENT_001"*).
- Blob bodies contain tokenized messages only.
- Rehydration happens in the browser on reopen.
- Upstash + Vercel Blob see only tokenized content. Full compliance story §8 depends on this.

---

## 12. Open Decision — Passphrase Recovery

If an attorney forgets their passphrase, the local encrypted store is unrecoverable. All prior chat history becomes un-rehydrate-able from Blob (content is still there but the map is gone). Three options:

1. **No recovery.** Strongest security. Worst UX for forgetful attorneys.
2. **Recovery phrase** shown once at setup (24-word BIP39 style). Attorney writes it down. Standard crypto-wallet UX. Can recover the store if the phrase is retained. **Default recommendation.**
3. **Admin reset via firm IT.** Weakens the "only the attorney can decrypt" guarantee. IT could in theory reset any attorney's store.

Decision required before Day 7.

---

## 13. Work Order After Phase 6

1. **Phase 7** — log-scrubbing audit, S3 Object Lock audit archive, domain-restricted Exa for regulations and agency content.
2. **Phase 8** — full UI polish: confidentiality banner, Speed mode visual treatment, attorney onboarding.
3. **Phase 9** — Option C migration to F&F-owned AWS account. Pattern review with F&F compliance counsel. Live UAT with synthetic data. Attorney pilot. Production cutover.

---

*Prepared for femme & femme review. Updated April 24, 2026.*
