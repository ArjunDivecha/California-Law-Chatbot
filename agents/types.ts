/**
 * Agent Types and Tool Definitions
 * 
 * This file contains type definitions for the multi-agent document drafting system.
 */

import type {
  DocumentTemplate,
  DocumentType,
  DocumentStatus,
  GeneratedSection,
  VerifiedCitation,
  DocumentVerificationReport,
  ResearchPackage,
  CEBSource,
  CaseLawSource,
  StatuteSource,
} from '../types';

// =============================================================================
// AGENT ROLES AND CONFIGURATION
// =============================================================================

export type AgentRole =
  | 'orchestrator'
  | 'research'
  | 'drafter'
  | 'citation'
  | 'verifier';

export type AgentModel =
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'gemini-2.5-pro';

export interface AgentConfig {
  role: AgentRole;
  model: AgentModel;
  systemPrompt: string;
  maxIterations: number;
  timeoutMs: number;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string; enum?: string[] };
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

// =============================================================================
// TOOL CALL AND RESULT TYPES
// =============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// =============================================================================
// RESEARCH AGENT TYPES
// =============================================================================

export interface ResearchQuery {
  query: string;
  sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'openstates' | 'legiscan'>;
  focusAreas?: string[];
  categories?: string[];
}

export interface ResearchResult {
  cebSources: CEBSource[];
  caseLaw: CaseLawSource[];
  statutes: StatuteSource[];
  modelLanguage?: Array<{
    source: string;
    citation: string;
    text: string;
    contentType: string;
  }>;
  researchNotes: string;
}

// =============================================================================
// DRAFTER AGENT TYPES
// =============================================================================

export interface DraftSection {
  sectionId: string;
  sectionName: string;
  requirements: string;
  maxLengthWords?: number;
}

export interface DraftRequest {
  sections: DraftSection[];
  researchContext: string;
  previousSectionsSummary?: string;
  styleInstructions?: string;
  variables: Record<string, string>;
}

export interface DraftResult {
  sectionId: string;
  content: string;
  wordCount: number;
  citationsUsed: string[];
}

// =============================================================================
// CITATION AGENT TYPES
// =============================================================================

export interface CitationVerificationRequest {
  documentContent: string;
  citationStyle: 'california' | 'bluebook';
  generateToa: boolean;
}

export interface CitationVerificationResult {
  citations: VerifiedCitation[];
  tableOfAuthorities?: Array<{
    citation: string;
    type: string;
    pageReferences: string;
  }>;
  updatedContent: string;
}

// =============================================================================
// VERIFIER AGENT TYPES
// =============================================================================

export interface VerificationRequest {
  documentContent: string;
  researchPackage: ResearchPackage;
  documentType: DocumentType;
}

export interface VerificationResult extends DocumentVerificationReport {
  // Extends the base report with additional agent-specific data
  agentNotes?: string;
}

// =============================================================================
// ORCHESTRATOR TYPES
// =============================================================================

export interface OrchestratorState {
  documentId: string;
  documentType: DocumentType;
  template: DocumentTemplate;
  variables: Record<string, string>;
  userInstructions: string;
  
  // Phase tracking
  currentPhase: DocumentStatus;
  phaseHistory: Array<{
    phase: DocumentStatus;
    startTime: Date;
    endTime?: Date;
  }>;
  
  // Results from sub-agents
  researchPackage?: ResearchPackage;
  draftedSections: Map<string, GeneratedSection>;
  verifiedCitations: Map<string, VerifiedCitation>;
  verificationReport?: DocumentVerificationReport;
  
  // Metrics
  tokenUsage: {
    orchestrator: number;
    research: number;
    drafting: number;
    citation: number;
    verification: number;
  };
  startTime: Date;
}

export interface ProgressCallback {
  (event: {
    phase: DocumentStatus;
    message: string;
    percentComplete: number;
    currentSection?: string;
  }): void;
}

export interface SectionCallback {
  (section: GeneratedSection): void;
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

export interface StreamEvent {
  type: 'progress' | 'section_complete' | 'document_complete' | 'error';
  data: unknown;
}

export interface ProgressStreamEvent {
  type: 'progress';
  phase: DocumentStatus;
  message: string;
  percentComplete: number;
  currentSection?: string;
}

export interface SectionStreamEvent {
  type: 'section_complete';
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
}

export interface CompleteStreamEvent {
  type: 'document_complete';
  document: {
    id: string;
    sections: GeneratedSection[];
    wordCount: number;
  };
  verificationReport: DocumentVerificationReport;
  citations: {
    total: number;
    verified: number;
    citations: VerifiedCitation[];
  };
}

export interface ErrorStreamEvent {
  type: 'error';
  error: string;
  recoverable: boolean;
  suggestion?: string;
}
