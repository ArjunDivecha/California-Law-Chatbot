/**
 * Orchestrator Agent
 * 
 * Top-level coordinator that manages the document generation workflow.
 * Spawns and coordinates research, drafting, citation, and verification agents.
 */

import type {
  DocumentTemplate,
  DocumentType,
  DocumentStatus,
  GeneratedDocument,
  GeneratedSection,
  DraftRequest,
  DraftOptions,
  ResearchPackage,
  DocumentVerificationReport,
  CitationReport,
  DocumentFormatting,
} from '../types';
import { runResearchAgent } from './researchAgent';
import { runDrafterAgent } from './drafterAgent';
import { runCitationAgent } from './citationAgent';
import { runVerifierAgent } from './verifierAgent';

// =============================================================================
// TYPES
// =============================================================================

export interface OrchestratorCallbacks {
  onProgress?: (event: {
    phase: DocumentStatus;
    message: string;
    percentComplete: number;
    currentSection?: string;
  }) => void;
  onSectionComplete?: (section: GeneratedSection) => void;
  onError?: (error: string, recoverable: boolean) => void;
}

export interface OrchestratorResult {
  document: GeneratedDocument;
  verificationReport: DocumentVerificationReport;
  citationReport: CitationReport;
}

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

export class DocumentOrchestrator {
  private template: DocumentTemplate;
  private variables: Record<string, string>;
  private userInstructions: string;
  private options: DraftOptions;
  private callbacks: OrchestratorCallbacks;

  // State
  private documentId: string;
  private currentPhase: DocumentStatus = 'initializing';
  private researchPackage: ResearchPackage | null = null;
  private sections: GeneratedSection[] = [];
  private startTime: Date;

  constructor(
    template: DocumentTemplate,
    variables: Record<string, string>,
    userInstructions: string,
    options: DraftOptions,
    callbacks: OrchestratorCallbacks = {}
  ) {
    this.template = template;
    this.variables = variables;
    this.userInstructions = userInstructions;
    this.options = options;
    this.callbacks = callbacks;
    this.documentId = crypto.randomUUID();
    this.startTime = new Date();
  }

  /**
   * Execute the full document generation workflow
   */
  async execute(): Promise<OrchestratorResult> {
    console.log(`🎯 Orchestrator: Starting document generation for ${this.template.name}`);
    console.log(`   Document ID: ${this.documentId}`);
    console.log(`   User Instructions: ${this.userInstructions.substring(0, 100)}...`);

    try {
      // Phase 1: Research
      await this.executeResearchPhase();

      // Phase 2: Drafting
      await this.executeDraftingPhase();

      // Phase 3: Citation Processing
      const citationReport = await this.executeCitationPhase();

      // Phase 4: Verification
      const verificationReport = await this.executeVerificationPhase();

      // Phase 5: Assembly
      const document = this.assembleDocument(citationReport, verificationReport);

      this.updateProgress('complete', 'Document generation complete', 100);

      const totalTime = Date.now() - this.startTime.getTime();
      console.log(`✅ Orchestrator: Complete in ${totalTime}ms`);

      return {
        document,
        verificationReport,
        citationReport,
      };
    } catch (error) {
      console.error('❌ Orchestrator error:', error);
      this.callbacks.onError?.(
        error instanceof Error ? error.message : 'Unknown error',
        false
      );
      throw error;
    }
  }

  /**
   * Phase 1: Research
   */
  private async executeResearchPhase(): Promise<void> {
    this.updateProgress('researching', 'Gathering legal authorities...', 10);

    // Determine which sources to search based on template
    const sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'legislative'> = ['ceb', 'courtlistener', 'statutes'];

    // Build research query from user instructions and template context
    const researchQuery = this.buildResearchQuery();

    console.log('🔍 Orchestrator: Starting research phase');
    console.log(`   Query: ${researchQuery.substring(0, 100)}...`);

    this.researchPackage = await runResearchAgent(
      researchQuery,
      sources,
      this.template.cebCategories
    );

    this.updateProgress('researching', 'Research complete', 25);
    console.log(`   Found: ${this.researchPackage.cebSources.length} CEB, ${this.researchPackage.caseLaw.length} cases`);
  }

  /**
   * Phase 2: Drafting
   */
  private async executeDraftingPhase(): Promise<void> {
    this.updateProgress('drafting', 'Drafting document sections...', 30);

    if (!this.researchPackage) {
      throw new Error('Research package not available');
    }

    console.log('📝 Orchestrator: Starting drafting phase');
    console.log(`   Sections to draft: ${this.template.sections.length}`);

    const totalSections = this.template.sections.length;
    let completedSections = 0;

    this.sections = await runDrafterAgent(
      this.template,
      this.researchPackage,
      this.variables,
      this.userInstructions,
      (section) => {
        completedSections++;
        const percent = 30 + Math.round((completedSections / totalSections) * 40);
        this.updateProgress('drafting', `Drafted: ${section.sectionName}`, percent, section.sectionId);
        this.callbacks.onSectionComplete?.(section);
      }
    );

    this.updateProgress('drafting', 'All sections drafted', 70);
    console.log(`   Completed: ${this.sections.length} sections`);
  }

  /**
   * Phase 3: Citation Processing
   */
  private async executeCitationPhase(): Promise<CitationReport> {
    this.updateProgress('verifying_citations', 'Verifying citations...', 75);

    console.log('📋 Orchestrator: Starting citation phase');

    const citationReport = await runCitationAgent(
      this.sections,
      this.options.citationStyle
    );

    this.updateProgress('verifying_citations', 'Citations verified', 85);
    console.log(`   Total citations: ${citationReport.totalCitations}`);
    console.log(`   Verified: ${citationReport.verifiedCitations}`);

    return citationReport;
  }

  /**
   * Phase 4: Verification
   */
  private async executeVerificationPhase(): Promise<DocumentVerificationReport> {
    this.updateProgress('final_verification', 'Performing final verification...', 88);

    if (!this.researchPackage) {
      throw new Error('Research package not available');
    }

    console.log('🔍 Orchestrator: Starting verification phase');

    const verificationReport = await runVerifierAgent(
      this.sections,
      this.researchPackage,
      this.template.id as DocumentType
    );

    this.updateProgress('final_verification', 'Verification complete', 95);
    console.log(`   Score: ${verificationReport.overallScore}/100`);
    console.log(`   Status: ${verificationReport.approvalStatus}`);

    return verificationReport;
  }

  /**
   * Build the research query from user instructions and template
   */
  private buildResearchQuery(): string {
    let query = this.userInstructions;

    // Add context from template
    query += ` California ${this.template.name}`;

    // Add practice area context
    if (this.template.practiceAreas && this.template.practiceAreas.length > 0) {
      query += ` ${this.template.practiceAreas.join(' ')}`;
    }

    return query;
  }

  /**
   * Assemble the final document
   */
  private assembleDocument(
    citationReport: CitationReport,
    verificationReport: DocumentVerificationReport
  ): GeneratedDocument {
    const wordCount = this.sections.reduce((sum, s) => sum + s.wordCount, 0);

    return {
      id: this.documentId,
      templateId: this.template.id,
      templateName: this.template.name,
      status: 'complete',
      sections: this.sections,
      variables: this.variables,
      createdAt: this.startTime.toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount,
      pageEstimate: Math.ceil(wordCount / 250),
      verificationReport,
      citationReport,
      formatting: this.template.formatting,
    };
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(
    phase: DocumentStatus,
    message: string,
    percentComplete: number,
    currentSection?: string
  ): void {
    this.currentPhase = phase;
    this.callbacks.onProgress?.({
      phase,
      message,
      percentComplete,
      currentSection,
    });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load a template by ID
 */
export async function loadTemplate(templateId: string): Promise<DocumentTemplate> {
  // In production, this would load from the templates directory
  // For now, we'll load from the file system or return a default
  try {
    const templates = await import(`../templates/${templateId}.json`);
    return templates.default || templates;
  } catch (error) {
    console.error(`Failed to load template ${templateId}:`, error);
    throw new Error(`Template not found: ${templateId}`);
  }
}

/**
 * List available templates
 */
export async function listTemplates(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  practiceAreas: string[];
  complexity: string;
  estimatedTime: string;
}>> {
  try {
    const index = await import('../templates/index.json');
    return index.default?.templates || index.templates || [];
  } catch (error) {
    console.error('Failed to load template index:', error);
    return [];
  }
}

/**
 * Main entry point for document generation
 */
export async function orchestrateDocument(
  request: DraftRequest,
  callbacks: OrchestratorCallbacks = {}
): Promise<OrchestratorResult> {
  // Load template
  const template = await loadTemplate(request.documentType);

  // Set default options
  const options: DraftOptions = {
    citationStyle: request.options?.citationStyle || 'california',
    includeTableOfAuthorities: request.options?.includeTableOfAuthorities ?? true,
    maxLength: request.options?.maxLength || 'medium',
    tone: request.options?.tone || 'formal',
  };

  // Fill in default variable values
  const variables = { ...request.variables };
  for (const varDef of template.variables) {
    if (!variables[varDef.id] && varDef.default) {
      if (varDef.default === 'today') {
        variables[varDef.id] = new Date().toISOString().split('T')[0];
      } else {
        variables[varDef.id] = varDef.default;
      }
    }
  }

  // Create and run orchestrator
  const orchestrator = new DocumentOrchestrator(
    template,
    variables,
    request.userInstructions,
    options,
    callbacks
  );

  return orchestrator.execute();
}
