# Product Requirements Document: Legal Document Drafting System

## Document Information

| Field | Value |
|-------|-------|
| **Document Title** | PRD: Multi-Agent Legal Document Drafting System |
| **Version** | 1.0 |
| **Status** | Draft |
| **Created** | January 30, 2026 |
| **Last Updated** | January 30, 2026 |
| **Author** | California Law Chatbot Team |
| **Repository Branch** | `feature/document-drafting` |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Objectives](#3-goals-and-objectives)
4. [User Stories](#4-user-stories)
5. [System Architecture](#5-system-architecture)
6. [Agent Specifications](#6-agent-specifications)
7. [Document Types and Templates](#7-document-types-and-templates)
8. [API Specifications](#8-api-specifications)
9. [Data Models and Types](#9-data-models-and-types)
10. [Frontend Components](#10-frontend-components)
11. [Integration Points](#11-integration-points)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Strategy](#13-testing-strategy)
14. [Security and Compliance](#14-security-and-compliance)
15. [Performance Requirements](#15-performance-requirements)
16. [Cost Analysis](#16-cost-analysis)
17. [Risk Assessment](#17-risk-assessment)
18. [Success Metrics](#18-success-metrics)
19. [Appendices](#19-appendices)

---

## 1. Executive Summary

### 1.1 Overview

This PRD defines the implementation of a multi-agent document drafting system for the California Law Chatbot. The system transforms the existing legal research assistant into a full-cycle legal AI platform capable of generating court-ready legal documents.

### 1.2 Key Innovation

The system uses a **multi-agent orchestration architecture** powered by the Claude Agent SDK, where a top-level orchestrator agent coordinates specialized sub-agents (research, drafting, citation, verification) working in parallel to produce high-quality legal documents.

### 1.3 Competitive Advantage

| Capability | Harvey | Clio | Our System |
|------------|--------|------|------------|
| California specialization | ❌ | ❌ | ✅ |
| CEB practice guide integration | ❌ | ❌ | ✅ (77,406 vectors) |
| Two-pass AI verification | ✅ | ❌ | ✅ |
| Multi-agent architecture | ✅ | ❌ | ✅ |
| Open source | ❌ | ❌ | ✅ |
| Cost per document | $$$$ | $$$ | $ (~$0.10-0.50) |

### 1.4 Scope

**In Scope:**
- Multi-agent orchestration system
- 6 initial document types (memo, motion, letter, contract, pleading, trust)
- Section-by-section generation with parallel execution
- Citation verification and formatting
- PDF and DOCX export
- Iterative refinement workflow
- Integration with existing CEB RAG and verification systems

**Out of Scope (Future Phases):**
- Real-time collaboration features
- Case management system integration
- Custom template builder UI
- E-filing integration
- Multi-jurisdiction support (non-California)

---

## 2. Problem Statement

### 2.1 Current State

The California Law Chatbot excels at legal research and verification but cannot:
- Generate structured legal documents
- Produce court-compliant formatted output
- Support iterative document refinement
- Export to standard legal formats (PDF/DOCX)

### 2.2 User Pain Points

1. **Manual Document Creation**: After receiving research results, users must manually draft documents
2. **Citation Formatting**: Users must manually format citations to Bluebook/California style
3. **Compliance Burden**: Users must ensure documents meet California Rules of Court
4. **Iteration Friction**: No way to refine AI output iteratively
5. **Export Limitations**: Current system only supports copy/paste and print

### 2.3 Market Opportunity

California has 190,000+ active attorneys. Document drafting is 30-40% of billable work. A specialized California drafting tool addresses an underserved market segment dominated by expensive enterprise solutions.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

| Goal | Metric | Target |
|------|--------|--------|
| Generate accurate legal documents | Verification pass rate | >90% |
| Reduce drafting time | Time to first draft | <2 minutes |
| Support iterative refinement | Revisions per document | 3-5 supported |
| Produce court-ready output | Format compliance | 100% CRC compliant |
| Maintain cost efficiency | Cost per document | <$0.50 average |

### 3.2 Secondary Goals

- Leverage existing CEB RAG investment (77,406 embeddings)
- Maintain existing research functionality
- Provide seamless mode switching (research ↔ drafting)
- Support all 5 CEB verticals in document generation

### 3.3 Non-Goals

- Replace attorney judgment or review
- Provide legal advice
- Support jurisdictions outside California
- Integrate with external case management (this phase)

---

## 4. User Stories

### 4.1 Core User Stories

#### US-1: Basic Document Generation
```
As a California attorney,
I want to request a legal document by describing what I need,
So that I can get a first draft without starting from scratch.

Acceptance Criteria:
- User can describe document need in natural language
- System identifies document type automatically
- System generates complete document with all required sections
- Document includes proper California citations
- Generation completes in <2 minutes
```

#### US-2: Iterative Refinement
```
As a California attorney,
I want to request changes to specific sections of a generated document,
So that I can refine the draft to my needs without regenerating everything.

Acceptance Criteria:
- User can select specific section to modify
- User can provide natural language revision instructions
- System regenerates only the affected section
- Other sections maintain coherence with changes
- Revision completes in <30 seconds
```

#### US-3: Citation Verification
```
As a California attorney,
I want all citations in my document verified against authoritative sources,
So that I can trust the legal authorities cited are accurate.

Acceptance Criteria:
- All case citations verified against CourtListener
- All statutory citations verified against California codes
- Invalid citations flagged with explanation
- Verified citations include direct links to sources
- Table of Authorities auto-generated
```

#### US-4: Document Export
```
As a California attorney,
I want to export my document in court-compliant formats,
So that I can file it or share it with clients.

Acceptance Criteria:
- Export to PDF with proper formatting (CRC 2.104 compliant)
- Export to DOCX for further editing
- Include page numbers, headers, footers
- Option for line numbers (required for some filings)
- Table of Contents for documents >10 pages
```

#### US-5: CEB-Informed Drafting
```
As a California attorney,
I want my documents to incorporate CEB practice guide best practices,
So that I can benefit from authoritative model language.

Acceptance Criteria:
- System searches CEB for relevant model language
- CEB sources cited in generated documents
- Model clauses from CEB used where appropriate
- CEB citations properly formatted
```

### 4.2 Secondary User Stories

#### US-6: Variable Management
```
As a California attorney,
I want to fill in document variables (client name, dates, amounts) once,
So that they're applied consistently throughout the document.

Acceptance Criteria:
- System identifies required variables
- User prompted to fill variables before generation
- Variables applied consistently throughout document
- User can edit variables and regenerate
```

#### US-7: Template Selection
```
As a California attorney,
I want to choose from pre-built document templates,
So that I can start with the right structure for my needs.

Acceptance Criteria:
- Template library with 6+ document types
- Templates organized by practice area
- Preview of template structure before selection
- Templates follow California conventions
```

#### US-8: Progress Visibility
```
As a California attorney,
I want to see the progress of document generation,
So that I know the system is working and what stage it's at.

Acceptance Criteria:
- Progress indicator shows current stage
- Stages: Research → Drafting → Citations → Verification
- Each completed section shown as it's ready
- Estimated time remaining displayed
```

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Mode Selector   │  │ Document Editor │  │ Variable Input Panel        │  │
│  │ [Research|Draft]│  │ (Preview/Edit)  │  │ (Client, Matter, Dates)     │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│           └────────────────────┼──────────────────────────┘                  │
│                                │                                             │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      Chat/Instruction Panel                            │  │
│  │  "Draft a motion to compel discovery responses..."                     │  │
│  └─────────────────────────────┬─────────────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │ WebSocket / SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Vercel Serverless)                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    /api/orchestrate-document.ts                      │    │
│  │                         (Entry Point)                                │    │
│  └─────────────────────────────┬───────────────────────────────────────┘    │
│                                │                                             │
│  ┌─────────────────────────────▼───────────────────────────────────────┐    │
│  │                      ORCHESTRATOR AGENT                              │    │
│  │                    (Claude Sonnet 4.5)                               │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ Tools:                                                       │    │    │
│  │  │ • spawn_research_agent    • get_document_status             │    │    │
│  │  │ • spawn_drafter_agent     • merge_sections                  │    │    │
│  │  │ • spawn_citation_agent    • request_revision                │    │    │
│  │  │ • spawn_verifier_agent    • approve_document                │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────┬───────────────────────────────────────┘    │
│                                │                                             │
│         ┌──────────────────────┼──────────────────────┐                     │
│         │                      │                      │                     │
│         ▼                      ▼                      ▼                     │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐               │
│  │  RESEARCH   │       │  DRAFTER    │       │  CITATION   │               │
│  │   AGENT     │       │  AGENT(s)   │       │   AGENT     │               │
│  │ (Haiku 4.5) │       │(Gemini 2.5) │       │ (Haiku 4.5) │               │
│  └──────┬──────┘       └──────┬──────┘       └──────┬──────┘               │
│         │                     │                     │                       │
│         │                     │                     │                       │
│         ▼                     ▼                     ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         VERIFIER AGENT                               │   │
│  │                       (Claude Sonnet 4.5)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  EXISTING APIs  │     │  EXISTING APIs  │     │  EXISTING APIs  │
│                 │     │                 │     │                 │
│ /api/ceb-search │     │/api/courtlistener│    │/api/gemini-chat │
│ (Upstash Vector)│     │ (Case Law)      │     │ (Generation)    │
│                 │     │                 │     │                 │
│/api/openstates  │     │/api/legiscan    │     │/api/claude-chat │
│ (Legislation)   │     │ (Bill Text)     │     │ (Verification)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Upstash Vector  │     │  CourtListener  │     │   Anthropic     │
│ (77,406 CEB     │     │  API v4         │     │   Claude API    │
│  embeddings)    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 5.2 Agent Communication Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT GENERATION FLOW                           │
└──────────────────────────────────────────────────────────────────────────┘

User Request: "Draft a motion to compel discovery responses"
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ORCHESTRATOR INITIALIZATION                                      │
│                                                                           │
│  1. Parse user request                                                    │
│  2. Identify document type: "motion_to_compel"                           │
│  3. Load template with required sections                                  │
│  4. Initialize AgentContext with document metadata                        │
│  5. Transition to Phase 2                                                 │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: PARALLEL RESEARCH                                                │
│                                                                           │
│  Orchestrator spawns research agents in parallel:                         │
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Research-CEB    │  │ Research-Cases  │  │ Research-Statutes│          │
│  │                 │  │                 │  │                 │           │
│  │ Query: "motion  │  │ Query: "motion  │  │ Query: CCP      │           │
│  │ to compel       │  │ to compel       │  │ 2030.300,       │           │
│  │ discovery CEB"  │  │ California"     │  │ 2031.310        │           │
│  │                 │  │                 │  │                 │           │
│  │ Tool: ceb_search│  │ Tool:           │  │ Tool: ceb_search│           │
│  │                 │  │ courtlistener   │  │ (statute filter)│           │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │
│           │                    │                    │                     │
│           └────────────────────┼────────────────────┘                     │
│                                ▼                                          │
│                    ┌─────────────────────┐                                │
│                    │  RESEARCH PACKAGE   │                                │
│                    │  • CEB sections     │                                │
│                    │  • Key cases        │                                │
│                    │  • Statutory text   │                                │
│                    │  • Model language   │                                │
│                    └─────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PARALLEL DRAFTING                                                │
│                                                                           │
│  Orchestrator spawns drafter agents in parallel (where possible):         │
│                                                                           │
│  Input to each drafter:                                                   │
│  • Section name and requirements                                          │
│  • Research package (relevant portions)                                   │
│  • Template instructions                                                  │
│  • Previous sections (for coherence, if sequential)                       │
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Drafter-1       │  │ Drafter-2       │  │ Drafter-3       │           │
│  │                 │  │                 │  │                 │           │
│  │ Sections:       │  │ Sections:       │  │ Sections:       │           │
│  │ • Caption       │  │ • Legal Standard│  │ • Conclusion    │           │
│  │ • Introduction  │  │ • Argument      │  │ • Declaration   │           │
│  │ • Facts         │  │                 │  │                 │           │
│  │ • Meet & Confer │  │                 │  │                 │           │
│  │                 │  │                 │  │                 │           │
│  │ Model: Gemini   │  │ Model: Gemini   │  │ Model: Gemini   │           │
│  │ 2.5 Pro         │  │ 2.5 Pro         │  │ 2.5 Pro         │           │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │
│           │                    │                    │                     │
│           └────────────────────┼────────────────────┘                     │
│                                ▼                                          │
│                    ┌─────────────────────┐                                │
│                    │   DRAFT SECTIONS    │                                │
│                    │   (Markdown format) │                                │
│                    └─────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: CITATION PROCESSING                                              │
│                                                                           │
│  Citation Agent processes all drafted sections:                           │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ CITATION AGENT (Claude Haiku 4.5)                                   │ │
│  │                                                                      │ │
│  │ For each citation in document:                                       │ │
│  │ 1. Extract citation text                                            │ │
│  │ 2. Verify against CourtListener (cases) or leginfo.ca.gov (statutes)│ │
│  │ 3. Get canonical citation format                                    │ │
│  │ 4. Add verification status                                          │ │
│  │ 5. Generate hyperlink                                               │ │
│  │                                                                      │ │
│  │ Output:                                                              │ │
│  │ • Verified citations with URLs                                       │ │
│  │ • Flagged unverifiable citations                                    │ │
│  │ • Table of Authorities                                              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: VERIFICATION                                                     │
│                                                                           │
│  Verifier Agent performs final quality check:                             │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ VERIFIER AGENT (Claude Sonnet 4.5)                                  │ │
│  │                                                                      │ │
│  │ Checks:                                                              │ │
│  │ 1. All legal claims have citation support                           │ │
│  │ 2. Citations are accurate and properly formatted                    │ │
│  │ 3. Document is internally consistent                                │ │
│  │ 4. All required sections present                                    │ │
│  │ 5. California-specific requirements met                             │ │
│  │ 6. No placeholder text remaining (except intentional variables)     │ │
│  │                                                                      │ │
│  │ Output:                                                              │ │
│  │ • Verification report                                                │ │
│  │ • List of issues/warnings                                           │ │
│  │ • Quality score (0-100)                                             │ │
│  │ • Recommended revisions                                             │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: ASSEMBLY & DELIVERY                                              │
│                                                                           │
│  Orchestrator:                                                            │
│  1. Reviews verification report                                           │
│  2. Merges all sections in correct order                                 │
│  3. Applies final formatting                                              │
│  4. Generates document metadata                                           │
│  5. Returns to frontend via streaming response                            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ FINAL OUTPUT                                                         │ │
│  │                                                                      │ │
│  │ {                                                                    │ │
│  │   "document": { sections, metadata, formatting },                    │ │
│  │   "verificationReport": { score, claims, issues },                   │ │
│  │   "citations": { verified, unverified, tableOfAuthorities },         │ │
│  │   "exportOptions": { pdf, docx, print }                              │ │
│  │ }                                                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Revision Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           REVISION FLOW                                   │
└──────────────────────────────────────────────────────────────────────────┘

User: "Make the meet and confer section more detailed, emphasizing good faith efforts"
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR                                                              │
│                                                                           │
│ 1. Parse revision request                                                 │
│ 2. Identify affected section(s): "meet_and_confer"                       │
│ 3. Preserve other sections unchanged                                      │
│ 4. Spawn targeted drafter agent                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ TARGETED DRAFTING                                                         │
│                                                                           │
│ Drafter Agent receives:                                                   │
│ • Original section content                                                │
│ • User's revision instructions                                            │
│ • Adjacent sections (for coherence)                                       │
│ • Research package (if additional research needed)                        │
│                                                                           │
│ Outputs: Revised section only                                             │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ INCREMENTAL VERIFICATION                                                  │
│                                                                           │
│ Citation Agent: Re-verify only new/changed citations                      │
│ Verifier Agent: Check coherence with unchanged sections                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ MERGE & RETURN                                                            │
│                                                                           │
│ Orchestrator:                                                             │
│ 1. Replace old section with revised section                               │
│ 2. Update document metadata (revision count, timestamp)                   │
│ 3. Return updated document                                                │
│                                                                           │
│ Result: <30 second turnaround for single-section revision                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Agent Specifications

### 6.1 Orchestrator Agent

**Purpose**: Coordinate all sub-agents and manage document generation workflow.

**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250514`)

**System Prompt**:
```
You are a senior California attorney orchestrating legal document preparation. You coordinate specialized sub-agents to produce high-quality legal documents.

WORKFLOW:
1. Analyze user request to determine document type and required sections
2. Spawn research agent(s) to gather relevant California legal authorities
3. Once research is complete, spawn drafter agents (in parallel where possible) for each section
4. Spawn citation agent to verify and format all legal citations
5. Spawn verifier agent for final quality control
6. Merge all sections and return the complete document

RULES:
- You coordinate but do NOT write document content yourself
- Always complete research phase before drafting phase
- Ensure all sections maintain coherence and consistent voice
- Flag any issues from sub-agents for user attention
- Track token usage and provide cost estimates

CALIFORNIA-SPECIFIC:
- All documents must comply with California Rules of Court
- Citations must follow California Style Manual (for state courts) or Bluebook (for federal)
- Ensure statutory references use current California codes
```

**Tools**:

```typescript
const orchestratorTools: Tool[] = [
  {
    name: 'spawn_research_agent',
    description: 'Spawn a research agent to gather legal authorities from specified sources',
    input_schema: {
      type: 'object',
      properties: {
        research_query: {
          type: 'string',
          description: 'The legal research query'
        },
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['ceb', 'courtlistener', 'statutes', 'openstates', 'legiscan'] },
          description: 'Sources to search'
        },
        focus_areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific legal topics to focus on'
        }
      },
      required: ['research_query', 'sources']
    }
  },
  {
    name: 'spawn_drafter_agent',
    description: 'Spawn a drafter agent to write specific document section(s)',
    input_schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section_id: { type: 'string' },
              section_name: { type: 'string' },
              requirements: { type: 'string' },
              max_length_words: { type: 'number' }
            },
            required: ['section_id', 'section_name']
          },
          description: 'Sections to draft'
        },
        research_context: {
          type: 'string',
          description: 'Relevant research findings to use'
        },
        previous_sections_summary: {
          type: 'string',
          description: 'Summary of previously drafted sections for coherence'
        },
        style_instructions: {
          type: 'string',
          description: 'Tone and style instructions'
        }
      },
      required: ['sections']
    }
  },
  {
    name: 'spawn_citation_agent',
    description: 'Spawn citation agent to verify and format all citations in the document',
    input_schema: {
      type: 'object',
      properties: {
        document_content: {
          type: 'string',
          description: 'Full document content with citations to verify'
        },
        citation_style: {
          type: 'string',
          enum: ['california', 'bluebook'],
          description: 'Citation style to use'
        },
        generate_toa: {
          type: 'boolean',
          description: 'Whether to generate Table of Authorities'
        }
      },
      required: ['document_content']
    }
  },
  {
    name: 'spawn_verifier_agent',
    description: 'Spawn verifier agent for final quality control',
    input_schema: {
      type: 'object',
      properties: {
        document_content: {
          type: 'string',
          description: 'Complete document to verify'
        },
        research_package: {
          type: 'string',
          description: 'Research package for verification'
        },
        document_type: {
          type: 'string',
          description: 'Type of document for type-specific checks'
        }
      },
      required: ['document_content', 'document_type']
    }
  },
  {
    name: 'merge_sections',
    description: 'Merge all drafted sections into final document',
    input_schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section_id: { type: 'string' },
              content: { type: 'string' },
              order: { type: 'number' }
            }
          }
        },
        document_metadata: {
          type: 'object',
          description: 'Metadata to include (title, date, parties, etc.)'
        }
      },
      required: ['sections']
    }
  },
  {
    name: 'request_revision',
    description: 'Request revision of a specific section from drafter agent',
    input_schema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'Section to revise'
        },
        current_content: {
          type: 'string',
          description: 'Current section content'
        },
        revision_instructions: {
          type: 'string',
          description: 'What changes to make'
        }
      },
      required: ['section_id', 'revision_instructions']
    }
  },
  {
    name: 'get_document_status',
    description: 'Get current status of document generation',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'report_progress',
    description: 'Report progress to user interface',
    input_schema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['research', 'drafting', 'citations', 'verification', 'complete']
        },
        message: {
          type: 'string'
        },
        percent_complete: {
          type: 'number'
        }
      },
      required: ['phase', 'message']
    }
  }
];
```

**Max Iterations**: 20
**Timeout**: 120 seconds

---

### 6.2 Research Agent

**Purpose**: Gather relevant legal authorities from all available sources.

**Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20250514`) - fast, cost-effective for tool-heavy work

**System Prompt**:
```
You are a legal research specialist for California law. Your job is to gather comprehensive, relevant legal authorities for document drafting.

SOURCES AVAILABLE:
- CEB Practice Guides (via ceb_search): Authoritative California legal practice guides
- CourtListener (via courtlistener_search): California and federal case law
- California Codes (via ceb_search with statute filter): Current statutory text
- OpenStates/LegiScan (via legislative_search): Recent legislation and bill tracking

RESEARCH METHODOLOGY:
1. Identify the core legal issues in the query
2. Search CEB first for practice guide coverage and model language
3. Find controlling California cases (Supreme Court > Court of Appeal)
4. Locate applicable statutes with exact section numbers
5. Check for recent legislative changes if relevant

OUTPUT FORMAT:
Return a structured research package with:
- key_authorities: Ranked list of most relevant authorities
- ceb_sources: Relevant CEB sections with excerpts
- case_law: Key cases with holdings summarized
- statutes: Applicable statutory text
- model_language: Sample language from CEB if available
- research_notes: Any caveats or areas requiring additional research

Be thorough but focused. Quality over quantity. Prioritize California-specific authorities.
```

**Tools**:

```typescript
const researchTools: Tool[] = [
  {
    name: 'ceb_search',
    description: 'Search CEB practice guides for relevant content. Use for authoritative California legal guidance and model language.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for CEB content'
        },
        categories: {
          type: 'array',
          items: { 
            type: 'string', 
            enum: ['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'] 
          },
          description: 'CEB categories to search (optional, searches all if not specified)'
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (default 5, max 10)'
        },
        include_statutes: {
          type: 'boolean',
          description: 'Enable statutory citation pre-filter for statute-related queries'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'courtlistener_search',
    description: 'Search CourtListener for California case law',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Case law search query'
        },
        court_filter: {
          type: 'string',
          enum: ['california_all', 'california_supreme', 'california_appeals', 'federal_ninth', 'all'],
          description: 'Court filter'
        },
        date_after: {
          type: 'string',
          description: 'Only cases after this date (YYYY-MM-DD)'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of cases to return'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'legislative_search',
    description: 'Search for California legislation via OpenStates and LegiScan',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legislative search query'
        },
        bill_number: {
          type: 'string',
          description: 'Specific bill number (e.g., AB 123, SB 456)'
        },
        session_year: {
          type: 'string',
          description: 'Legislative session year'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'verify_citation',
    description: 'Verify a specific legal citation exists and get canonical form',
    input_schema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Citation to verify (case name or statutory citation)'
        },
        citation_type: {
          type: 'string',
          enum: ['case', 'statute', 'regulation'],
          description: 'Type of citation'
        }
      },
      required: ['citation']
    }
  }
];
```

**Max Iterations**: 10
**Timeout**: 60 seconds

---

### 6.3 Drafter Agent

**Purpose**: Write specific document sections using provided research.

**Model**: Google Gemini 2.5 Pro (`gemini-2.5-pro`) - excellent at long-form generation with Google grounding

**System Prompt**:
```
You are a skilled legal writer drafting sections of California legal documents. You write in formal legal style appropriate for court filings and professional correspondence.

WRITING REQUIREMENTS:
1. Use formal legal writing style - clear, precise, professional
2. Cite authorities in proper format: [Case Name, Citation] or [Code § Section]
3. Use active voice where possible
4. Each paragraph should have a clear purpose
5. Maintain consistent terminology throughout
6. Use proper California legal terminology

CITATION FORMAT:
- Cases: People v. Smith (2020) 50 Cal.App.5th 123, 125
- Statutes: Cal. Code Civ. Proc. § 2030.300
- CEB: See CEB Cal. Civil Discovery Practice § 8.32

PLACEHOLDER FORMAT:
Use brackets for information to be filled in by user:
- [CLIENT NAME]
- [OPPOSING PARTY]
- [DATE]
- [SPECIFIC FACT]

SECTION COHERENCE:
- Reference previous sections appropriately ("As discussed above...")
- Maintain consistent party references
- Build arguments progressively
- Ensure smooth transitions between sections

OUTPUT:
Return the section in clean markdown format. Include all citations inline.
```

**Tools**:

```typescript
const drafterTools: Tool[] = [
  {
    name: 'get_research_context',
    description: 'Retrieve research package for this document',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Specific topic to get research for'
        }
      }
    }
  },
  {
    name: 'get_previous_sections',
    description: 'Get content of previously drafted sections for coherence',
    input_schema: {
      type: 'object',
      properties: {
        section_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of sections to retrieve'
        }
      }
    }
  },
  {
    name: 'get_template_requirements',
    description: 'Get specific requirements for this section from the template',
    input_schema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'Section ID to get requirements for'
        }
      },
      required: ['section_id']
    }
  },
  {
    name: 'get_model_language',
    description: 'Get CEB model language for a specific type of content',
    input_schema: {
      type: 'object',
      properties: {
        content_type: {
          type: 'string',
          description: 'Type of content (e.g., "meet and confer letter", "discovery response")'
        }
      },
      required: ['content_type']
    }
  },
  {
    name: 'submit_section',
    description: 'Submit completed section draft',
    input_schema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string'
        },
        content: {
          type: 'string',
          description: 'Markdown content of the section'
        },
        citations_used: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of citations used in this section'
        },
        word_count: {
          type: 'number'
        }
      },
      required: ['section_id', 'content']
    }
  }
];
```

**Max Iterations**: 5 per section
**Timeout**: 45 seconds per section

---

### 6.4 Citation Agent

**Purpose**: Verify, format, and link all legal citations.

**Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20250514`)

**System Prompt**:
```
You are a legal citation specialist ensuring all citations in the document are accurate and properly formatted.

VERIFICATION PROCESS:
For each citation:
1. Extract the citation text
2. Determine citation type (case, statute, regulation, secondary source)
3. Verify existence via appropriate tool
4. Get canonical citation format
5. Generate hyperlink to source
6. Mark verification status

CALIFORNIA CITATION RULES:
- California cases: People v. Smith (2020) 50 Cal.App.5th 123
- California statutes: Cal. [Code] Code § [section]
- California regulations: Cal. Code Regs. tit. [X], § [Y]
- Short forms after first citation: Smith, supra, at 125

TABLE OF AUTHORITIES:
Generate a TOA with:
- Cases (alphabetical)
- Statutes (by code, then section)
- Secondary sources
- Page references for each

OUTPUT:
Return:
1. List of all citations with verification status
2. Any citations that could not be verified (with explanation)
3. Table of Authorities in proper format
4. Updated document content with hyperlinks
```

**Tools**:

```typescript
const citationTools: Tool[] = [
  {
    name: 'verify_case_citation',
    description: 'Verify a case citation against CourtListener',
    input_schema: {
      type: 'object',
      properties: {
        case_name: {
          type: 'string',
          description: 'Name of the case (e.g., "People v. Smith")'
        },
        citation: {
          type: 'string',
          description: 'Full citation if available'
        },
        year: {
          type: 'number',
          description: 'Year of decision if known'
        }
      },
      required: ['case_name']
    }
  },
  {
    name: 'verify_statute_citation',
    description: 'Verify a California statutory citation',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'California code name (e.g., "Code of Civil Procedure", "Family Code")'
        },
        section: {
          type: 'string',
          description: 'Section number'
        }
      },
      required: ['code', 'section']
    }
  },
  {
    name: 'get_citation_url',
    description: 'Get the URL for a verified citation',
    input_schema: {
      type: 'object',
      properties: {
        citation_type: {
          type: 'string',
          enum: ['case', 'statute']
        },
        identifier: {
          type: 'string',
          description: 'Unique identifier (CourtListener ID or statute code+section)'
        }
      },
      required: ['citation_type', 'identifier']
    }
  },
  {
    name: 'format_citation',
    description: 'Format a citation according to specified style',
    input_schema: {
      type: 'object',
      properties: {
        raw_citation: {
          type: 'string'
        },
        style: {
          type: 'string',
          enum: ['california', 'bluebook']
        },
        is_first_reference: {
          type: 'boolean',
          description: 'Whether this is the first reference to this authority'
        }
      },
      required: ['raw_citation', 'style']
    }
  },
  {
    name: 'generate_table_of_authorities',
    description: 'Generate Table of Authorities from citation list',
    input_schema: {
      type: 'object',
      properties: {
        citations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              citation: { type: 'string' },
              type: { type: 'string' },
              page_references: { type: 'array', items: { type: 'number' } }
            }
          }
        }
      },
      required: ['citations']
    }
  }
];
```

**Max Iterations**: 15 (depends on citation count)
**Timeout**: 60 seconds

---

### 6.5 Verifier Agent

**Purpose**: Final quality control and consistency check.

**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250514`) - accuracy-critical, needs strong reasoning

**System Prompt**:
```
You are a senior associate performing final review of a legal document before it goes to a partner. Your job is to catch any errors, inconsistencies, or issues.

VERIFICATION CHECKLIST:

1. CITATION ACCURACY
   - Every legal claim should have citation support
   - Citations should match the claims they support
   - No hallucinated or fabricated authorities

2. INTERNAL CONSISTENCY
   - Party names used consistently throughout
   - Dates and facts consistent across sections
   - No contradictory statements
   - Arguments build logically

3. COMPLETENESS
   - All required sections present
   - No [PLACEHOLDER] text remaining (except intentional variables)
   - Introduction matches conclusion
   - All issues raised are addressed

4. CALIFORNIA-SPECIFIC
   - Correct California court names
   - Proper California code citations
   - California Rules of Court compliance
   - Current law (no overruled cases)

5. QUALITY STANDARDS
   - Professional tone throughout
   - Clear and precise language
   - Proper legal terminology
   - Appropriate document length

OUTPUT:
Return a verification report with:
- overall_score: 0-100 quality score
- verified_claims: List of claims with citation support
- issues: List of problems found with severity (error/warning/suggestion)
- recommendations: Specific fixes for any issues
- approval_status: 'approved' | 'needs_revision' | 'rejected'
```

**Tools**:

```typescript
const verifierTools: Tool[] = [
  {
    name: 'extract_claims',
    description: 'Extract all factual and legal claims from text',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to extract claims from'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'verify_claim_support',
    description: 'Check if a claim is supported by the provided citation',
    input_schema: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The claim being made'
        },
        citation: {
          type: 'string',
          description: 'The citation provided as support'
        },
        source_excerpt: {
          type: 'string',
          description: 'Excerpt from the source to verify against'
        }
      },
      required: ['claim', 'citation']
    }
  },
  {
    name: 'check_case_status',
    description: 'Check if a case is still good law (not overruled)',
    input_schema: {
      type: 'object',
      properties: {
        case_citation: {
          type: 'string'
        }
      },
      required: ['case_citation']
    }
  },
  {
    name: 'check_document_structure',
    description: 'Verify document has all required sections for its type',
    input_schema: {
      type: 'object',
      properties: {
        document_type: {
          type: 'string'
        },
        sections_present: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['document_type', 'sections_present']
    }
  },
  {
    name: 'flag_issue',
    description: 'Flag an issue found during verification',
    input_schema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'suggestion']
        },
        category: {
          type: 'string',
          enum: ['citation', 'consistency', 'completeness', 'accuracy', 'formatting']
        },
        description: {
          type: 'string'
        },
        location: {
          type: 'string',
          description: 'Section or line where issue was found'
        },
        suggested_fix: {
          type: 'string'
        }
      },
      required: ['severity', 'category', 'description']
    }
  },
  {
    name: 'submit_verification_report',
    description: 'Submit final verification report',
    input_schema: {
      type: 'object',
      properties: {
        overall_score: {
          type: 'number',
          description: 'Quality score 0-100'
        },
        approval_status: {
          type: 'string',
          enum: ['approved', 'needs_revision', 'rejected']
        },
        summary: {
          type: 'string'
        }
      },
      required: ['overall_score', 'approval_status', 'summary']
    }
  }
];
```

**Max Iterations**: 10
**Timeout**: 90 seconds

---

## 7. Document Types and Templates

### 7.1 Supported Document Types (Phase 1)

| Document Type | ID | Practice Area | CEB Coverage | Complexity |
|--------------|-----|---------------|--------------|------------|
| Legal Memorandum | `legal_memo` | All | All verticals | Medium |
| Motion to Compel | `motion_compel` | Litigation | Business Litigation | High |
| Demand Letter | `demand_letter` | All | Business Litigation | Low |
| Client Letter | `client_letter` | All | All verticals | Low |
| Discovery Request | `discovery_request` | Litigation | Business Litigation | Medium |
| Trust Document | `trust_basic` | Estate Planning | Trusts & Estates | High |

### 7.2 Template Structure

Each template is defined as a JSON configuration:

```typescript
// File: templates/legal_memo.json
{
  "id": "legal_memo",
  "name": "Legal Research Memorandum",
  "description": "Internal legal memorandum analyzing a legal question",
  "practice_areas": ["all"],
  "ceb_categories": ["all"],
  
  "variables": [
    {
      "id": "to",
      "name": "To",
      "type": "text",
      "required": true,
      "placeholder": "Partner Name"
    },
    {
      "id": "from", 
      "name": "From",
      "type": "text",
      "required": true,
      "placeholder": "Associate Name"
    },
    {
      "id": "client_matter",
      "name": "Client/Matter",
      "type": "text",
      "required": true,
      "placeholder": "Client Name / Matter Description"
    },
    {
      "id": "date",
      "name": "Date",
      "type": "date",
      "required": true,
      "default": "today"
    },
    {
      "id": "subject",
      "name": "Re",
      "type": "text",
      "required": true,
      "placeholder": "Subject of memorandum"
    }
  ],
  
  "sections": [
    {
      "id": "header",
      "name": "Header",
      "order": 1,
      "type": "template",
      "content": "MEMORANDUM\n\nTO: {{to}}\nFROM: {{from}}\nDATE: {{date}}\nRE: {{subject}}\nCLIENT/MATTER: {{client_matter}}",
      "editable": false
    },
    {
      "id": "question_presented",
      "name": "Question Presented",
      "order": 2,
      "type": "generated",
      "prompt_instruction": "Write a clear, concise statement of the legal question(s) to be analyzed. Frame as a question that can be answered yes/no or with a specific legal conclusion. Include key facts that affect the answer.",
      "max_length_words": 150,
      "required": true
    },
    {
      "id": "brief_answer",
      "name": "Brief Answer",
      "order": 3,
      "type": "generated", 
      "prompt_instruction": "Provide a direct answer to the question presented, followed by a brief explanation of the key reasons. This should be 2-4 sentences summarizing the conclusion.",
      "max_length_words": 200,
      "required": true
    },
    {
      "id": "facts",
      "name": "Statement of Facts",
      "order": 4,
      "type": "generated",
      "prompt_instruction": "Present the relevant facts in a clear, objective manner. Include all facts that are legally significant to the analysis. Use past tense. Do not include legal conclusions.",
      "max_length_words": 500,
      "required": true
    },
    {
      "id": "analysis",
      "name": "Analysis",
      "order": 5,
      "type": "generated",
      "prompt_instruction": "Provide detailed legal analysis applying the law to the facts. Structure with clear subheadings for each issue. Cite authorities for all legal propositions. Address counterarguments where relevant. Use IRAC or CREAC structure.",
      "max_length_words": 2000,
      "required": true,
      "subsections_allowed": true
    },
    {
      "id": "conclusion",
      "name": "Conclusion",
      "order": 6,
      "type": "generated",
      "prompt_instruction": "Summarize the analysis and provide practical recommendations. What should the client do? What are the risks? Are there alternative approaches?",
      "max_length_words": 300,
      "required": true
    }
  ],
  
  "formatting": {
    "font_family": "Times New Roman",
    "font_size": 12,
    "line_spacing": "double",
    "margins": {
      "top": 1,
      "bottom": 1,
      "left": 1,
      "right": 1
    },
    "page_numbers": true,
    "header_style": "centered"
  },
  
  "metadata": {
    "version": "1.0",
    "created": "2026-01-30",
    "author": "California Law Chatbot",
    "crc_compliance": null
  }
}
```

### 7.3 Motion to Compel Template

```typescript
// File: templates/motion_compel.json
{
  "id": "motion_compel",
  "name": "Motion to Compel Discovery Responses",
  "description": "Motion to compel further responses to discovery requests under CCP §§ 2030-2033",
  "practice_areas": ["civil_litigation"],
  "ceb_categories": ["business_litigation"],
  
  "variables": [
    {
      "id": "court_name",
      "name": "Court",
      "type": "select",
      "required": true,
      "options": [
        "Superior Court of California, County of Los Angeles",
        "Superior Court of California, County of San Francisco",
        "Superior Court of California, County of San Diego",
        "Superior Court of California, County of Orange",
        "Superior Court of California, County of [Other]"
      ]
    },
    {
      "id": "case_number",
      "name": "Case Number",
      "type": "text",
      "required": true,
      "placeholder": "XX-XXXXX"
    },
    {
      "id": "plaintiff",
      "name": "Plaintiff(s)",
      "type": "text",
      "required": true
    },
    {
      "id": "defendant",
      "name": "Defendant(s)",
      "type": "text",
      "required": true
    },
    {
      "id": "moving_party",
      "name": "Moving Party",
      "type": "text",
      "required": true
    },
    {
      "id": "responding_party",
      "name": "Responding Party",
      "type": "text",
      "required": true
    },
    {
      "id": "discovery_type",
      "name": "Discovery Type",
      "type": "select",
      "required": true,
      "options": [
        "Interrogatories (Form)",
        "Interrogatories (Special)",
        "Request for Production of Documents",
        "Request for Admissions",
        "Deposition"
      ]
    },
    {
      "id": "discovery_date",
      "name": "Date Discovery Served",
      "type": "date",
      "required": true
    },
    {
      "id": "response_date",
      "name": "Date Responses Received",
      "type": "date",
      "required": true
    },
    {
      "id": "hearing_date",
      "name": "Hearing Date",
      "type": "date",
      "required": true
    },
    {
      "id": "hearing_time",
      "name": "Hearing Time",
      "type": "text",
      "required": true,
      "placeholder": "9:00 a.m."
    },
    {
      "id": "department",
      "name": "Department",
      "type": "text",
      "required": true
    }
  ],
  
  "sections": [
    {
      "id": "caption",
      "name": "Caption",
      "order": 1,
      "type": "template",
      "content": "{{court_name}}\n\n{{plaintiff}},\n    Plaintiff(s),\n\nvs.\n\n{{defendant}},\n    Defendant(s).\n\nCase No. {{case_number}}\n\nNOTICE OF MOTION AND MOTION TO COMPEL FURTHER RESPONSES TO {{discovery_type | uppercase}}; MEMORANDUM OF POINTS AND AUTHORITIES; DECLARATION OF [ATTORNEY NAME]\n\nDate: {{hearing_date}}\nTime: {{hearing_time}}\nDept: {{department}}\n\nAction Filed: [DATE]\nTrial Date: [DATE]",
      "editable": false
    },
    {
      "id": "notice_of_motion",
      "name": "Notice of Motion",
      "order": 2,
      "type": "template",
      "content": "TO ALL PARTIES AND THEIR ATTORNEYS OF RECORD:\n\nPLEASE TAKE NOTICE that on {{hearing_date}}, at {{hearing_time}}, or as soon thereafter as the matter may be heard, in Department {{department}} of the above-entitled court, {{moving_party}} will and hereby does move the Court for an order compelling {{responding_party}} to provide further responses to {{discovery_type}}.\n\nThis motion is made on the grounds that {{responding_party}}'s responses are incomplete, evasive, and/or contain improper objections.\n\nThis motion is based on this Notice, the attached Memorandum of Points and Authorities, the Declaration of [ATTORNEY NAME], the exhibits attached thereto, and such other matters as may be presented at the hearing.",
      "editable": true
    },
    {
      "id": "introduction",
      "name": "Introduction",
      "order": 3,
      "type": "generated",
      "prompt_instruction": "Write a brief introduction (1-2 paragraphs) explaining what discovery is at issue, why the responses are deficient, and what relief is sought. Be factual and professional.",
      "max_length_words": 200,
      "required": true
    },
    {
      "id": "facts",
      "name": "Statement of Facts",
      "order": 4,
      "type": "generated",
      "prompt_instruction": "Describe the relevant procedural history: when discovery was served, when responses were due, when responses were received, and the deficiencies in the responses. Include meet and confer efforts.",
      "max_length_words": 400,
      "required": true
    },
    {
      "id": "meet_confer",
      "name": "Meet and Confer Declaration",
      "order": 5,
      "type": "generated",
      "prompt_instruction": "Detail the meet and confer efforts made in compliance with CCP § 2016.040. Include dates of communications, method of communication, positions of each party, and why agreement could not be reached. Emphasize good faith efforts.",
      "max_length_words": 500,
      "required": true,
      "legal_requirements": ["CCP § 2016.040"]
    },
    {
      "id": "legal_standard",
      "name": "Legal Standard",
      "order": 6,
      "type": "generated",
      "prompt_instruction": "Set forth the legal standards governing motions to compel further responses. Cite CCP § 2030.300 (interrogatories), § 2031.310 (document requests), or § 2033.290 (admissions) as applicable. Include standards for good cause (document requests) and proper objections.",
      "max_length_words": 400,
      "required": true,
      "legal_requirements": ["CCP § 2030.300", "CCP § 2031.310", "CCP § 2033.290"]
    },
    {
      "id": "argument",
      "name": "Argument",
      "order": 7,
      "type": "generated",
      "prompt_instruction": "Present the legal argument for why further responses should be compelled. Address each deficient response or category of responses. Explain why objections are improper (waived, meritless, or overbroad). For document requests, establish good cause. Cite relevant California authority.",
      "max_length_words": 1500,
      "required": true,
      "subsections_allowed": true
    },
    {
      "id": "sanctions",
      "name": "Request for Sanctions",
      "order": 8,
      "type": "generated",
      "prompt_instruction": "Request monetary sanctions under CCP § 2023.010 et seq. Explain that sanctions are mandatory unless the opposing party acted with substantial justification. Calculate reasonable attorney fees (hours × rate). Cite authority for sanctions.",
      "max_length_words": 300,
      "required": false,
      "legal_requirements": ["CCP § 2023.010", "CCP § 2023.030"]
    },
    {
      "id": "conclusion",
      "name": "Conclusion",
      "order": 9,
      "type": "generated",
      "prompt_instruction": "Summarize the relief requested: (1) order compelling further responses, (2) responses to be provided within X days, (3) monetary sanctions in amount of $X.",
      "max_length_words": 150,
      "required": true
    },
    {
      "id": "signature_block",
      "name": "Signature Block",
      "order": 10,
      "type": "template",
      "content": "Dated: [DATE]\n\nRespectfully submitted,\n\n[FIRM NAME]\n\n\nBy: _______________________\n    [ATTORNEY NAME]\n    Attorneys for {{moving_party}}",
      "editable": true
    }
  ],
  
  "formatting": {
    "font_family": "Times New Roman",
    "font_size": 12,
    "line_spacing": "double",
    "margins": {
      "top": 1,
      "bottom": 0.5,
      "left": 1,
      "right": 1
    },
    "page_numbers": true,
    "line_numbers": true,
    "footer": "MOTION TO COMPEL FURTHER RESPONSES"
  },
  
  "metadata": {
    "version": "1.0",
    "crc_compliance": ["CRC 3.1110", "CRC 3.1113", "CRC 3.1345"]
  }
}
```

### 7.4 Template File Structure

```
templates/
├── index.json                    # Template registry
├── legal_memo.json              # Legal memorandum
├── motion_compel.json           # Motion to compel
├── motion_summary_judgment.json # MSJ (Phase 2)
├── demand_letter.json           # Demand letter
├── client_letter.json           # Client correspondence
├── discovery_request.json       # Discovery requests
├── trust_basic.json             # Basic trust document
├── shared/
│   ├── court_captions.json      # Reusable court captions
│   ├── signature_blocks.json    # Reusable signature blocks
│   └── formatting_rules.json    # CRC formatting rules
└── README.md                    # Template documentation
```

---

## 8. API Specifications

### 8.1 New API Endpoints

#### 8.1.1 POST /api/orchestrate-document

**Purpose**: Main entry point for document generation

**Request**:
```typescript
interface OrchestrateDocumentRequest {
  // Document specification
  documentType: string;                    // Template ID (e.g., "legal_memo")
  userInstructions: string;                // Natural language description of what to draft
  variables?: Record<string, string>;      // Pre-filled template variables
  
  // Options
  options?: {
    citationStyle?: 'california' | 'bluebook';
    includeTableOfAuthorities?: boolean;
    maxLength?: 'short' | 'medium' | 'long';
    tone?: 'formal' | 'persuasive' | 'neutral';
  };
  
  // Context from existing chat (optional)
  conversationContext?: {
    previousMessages?: Array<{ role: string; content: string }>;
    existingResearch?: string;
  };
}
```

**Response** (Server-Sent Events / Streaming):
```typescript
// Progress events
interface ProgressEvent {
  type: 'progress';
  phase: 'research' | 'drafting' | 'citations' | 'verification' | 'complete';
  message: string;
  percentComplete: number;
  currentSection?: string;
}

// Section complete event
interface SectionCompleteEvent {
  type: 'section_complete';
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
}

// Final document event
interface DocumentCompleteEvent {
  type: 'document_complete';
  document: GeneratedDocument;
  verificationReport: VerificationReport;
  citations: CitationReport;
  metadata: DocumentMetadata;
}

// Error event
interface ErrorEvent {
  type: 'error';
  error: string;
  recoverable: boolean;
  suggestion?: string;
}
```

**Example cURL**:
```bash
curl -X POST https://your-app.vercel.app/api/orchestrate-document \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "documentType": "legal_memo",
    "userInstructions": "Draft a memo analyzing whether a revocable living trust protects assets from creditors under California law",
    "variables": {
      "to": "Senior Partner",
      "from": "Associate",
      "client_matter": "Smith Estate Planning"
    },
    "options": {
      "citationStyle": "california",
      "includeTableOfAuthorities": false
    }
  }'
```

#### 8.1.2 POST /api/revise-section

**Purpose**: Revise a specific section of a generated document

**Request**:
```typescript
interface ReviseSectionRequest {
  documentId: string;                      // ID of document being revised
  sectionId: string;                       // Section to revise
  revisionInstructions: string;            // What changes to make
  currentContent: string;                  // Current section content
  
  // Context
  adjacentSections?: {
    before?: string;
    after?: string;
  };
}
```

**Response**:
```typescript
interface ReviseSectionResponse {
  sectionId: string;
  revisedContent: string;
  changesSummary: string;
  wordCount: number;
  citationsChanged: string[];
}
```

#### 8.1.3 POST /api/export-document

**Purpose**: Export document to PDF or DOCX

**Request**:
```typescript
interface ExportDocumentRequest {
  document: GeneratedDocument;
  format: 'pdf' | 'docx' | 'html';
  
  formatting?: {
    includeLineNumbers?: boolean;
    includeTableOfContents?: boolean;
    includeTableOfAuthorities?: boolean;
    headerText?: string;
    footerText?: string;
  };
}
```

**Response**:
```typescript
interface ExportDocumentResponse {
  format: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;           // Temporary signed URL
  expiresAt: string;            // URL expiration timestamp
}
```

#### 8.1.4 GET /api/templates

**Purpose**: List available document templates

**Response**:
```typescript
interface TemplatesResponse {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    practiceAreas: string[];
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: string;       // e.g., "1-2 minutes"
    variables: VariableDefinition[];
  }>;
}
```

#### 8.1.5 GET /api/templates/:id

**Purpose**: Get full template specification

**Response**: Full template JSON as defined in Section 7.2

### 8.2 Modified Existing Endpoints

#### 8.2.1 POST /api/ceb-search (Enhanced)

**New parameter**:
```typescript
{
  // ... existing parameters ...
  
  // New: Return model language for drafting
  includeModelLanguage?: boolean;
  
  // New: Filter by section type
  sectionTypes?: Array<'checklist' | 'sample_language' | 'practice_tip' | 'form'>;
}
```

#### 8.2.2 POST /api/claude-chat (Enhanced)

**New mode for verification**:
```typescript
{
  // ... existing parameters ...
  
  // New: Verification mode
  mode?: 'chat' | 'verify_claims';
  
  // For verify_claims mode
  claims?: Array<{
    claim: string;
    citation: string;
    sourceExcerpt?: string;
  }>;
}
```

### 8.3 WebSocket Events (Optional Enhancement)

For real-time progress updates, consider WebSocket connection:

```typescript
// Client → Server
interface ClientMessage {
  type: 'subscribe_document';
  documentId: string;
}

// Server → Client
interface ServerMessage {
  type: 'progress' | 'section_complete' | 'complete' | 'error';
  payload: ProgressEvent | SectionCompleteEvent | DocumentCompleteEvent | ErrorEvent;
}
```

---

## 9. Data Models and Types

### 9.1 New Type Definitions

Add to `types.ts`:

```typescript
// =============================================================================
// DOCUMENT DRAFTING TYPES
// =============================================================================

/**
 * Supported document types
 */
export type DocumentType = 
  | 'legal_memo'
  | 'motion_compel'
  | 'motion_summary_judgment'
  | 'demand_letter'
  | 'client_letter'
  | 'discovery_request'
  | 'discovery_response'
  | 'trust_basic'
  | 'contract_basic';

/**
 * Document generation status
 */
export type DocumentStatus = 
  | 'initializing'
  | 'researching'
  | 'drafting'
  | 'verifying_citations'
  | 'final_verification'
  | 'complete'
  | 'error';

/**
 * Template variable definition
 */
export interface VariableDefinition {
  id: string;
  name: string;
  type: 'text' | 'date' | 'select' | 'textarea' | 'number';
  required: boolean;
  placeholder?: string;
  default?: string | 'today';
  options?: string[];              // For select type
  validation?: {
    pattern?: string;              // Regex pattern
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Document section definition
 */
export interface SectionDefinition {
  id: string;
  name: string;
  order: number;
  type: 'template' | 'generated';
  content?: string;                // For template type
  promptInstruction?: string;      // For generated type
  maxLengthWords?: number;
  required: boolean;
  editable?: boolean;
  subsectionsAllowed?: boolean;
  legalRequirements?: string[];    // Applicable rules/statutes
}

/**
 * Document template
 */
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  practiceAreas: string[];
  cebCategories: string[];
  variables: VariableDefinition[];
  sections: SectionDefinition[];
  formatting: DocumentFormatting;
  metadata: {
    version: string;
    created: string;
    author: string;
    crcCompliance?: string[];
  };
}

/**
 * Document formatting rules
 */
export interface DocumentFormatting {
  fontFamily: string;
  fontSize: number;
  lineSpacing: 'single' | 'double' | '1.5';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  pageNumbers: boolean;
  lineNumbers?: boolean;
  headerText?: string;
  footerText?: string;
  headerStyle?: 'left' | 'center' | 'right';
}

/**
 * Generated document section
 */
export interface GeneratedSection {
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
  citations: string[];
  generatedAt: string;
  revisedAt?: string;
  revisionCount: number;
}

/**
 * Complete generated document
 */
export interface GeneratedDocument {
  id: string;
  templateId: string;
  templateName: string;
  status: DocumentStatus;
  
  // Content
  sections: GeneratedSection[];
  variables: Record<string, string>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  pageEstimate: number;
  
  // Quality
  verificationReport?: DocumentVerificationReport;
  citationReport?: CitationReport;
  
  // Export
  formatting: DocumentFormatting;
}

/**
 * Citation verification result
 */
export interface VerifiedCitation {
  id: string;
  originalText: string;
  canonicalForm: string;
  type: 'case' | 'statute' | 'regulation' | 'secondary';
  verified: boolean;
  verificationSource?: string;
  url?: string;
  pageReferences: number[];
  errorMessage?: string;
}

/**
 * Citation report for document
 */
export interface CitationReport {
  totalCitations: number;
  verifiedCitations: number;
  unverifiedCitations: number;
  citations: VerifiedCitation[];
  tableOfAuthorities?: TableOfAuthoritiesEntry[];
}

/**
 * Table of Authorities entry
 */
export interface TableOfAuthoritiesEntry {
  citation: string;
  type: 'case' | 'statute' | 'secondary';
  pageReferences: string;          // e.g., "3, 5, 7-8"
}

/**
 * Document verification report
 */
export interface DocumentVerificationReport {
  overallScore: number;            // 0-100
  approvalStatus: 'approved' | 'needs_revision' | 'rejected';
  
  // Claim analysis
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
  
  // Issues found
  issues: DocumentIssue[];
  
  // Summary
  summary: string;
  recommendations: string[];
}

/**
 * Issue found during verification
 */
export interface DocumentIssue {
  id: string;
  severity: 'error' | 'warning' | 'suggestion';
  category: 'citation' | 'consistency' | 'completeness' | 'accuracy' | 'formatting';
  description: string;
  location?: string;               // Section ID or description
  suggestedFix?: string;
}

/**
 * Research package from research agent
 */
export interface ResearchPackage {
  query: string;
  completedAt: string;
  
  // Sources
  cebSources: CEBSource[];
  caseLaw: CaseLawSource[];
  statutes: StatuteSource[];
  legislation?: LegislativeSource[];
  
  // Analysis
  keyAuthorities: RankedAuthority[];
  modelLanguage?: ModelLanguageExcerpt[];
  researchNotes: string;
}

/**
 * Case law source
 */
export interface CaseLawSource {
  caseName: string;
  citation: string;
  court: string;
  year: number;
  holding: string;
  relevance: string;
  url?: string;
  courtlistenerId?: string;
}

/**
 * Statute source
 */
export interface StatuteSource {
  code: string;
  section: string;
  title?: string;
  text: string;
  url: string;
}

/**
 * Ranked authority
 */
export interface RankedAuthority {
  rank: number;
  type: 'case' | 'statute' | 'ceb' | 'secondary';
  citation: string;
  relevanceScore: number;
  summary: string;
}

/**
 * Model language excerpt from CEB
 */
export interface ModelLanguageExcerpt {
  source: string;
  citation: string;
  contentType: 'sample_clause' | 'checklist' | 'practice_tip' | 'form_language';
  text: string;
  usage: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  // Document being generated
  documentId: string;
  documentType: DocumentType;
  template: DocumentTemplate;
  variables: Record<string, string>;
  
  // User input
  userInstructions: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  
  // Research results
  researchPackage?: ResearchPackage;
  
  // Generated sections
  sections: Map<string, GeneratedSection>;
  
  // Citations
  citations: Map<string, VerifiedCitation>;
  
  // Verification
  verificationReport?: DocumentVerificationReport;
  
  // Metadata
  startTime: Date;
  currentPhase: DocumentStatus;
  agentHistory: AgentAction[];
  
  // Cost tracking
  tokenUsage: {
    orchestrator: number;
    research: number;
    drafting: number;
    citation: number;
    verification: number;
    total: number;
  };
}

/**
 * Agent action log entry
 */
export interface AgentAction {
  timestamp: string;
  agent: 'orchestrator' | 'research' | 'drafter' | 'citation' | 'verifier';
  action: string;
  input?: any;
  output?: any;
  tokensUsed: number;
  durationMs: number;
}

/**
 * Document draft request
 */
export interface DraftRequest {
  documentType: DocumentType;
  userInstructions: string;
  variables?: Record<string, string>;
  options?: DraftOptions;
  conversationContext?: {
    previousMessages?: Array<{ role: string; content: string }>;
    existingResearch?: string;
  };
}

/**
 * Draft options
 */
export interface DraftOptions {
  citationStyle: 'california' | 'bluebook';
  includeTableOfAuthorities: boolean;
  maxLength: 'short' | 'medium' | 'long';
  tone: 'formal' | 'persuasive' | 'neutral';
}
```

### 9.2 Database Schema (Future - if persistent storage needed)

```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),  -- Optional, for multi-user support
  status VARCHAR(20) NOT NULL DEFAULT 'initializing',
  
  -- Content (stored as JSONB)
  sections JSONB NOT NULL DEFAULT '[]',
  variables JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  word_count INTEGER,
  page_estimate INTEGER,
  
  -- Quality
  verification_score INTEGER,
  verification_report JSONB,
  citation_report JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Document revisions (for version history)
CREATE TABLE document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  section_id VARCHAR(50) NOT NULL,
  revision_number INTEGER NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  previous_content TEXT,
  
  -- Metadata
  revision_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent execution logs (for debugging/analytics)
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  agent_type VARCHAR(20) NOT NULL,
  action VARCHAR(100) NOT NULL,
  
  -- Execution details
  input JSONB,
  output JSONB,
  tokens_used INTEGER,
  duration_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 10. Frontend Components

### 10.1 Component Hierarchy

```
src/
├── components/
│   ├── drafting/
│   │   ├── DraftingMode.tsx           # Main drafting mode container
│   │   ├── DocumentTypeSelector.tsx   # Template selection
│   │   ├── VariableInputPanel.tsx     # Variable input form
│   │   ├── DocumentEditor.tsx         # Document preview/edit
│   │   ├── SectionPanel.tsx           # Individual section display
│   │   ├── ProgressIndicator.tsx      # Generation progress
│   │   ├── CitationList.tsx           # Citation sidebar
│   │   ├── VerificationBadge.tsx      # Verification status
│   │   ├── ExportPanel.tsx            # Export options
│   │   └── RevisionChat.tsx           # Chat for revisions
│   ├── shared/
│   │   ├── ModeSelector.tsx           # Research/Drafting toggle
│   │   └── MarkdownRenderer.tsx       # Shared markdown display
│   └── ... (existing components)
├── hooks/
│   ├── useDrafting.ts                 # Drafting state management
│   ├── useDocumentExport.ts           # Export functionality
│   └── ... (existing hooks)
└── ... (existing structure)
```

### 10.2 Component Specifications

#### 10.2.1 DraftingMode.tsx

```typescript
/**
 * DraftingMode - Main container for document drafting functionality
 * 
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [Mode: Research | Drafting]                                     │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ ┌─────────────────┐ ┌─────────────────────────────────────────┐ │
 * │ │ Left Panel      │ │ Document Preview                        │ │
 * │ │                 │ │                                         │ │
 * │ │ - Template      │ │ [Rendered document with sections]       │ │
 * │ │ - Variables     │ │                                         │ │
 * │ │ - Sections      │ │                                         │ │
 * │ │ - Citations     │ │                                         │ │
 * │ │                 │ │                                         │ │
 * │ └─────────────────┘ └─────────────────────────────────────────┘ │
 * │ ┌─────────────────────────────────────────────────────────────┐ │
 * │ │ Instruction/Revision Chat                                   │ │
 * │ │ "Make the analysis section more detailed..."                │ │
 * │ └─────────────────────────────────────────────────────────────┘ │
 * │ [Export: PDF | DOCX | Print]                                   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Props:
 * - initialTemplate?: string - Pre-selected template ID
 * - onModeChange: (mode: 'research' | 'drafting') => void
 * 
 * State managed by useDrafting hook
 */

import React, { useState, useCallback } from 'react';
import { useDrafting } from '../../hooks/useDrafting';
import DocumentTypeSelector from './DocumentTypeSelector';
import VariableInputPanel from './VariableInputPanel';
import DocumentEditor from './DocumentEditor';
import ProgressIndicator from './ProgressIndicator';
import RevisionChat from './RevisionChat';
import ExportPanel from './ExportPanel';

interface DraftingModeProps {
  initialTemplate?: string;
  onModeChange: (mode: 'research' | 'drafting') => void;
}

export const DraftingMode: React.FC<DraftingModeProps> = ({
  initialTemplate,
  onModeChange
}) => {
  const {
    // State
    template,
    document,
    status,
    progress,
    error,
    
    // Actions
    selectTemplate,
    setVariables,
    startGeneration,
    requestRevision,
    exportDocument
  } = useDrafting(initialTemplate);
  
  // ... component implementation
};
```

#### 10.2.2 DocumentEditor.tsx

```typescript
/**
 * DocumentEditor - Displays and allows editing of generated document
 * 
 * Features:
 * - Renders document sections in correct order
 * - Highlights current section during generation
 * - Click section to request revision
 * - Inline citation links
 * - Copy/print individual sections
 * 
 * Props:
 * - document: GeneratedDocument
 * - template: DocumentTemplate
 * - onSectionClick: (sectionId: string) => void
 * - highlightedSection?: string
 * - isGenerating: boolean
 */

interface DocumentEditorProps {
  document: GeneratedDocument | null;
  template: DocumentTemplate | null;
  onSectionClick: (sectionId: string) => void;
  highlightedSection?: string;
  isGenerating: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document,
  template,
  onSectionClick,
  highlightedSection,
  isGenerating
}) => {
  // Render document preview with:
  // - Formatted header based on template
  // - Each section with edit button
  // - Citations as clickable links
  // - Verification badges per section
  // - Loading skeleton for generating sections
};
```

#### 10.2.3 VariableInputPanel.tsx

```typescript
/**
 * VariableInputPanel - Form for inputting document variables
 * 
 * Features:
 * - Dynamic form based on template variables
 * - Field validation
 * - Auto-fill for dates
 * - Persist values to localStorage
 * - Required field indicators
 * 
 * Props:
 * - variables: VariableDefinition[]
 * - values: Record<string, string>
 * - onChange: (values: Record<string, string>) => void
 * - onComplete: () => void
 */

interface VariableInputPanelProps {
  variables: VariableDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onComplete: () => void;
  disabled?: boolean;
}

export const VariableInputPanel: React.FC<VariableInputPanelProps> = ({
  variables,
  values,
  onChange,
  onComplete,
  disabled
}) => {
  // Render form with:
  // - Text inputs, date pickers, selects based on variable type
  // - Validation indicators
  // - "Start Generation" button (disabled until required fields filled)
};
```

#### 10.2.4 ProgressIndicator.tsx

```typescript
/**
 * ProgressIndicator - Shows document generation progress
 * 
 * Features:
 * - Phase indicator (Research → Drafting → Citations → Verification)
 * - Progress bar with percentage
 * - Current activity description
 * - Section completion checkmarks
 * - Estimated time remaining
 * 
 * Props:
 * - status: DocumentStatus
 * - progress: number (0-100)
 * - currentMessage: string
 * - completedSections: string[]
 * - totalSections: number
 */

interface ProgressIndicatorProps {
  status: DocumentStatus;
  progress: number;
  currentMessage: string;
  completedSections: string[];
  totalSections: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  progress,
  currentMessage,
  completedSections,
  totalSections
}) => {
  const phases = ['research', 'drafting', 'citations', 'verification', 'complete'];
  
  // Render:
  // - Horizontal phase indicator with current phase highlighted
  // - Progress bar
  // - Section checklist
  // - Current activity text
};
```

### 10.3 Custom Hooks

#### 10.3.1 useDrafting.ts

```typescript
/**
 * useDrafting - Main state management hook for document drafting
 * 
 * Manages:
 * - Template selection
 * - Variable values
 * - Document generation (via SSE)
 * - Section revisions
 * - Export operations
 * 
 * Returns:
 * - template: Current template
 * - document: Generated document
 * - status: Generation status
 * - progress: Progress percentage
 * - error: Any error message
 * - selectTemplate: Function to select template
 * - setVariables: Function to update variables
 * - startGeneration: Function to start document generation
 * - requestRevision: Function to revise a section
 * - exportDocument: Function to export document
 */

import { useState, useCallback, useRef } from 'react';
import type {
  DocumentTemplate,
  GeneratedDocument,
  DocumentStatus,
  DraftRequest,
  GeneratedSection
} from '../types';

export function useDrafting(initialTemplateId?: string) {
  // Template state
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [variables, setVariablesState] = useState<Record<string, string>>({});
  
  // Document state
  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [status, setStatus] = useState<DocumentStatus>('initializing');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Load template
  const selectTemplate = useCallback(async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const templateData = await response.json();
      setTemplate(templateData);
      
      // Initialize variables with defaults
      const defaults: Record<string, string> = {};
      templateData.variables.forEach((v: VariableDefinition) => {
        if (v.default === 'today') {
          defaults[v.id] = new Date().toISOString().split('T')[0];
        } else if (v.default) {
          defaults[v.id] = v.default;
        }
      });
      setVariablesState(defaults);
    } catch (err) {
      setError(`Failed to load template: ${err}`);
    }
  }, []);
  
  // Start document generation
  const startGeneration = useCallback(async (instructions: string) => {
    if (!template) return;
    
    setStatus('researching');
    setProgress(0);
    setError(null);
    
    // Create draft request
    const request: DraftRequest = {
      documentType: template.id as any,
      userInstructions: instructions,
      variables,
      options: {
        citationStyle: 'california',
        includeTableOfAuthorities: true,
        maxLength: 'medium',
        tone: 'formal'
      }
    };
    
    // Connect to SSE endpoint
    const eventSource = new EventSource(
      `/api/orchestrate-document?request=${encodeURIComponent(JSON.stringify(request))}`
    );
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'progress':
          setStatus(data.phase);
          setProgress(data.percentComplete);
          break;
          
        case 'section_complete':
          setDocument(prev => {
            if (!prev) {
              // Initialize document
              return {
                id: crypto.randomUUID(),
                templateId: template.id,
                templateName: template.name,
                status: 'drafting',
                sections: [data as GeneratedSection],
                variables,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                wordCount: data.wordCount,
                pageEstimate: Math.ceil(data.wordCount / 250),
                formatting: template.formatting
              };
            }
            // Add section to existing document
            return {
              ...prev,
              sections: [...prev.sections, data as GeneratedSection],
              wordCount: prev.wordCount + data.wordCount,
              pageEstimate: Math.ceil((prev.wordCount + data.wordCount) / 250)
            };
          });
          break;
          
        case 'document_complete':
          setDocument(data.document);
          setStatus('complete');
          setProgress(100);
          eventSource.close();
          break;
          
        case 'error':
          setError(data.error);
          setStatus('error');
          eventSource.close();
          break;
      }
    };
    
    eventSource.onerror = () => {
      setError('Connection lost. Please try again.');
      setStatus('error');
      eventSource.close();
    };
  }, [template, variables]);
  
  // Request section revision
  const requestRevision = useCallback(async (
    sectionId: string,
    instructions: string
  ) => {
    if (!document) return;
    
    const section = document.sections.find(s => s.sectionId === sectionId);
    if (!section) return;
    
    try {
      const response = await fetch('/api/revise-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          sectionId,
          revisionInstructions: instructions,
          currentContent: section.content
        })
      });
      
      const revised = await response.json();
      
      // Update document with revised section
      setDocument(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map(s =>
            s.sectionId === sectionId
              ? { ...s, content: revised.revisedContent, revisionCount: s.revisionCount + 1 }
              : s
          ),
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      setError(`Revision failed: ${err}`);
    }
  }, [document]);
  
  // Export document
  const exportDocument = useCallback(async (format: 'pdf' | 'docx') => {
    if (!document) return;
    
    try {
      const response = await fetch('/api/export-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document,
          format,
          formatting: {
            includeLineNumbers: template?.formatting.lineNumbers,
            includeTableOfAuthorities: true
          }
        })
      });
      
      const result = await response.json();
      
      // Trigger download
      window.open(result.downloadUrl, '_blank');
    } catch (err) {
      setError(`Export failed: ${err}`);
    }
  }, [document, template]);
  
  return {
    // State
    template,
    variables,
    document,
    status,
    progress,
    error,
    
    // Actions
    selectTemplate,
    setVariables: setVariablesState,
    startGeneration,
    requestRevision,
    exportDocument
  };
}
```

### 10.4 UI/UX Requirements

#### 10.4.1 Mode Switching

- Clear toggle between "Research Mode" and "Drafting Mode" in header
- Persist mode selection to localStorage
- Smooth transition animation between modes
- Carry over context when switching (e.g., research can inform drafting)

#### 10.4.2 Responsive Design

- Desktop: Three-column layout (sidebar | document | chat)
- Tablet: Two-column with collapsible sidebar
- Mobile: Single column with tab navigation

#### 10.4.3 Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatible progress updates
- High contrast mode support
- Focus management during generation

#### 10.4.4 Loading States

- Skeleton loading for template list
- Section-by-section skeleton during generation
- Pulsing indicator for current generating section
- Smooth progress bar animation

---

## 11. Integration Points

### 11.1 Existing System Integration

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                        │
│                                                                          │
│  ┌──────────────────────┐      ┌──────────────────────┐                │
│  │   EXISTING           │      │   NEW                │                │
│  │   Research Mode      │◄────►│   Drafting Mode      │                │
│  │   (ChatWindow)       │      │   (DraftingMode)     │                │
│  └──────────────────────┘      └──────────────────────┘                │
│           │                              │                              │
│           │ useChat hook                 │ useDrafting hook             │
│           │                              │                              │
└───────────┼──────────────────────────────┼──────────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   EXISTING ENDPOINTS (Reused by Drafting)                        │   │
│  │                                                                   │   │
│  │   /api/ceb-search.ts        → Research Agent                     │   │
│  │   /api/courtlistener-search.ts → Research Agent                  │   │
│  │   /api/openstates-search.ts → Research Agent                     │   │
│  │   /api/legiscan-search.ts   → Research Agent                     │   │
│  │   /api/verify-citations.ts  → Citation Agent                     │   │
│  │   /api/gemini-chat.ts       → Drafter Agent                      │   │
│  │   /api/claude-chat.ts       → Orchestrator, Verifier Agents      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │   NEW ENDPOINTS                                                   │   │
│  │                                                                   │   │
│  │   /api/orchestrate-document.ts  → Main drafting entry point      │   │
│  │   /api/revise-section.ts        → Section revision               │   │
│  │   /api/export-document.ts       → PDF/DOCX export                │   │
│  │   /api/templates.ts             → Template management            │   │
│  │   /api/templates/[id].ts        → Single template retrieval      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGENT SERVICES LAYER (NEW)                         │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ orchestrator   │  │ research       │  │ drafter        │            │
│  │ Agent.ts       │  │ Agent.ts       │  │ Agent.ts       │            │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘            │
│          │                   │                   │                      │
│  ┌───────┴───────────────────┴───────────────────┴───────┐             │
│  │                    agents/tools.ts                     │             │
│  │   (Tool implementations that call existing APIs)       │             │
│  └────────────────────────────────────────────────────────┘             │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ citation       │  │ verifier       │  │ context        │            │
│  │ Agent.ts       │  │ Agent.ts       │  │ Manager.ts     │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                                  │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ Anthropic      │  │ Google         │  │ Upstash        │            │
│  │ Claude API     │  │ Gemini API     │  │ Vector         │            │
│  │                │  │                │  │                │            │
│  │ • Orchestrator │  │ • Drafter      │  │ • CEB Search   │            │
│  │ • Verifier     │  │   Agent        │  │   (77K docs)   │            │
│  │ • Citation     │  │                │  │                │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐                                │
│  │ CourtListener  │  │ OpenStates/    │                                │
│  │ API v4         │  │ LegiScan       │                                │
│  │                │  │                │                                │
│  │ • Case law     │  │ • Legislation  │                                │
│  │ • Citations    │  │ • Bills        │                                │
│  └────────────────┘  └────────────────┘                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 CEB Integration Details

The drafting system leverages the existing 77,406 CEB embeddings:

```typescript
// Research agent tool implementation
async function ceb_search_tool(params: {
  query: string;
  categories?: string[];
  top_k?: number;
  include_statutes?: boolean;
  include_model_language?: boolean;  // NEW: For drafting
}): Promise<CEBSearchResult> {
  
  // Call existing /api/ceb-search endpoint
  const response = await fetch('/api/ceb-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query,
      categories: params.categories,
      topK: params.top_k || 5
    })
  });
  
  const results = await response.json();
  
  // For drafting: Extract model language sections
  if (params.include_model_language) {
    return {
      ...results,
      modelLanguage: extractModelLanguage(results.sources)
    };
  }
  
  return results;
}

// Model language extraction
function extractModelLanguage(sources: CEBSource[]): ModelLanguageExcerpt[] {
  // Identify sections with sample language, checklists, practice tips
  return sources
    .filter(s => 
      s.content.includes('Sample') ||
      s.content.includes('Checklist') ||
      s.content.includes('Practice Tip') ||
      s.content.includes('Form')
    )
    .map(s => ({
      source: s.title,
      citation: s.cebCitation,
      contentType: identifyContentType(s.content),
      text: s.content,
      usage: 'Can be adapted for use in this document'
    }));
}
```

### 11.3 Verification System Integration

The existing verification system is extended for document-level verification:

```typescript
// Verifier agent uses existing verification infrastructure
async function verify_document(
  document: GeneratedDocument,
  researchPackage: ResearchPackage
): Promise<DocumentVerificationReport> {
  
  // 1. Extract all claims from document
  const claims = await extractClaimsFromDocument(document);
  
  // 2. Use existing verifier service for claim verification
  const verifiedClaims = await Promise.all(
    claims.map(claim => 
      verifyClaimAgainstSources(claim, researchPackage)
    )
  );
  
  // 3. Check document-level consistency
  const consistencyIssues = checkDocumentConsistency(document);
  
  // 4. Check completeness
  const completenessIssues = checkDocumentCompleteness(document);
  
  // 5. Compile report
  return {
    overallScore: calculateScore(verifiedClaims, consistencyIssues, completenessIssues),
    approvalStatus: determineApprovalStatus(verifiedClaims),
    totalClaims: claims.length,
    supportedClaims: verifiedClaims.filter(c => c.supported).length,
    unsupportedClaims: verifiedClaims.filter(c => !c.supported).length,
    issues: [...consistencyIssues, ...completenessIssues],
    summary: generateSummary(verifiedClaims),
    recommendations: generateRecommendations(verifiedClaims, consistencyIssues)
  };
}
```

### 11.4 Shared Context Between Modes

Users can seamlessly switch between research and drafting modes:

```typescript
// Context sharing between research and drafting
interface SharedContext {
  // Research results that can inform drafting
  researchHistory: Array<{
    query: string;
    sources: Source[];
    timestamp: string;
  }>;
  
  // Drafting results that can inform research
  draftingHistory: Array<{
    documentId: string;
    documentType: string;
    citations: string[];
    timestamp: string;
  }>;
}

// When switching from research to drafting
function transitionToD drafting(
  researchContext: ResearchHistory
): DraftingContext {
  return {
    existingResearch: researchContext.sources,
    suggestedTemplates: inferTemplatesFromResearch(researchContext),
    preFilledVariables: extractVariablesFromResearch(researchContext)
  };
}

// When switching from drafting to research
function transitionToResearch(
  draftingContext: DraftingHistory
): ResearchContext {
  return {
    relatedCitations: draftingContext.citations,
    suggestedQueries: generateQueriesFromDraft(draftingContext),
    focusAreas: identifyResearchGaps(draftingContext)
  };
}
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic document generation with single agent

**Deliverables**:
1. Template system
   - Template JSON schema
   - 3 initial templates: legal_memo, demand_letter, client_letter
   - Template loading API endpoints
   
2. Basic orchestrator
   - Single-agent implementation (no sub-agents yet)
   - Direct generation without parallel processing
   - Basic progress reporting
   
3. Frontend scaffolding
   - Mode selector (Research | Drafting)
   - Template selector
   - Variable input form
   - Basic document preview

**Success Criteria**:
- Can generate a legal memo from user instructions
- Variables are filled correctly
- Document renders in preview
- Generation completes in <60 seconds

### Phase 2: Multi-Agent Architecture (Weeks 3-4)

**Goal**: Full orchestrator + sub-agent system

**Deliverables**:
1. Agent implementations
   - Orchestrator agent with tool definitions
   - Research agent (parallel source searching)
   - Drafter agent (section-by-section)
   - Basic citation agent
   
2. Agent coordination
   - Context passing between agents
   - Parallel execution where possible
   - Progress streaming to frontend
   
3. Integration with existing APIs
   - Wire CEB search as research tool
   - Wire CourtListener as research tool
   - Wire Gemini as drafting backend

**Success Criteria**:
- Research phase completes with relevant sources
- Sections generated in parallel where possible
- Progress shown in real-time
- Generation time <90 seconds for standard memo

### Phase 3: Citation & Verification (Weeks 5-6)

**Goal**: Full citation verification and quality control

**Deliverables**:
1. Citation agent
   - Citation extraction
   - Verification against CourtListener/statutes
   - URL generation
   - Table of Authorities generation
   
2. Verifier agent
   - Claim extraction and verification
   - Consistency checking
   - Completeness checking
   - Quality scoring
   
3. Frontend integration
   - Citation list sidebar
   - Verification badges
   - Issue highlighting

**Success Criteria**:
- >90% of citations verified
- Unverified citations clearly flagged
- Table of Authorities auto-generated
- Verification report displayed

### Phase 4: Revision & Export (Weeks 7-8)

**Goal**: Iterative refinement and document export

**Deliverables**:
1. Revision system
   - Section-specific revision API
   - Targeted regeneration
   - Revision history tracking
   
2. Export system
   - PDF generation (CRC compliant)
   - DOCX generation
   - Formatting options (line numbers, TOC)
   
3. Frontend completion
   - Revision chat interface
   - Export panel
   - Print preview

**Success Criteria**:
- Can revise any section
- Revision completes in <30 seconds
- PDF meets CRC formatting requirements
- DOCX opens correctly in Word

### Phase 5: Advanced Templates (Weeks 9-10)

**Goal**: Expand document type coverage

**Deliverables**:
1. Additional templates
   - Motion to compel (complex, multi-section)
   - Discovery requests/responses
   - Basic trust document
   
2. Template enhancements
   - Conditional sections
   - Nested templates (e.g., declaration within motion)
   - Court-specific variations
   
3. CEB integration depth
   - Model language extraction
   - Practice tip integration
   - Checklist generation

**Success Criteria**:
- 6+ document types available
- Complex documents (motions) generate correctly
- CEB model language incorporated where available

### Phase 6: Polish & Optimization (Weeks 11-12)

**Goal**: Production readiness

**Deliverables**:
1. Performance optimization
   - Response streaming optimization
   - Caching for templates and research
   - Cost optimization (model selection)
   
2. Error handling
   - Graceful degradation
   - Retry logic
   - User-friendly error messages
   
3. Documentation
   - User guide
   - API documentation
   - Template creation guide

**Success Criteria**:
- Average generation time <60 seconds
- Cost per document <$0.50
- Error rate <5%
- User documentation complete

---

## 13. Testing Strategy

### 13.1 Unit Tests

```typescript
// Example unit tests for template system
describe('Template System', () => {
  describe('loadTemplate', () => {
    it('should load a valid template by ID', async () => {
      const template = await loadTemplate('legal_memo');
      expect(template).toBeDefined();
      expect(template.id).toBe('legal_memo');
      expect(template.sections.length).toBeGreaterThan(0);
    });
    
    it('should throw error for invalid template ID', async () => {
      await expect(loadTemplate('invalid_id')).rejects.toThrow();
    });
  });
  
  describe('validateVariables', () => {
    it('should pass for complete required variables', () => {
      const template = mockTemplate(['to', 'from', 'date']);
      const variables = { to: 'Partner', from: 'Associate', date: '2026-01-30' };
      expect(validateVariables(template, variables)).toBe(true);
    });
    
    it('should fail for missing required variables', () => {
      const template = mockTemplate(['to', 'from', 'date']);
      const variables = { to: 'Partner' };
      expect(validateVariables(template, variables)).toBe(false);
    });
  });
});
```

### 13.2 Integration Tests

```typescript
// Example integration tests for agent system
describe('Agent System Integration', () => {
  describe('Research Agent', () => {
    it('should return relevant CEB sources', async () => {
      const result = await runResearchAgent({
        query: 'motion to compel discovery California',
        sources: ['ceb', 'courtlistener']
      });
      
      expect(result.cebSources.length).toBeGreaterThan(0);
      expect(result.cebSources[0].category).toBe('business_litigation');
    });
    
    it('should include case law when requested', async () => {
      const result = await runResearchAgent({
        query: 'discovery abuse sanctions California',
        sources: ['courtlistener']
      });
      
      expect(result.caseLaw.length).toBeGreaterThan(0);
    });
  });
  
  describe('Full Document Generation', () => {
    it('should generate complete legal memo', async () => {
      const document = await generateDocument({
        documentType: 'legal_memo',
        userInstructions: 'Analyze whether a revocable trust protects assets from creditors',
        variables: {
          to: 'Senior Partner',
          from: 'Associate',
          client_matter: 'Test Client'
        }
      });
      
      expect(document.status).toBe('complete');
      expect(document.sections.length).toBe(6);
      expect(document.verificationReport.overallScore).toBeGreaterThan(70);
    }, 120000); // 2 minute timeout for full generation
  });
});
```

### 13.3 End-to-End Tests

```typescript
// E2E tests using Playwright
describe('Document Drafting E2E', () => {
  test('user can generate a legal memo', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Switch to drafting mode
    await page.click('[data-testid="mode-drafting"]');
    
    // Select template
    await page.click('[data-testid="template-legal_memo"]');
    
    // Fill variables
    await page.fill('[data-testid="var-to"]', 'Senior Partner');
    await page.fill('[data-testid="var-from"]', 'Associate');
    await page.fill('[data-testid="var-client_matter"]', 'Test Matter');
    
    // Enter instructions
    await page.fill(
      '[data-testid="instructions-input"]',
      'Analyze breach of fiduciary duty claims'
    );
    
    // Start generation
    await page.click('[data-testid="generate-button"]');
    
    // Wait for completion (with timeout)
    await expect(page.locator('[data-testid="status-complete"]'))
      .toBeVisible({ timeout: 120000 });
    
    // Verify document has content
    const documentContent = await page.textContent('[data-testid="document-preview"]');
    expect(documentContent).toContain('MEMORANDUM');
    expect(documentContent).toContain('Question Presented');
    expect(documentContent).toContain('Analysis');
  });
  
  test('user can revise a section', async ({ page }) => {
    // ... setup and generate document ...
    
    // Click on analysis section
    await page.click('[data-testid="section-analysis"]');
    
    // Enter revision instructions
    await page.fill(
      '[data-testid="revision-input"]',
      'Make this section more detailed with additional case citations'
    );
    
    // Submit revision
    await page.click('[data-testid="revise-button"]');
    
    // Wait for revision complete
    await expect(page.locator('[data-testid="revision-complete"]'))
      .toBeVisible({ timeout: 60000 });
    
    // Verify section was updated
    const sectionContent = await page.textContent('[data-testid="section-analysis"]');
    expect(sectionContent.length).toBeGreaterThan(previousLength);
  });
  
  test('user can export to PDF', async ({ page }) => {
    // ... setup and generate document ...
    
    // Click export PDF
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
```

### 13.4 Quality Assurance Tests

```typescript
// Tests for document quality
describe('Document Quality', () => {
  describe('Citation Accuracy', () => {
    it('should verify >90% of citations', async () => {
      const document = await generateDocument(testRequest);
      const report = document.citationReport;
      
      const verificationRate = report.verifiedCitations / report.totalCitations;
      expect(verificationRate).toBeGreaterThan(0.9);
    });
    
    it('should flag invalid citations', async () => {
      const document = await generateDocumentWithInvalidCitation();
      const unverified = document.citationReport.citations
        .filter(c => !c.verified);
      
      expect(unverified.length).toBeGreaterThan(0);
      expect(unverified[0].errorMessage).toBeDefined();
    });
  });
  
  describe('Content Quality', () => {
    it('should not contain placeholder text', async () => {
      const document = await generateDocument(testRequest);
      const fullText = document.sections.map(s => s.content).join('\n');
      
      expect(fullText).not.toMatch(/\[PLACEHOLDER\]/);
      expect(fullText).not.toMatch(/\[TODO\]/);
      expect(fullText).not.toMatch(/\[INSERT\]/);
    });
    
    it('should maintain consistent party names', async () => {
      const document = await generateDocument(testRequestWithParties);
      const fullText = document.sections.map(s => s.content).join('\n');
      
      // Should use consistent party references
      expect(fullText).toContain(testRequestWithParties.variables.plaintiff);
      expect(fullText).not.toContain('Plaintiff Name');
    });
  });
});
```

---

## 14. Security and Compliance

### 14.1 Data Security

**Confidentiality Warnings**:
```typescript
// Enhanced warning for drafting mode
const DRAFTING_CONFIDENTIALITY_WARNING = `
⚠️ CONFIDENTIALITY WARNING FOR DOCUMENT DRAFTING

Before using this tool for document drafting, please note:

1. DO NOT enter confidential client information
   - Use placeholders like [CLIENT NAME] instead of actual names
   - Anonymize all identifying details before entering
   - Replace specific facts with generic descriptions

2. AI DATA TRANSMISSION
   - Your instructions are sent to third-party AI services (Anthropic, Google)
   - Generated documents may be used to improve AI models
   - Do not include privileged or work-product information

3. PROFESSIONAL RESPONSIBILITY
   - All generated documents require attorney review
   - Verify all citations against primary sources
   - Check for AI hallucinations before use
   - This tool does not provide legal advice

4. COURT FILING REQUIREMENTS
   - Check local rules for AI disclosure requirements
   - Verify formatting meets court specifications
   - Review all content for accuracy before filing

By proceeding, you acknowledge these limitations.
`;
```

**Input Sanitization**:
```typescript
// Sanitize user input before processing
function sanitizeInput(input: string): string {
  // Remove potential injection patterns
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
  
  // Check for potential PII patterns and warn
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
    /\b\d{16}\b/,              // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/  // Email
  ];
  
  for (const pattern of piiPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('Potential PII detected. Please anonymize before proceeding.');
    }
  }
  
  return sanitized;
}
```

### 14.2 API Security

```typescript
// Rate limiting for document generation
const RATE_LIMITS = {
  documentsPerHour: 10,
  revisionsPerDocument: 20,
  exportsPerDocument: 5
};

// API key validation (all server-side)
function validateEnvironment(): void {
  const required = [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'UPSTASH_VECTOR_REST_URL',
    'UPSTASH_VECTOR_REST_TOKEN'
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

### 14.3 Compliance Features

**California State Bar Compliance**:
- Prominent AI disclosure in generated documents
- Verification status clearly displayed
- Source attribution for all citations
- Warning before court filing export

**California Rules of Court Compliance**:
- CRC 2.104 formatting validation
- Line numbering option for required filings
- Proper margin and font settings
- Page number formatting

---

## 15. Performance Requirements

### 15.1 Response Time Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Template list load | <500ms | 1s |
| Template details load | <500ms | 1s |
| Document generation start | <2s | 5s |
| Research phase | <30s | 45s |
| Per-section generation | <15s | 30s |
| Full document generation | <90s | 120s |
| Section revision | <20s | 30s |
| PDF export | <10s | 20s |
| DOCX export | <10s | 20s |

### 15.2 Concurrency

- Support 10 simultaneous document generations per instance
- Agent operations run in parallel where possible
- Database connections pooled
- External API calls rate-limited to avoid throttling

### 15.3 Resource Limits

```typescript
// Vercel function configuration
export const config = {
  maxDuration: 120,      // 2 minutes max for document generation
  memory: 1024,          // 1GB memory
};

// Token limits per operation
const TOKEN_LIMITS = {
  orchestrator: 4096,
  research: 2048,
  drafterPerSection: 4096,
  citation: 2048,
  verifier: 4096,
  totalPerDocument: 50000
};
```

---

## 16. Cost Analysis

### 16.1 Per-Document Cost Estimate

| Agent | Model | Est. Tokens | Cost per 1K tokens | Est. Cost |
|-------|-------|-------------|-------------------|-----------|
| Orchestrator | Claude Sonnet 4.5 | 8,000 | $0.003 / $0.015 | $0.144 |
| Research | Claude Haiku 4.5 | 4,000 | $0.00025 / $0.00125 | $0.006 |
| Drafter (×3) | Gemini 2.5 Pro | 12,000 | $0.00125 / $0.005 | $0.075 |
| Citation | Claude Haiku 4.5 | 3,000 | $0.00025 / $0.00125 | $0.0045 |
| Verifier | Claude Sonnet 4.5 | 6,000 | $0.003 / $0.015 | $0.108 |
| CEB Embedding | OpenAI | 500 | $0.00002 | $0.00001 |
| **Total** | | ~33,500 | | **~$0.34** |

### 16.2 Monthly Cost Projections

| Usage Level | Documents/Month | Est. Monthly Cost |
|-------------|-----------------|-------------------|
| Light | 50 | $17 |
| Medium | 200 | $68 |
| Heavy | 500 | $170 |
| Enterprise | 2000 | $680 |

### 16.3 Cost Optimization Strategies

1. **Model selection**: Use Haiku for high-volume, low-complexity tasks
2. **Caching**: Cache research results for similar queries
3. **Prompt optimization**: Minimize token usage in system prompts
4. **Batch processing**: Combine small operations where possible
5. **Early termination**: Stop generation if quality threshold not met

---

## 17. Risk Assessment

### 17.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limiting | Medium | High | Implement queuing, backoff |
| Model availability | Low | High | Fallback to alternative models |
| Token limit exceeded | Medium | Medium | Chunk large documents |
| Citation verification fails | Medium | Medium | Graceful degradation, manual flag |
| Export formatting issues | Medium | Medium | Thorough template testing |

### 17.2 Legal/Compliance Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Hallucinated citations | High | High | Mandatory verification, warnings |
| Incorrect legal advice | Medium | High | Disclaimer, attorney review required |
| Confidential data exposure | Low | Critical | Input sanitization, warnings |
| Court filing rejection | Medium | Medium | CRC compliance validation |

### 17.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| High API costs | Medium | Medium | Usage monitoring, limits |
| Poor document quality | Medium | High | Quality scoring, user feedback |
| User adoption low | Medium | Medium | Intuitive UI, documentation |

---

## 18. Success Metrics

### 18.1 Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Document generation success rate | >95% | Completed / Attempted |
| Citation verification rate | >90% | Verified / Total citations |
| Average generation time | <90s | Time tracking |
| Verification score average | >80/100 | Quality scoring |
| User revision rate | <3 per document | Revision count |
| Export success rate | >99% | Successful exports |

### 18.2 Qualitative Metrics

- User satisfaction (survey)
- Document quality (attorney review sample)
- Citation accuracy (spot check)
- Formatting compliance (court acceptance)

### 18.3 Tracking Implementation

```typescript
// Analytics events
interface DraftingAnalytics {
  documentGenerated: {
    templateId: string;
    generationTimeMs: number;
    sectionCount: number;
    wordCount: number;
    citationCount: number;
    verificationScore: number;
    cost: number;
  };
  
  revisionRequested: {
    documentId: string;
    sectionId: string;
    revisionTimeMs: number;
    revisionNumber: number;
  };
  
  documentExported: {
    documentId: string;
    format: 'pdf' | 'docx';
    exportTimeMs: number;
  };
  
  errorOccurred: {
    phase: string;
    errorType: string;
    recoverable: boolean;
  };
}
```

---

## 19. Appendices

### Appendix A: File Structure

```
california-law-chatbot/
├── api/
│   ├── orchestrate-document.ts      # NEW: Main drafting endpoint
│   ├── revise-section.ts            # NEW: Section revision
│   ├── export-document.ts           # NEW: PDF/DOCX export
│   ├── templates.ts                 # NEW: Template list
│   ├── templates/
│   │   └── [id].ts                  # NEW: Single template
│   ├── ceb-search.ts                # EXISTING: Enhanced for drafting
│   ├── courtlistener-search.ts      # EXISTING
│   ├── gemini-chat.ts               # EXISTING
│   ├── claude-chat.ts               # EXISTING
│   └── verify-citations.ts          # EXISTING
│
├── agents/                          # NEW: Agent system
│   ├── orchestratorAgent.ts
│   ├── researchAgent.ts
│   ├── drafterAgent.ts
│   ├── citationAgent.ts
│   ├── verifierAgent.ts
│   ├── tools.ts                     # Tool implementations
│   └── context.ts                   # Shared context management
│
├── components/
│   ├── drafting/                    # NEW: Drafting components
│   │   ├── DraftingMode.tsx
│   │   ├── DocumentTypeSelector.tsx
│   │   ├── VariableInputPanel.tsx
│   │   ├── DocumentEditor.tsx
│   │   ├── SectionPanel.tsx
│   │   ├── ProgressIndicator.tsx
│   │   ├── CitationList.tsx
│   │   ├── VerificationBadge.tsx
│   │   ├── ExportPanel.tsx
│   │   └── RevisionChat.tsx
│   ├── shared/
│   │   └── ModeSelector.tsx         # NEW: Research/Drafting toggle
│   └── ... (existing components)
│
├── hooks/
│   ├── useDrafting.ts               # NEW: Drafting state
│   ├── useDocumentExport.ts         # NEW: Export functionality
│   └── useChat.ts                   # EXISTING
│
├── templates/                       # NEW: Document templates
│   ├── index.json
│   ├── legal_memo.json
│   ├── motion_compel.json
│   ├── demand_letter.json
│   ├── client_letter.json
│   ├── discovery_request.json
│   ├── trust_basic.json
│   └── shared/
│       ├── court_captions.json
│       ├── signature_blocks.json
│       └── formatting_rules.json
│
├── services/
│   ├── documentService.ts           # NEW: Document operations
│   ├── exportService.ts             # NEW: PDF/DOCX generation
│   ├── verifierService.ts           # EXISTING: Enhanced
│   └── ... (existing services)
│
├── types.ts                         # ENHANCED: New types added
├── docs/
│   └── PRD_DOCUMENT_DRAFTING.md     # This document
└── ... (existing files)
```

### Appendix B: Environment Variables

```env
# Existing (required)
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
UPSTASH_VECTOR_REST_URL=xxx
UPSTASH_VECTOR_REST_TOKEN=xxx
COURTLISTENER_API_KEY=xxx

# New (optional, for enhanced features)
# None required - uses existing keys
```

### Appendix C: API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orchestrate-document` | POST | Generate document (SSE) |
| `/api/revise-section` | POST | Revise specific section |
| `/api/export-document` | POST | Export to PDF/DOCX |
| `/api/templates` | GET | List all templates |
| `/api/templates/[id]` | GET | Get template details |

### Appendix D: Agent Model Reference

| Agent | Primary Model | Fallback |
|-------|--------------|----------|
| Orchestrator | Claude Sonnet 4.5 | Claude Sonnet 4 |
| Research | Claude Haiku 4.5 | Claude Haiku 3.5 |
| Drafter | Gemini 2.5 Pro | Claude Sonnet 4.5 |
| Citation | Claude Haiku 4.5 | Claude Haiku 3.5 |
| Verifier | Claude Sonnet 4.5 | Claude Sonnet 4 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | California Law Chatbot Team | Initial PRD |

---

**END OF DOCUMENT**
