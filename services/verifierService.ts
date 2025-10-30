/**
 * Verifier Service - Two-pass verification with second LLM
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility service)
 * 
 * Implements two-pass verification system:
 * 1. Generator (A) produces answer + claims
 * 2. Verifier (V) validates claims against sources
 * 3. Returns verified rewrite or refusal if claims unsupported
 * 
 * Version: 1.0
 * Last Updated: 2024
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
    this.systemPrompt = `You are a legal verification assistant. Your job is to verify claims made in legal answers against provided source documents.

CRITICAL RULES:
1. For each claim, find 1-2 verbatim quotes from the cited sources that support it
2. Mark claims as "supported" only if you find exact quotes or very close paraphrases
3. If a claim lacks supporting evidence, mark it as "unsupported"
4. If overall support is thin (< 60% of claims), return a refusal
5. If some claims are unsupported, produce a VERIFIED_REWRITE using only supported claims
6. Maintain proper citations [id] in rewritten answers
7. Be strict: when in doubt, mark as unsupported

Output format (JSON):
{
  "verification_report": {
    "supported_claims": [{"text": "...", "cites": ["id1"], "kind": "statute"}],
    "unsupported_claims": [{"text": "...", "cites": ["id1"], "kind": "case"}],
    "verified_quotes": [
      {
        "claim": "claim text",
        "quotes": ["exact quote 1", "exact quote 2"],
        "sourceId": "id1"
      }
    ],
    "coverage": 0.85,
    "min_support": 1,
    "ambiguity": false
  },
  "verified_answer": "rewritten answer using only supported claims, or original if all supported",
  "status": "verified" | "partially_verified" | "refusal"
}`;
  }
  
  /**
   * Extract claims from generator output using structured parsing
   */
  static extractClaimsFromAnswer(answerText: string, sources: Source[]): Claim[] {
    const claims: Claim[] = [];
    
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
    
    // Fallback: extract claims from sentences with citations
    const sentences = answerText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    for (const sentence of sentences) {
      // Look for sentences with citations
      const citationMatch = sentence.match(/\[(\d+)\]/);
      if (citationMatch) {
        const cites = Array.from(sentence.matchAll(/\[(\d+)\]/g)).map(m => m[1]);
        
        // Determine claim kind based on content
        let kind: 'statute' | 'case' | 'fact' = 'fact';
        if (/\b(§|section|Penal Code|Family Code|Civil Code)\b/i.test(sentence)) {
          kind = 'statute';
        } else if (/\b(v\.|versus|case|court)\b/i.test(sentence)) {
          kind = 'case';
        }
        
        claims.push({
          text: sentence.trim(),
          cites,
          kind
        });
      }
    }
    
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
      
      // Call Gemini API via server-side endpoint
      const response = await fetchWithRetry(
        '/api/gemini-chat',
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
