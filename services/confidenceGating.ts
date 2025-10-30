/**
 * Confidence Gating Service
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility service)
 * 
 * Implements confidence gating logic to determine verification status
 * and handle partial verification scenarios.
 * 
 * Version: 1.0
 * Last Updated: 2024
 */

import type { VerificationReport, VerificationStatus } from '../types';

export interface ConfidenceGateResult {
  status: VerificationStatus;
  shouldShow: boolean;
  caveat?: string;
}

export class ConfidenceGatingService {
  /**
   * Gate answer based on verification report
   * 
   * @param report - Verification report from verifier
   * @param hasBillText - Whether full bill text was provided in sources
   * @param hasGrounding - Whether Google Search grounding was used
   */
  static gateAnswer(report: VerificationReport, hasBillText: boolean = false, hasGrounding: boolean = false): ConfidenceGateResult {
    const { coverage, minSupport, ambiguity } = report;
    
    // Determine appropriate threshold based on data sources
    // Priority: Google Search grounding (20%) > Bill text (30%) > Normal (60%)
    // When Google Search grounding is used, information is real-time from Google
    // When we have actual bill text, we can be more permissive since it's authoritative
    let coverageThreshold = 0.6; // Default
    let dataSource = 'normal';
    
    if (hasGrounding) {
      coverageThreshold = 0.2; // Most permissive - Google Search is current and authoritative
      dataSource = 'Google Search grounding';
    } else if (hasBillText) {
      coverageThreshold = 0.3; // Permissive - bill text is authoritative
      dataSource = 'bill text';
    }
    
    console.log(`📊 Confidence gating: coverage=${coverage}, threshold=${coverageThreshold}, source=${dataSource}`);
    
    // Gate 1: Coverage = 1.0, min_support >= 1, no ambiguity → Verified
    if (coverage === 1.0 && minSupport >= 1 && !ambiguity) {
      return {
        status: 'verified',
        shouldShow: true
      };
    }
    
    // Gate 2: Coverage >= threshold but < 1.0 → Partially verified
    if (coverage >= coverageThreshold && coverage < 1.0) {
      const unsupportedCount = report.unsupportedClaims.length;
      let caveat: string;
      
      if (hasGrounding) {
        // Most lenient message when Google Search grounding is used
        caveat = unsupportedCount > 0
          ? `Note: This response includes recent information from Google Search. ${unsupportedCount} claim${unsupportedCount > 1 ? 's' : ''} could not be independently verified, but the information is grounded in current web sources.`
          : 'This response includes recent information from Google Search.';
      } else if (hasBillText) {
        // Lenient message when bill text is present
        caveat = unsupportedCount > 0
          ? `Note: This response is based on the actual bill text provided. ${unsupportedCount} claim${unsupportedCount > 1 ? 's' : ''} could not be independently verified, but the information comes directly from the bill.`
          : 'This response is based on the actual bill text provided.';
      } else {
        caveat = unsupportedCount > 0
          ? `Note: ${unsupportedCount} claim${unsupportedCount > 1 ? 's' : ''} could not be fully verified against the provided sources. Please verify critical information independently.`
          : 'Some claims in this response may require additional verification against primary legal sources.';
      }
      
      return {
        status: 'partially_verified',
        shouldShow: true,
        caveat
      };
    }
    
    // Gate 3: Coverage < threshold or ambiguity → Refusal
    if (coverage < coverageThreshold || ambiguity) {
      const reason = ambiguity 
        ? 'Conflicting or ambiguous sources were found.'
        : `Only ${Math.round(coverage * 100)}% of claims could be verified.`;
      
      return {
        status: 'refusal',
        shouldShow: false,
        caveat: `I cannot provide a verified answer. ${reason} Please consult with a qualified attorney or refer to primary legal sources directly.`
      };
    }
    
    // Default: unverified
    return {
      status: 'unverified',
      shouldShow: true,
      caveat: 'This response has not been verified. Please verify all information independently.'
    };
  }
  
  /**
   * Check if high-risk category requires quotes-only mode
   */
  static isHighRiskCategory(questionText: string, sources: Array<{ title?: string; excerpt?: string }>): boolean {
    const highRiskKeywords = [
      'penalty', 'punishable', 'years', 'days', 'deadline',
      'statute of limitations', 'threshold', 'over $', 'elements of',
      'mens rea', 'burden', 'maximum', 'minimum', 'fine', 'prison',
      'sentence', 'conviction', 'felony', 'misdemeanor'
    ];
    
    const normalizedQuestion = questionText.toLowerCase();
    
    // Check question text
    for (const keyword of highRiskKeywords) {
      if (normalizedQuestion.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // Check source titles/excerpts
    const sourceText = sources
      .map(s => `${s.title || ''} ${s.excerpt || ''}`)
      .join(' ')
      .toLowerCase();
    
    for (const keyword of highRiskKeywords) {
      if (sourceText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Determine if quotes-only mode should be used
   */
  static shouldUseQuotesOnly(questionText: string, sources: Array<{ title?: string; excerpt?: string }>): boolean {
    return this.isHighRiskCategory(questionText, sources);
  }
}
