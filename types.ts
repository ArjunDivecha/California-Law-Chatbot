export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
}

export type SourceMode = 'ceb-only' | 'ai-only' | 'hybrid';
export type ResponseMode = 'speed' | 'accuracy';

export interface Source {
  title: string;
  url: string;
  id?: string; // For citation mapping [id]
  excerpt?: string; // Source excerpt for verification
  // Citation verification (from /api/verify-citations)
  citationVerified?: boolean; // true = verified against CourtListener, false = not found
  citationVerificationSource?: string; // CourtListener URL if verified
}

export interface CEBSource extends Source {
  isCEB: true;
  category: 'trusts_estates' | 'family_law' | 'business_litigation' | 'business_entities' | 'business_transactions';
  cebCitation: string;
  pageNumber?: number;
  section?: string;
  confidence: number; // Similarity score from vector search (0-1)
}

export interface Claim {
  text: string;
  cites: string[]; // Array of source IDs
  kind: 'statute' | 'case' | 'fact';
}

export interface VerificationReport {
  coverage: number; // supported_claims / total_claims (0.0 to 1.0)
  minSupport: number; // Minimum # quotes per claim
  ambiguity: boolean; // Conflicting or generic sources
  supportedClaims: Claim[];
  unsupportedClaims: Claim[];
  verifiedQuotes: Array<{ claim: string; quotes: string[]; sourceId: string }>;
}

export type VerificationStatus = 'verified' | 'partially_verified' | 'refusal' | 'unverified' | 'not_needed' | 'verifying';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  sources?: (Source | CEBSource)[];
  verificationStatus?: VerificationStatus;
  verificationReport?: VerificationReport;
  claims?: Claim[]; // Extracted claims for verification
  isCEBBased?: boolean; // Flag for CEB-based responses (bypasses verification)
  cebCategory?: string; // Which CEB vertical was used
  sourceMode?: SourceMode; // Which mode was used for this message
  responseMode?: ResponseMode; // Whether the answer used the fast direct path or full accuracy flow
  /**
   * Which detector sanitized this message before it left the device.
   * 'opf' = full OPF detector ran. 'heuristic' = OPF was unreachable
   * and we fell back to the local heuristic detector (weaker on
   * lowercase / mixed-case / foreign names — UI flags this on the
   * message bubble).
   */
  sanitizationMethod?: 'opf' | 'heuristic';
}

// =============================================================================
// DOCUMENT DRAFTING TYPES
// =============================================================================

/**
 * Application mode - research (chat) or drafting (documents)
 */
export type AppMode = 'research' | 'drafting';

/**
 * Supported document types
 */
export type DocumentType =
  | 'legal_memo'
  | 'motion_compel'
  | 'demand_letter'
  | 'client_letter'
  | 'discovery_request'
  | 'trust_basic';

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
  options?: string[]; // For select type
  validation?: {
    pattern?: string; // Regex pattern
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
  content?: string; // For template type
  promptInstruction?: string; // For generated type
  maxLengthWords?: number;
  required: boolean;
  editable?: boolean;
  subsectionsAllowed?: boolean;
  legalRequirements?: string[]; // Applicable rules/statutes
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
 * Template summary for listing
 */
export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  practiceAreas: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedTime: string;
  variableCount: number;
  sectionCount: number;
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
  pageReferences: string; // e.g., "3, 5, 7-8"
}

/**
 * Document verification report
 */
export interface DocumentVerificationReport {
  overallScore: number; // 0-100
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
  location?: string; // Section ID or description
  suggestedFix?: string;
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
 * Case law source for research
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
 * Statute source for research
 */
export interface StatuteSource {
  code: string;
  section: string;
  title?: string;
  text: string;
  url: string;
}

/**
 * Legislative source for research (active or recently-passed bill)
 */
export interface LegislativeSource {
  billNumber: string;
  title: string;
  status: string;
  lastAction?: string;
  url: string;
  provider: 'openstates' | 'legiscan' | 'unknown';
}

/**
 * Ranked authority
 */
export interface RankedAuthority {
  rank: number;
  type: 'case' | 'statute' | 'ceb' | 'secondary' | 'legislation';
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
 * Research package from research agent
 */
export interface ResearchPackage {
  query: string;
  completedAt: string;

  // Sources
  cebSources: CEBSource[];
  caseLaw: CaseLawSource[];
  statutes: StatuteSource[];
  legislativeSources: LegislativeSource[];

  // Analysis
  keyAuthorities: RankedAuthority[];
  modelLanguage?: ModelLanguageExcerpt[];
  researchNotes: string;
}

/**
 * Agent action log entry
 */
export interface AgentAction {
  timestamp: string;
  agent: 'orchestrator' | 'research' | 'drafter' | 'citation' | 'verifier';
  action: string;
  input?: unknown;
  output?: unknown;
  tokensUsed: number;
  durationMs: number;
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
 * Draft options
 */
export interface DraftOptions {
  citationStyle: 'california' | 'bluebook';
  includeTableOfAuthorities: boolean;
  maxLength: 'short' | 'medium' | 'long';
  tone: 'formal' | 'persuasive' | 'neutral';
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
 * Progress event for SSE streaming
 */
export interface DraftProgressEvent {
  type: 'progress';
  phase: DocumentStatus;
  message: string;
  percentComplete: number;
  currentSection?: string;
}

/**
 * Section complete event for SSE streaming
 */
export interface SectionCompleteEvent {
  type: 'section_complete';
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
}

/**
 * Document complete event for SSE streaming
 */
export interface DocumentCompleteEvent {
  type: 'document_complete';
  document: GeneratedDocument;
  verificationReport: DocumentVerificationReport;
  citations: CitationReport;
}

/**
 * Error event for SSE streaming
 */
export interface DraftErrorEvent {
  type: 'error';
  error: string;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Union type for all SSE events
 */
export type DraftStreamEvent =
  | DraftProgressEvent
  | SectionCompleteEvent
  | DocumentCompleteEvent
  | DraftErrorEvent;
