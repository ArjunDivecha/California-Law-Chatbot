/**
 * Guardrails Service - Pre-send validation checks
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility service)
 * 
 * Performs deterministic regex-based checks before displaying answers.
 * Ensures entity containment, citation existence, and jurisdiction compliance.
 * 
 * Version: 1.0
 * Last Updated: 2024
 */

import type { Source, Claim } from '../types';

export interface GuardrailResult {
  passed: boolean;
  blocked: boolean;
  errors: string[];
  warnings: string[];
}

export class GuardrailsService {
  /**
   * Check if entities in answer exist in sources
   */
  static checkEntityContainment(answerText: string, sources: Source[]): GuardrailResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Extract all source excerpts into a single searchable string
    const sourceTexts = sources
      .map(s => s.excerpt || s.title || '')
      .join(' ')
      .toLowerCase();
    
    if (!sourceTexts && sources.length > 0) {
      warnings.push('No source excerpts available for entity containment check');
    }
    
    // Check for case names (e.g., "People v. Anderson")
    const casePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+v\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const caseMatches = answerText.match(casePattern);
    
    if (caseMatches && sourceTexts) {
      for (const caseName of caseMatches) {
        const normalizedCase = caseName.toLowerCase();
        if (!sourceTexts.includes(normalizedCase)) {
          errors.push(`Case name "${caseName}" not found in source excerpts`);
        }
      }
    }
    
    // Check for statute citations (§ 459, Penal Code § 459)
    const statutePattern = /(?:Penal\s+Code|Pen\.\s*Code|Family\s+Code|Civil\s+Code|Evidence\s+Code|Business\s+Code|Probate\s+Code|Code\s+of\s+Civil\s+Procedure)\s*§\s*(\d+)/gi;
    const statuteMatches = answerText.match(statutePattern);
    
    if (statuteMatches && sourceTexts) {
      for (const statute of statuteMatches) {
        const normalizedStatute = statute.toLowerCase();
        if (!sourceTexts.includes(normalizedStatute)) {
          // Check if at least part of it matches (code name or section number)
          const sectionMatch = statute.match(/§\s*(\d+)/i);
          if (sectionMatch && !sourceTexts.includes(`§ ${sectionMatch[1]}`) && !sourceTexts.includes(`section ${sectionMatch[1]}`)) {
            errors.push(`Statute citation "${statute}" not found in source excerpts`);
          }
        }
      }
    }
    
    // Check for dates (years, specifically 4-digit years like 1972, 2024)
    const yearPattern = /\b(19\d{2}|20\d{2})\b/g;
    const yearMatches = answerText.match(yearPattern);
    
    if (yearMatches && sourceTexts) {
      // Only flag if year appears in a legal context (case date, statute year, etc.)
      const legalContextPattern = /(?:(\d{4})|year\s+(\d{4})|filed\s+(\d{4})|decided\s+(\d{4}))/gi;
      const legalYears = answerText.match(legalContextPattern);
      
      if (legalYears) {
        for (const yearMatch of legalYears) {
          const year = yearMatch.match(/\d{4}/)?.[0];
          if (year && !sourceTexts.includes(year)) {
            // Allow common years that might be referenced generally
            const currentYear = new Date().getFullYear();
            const isRecentYear = parseInt(year) >= currentYear - 5;
            if (!isRecentYear) {
              warnings.push(`Year "${year}" in legal context not found in source excerpts`);
            }
          }
        }
      }
    }
    
    // Check for dollar amounts mentioned in legal thresholds
    const dollarPattern = /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\b/g;
    const dollarMatches = answerText.match(dollarPattern);
    
    if (dollarMatches && sourceTexts) {
      for (const dollar of dollarMatches) {
        // Normalize dollar amounts for comparison
        const normalized = dollar.replace(/,/g, '').replace(/\s+/g, '');
        if (!sourceTexts.includes(normalized.toLowerCase()) && !sourceTexts.includes(dollar.toLowerCase())) {
          errors.push(`Dollar amount "${dollar}" not found in source excerpts`);
        }
      }
    }
    
    // Check for time periods (days, years) in legal contexts
    const periodPattern = /\b(\d+)\s+(days?|years?|months?|hours?)\b/gi;
    const periodMatches = answerText.match(periodPattern);
    
    if (periodMatches && sourceTexts) {
      for (const period of periodMatches) {
        const normalized = period.toLowerCase();
        if (!sourceTexts.includes(normalized) && !sourceTexts.includes(period.replace(/\s+/g, ''))) {
          // Be less strict for common periods
          const numberMatch = period.match(/\d+/);
          if (numberMatch) {
            const num = parseInt(numberMatch[0]);
            // Only flag specific numbers that seem like legal thresholds
            if (num > 10 && num < 10000) {
              warnings.push(`Time period "${period}" not found in source excerpts`);
            }
          }
        }
      }
    }
    
    return {
      passed: errors.length === 0,
      blocked: errors.length > 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if all citation IDs in answer map to provided sources
   */
  static checkCitationExistence(answerText: string, sources: Source[]): GuardrailResult {
    const errors: string[] = [];
    
    // Extract citation IDs like [1], [2], etc.
    const citationPattern = /\[(\d+)\]/g;
    const citations = Array.from(answerText.matchAll(citationPattern));
    
    for (const citation of citations) {
      const citationId = parseInt(citation[1], 10);
      // Check if source ID exists (using 1-based indexing)
      const sourceExists = sources[citationId - 1] !== undefined;
      
      if (!sourceExists) {
        errors.push(`Citation [${citationId}] references non-existent source`);
      }
    }
    
    // Also check for source.id references if using string IDs
    const sourceIdPattern = /\[id:([^\]]+)\]/g;
    const sourceIdCitations = Array.from(answerText.matchAll(sourceIdPattern));
    
    const sourceIds = new Set(sources.map(s => s.id).filter(Boolean));
    
    for (const citation of sourceIdCitations) {
      const sourceId = citation[1];
      if (!sourceIds.has(sourceId)) {
        errors.push(`Citation [id:${sourceId}] references non-existent source`);
      }
    }
    
    return {
      passed: errors.length === 0,
      blocked: errors.length > 0,
      errors,
      warnings: []
    };
  }
  
  /**
   * Check jurisdiction compliance (block non-CA reporters unless requested)
   */
  static checkJurisdiction(answerText: string, questionText: string, sources: Source[]): GuardrailResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if question explicitly requests federal/non-CA law
    const requestsFederal = /\b(federal|f\.?3d|supreme\s+court|u\.s\.|scotus|united\s+states)\b/i.test(questionText);
    
    // Non-CA reporters that should be blocked
    const nonCAReporterPatterns = [
      /\bF\.(?:3d|2d|Supp\.?)\s+\d+/gi, // Federal reporters
      /\bU\.S\.\s+\d+/gi, // US Reports
      /\bS\.\s+Ct\.\s+\d+/gi, // Supreme Court Reporter
      /\b\d+\s+F\.(?:3d|2d|Supp\.?)\s+\d+/gi // Full federal citations
    ];
    
    for (const pattern of nonCAReporterPatterns) {
      const matches = answerText.match(pattern);
      if (matches && !requestsFederal) {
        for (const match of matches) {
          errors.push(`Non-California reporter citation "${match}" found. This chatbot focuses on California law.`);
        }
      }
    }
    
    // Check sources for non-CA URLs
    const nonCADomains = ['uscourts.gov', 'supremecourt.gov', 'justice.gov'];
    for (const source of sources) {
      if (nonCADomains.some(domain => source.url.includes(domain)) && !requestsFederal) {
        warnings.push(`Source from ${source.url} may be outside California jurisdiction`);
      }
    }
    
    return {
      passed: errors.length === 0,
      blocked: errors.length > 0,
      errors,
      warnings
    };
  }
  
  /**
   * Run all guardrail checks
   */
  static runAllChecks(
    answerText: string,
    questionText: string,
    sources: Source[],
    claims?: Claim[]
  ): GuardrailResult {
    const results = [
      this.checkEntityContainment(answerText, sources),
      this.checkCitationExistence(answerText, sources),
      this.checkJurisdiction(answerText, questionText, sources)
    ];
    
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    return {
      passed: allErrors.length === 0,
      blocked: allErrors.length > 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }
}
