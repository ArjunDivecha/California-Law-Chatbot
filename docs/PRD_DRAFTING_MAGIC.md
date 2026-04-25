# Product Requirements Document: Drafting Magic

## Document Information

| Field | Value |
|---|---|
| Document Title | PRD: Drafting Magic Multi-Document Legal Drafting Workbench |
| Version | 0.1 |
| Status | Draft for product review |
| Created | April 24, 2026 |
| Branch | `codex/drafting-magic` |
| Owner | California Law Chatbot / femme & femme LLP |
| Related Documents | `docs/PRD_DOCUMENT_DRAFTING.md`, `PHASE_6_SANITIZATION_PLAN.md` |

---

## 1. Executive Summary

Drafting Magic is a new product capability inside California Law Chatbot that helps attorneys transform an estate-planning source packet plus new facts, instructions, or legal requirements into a clean, traceable, reviewable new draft.

The product is not a chat-with-documents feature. It is a drafting workbench. The attorney gives the system a trust, pour-over will, advance health care directive, financial power of attorney, prenuptial agreement, client facts, proposed language, or a new law. Drafting Magic extracts the meaningful drafting units, compares them, identifies conflicts and gaps, recommends a drafting strategy, and generates a new document with a visible reasoning trail.

The first flagship workflow is:

> "Reconcile an estate-planning packet and draft the updated document set."

Example: an attorney provides a revocable trust, pour-over will, advance health care directive, durable financial power of attorney, prenup, and a new legal or client-specific instruction. Drafting Magic shows where fiduciary appointments, incapacity triggers, property characterization, pour-over provisions, health care authority, and spousal-waiver boundaries align or conflict. It then drafts a new estate-planning document or review memo with a compliance checklist and source map.

The product promise:

> Give me the estate-planning packet, new requirements, and a desired output. Show me what matters, what conflicts, what must change, and produce a clean new draft with traceable reasoning.

---

## 2. Product Thesis

Legal drafting is not just generation. It is selection, comparison, judgment, adaptation, and proof.

Most AI drafting tools collapse that workflow into a single prompt and answer. That creates three problems for attorneys:

1. They cannot see what the system used.
2. They cannot tell why language was kept, changed, or discarded.
3. They cannot confidently verify whether the new draft complies with a new legal requirement.

Drafting Magic solves this by making the intermediate work product visible:

- Source inventory
- Clause and issue extraction
- Similarity and difference map
- New-law impact analysis
- Drafting strategy controls
- Generated draft
- Compliance checklist
- Source lineage for major provisions
- Attorney review flags

The "magic" is the workbench that turns scattered prior materials into a structured drafting plan before generation begins.

---

## 3. Problem Statement

### 3.1 Current Attorney Workflow

When an estate-planning packet needs to be updated, attorneys often:

1. Open the trust, pour-over will, AHCD, financial POA, and prenup.
2. Compare fiduciary names, agent order, incapacity triggers, and distribution language manually.
3. Check whether funding provisions preserve separate-property and community-property treatment.
4. Confirm that pour-over language matches the operative trust.
5. Determine which provisions are outdated, inconsistent, or missing.
6. Rewrite old language for the new legal regime or client instruction.
7. Clean formatting, defined terms, signing instructions, citations, and tone.

This is high-value legal work, but it is also repetitive and error-prone. The risk is not only slow drafting. The deeper risk is carrying forward outdated language because it looked familiar.

### 3.2 Current Product Gap

The existing document drafting system can generate a document from a template and instructions. It does not yet provide:

- Multi-document intake
- Document-to-document comparison
- New-law impact analysis
- Source lineage by clause or section
- Drafting strategy selection
- Compliance matrix against new requirements
- Estate-packet reconciliation across trust, will, AHCD, POA, and prenup
- A review-first workspace for deciding what to keep, revise, discard, or add

### 3.3 User Pain Points

| Pain Point | Product Response |
|---|---|
| Estate documents contain useful language but can conflict across the packet | Detect reusable, conflicting, outdated, and missing provisions |
| Attorneys need to know what changed and why | Provide change rationale and source lineage |
| New legal requirements must be incorporated consistently | Build a compliance checklist and require every requirement to be mapped |
| Prenup terms can constrain trust funding and distribution language | Surface property-character and spousal-waiver issues before drafting |
| Agent and fiduciary appointments can diverge across documents | Compare trustee, POA agent, AHCD agent, and successor language |
| A single generated draft is hard to trust | Show comparison and drafting plan before generation |
| Attorneys need editable work product, not just chat output | Provide a document editor, export, and review flags |
| Client facts and source documents may be sensitive | Preserve the Phase 6 confidentiality boundary |

---

## 4. Goals and Non-Goals

### 4.1 Goals

1. Let an attorney ingest the core estate-planning packet and a new legal or client-specific requirement into a single drafting workspace.
2. Extract and compare legally meaningful sections, clauses, facts, duties, deadlines, remedies, exceptions, and defined terms.
3. Identify what should be kept, revised, discarded, or added.
4. Generate a new draft that synthesizes the best source material and complies with the new requirement.
5. Provide a traceable source map showing where major language came from.
6. Provide a compliance checklist showing how the new draft addresses each new-law requirement.
7. Keep the attorney in control of drafting strategy and final review.
8. Fit naturally into the existing California Law Chatbot research and drafting product.

### 4.2 Non-Goals for MVP

- Full contract lifecycle management.
- Real-time multi-user collaborative editing.
- E-filing integration.
- Automatic legal advice without attorney review.
- Firm-wide document management replacement.
- Fully automated redlining against Microsoft Word track changes.
- Cross-device token-map sync.
- Server-side raw document storage for confidential files.

---

## 5. Target Users

### 5.1 Primary User: Practicing California Attorney

The attorney wants a reliable first draft and a clear explanation of what changed. They care about speed, but not at the expense of reviewability.

Common jobs:

- Reconcile a trust, pour-over will, AHCD, financial POA, and prenup before preparing an updated estate plan.
- Identify fiduciary, agent, property-character, and pour-over inconsistencies.
- Draft a restated trust, client signing memo, attorney review memo, or funding instruction letter from the packet.
- Adapt the packet to a new law, client instruction, marriage/divorce event, asset change, or beneficiary update.
- Convert research and prior work product into a draft client-facing estate-planning document.

### 5.2 Secondary User: Senior Attorney / Reviewer

The reviewer wants to audit whether the draft is safe to send. They may care less about generation and more about the reasoning trail.

Common jobs:

- Review what source documents influenced the draft.
- Check whether required legal updates were included.
- Identify unsupported or risky generated language.
- Approve, edit, or reject drafting recommendations.

### 5.3 Future User: Legal Assistant or Paralegal

The assistant may prepare the workspace by uploading source documents and labeling them, but the attorney remains responsible for review and final approval.

---

## 6. Primary MVP Workflow

### Workflow Name

Estate-Planning Packet Reconciliation

### User Story

As a California attorney, I want to provide a trust, pour-over will, advance health care directive, financial power of attorney, prenup, and a new statute, regulation, case, policy requirement, or client instruction, so that I can produce a new estate-planning document that incorporates useful existing language while clearly complying with the new requirement.

### Happy Path

1. Attorney opens Drafting Magic.
2. Attorney creates a new workspace.
3. Attorney uploads or pastes the estate-planning packet:
   - Revocable living trust
   - Pour-over will
   - Advance health care directive
   - Durable financial power of attorney
   - Prenuptial agreement
4. Attorney adds any new law, client instruction, asset list, beneficiary update, or attorney note.
5. Attorney labels each source document by document type and marks the trust or other desired document as the base.
6. Attorney chooses an output type, for example restated trust package, estate plan review memo, client signing memo, funding instruction letter, or custom document.
7. Attorney selects a base strategy:
   - Use the trust as the base.
   - Reconcile the full packet.
   - Conservative update.
   - Fresh integrated draft using all sources as reference.
8. Drafting Magic extracts clauses, sections, fiduciary roles, agent powers, property classifications, defined terms, dates, obligations, and procedural requirements.
9. Drafting Magic presents a comparison matrix.
10. Attorney reviews recommendations: keep, revise, discard, add.
11. Attorney approves or edits the drafting plan.
12. Drafting Magic generates a new draft.
13. Drafting Magic verifies the draft against the new-law and packet-consistency checklist.
14. Attorney reviews source lineage and flags.
15. Attorney edits and exports the final draft.

### Output

The user receives:

- A generated draft document.
- A comparison matrix.
- A new-law and estate-packet consistency checklist.
- A source lineage map.
- Attorney review flags.
- Exportable DOCX, PDF, and HTML output.

---

## 7. Product Principles

### 7.1 Workbench Over Chat

Drafting Magic should not look like a blank chat box. It should look like an organized drafting desk where source materials, comparison, strategy, and draft all remain visible.

### 7.2 Show the Middle Work

The comparison matrix and drafting plan are first-class product surfaces. They are not hidden implementation details.

### 7.3 Attorney Control

The attorney must be able to:

- Choose the base document.
- Exclude a source.
- Override keep/revise/discard/add recommendations.
- Require or forbid use of specific language.
- Edit generated sections.
- Regenerate a section without losing the rest of the document.

### 7.4 Traceability by Default

Every important generated section should be traceable to:

- One or more source documents.
- A new-law requirement.
- A user instruction.
- A generated bridge where no source language existed.

### 7.5 Review Before Export

The product should make it hard to export without seeing unresolved warnings. It should not block export in every case, but unresolved compliance or citation flags must be prominent.

### 7.6 Privacy by Design

Confidentiality is a core product constraint. It should be communicated in the workflow without overwhelming the product experience.

---

## 8. Information Architecture

### 8.1 Route

Recommended MVP route:

- `/drafting-magic`

Alternative:

- Add as a submode under the existing Drafting mode.

Recommendation: create a dedicated route and allow the existing Research / Drafting toggle to route into it once stable. The workflow is complex enough to deserve its own page.

### 8.2 Page Layout

Desktop layout should use a dense professional workbench:

| Region | Purpose |
|---|---|
| Left rail | Source library, document labels, upload/paste actions, inclusion toggles |
| Center top | Workflow tabs and drafting strategy |
| Center main | Comparison matrix or compliance matrix |
| Right panel | Live draft preview and review flags |
| Bottom drawer | Source snippets, lineage, generation progress, audit details |

Mobile can collapse into tabs, but MVP may target desktop first because this is a professional drafting workflow.

### 8.3 Main Tabs

1. Inputs
2. Compare
3. Strategy
4. Draft
5. Review

The tabs represent workflow state, not marketing sections.

---

## 9. Screen Requirements

### 9.1 Inputs Screen

Purpose: collect and label source materials.

Required capabilities:

- Upload documents.
- Paste text.
- Add URL or citation for public legal source where supported.
- Label each item by role:
  - Revocable living trust
  - Pour-over will
  - Advance health care directive
  - Durable financial power of attorney
  - Prenuptial agreement
  - Client facts or asset schedule
  - New law or attorney instruction
  - Other
- Mark one source as base document.
- Toggle source inclusion.
- Display extraction status.
- Display source word count and section count.
- Display warnings for unreadable files, unsupported formats, or low extraction confidence.

Source card fields:

| Field | Description |
|---|---|
| Source name | User-editable label |
| Source role | Trust, pour-over will, AHCD, financial POA, prenup, new law, client facts, etc. |
| Format | PDF, DOCX, TXT, pasted text |
| Status | Ready, needs review, failed, excluded |
| Included | Boolean |
| Base | Boolean |
| Extracted sections | Count |
| Warnings | Extraction or sanitization warnings |

### 9.2 Compare Screen

Purpose: show what matters across sources before drafting.

Primary component: comparison matrix.

Rows should represent legal/drafting units, not arbitrary chunks.

Row types:

- Clause
- Fact
- Legal rule
- Obligation
- Deadline
- Remedy
- Exception
- Defined term
- Fiduciary appointment
- Agent authority
- Property characterization
- Pour-over alignment
- Prenup constraint
- Notice requirement
- Signature or procedural requirement
- Formatting requirement
- Missing requirement

Columns:

| Column | Description |
|---|---|
| Issue / clause | Human-readable label |
| Source A | Relevant language or summary |
| Source B | Relevant language or summary |
| Source C | Relevant language or summary |
| New law impact | What changed or matters |
| Recommendation | Keep, revise, discard, add |
| Rationale | Why the recommendation was made |
| Confidence | High, medium, low |
| Attorney action | Approve, edit, exclude, require |

Comparison filters:

- Show conflicts only.
- Show new-law impacts only.
- Show missing requirements only.
- Show low-confidence rows.
- Show attorney-unresolved rows.
- Show source-specific rows.

Row interactions:

- Expand source snippets.
- Compare exact text side by side.
- Mark recommendation as approved.
- Change recommendation.
- Add attorney note.
- Pin row for drafting.
- Exclude row from drafting.

### 9.3 Strategy Screen

Purpose: let the attorney define how the new document should be assembled.

Required controls:

| Control | Options |
|---|---|
| Output type | Restated trust package, estate plan review memo, client signing memo, funding instruction letter, custom |
| Base strategy | Trust as base, packet reconciliation, blend companion documents, fresh integrated draft, conservative update |
| Tone | Formal, client-friendly, persuasive, neutral, firm style |
| Length | Short, standard, comprehensive |
| Review posture | Attorney checklist, inline source notes, signing packet flags, no notes |
| Source preference | Favor trust, favor prenup constraints, favor latest signed version, favor attorney-selected source |
| Risk posture | Conservative, balanced, assertive |
| Formatting | Existing estate-planning template, plain draft, client signing memo style, attorney review style |

The strategy screen should also show:

- Approved rows.
- Unresolved rows.
- Excluded sources.
- Required language.
- Forbidden language.
- Output outline preview.

### 9.4 Draft Screen

Purpose: generate and edit the new document.

Required capabilities:

- Generate full draft.
- Stream section-by-section progress.
- Display live draft preview.
- Inline edit sections.
- Regenerate a section.
- Ask for a section-specific rewrite.
- Lock a section so later regenerations do not alter it.
- Show source lineage for each section.
- Show unresolved flags in the margin.
- Preserve user edits.

Draft section metadata:

| Field | Description |
|---|---|
| Section name | Output section heading |
| Source lineage | Source rows/documents used |
| New-law requirements addressed | Requirement IDs |
| Confidence | High, medium, low |
| Review status | Unreviewed, reviewed, needs work, locked |
| Last edited by | User or AI |

### 9.5 Review Screen

Purpose: make final attorney review faster and more reliable.

Required components:

1. Compliance checklist
2. Source lineage map
3. Open issues list
4. Citation/source verification status
5. Export readiness summary

Compliance checklist columns:

| Column | Description |
|---|---|
| Requirement | Extracted from new law or attorney instruction |
| Draft location | Section(s) addressing it |
| Evidence | Source text or citation |
| Status | Satisfied, missing, partial, needs attorney review |
| Notes | Rationale or concern |

Export readiness states:

- Ready
- Ready with warnings
- Blocked by required review

Warnings should include:

- Missing new-law requirement.
- Unsupported generated language.
- Conflicting source language.
- Low-confidence extraction.
- Unresolved attorney decision.
- Citation or source mismatch.

---

## 10. Functional Requirements

### 10.1 Workspaces

Drafting Magic should organize work into workspaces.

Workspace fields:

```ts
interface DraftingMagicWorkspace {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  outputType: DraftingMagicOutputType;
  status: 'inputs' | 'analyzed' | 'strategy' | 'drafting' | 'review' | 'complete';
  sources: DraftingMagicSource[];
  comparisonRows: ComparisonRow[];
  strategy: DraftingStrategy;
  draft?: GeneratedDraft;
  review?: ReviewPackage;
}
```

MVP persistence should support:

- Create workspace.
- Save tokenized workspace state.
- Resume workspace.
- Delete workspace.
- Local draft backup for zero-data-loss behavior.

Current prototype support:

- Autosaves the Drafting Magic workspace to browser-local storage.
- Restores packet sources, extracted text, comparison rows, attorney decisions, strategy, and active tab after refresh.
- Exports the local workspace as JSON.
- Resets the local workspace on user confirmation.

Production note: the prototype local workspace may contain raw extracted source text because it never leaves the browser. The production implementation should encrypt browser-local token maps and keep server-visible state tokenized under the Phase 6 design.

### 10.2 Source Intake

Supported MVP source types:

- Pasted text.
- `.txt`
- `.md`
- `.docx`
- text-based `.pdf`

Current prototype support:

- Pasted text is parsed in-browser.
- `.txt` and `.md` are read in-browser.
- `.docx` is extracted in-browser.
- Text-based `.pdf` is extracted in-browser.
- Scanned PDFs are flagged for review until OCR is added.

Deferred:

- OCR for scanned PDFs.
- Email import.
- Google Drive import.
- Word redline import.

Functional requirements:

- Parse source locally where required by confidentiality design.
- Preserve original source order.
- Allow user labels.
- Detect duplicate or near-duplicate sources.
- Split source into sections and clauses.
- Preserve citation references, headings, numbering, and defined terms where possible.

### 10.3 Document Understanding

The system must extract:

- Document title.
- Document type.
- Parties or tokenized party labels.
- Dates and deadlines.
- Defined terms.
- Major sections.
- Clauses.
- Obligations.
- Exceptions.
- Remedies.
- Notice provisions.
- Governing law.
- Procedural requirements.
- Citations.
- Facts.
- Ambiguous or missing context.
- Trustee and successor trustee appointments.
- Financial agent and successor agent appointments.
- Health care agent and successor agent appointments.
- Incapacity triggers.
- Trust funding schedules.
- Separate-property and community-property classifications.
- Prenup waiver boundaries.
- Pour-over trust identity and effective date.

The system should assign confidence scores and expose low-confidence extraction to the attorney.

### 10.4 New-Law Analysis

For a source labeled "New law", the system should extract:

- Citation.
- Effective date.
- Scope.
- Covered parties.
- Required conduct.
- Prohibited conduct.
- Exceptions.
- Deadlines.
- Remedies or penalties.
- Required notices or disclosures.
- Retroactivity or transition rules.
- Open interpretive questions.

The system should convert this into requirement rows that can be mapped into the draft.

### 10.5 Difference Analysis

The system must compare source documents by meaning and function, not only text similarity.

Required outputs:

- Common language across sources.
- Unique language in each source.
- Direct conflicts.
- Outdated language.
- Missing requirements.
- Strong reusable language.
- Style differences.
- Defined-term inconsistencies.
- Legal-rule inconsistencies.
- Potentially harmful carryover language.

Recommendation categories:

- Keep.
- Revise.
- Discard.
- Add.
- Needs attorney judgment.

### 10.6 Drafting Plan

Before generation, Drafting Magic must produce a drafting plan.

Drafting plan includes:

- Output outline.
- Source rows to use.
- Rows to exclude.
- New-law requirements to satisfy.
- Required language.
- Forbidden language.
- Tone and format.
- Section-by-section drafting instructions.

The attorney can approve the plan or revise it.

### 10.7 Draft Generation

The generated draft must:

- Follow the approved drafting plan.
- Use source language where appropriate.
- Adapt language to the new law.
- Avoid copying outdated or rejected language.
- Maintain consistent defined terms.
- Maintain consistent party references.
- Include citations or authority references when requested.
- Include placeholders only when attorney input is missing.
- Never silently ignore a required new-law requirement.

### 10.8 Source Lineage

Every major generated section should include lineage metadata.

Lineage metadata:

```ts
interface SourceLineage {
  generatedSectionId: string;
  sourceRowIds: string[];
  sourceDocumentIds: string[];
  requirementIds: string[];
  transformation: 'copied' | 'adapted' | 'synthesized' | 'new';
  rationale: string;
}
```

Display requirements:

- Hover or click a generated paragraph to see source lineage.
- Show source snippets in a bottom drawer.
- Allow attorney to jump from draft section to comparison row.
- Allow attorney to jump from requirement to draft location.

### 10.9 Compliance Review

The system must produce a review package:

```ts
interface ReviewPackage {
  checklist: ComplianceChecklistItem[];
  openIssues: ReviewIssue[];
  sourceLineage: SourceLineage[];
  exportReadiness: 'ready' | 'warnings' | 'blocked';
  summary: string;
}
```

The compliance checklist must not simply state that the draft is compliant. It must map each requirement to draft text or mark it unresolved.

### 10.10 Export

MVP export formats:

- DOCX
- PDF
- HTML

Export should include optional appendices:

- Compliance checklist.
- Source lineage table.
- Open issues.
- Table of authorities.

Export should preserve:

- User edits.
- Section order.
- Headings.
- Citations.
- Basic formatting.

---

## 11. User Stories and Acceptance Criteria

### US-1: Create Drafting Workspace

As an attorney, I want to start a Drafting Magic workspace so that I can organize sources, strategy, and output in one place.

Acceptance criteria:

- User can open `/drafting-magic`.
- User can create a workspace with a title and output type.
- Workspace starts in Inputs state.
- User can leave and return without losing work.

### US-2: Ingest Multiple Sources

As an attorney, I want to upload or paste multiple source documents so that the system can compare them.

Acceptance criteria:

- User can add at least 3 sources.
- User can label source roles.
- User can mark a base source.
- User can exclude a source.
- Extraction status is visible.
- Failed extraction produces a clear warning.

### US-3: Compare Source Documents

As an attorney, I want to see how the documents differ so that I can decide what should influence the new draft.

Acceptance criteria:

- System generates a comparison matrix.
- Rows include recommendations and rationale.
- User can filter to conflicts, missing requirements, and low-confidence rows.
- User can approve, edit, or exclude recommendations.
- User decisions are preserved.

### US-4: Analyze New Law

As an attorney, I want the system to extract requirements from a new law so that the draft can be checked against them.

Acceptance criteria:

- User can label one or more sources as new law.
- System extracts requirement rows.
- Each requirement includes scope, duty, deadline, exception, or remedy when present.
- Each requirement has confidence and source reference.
- User can edit or add a requirement.

### US-5: Choose Drafting Strategy

As an attorney, I want to control the drafting strategy so that the output matches the matter and audience.

Acceptance criteria:

- User can choose output type, base strategy, tone, length, citation posture, and risk posture.
- System previews an output outline.
- System warns if unresolved comparison rows remain.
- User can approve the drafting plan.

### US-6: Generate New Draft

As an attorney, I want Drafting Magic to generate a new document so that I have a usable first draft.

Acceptance criteria:

- Draft is generated section by section.
- Progress is visible.
- Draft uses approved plan and source decisions.
- Draft includes required new-law updates.
- Draft preserves consistent terminology.
- Generated sections include source lineage.

### US-7: Review Compliance

As a reviewer, I want to see whether each new-law requirement is addressed so that I can review efficiently.

Acceptance criteria:

- Review screen shows every requirement.
- Each requirement maps to draft section text or is marked unresolved.
- Missing and partial requirements are flagged.
- User can jump from requirement to draft text.
- User can export checklist as appendix.

### US-8: Export Work Product

As an attorney, I want to export the final draft and optional support materials so that I can continue work in Word or share it internally.

Acceptance criteria:

- User can export DOCX, PDF, and HTML.
- Export includes final draft exactly as edited.
- User can include or exclude compliance appendix.
- Export warns about unresolved review flags.

---

## 12. AI Workflow

### 12.1 Pipeline Overview

1. Intake and extraction.
2. Source normalization.
3. Clause and issue extraction.
4. New-law requirement extraction.
5. Difference analysis.
6. Drafting recommendation generation.
7. Attorney strategy review.
8. Draft generation.
9. Compliance verification.
10. Source lineage packaging.
11. Local rehydration and export.

### 12.2 Agents or Logical Services

| Service | Responsibility |
|---|---|
| Source Extraction | Convert source documents into structured sections and clauses |
| Source Classifier | Identify document type, role, and likely practice area |
| Clause Mapper | Align similar clauses across documents |
| Law Requirement Extractor | Extract duties, deadlines, exceptions, remedies, and required language |
| Difference Analyst | Identify conflicts, gaps, stale provisions, and reusable language |
| Drafting Planner | Convert comparison decisions into section-by-section drafting instructions |
| Drafter | Generate the new document |
| Compliance Verifier | Map requirements to draft text and flag gaps |
| Lineage Builder | Attach sources and rationales to generated sections |

These can initially be implemented as functions behind one orchestrated route, but the product should treat the outputs as first-class objects.

### 12.3 Prompting Requirements

Prompts must require structured output for:

- Extracted source units.
- Requirements.
- Comparison rows.
- Drafting plan.
- Generated sections.
- Review package.

Freeform prose should be reserved for the final draft and attorney-facing summaries.

### 12.4 Hallucination Controls

- Drafting plan must reference known source rows or requirement IDs.
- Draft sections must include lineage metadata.
- Compliance verifier must identify unmapped requirements.
- System must flag generated claims with no source support.
- System must distinguish "source-derived", "law-derived", "attorney-instructed", and "AI-synthesized" text.

---

## 13. Data Model

### 13.1 Source

```ts
interface DraftingMagicSource {
  id: string;
  workspaceId: string;
  name: string;
  role:
    | 'revocable_trust'
    | 'pour_over_will'
    | 'advance_health_care_directive'
    | 'financial_power_of_attorney'
    | 'prenuptial_agreement'
    | 'client_facts'
    | 'new_law'
    | 'asset_schedule'
    | 'attorney_instruction'
    | 'other';
  format: 'pasted_text' | 'txt' | 'md' | 'docx' | 'pdf';
  included: boolean;
  isBase: boolean;
  extractedTextRef: string;
  sections: ExtractedSection[];
  warnings: ExtractionWarning[];
}
```

### 13.2 Extracted Section

```ts
interface ExtractedSection {
  id: string;
  sourceId: string;
  title: string;
  order: number;
  text: string;
  type: 'heading' | 'clause' | 'fact' | 'law' | 'definition' | 'other';
  confidence: number;
}
```

### 13.3 Comparison Row

```ts
interface ComparisonRow {
  id: string;
  workspaceId: string;
  label: string;
  rowType:
    | 'clause'
    | 'fact'
    | 'legal_rule'
    | 'obligation'
    | 'deadline'
    | 'remedy'
    | 'exception'
    | 'defined_term'
    | 'fiduciary_appointment'
    | 'agent_authority'
    | 'property_characterization'
    | 'pour_over_alignment'
    | 'prenup_constraint'
    | 'missing_requirement';
  sourceRefs: SourceReference[];
  newLawImpact?: string;
  recommendation: 'keep' | 'revise' | 'discard' | 'add' | 'needs_attorney_judgment';
  rationale: string;
  confidence: number;
  attorneyDecision?: AttorneyDecision;
}
```

### 13.4 Requirement

```ts
interface LawRequirement {
  id: string;
  sourceId: string;
  citation?: string;
  requirementType: 'duty' | 'prohibition' | 'deadline' | 'notice' | 'exception' | 'remedy' | 'scope' | 'other';
  text: string;
  effectiveDate?: string;
  appliesTo?: string;
  confidence: number;
}
```

### 13.5 Drafting Strategy

```ts
interface DraftingStrategy {
  outputType: 'memo' | 'client_letter' | 'demand_letter' | 'agreement' | 'policy' | 'clause_set' | 'custom';
  baseStrategy: 'base_document' | 'blend_sources' | 'fresh_draft' | 'conservative_update' | 'aggressive_rewrite';
  tone: 'formal' | 'client_friendly' | 'persuasive' | 'neutral' | 'firm_style';
  length: 'short' | 'standard' | 'comprehensive';
  citationPosture: 'inline' | 'footnotes' | 'none' | 'appendix';
  riskPosture: 'conservative' | 'balanced' | 'assertive';
  requiredRowIds: string[];
  excludedRowIds: string[];
  requiredLanguage: string[];
  forbiddenLanguage: string[];
}
```

---

## 14. Repo Integration Notes

### 14.1 Existing Product Surface

The repo already has a document drafting mode:

- `components/drafting/DraftingMode.tsx`
- `hooks/useDrafting.ts`
- `api/orchestrate-document.ts`
- `api/export-document.ts`
- `docs/PRD_DOCUMENT_DRAFTING.md`

Drafting Magic should not overwrite the existing template drafting concept. It should either:

1. Become a new route and page that reuses compatible pieces, or
2. Become the next-generation drafting mode after MVP validation.

Recommendation: new route first, merge later.

### 14.2 Suggested New Files

Frontend:

- `components/draftingMagic/DraftingMagicPage.tsx`
- `components/draftingMagic/SourceLibrary.tsx`
- `components/draftingMagic/SourceCard.tsx`
- `components/draftingMagic/ComparisonMatrix.tsx`
- `components/draftingMagic/StrategyPanel.tsx`
- `components/draftingMagic/DraftWorkbench.tsx`
- `components/draftingMagic/ComplianceChecklist.tsx`
- `components/draftingMagic/LineageDrawer.tsx`
- `hooks/useDraftingMagic.ts`

Backend/API:

- `api/drafting-magic/analyze.ts`
- `api/drafting-magic/generate.ts`
- `api/drafting-magic/verify.ts`
- `api/drafting-magic/workspaces.ts`

Services:

- `services/draftingMagic/extractSource.ts`
- `services/draftingMagic/compareSources.ts`
- `services/draftingMagic/analyzeLawRequirements.ts`
- `services/draftingMagic/createDraftingPlan.ts`
- `services/draftingMagic/buildLineage.ts`

### 14.3 Dependencies to Evaluate

Client-side parsing:

- DOCX: `mammoth` or equivalent browser-capable parser.
- PDF: `pdfjs-dist`.
- TXT/MD: native browser file read.

Document export:

- Reuse existing export logic only if export remains compliant with the confidentiality boundary.
- Consider client-side DOCX export for rehydrated confidential drafts.

---

## 15. Privacy and Confidentiality Requirements

This section constrains the product, but does not replace the product design.

Drafting Magic must comply with the Phase 6 principle:

> Client-identifying facts never leave the attorney's browser in raw form.

Product implications:

- Raw uploaded documents cannot be sent to external APIs in Phase 6.
- Raw filenames may be confidential and should be tokenized or locally retained.
- Source extraction for confidential files must happen locally.
- Server-visible workspace state must be tokenized.
- Token maps stay in browser-local encrypted storage.
- Server routes must backstop-scan for raw PII-shaped content.
- Audit logs must store HMACs and metadata only.
- Rehydrated final drafts should be exported client-side where possible.

The product should communicate this as a quiet assurance, not as the main user experience.

Suggested UI copy:

> Source documents are prepared in this browser before drafting. The review trail shows what will be used.

Detailed legal attestation and sanitizer unlock flows belong to the broader Phase 6 implementation.

---

## 16. Non-Functional Requirements

### 16.1 Performance

Targets:

- Add source and show extraction status within 5 seconds for plain text and DOCX under 5 MB.
- Generate comparison matrix for the 5-document estate packet under 45 seconds after extraction.
- Generate first draft under 2 minutes for standard client letter or memo.
- Keep UI interactive during long analysis.
- Stream progress for generation and verification.

### 16.2 Reliability

- Preserve local workspace state during network failure.
- Preserve attorney edits during regeneration.
- Avoid silent source exclusion.
- Surface partial results if one source fails extraction.
- Allow user to retry analysis without re-uploading sources.

### 16.3 Accessibility

- Keyboard navigable comparison matrix.
- Clear focus states.
- Sufficient contrast.
- No reliance on color alone for review status.
- Downloadable outputs available through normal buttons.

### 16.4 Auditability

- Record which sources were included.
- Record attorney-approved comparison decisions.
- Record generated drafting plan.
- Record review flags at time of export.
- Never record raw confidential text in server logs.

### 16.5 Usability

- Avoid a wizard that hides context.
- Keep source list, comparison, and draft reachable at all times.
- Use dense, professional UI appropriate for attorney review.
- Make warnings specific and actionable.

---

## 17. Success Metrics

### 17.1 Product Metrics

| Metric | MVP Target |
|---|---|
| Time from source upload to comparison matrix | Under 30 seconds for 3 medium docs |
| Time to first draft | Under 2 minutes for standard output |
| Attorney approval rate for comparison recommendations | 70%+ |
| Generated draft sections with lineage | 95%+ |
| New-law requirements mapped in review checklist | 100% attempted mapping |
| Export after first generated draft | 50%+ of completed workspaces |
| Manual edits before export | Tracked, not minimized blindly |

### 17.2 Quality Metrics

| Metric | Target |
|---|---|
| Critical new-law requirement omitted | 0 in gold-set tests |
| Stale source language carried forward despite conflict | 0 in gold-set tests |
| Unsupported generated legal claim | Under 5% of checked claims |
| Incorrect source lineage | Under 5% of lineage links |
| User-reported "could not tell why this changed" | Under 10% of reviewed sessions |

### 17.3 Compliance Metrics

| Metric | Target |
|---|---|
| Raw client names in network payload during test | 0 |
| Raw client names in saved server state during test | 0 |
| Server backstop catches synthetic PII | 100% for covered patterns |
| Audit logs contain raw prompt substrings | 0 |

---

## 18. MVP Scope

### 18.1 Included in MVP

- Dedicated Drafting Magic route.
- Source library with upload/paste.
- Source labels and inclusion toggles.
- Local extraction for TXT/MD/DOCX/text PDF.
- New-law source labeling.
- Comparison matrix.
- Strategy panel.
- Full draft generation.
- Compliance checklist.
- Source lineage display.
- DOCX and HTML export.
- Workspace persistence with local recovery.

### 18.2 Deferred

- OCR.
- Word track changes.
- Multi-user comments.
- Firm template library admin.
- Direct DMS integration.
- Google Drive import.
- Email import.
- Automatic filing rules.
- Complex contract playbook scoring.

---

## 19. Implementation Plan

### Phase 0: Product Prototype

Objective: validate interaction model before full implementation.

Deliverables:

- Static Drafting Magic page.
- Mock source library.
- Mock comparison matrix.
- Mock draft preview.
- Mock compliance checklist.

Exit criteria:

- User can understand the workflow without explanation.
- Page feels like a workbench, not a marketing page.
- Attorney can identify where to upload, compare, strategize, draft, and review.

### Phase 1: Source Intake and Local Extraction

Deliverables:

- Upload/paste source support.
- Source labels.
- Extraction status.
- Section extraction.
- Local persistence.

Exit criteria:

- 3 source documents can be added and parsed.
- User can mark one source as new law and one as base.
- Extraction failures are visible and recoverable.

### Phase 2: Comparison and New-Law Requirement Matrix

Deliverables:

- Clause/section extraction.
- New-law requirement extraction.
- Comparison matrix.
- Recommendation and confidence fields.
- Attorney approve/edit/exclude actions.

Exit criteria:

- System produces useful rows for the flagship workflow.
- User can change recommendations.
- Low-confidence rows are visible.

### Phase 3: Drafting Strategy and Generation

Deliverables:

- Strategy panel.
- Drafting plan.
- Section-by-section draft generation.
- Draft preview and inline editing.
- Section lock/regenerate controls.

Exit criteria:

- Approved comparison decisions influence the generated draft.
- User edits survive regeneration.
- Draft includes source lineage.

### Phase 4: Review, Export, and Persistence

Deliverables:

- Compliance checklist.
- Source lineage drawer.
- Export readiness state.
- DOCX/HTML export.
- Workspace resume/delete.
- Local recovery fallback.

Exit criteria:

- User can complete flagship workflow end to end.
- Export includes final edited draft.
- Optional appendix includes checklist and lineage.

### Phase 5: Production Hardening

Deliverables:

- Gold-set tests.
- Browser verification.
- Payload confidentiality tests.
- Logging scrub.
- Performance optimization.
- Attorney UAT.

Exit criteria:

- MVP meets success metrics.
- No raw confidential test strings appear in network payloads or saved server state.
- Attorney UAT identifies no blocking usability issues.

---

## 20. Testing Strategy

### 20.1 Product Gold Sets

Create synthetic source bundles:

1. Trust, pour-over will, AHCD, financial POA, and prenup with aligned fiduciaries.
2. Estate packet with conflicting successor trustee, financial agent, and health care agent order.
3. Estate packet where the prenup preserves separate property but the trust funding schedule blurs classifications.
4. Estate packet where the pour-over will references an older trust date.
5. Estate packet plus new legal requirement with stale execution or disclosure language in one source.
5. Conflicting source documents with stale law in one source.

Each bundle should have expected:

- Extracted requirements.
- Known conflicts.
- Required additions.
- Language that must not be carried forward.
- Desired output sections.

### 20.2 UX Tests

Test that users can:

- Add and label sources.
- Find conflicts.
- Approve recommendations.
- Change drafting strategy.
- Generate a draft.
- Find why a paragraph exists.
- Find whether a requirement is satisfied.
- Export with or without appendix.

### 20.3 Technical Tests

- Unit tests for extraction utilities.
- Unit tests for comparison row models.
- API tests for analyze/generate/verify routes.
- Browser tests for flagship workflow.
- Export tests for generated DOCX/HTML.
- Persistence tests for save/resume/delete.
- Network payload tests for confidentiality strings.

---

## 21. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Comparison matrix becomes too noisy | User loses trust | Filter aggressively, group rows, hide low-value diffs |
| Source extraction misses important language | Bad draft | Show extraction confidence, allow manual source snippet selection |
| New-law analysis misses requirement | Compliance risk | Gold-set tests, attorney-editable requirements, verifier pass |
| Draft uses stale language | Legal risk | Conflict rows and stale-language checks before drafting |
| User cannot understand lineage UI | Low adoption | Make lineage paragraph-level and visually simple |
| Performance slow on large PDFs | Friction | File limits, progress, chunking, deferred OCR |
| Confidential data leaks via export route | Compliance failure | Prefer client-side export for rehydrated drafts |
| Product feels too complex | Adoption risk | Start with one flagship workflow and progressive disclosure |

---

## 22. Open Questions

1. Should Drafting Magic replace the existing Drafting mode eventually, or stay as an advanced drafting route?
2. What is the first supported output type: estate plan review memo, restated trust package, client signing memo, or funding instruction letter?
3. Should new law be pasted by the attorney, retrieved from public sources, or both?
4. Should the comparison matrix show exact source text by default or summaries with expandable text?
5. Should export include the compliance appendix by default?
6. Which client-side DOCX/PDF parsing libraries are acceptable for production?
7. What file size limit is acceptable for MVP?
8. Should workspaces be saved only locally until Phase 6 persistence is complete?
9. Should source lineage be paragraph-level in MVP or section-level first?
10. What should block export: missing requirement, low confidence, or only explicit attorney-required items?

---

## 23. Recommended First Build

Build a vertical slice around the flagship workflow:

> A trust, pour-over will, AHCD, financial POA, prenup, and one attorney-provided update produce one estate plan review memo or updated drafting packet.

Minimal vertical slice:

1. `/drafting-magic` page.
2. Upload or paste the five estate-planning source documents.
3. Label each as trust, pour-over will, AHCD, financial POA, or prenup.
4. Add one attorney-provided update or new-law instruction.
5. Generate comparison matrix.
6. Approve recommendations.
7. Generate new estate-planning draft or review memo.
8. Show compliance checklist.
9. Export HTML or DOCX.

This slice proves the product: multi-source synthesis, new-law update, traceable draft, and attorney review.

---

## 24. Definition of Done for MVP

Drafting Magic MVP is done when:

- An attorney can complete the flagship workflow without developer assistance.
- The product produces a comparison matrix before draft generation.
- The attorney can modify recommendations before drafting.
- The generated draft includes a source lineage map.
- The generated draft includes a requirement-by-requirement compliance checklist.
- The attorney can edit and export the draft.
- Work is recoverable after refresh.
- Synthetic confidentiality strings do not appear in server-visible saved state or network payloads in validated tests.
- The experience is clearly differentiated from ordinary chat.
