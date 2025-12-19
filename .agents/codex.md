# ExecPlan: California Law Chatbot Improvements

## Objective
Deliver a measurable increase in legal answer reliability and citation trust by adding deterministic citation checks, statute text grounding, a single-pass hybrid generation flow, grounding source visibility, and a formal evaluation harness.

## Scope
- Deterministic citation verification for case law and statutes.
- Statute text retrieval for explicit code section queries.
- Hybrid flow refactor to avoid double LLM answer generation.
- Surface Gemini grounding sources as evidence with links.
- Evaluation harness with gold set and metrics.

## Non-goals
- Replacing the existing LLM stack or verification model.
- Changing the UI visual design beyond new citation status indicators.
- Expanding jurisdiction beyond California.

## Current State Summary
- Dual pipeline: CEB RAG (Upstash Vector) + external APIs (CourtListener, OpenStates, LegiScan).
- Two-pass verification: Gemini generator, Claude verifier with coverage gating.
- CEB responses bypass verification; AI/Hybrid responses may verify claims.
- Citation links exist for many code sections but not all have excerpted text.
- Gemini grounding metadata is captured in `api/gemini-generate.ts` but not surfaced as sources in the UI/verification path.

## Success Metrics
- Citation existence precision >= 0.98 on gold set.
- Citation recall >= 0.90 for questions requiring citations.
- Verification coverage median >= 0.80 for non-CEB answers.
- User-visible "unverified citation" rate <= 5% on gold set.
- Hybrid flow latency reduced by >= 20% (remove second LLM generation).

## Phased Plan

### Phase 0: Baseline and Evaluation (1-2 days)
Deliverables:
- Gold set of 50-100 questions covering: Family Law, Trusts and Estates, Business, LGBT topics, case law, bills, and code sections.
- Metric definitions and collection script or manual rubric.
Acceptance criteria:
- Baseline metrics captured and stored in a doc or CSV.

### Phase 1: Deterministic Citation Verification (1-2 weeks)
Deliverables:
- Citation parser (case law + statutes) for answers and sources.
- CourtListener citation lookup integration for existence checks.
- Optional citator integration (Fastcase or other) for good-law status, if access allows.
- UI status for citations: verified, not found, unknown.
Acceptance criteria:
- For case citations, at least one existence check per citation in gold set.
- UI shows per-citation status with clear legend.

### Phase 2: Statute Text Grounding (2-4 weeks)
Deliverables:
- Statute text retrieval for explicit code section queries.
- Source excerpts attached to statute sources with effective date.
- Verification prompt updated to prioritize statute excerpts.
Acceptance criteria:
- For code-section queries in gold set, at least one statute excerpt in sources.
- Coverage metrics increase by >= 0.10 for statute-heavy questions.

### Phase 3: Hybrid Flow Refactor (1-2 weeks)
Deliverables:
- Split source retrieval from answer generation.
- Hybrid mode uses a single Gemini generation pass.
- Maintain current verification behavior and optimistic UI updates.
Acceptance criteria:
- No loss in sources returned vs current hybrid mode.
- Latency reduction recorded in local logs or simple benchmarks.

### Phase 4: Grounding Source Visibility (1 week)
Deliverables:
- Gemini grounding URLs added to `Source[]` and displayed.
- Grounding sources participate in verification and citation rendering.
Acceptance criteria:
- Grounding sources appear in UI for grounded responses.

### Phase 5: Quality Gates and Monitoring (ongoing)
Deliverables:
- Thresholds for citation precision/coverage to label answers as verified.
- Regular re-evaluation of the gold set for regressions.
Acceptance criteria:
- No release that drops below success metrics without explicit approval.

## Detailed Workstreams

### Workstream A: Deterministic Case Citation Verification
- Parse case citations from answers and CEB excerpts (reuse or extend existing extractor).
- Call CourtListener citation lookup API for each citation.
- Cache results with TTL to avoid repeated lookups.
- Record status per citation and attach to source metadata.
- UI: show status on each citation badge or in a tooltip list.

### Workstream B: Deterministic Statute Verification
- Parse statute citations (code + section) from answers.
- Retrieve statute text (leginfo or cached corpus).
- Attach text excerpts and effective dates to sources.
- Use statute excerpt presence to boost verification coverage.

### Workstream C: Hybrid Flow Refactor
- Create a "source retrieval" method that returns all sources plus context.
- Reuse it in AI-only and Hybrid flows.
- Ensure CEB and extracted case sources are merged once.

### Workstream D: Grounding Sources
- Pass grounding metadata through API response.
- Append grounding sources to the source list with titles and URLs.
- Ensure citation rendering uses the same numbering scheme.

### Workstream E: Evaluation Harness
- Define gold set format (question, expected sources, required citations).
- Implement measurement steps (manual rubric or script).
- Store results in `docs/` with version tags.

## Testing Strategy (TDD)
- Write unit tests first for citation parsing and source enrichment.
- Submit unit tests for approval before implementation.
- Integration tests (CourtListener, statute text retrieval) require explicit permission.
- Add regression tests for hybrid flow and source merging logic.

## Dependencies and Access
- CourtListener API key (already supported).
- Citator access (Fastcase) is optional but recommended.
- Statute text access via leginfo or cached corpus (confirm acceptable source).

## Risks and Mitigations
- Rate limits from CourtListener: add caching and batching.
- Statute text parsing complexity: start with explicit section queries only.
- Hybrid refactor regressions: use gold set before and after changes.
- Citator access uncertainty: treat good-law checks as optional enhancement.

## Rollout Plan
- Ship phases sequentially with gold set validation at each step.
- Keep feature flags for citation status rendering and grounding sources.
- Monitor error logs for API failures and fallback behavior.

## Rollback Plan
- Feature-flag deterministic checks and grounding sources off.
- Revert to current hybrid behavior if latency or quality regressions appear.

## Open Questions
- Do we have API-level access to Fastcase or other citators?
- Is leginfo acceptable for production statute text retrieval, or should we build a cached corpus?
- Preferred format and location for gold set results in the repo?
