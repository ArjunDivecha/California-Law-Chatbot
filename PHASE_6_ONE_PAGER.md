# Phase 6 — Sanitization — One-Page Summary

**For:** femme & femme LLP · **From:** Dancing Elephant · **Date:** April 24, 2026

## What we're building
Client-identifying facts are tokenized in the attorney's browser before any network request. Vercel and every retrieval provider (OpenStates, LegiScan, CourtListener, OpenAI) see only tokenized text. The token map is persisted **on the attorney's computer**, encrypted with a passphrase only they know, reused across chats and days. Bedrock is the only generative model in the trust boundary.

## Attorney workflow
Attorney types → sanitized preview shows tokenized prompt and map (*Maria Esperanza → CLIENT_001*) → attorney can add/remove/rename tokens → submit sends only tokenized text → answer comes back tokenized → browser rehydrates locally for display. Chat history is saved tokenized; opening the chat later rehydrates again. Same entity always resolves to the same token, forever.

## What this lets F&F tell a client or regulator
*"Client-identifying facts are tokenized inside the attorney's browser before any network request. No third-party retrieval provider receives client names, addresses, or identifiers. Our serverless functions see only tokenized text. The map to real names lives only on the attorney's computer, encrypted with a passphrase only the attorney knows. Chat history is stored tokenized. Every request is audited with a keyed hash of the sanitized prompt; no raw payloads are retained in any log."*

## Timeline
Three weeks after sign-off. Sprint 1 (Week 1): sanitizer engine, encrypted persistent map, server backstop, audit log, tokenized chat persistence. Sprint 2 (Week 2–3): preview UI, passphrase unlock, attestation, rehydration, 200-prompt gold-set validation (≥99% legal-entity preservation, ≥95% PII recall).

## Decisions F&F needs to make
1. **Pattern set** — compliance counsel approves the deterministic PII list (SSN, TIN, phone, email, address, DOB, card/bank, driver license, client-matter codes; additions as needed).
2. **Local NER model** — ship a ~100 MB on-device name detector, or deterministic heuristics + attorney edit only?
3. **Attestation cadence** — confirm the preview every submission, or once per session?
4. **Vercel in the trust boundary** — Vercel sees only tokenized text but holds it in function memory during execution. Acceptable for v1 with Phase 9 committing to full AWS? **If no, add 3–4 weeks for AWS Lambda migration before UAT.**
5. **Passphrase recovery** — no recovery / 24-word recovery phrase / admin IT reset?
6. **Cross-device** — manual encrypted export/import (v2), or ship-as-is and attorneys use one primary device?
7. **KMS key** — dedicated audit-HMAC key, or reuse the Bedrock key?
8. **Retention** — deferred. F&F records-management policy answer for later.

## Ask
Thirty-minute review of the decisions above. We start building Monday.

*Full spec: `PHASE_6_SANITIZATION_PLAN.md` in the project repo.*
