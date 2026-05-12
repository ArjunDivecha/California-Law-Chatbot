# Product Requirements Document
## California Law Chatbot for Femme & Femme

**Document Version:** 1.0
**Date:** April 23, 2026
**Author:** Arjun Divecha
**Status:** Draft — for F&F review
**Distribution:** F&F Managing Partner, F&F Technology Partner, F&F General Counsel
**Confidentiality:** F&F Confidential — Vendor Working Document

---

## 1. Executive Summary

The California Law Chatbot is an AI-assisted legal-research tool that lets F&F attorneys query California legal authorities — case law, statutes, regulations, and CEB practice guides — through a conversational interface. It is provided to F&F as an internal tool, restricted to F&F attorneys, and engineered to meet California Rule of Professional Conduct 1.6 confidentiality obligations through a layered architecture: client-data sanitization within F&F's trust boundary plus AWS Bedrock with no-training and no-retention contractual terms.

This PRD defines the v1.0 product to be delivered by end of May 2026.

---

## 2. Background and Motivation

### 2.1 Problem
F&F attorneys currently use a mix of Westlaw, Lexis+, ad-hoc Google searches, and consumer ChatGPT for early-stage legal research. The consumer-AI usage creates Rule 1.6 exposure (client-related queries entered into tools without no-training or no-retention guarantees) and the commercial legal platforms are expensive, slow, and not optimized for the California-specific practice areas F&F focuses on (trusts & estates, family law including LGBT family law, business litigation).

### 2.2 Opportunity
A purpose-built chatbot that (a) ingests F&F-licensed CEB practice guides plus public California case law and statutes, (b) sanitizes all attorney-supplied client information before it leaves F&F's trust boundary, and (c) generates verified, citation-grounded answers using AWS Bedrock Claude — gives F&F faster, more accurate research with a defensible Rule 1.6 posture.

### 2.3 Compliance framing
The product is designed to satisfy:
- California Rules of Professional Conduct 1.1 (competence), 1.4 (communication), 1.6 (confidentiality), 5.1/5.3 (supervision)
- California Business & Professions Code § 6068(e)(1)
- California State Bar COPRAC Practical Guidance for the Use of Generative AI (Nov 2023)
- CCPA/CPRA service-provider obligations

---

## 3. Goals and Non-Goals

### 3.1 In scope (v1.0)
1. Conversational legal-research interface for F&F attorneys, behind firm SSO.
2. Three source modes: CEB-only, public-authorities-only, hybrid (default).
3. Client-data sanitization layer applied to every query before any external LLM call.
4. AWS Bedrock Claude as the sole generative model in the production data path.
5. Per-attorney audit log of every query.
6. Verification pass that flags unsupported claims in generated answers.
7. Citation linking to CEB, CourtListener, and California codes.
8. Structural flow enforcement separating client-safe Accuracy flows from the non-client Speed passthrough.

### 3.2 Out of scope (v1.0)
1. Document drafting (motions, briefs, contracts) — exists in current codebase as `orchestrate-document.ts` but excluded from v1.0 sanitization scope; deferred to v2.0.
2. Document upload / OCR / handling of scanned exhibits.
3. Multi-jurisdictional research (federal-only, other-state queries).
4. Public access — F&F internal only.
5. Mobile-native apps (responsive web only).
6. Integration with F&F's matter management or billing systems.
7. Real-time collaboration (multiple attorneys on one session).
8. Broad-web Speed passthrough for client-related matters. Speed remains available only for non-client/general research and is not part of the F&F confidential production workflow.

### 3.3 Explicit non-goals
1. The product **does not provide legal advice**. It is a research-assistance tool. F&F attorneys retain full professional responsibility.
2. The product **does not establish an attorney-client relationship** with anyone.
3. The product **does not replace verification of authorities** by the attorney before reliance.
4. The product **does not treat prompt instructions as security controls**. Confidentiality boundaries must be enforced by routing, authentication, authorization, sanitization, and tests.

---

## 4. Users and Personas

### 4.1 Primary persona — F&F Associate Attorney
- 2–8 years post-bar, billable-hour pressure
- Primary practice areas: trusts & estates, family law, LGBT family law, business litigation
- Comfortable with Westlaw and Lexis; has used consumer ChatGPT informally
- Needs: fast first-pass research on California-specific questions; accurate citations they can verify
- Pain: slow billable research time; uncertainty about whether AI outputs are reliable; ethics anxiety about consumer AI tools

### 4.2 Secondary persona — F&F Partner
- Reviews associate work product
- Wants to know what tools associates used
- Needs: audit trail showing how research was conducted
- Pain: liability exposure if associates rely on unverified AI output

### 4.3 Tertiary persona — F&F Managing Partner / GC
- Owns Rule 1.6 compliance for the firm
- Needs: defensible vendor-diligence file; clear understanding of data flows; ability to revoke access cleanly
- Pain: regulatory and disciplinary risk

### 4.4 Operational persona — Vendor (Arjun)
- Maintains the system pre-handover
- Needs: clear scope, capped liability, defined termination/handover
- Pain: scope creep, ambiguous obligations, perpetual support

---

## 5. Functional Requirements

### 5.1 Authentication and Authorization
- **F1.1** All access requires F&F SSO (Okta, Azure AD, or Google Workspace — tbd by F&F).
- **F1.2** No public access. Anonymous users redirected to error page.
- **F1.3** Per-user session token, 8-hour expiry, sliding renewal.
- **F1.4** Admin role for F&F-designated user(s) — controls user list, views aggregate audit log.
- **F1.5** User offboarding: removal from SSO automatically revokes access within 5 minutes.
- **F1.6 Flow authorization:** All model/retrieval endpoints enforce an explicit flow policy (`accuracy_client`, `public_research`, or `speed_passthrough`). Client-confidential endpoints reject Speed requests; the Speed endpoint rejects client-safe/Accuracy requests and is not exposed in F&F confidential workflows.
- **F1.7 Backend enforcement:** API authorization and flow checks are server-side requirements, not UI-only controls. Direct POSTs to hidden routes must fail closed.
- **F1.8 Route inventory:** Existing passthrough routes, including `/api/anthropic-chat`, must either be renamed into an explicit `/api/speed` non-client route or guarded with the same Speed-only policy. No legacy route may remain as an unguarded backdoor to broad web search.

### 5.2 Query Interface
- **F2.1** Single text input field, supports multi-line queries up to 8,000 characters.
- **F2.2** Source mode selector: CEB-only, AI-only (public authorities), Hybrid (default).
- **F2.3** Conversation history within session: 10 message turns retained for context.
- **F2.4** Chat sidebar showing prior conversations for the user; max 100 conversations retained per user (existing repo limit).
- **F2.5** "Sanitization Preview" toggle — shows the attorney exactly what text will leave F&F's trust boundary before submission.
- **F2.6 Speed mode handling:** Any Speed/non-client passthrough UI must be disabled for F&F client work by default, visually labeled "Non-client research only," and backed by server-side flow rejection. The UI label alone is not sufficient.

### 5.3 Sanitization Pipeline
The mandatory pipeline through which every query passes before any external LLM call.

- **F3.1 Pass 1 (Preservation):** Run eyecite + reporters-db + courts-db on the query. Identify case citations, statutory citations, court names, and reporter abbreviations. Wrap each in `<<PRESERVE>>...<<END>>` sentinels.
- **F3.2 Pass 1.5 (Custom California allowlist):** Apply F&F-maintained allowlist of California public officials (judges in judicial capacity, named justices, public agencies, named law schools, published treatise titles) — additional `<<PRESERVE>>` wrapping.
- **F3.3 Pass 2 (PII Detection):** Run primary PII detector on the non-preserved spans only. Candidate models: locally/self-hosted OpenAI Privacy Filter (Apache 2.0, no OpenAI API call) and NVIDIA gliner-PII. Final selection determined by Phase-3 benchmark (see §13).
- **F3.4 Pass 3 (Reconciliation):** Resolve any overlap between Pass 1 and Pass 2 in favor of preservation. Document the rule set.
- **F3.5 Pass 4 (Tokenization):** Replace detected private spans with deterministic tokens (`[PERSON_A]`, `[ORG_B]`, `[ADDR_C]`). Token map stored in encrypted session-scoped storage; never sent to Bedrock.
- **F3.6 Pass 5 (Audit log):** Write a record per query containing: attorney_id, timestamp, HMAC-SHA256(sanitized_query) using a KMS-managed key, entity_count_by_category, model_used, flow_type, correlation_id. Original query text is **not** logged, and unhashed query text is never written to observability systems.
- **F3.7 Pass 6 (Post-flight regex audit):** After Bedrock responds, regex-scan the sanitized payload for patterns indicating preservation failure (e.g., `[PERSON_X] v\.` patterns where a case citation was tokenized). On hit, log incident and surface warning to attorney.
- **F3.8 Bedrock Guardrails:** Enable AWS Bedrock Guardrails as second-line PII detection inside AWS. Treated as backstop, not primary.
- **F3.9 Fail-closed routing:** If sanitization, token-map storage, or flow authorization is unavailable, client-related Accuracy requests are blocked before any external retrieval or model call.

### 5.4 Source Retrieval
- **F4.1 CEB:** Vector search against Upstash Vector namespaces using Bedrock Titan v2 embeddings (re-embedded from current OpenAI text-embedding-3-small). Existing 5 categories retained: trusts_estates, family_law, business_litigation, business_entities, business_transactions.
- **F4.2 Case law:** CourtListener API search, California-only filter, top 5 results. Client-related case-law searches use sanitized terms only; raw client facts never leave the trust boundary.
- **F4.3 Statutes:** Statutory lookup supports both deterministic citation parsing and semantic statute inference. Regex-only exact citation extraction is insufficient for v1.0 because attorneys often ask statute questions without naming the section.
- **F4.4 Legislative bills:** OpenStates and LegiScan APIs — sanitized search terms only, never raw query. Legislative search results must be retained as first-class sources in the research package; discarded results are a release blocker.
- **F4.5 Current-data broker:** For current-law questions, the system builds sanitized public legal search terms first, then queries OpenStates/LegiScan and, where enabled, Exa/Google Search API restricted to official/legal domains. Broad search of raw client text is prohibited.
- **F4.6 Retrieval parity:** Migration from LLM tool-calling to deterministic retrieval is allowed only if the 200-query gold set shows no material recall regression for statutes, legislative updates, and case-law discovery. Otherwise, retain Bedrock Claude tool-calling or add a refinement pass.

### 5.5 Generation
- **F5.1 Generator:** AWS Bedrock — target model family Claude Sonnet 4.5, using the exact cross-region inference profile ID verified in the F&F AWS account before deployment.
- **F5.2 Verifier:** Same model, separate call, prompted to verify generator's claims against retrieved sources.
- **F5.3 Research agent:** AWS Bedrock Claude Haiku 4.5 or the approved Bedrock low-latency Claude profile for citation extraction, source ranking, follow-up search planning, and authority recall.
- **F5.4 Embeddings:** Bedrock Titan Embed v2 (1024 dimensions). Cutover from OpenAI text-embedding-3-small required.
- **F5.5 No model invocation logging on Bedrock.** Configuration verified via account-config audit (compliance/aws/account-config-2026-04-23.md).
- **F5.6 No prompt caching.** Client-confidential Bedrock requests must omit prompt-cache `cache_control` checkpoints. Tests must fail if cache-control metadata is added to client prompts.
- **F5.7 Verified model IDs only:** No guessed Bedrock model IDs may ship. Model IDs/inference profiles must be captured from `aws bedrock list-inference-profiles` or AWS console evidence and pinned in deployment config.
- **F5.8 No legacy Gemini aliases:** Bedrock code paths must not read `GEMINI_*` environment variables as fallback model IDs. Stale Gemini/OpenRouter configuration must fail closed rather than silently becoming a Bedrock model string.
- **F5.9 Research-agent behavior:** The Bedrock research agent must preserve the old tool-calling loop's core capabilities: source-directed follow-up search, inferred statute lookup, legislative result retention, and ranked authority output. A fixed one-shot pipeline is acceptable only after parity testing.
- **F5.10 Production model boundary:** Production client-related flows may not call OpenAI, OpenRouter, Anthropic direct, Google AI/Vertex, or any non-Bedrock generative model unless F&F explicitly approves a future contract change.

### 5.6 Response Rendering
- **F6.1 Token rehydration:** Replace `[PERSON_A]` etc. with original text in the rendered response. Performed in the application server before sending HTML to browser.
- **F6.2 Source citations:** Inline links to CEB results, CourtListener case pages, California Legislative Information statute pages.
- **F6.3 Verification badges:** Every claim flagged with status — verified, partially verified, unverified, not_needed.
- **F6.4 CEB-Only mode:** Amber "CEB Verified" badge replaces verification (CEB is treated as authoritative; verification skipped).
- **F6.5 Disclaimer footer:** Persistent — "AI-assisted research. Not legal advice. Verify all authorities before reliance."

### 5.7 Audit and Supervision
- **F7.1** Per-attorney query log, encrypted at rest in AWS S3 with object lock, 7-year retention.
- **F7.2** Admin-only dashboard showing query volume by attorney, top categories, sanitization-warning incidents.
- **F7.3** Export to CSV for firm internal audit.
- **F7.4** Incident report generator for any Pass 6 audit hit — emailed to designated F&F partner within 24 hours.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **N1.1** End-to-end query latency: P50 ≤ 6 seconds, P95 ≤ 15 seconds (sanitization + retrieval + generation + rehydration).
- **N1.2** Sanitization layer: P95 ≤ 800 ms.
- **N1.3** First token streaming to UI within 3 seconds of submission.
- **N1.4** Concurrent users supported: 25 (F&F's expected attorney count for v1.0; system designed for 100 with no architectural changes).

### 6.2 Availability
- **N2.1** Target: 99.0% during F&F business hours (8a–7p PT, M–F).
- **N2.2** No SLA committed — this is a research tool, not a litigation-deadline system.
- **N2.3** Maintenance windows: weekends, with 48-hour notice to F&F.

### 6.3 Security
- **N3.1** TLS 1.2+ for all transport.
- **N3.2** AES-256 at rest with AWS KMS customer-managed keys.
- **N3.3** Vendor (me) production access: MFA required; quarterly access review.
- **N3.4** Annual third-party penetration test post-launch (target: Q4 2026).
- **N3.5** All sub-processors documented; F&F notified 30 days before any addition.

### 6.4 Confidentiality posture
- **N4.1** No client-confidential text retained server-side outside session lifetime (token map purged on session end).
- **N4.2** Audit logs contain hashes and metadata only — no original query text.
- **N4.3** No third-party analytics, no usage tracking, no error reporting that includes payload bodies.
- **N4.4** Vercel function logs scrubbed of query bodies.
- **N4.5** Speed passthrough is not a client-confidential workflow. It must be disabled or hidden in F&F client-research contexts and rejected server-side if invoked with a client-safe flow marker.
- **N4.6** External current-data providers (OpenStates, LegiScan, Exa, Google Search API, CourtListener) receive only sanitized public legal search terms in client-related Accuracy flows.
- **N4.7** API routes enforce restricted origins, authenticated sessions, and explicit flow authorization so direct POSTs cannot bypass the intended confidentiality boundary.

### 6.5 Data residency
- **N5.1** All compute and storage in AWS US regions (us-east-1, us-west-2).
- **N5.2** Vercel functions in US regions only.
- **N5.3** No transfer to non-US jurisdictions.

### 6.6 Compliance
- **N6.1** AWS BAA (signed April 22, 2026); GDPR DPA incorporated by reference into AWS Service Terms.
- **N6.2** Vercel Pro DPA executed before launch.
- **N6.3** Upstash DPA executed before launch.
- **N6.4** No-Fee Services Agreement between Provider (Arjun) and F&F executed before launch.

---

## 7. Architecture

### 7.1 Component diagram
```
┌────────────────────────────────────────────────────────┐
│  F&F attorney (browser, behind firm SSO)               │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌────────────────────────────────────────────────────────┐
│  Vercel — Frontend (React/TS)                          │
│  - Query input, source mode selector, sanitization UI │
│  - Sanitization Preview component                     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Vercel Functions — API layer                          │
│  /api/auth         (SSO callback)                     │
│  /api/sanitize     (run pipeline, return preview)     │
│  /api/chat         (full pipeline + Bedrock + audit)  │
│  /api/speed        (non-client passthrough only)      │
│  /api/ceb-search   (existing, switched to Titan v2)   │
│  /api/courtlistener-search  (sanitized terms only)    │
└──────────────────────────┬─────────────────────────────┘
                           │ STS-assumed role
                           ▼
┌────────────────────────────────────────────────────────┐
│  AWS (us-east-1, BAA in force)                         │
│  ├─ Bedrock Claude Sonnet 4.5 (generator + verifier)  │
│  ├─ Bedrock Claude Haiku 4.5 (research agent)         │
│  ├─ Bedrock Titan Embed v2 (CEB embeddings)           │
│  ├─ Bedrock Guardrails (PII backstop)                 │
│  ├─ S3 (audit logs, object-lock 7yr)                  │
│  ├─ KMS (CMKs for at-rest encryption)                 │
│  └─ CloudTrail (org-wide management events)           │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Upstash Vector (US region, DPA signed)                │
│  CEB embeddings, 5 namespaces                          │
└────────────────────────────────────────────────────────┘
```

### 7.2 Sanitization library
New module: `services/sanitization/`
- `preserveLegalEntities.ts` — eyecite wrapper + custom California allowlist
- `detectPII.ts` — pluggable PII detector (Privacy Filter or gliner-PII)
- `reconcile.ts` — policy reconciliation rules
- `tokenize.ts` — token substitution and map management
- `rehydrate.ts` — post-response token replacement
- `audit.ts` — Pass 6 regex audit + incident emit

Token map persisted in AWS ElastiCache (Redis) with 30-minute TTL, encrypted in transit and at rest.

### 7.3 Bedrock adapter
New module: `utils/bedrockClaude.ts` replacing `utils/googleGenAI.ts`.
- Same interface signature (`generateText`, `generateTextStream`, etc.) — minimizes call-site changes.
- Uses AWS SDK v3 (`@aws-sdk/client-bedrock-runtime`).
- Cross-region inference profile for capacity.
- Prompt caching disabled by omission and tests: no `cache_control` checkpoints are permitted on client-confidential prompts.
- No Bedrock model invocation logging, verified by account-config evidence before launch.
- Deployment requires exact Bedrock model/inference-profile IDs from AWS account evidence. Placeholder or guessed IDs are release blockers.

### 7.4 CEB re-embedding
One-time migration:
- Read existing 77,406 OpenAI embeddings from Upstash.
- Re-embed source chunks with Titan v2.
- Upload to new Upstash namespaces (`ceb_v2_trusts_estates`, etc.).
- Atomic cutover via env var `CEB_NAMESPACE_VERSION=v2`.
- Validate retrieval quality on a 50-query test set before cutover.
- Old namespaces retained for 30 days then deleted.

---

## 8. Data Model

### 8.1 User
| Field | Type | Notes |
|---|---|---|
| user_id | uuid | Internal |
| sso_subject | string | From IdP |
| email | string | From IdP |
| display_name | string | From IdP |
| role | enum(attorney, admin) | Default attorney |
| created_at | timestamp | First login |
| last_active | timestamp | Updated each session |

### 8.2 Conversation
| Field | Type | Notes |
|---|---|---|
| conversation_id | uuid | |
| user_id | uuid | FK |
| title | string | Set from first user message |
| created_at | timestamp | |
| message_count | int | Cap 20 messages per conversation |

### 8.3 Message
| Field | Type | Notes |
|---|---|---|
| message_id | uuid | |
| conversation_id | uuid | FK |
| role | enum(user, assistant) | |
| content | text | **For user messages: stored sanitized only** |
| sources | jsonb | Citation list |
| verification_status | enum | |
| created_at | timestamp | |

### 8.4 Audit log
| Field | Type | Notes |
|---|---|---|
| log_id | uuid | |
| user_id | uuid | |
| timestamp | timestamp | |
| query_hash | hmac_sha256 | KMS-keyed HMAC of sanitized query |
| pii_categories_detected | jsonb | Counts only, not values |
| preservation_count | int | |
| model_used | string | |
| flow_type | enum | accuracy_client, public_research, or speed_passthrough |
| correlation_id | uuid | |
| post_audit_warnings | jsonb | Any Pass 6 hits |
| latency_ms | int | |

---

## 9. UI/UX Requirements

### 9.1 Layout
- Left sidebar: conversation list (existing).
- Center: chat interface (existing).
- Right (collapsible): source citations panel (existing).

### 9.2 New UI components for v1.0

#### 9.2.1 Sanitization Preview
- Button next to query input: "Preview what gets sent."
- On click: shows the sanitized payload with redactions visualized (struck-through original text + token replacements).
- Attorney can edit query and re-preview before submission.
- One-time tutorial dialog on first use explaining what the preview shows.

#### 9.2.2 Confidentiality banner
- Persistent header: "F&F Internal Use Only · Sanitization Active · Bedrock with BAA"
- Tooltip on hover: link to F&F's internal AI-use policy.

#### 9.2.3 First-session attestation
- Modal on first login: "I have completed the F&F AI training and will use this tool consistent with firm policy and Cal. Rule 1.6."
- Checkbox + signature (typed name); recorded in user record.
- Annual re-attestation.

#### 9.2.4 Sanitization warning toast
- If Pass 6 audit detects a concerning pattern, non-modal toast: "Sanitization warning: review the preview before resubmitting."
- Logged to incident system.

### 9.3 Accessibility
- WCAG 2.1 AA compliance.
- Keyboard navigation for all primary flows.
- Screen reader compatible.

---

## 10. Security and Compliance Requirements

### 10.1 Authentication
- SSO mandatory. No password-based login.
- MFA enforced at IdP level (F&F's responsibility).
- Session token: 8-hour absolute, 30-minute sliding refresh.

### 10.2 Authorization
- All API endpoints validate JWT signature and check user is in F&F's IdP group.
- No anonymous access path.

### 10.3 Encryption
- TLS 1.3 preferred, 1.2 minimum, in transit.
- AES-256-GCM at rest with AWS KMS CMKs.
- ElastiCache token-map: encrypted in transit and at rest.

### 10.4 Logging
- CloudTrail org-wide.
- Application logs: structured JSON, payload bodies redacted.
- Audit log: append-only, S3 with object lock.
- No client query text in any log.

### 10.5 Vendor management
| Sub-processor | Role | Agreement | Status |
|---|---|---|---|
| AWS | Compute, storage, AI inference | BAA + Customer Agreement + Service Terms | Signed Apr 22, 2026 |
| Vercel | Frontend hosting + functions | Pro DPA | To execute pre-launch |
| Upstash | Vector DB | Standard DPA | To execute pre-launch |
| F&F's IdP | SSO | Existing F&F IT contract | Existing |
| Exa / Google Search API | Optional current-data retrieval for sanitized public legal terms only | DPA / vendor review required if enabled for F&F client workflows | Off by default pending F&F approval |

### 10.6 Compliance documentation packet
Maintained at `compliance/`:
- AWS BAA (signed PDF)
- AWS DPA reference
- AWS Service Terms snapshot (dated)
- Vercel DPA
- Upstash DPA
- F&F ↔ Vendor No-Fee Services Agreement
- Cyber liability + E&O certificates
- Sub-processor list
- Architecture diagram + data flow
- Incident response runbook
- Annual compliance review log

---

## 11. Performance and Scale

### 11.1 Capacity
- v1.0 target: 25 named users, ~100 queries/user/week = 2,500 queries/week peak.
- Bedrock cross-region inference profile handles burst capacity automatically.
- Upstash Vector: existing tier supports 100 QPS, well above need.

### 11.2 Cost (estimated monthly, v1.0)
| Component | Cost |
|---|---|
| Bedrock Claude Sonnet 4.5 (~10M tokens/mo) | ~$150 |
| Bedrock Claude Haiku 4.5 (~5M tokens/mo) | ~$10 |
| Bedrock Titan Embed (~50K embeddings/mo) | ~$5 |
| Vercel Pro | $20 |
| Upstash Vector | $50 |
| AWS S3, KMS, ElastiCache, CloudTrail | ~$30 |
| **Total** | **~$265/mo** |

Pre-paid by Provider for the no-fee engagement period; reimbursable if F&F elects to take over operational costs.

---

## 12. Success Metrics

### 12.1 Adoption
- ≥80% of named F&F attorneys log in within 30 days of launch.
- ≥50% of named attorneys use the tool weekly within 60 days.

### 12.2 Quality
- Sanitization preservation rate (legal entities preserved correctly): ≥99% on F&F-curated test set.
- Sanitization recall rate (private PII redacted correctly): ≥95% on F&F-curated test set.
- Verification system flags unsupported claims at ≥90% recall (measured on a 50-query gold set).
- No material research-recall regression versus the pre-Bedrock Google/tool-calling pathway on the 200-query gold set.
- 100% of legislative-source-enabled tests retain legislative sources and summaries when the upstream provider returns data.
- User-reported false answers: <5% of sessions per quarter.

### 12.3 Compliance
- Zero confirmed instances of unsanitized client information reaching Bedrock.
- Zero raw client prompts sent to Exa, Google Search API, OpenStates, LegiScan, CourtListener, or other external current-data providers in client-related Accuracy integration tests.
- 100% of client-confidential requests are rejected from the Speed passthrough route.
- 100% of queries logged with attorney attribution.
- 100% of Pass 6 audit warnings investigated within 24 hours.

### 12.4 Performance
- P50 latency ≤ 6s, P95 ≤ 15s.
- Availability ≥99% during business hours.

---

## 13. Implementation Plan

### 13.1 Milestones

| # | Milestone | Date | Owner |
|---|---|---|---|
| M1 | Code-leak fixes plus structural flow guard, route/auth/CORS hardening, and Speed disabled/guarded for client workflows deployed | May 1, 2026 | Vendor |
| M2 | 200-query California gold evaluation set complete | May 2, 2026 | Vendor |
| M3 | Sanitization layer v1 (eyecite + allowlist + reconciliation) functional | May 8, 2026 | Vendor |
| M4 | PII detector benchmark complete; primary model selected | May 10, 2026 | Vendor |
| M5 | Bedrock adapter complete with verified model/profile IDs, no `GEMINI_*` aliases, CEB re-embedded, and old code path retired | May 13, 2026 | Vendor |
| M6 | F&F SSO integration complete; per-attorney audit log live | May 16, 2026 | Vendor + F&F IT |
| M7 | Internal end-to-end testing (synthetic data), including Speed rejection, current-data sanitization, legislative-source retention, and research-agent parity tests | May 17–22 | Vendor |
| M8 | F&F UAT begins (≤3 attorneys, synthetic data only) | May 23, 2026 | F&F |
| M9 | F&F UAT with sanitized real queries (under attorney supervision) | May 27, 2026 | F&F |
| M10 | No-Fee Services Agreement signed; insurance bound; production launch | May 29, 2026 | F&F + Vendor |

### 13.2 Dependencies on F&F
- Designate primary technology partner contact.
- Provide SSO IdP details and test account by May 14.
- Designate F&F GC reviewer for No-Fee Services Agreement by May 6.
- Procure cyber liability + E&O insurance certificates of coverage by May 25.
- Schedule attorney AI-use training session for May 28.

### 13.3 Critical path
SSO integration is the critical-path external dependency. If F&F cannot provide IdP details by May 14, launch slips by the corresponding number of days.

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sanitizer over-redacts case names breaking research utility | Medium | High | eyecite preservation runs first; Pass 6 audit catches; F&F gold-set evaluation gates launch |
| Sanitizer misses an unusual identifier (sanitization recall failure) | Medium | High | Vendor terms (no-train, no-retain) are contractual backstop; per-attorney audit enables post-incident response |
| Aggregation re-identification across queries by AWS | Low | High | AWS Service Terms §50 prohibits training; logging disabled; cross-region inference may help randomize |
| Privacy Filter or gliner-PII produces unacceptable false-positive rate on legal text | Medium | Medium | Benchmark both before selection; fallback to fine-tuning (deferred to v2.0) |
| F&F attorney bypasses sanitization (e.g., copies pasted PDF with PII) | Medium | Medium | Sanitization Preview makes the leak visible before submission; F&F training emphasizes responsibility |
| F&F's IdP delay slips launch | Medium | Medium | Critical path tracked weekly; soft launch fallback with vendor-managed temporary auth if needed |
| Vendor (Arjun) becomes unavailable post-launch | Low | High | Handover plan documented in Software Transfer Agreement; 60-day notice period; F&F can take ownership |
| Speed passthrough receives client-confidential facts by direct API call or UI misuse | Medium | High | Structural flow authorization, route-level rejection, F&F UI disabled/hidden for client workflows, and direct-POST tests in CI |
| Bedrock model IDs are guessed, stale, or inherited from Gemini/OpenRouter aliases | Medium | High | Require AWS account evidence for model/profile IDs, remove `GEMINI_*` fallbacks, and smoke-test primary and fallback model calls before launch |
| Research agent loses recall compared with prior Google/tool-calling path | Medium | High | Restore Bedrock tool calling or add a refinement pass unless the 200-query gold set proves no material regression |
| Legislative search runs but returned sources are silently discarded | Medium | High | Treat legislative results as first-class sources; add integration tests that fail when provider data is returned but not surfaced |
| Bedrock model deprecation or pricing change | Low | Medium | Architecture is adapter-based; fallback is another F&F-approved Bedrock inference profile or a documented contract-review decision, not an automatic Anthropic-direct call |
| AWS Service Terms change reducing confidentiality posture | Low | High | Quarterly review of Service Terms §50 (compliance runbook); F&F notified within 30 days of material change |

---

## 15. Legal and Contractual Framework

### 15.1 Provider ↔ F&F
**No-Fee Services and Data Protection Agreement** — to be drafted by tech-transactions counsel, executed before launch. Key terms:
- No fee for v1.0 deployment.
- Data-protection commitments mirroring the AWS Bedrock posture.
- Sub-processor list (Exhibit A) and Information Security Addendum (Exhibit B).
- Liability cap: $1,000 general; up to insurance limits for §5 (data protection) breach.
- 60-day termination on either side.
- Mutual confidentiality.
- F&F retains all professional responsibility for use of outputs.

### 15.2 Provider ↔ AWS
- AWS Customer Agreement (existing, accepted at account creation).
- AWS BAA (signed April 22, 2026).
- AWS Service Terms (incorporated, including DPA reference).

### 15.3 Provider ↔ Other sub-processors
- Vercel Pro DPA — to execute pre-launch.
- Upstash DPA — to execute pre-launch.

### 15.4 F&F internal
- Engagement-letter addendum disclosing AI-assisted research (F&F's GC drafts).
- Firm AI-use policy (existing or new — F&F's responsibility).
- Mandatory 30-minute attorney training before access.

### 15.5 Insurance
- Cyber liability: $1–2M minimum, bound before launch.
- E&O / professional liability: $1M minimum, bound before launch.
- Both policies must explicitly cover unpaid / pro-bono work.

### 15.6 Future state
**Software Transfer and License Assignment Agreement** — optional, executed 3–6 months post-launch if F&F elects to take over operations. Converts the engagement from "ongoing vendor" to "delivered software" with bounded vendor liability tail.

---

## 16. Open Questions

1. **SSO provider:** F&F to confirm Okta vs Azure AD vs Google Workspace by May 6.
2. **Hosting model:** Vercel + AWS (current design) or migrate API layer to AWS Lambda for single-vendor compute? Default Vercel; F&F GC confirm acceptable.
3. **CEB licensing:** Confirm F&F's CEB Online subscription permits the chatbot's use of indexed CEB content. Handled by F&F.
4. **Fine-tuning:** Defer to v2.0 (assumed). Confirm F&F has no immediate need.
5. **Drafting tool:** Existing `orchestrate-document.ts` is excluded from v1.0. Determine v2.0 scope and timeline post-launch.
6. **Handover horizon:** F&F preference on 3, 6, 12 months, or open-ended? Discussed at launch retrospective.
7. **Incident response:** F&F-designated partner for §F7.4 alerts. Default: Managing Partner; F&F to confirm.
8. **Breach notification thresholds:** §5.6 of the No-Fee Services Agreement specifies 72 hours; F&F to confirm acceptable.
9. **Speed availability:** Should Speed passthrough be unavailable to F&F entirely, or available only in a clearly separated non-client/general-research workspace?
10. **Research-agent strategy:** Restore Bedrock native tool calling to match the prior Google pathway, or ship deterministic retrieval plus a Claude refinement pass if parity tests pass?
11. **Current-data providers after sanitization:** Default to official-only sources (OpenStates, LegiScan, CourtListener, California Legislative Information) or permit sanitized Exa/Google Search API for broader web recall?

---

## 17. Appendices

### Appendix A — California Public Allowlist (Initial)
Maintained at `services/sanitization/california-allowlist.json`. Initial categories:
- California Supreme Court Justices (current and historical, named in published opinions)
- California Court of Appeal divisions
- Federal courts with California jurisdiction
- California state agencies (DMV, FTB, DOJ, CDT, etc.)
- Major California public officials in role (Governor, Attorney General, Insurance Commissioner)
- Published treatise titles (CEB practice guides, Witkin, Rutter Group, etc.)

Reviewed and updated quarterly.

### Appendix B — 200-Query Gold Evaluation Set
Hand-curated by Vendor with F&F partner review. Categories:
- 60 pure public queries (citation lookups, statute interpretation)
- 40 pure private queries (synthetic client facts, no public authorities)
- 60 mixed queries (public authority + private client fact)
- 20 tricky case captions ("In re Marriage of [private]" vs. *In re Marriage of Bonds*)
- 10 public officials in/out of judicial capacity
- 10 edge cases (judge surnames matching common names, agency names matching private orgs)

Used for benchmark evaluation, regression testing, and ongoing quality monitoring.

Required regression slices:
- Current-law questions that require 2025-2026 legislative or regulatory data beyond the base model's training set.
- Statute questions where the attorney names the legal concept but not the code section, to test semantic statute inference.
- Legislative-source retention cases where OpenStates/LegiScan return bill data that must appear in the final source package.
- Direct-POST and UI misuse cases proving client-confidential prompts are rejected from Speed.
- External-search privacy cases proving Exa/Google/OpenStates/LegiScan/CourtListener receive sanitized public legal terms only.

### Appendix C — Sub-Processor Details
| Vendor | Function | Data flowed | Region | Agreement |
|---|---|---|---|---|
| AWS | Bedrock inference, S3, KMS, CloudTrail, ElastiCache | Sanitized query text, embeddings, audit metadata | us-east-1 | BAA + Customer Agreement + Service Terms |
| Vercel | Frontend hosting, serverless API | Sanitized query, response, session metadata | US regions | Pro DPA |
| Upstash | Vector DB | Embeddings (vectors only, not source text) | US region | Standard DPA |
| Exa / Google Search API | Optional current-data retrieval | Sanitized public legal search terms only, never raw client facts | US where available | Requires F&F vendor approval before client-workflow enablement |

### Appendix D — Glossary
- **Sanitization:** The process of removing or tokenizing private client information from a query before it leaves F&F's trust boundary.
- **Preservation:** The process of identifying public legal entities (case citations, statutes, court names) that must NOT be redacted.
- **Tokenization:** Replacing detected private entities with deterministic placeholders that preserve grammatical structure.
- **Rehydration:** Replacing tokens back with original text in the response shown to the attorney.
- **Trust boundary:** The technical/contractual perimeter inside which F&F-controlled or F&F-bound parties handle client data.
- **Sub-processor:** Any third-party vendor that processes F&F data on Provider's behalf.

### Appendix E — Reference documents
- `Research/` — six deep-research reports informing architecture decisions
- `compliance/aws/` — AWS contractual packet
- `COMPLIANCE_ANALYSIS.md` — California State Bar guidance mapping (to be updated for Bedrock architecture)
- `PRIVACY_AND_CONFIDENTIALITY.md` — User-facing guidelines (to be updated)
- This PRD (`Santization.md`)

### Appendix F — Release Blockers From Architecture Review
The following review findings are mandatory launch blockers until resolved and tested:
- Speed passthrough cannot rely on policy text or UI labels. It requires server-side flow authorization, route hardening, direct-POST rejection tests, and clear separation from client-confidential Accuracy workflows.
- Legislative search output must be persisted into the research package and displayed as sources whenever OpenStates/LegiScan return relevant data.
- Bedrock model/profile IDs must be verified from AWS account evidence. Guessed IDs and legacy `GEMINI_*` model fallbacks cannot ship.
- The research agent must preserve the old Google/tool-calling pathway's recall behavior for inferred statutes, follow-up searches, legislative updates, and ranked authorities, unless parity testing proves the deterministic replacement is equivalent.

---

## 18. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Vendor | Arjun Divecha | _____ | _____ |
| F&F Managing Partner | _____ | _____ | _____ |
| F&F Technology Partner | _____ | _____ | _____ |
| F&F General Counsel | _____ | _____ | _____ |

---

*End of PRD v1.0. Revision triggered by: scope changes, material vendor terms changes, or quarterly review.*
