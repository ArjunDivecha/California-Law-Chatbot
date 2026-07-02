<!--
=============================================================================
DOCUMENT: V3_PRD_Compliance_Rearchitecture.md
=============================================================================
WHAT THIS DOCUMENT IS:
  Product Requirements Document (PRD) for V3 of the California Law Chatbot.
  V3 re-architects the application's DATA PLANE and AGENTIC controls so that
  client confidentiality is enforced by contract + direct provider endpoints +
  storage controls (rather than by hoping users self-anonymize), and so the
  product conforms to the State Bar of California's 2026 COPRAC "Practical
  Guidance for the Use of Generative AI in the Practice of Law." It is written
  for a 2-lawyer California firm (Femme & Femme) that has acquired an enterprise
  Claude account with Zero Data Retention (ZDR).

  This is a PLAN document. No code is changed by this file. Implementation is
  gated on the "Decisions Required" section (§12).

INPUT SOURCES (full absolute paths / URLs):
  - CA Bar 2026 guidance (verified primary source, saved locally):
    /Users/arjundivecha/.claude/projects/-Users-arjundivecha-Dropbox-AAA-Backup-A-Working-California-Law-Chatbot/a2c82ec7-cc9d-458d-bc75-ff8e71f0ae69/tool-results/webfetch-1782261212533-mcuaa5.pdf
    (canonical: https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf)
  - Verified vendor data-posture research (this session, 4 deep-research agents): see §15 Sources.
  - Current codebase map (this session, Explore agent): repo at
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/
  - Existing repo docs: COMPLIANCE_ANALYSIS.md, PRIVACY_AND_CONFIDENTIALITY.md,
    GEMINI_API_REVIEW.md, ENV_SETUP.md, README.md, F&F_Meeting_Memo_2026-04-24.md

OUTPUT FILE (full absolute path):
  - /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/V3_PRD_Compliance_Rearchitecture.md  (this file)

VERSION: 0.1 (DRAFT for review)
LAST UPDATED: 2026-06-23
AUTHOR: Drafted by Claude Code for Arjun Divecha / Femme & Femme

NOTE ON FACTS: Every external fact below is tagged [V]=verified against a
primary source, [P]=partially verified, or [U]=unverified/assumption. Per the
project's "FAIL IS FAIL" rule, design decisions that depend on [P]/[U] facts
are flagged for confirmation in §12.
=============================================================================
-->

# California Law Chatbot — V3 PRD
## Compliance-First Data Posture & Agentic Guardrails

**Status:** DRAFT v0.1 for review · **Date:** 2026-06-23 · **Owner:** Femme & Femme

---

## 1. Executive Summary

V3 is not a feature release. It is a **data-plane and governance re-architecture** triggered by two June-2026 developments:

1. **The State Bar of California published a new (2026) COPRAC Practical Guidance** on generative AI [V], approved by the Board of Trustees on **2026-05-14** [V], which *replaces* the November-2023 version and — at the **2026-08-22 direction of the California Supreme Court** [V] — adds substantial obligations for **agentic AI**. Six related **Rules of Professional Conduct amendments are pending** [V] and, if adopted, become *binding and disciplinary*.
2. **Femme & Femme acquired an enterprise Claude account with Zero Data Retention (ZDR).** The firm's working assumption was that this "makes a lot of the sanitization moot."

That assumption is **half right, and the half that's wrong is dangerous.** Two verified facts reshape everything:

- **The enterprise ZDR contract covers nothing in today's pipeline.** The app routes *all* LLM calls through OpenRouter. Anthropic explicitly states that **third-party integrations are not ZDR-eligible** [V], and OpenRouter's own ZDR mode **removes first-party Anthropic endpoints and reroutes Claude through Bedrock/Vertex** [V] — so a *direct* Anthropic ZDR contract never attaches to OpenRouter traffic. ZDR is a contract with `api.anthropic.com`, not a property of the word "Claude."
- **ZDR on the LLM does not make the *pipeline* confidential.** The same client query is also sent to **Google Gemini** (generator, via OpenRouter), to **OpenAI** (query embeddings), and to **Upstash Vector** — none of which an Anthropic contract touches. The Upstash leg is the worst: Upstash's DPA **contractually prohibits storing "Restricted Data"** (CCPA-sensitive info, PHI, SSNs, financial credentials) [V], and SOC 2 / HIPAA cover its *Redis* product, **not Vector** [V].

**V3's thesis:** make confidentiality a property of the *architecture*, not of user discipline.

- Replace the OpenRouter LLM path with **direct, contracted, ZDR/no-train provider endpoints**, leveraging the enterprise Claude account the firm already paid for.
- Introduce **two operating tiers** — a **Standard mode** (all-cloud, ZDR/no-train, for ordinary research) and a **Protected-Matter mode** (self-hosted vector store + local embeddings + tool-gating, for matters containing Restricted Data or heightened privilege).
- Reframe the parked **sanitization/PII-tokenization** layer from a *load-bearing control* to *optional defense-in-depth* — which is exactly the firm's intuition, now made precise and safe.
- Add the **client-facing disclosure/consent, verification, supervision, billing, and agentic guardrail** features the 2026 guidance requires — most of which the product does not have today.
- Bring the agentic "**Drafting Magic**" roadmap into conformance with the guidance's **hard prohibitions** on autonomous filing/transmission.

The net effect: the firm can truthfully represent to clients and to a court that confidential information is protected by enforceable contracts and architecture, the lawyer's independent judgment is never delegated, and no AI system acts autonomously in a representative capacity.

---

## 2. Background & Legal Landscape (verified)

| Item | Status as of 2026-06-23 | Binding on the firm? | Source |
|---|---|---|---|
| **2026 COPRAC Practical Guidance** (replaces Nov-2023) | Approved by Board of Trustees **2026-05-14** [V] | **Advisory** — but interprets binding rules (1.1, 1.3, 1.4, 1.5, 1.6, 1.8.2, 3.1, 3.3, 5.1–5.3, 8.4, 8.4.1, 8.5, 1.2.1; B&P §6068(a),(e), §§6147–6148) [V] | calbar.ca.gov |
| **CA Supreme Court directive** to address agentic AI + consider folding guidance into the Rules | Letter dated **2025-08-22** [V] (full text not independently retrieved [P]) | Drives the rulemaking below | calbar.ca.gov / LawNext |
| **Six proposed Rule amendments** (Rules 1.1, 1.4, 1.6, 3.3, 5.1, 5.3) | COPRAC approved **2026-03-13**; comment closed **2026-05-04**; **NOT yet adopted** [V] | **Would be binding/disciplinary if adopted** — design proactively | calbar.ca.gov / LawNext |
| **CA Rule of Court 10.430** + **Standard 10.80** (GenAI use policies) | Effective **2025-09-01** [V] | **No** — binds courts, court staff, judicial officers, **not attorneys/litigants** [V] | courts.ca.gov |
| **SB 574** (would require attorneys to keep confidential info out of public AI, verify AI output, disclose/verify AI citations) | **Pending**; last action **2026-06-22**; hearing 2026-06-30; **not law** [V] | **Not yet** — watch item; V3 should satisfy it pre-emptively | leginfo.legislature.ca.gov |
| **Individual judges' AI standing orders** | Case-by-case patchwork (some N.D. Cal. judges require disclosure) [P] | Per assigned judge | Ropes & Gray tracker |

**The two confidentiality sentences that govern V3** (2026 guidance, p.5–6) [V]:

> "a lawyer **must not input any confidential information of the client into a generative AI solution that may present material risks to confidentiality or security, absent informed client consent** (see rule 1.0.1(e))."

> "Reasonable efforts **require more than reliance on generalized marketing assurances** … reviewing terms of use, privacy policies, or vendor documentation … [and may include] consulting with qualified IT professionals or cybersecurity experts to ensure that any AI system … adheres to **reasonable security, confidentiality, and data retention protocols**."

And the agentic prohibitions (p.6, p.9) [V]:

> "A lawyer must not deploy an agentic AI system in a manner that permits **autonomous external transmission of client information** … without appropriate safeguards and human review."

> "Lawyers must not permit AI systems to **autonomously file documents, communicate with the court, or make representations** on the lawyer's behalf."

---

## 3. Current State (V2) Assessment — Data Posture Matrix

Per the codebase map (current `main` branch). Every external leg that can receive client-confidential text:

| # | Leg | What it sees | Current routing | Realized data posture **today** | Gap |
|---|---|---|---|---|---|
| L1 | **Generator** | Full query + context | OpenRouter → `google/gemini-3.1-pro-preview` (fallback `gemini-2.5-pro`) [V] | OpenRouter terms govern; **§16 disclaims all warranty** on downstream handling [V]; Gemini model is **preview** [V] | No direct contract; preview model; ZDR not enforced |
| L2 | **Verifier** | Full query + draft + sources | OpenRouter → `anthropic/claude-sonnet-4-6` [V] | **Enterprise ZDR does NOT apply** (third-party route) [V] | The firm's ZDR asset is unused here |
| L3 | **Research agent** | Query + sources | OpenRouter → Claude Haiku [V] | Same as L2 | Same |
| L4 | **Query embeddings** | Raw query text | **Native OpenAI API**, `text-embedding-3-small` [V] | No training [V]; **30-day default retention** (no ZDR) [V] | ZDR + DPA not yet in place |
| L5 | **Vector store** | Query *vector*; **CEB reference text as metadata** | Upstash Vector REST [V] | DPA **prohibits Restricted Data** [V]; SOC 2/HIPAA = Redis only [V]; encryption **opt-in** [V]; metadata **cleartext** [V] | Hard contractual + security gap for *client* content |
| L6 | **Case law** | Query string (may embed client facts) | CourtListener GET [V] | ~90-day usage logs [V]; **POST-embedding path avoids sending raw query** [V] | Raw query leaves on GET path |
| L7 | **Legislative** | Query terms | OpenStates / LegiScan [V] | Bill/citation lookups — low risk [P] | Low; template to identifiers |

**Other current-state facts that matter for V3** [V]:
- **No sanitization on `main`.** `services/sanitization/*` exists only on parked `codex/*` branches. Today the app relies entirely on **user self-anonymization** + README warnings.
- **`api/anthropic-chat.ts` already exists** (native Anthropic SDK, `claude-sonnet-4-6`) but is **not wired into the main flow** — a ready-made starting point for direct routing.
- **Verification is not fail-closed**: coverage < 50% still returns the answer with a caveat. The pending Rule 1.1/3.3 amendments push toward stronger verification.
- **Confidentiality UI is effectively absent**: warnings live in README only — no first-run modal, no consent checkbox, no in-app anonymization guidance, no "this sends data to [vendor]" disclosure.
- **`COMPLIANCE_ANALYSIS.md` is stale** — written ~Dec 2024 against the 2023-era guidance. Must be rewritten against the 2026 guidance.
- **Parked work**: `codex/bedrock-confidentiality-migration`, `codex/drafting-magic`, `codex/drafting-magic-sanitized`, `codex/privacy-filter-prd-run`; archive tags dated 2026-05-03. The Bedrock rationale is **weakened** by the enterprise ZDR acquisition (see §6.1).

---

## 4. Goals & Non-Goals

### Goals
- **G1.** Every leg that can receive client-confidential text operates under an **enforceable no-training + zero/short-retention** posture backed by a signed agreement — or that text never reaches it.
- **G2.** Realize the enterprise Claude **ZDR** the firm already owns by routing Claude **directly** to `api.anthropic.com` under the ZDR-enabled org.
- **G3.** Implement the 2026 guidance's affirmative duties in-product: **disclosure/consent, verification/candor, supervision, billing transparency, anti-bias, agentic supervision**.
- **G4.** Provide a **Protected-Matter mode** that keeps Restricted-Data matters inside firm-controlled infrastructure.
- **G5.** Demote sanitization to **optional defense-in-depth**, documented as such.
- **G6.** Produce a **defensible compliance record** (retained vendor agreements, firm AI policy, per-response audit trail) sufficient for a malpractice/privilege inquiry.

### Non-Goals
- **NG1.** Not building toward **autonomous** filing, sending, or client communication — the guidance prohibits it [V]; V3 is human-in-the-loop by design.
- **NG2.** Not pursuing the **AWS Bedrock migration** as a necessity (see §6.1 — it becomes an optional alternative, not the plan).
- **NG3.** Not pursuing **Anthropic Managed Agents** — explicitly **not ZDR-eligible** [V] and previously rejected by the firm for product/privilege reasons (see memory `feedback_no_managed_agents`).
- **NG4.** Not a HIPAA project — a law firm handles no PHI as a covered entity; a BAA is unnecessary (and unavailable on standard PAYG). The **DPA** is the relevant instrument [V].
- **NG5.** Not changing the CEB *reference* corpus storage solely for compliance — CEB practice guides are **published, non-confidential** content (the exposure is the *query* and *client documents*, not the CEB text).

---

## 5. Guiding Principles (derived from the 2026 guidance + firm rules)

1. **The lawyer, not the tool, retains judgment.** "A lawyer's professional judgment cannot be delegated to AI." [V] Every output is a draft for attorney review.
2. **Reasonable efforts beat marketing claims.** Posture is proven by **retained contracts and configuration evidence**, not vendor homepages. [V]
3. **Confidentiality by architecture.** Default to *not sending* Restricted Data to third parties at all; where data is sent, it is under contract + ZDR/no-train.
4. **Defense in depth.** Contracts (primary) + storage controls + optional tokenization (secondary) + audit (tertiary). No single control is load-bearing.
5. **Fail closed on confidentiality; fail loud on accuracy.** A misconfigured ZDR/region/encryption state must **block**, not silently degrade (per "FAIL IS FAIL"). Low verification coverage must visibly warn or refuse.
6. **No autonomy across a trust boundary.** No automated external transmission, filing, or client communication without an explicit human gate. [V]

---

## 6. The V3 Compliance Architecture

### 6.1 Data-plane redesign — direct, contracted endpoints

**Decision driver:** routing through OpenRouter forfeits the firm's own provider contracts and substitutes a vendor whose terms *disclaim* data-handling warranties [V]. V3 eliminates the intermediary for any leg carrying client text.

| Leg | V3 target | Why | Confidence |
|---|---|---|---|
| **LLM (generator + verifier + research)** | **Direct `api.anthropic.com`** under the firm's **ZDR-enabled Commercial org key** | Activates the ZDR asset the firm bought; single contracted counterparty; DPA auto-incorporated [V] | [V] mechanism; [P] that the firm's specific org has ZDR enabled — **verify in Console** |
| **Models** | `claude-opus-4-8` (generate/accuracy), `claude-sonnet-4-6` (generate/speed + verify), `claude-haiku-4-5` (research/claim-check) — **all ZDR-eligible** [V] | **`claude-fable-5` is EXCLUDED**: suspended for all customers since 2026-06-12 **and** non-ZDR-eligible [V] (this consciously overrides the global "default to Fable 5" instruction, because ZDR is mandatory here) | [V] |
| **Query embeddings** | **OpenAI native API with ZDR enabled + signed DPA** (`/v1/embeddings` is ZDR-eligible [V]); **or** local embedding model in Protected mode | Fixable in place; no training already [V]; ZDR removes 30-day retention [V] | [V] |
| **Vector store (client/query data)** | **Standard mode:** hardened Upstash for *non-Restricted* data only. **Protected mode:** self-hosted (pgvector / Qdrant / LanceDB) in firm infra | Upstash DPA **forbids Restricted Data** [V]; Vector not SOC 2/HIPAA-scoped [V] | [V] |
| **Vector store (CEB reference)** | Keep on Upstash | Published, non-confidential content (no client data) | [V] |
| **Case law** | **CourtListener POST-embedding path** for queries that may carry client facts | Raw query never transmitted [V] | [V] |
| **Legislative** | Template queries to **bill/citation identifiers**, not free-text client facts | Minimizes incidental disclosure | [P] |

**LLM consolidation decision (Decision #1 in §12).** Two viable shapes:

- **Option A (Recommended): Consolidate the LLM legs on direct Anthropic Claude.** Generator + verifier + research all on Claude under the enterprise ZDR org. *Pros:* one contracted vendor, full ZDR/DPA privity, eliminates OpenRouter and the Gemini-via-OpenRouter gap in a single move, uses the asset already paid for, operationally simplest for a 2-lawyer firm. *Con:* the two-pass verification becomes intra-vendor. **Mitigation:** the verifier's value here is **retrieval-grounded claim-checking** (does each claim trace to CEB/case text?), not mere self-consistency — so a *different Claude tier with an adversarial verify prompt* preserves most of the benefit. Keep generator=Opus 4.8 / verifier=Sonnet 4.6 (or Haiku) with a "refute each claim" instruction.
- **Option B: Keep Gemini as cross-vendor generator, but move it to Google Vertex AI.** Vertex gives contractual no-training + **CMEK + VPC-SC + data residency + ZDR-equivalent** terms [V]. *Pros:* preserves cross-vendor verification independence. *Cons:* a second enterprise contract + Google Cloud setup; **never** the free Gemini/AI-Studio tier (it trains + human-reviews) [V]; must confirm Vertex ZDR-equivalent terms are executed.

> Plain Gemini paid API (non-Vertex) is contractually acceptable on training (no-train, ~30-day abuse logs, per-project ZDR on request) [V] but weaker on enterprise controls than Vertex. **OpenRouter for client data is rejected** under Principle 2 regardless of option.

### 6.2 Two operating tiers (the core design)

**Standard mode (default).** For general legal research and matters that do **not** contain Restricted Data. All legs on contracted ZDR/no-train cloud: Claude direct (ZDR), OpenAI embeddings (ZDR+DPA), Upstash hardened (TLS + AES-256 + region-pinned + **opaque-ID-only metadata**), CourtListener POST-embedding. Sanitization = optional defense-in-depth.

**Protected-Matter mode.** For matters containing **Restricted Data** (PHI, SSNs, financial credentials, CCPA-"sensitive personal information") or where the lawyer elects heightened protection. Characteristics:
- **Self-hosted vector store** in firm-controlled infra (pgvector/Qdrant/LanceDB) — client document chunks and query vectors never reach Upstash (whose DPA forbids this data anyway [V]).
- **Local embeddings** (e.g., a self-hosted BGE-M3 / Qwen3-Embedding model) so raw client text never leaves the boundary for the embedding hop.
- **LLM still via Claude direct ZDR** (acceptable — ZDR + no-train + DPA), with an option for a fully local model for the most sensitive matters (future).
- **Tool-gating**: no external free-text search with client facts; CourtListener POST-embedding only; legislative lookups by identifier only.
- **Per-matter access scoping** and a **per-response audit manifest** (which tools ran, what left the boundary, ZDR/region state at send time).

Matter classification (which mode) is an **attorney decision**, surfaced in the UI, defaulting to Protected when Restricted-Data signals are detected.

### 6.3 Sanitization's new role — answering "is it moot?"

**Precise answer: partially, and only in Standard mode.** Once L1–L4 are under ZDR/no-train contracts, the original rationale for client-side PII tokenization (the model might *train on* or *retain* the prompt) is satisfied by contract. Therefore:
- In **Standard mode**, sanitization/tokenization becomes **optional defense-in-depth** — it reduces blast radius if a vendor is later misconfigured and strengthens the client representation, but it is **not** the control standing between the firm and Rule 1.6.
- In **Protected mode**, **isolation** (self-hosting + local embeddings + tool-gating) is the primary control; tokenization is belt-and-suspenders.
- The parked OPF/GLiNER work is therefore **not required for V3 launch**. It may be revived later as an opt-in hardening feature. (Reviving it is **not** a prerequisite — explicitly de-scoped from the critical path.)

### 6.4 Agentic guardrails for "Drafting Magic"

The 2026 guidance permits agentic drafting **only** with meaningful supervision and **no** autonomous external action [V]. V3 codifies:
- **Human-gate invariant:** no document is transmitted, filed, emailed, or sent to any external party or court by the system. The system produces a **draft for attorney review**; a human performs every send/file action.
- **Scoped access:** if Drafting Magic gains access to firm systems (documents, email, calendar), access is **per-matter, least-privilege, logged**, and configured by an attorney [V].
- **Bias control:** multi-agent flows must not compound bias; document a bias-review step for any client/candidate-screening use [V].
- **Provenance:** every drafted section records which agent/model/sources produced it (supports candor + supervision review).

### 6.5 Configuration invariants (fail-closed)

A request carrying client text **must hard-fail** (not silently downgrade) if any of these are not provably true at send time:
- Claude org key resolves to a **ZDR-enabled** org (verified via a startup/config check) [P — verify].
- OpenAI embeddings org has **ZDR** enabled (Standard mode) or local embeddings are used (Protected mode).
- Upstash connection is **TLS + region-pinned** and metadata contains **no client text** (Standard mode), or self-hosted store is used (Protected mode).
- Mode = Protected whenever Restricted-Data signals are present and the attorney has not explicitly overridden.

---

## 7. 2026 Guidance → V3 Requirements (traceability)

| Guidance duty (rule) | What it requires [V] | V3 requirement |
|---|---|---|
| **Confidentiality** (B&P §6068(e); 1.6, 1.8.2) | No confidential input to a tool posing material risk absent informed consent; reasonable efforts > marketing | §6.1 direct ZDR endpoints; §6.2 Protected mode; §10 retained contracts; FR-C consent |
| **Competence & Diligence** (1.1, 1.3) | Understand the tool; independently verify outputs; periodic reassessment | FR-V verification; FR-P model/version registry + periodic review; in-UI "verify before use" |
| **Supervision** (5.1, 5.2, 5.3) | Firm AI policy; training; subordinate independent judgment | FR-P firm AI policy doc + admin controls + activity log |
| **Communication / consent** (1.2, 1.4; 1.0.1(e)) | Consider disclosing AI use + risks/benefits; honor client AI restrictions | FR-C disclosure + consent capture + per-client AI-restriction setting |
| **Candor to tribunal** (3.1, 3.3) | Verify every output/citation; no autonomous filing; check court disclosure rules | FR-V citation verification; FR-A human-gate; FR-C "check your judge's standing order" prompt |
| **Charging / fees** (1.5; §§6147–6148) | Bill actual time; AI subscription = overhead; pass-through only at cost, disclosed, no markup w/o consent | FR-P billing-guidance note + fee-agreement template language |
| **Anti-discrimination** (8.4.1) | Guard against biased/compounded-bias outputs | FR-A bias-review step; documented policy |
| **Compliance with law** (§6068(a); 8.4, 1.2.1) | Track privacy/cross-border/IP/cyber law | §10 vendor DPAs; §12 SB 574 watch |
| **Other jurisdictions** (8.5) | Track other jurisdictions where licensed | FR-P note (CA-only assumed; confirm) |
| **Agentic AI** (cross-cutting) | Supervision scales with autonomy; no autonomous filing/transmission; scope access | §6.4 guardrails; FR-A |

---

## 8. Functional Requirements

### Data posture (FR-D)
- **FR-D1.** Route all Claude calls **directly to `api.anthropic.com`** with the firm's ZDR-enabled Commercial org key; remove OpenRouter from any client-data path. (Reuse/extend `api/anthropic-chat.ts`.)
- **FR-D2.** Restrict models to `claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`. Block `claude-fable-5` and any non-ZDR-eligible model/feature (Files API, Batch API, Managed Agents, MCP connector, code execution) on client-data paths. [V]
- **FR-D3.** Enable **ZDR + execute the DPA** for the OpenAI embeddings org (Standard mode); implement a **local embedding** path (Protected mode).
- **FR-D4.** Standard-mode Upstash: enforce **TLS + AES-256 at rest + US region pin**; store **only opaque IDs** in metadata for any client-derived vectors; **never** store client document text or query facts as Upstash metadata.
- **FR-D5.** Implement **Protected-Matter mode**: self-hosted vector store + local embeddings + tool-gating + per-matter scoping.
- **FR-D6.** Use **CourtListener POST-embedding** for any query that may carry client facts; template legislative lookups to identifiers.
- **FR-D7.** **Config-invariant guard (fail-closed):** a startup + per-request check that verifies the posture in §6.5; on failure, block the request with an actionable error (no silent fallback — requires explicit user permission per firm rules).

### Client disclosure & consent (FR-C)
- **FR-C1.** First-run + persistent **AI-use disclosure**: which models/vendors are used, that data is sent under ZDR/no-train contracts, and the residual risks.
- **FR-C2.** **Confidentiality guidance** in-app (not just README): what counts as confidential, Standard vs Protected mode, when to anonymize.
- **FR-C3.** **Consent capture** appropriate to the firm's practice (engagement-letter language in §10; optional in-app acknowledgment) per Rule 1.0.1(e).
- **FR-C4.** **Per-client AI-restriction** setting (honor clients who limit/forbid AI use). [V]
- **FR-C5.** **Court-use prompt**: when output is destined for a filing, surface "verify citations; check your assigned judge's standing order on AI disclosure." [V]

### Verification & candor (FR-V)
- **FR-V1.** Retain and strengthen two-pass verification; make the **verifier adversarial** (refute each claim against retrieved sources).
- **FR-V2.** **Citation verification** against CourtListener for any case citation before display; flag unverifiable citations prominently.
- **FR-V3.** Make verification **fail-closed for high-risk categories** (criminal, immigration, child welfare, etc.): below a coverage threshold, refuse or restrict to quoted source text rather than free generation.
- **FR-V4.** Reconsider the **CEB verification bypass**: even authoritative sources need citation-integrity checks before a court-bound use (lower priority; document the rationale either way).

### Agentic guardrails (FR-A)
- **FR-A1.** **Human-gate invariant** (NG1): the system never auto-sends/files/transmits. Enforced in code, not just policy.
- **FR-A2.** **Provenance** record per drafted section (agent, model, sources, timestamp).
- **FR-A3.** **Scoped, logged, least-privilege** access if Drafting Magic touches firm systems.
- **FR-A4.** **Bias-review** step for any screening/employment-adjacent use.

### Audit & recordkeeping (FR-R)
- **FR-R1.** **Per-response audit manifest**: mode, models, tools invoked, what data left the boundary, ZDR/region state, verification result, timestamp. Store server-side; never store raw client content beyond what the matter file requires.
- **FR-R2.** Retain **redaction/mode decisions** and config-guard outcomes.

### Firm policy & admin (FR-P)
- **FR-P1.** Ship a **written firm AI policy** template (Rules 5.1/5.3) + a model/version registry with a periodic-reassessment reminder.
- **FR-P2.** Ship **fee-agreement language** for AI cost treatment (Rule 1.5; §§6147–6148).
- **FR-P3.** Ship **engagement-letter AI-disclosure/consent language**.

---

## 9. Non-Functional Requirements
- **NFR1 (Security):** all keys server-side (already true); ZDR disables CORS on Anthropic — keep the backend-proxy pattern [V].
- **NFR2 (Latency):** direct provider endpoints should be ≤ current OpenRouter latency; local embeddings add cost in Protected mode (acceptable per the firm's "quality over wall-time" rule).
- **NFR3 (Availability):** preserve a **same-vendor** fallback model (e.g., Opus→Sonnet) rather than a cross-vendor OpenRouter fallback, to keep the contract boundary intact.
- **NFR4 (Auditability):** manifests queryable for a malpractice/privilege inquiry.
- **NFR5 (No silent degradation):** any fallback that changes data posture is prohibited without explicit configuration (FIRM RULE: no unauthorized fallbacks).

---

## 10. Compliance artifacts to obtain & retain ("reasonable efforts" evidence)
1. **Anthropic:** confirmation that **ZDR is enabled on the production org** (Console → Settings → Privacy Controls), the **ZDR arrangement in writing**, and the **auto-incorporated DPA** (date-stamped copy). Confirm no feedback/thumbs feature is enabled (only opt-in training path). [V]
2. **OpenAI:** **ZDR approval** for the embeddings org + **signed DPA** (date-stamped). [V]
3. **Upstash** (if retained for Standard mode): **DPA** (April-2025) + console evidence of **TLS/AES-256/region** settings; written confirmation that stored vectors carry **no client text** in metadata. [V]
4. **Google** (only if Option B / Vertex chosen): **DPA** + Vertex **ZDR-equivalent** amendment + CMEK/VPC-SC/residency config. [V]
5. **Firm AI policy**, **engagement-letter AI language**, **fee-agreement AI language** (FR-P).
6. **Rewritten `COMPLIANCE_ANALYSIS.md`** mapped to the 2026 guidance, replacing the stale 2024 version.

---

## 11. Phased Rollout

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 — Verify & document** | Confirm ZDR org for Claude; confirm OpenAI ZDR/DPA; audit what Upstash metadata actually stores; confirm region/encryption | All §12 verification items answered; evidence retained (§10) |
| **P1 — Direct LLM cutover** | FR-D1, FR-D2; remove OpenRouter from client-data paths; fix model IDs | Claude traffic provably on direct ZDR org; Fable 5 blocked; Gemini decision (Decision #1) made |
| **P2 — Embeddings & store hardening** | FR-D3, FR-D4, FR-D6; config-invariant guard FR-D7 | Standard-mode posture provable + fail-closed |
| **P3 — Disclosure/consent + verification** | FR-C*, FR-V*; rewrite COMPLIANCE_ANALYSIS.md | In-app disclosure live; high-risk fail-closed; consent flow shipped |
| **P4 — Protected-Matter mode** | FR-D5; self-hosted vector + local embeddings; tool-gating | A Restricted-Data matter runs end-to-end without client text leaving firm infra |
| **P5 — Agentic guardrails for Drafting Magic** | FR-A*; provenance + human-gate + scoped access | No autonomous send/file path exists; provenance recorded |
| **P6 — Firm policy & audit** | FR-P*, FR-R*; periodic-reassessment reminder | Policy + templates shipped; audit manifests verifiable |

---

## 12. Decisions Required & Items to Verify

**Decisions (yours to make):**
1. **LLM topology** — Option A (consolidate on direct Anthropic Claude; simplest, full ZDR privity) vs Option B (keep Gemini as cross-vendor generator on Vertex). *Recommendation: A.*
2. **Vector store for Standard mode** — keep hardened Upstash for non-Restricted data, or move everything to a self-hosted store now (simpler mental model, one store for both modes)?
3. **Protected-mode embedding** — local model (max privacy) vs OpenAI-ZDR (simpler ops)?
4. **CEB verification bypass** — keep (CEB is authoritative) or add citation-integrity checks for court-bound CEB outputs?
5. **Sanitization revival** — leave parked (recommended for V3) or schedule as a later opt-in hardening feature?

**Verify in vendor consoles (P0 — blocks reliance):**
- [P] Is ZDR actually enabled on the **specific Anthropic org** whose key the app will use? (ZDR is per-org, not account-wide. [V])
- [P] Is OpenAI **ZDR** enabled for the embeddings org, and is the **DPA** signed?
- [P] What does `api/ceb-search.ts` + the upload scripts **actually write to Upstash metadata**? (If client text/query facts, that is a live leak independent of contracts.)
- [P] Is the Upstash index **region-pinned (US)** with **TLS + AES-256** enabled? (Opt-in, possibly off. [V])
- [P] Do the **preview** Gemini terms match GA paid-tier no-training (only relevant under Option B)? [P]

---

## 13. Risks & Mitigations
- **R1 — "We have ZDR" false confidence.** *Mitigation:* §6.5 config-guard + P0 verification; the contract is meaningless until traffic is direct and on the right org.
- **R2 — Upstash Restricted-Data breach.** *Mitigation:* Protected mode + metadata-hygiene rule (FR-D4); classify matters before search.
- **R3 — Model churn / suspension** (e.g., Fable 5 pulled 2026-06-12 [V]). *Mitigation:* same-vendor fallback (NFR3) + model registry + periodic reassessment (FR-P1).
- **R4 — Pending Rule amendments become binding.** *Mitigation:* design to them now (verification, consent, supervision already in scope).
- **R5 — SB 574 passes.** *Mitigation:* V3 already keeps confidential info off public AI, verifies output, and supports citation disclosure.
- **R6 — Judge-specific AI disclosure orders.** *Mitigation:* FR-C5 court-use prompt.

---

## 14. Success Criteria
- **SC1.** A network audit shows **zero** client-text egress to OpenRouter or any uncontracted endpoint.
- **SC2.** A Restricted-Data matter completes in Protected mode with **no client text** leaving firm infrastructure (verified by manifest).
- **SC3.** Every court-bound response carries verified citations or a prominent unverifiable-citation warning.
- **SC4.** No code path can autonomously send/file/transmit (verified by review + test).
- **SC5.** The firm holds date-stamped DPAs/ZDR confirmations for every leg (§10).
- **SC6.** `COMPLIANCE_ANALYSIS.md` maps each 2026-guidance duty to a shipped control.

---

## 15. Sources (verification appendix)

**Primary legal source**
- CA State Bar, *Practical Guidance for the Use of Generative AI in the Practice of Law* (2026) — https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf — read directly; Board-approved 2026-05-14.
- CA Rule of Court 10.430 / Standard 10.80 — courts.ca.gov — eff. 2025-09-01 (courts only).
- SB 574 status — leginfo.legislature.ca.gov — pending, last action 2026-06-22.
- COPRAC proposed Rule amendments (1.1, 1.4, 1.6, 3.3, 5.1, 5.3) — calbar.ca.gov — comment closed 2026-05-04.

**Vendor data posture (read directly)**
- Anthropic API & data retention — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention (ZDR scope, 30-day default, 2yr/7yr exceptions, third-party not ZDR-eligible, Bedrock/Vertex processor note).
- Anthropic ZDR products / training / DPA / models — privacy.claude.com; platform.claude.com/.../models/overview; anthropic.com/news/fable-mythos-access (Fable 5/Mythos 5 suspension 2026-06-12).
- OpenRouter ZDR / provider-logging / Terms — https://openrouter.ai/docs/guides/features/zdr; openrouter.ai/terms (§16 warranty disclaimer; ZDR removes first-party Anthropic).
- Google Gemini terms / ZDR / Vertex governance — ai.google.dev/gemini-api/terms; ai.google.dev/gemini-api/docs/zdr; docs.cloud.google.com/gemini/docs/discover/data-governance; ai.google.dev/gemini-api/docs/changelog (Gemini 3.1 Pro = preview).
- OpenAI data controls / ZDR / embeddings eligibility / BAA — developers.openai.com/api/docs/guides/your-data; community.openai.com ZDR thread.
- Upstash DPA (Apr 2025) §12.4 Restricted Data + Security Measures (encryption opt-in) + compliance FAQ (SOC2/HIPAA = Redis) — upstash.com/trust/dpa.pdf; upstash.com/static/trust/security-measures.pdf; upstash.com/docs/common/help/compliance.
- CourtListener POST-embedding path — courtlistener.com/help/api/rest/search/.

*Confidence tags used throughout: [V] verified primary source · [P] partially verified / confirm in console · [U] unverified assumption.*
