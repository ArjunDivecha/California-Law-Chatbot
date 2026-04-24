/**
 * Drafter Agent
 * 
 * Writes specific document sections using provided research context.
 * Uses Anthropic on AWS Bedrock for high-quality legal writing.
 */

import type { 
  GeneratedSection, 
  ResearchPackage, 
  SectionDefinition,
  DocumentTemplate,
} from '../types';
import { applyVariablesToTemplate, countWords, extractCitations } from './tools';
import { generateText } from '../utils/anthropicBedrock.ts';
import { resolveBedrockModel } from '../utils/bedrockModels.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DRAFTER_SYSTEM_PROMPT = `You are a skilled legal writer drafting sections of California legal documents. You write in formal legal style appropriate for court filings and professional correspondence.

WRITING REQUIREMENTS:
1. Use formal legal writing style - clear, precise, professional
2. Cite authorities in proper California format:
   - Cases: People v. Smith (2020) 50 Cal.App.5th 123, 125
   - Statutes: Cal. Code Civ. Proc. § 2030.300
   - CEB: See CEB Cal. Civil Discovery Practice § 8.32
3. Use active voice where possible
4. Each paragraph should have a clear purpose
5. Maintain consistent terminology throughout
6. Use proper California legal terminology

PLACEHOLDER FORMAT:
Use brackets for information to be filled in by user:
- [CLIENT NAME], [OPPOSING PARTY], [DATE], [SPECIFIC FACT]

STRUCTURE:
- Use markdown formatting (headers, bold, lists) for readability
- Include all citations inline with the text
- Build arguments progressively with clear topic sentences

OUTPUT:
Return ONLY the section content in clean markdown format. Do not include the section heading (it will be added automatically).`;

// =============================================================================
// DRAFTER AGENT CLASS
// =============================================================================

export class DrafterAgent {
  constructor() {
    // Bedrock credentials are resolved lazily by the shared provider helper.
  }

  /**
   * Draft a single section
   */
  async draftSection(
    section: SectionDefinition,
    researchPackage: ResearchPackage,
    variables: Record<string, string>,
    previousSections?: GeneratedSection[],
    userInstructions?: string
  ): Promise<GeneratedSection> {
    console.log(`📝 Drafter Agent: Drafting section "${section.name}"`);

    // Handle template sections (no generation needed)
    if (section.type === 'template' && section.content) {
      const content = applyVariablesToTemplate(section.content, variables);
      return {
        sectionId: section.id,
        sectionName: section.name,
        content,
        wordCount: countWords(content),
        citations: extractCitations(content),
        generatedAt: new Date().toISOString(),
        revisionCount: 0,
      };
    }

    // Build the prompt for generated sections
    const prompt = this.buildPrompt(section, researchPackage, variables, previousSections, userInstructions);

    // Call Bedrock Claude API
    const content = await this.callDrafterModel(prompt);

    return {
      sectionId: section.id,
      sectionName: section.name,
      content,
      wordCount: countWords(content),
      citations: extractCitations(content),
      generatedAt: new Date().toISOString(),
      revisionCount: 0,
    };
  }

  /**
   * Draft multiple sections (can be parallelized)
   */
  async draftSections(
    sections: SectionDefinition[],
    researchPackage: ResearchPackage,
    variables: Record<string, string>,
    userInstructions?: string,
    onSectionComplete?: (section: GeneratedSection) => void
  ): Promise<GeneratedSection[]> {
    const results: GeneratedSection[] = [];
    const previousSections: GeneratedSection[] = [];

    // Draft sections in order (maintaining coherence)
    for (const section of sections.sort((a, b) => a.order - b.order)) {
      const result = await this.draftSection(
        section,
        researchPackage,
        variables,
        previousSections,
        userInstructions
      );
      
      results.push(result);
      previousSections.push(result);
      
      if (onSectionComplete) {
        onSectionComplete(result);
      }
    }

    return results;
  }

  /**
   * Revise a specific section
   */
  async reviseSection(
    section: GeneratedSection,
    revisionInstructions: string,
    researchPackage?: ResearchPackage,
    adjacentSections?: { before?: string; after?: string }
  ): Promise<GeneratedSection> {
    console.log(`✏️ Drafter Agent: Revising section "${section.sectionName}"`);

    const prompt = this.buildRevisionPrompt(
      section,
      revisionInstructions,
      researchPackage,
      adjacentSections
    );

    const content = await this.callDrafterModel(prompt);

    return {
      ...section,
      content,
      wordCount: countWords(content),
      citations: extractCitations(content),
      revisedAt: new Date().toISOString(),
      revisionCount: section.revisionCount + 1,
    };
  }

  /**
   * Build the prompt for section generation
   */
  private buildPrompt(
    section: SectionDefinition,
    research: ResearchPackage,
    variables: Record<string, string>,
    previousSections?: GeneratedSection[],
    userInstructions?: string
  ): string {
    let prompt = `TASK: Write the "${section.name}" section for a legal document.\n\n`;

    // Add user instructions
    if (userInstructions) {
      prompt += `USER REQUEST:\n${userInstructions}\n\n`;
    }

    // Add section-specific instructions
    if (section.promptInstruction) {
      prompt += `SECTION REQUIREMENTS:\n${section.promptInstruction}\n\n`;
    }

    // Add word limit
    if (section.maxLengthWords) {
      prompt += `TARGET LENGTH: Approximately ${section.maxLengthWords} words\n\n`;
    }

    // Add legal requirements
    if (section.legalRequirements && section.legalRequirements.length > 0) {
      prompt += `LEGAL REQUIREMENTS TO CITE:\n`;
      section.legalRequirements.forEach(req => {
        prompt += `- ${req}\n`;
      });
      prompt += '\n';
    }

    // Add research context
    prompt += this.formatResearchContext(research);

    // Add variable values for reference
    prompt += `\nDOCUMENT VARIABLES (use these values):\n`;
    for (const [key, value] of Object.entries(variables)) {
      prompt += `- ${key}: ${value}\n`;
    }
    prompt += '\n';

    // Add previous sections for coherence
    if (previousSections && previousSections.length > 0) {
      prompt += `PREVIOUS SECTIONS (for coherence):\n`;
      const recentSections = previousSections.slice(-2);
      recentSections.forEach(s => {
        prompt += `--- ${s.sectionName} ---\n`;
        prompt += `${s.content.substring(0, 500)}${s.content.length > 500 ? '...' : ''}\n\n`;
      });
    }

    prompt += `\nNow write the "${section.name}" section:`;

    return prompt;
  }

  /**
   * Build the prompt for section revision
   */
  private buildRevisionPrompt(
    section: GeneratedSection,
    instructions: string,
    research?: ResearchPackage,
    adjacentSections?: { before?: string; after?: string }
  ): string {
    let prompt = `TASK: Revise the "${section.sectionName}" section based on the following instructions.\n\n`;

    prompt += `REVISION INSTRUCTIONS:\n${instructions}\n\n`;

    prompt += `CURRENT CONTENT:\n${section.content}\n\n`;

    if (adjacentSections?.before) {
      prompt += `PRECEDING SECTION:\n${adjacentSections.before.substring(0, 300)}...\n\n`;
    }

    if (adjacentSections?.after) {
      prompt += `FOLLOWING SECTION:\n${adjacentSections.after.substring(0, 300)}...\n\n`;
    }

    if (research) {
      prompt += this.formatResearchContext(research);
    }

    prompt += `\nProvide the revised section content:`;

    return prompt;
  }

  /**
   * Format research context for the prompt
   */
  private formatResearchContext(research: ResearchPackage): string {
    let context = `RESEARCH CONTEXT:\n\n`;

    // Add key authorities
    if (research.keyAuthorities && research.keyAuthorities.length > 0) {
      context += `KEY AUTHORITIES:\n`;
      research.keyAuthorities.slice(0, 5).forEach((auth, i) => {
        context += `${i + 1}. [${auth.type.toUpperCase()}] ${auth.citation}\n   ${auth.summary}\n`;
      });
      context += '\n';
    }

    // Add CEB sources
    if (research.cebSources && research.cebSources.length > 0) {
      context += `CEB PRACTICE GUIDE SOURCES:\n`;
      research.cebSources.slice(0, 3).forEach(src => {
        context += `- ${src.cebCitation}: ${src.excerpt?.substring(0, 200)}...\n`;
      });
      context += '\n';
    }

    // Add case law
    if (research.caseLaw && research.caseLaw.length > 0) {
      context += `RELEVANT CASES:\n`;
      research.caseLaw.slice(0, 3).forEach(c => {
        context += `- ${c.caseName} (${c.year}) ${c.citation}\n  Holding: ${c.holding?.substring(0, 150)}...\n`;
      });
      context += '\n';
    }

    // Add statutes
    if (research.statutes && research.statutes.length > 0) {
      context += `APPLICABLE STATUTES:\n`;
      research.statutes.forEach(s => {
        context += `- ${s.code} § ${s.section}\n`;
      });
      context += '\n';
    }

    // Add model language if available
    if (research.modelLanguage && research.modelLanguage.length > 0) {
      context += `MODEL LANGUAGE (from CEB):\n`;
      research.modelLanguage.slice(0, 2).forEach(ml => {
        context += `- Source: ${ml.citation}\n  "${ml.text.substring(0, 200)}..."\n`;
      });
      context += '\n';
    }

    // Add research notes
    if (research.researchNotes) {
      context += `RESEARCH NOTES:\n${research.researchNotes}\n\n`;
    }

    return context;
  }

  /**
   * Call the Bedrock drafter model
   */
  private async callDrafterModel(prompt: string): Promise<string> {
    const response = await generateText({
      model: resolveBedrockModel('drafter').id,
      messages: [{ role: 'user', content: prompt }],
      systemInstruction: DRAFTER_SYSTEM_PROMPT,
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 4096,
    });

    return response.text;
  }
}

/**
 * Draft all sections for a template
 */
export async function runDrafterAgent(
  template: DocumentTemplate,
  researchPackage: ResearchPackage,
  variables: Record<string, string>,
  userInstructions: string,
  onSectionComplete?: (section: GeneratedSection) => void
): Promise<GeneratedSection[]> {
  const agent = new DrafterAgent();
  
  return agent.draftSections(
    template.sections,
    researchPackage,
    variables,
    userInstructions,
    onSectionComplete
  );
}

/**
 * Revise a specific section
 */
export async function reviseSection(
  section: GeneratedSection,
  revisionInstructions: string,
  researchPackage?: ResearchPackage,
  adjacentSections?: { before?: string; after?: string }
): Promise<GeneratedSection> {
  const agent = new DrafterAgent();
  
  return agent.reviseSection(
    section,
    revisionInstructions,
    researchPackage,
    adjacentSections
  );
}
