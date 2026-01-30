/**
 * Citation Agent
 * 
 * Verifies, formats, and links all legal citations in the document.
 * Uses Claude Haiku for fast citation processing.
 */

import type {
  GeneratedSection,
  VerifiedCitation,
  CitationReport,
  TableOfAuthoritiesEntry,
} from '../types';
import { verifyCitationTool, extractCitations } from './tools';

// =============================================================================
// CITATION PATTERNS
// =============================================================================

const CASE_PATTERN = /([A-Z][a-zA-Z]+(?:\s+(?:v\.|vs\.)\s+[A-Z][a-zA-Z]+)?)\s*\((\d{4})\)\s*(\d+\s+Cal\.(?:\s*App\.)?\s*\d+(?:th|st|nd|rd)?\s+\d+)/gi;

const STATUTE_PATTERN = /(?:Cal\.\s*)?([A-Z][a-z]+\.?\s*(?:&\s*)?[A-Z]?[a-z]*\.?\s*)?(?:Code\s*)?(?:§|section)\s*(\d+(?:\.\d+)?(?:\([a-z]\))?)/gi;

const CEB_PATTERN = /CEB\s+([A-Za-z\s.]+)§\s*(\d+(?:\.\d+)?)/gi;

// =============================================================================
// CITATION AGENT CLASS
// =============================================================================

export class CitationAgent {
  /**
   * Process all citations in the document sections
   */
  async processCitations(
    sections: GeneratedSection[],
    citationStyle: 'california' | 'bluebook' = 'california'
  ): Promise<CitationReport> {
    console.log('📋 Citation Agent: Processing citations...');

    const allCitations: VerifiedCitation[] = [];
    const citationFirstAppearance: Map<string, number> = new Map();

    // Extract and verify citations from each section
    for (let pageNum = 1; pageNum <= sections.length; pageNum++) {
      const section = sections[pageNum - 1];
      const sectionCitations = this.extractCitationsFromSection(section.content);
      
      for (const citationText of sectionCitations) {
        // Track page references
        if (!citationFirstAppearance.has(citationText)) {
          citationFirstAppearance.set(citationText, pageNum);
          
          // Verify the citation
          const verified = await this.verifyCitation(citationText);
          verified.pageReferences = [pageNum];
          allCitations.push(verified);
        } else {
          // Add page reference to existing citation
          const existing = allCitations.find(c => c.originalText === citationText);
          if (existing && !existing.pageReferences.includes(pageNum)) {
            existing.pageReferences.push(pageNum);
          }
        }
      }
    }

    // Generate table of authorities
    const tableOfAuthorities = this.generateTableOfAuthorities(allCitations);

    // Count verified vs unverified
    const verifiedCount = allCitations.filter(c => c.verified).length;

    console.log(`✅ Citation Agent: Processed ${allCitations.length} citations, ${verifiedCount} verified`);

    return {
      totalCitations: allCitations.length,
      verifiedCitations: verifiedCount,
      unverifiedCitations: allCitations.length - verifiedCount,
      citations: allCitations,
      tableOfAuthorities,
    };
  }

  /**
   * Extract all citations from section content
   */
  private extractCitationsFromSection(content: string): string[] {
    const citations: string[] = [];

    // Extract case citations
    let match;
    const caseRegex = new RegExp(CASE_PATTERN.source, 'gi');
    while ((match = caseRegex.exec(content)) !== null) {
      citations.push(match[0].trim());
    }

    // Extract statute citations
    const statRegex = new RegExp(STATUTE_PATTERN.source, 'gi');
    while ((match = statRegex.exec(content)) !== null) {
      citations.push(match[0].trim());
    }

    // Extract CEB citations
    const cebRegex = new RegExp(CEB_PATTERN.source, 'gi');
    while ((match = cebRegex.exec(content)) !== null) {
      citations.push(match[0].trim());
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Verify a single citation
   */
  private async verifyCitation(citationText: string): Promise<VerifiedCitation> {
    // Determine citation type
    const isCase = /v\.|vs\./i.test(citationText);
    const isCEB = /^CEB/i.test(citationText);
    const isStatute = /§|section/i.test(citationText);

    let type: VerifiedCitation['type'] = 'secondary';
    if (isCase) type = 'case';
    else if (isStatute) type = 'statute';
    else if (isCEB) type = 'secondary';

    try {
      // Try to verify case and statute citations
      if (type === 'case' || type === 'statute') {
        const result = await verifyCitationTool({
          citation: citationText,
          citationType: type,
        });
        return result;
      }

      // CEB citations don't need external verification
      if (isCEB) {
        return {
          id: crypto.randomUUID(),
          originalText: citationText,
          canonicalForm: citationText,
          type: 'secondary',
          verified: true, // CEB is authoritative
          verificationSource: 'CEB Practice Guide',
          pageReferences: [],
        };
      }

      // Default: unverified
      return {
        id: crypto.randomUUID(),
        originalText: citationText,
        canonicalForm: citationText,
        type,
        verified: false,
        pageReferences: [],
        errorMessage: 'Unable to verify citation',
      };
    } catch (error) {
      console.error('Citation verification error:', error);
      return {
        id: crypto.randomUUID(),
        originalText: citationText,
        canonicalForm: citationText,
        type,
        verified: false,
        pageReferences: [],
        errorMessage: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Generate Table of Authorities
   */
  private generateTableOfAuthorities(
    citations: VerifiedCitation[]
  ): TableOfAuthoritiesEntry[] {
    const toa: TableOfAuthoritiesEntry[] = [];

    // Group by type
    const cases = citations.filter(c => c.type === 'case');
    const statutes = citations.filter(c => c.type === 'statute');
    const secondary = citations.filter(c => c.type === 'secondary');

    // Sort and format cases
    cases
      .sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm))
      .forEach(c => {
        toa.push({
          citation: c.canonicalForm,
          type: 'case',
          pageReferences: this.formatPageReferences(c.pageReferences),
        });
      });

    // Sort and format statutes (by code, then section)
    statutes
      .sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm))
      .forEach(c => {
        toa.push({
          citation: c.canonicalForm,
          type: 'statute',
          pageReferences: this.formatPageReferences(c.pageReferences),
        });
      });

    // Sort and format secondary sources
    secondary
      .sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm))
      .forEach(c => {
        toa.push({
          citation: c.canonicalForm,
          type: 'secondary',
          pageReferences: this.formatPageReferences(c.pageReferences),
        });
      });

    return toa;
  }

  /**
   * Format page references (e.g., [1, 2, 3, 5, 6] -> "1-3, 5-6")
   */
  private formatPageReferences(pages: number[]): string {
    if (pages.length === 0) return '';
    if (pages.length === 1) return pages[0].toString();

    const sorted = [...pages].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? start.toString() : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? start.toString() : `${start}-${end}`);

    return ranges.join(', ');
  }

  /**
   * Add hyperlinks to citations in document content
   */
  addHyperlinks(
    content: string,
    citations: VerifiedCitation[]
  ): string {
    let result = content;

    for (const citation of citations) {
      if (citation.url) {
        // Escape special regex characters in the citation text
        const escaped = citation.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        result = result.replace(regex, `[${citation.originalText}](${citation.url})`);
      }
    }

    return result;
  }
}

/**
 * Process citations for a document
 */
export async function runCitationAgent(
  sections: GeneratedSection[],
  citationStyle: 'california' | 'bluebook' = 'california'
): Promise<CitationReport> {
  const agent = new CitationAgent();
  return agent.processCitations(sections, citationStyle);
}
