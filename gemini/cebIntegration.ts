/**
 * CEB Integration Methods for ChatService
 * 
 * This file contains the CEB-specific methods to be added to the ChatService class.
 * These methods enable CEB-first querying and bypass verification for authoritative CEB content.
 * 
 * INTEGRATION INSTRUCTIONS:
 * 1. Copy these methods into the ChatService class in chatService.ts
 * 2. Update the BotResponse interface to include isCEBBased and cebCategory
 * 3. Modify sendMessage() to call searchCEB() first before other sources
 * 4. Import CEBSource type from '../types'
 * 
 * Version: 1.0
 * Last Updated: November 1, 2025
 */

import type { CEBSource } from '../types';
import { fetchWithRetry } from '../utils/fetchWithRetry';

// ============================================================================
// CEB CATEGORY DETECTION
// ============================================================================

/**
 * Detect which CEB category (if any) the query belongs to
 * 
 * Returns:
 *   - 'trusts_estates' for trust/estate/probate queries
 *   - 'family_law' for divorce/custody/support queries  
 *   - 'business_litigation' for contract/tort/commercial queries
 *   - undefined for queries that don't match any category (search all)
 */
private detectCEBCategory(message: string): 'trusts_estates' | 'family_law' | 'business_litigation' | undefined {
  const lowerMessage = message.toLowerCase();
  
  // Trusts & Estates keywords
  const trustsEstatesKeywords = [
    'trust', 'estate', 'probate', 'will', 'executor', 'beneficiary', 
    'settlor', 'testamentary', 'intestate', 'heir', 'fiduciary',
    'conservatorship', 'guardianship', 'power of attorney', 'advance directive',
    'trustee', 'administration', 'decedent', 'inheritance', 'succession'
  ];
  
  // Family Law keywords (including LGBT-specific terms)
  const familyLawKeywords = [
    // Traditional family law
    'divorce', 'custody', 'support', 'marriage', 'prenup', 'dvro',
    'dissolution', 'separation', 'alimony', 'visitation', 'paternity',
    'child support', 'spousal support', 'domestic violence', 'restraining order',
    'marital property', 'community property', 'family court',
    // LGBT-specific family law
    'same-sex', 'same sex', 'lgbtq', 'lgbt', 'domestic partner', 'domestic partnership',
    'registered domestic partner', 'parentage', 'de facto parent', 'second parent',
    'second parent adoption', 'step-parent adoption', 'stepparent adoption',
    'non-biological parent', 'two mothers', 'two fathers', 'two moms', 'two dads',
    'marriage equality', 'assisted reproduction', 'surrogacy', 'sperm donor', 'egg donor',
    'gestational carrier', 'intended parent', 'parentage determination'
  ];
  
  // Business Litigation keywords
  const businessLitigationKeywords = [
    'contract', 'breach', 'damages', 'tort', 'negligence', 'liability',
    'corporation', 'partnership', 'shareholder', 'commercial', 'fraud',
    'breach of contract', 'business dispute', 'fiduciary duty', 'corporate',
    'llc', 'partnership agreement', 'commercial litigation'
  ];
  
  // Count matches for each category
  const trustsScore = trustsEstatesKeywords.filter(k => lowerMessage.includes(k)).length;
  const familyScore = familyLawKeywords.filter(k => lowerMessage.includes(k)).length;
  const businessScore = businessLitigationKeywords.filter(k => lowerMessage.includes(k)).length;
  
  // Return category with highest score (if any)
  if (trustsScore > 0 || familyScore > 0 || businessScore > 0) {
    const maxScore = Math.max(trustsScore, familyScore, businessScore);
    if (trustsScore === maxScore) return 'trusts_estates';
    if (familyScore === maxScore) return 'family_law';
    if (businessScore === maxScore) return 'business_litigation';
  }
  
  return undefined; // No clear category, search all
}

// ============================================================================
// CEB SEARCH
// ============================================================================

/**
 * Search CEB database for relevant content
 * 
 * This is the PRIMARY source for legal information. CEB content is authoritative
 * and does not require verification.
 */
private async searchCEB(message: string, signal?: AbortSignal): Promise<{
  sources: CEBSource[];
  context: string;
  category?: string;
  confidence: number;
}> {
  const category = this.detectCEBCategory(message);
  
  console.log(`🔍 CEB Search: ${category ? `Category: ${category}` : 'All categories'}`);
  
  try {
    const response = await fetchWithRetry(
      '/api/ceb-search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: message, 
          category, 
          topK: 5,
          minScore: 0.7 
        }),
        signal
      },
      2,
      1000
    );
    
    if (!response.ok) {
      throw new Error(`CEB search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ CEB Search: Found ${data.sources.length} sources (confidence: ${data.confidence?.toFixed(2)})`);
    
    return {
      sources: data.sources || [],
      context: data.context || '',
      category: data.category,
      confidence: data.confidence || 0
    };
  } catch (error: any) {
    if (signal?.aborted || error.message === 'Request cancelled') {
      throw error;
    }
    console.error('❌ CEB search failed:', error);
    return { sources: [], context: '', confidence: 0 };
  }
}

// ============================================================================
// CEB CONTEXT FORMATTING
// ============================================================================

/**
 * Format CEB sources into context string for LLM
 */
private formatCEBContext(cebResults: { sources: CEBSource[]; context: string; category?: string }): string {
  if (cebResults.sources.length === 0) {
    return '';
  }

  let formatted = '\n\n🏆 AUTHORITATIVE CEB SOURCES PROVIDED:\n\n';
  
  cebResults.sources.forEach((source, index) => {
    formatted += `[SOURCE ${index + 1}] ${source.cebCitation}\n`;
    if (source.section) {
      formatted += `Section: ${source.section}\n`;
    }
    if (source.pageNumber) {
      formatted += `Page: ${source.pageNumber}\n`;
    }
    formatted += `Confidence: ${(source.confidence * 100).toFixed(1)}%\n`;
    formatted += `\nContent:\n${source.excerpt.substring(0, 1000)}...\n`;
    formatted += `\n${'='.repeat(80)}\n\n`;
  });
  
  return formatted;
}

// ============================================================================
// CEB SYSTEM PROMPT
// ============================================================================

/**
 * Get system prompt for CEB-based responses
 */
private getCEBSystemPrompt(category?: string): string {
  return `You are a California legal expert with access to authoritative CEB (Continuing Education of the Bar) publications.

🏆 CRITICAL: The sources provided below are from official CEB publications - the GOLD STANDARD for California legal practice. These are AUTHORITATIVE and VERIFIED.

${category ? `CEB CATEGORY: ${category.toUpperCase().replace('_', ' & ')}` : 'CEB SOURCES (MULTI-CATEGORY)'}

INSTRUCTIONS:
1. Answer PRIMARILY using the CEB sources provided in the context
2. Quote directly from CEB when possible - these are exact legal texts
3. Cite sources as [CEB: Title, Section] in your response
4. These sources are current and authoritative - trust them completely
5. If CEB sources don't fully answer the question, clearly note what IS covered and what ISN'T
6. Format with clear sections, proper legal citation style, and good spacing
7. Use **bold** for key terms and section headings
8. Add blank lines between major sections for readability

DO NOT:
- Second-guess CEB content or add unnecessary caveats
- Say "I cannot verify" or "this may not be current" - CEB IS current and verified
- Rely on your training data over CEB sources
- Make up information not in the CEB sources

FORMATTING REQUIREMENTS:
- Use markdown with proper spacing
- **Bold** section headings
- Numbered lists for procedures
- Bullet points for requirements
- Blank lines between sections
- Clear hierarchy: Introduction → Main Sections → Details → Summary

EXAMPLE GOOD RESPONSE:
## Trust Administration After Settlor's Death

**Initial Steps:**

According to CEB, the trustee must take the following actions immediately after the settlor's death [CEB: Administering a Single Person Trust After Settlor's Death, § III]:

1. **Secure trust assets** - Take possession of all trust property
2. **Notify beneficiaries** - Provide required notices under Probate Code § 16061.7
3. **Obtain death certificate** - Needed for asset transfers

**Key Requirements:**

The trustee has a fiduciary duty to... [continue with specific CEB content]`;
}

// ============================================================================
// INTEGRATION INTO sendMessage()
// ============================================================================

/**
 * EXAMPLE: How to integrate CEB search into sendMessage()
 * 
 * Add this code at the beginning of sendMessage(), before checking CourtListener:
 */
/*
async sendMessage(message: string, conversationHistory?: Array<{role: string, text: string}>, signal?: AbortSignal): Promise<BotResponse> {
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }
  
  // Quick responses for greetings
  if (message.trim().toLowerCase() === 'hello' || message.trim().toLowerCase() === 'hi') {
    return {
      text: "Hello! I am the California Law Chatbot with access to authoritative CEB publications. How can I help you with your legal research today?",
      sources: []
    };
  }

  // ===== STEP 1: CHECK CEB FIRST (PRIORITY SOURCE) =====
  console.log('🎯 Step 1: Checking CEB database...');
  const cebResults = await this.searchCEB(message, signal);
  
  if (cebResults.sources.length > 0 && cebResults.confidence >= 0.7) {
    console.log('✅ CEB content found with high confidence - using as primary source');
    
    // Format CEB context for LLM
    const cebContext = this.formatCEBContext(cebResults);
    
    // Get CEB-specific system prompt
    const cebSystemPrompt = this.getCEBSystemPrompt(cebResults.category);
    
    // Send to Gemini with CEB context
    const enhancedMessage = `${message}${cebContext}`;

    const response = await this.sendToGemini(
      enhancedMessage,
      conversationHistory,
      signal,
      cebSystemPrompt  // Pass custom system prompt
    );
    
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }
    
    // Return WITHOUT verification (CEB is authoritative)
    return {
      text: response.text,
      sources: cebResults.sources,
      verificationStatus: 'verified', // Auto-verified for CEB
      isCEBBased: true,
      cebCategory: cebResults.category
    };
  }
  
  console.log('⚠️ No high-confidence CEB results, falling back to existing sources...');
  
  // ===== STEP 2: FALLBACK TO EXISTING FLOW =====
  // (CourtListener, legislation, etc.)
  // ... existing code continues ...
}
*/

// ============================================================================
// UPDATE sendToGemini() SIGNATURE
// ============================================================================

/**
 * Update the sendToGemini method signature to accept custom system prompt:
 */
/*
private async sendToGemini(
  message: string, 
  conversationHistory?: Array<{role: string, text: string}>, 
  signal?: AbortSignal,
  customSystemPrompt?: string  // NEW: Allow custom system prompt for CEB
): Promise<{ text: string; hasGrounding?: boolean; groundingMetadata?: any }> {
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  // Use custom system prompt if provided, otherwise use default
  const systemPrompt = customSystemPrompt || `You are an expert legal research assistant...`;
  
  // ... rest of existing code ...
}
*/

// ============================================================================
// UPDATE BotResponse INTERFACE
// ============================================================================

/**
 * Update the BotResponse interface in chatService.ts:
 */
/*
export interface BotResponse {
  text: string;
  sources: (Source | CEBSource)[];  // Updated to include CEBSource
  verificationStatus?: VerificationStatus;
  verificationReport?: VerificationReport;
  claims?: Claim[];
  isCEBBased?: boolean;  // NEW: Flag for CEB-based responses
  cebCategory?: string;   // NEW: Which CEB vertical was used
}
*/

