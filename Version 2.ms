Here’s a concise, execution-ready PRD for the seven upgrades—centered on adding a two-LLM verifier while keeping your current architecture intact. No code included.

⸻

PRD: “Verified California Law Chatbot v1.1”

0) Summary

We will harden truthfulness and verification without rearchitecting. The release introduces two-pass verification, stricter prompts, lightweight guardrails, and clearer source UX. Goal: >95% Verified Answer Rate (VAR) with minimal latency and cost impact.

Scope (this PRD):
	1.	System prompt hardening (no source, no claim; no new entities)
	2.	Two-pass verifier (second LLM call with rewrite-on-fail)
	3.	Regex guardrails (entity containment, citation existence, jurisdiction)
	4.	Quotes-only mode for high-risk categories
	5.	Source badges + disclaimer in UI
	6.	Light retrieval pruning (top-k=3, dedupe, lexical rerank)
	7.	Confidence gating (coverage threshold)

Non-Goals: New retrievers, vector DB, major UI redesign, multi-agent orchestration.

⸻

1) Goals & Success Metrics
	•	Primary KPI: Verified Answer Rate (VAR) ≥ 95% (answers requiring no verifier rewrite and containing only supported claims)
	•	Hallucination Rate: ≤ 2% (unsupported claims detected post-verification)
	•	Citation Precision: ≥ 98% (every cite maps to a provided source)
	•	Latency budget: P50 ≤ 6.5s, P95 ≤ 10s (with verifier on)
	•	Cost delta: ≤ +45% vs. current (due to one extra LLM call), mitigated by selective verification + pruning
	•	User trust proxy: “Was this answer trustworthy?” thumbs-up ≥ 80%

⸻

2) Users & Use Cases
	•	Primary user: Public user asking CA law questions.
	•	Jobs-to-be-done: Get accurate, grounded answers with transparent citations; know when the system can’t verify.

⸻

3) Architecture (Incremental)

Keep: UI → Orchestrator/Middleware → Retrieval (APIs) → LLM.
Add: Verifier pass and pre-send guardrails.

User → Generator LLM (A) → (Answer + Claims) → Verifier LLM (V) → Guardrails → UI
                    ↑                         ↑
                 SOURCES                  SOURCES

No new services or DBs. Optional in-memory/edge cache keyed by (question, selected passages).

⸻

4) Feature Specs

4.1 System Prompt Hardening

Objective: Reduce creative drift; forbid unsupported content.

Requirements
	•	Add rules to the generator (A) and verifier (V) system prompts:
	•	No source, no claim.
	•	No new entities: Do not introduce case names, statute numbers, dates, dollar amounts, or thresholds not present in SOURCES.
	•	Cite-before-say: Select quotes first; every non-obvious claim requires an inline cite [id].
	•	Refusal policy: If support is insufficient/ambiguous: “I can’t verify this from the available sources.”
	•	CA-only by default (ignore non-CA unless asked).

Acceptance
	•	In a dry run of 50 queries with SOURCES removed, A refuses ≥ 98% of the time.
	•	In a run with SOURCES present, A never emits entities not present in SOURCES (tested via regex containment).

⸻

4.2 Two-Pass Verifier (Second LLM, Rewrite-on-Fail)

Objective: Turn “agreeable” answers into evidence-bound answers.

Generator (A) Output Contract
	•	FINAL_ANSWER: natural language with inline [id] cites only from provided SOURCES.
	•	CLAIMS_JSON: array of atomic claims:
{ text, cites: [id], kind: 'statute'|'case'|'fact' }

Verifier (V) Input
	•	FINAL_ANSWER, CLAIMS_JSON, SOURCES[{id, title, url, excerpt}]

Verifier Tasks
	•	For each claim:
	•	Find 1–2 verbatim quotes in the cited source id(s).
	•	Mark supported/unsupported; collect evidence snippets.
	•	If any unsupported → produce VERIFIED_REWRITE using only supported claims; maintain cites.
	•	If overall support thin → return refusal line.
	•	Output VERIFICATION_REPORT summarizing per-claim support + quotes.

Gating
	•	If all claims supported → return FINAL_ANSWER.
	•	Else → return VERIFIED_REWRITE or refusal.

Acceptance
	•	On gold set (25 Qs), unsupported claims reduced by ≥ 80% vs. baseline.
	•	No answer ships with a claim lacking evidence in VERIFICATION_REPORT.

Performance/Cost Controls
	•	V uses only cited passages, not all SOURCES.
	•	Selective verification: always on for high-risk categories; 50% sampling for low-risk (config).
	•	Cache by hash(question + passages + A output) TTL 24h.

⸻

4.3 Regex Guardrails (Pre-Send)

Objective: Cheap, deterministic checks before display.

Checks
	1.	Entity containment: Any detected case pattern (\b[A-Z][a-z]+ v\. [A-Z]), statute (§\s*\d+|Cal\. codes), numbers (\b\d{4}\b, \b\d+ (days|years)\b, \$\d+) must appear in at least one source excerpt. Else → trigger V rewrite or refusal.
	2.	Citation existence: Every [id] in the answer must map to a known SOURCE.id.
	3.	Jurisdiction: Block reporters not in CA (e.g., F\.?3d, U\.S\.) unless the question requests federal.

Acceptance
	•	Synthetic tests with fake case names/thresholds are blocked 100% of time.
	•	No stray cite IDs allowed.

⸻

4.4 Quotes-Only Mode (High-Risk Categories)

Objective: Max faithfulness when precision matters.

Triggers (heuristic keyword match in question or SOURCES):
penalty|punishable|years|days|deadline|statute of limitations|threshold|over \$|elements of|mens rea|burden

Behavior
	•	Step 1: Extract 2–4 exact quotes with [id].
	•	Step 2: Write a one-paragraph summary strictly from those quotes (no outside facts).
	•	Step 3: Add a single-line “Plain-English rule,” still cited.

Acceptance
	•	In triggered cases, every sentence traces to a quote; no paraphrase without a nearby cite.

⸻

4.5 Source Badges + Disclaimer (UI)

Objective: Increase trust and compliance.

UI Changes
	•	Footnotes display badge labels:
📖 Penal Code §187, ⚖️ People v. Anderson (1972) (click → source URL).
	•	Verified chip when V passes all claims; Partially verified when rewritten; Not verified only for explicit refusals (hidden by default).
	•	Fixed header disclaimer:
“AI legal information, not legal advice. Verify sources; consult a licensed attorney for advice.”

Acceptance
	•	Badges present for 100% of cites; disclaimer always visible.
	•	A11y: badges accessible (aria-labels with source names).

⸻

4.6 Light Retrieval Pruning

Objective: Reduce distractors that cause drift and cut token/cost.

Rules
	•	Top-k ≤ 3 passages post-pruning.
	•	De-dupe near-identical chunks by Jaccard similarity on tokens.
	•	Lexical rerank by simple overlap score with query (e.g., TF-IDF or token overlap ratio).
	•	Prefer statute-level or paragraph-level chunks (≤ ~800 tokens).

Acceptance
	•	Average tokens sent to A reduced by ≥ 25% without harming answer coverage on gold set.
	•	VAR does not regress.

⸻

4.7 Confidence Gating (Coverage Threshold)

Objective: Communicate verification quality; prevent marginal answers.

From V
	•	coverage = supported_claims / total_claims
	•	min_support = min #quotes per claim
	•	ambiguity = boolean (conflicting or generic sources)

Gates
	•	If coverage = 1.0 & min_support ≥ 1 & ambiguity = false → Verified.
	•	If 0.6 ≤ coverage < 1.0 → Partially verified (ship with clear caveat line).
	•	If coverage < 0.6 or ambiguity = true → Refusal line.

Acceptance
	•	No “Verified” label unless coverage == 1.0.
	•	User sees a one-sentence caveat in partially-verified answers.

⸻

5) Telemetry & QA

Event Logging (PII-safe)
	•	retrieval.selected_ids, A.tokens, V.tokens, coverage, unsupported_claims, latency_ms, label (verified/partial/refusal), cost_cents.
	•	Hash IDs for queries/answers (content hashes), not raw text, unless user consents.

Dashboards
	•	Daily VAR, Hallucination rate, Citation precision.
	•	Latency P50/P95; token & cost per answer.

QA
	•	Maintain 25-item gold set with expected quotes.
	•	Pre-release: run full suite; must hit KPI thresholds.
	•	Weekly: random sample 50 live answers, human skim for correctness.

⸻

6) Rollout Plan & Feature Flags

Flags
	•	verifier.enabled (default ON for high-risk; 50% sample for low-risk)
	•	quotes_only.enabled
	•	guardrails.enabled
	•	retrieval.pruning.enabled
	•	ui.badges.enabled, ui.disclaimer.enabled

Phases
	1.	Week 1: Prompt hardening + guardrails + UI badges/disclaimer (flags ON).
	2.	Week 2: Verifier on high-risk + confidence gating (monitor VAR & latency).
	3.	Week 3: Expand verifier sampling to 100% if latency within budget; tune pruning.

Rollback
	•	If P95 latency > 10s or error rate > 2%, auto-disable verifier and revert to quotes-only for high-risk.

⸻

7) Risks & Mitigations
	•	Latency/cost creep: Use pruning, selective verification, passage-only context, caching by hash.
	•	Over-refusal: “Partially verified” path retains value while staying honest.
	•	Prompt injection attempts: Guardrails + no new entities + CA-only default.
	•	Source API outages: Show safe refusal + link to “try again” with cached prior passages when available.

⸻

8) Dependencies & Constraints
	•	Current LLM provider & API quotas.
	•	Stable access to CourtListener/OpenStates/LegiScan.
	•	No schema changes to retrieval outputs (must include {id, title, url, excerpt}).

⸻

9) Acceptance Criteria (Release)
	•	VAR ≥ 95% on gold set; citation precision ≥ 98%; hallucination ≤ 2%.
	•	P50 latency ≤ 6.5s, P95 ≤ 10s (10-question mixed suite).
	•	UI displays source badges + disclaimer on all answers.
	•	No answer ships with unmatched cite IDs or entities absent from sources.

⸻

10) Open Questions
	•	Thresholds for partial vs. refusal: keep 0.6 default or raise/lower after A/B?
	•	Expand high-risk triggers list based on live telemetry?
	•	Use a different model for V to avoid shared blind spots (future test)?

⸻

If you want, I can turn this PRD into a Jira-ready breakdown (epics → stories → tasks) and draft the exact A/V prompt texts you’ll paste into your config—still no code.