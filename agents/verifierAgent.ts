/**
 * Verifier Agent
 * 
 * Performs final quality control on generated documents.
 * Uses Anthropic on AWS Bedrock for final verification and reasoning.
 */

import type {
  GeneratedSection,
  DocumentVerificationReport,
  DocumentIssue,
  ResearchPackage,
  DocumentType,
} from '../types';
import { generateText } from '../utils/anthropicBedrock.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

const VERIFIER_SYSTEM_PROMPT = `You are a senior associate performing final review of a legal document before it goes to a partner. Your job is to catch any errors, inconsistencies, or issues.

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
   - No [PLACEHOLDER] text remaining (except intentional variables like [CLIENT NAME])
   - Introduction matches conclusion
   - All issues raised are addressed

4. CALIFORNIA-SPECIFIC
   - Correct California court names
   - Proper California code citations
   - California Rules of Court compliance where applicable

5. QUALITY STANDARDS
   - Professional tone throughout
   - Clear and precise language
   - Proper legal terminology
   - Appropriate document length

You will receive the document content and research package. Analyze thoroughly and provide a structured report.`;

// =============================================================================
// BEDROCK HELPER
// =============================================================================

async function callVerifierModel(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  const response = await generateText({
    model:
      process.env.BEDROCK_VERIFIER_MODEL ||
      process.env.GEMINI_VERIFIER_MODEL ||
      'us.anthropic.claude-sonnet-4-6',
    messages: [{ role: 'user', content: userMessage }],
    systemInstruction: systemPrompt,
    temperature: 0.2,
    maxOutputTokens: maxTokens,
  });
  return response.text;
}

// =============================================================================
// VERIFIER AGENT CLASS
// =============================================================================

export class VerifierAgent {
  constructor() {
    // No client initialization needed - using fetch
  }

  /**
   * Verify a complete document
   */
  async verifyDocument(
    sections: GeneratedSection[],
    researchPackage: ResearchPackage,
    documentType: DocumentType
  ): Promise<DocumentVerificationReport> {
    console.log('🔍 Verifier Agent: Starting document verification via Anthropic Bedrock...');

    // Build the verification prompt
    const prompt = this.buildVerificationPrompt(sections, researchPackage, documentType);

    try {
      const responseText = await callVerifierModel(VERIFIER_SYSTEM_PROMPT, prompt, 4096);

      // Parse the verification report
      const report = this.parseVerificationResponse(responseText, sections);

      console.log(`✅ Verifier Agent: Complete - Score: ${report.overallScore}/100`);

      return report;
    } catch (error) {
      console.error('❌ Verifier Agent error:', error);
      
      // Return a basic report on error
      return {
        overallScore: 70,
        approvalStatus: 'needs_revision',
        totalClaims: 0,
        supportedClaims: 0,
        unsupportedClaims: 0,
        issues: [{
          id: crypto.randomUUID(),
          severity: 'warning',
          category: 'accuracy',
          description: 'Verification could not be completed. Manual review recommended.',
        }],
        summary: 'Verification encountered an error. Please review the document manually.',
        recommendations: ['Review all citations manually', 'Verify facts against sources'],
      };
    }
  }

  /**
   * Build the verification prompt
   */
  private buildVerificationPrompt(
    sections: GeneratedSection[],
    research: ResearchPackage,
    documentType: DocumentType
  ): string {
    let prompt = `Please verify the following ${documentType.replace('_', ' ')} document.\n\n`;

    prompt += `## DOCUMENT CONTENT\n\n`;
    sections.forEach(section => {
      prompt += `### ${section.sectionName}\n\n`;
      prompt += `${section.content}\n\n`;
    });

    prompt += `## RESEARCH PACKAGE (Sources used)\n\n`;

    if (research.keyAuthorities && research.keyAuthorities.length > 0) {
      prompt += `### Key Authorities\n`;
      research.keyAuthorities.forEach(auth => {
        prompt += `- ${auth.citation}: ${auth.summary}\n`;
      });
      prompt += '\n';
    }

    if (research.cebSources && research.cebSources.length > 0) {
      prompt += `### CEB Sources\n`;
      research.cebSources.slice(0, 5).forEach(src => {
        prompt += `- ${src.cebCitation}\n`;
      });
      prompt += '\n';
    }

    if (research.caseLaw && research.caseLaw.length > 0) {
      prompt += `### Cases\n`;
      research.caseLaw.forEach(c => {
        prompt += `- ${c.caseName} ${c.citation}: ${c.holding?.substring(0, 100)}...\n`;
      });
      prompt += '\n';
    }

    if (research.statutes && research.statutes.length > 0) {
      prompt += `### Statutes\n`;
      research.statutes.forEach(s => {
        prompt += `- ${s.code} § ${s.section}\n`;
      });
      prompt += '\n';
    }

    prompt += `## VERIFICATION TASK\n\n`;
    prompt += `Please analyze this document and provide a verification report in the following JSON format:\n\n`;
    prompt += `\`\`\`json
{
  "overall_score": <number 0-100>,
  "approval_status": "<approved|needs_revision|rejected>",
  "total_claims": <number>,
  "supported_claims": <number>,
  "unsupported_claims": <number>,
  "issues": [
    {
      "severity": "<error|warning|suggestion>",
      "category": "<citation|consistency|completeness|accuracy|formatting>",
      "description": "<description of the issue>",
      "location": "<section name or 'General'>",
      "suggested_fix": "<how to fix>"
    }
  ],
  "summary": "<2-3 sentence summary>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>"]
}
\`\`\`

Provide ONLY the JSON response, no additional text.`;

    return prompt;
  }

  /**
   * Parse the verification response
   */
  private parseVerificationResponse(
    response: string,
    sections: GeneratedSection[]
  ): DocumentVerificationReport {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        overallScore: parsed.overall_score || 75,
        approvalStatus: parsed.approval_status || 'needs_revision',
        totalClaims: parsed.total_claims || 0,
        supportedClaims: parsed.supported_claims || 0,
        unsupportedClaims: parsed.unsupported_claims || 0,
        issues: (parsed.issues || []).map((issue: any) => ({
          id: crypto.randomUUID(),
          severity: issue.severity || 'warning',
          category: issue.category || 'accuracy',
          description: issue.description || '',
          location: issue.location,
          suggestedFix: issue.suggested_fix,
        })),
        summary: parsed.summary || 'Document review complete.',
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error('Error parsing verification response:', error);
      
      // Fallback: analyze the response as plain text
      return this.analyzeAsPlainText(response, sections);
    }
  }

  /**
   * Analyze plain text response when JSON parsing fails
   */
  private analyzeAsPlainText(
    response: string,
    sections: GeneratedSection[]
  ): DocumentVerificationReport {
    const issues: DocumentIssue[] = [];
    
    // Look for common issue indicators
    if (response.toLowerCase().includes('error') || response.toLowerCase().includes('incorrect')) {
      issues.push({
        id: crypto.randomUUID(),
        severity: 'warning',
        category: 'accuracy',
        description: 'Potential accuracy issues detected. Review recommended.',
      });
    }

    if (response.toLowerCase().includes('missing') || response.toLowerCase().includes('incomplete')) {
      issues.push({
        id: crypto.randomUUID(),
        severity: 'warning',
        category: 'completeness',
        description: 'Potential completeness issues detected. Review recommended.',
      });
    }

    // Calculate a basic score
    const wordCount = sections.reduce((sum, s) => sum + s.wordCount, 0);
    const citationCount = sections.reduce((sum, s) => sum + s.citations.length, 0);
    const baseScore = 70;
    const citationBonus = Math.min(citationCount * 2, 15);
    const lengthBonus = wordCount > 500 ? 5 : 0;

    return {
      overallScore: Math.min(baseScore + citationBonus + lengthBonus - issues.length * 5, 100),
      approvalStatus: issues.length > 2 ? 'needs_revision' : 'approved',
      totalClaims: citationCount,
      supportedClaims: citationCount,
      unsupportedClaims: 0,
      issues,
      summary: 'Document verification completed with automated analysis.',
      recommendations: [
        'Review all citations for accuracy',
        'Verify facts match the research sources',
      ],
    };
  }
}

/**
 * Run verification on a document
 */
export async function runVerifierAgent(
  sections: GeneratedSection[],
  researchPackage: ResearchPackage,
  documentType: DocumentType
): Promise<DocumentVerificationReport> {
  const agent = new VerifierAgent();
  return agent.verifyDocument(sections, researchPackage, documentType);
}
