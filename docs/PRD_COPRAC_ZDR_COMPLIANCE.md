<!--
=============================================================================
DOCUMENT: docs/PRD_COPRAC_ZDR_COMPLIANCE.md
=============================================================================
WHAT THIS DOCUMENT IS:
  THE canonical, consolidated Product Requirements Document for bringing the
  California Law Chatbot V2 into alignment with (a) the State Bar of California
  2026 COPRAC "Practical Guidance for the Use of Generative AI in the Practice
  of Law" and (b) Femme & Femme's new Anthropic enterprise Zero Data Retention
  (ZDR) arrangement.

  It is the UMBRELLA spec. It supersedes nothing it cites; it consolidates and
  reconciles them and resolves conflicts between them:
    - docs/COPRAC_2026_COMPLIANCE_CHANGE_PLAN.md   (obligation map + 12 epics)
    - docs/ZDR_ENTERPRISE_IMPLICATIONS.md          (ZDR analysis + mode matrix)
    - docs/f-and-f-lawyer-memo-ca-guidance-zdr.md  (counsel-facing summary)
    - docs/PRD_MORGAN_PROTECTIVE_ORDER_COMPLIANCE.md (protected-discovery storage/WORM detail)
    - docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md   (self-host + local-embedding remedy detail)
  Where this PRD and a sub-doc disagree, THIS PRD governs and the sub-doc should
  be updated to match.

INPUT SOURCES (full absolute paths / URLs):
  - The five docs above, under /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-V2/docs/
  - Independent vetting: /private/tmp/claude-501/.../scratchpad/VETTING_ANALYSIS.md
  - GPT-5.5 adversarial check: /private/tmp/claude-501/.../scratchpad/gpt-response.md
  - CA Bar 2026 guidance PDF: https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
  - V2 source code (read-only review): api/_lib/agentLoop.ts, api/_lib/tools/index.ts,
    api/_lib/tools/cebSearch.ts, api/_lib/sessionStore.ts, api/export-document.ts

OUTPUT FILE (full absolute path):
  - /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-V2/docs/PRD_COPRAC_ZDR_COMPLIANCE.md  (this file)

VERSION: 1.0 (DRAFT for counsel + product review)
LAST UPDATED: 2026-06-23
AUTHOR: Drafted by Claude Code (Opus 4.8) for Arjun Divecha / Femme & Femme,
        synthesizing the V2 doc set + an independent vetting + a GPT-5.5 review.

FACT TAGS: [V] verified against a primary source · [P] partially verified /
confirm before relying · [U] unverified assumption. Per "FAIL IS FAIL", any
control that depends on [P]/[U] must be confirmed in §13 before launch.

COMPLIANCE BOUNDARY: This PRD describes software that SUPPORTS compliant lawyer
use of AI. No software change makes an attorney's use "fully compliant." The
ethical duties remain with the lawyer. Do not use "fully compliant" /
"ethics-compliant AI" / "safe for protected discovery" in product copy unless
counsel approves the exact representation and the underlying controls are live.
=============================================================================
-->

# PRD — COPRAC-2026 + ZDR Compliance (Canonical Umbrella Spec)
**California Law Chatbot V2** · DRAFT v1.0 · 2026-06-23 · Owner: Femme & Femme

---

> ## ⚠️ ADDENDUM 2026-07-01 — ZDR PREMISE WITHDRAWN (governs over the body below)
>
> **F&F will NOT have Anthropic ZDR.** The information that an enterprise
> account (~$6k/yr) included ZDR was wrong; Anthropic ZDR requires a
> ~**$100k/yr** commitment. All ZDR-premised statements below are overtaken.
> Read the document with these substitutions:
>
> 1. **Operative Anthropic posture = standard commercial terms + DPA**: no
>    training on API content, deletion-on-request, default 30-day retention
>    (flagged content up to 2y, T&S scores up to 7y). Per the **Morgan v. V2X**
>    deep-research memo (2026-06-02; 2026 WL 864223, D. Colo.), this — not ZDR
>    — is what the protective-order standard actually requires: no-train, no
>    third-party disclosure except essential-to-service, deletion-on-request,
>    retained written documentation. ZDR was always an enhancement, never the
>    requirement.
> 2. **No tokenization relaxation.** §5.6/§5.7's "ZDR-driven OPF relaxation on
>    the Anthropic leg" does not happen. Strict detection/OPF stays load-bearing
>    on ALL legs, exactly as V2 already implements (browser GLiNER/daemon
>    detector + server backstop + wire guard).
> 3. **§5.8 model gate** is now a **counsel-approved allowlist**
>    (`api/_lib/approvedModels.ts`), not a ZDR-eligibility gate. Fable 5 was
>    restored from suspension (~2026-07) and re-approved as primary
>    (2026-07-01); Opus 4.8 is the unavailability fallback. Same fail-closed
>    guard at the same chokepoint.
> 4. **Protected discovery** launches with the **local-only storage posture**
>    (§5.7a firm-controlled sqlite-vec + local embeddings) + direct Anthropic
>    under standard terms + DPA with counsel sign-off per the Morgan memo
>    (§10 decision 1 is thereby resolved).
> 5. **§13 checklist**: item 1 becomes "date-stamp and retain Anthropic
>    Commercial Terms + DPA + retention page; disable the feedback/thumbs
>    feature (the only opt-in training path)". Item 3 becomes "sign the OpenAI
>    DPA for the embeddings org" (no ZDR request). Item 6 becomes "confirm
>    prompt-cache retention posture under standard terms" (caching is now in
>    use via agentLoop's buildWireBody).
> 6. Everything **guidance-driven** in this PRD — matter model, policy engine,
>    tool gating + exfiltration defense, provider registry, manifests/audit,
>    consent/attestations, review gates, agentic boundary, device threat model,
>    conflicts, billing, bias, legacy-route lockdown — is **unchanged** and was
>    implemented on the V3 branch, ported to V4 (2026-07-01) with the ZDR
>    touchpoints reworked as above.

---

## 1. Executive Summary

Two June-2026 developments require a coordinated change to V2:

1. **The 2026 COPRAC Practical Guidance** (Board-approved **2026-05-14** [V]; replaces Nov-2023; adds agentic-AI obligations at the California Supreme Court's **2025-08-22** direction [V]). It is **advisory**, but it interprets binding rules, and **six Rule amendments are pending** [V] that would be disciplinary if adopted.
2. **Femme & Femme's Anthropic enterprise ZDR** arrangement for the org that supplies the chatbot's API key.

**The thesis.** ZDR materially relaxes the need to tokenize ordinary client facts **on the direct-Anthropic inference leg only**. It does *not* make the pipeline confidential: the same facts can still leak sideways into web search, OpenAI embeddings, Upstash storage, Vercel logs, public-law APIs, browser state, exports, and — the subtlest path — **model-generated tool queries poisoned by untrusted retrieved content**. The right design is therefore **confidentiality by architecture**: a matter-aware policy engine that routes every external call by data class, with ZDR + contracts as the primary control, tokenization demoted to a routing/containment layer, and hard human-review gates around output reuse and any external action.

**What is already true in V2 (good).** The main agent path already calls `api.anthropic.com` directly via the SDK (`agentLoop.ts`) [V]; OPF tokenization, citation-verifying subagent, audit primitives, and a Morgan/protected-discovery PRD already exist. V2 is ahead of the old OpenRouter design.

**What this PRD adds beyond the existing V2 docs.** (a) Reconciles the Upstash contractual ceiling into the live plan; (b) makes ZDR-driven tokenization relaxation *contingent* on hardening the firm's own stores; (c) elevates two gaps neither the docs nor the first-pass vetting centered — **privilege/work-product waiver governance** and **indirect prompt-injection exfiltration**; (d) adds a **local-device threat model** and treats the **audit trail itself as discoverable**; (e) adopts a safer user-facing abstraction (**"matter workspace" with a locked protected flag**); (f) fixes the **Fable-5 default** and **legacy OpenRouter route** P0s.

---

## 2. Verified Facts the Design Rests On

| # | Fact | Tag |
|---|------|-----|
| V1 | 2026 COPRAC guidance is real, Board-approved 2026-05-14, advisory; interprets Rules 1.1/1.3/1.4/1.5/1.6/1.8.2/3.1/3.3/5.1–5.3/8.4/8.4.1/8.5/1.2.1, B&P §6068(a),(e), §§6147–6148 | [V] |
| V2 | Six Rule amendments (1.1,1.4,1.6,3.3,5.1,5.3) **proposed, not adopted**; treat as binding-soon, not yet disciplinary | [V] |
| V3 | CA Rule of Court **10.430** + Standard **10.80** (eff. 2025-09-01) bind **courts/judicial officers, not attorneys** — no statewide attorney filing-disclosure mandate; risk is **individual judges' standing orders** | [V] |
| V4 | **SB 574** (would bind attorneys: keep confidential info off public AI, verify output, disclose/verify citations) **pending**; last action 2026-06-22; not law | [V] |
| V5 | Anthropic ZDR is **per-organization, approval-gated**, applies to Messages API + token counting; **Enterprise seat ≠ ZDR**; not Console/web-UI, not Files/Batch/CodeExec/Programmatic-tools/MCP | [V] |
| V6 | Default (non-ZDR) Anthropic retention = 30 days; **even under ZDR**, flagged content retained up to **2 years**, safety-classifier scores up to **7 years** → ZDR ≠ guaranteed deletion | [V] |
| V7 | Anthropic does **not** train on commercial/API data by default; only opt-in path is feedback/thumbs | [V] |
| V8 | ZDR does **not** pass through OpenRouter (third-party integrations not ZDR-eligible); OpenRouter's own ZDR setting reroutes Claude via Bedrock/Vertex, never first-party | [V] |
| V9 | **`claude-fable-5` is non-ZDR-eligible** (Covered Model, 30-day retention) — the durable compliance reason it must not be a confidential/protected default | [V] |
| V10 | Fable 5 + Mythos 5 were **suspended for all customers 2026-06-12** (US export-control directive) — secondary, adds urgency; cite anthropic.com/news/fable-mythos-access before putting in the compliance record | [V]/[P] |
| V11 | OpenAI: **no training on API data since 2023-03-01**; **`/v1/embeddings` IS ZDR-eligible** (approval-gated); DPA available | [V] |
| V12 | **Upstash DPA prohibits "Restricted Data"** (CCPA-"sensitive personal information", PHI, SSNs, financial credentials); **SOC 2 + HIPAA scoped to Upstash Redis, NOT Vector**; encryption at-rest/in-transit **opt-in**; metadata cleartext | [V] |
| V13 | Anthropic **prompt caching is listed ZDR-eligible**; tool-schema/structured-output caching nuance should be confirmed for the org | [V]/[P] |

---

## 3. Guiding Principles
1. **Confidentiality by architecture, not user discipline.** The default behavior must be safe even if the lawyer does nothing special.
2. **ZDR relaxes one leg only.** It reduces Anthropic retention risk; it does not cover embeddings, vector/session stores, logs, public-law APIs, browser state, exports, or tool-query leakage.
3. **The lawyer retains judgment.** AI output is provisional work product for attorney review — never final advice, never autonomously sent/filed.
4. **No autonomy across a trust boundary.** No automated external transmission, filing, client communication, record mutation, or scheduling without a human gate.
5. **Fail closed on confidentiality; fail loud on accuracy.** A missing/stale ZDR, sanitizer, provider-evidence, or audit-sink state must *block*, not silently degrade. Low citation coverage must warn or refuse.
6. **Treat retrieved/tool/web content as data, never instructions.** Untrusted content must be unable to direct the model's outbound tool queries.
7. **The compliance audit trail is itself sensitive and discoverable.** Design it to be evidence *for* the firm, not *against* the client.
8. **Matter binding drives confidentiality; detection only escalates.** Never rely on a detector's recall to decide that content is "public/safe."

---

## 4. Disclosure-Surface & Threat Model

Every leg that can carry client text, with target posture:

| Leg | Sees | V2 status [V] | Target posture |
|---|---|---|---|
| **Anthropic inference** (`agentLoop.ts`) | full prompt/context | direct API ✓ | ZDR org (verify) + Opus only; primary control |
| **Anthropic `web_search`** | model-built query | **unconditional** (Gap A) | policy-gated; off in protected; sanitized public-law only in confidential |
| **OpenAI embeddings** (`cebSearch.ts`) | query text | native API, no ZDR | OpenAI ZDR + DPA (confidential); local embeddings (protected) |
| **Upstash Vector** | query vector; CEB **public** text as metadata | REST | non-restricted only; opaque-ID metadata; self-host for protected |
| **Upstash Redis** (`sessionStore.ts`) | **raw conversation** | persisted | matter-scoped + encrypted + retention-bounded; self-host for protected |
| **Vercel** Blob/KV/logs | drafts, state, logs | hosting | keep client text out of logs; approved retention |
| **Browser** IndexedDB/localStorage | token maps, drafts, keys | client-side | device threat model §5.12 |
| **CourtListener/LegiScan/OpenStates** | query terms | live | identifier/public-law queries only; CourtListener POST-embedding |
| **Tool queries (any)** | whatever the model emits | — | **prompt-injection exfiltration defense §5.5** |
| **Audit trail / manifests / billing** | hashes + metadata | partial | discoverable evidence — §5.9 governance |
| **Legacy OpenRouter routes** | full text | **still present** (Gap, §8) | remove/lock down — P0/P1 |

**Adversary model includes:** an attacker-controlled **discovery document, web page, or retrieved case** that instructs the model to embed client facts in an outbound `web_search`/`ceb_search`/CourtListener query (indirect prompt injection → exfiltration); a **lost/shared/compromised attorney device** (IndexedDB token map + local drafts/keys); and **opposing counsel in discovery** seeking the chatbot's audit/billing/tool-call records.

---

## 5. Architecture & Requirements

### 5.1 Matter model (user-facing simplicity, rich policy underneath)
- **User-facing modes: `Public research` vs `Matter workspace`.** Attaching a matter (or entering client facts) puts the session in **Matter workspace = confidential by default**.
- **`protected_discovery` is a locked matter-policy flag, NOT a casual chat mode** — set at the matter level by an authorized attorney, because the dangerous failure is accidental *downgrade*. Downgrades require attorney confirmation + logged reason; protected→lower is blocked.
- Under the hood, retain the three policy states (`public_research` / `client_confidential` / `protected_discovery`) and rich fields: `data_classes`, `client_consent`, `protective_order`, `provider_allowlist`, `tool_allowlist`, `retention_policy`, `jurisdictions`, `court_context`.
- **FR-5.1.** Matter binding is the primary driver of confidentiality. Detection may only *escalate* mode and runs as a **pre-flight gate before any external call on the turn**; it may never be the sole basis for treating content as public/safe. (Resolves vetting F5 + GPT.)

### 5.2 Central policy engine (server is authoritative)
- **FR-5.2.** Add `api/_lib/compliance/policyEngine.ts`. Every outbound model/embedding/search/retrieval/verifier call, export, copy, print, and future agentic action passes through it. Inputs: matter metadata, consent, protective-order policy, provider-registry snapshot, client sanitization attestation, server backstop detection, requested action, user role. Outputs: allowed providers, allowed/blocked tools+reasons, required disclosures, required review gates, required evidence sinks, provider-manifest skeleton. **Browser decisions are preview/UX only; a missing/stale browser attestation can force fail-closed but never grants permission.**

### 5.3 Mode → control matrix (canonical)

| Control | `public_research` | `client_confidential` | `protected_discovery` |
|---|---|---|---|
| Direct Anthropic (ZDR, Opus) | allowed | allowed after ZDR verified + consent | only if counsel approves Anthropic ZDR for protected data; else **local-only/blocked** |
| OPF tokenization | off unless facts detected | **light/optional for the Anthropic leg**; strict for non-Anthropic legs + high-risk categories | strict / matter-policy controlled |
| `web_search` | allowed | **off** when client facts present unless lawyer-approved sanitized public-law query | **blocked** |
| OpenAI embeddings / `ceb_search` | public-law queries only | guarded query + **OpenAI ZDR+DPA**; no client-fact queries | **local embeddings + self-hosted index**, or blocked |
| Upstash Vector/Redis | ok (public) | **non-restricted only**, encrypted, matter-scoped, retention-bounded | **self-hosted store** (pgvector/sqlite) — Upstash forbidden for Restricted Data (V12) |
| MCP / Files / Batch / CodeExec | avoid unless approved | **blocked** | **blocked** |
| Export / copy / send / file | allowed (public) | review gate | review gate + attestation + (filing) citation+disclosure check |
| Audit/manifest | best-effort ok | required | **WORM/hash-chained; fail-closed** |

### 5.4 Provider registry (evidence + privilege classification)
- **FR-5.4.** `config/provider-registry/*.json` + `api/_lib/compliance/providerRegistry.ts`. Per provider/service: data classes allowed, matter modes allowed, retention, no-training status, **ZDR/equivalent status**, subprocessor chain + region, deletion rights, **privilege/work-product disclosure classification (§7)**, evidence provenance (contract clause / DPA section / ToS URL+date / counsel memo — **marketing claims are insufficient**), owner, review + expiry dates. Stale/missing/marketing-only evidence ⇒ provider disallowed for confidential/protected.
- **FR-5.4a.** Encode the **Upstash Restricted-Data ceiling** (V12): hard-block CCPA-sensitive/PHI/SSN/financial classes from Upstash regardless of evidence; record **SOC 2/HIPAA = Redis-only, not Vector**; record that **encryption at-rest/in-transit is opt-in** (must be verified ON). (Resolves vetting F2.)
- **FR-5.4b.** Add the **OpenAI-ZDR+DPA** entry as the `client_confidential` embeddings remedy (V11). (Resolves vetting F4.)
- **FR-5.4c.** CI test fails the build on any stale/evidence-less registry entry used by a confidential/protected route.

### 5.5 Tool-query gating + indirect-prompt-injection exfiltration defense (NEW — GPT)
- **FR-5.5.** A `toolQueryGuard` inspects the **exact** outbound query before every external tool call; blocks queries containing client names, client-tied dates, nonpublic facts, strategy, or protected material (per matter mode).
- **FR-5.5a.** **Untrusted content cannot drive outbound queries.** Retrieved case text, web pages, and uploaded discovery documents are treated as data, not instructions. Outbound tool-query terms must derive from the user's request / matter-approved terms, not from free-form model text seeded by retrieved content. Add provenance checks so a query whose terms originate in untrusted retrieved content is blocked or routed to human review.
- **FR-5.5b.** **Egress allowlist** (per Managed-Agents plan): Vercel function fetch restricted to `api.anthropic.com`, `api.openai.com`, `*.upstash.io`, `courtlistener.com`, `openstates.org`, `legiscan.com`; block all others by default. In `protected_discovery`, external tool queries require attorney review before execution.

### 5.6 Sanitization's new role
- Sanitization shifts from "mask everything before Claude" to **detect → classify data class → route → contain**: matter-mode classifier, guard before public/non-ZDR tools, protected-discovery containment, log/session minimization, audit signal.
- **FR-5.6.** Use **strict** detection for all non-Anthropic and protected outbound calls; pass-through allowed only in `public_research` after a deterministic no-client-facts check. Browser emits a signed attestation (detector/OPF version, strict/best-effort, real/pass-through, detected categories, high-risk span counts, original+sanitized hashes, allowlist decisions, timestamp); server combines it with a backstop check and **fails closed** if missing/stale/inconsistent/degraded.
- **FR-5.6a.** Treat detector **recall** as safety-critical (false negative ⇒ mis-route ⇒ leak); red-team for missed entities; keep a logged false-positive override path for `client_confidential` (never unlocking protected/disallowed providers) with a monitored false-positive budget.

### 5.7 Storage, isolation & retention
- **FR-5.7.** **ZDR-driven OPF relaxation for `client_confidential` is contingent** on the firm's own stores being approved + encrypted + matter-scoped + retention-bounded — otherwise relaxation merely moves raw facts from Anthropic (ZDR-safe) into Upstash/Vercel/IndexedDB (not ZDR). (Resolves vetting F3.)
- **FR-5.7a.** **Protected-discovery storage = firm-controlled** (local SQLite/sqlite-vec or Postgres/pgvector) for conversation, audit, and vectors; **local embeddings** (BGE-M3 / Qwen3) over a firm-controlled index (one-time re-embed of the 77,406 CEB vectors — OpenAI 1536-dim vectors are not interchangeable). See `PRD_MORGAN_PROTECTIVE_ORDER_COMPLIANCE.md` for WORM/hash-chain/token-map detail.
- **FR-5.7b.** **The CEB corpus is public content** — it needs no migration for confidentiality; the exposure is client-fact-bearing **queries** and **client document embeddings**, not the CEB text. Do not over-invest in migrating public data. (Resolves vetting F9.)
- **FR-5.7c.** Matter-scoped isolation across session state, retrieval context, caches, token maps, manifests, exports; cross-matter retrieval blocked unless an authorized attorney links matters with a conflict/joint-representation record. Retention/deletion enforced with litigation-hold exceptions.

### 5.8 Model & feature allowlist (P0)
- **FR-5.8.** Set `V2_PRIMARY_MODEL` and `V2_FALLBACK_MODEL` to a counsel-approved **ZDR-eligible Opus** (e.g., `claude-opus-4-8`); **remove the `claude-fable-5` default** in `agentLoop.ts:57`. Durable reason: Fable is **non-ZDR (30-day retention)** (V9); added urgency: it is **currently suspended** (V10). Add a `zdr_eligible_models` allowlist + a **runtime ZDR-eligibility assertion** that fails closed before any confidential/protected Anthropic call; block non-ZDR features (Files/Batch/CodeExec/Programmatic-tools/MCP). Confirm prompt-cache ZDR status (V13). (Resolves vetting F1 + GPT correction: anchor on retention, not suspension.)

### 5.9 Audit, compliance pack & discoverability (NEW emphasis — GPT)
- **FR-5.9.** Per-turn manifest (matter id+mode, consent version, protective-order version, provider snapshot, model id, tool set + actual calls + external calls, sanitization-attestation hashes, prompt/tool/policy versions, citation-verification status, lawyer-review status). Store **hashes + structured metadata, never raw client text.**
- **FR-5.9a. The audit trail is a discoverable evidence target.** Before building it, decide per artifact: hash-only vs metadata vs content; privilege/work-product labeling; retention period; redaction/production-readiness. Avoid creating a "giant evidence target" usable against the firm or client. Counsel signs off on the manifest schema.
- **FR-5.9b.** For `protected_discovery`: append-only/WORM or hash-chained tamper-evident storage with periodic external root-hash anchoring; **audit-sink unavailable ⇒ block the turn.**

### 5.10 Disclosure, consent & attestation
- **FR-5.10.** Replace localStorage attestation with **server-side, versioned, matter-level** records: split (a) attorney AI-policy acknowledgment, (b) client AI-use consent (`not_obtained|allowed|restricted|prohibited|revoked`), (c) matter restrictions, (d) provider/tool disclosure. Client restrictions override defaults; re-prompt on material provider/tool/model change; protected mode inaccessible until required attestations present.
- **FR-5.10a.** Disclosure copy (counsel-approved; REVISED 2026-07-01 — no ZDR): "uses Anthropic's commercial Claude API under F&F's account; Anthropic does not train on prompts or responses and deletes on request under its Data Processing Agreement; API content is retained by Anthropic for up to 30 days (longer for content flagged for safety review); client-identifying details are tokenized on-device before transmission; other providers used for search/embeddings/auth/hosting/storage are governed separately; public web search and third-party retrieval are disabled/restricted when client-confidential/protected material is present." **Never** say "nothing is ever stored," "zero data retention," "protected discovery is automatically safe," or that sanitization is unnecessary.

### 5.11 Review gates & agentic boundary
- **FR-5.11.** Review gates for copy/print/export/client-send/filing-export; capture reviewer, role, timestamp, checklist version, unresolved issues. Filing export requires citation + quote/pincite verification + **local-court AI-disclosure checklist** (judge-by-judge — V3) and **blocks on unresolved/fake citations**.
- **FR-5.11a.** `AgenticActionPolicy`: **blocked in V1** — e-filing, sending email/discovery/client advice, transferring files to third-party systems, DMS mutation, calendaring deadlines, settlement recommendations, intake accept/reject, credibility scoring. No external-effect tool may be registered without policy metadata + review gate. AI output is provisional until lawyer review.

### 5.12 Local-device threat model (NEW — GPT)
- **FR-5.12.** Browser holds token maps (IndexedDB) and possibly drafts/keys. Add: strict **CSP** + XSS hardening; **session timeout** + re-auth; **passphrase/OS-disk-encryption-attested** protection of the IndexedDB token map (per Morgan PRD token-map-at-rest decision); **remote-wipe / session-revocation**; and in `protected_discovery`, a hard gate on token-map at-rest protection before any external call.

### 5.13 Conflicts & ethical walls (NEW — GPT)
- **FR-5.13.** Matter isolation ≠ conflicts clearance. Capture party/adversary/related-counsel metadata and former-client restrictions; enforce **conflict-aware cross-matter retrieval bans** and **staff role limits** (ethical walls); record cross-matter link approvals with basis. (The firm's practice-management system remains the system of record for conflicts; the chatbot must not breach a wall.)

### 5.14 Billing metadata
- **FR-5.14.** Track attorney-review time, staff time, AI runtime/cost, provider pass-through separately. **AI subscription/infra = non-billable overhead by default;** matter-specific third-party charges only with disclosure and **no markup absent informed written consent**. Export a billing-support ledger (chatbot is not the invoice system of record). Treat billing records as discoverable (§5.9a).

### 5.15 Bias & discrimination controls
- **FR-5.15.** Deterministic refusal rules + review gates for intake prioritization, case valuation, employment/housing/immigration/family/criminal, disability/medical, credibility, settlement posture, and protected-class facts; block autonomous protected-class-sensitive decisions; defer any automated bias classifier until separately validated. Multi-agent flows must not compound bias.

---

## 6. COPRAC Obligation → Control Traceability

| Duty (rule) | Control(s) |
|---|---|
| Competence/diligence (1.1, 1.3) | §5.4 manifest, §5.8 model registry + periodic reassessment, §5.11 review |
| Confidentiality (§6068(e); 1.6, 1.8.2) | §5.2–5.7 policy engine, ZDR, Upstash ceiling, storage hardening, §7 privilege |
| Comply w/ law + protective orders (§6068(a); 8.4, 1.2.1) | §5.7a protected-discovery, Morgan PRD, §5.13 |
| Supervision (5.1–5.3) | §5.10 attorney policy ack, §5.13 role limits, §5.11 review, §5.2 logs |
| Communication/consent (1.2, 1.4; 1.0.1(e)) | §5.10 consent + restrictions |
| Candor (3.1, 3.3) | §5.11 citation verification, filing gate, no autonomous filing |
| Fees (1.5; §§6147–6148) | §5.14 |
| Anti-discrimination (8.4.1) | §5.15 |
| Other jurisdictions (8.5) | §5.1 jurisdictions field, §5.11 local-court checklist |
| Agentic AI (cross-cutting) | §5.11a boundary, §4 threat model, §5.5 exfiltration defense |

---

## 7. Privilege & Discoverability Governance (NEW — GPT's headline gap)

Neither retention nor ZDR answers the **privilege/work-product** question. Produce a counsel-authored memo, encoded into the provider registry, classifying for each provider/tool class:
- Whether disclosure to that provider (Anthropic/OpenAI/Upstash/Vercel/Clerk/CourtListener/etc.) is a confidentiality-preserving **agent/vendor disclosure** (no waiver) vs a potential **privilege-waiver risk**, and under what terms (DPA confidentiality, sub-processor flow-down, US-only processing).
- The **work-product** status of AI-generated drafts and of the **audit/manifest/billing artifacts** themselves, and whether/when they are producible in discovery.
- Triggers and owners for **breach/incident notification** (provider breach timelines, protective-order notice duties, client-notification triggers, CA Civ. Code §1798.82, subprocessor-change ownership).
- **Data residency**: where a client, protective order, or insurer requires US-only/approved-region processing, force it in the provider registry.

This section is a Phase-0 counsel deliverable; product encodes the result as registry policy.

---

## 8. Legacy Surface Lockdown (P0/P1)
Legacy routes still present in V2 — `api/gemini-chat.ts`, `api/claude-chat.ts`, `api/orchestrate-document.ts` (OpenRouter, **not ZDR, bypass the policy engine**) and `api/export-document.ts` (**unauthenticated + wildcard CORS**) — are complete bypasses of this architecture. **FR-8:** inventory every route that accepts/returns legal text; put behind shared auth/CORS/rate-limit guards + the policy engine; remove or hard-disable OpenRouter/Gemini/legacy paths for confidential/protected use; add a CI route-surface test that fails when a new legal-text route lacks policy metadata. (Resolves vetting F8.)

---

## 9. Phased Rollout

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 — Verify & decide** | §13 verification checklist; §7 counsel privilege/residency/breach decisions; Phase-0 matrix from COPRAC plan | Counsel-approved taxonomy, provider eligibility, protected-mode launch posture (local-only vs ZDR-approved) |
| **P1 — Stop the bleeding** | §5.8 Fable→Opus + ZDR assertion; §8 legacy-route lockdown; egress allowlist (§5.5b) | No non-ZDR model default; no legal text reaches OpenRouter/unauth routes |
| **P2 — Policy engine + matter model** | §5.1, §5.2, §5.3; matter binding drives mode | Protected session persists server-side; downgrade blocked; public→matter escalation pre-flight |
| **P3 — Tool gating + exfiltration defense** | §5.5, §5.5a/b; policy-based `buildToolsForPolicy` | web_search off in protected; injected-query exfiltration blocked in tests |
| **P4 — Provider registry + manifests + audit governance** | §5.4, §5.9 | Stale evidence blocks protected; manifest hashes-only; counsel-approved schema |
| **P5 — Storage hardening + protected-discovery store** | §5.7, §5.7a; self-host + local embeddings | A Restricted-Data matter runs with no client text leaving firm infra |
| **P6 — Consent/attestation + review gates + device + conflicts** | §5.10, §5.11, §5.12, §5.13 | Protected mode gated on attestations + token-map protection; filing gate blocks bad citations |
| **P7 — Billing, bias, governance/recertification** | §5.14, §5.15, quarterly provider/model/detector review | Governance state exportable for counsel |

---

## 10. Decisions Required (counsel + product)
1. **Protected-discovery posture:** launch **local-only** until provider evidence complete, or enable Anthropic-ZDR-for-protected with counsel sign-off (mind ZDR≠deletion, V6).
2. **Privilege-waiver / residency / breach memo** (§7) — counsel.
3. **Matter abstraction confirmation:** "Public research / Matter workspace + locked protected flag" (recommended) vs explicit 3-mode selector.
4. **Standard-mode vector store:** hardened Upstash (non-restricted) vs self-host everywhere.
5. **Protected embeddings:** local model vs OpenAI-ZDR.
6. **Token-map at-rest** protection option (passphrase / disk-attestation / no-server-map) — Morgan PRD M0.5.
7. **Audit-artifact discoverability/retention** schema (§5.9a) — counsel.
8. **Billing** pass-through + disclosure text.

---

## 11. Risks & Mitigations
- **"We have ZDR" false confidence** → §13 verification + §5.8 runtime assertion; ZDR is inert until traffic is direct on the right org.
- **Indirect prompt-injection exfiltration** → §5.5a untrusted-content-as-data + provenance checks + egress allowlist + protected-mode query review.
- **Restricted data into Upstash** → §5.4a hard block + §5.7a self-host.
- **Tokenization relaxation leaks into own stores** → §5.7 contingency.
- **Detector false-negative mis-routes** → §5.1 matter binding primary; §5.6a recall red-team.
- **Model churn/suspension** (Fable, V10) → §5.8 allowlist + same-vendor fallback + recertification.
- **Audit trail used against client** → §5.9a governance.
- **Stolen attorney device** → §5.12.
- **Pending rules become binding / SB 574 passes** → design already satisfies; governance watch-item.

---

## 12. Acceptance Criteria
- Network audit: **zero** client-text egress to OpenRouter or any non-allowlisted endpoint.
- A Restricted-Data matter completes with **no client text** leaving firm infra (verified by manifest).
- An injected "exfiltrate via search" attack is **blocked** in tests.
- No default/fallback can select a model outside the counsel-approved allowlist (`approvedModels.ts`); protected/confidential calls fail closed otherwise.
- No code path can autonomously send/file/transmit.
- Every court-bound output has verified citations or a prominent unverifiable-citation block.
- Firm holds date-stamped Commercial-Terms/DPA/registry evidence (§13, as revised by the 2026-07-01 addendum) and a counsel privilege memo (§7).
- Audit manifests contain hashes/metadata only, with a counsel-approved discoverability posture.

## 13. P0 Verification Checklist (confirm before relying — [P] items)
1. Production `ANTHROPIC_API_KEY` belongs to the **ZDR-enabled org/workspace** (Console → Privacy Controls); written confirmation retained.
2. `V2_PRIMARY_MODEL`/`FALLBACK` set to ZDR-eligible Opus; `claude-fable-5` default removed.
3. OpenAI **ZDR approved + DPA signed** for the embeddings org.
4. Upstash: confirm **TLS + AES-256 + US region** enabled; audit exactly what is written to Vector metadata + Redis session values (any cleartext client facts?); confirm Restricted-Data classes are not stored there.
5. Legacy OpenRouter + unauthenticated export routes removed/locked.
6. Prompt-cache (and tool-schema caching) ZDR status confirmed for the org (V13).
7. SB 574 + CA rule-amendment status refreshed on the counsel-review date.
8. Subprocessor/region/breach-notice terms gathered for Anthropic, OpenAI, Upstash, Vercel, Clerk (§7).

## 14. Sources & Confidence
Primary: CA Bar 2026 guidance PDF (calbar.ca.gov); Anthropic API & data-retention docs + ZDR articles + fable-mythos-access notice; OpenAI data-controls docs; Upstash DPA §12.4 + Security Measures + compliance FAQ; CourtListener API docs; leginfo SB 574; courts.ca.gov Rule 10.430 / Standard 10.80. Internal: the five V2 docs cited in the header; independent vetting (VETTING_ANALYSIS.md); GPT-5.5 adversarial review (gpt-response.md). Confidence tags [V]/[P]/[U] as marked; all [P] items gated in §13.
