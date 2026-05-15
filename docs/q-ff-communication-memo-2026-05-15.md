# §Q communication memo — California Law Chatbot V2

**Audience**: F&F partners
**Author**: Arjun (draft)
**Status**: DRAFT — partners to review and sign off before Phase 5 cutover. The 2nd addendum required this rewrite from the original "ZDR + BAA + SOC 2" framing.

---

## What this memo says

V2 is a rebuild of the California Law Chatbot. This memo is the partner-facing summary of how V2 handles client information, what Anthropic sees, and what protections are in place. It is the document a court, malpractice carrier, or bar discipline panel would expect us to be able to produce.

## How V2 protects client information

**On-device tokenization.** Before any text leaves your laptop, V2 runs a local PII detector (GLiNER, span-based, multilingual). Any text it identifies as a person's name, address, phone number, email address, SSN, date, ZIP code, or other identifier is replaced by an opaque token (`CLIENT_001`, `ADDRESS_007`, etc.) and the mapping from token → real text is stored in your browser's IndexedDB on your device. The browser sends the tokenized text to Anthropic. The real names and identifiers never leave your laptop.

**Server-side defense in depth.** Even after browser-side tokenization, a server-side regex backstop on the Vercel function checks every incoming request for raw PII that matches a deterministic pattern (SSN format, credit-card format, etc.). If any leaks through, the request is rejected with a 503 and the failure is recorded in the audit log. This is "belt and suspenders" — the browser is the primary defense; the server is the fallback.

**§S CI assertion.** Before every outbound request, the browser runs a final check: it scans the assembled payload one more time for any of the regex-detectable PII patterns. If anything survives the tokenizer, the request is aborted before it reaches the wire.

**Audit chain.** Every request writes an audit record containing only metadata (HMAC of the sanitized prompt, redaction category counts, latency, model used) — never the actual prompt text. Audit records are retained for 7 years to support discovery and bar-compliance review.

**Empirical proof.** The V2 system was tested against a 120-trap manifest covering compound identifiers, single-word names, foreign names, financial identifiers, adversarial prompts, and tool-output reintroduction patterns. Two consecutive full-suite runs each produced **zero wire-leaks** (the §0.c hard gate). Reports at `reports/traps-wire-gliner-final-v8-run{1,2}.json`.

## What Anthropic sees and retains

F&F operates V2 under **Anthropic's Team plan** — *not* an enterprise contract. The Team plan does NOT include Zero Data Retention (ZDR). This means:

**What Anthropic sees on every request:**
- The tokenized prompt (e.g., "Please draft a demand letter for CLIENT_001 at ADDRESS_001"). No real names, no real addresses, no real identifiers.
- The system prompt and tool-call metadata (search queries, citation lookups). These are public-research patterns and don't include client content.
- Per Anthropic's published Team-plan policy, this tokenized content is retained for approximately 30 days for trust-and-safety review.

**What Anthropic does NOT see:**
- Any real client name, address, phone, SSN, date, or other PII. These are tokenized on your laptop before transmission.
- The token-map that links tokens to real text. This lives only in your browser's IndexedDB.

**Anthropic's privacy controls:**
- **Training opt-out**: F&F's account has training-on-conversation-data opted OUT. Anthropic does not use V2 prompts to train its models.
- **Abuse monitoring posture**: Trust-and-safety review can access retained Team-plan content under Anthropic's published policy. The content they would see is the tokenized form — no client identifiers.

**No ZDR / BAA / SOC 2 attestations.** The original V2 plan assumed ZDR via an enterprise contract; that path was determined not viable in May 2026 (see 2nd addendum). The current attestation chain therefore relies entirely on:
1. The on-device tokenizer working correctly (verified by the 120-trap gate)
2. The 7-year audit chain (HMAC-only records, no plaintext)
3. The §Y per-session attestation generator (records exactly which tokens fired and what the agent saw)

## What this means for an attorney

When you use V2 with a real client matter:
1. **You can type real client names, addresses, etc. into the prompt.** The browser will tokenize them before sending. The chat UI will display the rehydrated names back to you (your browser does the rehydration locally).
2. **What appears in your saved chat history** is the rehydrated form (real names) because that lives in your browser's IndexedDB.
3. **What Anthropic's logs contain** is the tokenized form (no real names).
4. **If your laptop is lost or stolen**, the IndexedDB token map and the real client text in your saved chat history would be on that device. (Disk encryption and physical security are the relevant protections — V2 doesn't add anything beyond what your laptop already does.)
5. **If you clear your browser data** (or use a different device/profile), prior tokenized chats become un-rehydratable: tokens show through instead of real names. This is intentional — no central recovery — and matches the "no key escrow" property F&F asked for.

## Limits of the design

These are documented so they're not surprises later:

1. **A sanitization miss is a privilege breach.** If the detector ever fails to tokenize something that was a real client identifier, that text reaches Anthropic. The §0.c trap gate is the validation of detector quality. The trap suite is now 120/120; F&F partners should ratify any future trap additions as the firm's matter mix evolves.

2. **The detector is local software that can fail.** If the GLiNER daemon crashes or is uninstalled, V2 fails closed — no chat works until the daemon is back. Attorneys see an error and cannot bypass.

3. **Anthropic could change Team-plan retention.** The 30-day window is policy, not a contract term. If Anthropic changes it, our exposure changes. We should review Anthropic's policy page periodically (suggested: quarterly).

4. **Compound-identifier risk.** Some prompts don't contain direct PII but identify a unique client via combination ("Vietnamese widow on Mowry Avenue in Fremont"). V2's compound-risk detector flags these as `privileged=true` in the audit chain, but does not by itself tokenize them. The attorney's judgment is the final filter.

5. **Tool outputs.** When V2 calls a public-record tool (CourtListener, CEB), the tool's response gets the same sanitization pass before being shown to the agent. There is residual risk if a public document contains exactly the same name as a client — that is currently mitigated by tool-output sanitization but is not 100% airtight.

## What partners are signing off on

By signing this memo, F&F partners acknowledge:
- The Team-plan posture is understood; ZDR is not in place.
- The on-device tokenization (Option C, ratified 2026-05-13 in the 6th addendum) is the operative privilege boundary.
- The 7-year audit retention is the discovery-of-record.
- A sanitization failure in production triggers immediate rollback (per plan §M).
- This memo replaces the original §Q "ZDR + BAA + SOC 2" framing.

## Open dependencies before Phase 5 deploy

- Malpractice carrier UPL review (audit user-decision #8) — pending.
- D15 audit envelope writer implementation (KEK/DEK strategy) — pending.
- F&F partner signature on this memo.

---

**Signature block:**

Partner: ________________________ Date: __________

Partner: ________________________ Date: __________
