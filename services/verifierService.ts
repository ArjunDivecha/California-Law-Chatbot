/**
 * Verifier Service - Two-pass verification with Claude Haiku 4.5
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility service)
 * 
 * Implements two-pass verification system:
 * 1. Generator (Gemini 2.5 Flash-Lite) produces answer + claims
 * 2. Verifier (Claude Haiku 4.5) validates claims against sources
 * 3. Returns verified rewrite or refusal if claims unsupported
 * 
 * Version: 2.0
 * Last Updated: October 30, 2025
 */

import { fetchWithRetry } from '../utils/fetchWithRetry';
import type { Source, Claim, VerificationReport, VerificationStatus } from '../types';

export interface GeneratorOutput {
  finalAnswer: string;
  claimsJson: Claim[];
}

export interface VerifierOutput {
  verifiedAnswer: string;
  verificationReport: VerificationReport;
  status: VerificationStatus;
}

export class VerifierService {
  private systemPrompt: string;
  
  constructor() {
    // API keys are now handled server-side via API endpoints
    // IMPROVED PROMPT v2.0 - Better claim extraction and verification
    this.systemPrompt = `You are a legal verification assistant specializing in California law. Your job is to verify claims made in legal answers against provided source documents.

CLAIM IDENTIFICATION:
- A "claim" is any factual assertion, legal rule, statutory requirement, case holding, or procedural statement
- Extract claims even if they don't have explicit citations - they still need verification
- Pay special attention to: dates, deadlines, numerical thresholds, procedural requirements, legal standards

VERIFICATION RULES:
1. For each claim, search ALL provided sources for supporting evidence
2. Mark as "supported" if you find:
   - Direct quotes that state the same thing
   - Paraphrases that convey the same legal meaning
   - Multiple sources that corroborate the claim
3. Mark as "unsupported" if:
   - No source mentions this information
   - Sources contradict the claim
   - The claim goes beyond what sources actually say
4. Mark "ambiguity": true if sources conflict with each other

COVERAGE CALCULATION:
- coverage = supported_claims.length / (supported_claims.length + unsupported_claims.length)
- Be thorough: extract ALL verifiable claims, not just obvious ones

REWRITING RULES:
- If coverage < 0.7, status = "refusal" (don't provide answer)
- If 0.7 <= coverage < 1.0, rewrite to remove unsupported claims
- If coverage = 1.0, use original answer
- NEVER add information not in the original answer
- Preserve all citation markers [id] in rewritten text

Output format (JSON only, no markdown):
{
  "verification_report": {
    "supported_claims": [{"text": "...", "cites": ["id1"], "kind": "statute|case|fact"}],
    "unsupported_claims": [{"text": "...", "cites": ["id1"], "kind": "statute|case|fact"}],
    "verified_quotes": [{"claim": "...", "quotes": ["exact quote"], "sourceId": "id1"}],
    "coverage": 0.0-1.0,
    "min_support": 1,
    "ambiguity": false
  },
  "verified_answer": "rewritten answer OR original if fully verified",
  "status": "verified" | "partially_verified" | "refusal"
}`;
  }
  
  /**
   * Extract claims from generator output using structured parsing
   * IMPROVED v2.0: Better claim detection including uncited claims
   */
  static extractClaimsFromAnswer(answerText: string, sources: Source[]): Claim[] {
    const claims: Claim[] = [];
    const seenClaims = new Set<string>(); // Avoid duplicates
    
    // Try to parse JSON claims if present
    const jsonMatch = answerText.match(/CLAIMS_JSON:\s*(\[[\s\S]*?\])/i);
    if (jsonMatch) {
      try {
        const parsedClaims = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsedClaims)) {
          return parsedClaims.map(c => ({
            text: c.text || '',
            cites: Array.isArray(c.cites) ? c.cites : [],
            kind: c.kind || 'fact'
          }));
        }
      } catch (e) {
        console.warn('Failed to parse CLAIMS_JSON:', e);
      }
    }
    
    // Split into sentences, handling common legal abbreviations
    const text = answerText
      .replace(/\bCal\.\s*/g, 'Cal_DOT ')
      .replace(/\bApp\.\s*/g, 'App_DOT ')
      .replace(/\bProb\.\s*/g, 'Prob_DOT ')
      .replace(/\bFam\.\s*/g, 'Fam_DOT ')
      .replace(/\bCiv\.\s*/g, 'Civ_DOT ')
      .replace(/\bv\.\s*/g, 'v_DOT ');
    
    const sentences = text.split(/[.!?]+/).map(s => 
      s.replace(/Cal_DOT/g, 'Cal.')
       .replace(/App_DOT/g, 'App.')
       .replace(/Prob_DOT/g, 'Prob.')
       .replace(/Fam_DOT/g, 'Fam.')
       .replace(/Civ_DOT/g, 'Civ.')
       .replace(/v_DOT/g, 'v.')
       .trim()
    ).filter(s => s.length > 15);
    
    // Patterns that indicate verifiable claims
    const claimPatterns = [
      /\b(must|shall|required|requires|mandates|prohibits)\b/i,
      /\b(within \d+|after \d+|\d+ days|\d+ years)\b/i,
      /\b(§|section|code|statute)\b/i,
      /\b(court held|ruled|decided|found)\b/i,
      /\b(under California law|pursuant to|according to)\b/i,
      /\b(is defined as|means|includes|excludes)\b/i,
      /\b(penalty|fine|imprisonment|damages)\b/i,
      /\b(burden of proof|standard|threshold)\b/i,
      /\[\d+\]/ // Has citation
    ];
    
    for (const sentence of sentences) {
      // Skip if too short or already seen
      const normalized = sentence.toLowerCase().substring(0, 100);
      if (seenClaims.has(normalized)) continue;
      
      // Check if sentence contains a verifiable claim
      const isVerifiableClaim = claimPatterns.some(pattern => pattern.test(sentence));
      
      if (isVerifiableClaim) {
        seenClaims.add(normalized);
        
        // Extract citations if present
        const cites = Array.from(sentence.matchAll(/\[(\d+)\]/g)).map(m => m[1]);
        
        // Determine claim kind based on content
        let kind: 'statute' | 'case' | 'fact' = 'fact';
        if (/\b(§|section|Penal Code|Family Code|Civil Code|Probate Code|Code of Civil Procedure)\b/i.test(sentence)) {
          kind = 'statute';
        } else if (/\b(v\.|versus|case|court|held|ruling|decision|appeal)\b/i.test(sentence)) {
          kind = 'case';
        }
        
        claims.push({
          text: sentence.trim(),
          cites,
          kind
        });
      }
    }
    
    console.log(`📋 Extracted ${claims.length} claims from answer`);
    return claims;
  }
  
  /**
   * Format sources for verifier prompt
   */
  private static formatSourcesForVerifier(sources: Source[]): string {
    return sources.map((source, index) => {
      const id = source.id || String(index + 1);
      return `[id:${id}]
Title: ${source.title}
URL: ${source.url}
Excerpt: ${source.excerpt || 'No excerpt available'}`;
    }).join('\n\n');
  }
  
  /**
   * Verify claims against sources using second LLM
   */
  async verifyClaims(
    answerText: string,
    claims: Claim[],
    sources: Source[],
    signal?: AbortSignal
  ): Promise<VerifierOutput> {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }
    
    // If no claims extracted, assume all verified (edge case)
    if (claims.length === 0) {
      return {
        verifiedAnswer: answerText,
        verificationReport: {
          coverage: 1.0,
          minSupport: 1,
          ambiguity: false,
          supportedClaims: [],
          unsupportedClaims: [],
          verifiedQuotes: []
        },
        status: 'verified'
      };
    }
    
    // Format sources with IDs
    const formattedSources = VerifierService.formatSourcesForVerifier(sources);
    
    // Create verification prompt
    const verificationPrompt = `You are verifying legal claims against provided source documents.

ANSWER TO VERIFY:
${answerText}

CLAIMS TO VERIFY:
${JSON.stringify(claims, null, 2)}

SOURCES:
${formattedSources}

TASK:
1. For each claim, find 1-2 verbatim quotes from the cited sources that support it
2. Mark each claim as supported or unsupported
3. Calculate coverage = supported_claims / total_claims
4. If coverage < 0.6 or ambiguity detected, return status: "refusal"
5. If 0.6 <= coverage < 1.0, return status: "partially_verified" with rewritten answer
6. If coverage = 1.0, return status: "verified" with original answer

OUTPUT JSON ONLY (no markdown, no explanation):
{
  "verification_report": {
    "supported_claims": [...],
    "unsupported_claims": [...],
    "verified_quotes": [...],
    "coverage": 0.0-1.0,
    "min_support": 1,
    "ambiguity": false
  },
  "verified_answer": "...",
  "status": "verified" | "partially_verified" | "refusal"
}`;
    
    try {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }
      
      // Call Claude Haiku 4.5 API via server-side endpoint
      const response = await fetchWithRetry(
        '/api/claude-chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: verificationPrompt,
            systemPrompt: this.systemPrompt,
          }),
          signal, // Pass AbortSignal for cancellation
        },
        2, // maxRetries
        1000 // baseDelay
      );

      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      if (!response.ok) {
        if (response.status === 499) {
          throw new Error('Request cancelled');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.text || '';
      
      // Extract JSON from response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find JSON in code blocks
        jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[0], jsonMatch[1]];
        }
      }
      
      if (!jsonMatch) {
        throw new Error('Verifier did not return valid JSON');
      }
      
      const verificationResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      
      // Validate and structure the result
      const verificationReport: VerificationReport = {
        coverage: Math.max(0, Math.min(1, verificationResult.verification_report?.coverage || 0)),
        minSupport: verificationResult.verification_report?.min_support || 1,
        ambiguity: verificationResult.verification_report?.ambiguity || false,
        supportedClaims: verificationResult.verification_report?.supported_claims || [],
        unsupportedClaims: verificationResult.verification_report?.unsupported_claims || [],
        verifiedQuotes: verificationResult.verification_report?.verified_quotes || []
      };
      
      // Determine status based on coverage
      let status: VerificationStatus = 'verified';
      if (verificationReport.coverage < 0.6 || verificationReport.ambiguity) {
        status = 'refusal';
      } else if (verificationReport.coverage < 1.0) {
        status = 'partially_verified';
      }
      
      // Use rewritten answer if provided, otherwise use original
      const verifiedAnswer = verificationResult.verified_answer || answerText;
      
      return {
        verifiedAnswer,
        verificationReport,
        status
      };
      
    } catch (error: any) {
      if (signal?.aborted || error.message === 'Request cancelled') {
        throw error;
      }
      
      console.error('Verification failed:', error);
      
      // Fallback: return unverified status
      return {
        verifiedAnswer: answerText,
        verificationReport: {
          coverage: 0,
          minSupport: 0,
          ambiguity: true,
          supportedClaims: [],
          unsupportedClaims: claims,
          verifiedQuotes: []
        },
        status: 'unverified'
      };
    }
  }
  
  /**
   * Determine if verification should be skipped (selective verification)
   */
  static shouldVerify(questionText: string, isHighRisk: boolean): boolean {
    // Always verify high-risk queries
    if (isHighRisk) return true;
    
    // 50% sampling for low-risk (can be made configurable)
    // For now, verify all queries
    return true;
  }
}
