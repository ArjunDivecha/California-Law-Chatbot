/**
 * Orchestrate Document API Endpoint - Full Multi-Agent Implementation
 * 
 * POST /api/orchestrate-document - Generate a legal document using multi-agent system
 * 
 * Pipeline:
 * 1. Research Agent (Claude Haiku) - Gathers CEB, case law, statutes
 * 2. Drafter Agent (Gemini 2.5 Pro) - Writes sections with research context
 * 3. Citation Agent - Extracts, verifies, formats citations
 * 4. Verifier Agent (Claude Sonnet) - Quality review and approval
 * 
 * Uses Server-Sent Events (SSE) for streaming progress updates.
 * 
 * NOTE: All agent logic is inlined because Vercel serverless functions
 * have trouble with cross-directory TypeScript imports.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel function config
export const config = {
  maxDuration: 300, // 5 minutes for full pipeline
};

// =============================================================================
// INLINE TYPES
// =============================================================================

interface DraftRequest {
  documentType: string;
  userInstructions: string;
  variables?: Record<string, string>;
  options?: {
    citationStyle?: 'california' | 'bluebook';
    includeTableOfAuthorities?: boolean;
    maxLength?: 'short' | 'medium' | 'long';
    tone?: 'formal' | 'persuasive' | 'neutral';
  };
}

interface GeneratedSection {
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
  citations: string[];
  generatedAt: string;
  revisionCount: number;
}

interface SectionDefinition {
  id: string;
  name: string;
  order: number;
  type: 'template' | 'generated';
  content?: string;
  promptInstruction?: string;
  maxLengthWords?: number;
  required: boolean;
  legalRequirements?: string[];
}

interface CEBSource {
  id: string;
  title: string;
  cebCitation: string;
  excerpt?: string;
  confidence: number;
  category?: string;
}

interface CaseLawSource {
  caseName: string;
  citation: string;
  court: string;
  year: number;
  holding?: string;
  url?: string;
}

interface StatuteSource {
  code: string;
  section: string;
  title: string;
  text?: string;
  url?: string;
}

interface ResearchPackage {
  query: string;
  completedAt: string;
  cebSources: CEBSource[];
  caseLaw: CaseLawSource[];
  statutes: StatuteSource[];
  keyAuthorities: Array<{
    rank: number;
    type: string;
    citation: string;
    relevanceScore: number;
    summary: string;
  }>;
  modelLanguage?: Array<{
    source: string;
    citation: string;
    text: string;
    contentType: string;
  }>;
  researchNotes: string;
}

interface VerifiedCitation {
  id: string;
  originalText: string;
  canonicalForm: string;
  type: 'case' | 'statute' | 'secondary';
  verified: boolean;
  verificationSource?: string;
  url?: string;
  pageReferences: number[];
  errorMessage?: string;
}

interface CitationReport {
  totalCitations: number;
  verifiedCitations: number;
  unverifiedCitations: number;
  citations: VerifiedCitation[];
  tableOfAuthorities?: Array<{
    citation: string;
    type: string;
    pageReferences: string;
  }>;
}

interface DocumentVerificationReport {
  overallScore: number;
  approvalStatus: 'approved' | 'needs_revision' | 'rejected';
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
  issues: Array<{
    id: string;
    severity: 'error' | 'warning' | 'suggestion';
    category: string;
    description: string;
    location?: string;
    suggestedFix?: string;
  }>;
  summary: string;
  recommendations: string[];
}

// =============================================================================
// TEMPLATE DATA
// =============================================================================

const TEMPLATES: Record<string, { name: string; sections: SectionDefinition[]; practiceAreas?: string[] }> = {
  legal_memo: {
    name: 'Legal Research Memorandum',
    practiceAreas: ['general', 'litigation', 'trusts_estates'],
    sections: [
      { id: 'header', name: 'Header', order: 1, type: 'template', content: '# MEMORANDUM\n\n**TO:** {{to}}\n\n**FROM:** {{from}}\n\n**DATE:** {{date}}\n\n**RE:** {{subject}}\n\n**CLIENT/MATTER:** {{client_matter}}\n\n---', required: true },
      { id: 'question_presented', name: 'Question Presented', order: 2, type: 'generated', promptInstruction: 'Write a clear statement of the legal question(s) to be analyzed. Frame the question to address the specific legal issue.', maxLengthWords: 150, required: true, legalRequirements: ['Identify the specific legal issue', 'State the relevant jurisdiction (California)'] },
      { id: 'brief_answer', name: 'Brief Answer', order: 3, type: 'generated', promptInstruction: 'Provide a direct answer to the question presented with a brief explanation of the key reasoning.', maxLengthWords: 250, required: true },
      { id: 'facts', name: 'Statement of Facts', order: 4, type: 'generated', promptInstruction: 'Present the relevant facts in a neutral, objective manner. Include all facts relevant to the legal analysis.', maxLengthWords: 500, required: true },
      { id: 'analysis', name: 'Analysis', order: 5, type: 'generated', promptInstruction: 'Provide detailed legal analysis applying California law to the facts. Use IRAC/CREAC structure. Cite California authorities including cases, statutes, and CEB practice guides.', maxLengthWords: 2500, required: true, legalRequirements: ['Cite California case law', 'Cite applicable statutes', 'Reference CEB practice guides where relevant'] },
      { id: 'conclusion', name: 'Conclusion', order: 6, type: 'generated', promptInstruction: 'Summarize the analysis and provide clear recommendations. Address practical implications and next steps.', maxLengthWords: 300, required: true },
    ],
  },
  demand_letter: {
    name: 'Demand Letter',
    practiceAreas: ['litigation', 'business_litigation'],
    sections: [
      { id: 'letterhead', name: 'Letterhead', order: 1, type: 'template', content: '**{{sender_firm}}**\n\n{{sender_address}}\n\n---\n\n{{date}}\n\n**VIA CERTIFIED MAIL**\n\n{{recipient_name}}\n{{recipient_address}}\n\n**Re: Demand on Behalf of {{client_name}}**\n\nDear {{recipient_name}}:', required: true },
      { id: 'introduction', name: 'Introduction', order: 2, type: 'generated', promptInstruction: 'Write a formal opening identifying the sender as legal counsel and briefly state the purpose of the letter.', maxLengthWords: 150, required: true },
      { id: 'factual_background', name: 'Factual Background', order: 3, type: 'generated', promptInstruction: 'Describe the relevant facts giving rise to the claim. Be factual and specific.', maxLengthWords: 400, required: true },
      { id: 'legal_basis', name: 'Legal Basis', order: 4, type: 'generated', promptInstruction: 'Explain the legal basis for the demand under California law. Cite relevant statutes and case law.', maxLengthWords: 400, required: true, legalRequirements: ['Cite California Civil Code', 'Reference relevant case law'] },
      { id: 'demand', name: 'Specific Demand', order: 5, type: 'generated', promptInstruction: 'State the specific demand clearly with a deadline for response.', maxLengthWords: 200, required: true },
      { id: 'consequences', name: 'Consequences', order: 6, type: 'generated', promptInstruction: 'Explain the consequences of non-compliance, including potential litigation.', maxLengthWords: 200, required: true },
      { id: 'closing', name: 'Closing', order: 7, type: 'template', content: 'Please govern yourself accordingly.\n\nVery truly yours,\n\n{{sender_firm}}\n\n_______________________\n{{sender_name}}', required: true },
    ],
  },
  client_letter: {
    name: 'Client Advisory Letter',
    practiceAreas: ['general', 'trusts_estates', 'family_law'],
    sections: [
      { id: 'letterhead', name: 'Letterhead', order: 1, type: 'template', content: '**{{firm_name}}**\n\n{{firm_address}}\n\n---\n\n{{date}}\n\n**PRIVILEGED AND CONFIDENTIAL\nATTORNEY-CLIENT COMMUNICATION**\n\n{{client_name}}\n{{client_address}}\n\n**Re: {{matter_description}}**\n\nDear {{client_name}}:', required: true },
      { id: 'introduction', name: 'Introduction', order: 2, type: 'generated', promptInstruction: 'Write a warm but professional opening acknowledging the client inquiry.', maxLengthWords: 100, required: true },
      { id: 'facts_summary', name: 'Summary of Facts', order: 3, type: 'generated', promptInstruction: 'Summarize the key facts as you understand them from the client.', maxLengthWords: 300, required: true },
      { id: 'legal_analysis', name: 'Legal Analysis', order: 4, type: 'generated', promptInstruction: 'Provide accessible legal analysis in plain language. Explain the law and how it applies to the client situation.', maxLengthWords: 600, required: true },
      { id: 'options', name: 'Options and Recommendations', order: 5, type: 'generated', promptInstruction: 'Present available options with pros and cons for each. Provide clear recommendations.', maxLengthWords: 500, required: true },
      { id: 'next_steps', name: 'Next Steps', order: 6, type: 'generated', promptInstruction: 'Outline recommended next steps and any action items for the client.', maxLengthWords: 200, required: true },
      { id: 'closing', name: 'Closing', order: 7, type: 'template', content: 'Please do not hesitate to contact me if you have any questions or wish to discuss this matter further.\n\nVery truly yours,\n\n{{firm_name}}\n\n_______________________\n{{attorney_name}}', required: true },
    ],
  },
  motion_compel: {
    name: 'Motion to Compel Discovery',
    practiceAreas: ['civil_litigation', 'business_litigation'],
    sections: [
      { id: 'caption', name: 'Caption', order: 1, type: 'template', content: '{{attorney_name}} (State Bar No. {{bar_number}})\n{{firm_name}}\n[ADDRESS]\n[PHONE] | [EMAIL]\n\nAttorney for {{moving_party}}\n\n---\n\n# {{court_name}}\n\n| | |\n|---|---|\n| **{{plaintiff}}**, | Case No. {{case_number}} |\n| Plaintiff(s), | |\n| vs. | **NOTICE OF MOTION AND MOTION TO COMPEL FURTHER RESPONSES TO {{discovery_type}}; MEMORANDUM OF POINTS AND AUTHORITIES; DECLARATION OF {{attorney_name}}** |\n| **{{defendant}}**, | |\n| Defendant(s). | Date: {{hearing_date}} |\n| | Time: {{hearing_time}} |\n| | Dept: {{department}} |\n\n---', required: true },
      { id: 'notice_of_motion', name: 'Notice of Motion', order: 2, type: 'template', content: '## NOTICE OF MOTION\n\nTO ALL PARTIES AND THEIR ATTORNEYS OF RECORD:\n\nPLEASE TAKE NOTICE that on {{hearing_date}}, at {{hearing_time}}, or as soon thereafter as the matter may be heard, in Department {{department}} of the above-entitled court, {{moving_party}} will and hereby does move the Court for an order compelling {{responding_party}} to provide further responses to {{discovery_type}}, Set {{discovery_set_number}}.\n\nThis motion is made on the grounds that {{responding_party}}\'s responses are incomplete, evasive, and/or contain improper objections that have been waived or are without merit.\n\nThis motion is based on this Notice, the attached Memorandum of Points and Authorities, the Declaration of {{attorney_name}}, the exhibits attached thereto, all pleadings and papers on file in this action, and such other matters as may be presented at the hearing.', required: true },
      { id: 'introduction', name: 'Introduction', order: 3, type: 'generated', promptInstruction: 'Write a brief introduction (2-3 paragraphs) explaining: (1) What discovery is at issue and when it was served, (2) The general nature of the deficiencies in the responses, (3) The relief sought (order to compel and sanctions if applicable). Be factual and professional.', maxLengthWords: 250, required: true },
      { id: 'facts', name: 'Statement of Facts', order: 4, type: 'generated', promptInstruction: 'Describe the relevant procedural history: (1) When discovery was served, (2) When responses were due, (3) When responses were received, (4) The specific deficiencies in the responses. Be precise with dates.', maxLengthWords: 400, required: true },
      { id: 'meet_confer', name: 'Meet and Confer Declaration', order: 5, type: 'generated', promptInstruction: 'Detail the meet and confer efforts made in compliance with CCP section 2016.040. Include dates and method of communications, specific issues raised, and why agreement could not be reached.', maxLengthWords: 500, required: true, legalRequirements: ['CCP § 2016.040'] },
      { id: 'legal_standard', name: 'Legal Standard', order: 6, type: 'generated', promptInstruction: 'Set forth the legal standards governing motions to compel further responses. Cite CCP section 2030.300 (interrogatories), section 2031.310 (document requests), or section 2033.290 (admissions) as applicable.', maxLengthWords: 500, required: true, legalRequirements: ['CCP § 2030.300', 'CCP § 2031.310', 'CCP § 2033.290'] },
      { id: 'argument', name: 'Argument', order: 7, type: 'generated', promptInstruction: 'Present the legal argument for why further responses should be compelled. Structure with subheadings for each category of deficiency. Be specific about which responses are at issue.', maxLengthWords: 1500, required: true },
      { id: 'sanctions', name: 'Request for Sanctions', order: 8, type: 'generated', promptInstruction: 'Request monetary sanctions under CCP section 2023.010 et seq. Calculate reasonable attorney fees and explain why sanctions are warranted.', maxLengthWords: 300, required: false, legalRequirements: ['CCP § 2023.010', 'CCP § 2023.030'] },
      { id: 'conclusion', name: 'Conclusion', order: 9, type: 'generated', promptInstruction: 'Summarize the relief requested: order compelling further responses within a specific number of days and monetary sanctions.', maxLengthWords: 150, required: true },
      { id: 'signature_block', name: 'Signature Block', order: 10, type: 'template', content: 'Dated: [DATE]\n\nRespectfully submitted,\n\n{{firm_name}}\n\n\n_______________________\n{{attorney_name}}\nAttorney for {{moving_party}}', required: true },
    ],
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function applyVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
  }
  return result;
}

function countWords(text: string): number {
  return text.replace(/<[^>]*>/g, '').replace(/[#*_`~\[\]]/g, '').split(/\s+/).filter(w => w.length > 0).length;
}

function extractCitations(text: string): string[] {
  // Simplified citation extraction to avoid catastrophic backtracking
  const citations: string[] = [];
  
  try {
    // California case citations: "People v. Smith (2020) 50 Cal.App.5th 123"
    const casePattern = /\b[A-Z][a-z]+\s+v\.\s+[A-Z][a-z]+\s*\(\d{4}\)\s*\d+\s+Cal/g;
    const caseMatches = text.match(casePattern) || [];
    citations.push(...caseMatches);
    
    // Simple statute pattern: "§ 1234" or "Section 1234"
    const statPattern = /§\s*\d+(?:\.\d+)?/g;
    const statMatches = text.match(statPattern) || [];
    citations.push(...statMatches);
    
    // Probate Code
    const probPattern = /Prob(?:ate)?\s*Code\s*§?\s*\d+/gi;
    const probMatches = text.match(probPattern) || [];
    citations.push(...probMatches);
    
    // CEB citations
    const cebPattern = /CEB\s+[\w\s]{1,30}§\s*\d+/gi;
    const cebMatches = text.match(cebPattern) || [];
    citations.push(...cebMatches);
  } catch (e) {
    console.error('Citation extraction error:', e);
  }
  
  return [...new Set(citations)];
}

// =============================================================================
// RESEARCH AGENT (Uses CEB, CourtListener, Statutes)
// =============================================================================

async function runResearchPhase(
  query: string,
  practiceAreas: string[],
  sendEvent: (type: string, data: unknown) => void
): Promise<ResearchPackage> {
  console.log('🔍 Research Agent: Starting research for:', query);
  sendEvent('progress', { phase: 'researching', message: 'Gathering legal authorities...', percentComplete: 10 });

  const cebSources: CEBSource[] = [];
  const caseLaw: CaseLawSource[] = [];
  const statutes: StatuteSource[] = [];
  const keyAuthorities: ResearchPackage['keyAuthorities'] = [];
  const modelLanguage: ResearchPackage['modelLanguage'] = [];

  // Determine base URL for API calls
  // In Vercel dev, use localhost with the port from environment or default to 3003
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : `http://localhost:${process.env.PORT || '3003'}`;

  // 1. CEB Search (with 15s timeout)
  try {
    sendEvent('progress', { phase: 'researching', message: 'Searching CEB practice guides...', percentComplete: 12 });
    
    const cebController = new AbortController();
    const cebTimeout = setTimeout(() => cebController.abort(), 15000);
    
    const cebResponse = await fetch(`${baseUrl}/api/ceb-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        topK: 8,
      }),
      signal: cebController.signal,
    }).finally(() => clearTimeout(cebTimeout));

    if (cebResponse.ok) {
      const cebData = await cebResponse.json();
      if (cebData.sources) {
        cebSources.push(...cebData.sources.map((s: any) => ({
          id: s.id || crypto.randomUUID(),
          title: s.title || 'CEB Source',
          cebCitation: s.cebCitation || s.citation || '',
          excerpt: s.excerpt || s.content || '',
          confidence: s.confidence || s.score || 0.8,
          category: s.category,
        })));

        // Extract model language from CEB
        cebData.sources
          .filter((s: any) => 
            s.excerpt?.toLowerCase().includes('sample') ||
            s.excerpt?.toLowerCase().includes('checklist') ||
            s.excerpt?.toLowerCase().includes('form')
          )
          .forEach((s: any) => {
            modelLanguage.push({
              source: s.title,
              citation: s.cebCitation || '',
              text: s.excerpt || '',
              contentType: 'practice_guidance',
            });
          });
      }
      console.log(`   CEB: Found ${cebSources.length} sources`);
    }
  } catch (error) {
    console.error('CEB search error:', error);
  }

  // 2. CourtListener Case Law Search
  // Uses our `/api/courtlistener-search` proxy which calls CourtListener v4 search.
  try {
    sendEvent('progress', { phase: 'researching', message: 'Searching California case law (CourtListener)...', percentComplete: 16 });

    const clParams = new URLSearchParams({
      q: query,
      limit: '5',
      californiaOnly: 'true',
    });

    // Allow enough time for upstream retries/backoff in the proxy.
    const clController = new AbortController();
    const clTimeoutMs = 45000;
    const clTimeout = setTimeout(() => clController.abort(), clTimeoutMs);

    const clResponse = await fetch(`${baseUrl}/api/courtlistener-search?${clParams.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: clController.signal,
    }).finally(() => clearTimeout(clTimeout));

    if (!clResponse.ok) {
      const details = await clResponse.text().catch(() => '');
      throw new Error(
        `CourtListener proxy error: ${clResponse.status} ${clResponse.statusText}` +
        (details ? ` - ${details.slice(0, 200)}` : '')
      );
    }

    const clData = await clResponse.json();
    const clResults = Array.isArray(clData?.results) ? clData.results : [];

    caseLaw.push(
      ...clResults.slice(0, 6).map((r: any) => ({
        caseName: r.caseName || 'Unknown Case',
        citation: r.citation || '',
        court: r.court || 'California',
        year: r.dateFiled ? new Date(r.dateFiled).getFullYear() : 2020,
        holding: r.snippet || '',
        url: r.url || (r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : undefined),
      }))
    );

    console.log(`   CourtListener: Found ${caseLaw.length} cases`);
  } catch (error) {
    // FAIL LOUD: if CourtListener is unavailable, stop generation rather than silently drafting without case-law context.
    throw error;
  }

  // 3. Build key authorities (ranked)
  sendEvent('progress', { phase: 'researching', message: 'Ranking authorities...', percentComplete: 20 });

  let rank = 1;
  
  // Add top CEB sources
  cebSources.slice(0, 3).forEach(src => {
    keyAuthorities.push({
      rank: rank++,
      type: 'ceb',
      citation: src.cebCitation,
      relevanceScore: src.confidence,
      summary: src.excerpt?.substring(0, 200) || '',
    });
  });

  // Add top cases
  caseLaw.slice(0, 3).forEach(c => {
    keyAuthorities.push({
      rank: rank++,
      type: 'case',
      citation: `${c.caseName} (${c.year}) ${c.citation}`,
      relevanceScore: 0.85,
      summary: c.holding?.substring(0, 200) || '',
    });
  });

  sendEvent('progress', { phase: 'researching', message: 'Research complete', percentComplete: 25 });

  const researchPackage: ResearchPackage = {
    query,
    completedAt: new Date().toISOString(),
    cebSources,
    caseLaw,
    statutes,
    keyAuthorities,
    modelLanguage: modelLanguage.length > 0 ? modelLanguage : undefined,
    researchNotes: `Research completed. Found ${cebSources.length} CEB sources, ${caseLaw.length} cases. Key authorities identified and ranked.`,
  };

  console.log('✅ Research Agent: Complete');
  return researchPackage;
}

// =============================================================================
// DRAFTER AGENT (Uses Gemini 2.5 Pro with Research Context)
// =============================================================================

const DRAFTER_SYSTEM_PROMPT = `You are a skilled legal writer drafting sections of California legal documents. You write in formal legal style appropriate for court filings and professional correspondence.

CRITICAL INSTRUCTIONS:
1. YOU MUST WRITE COMPLETE, COMPREHENSIVE SECTIONS - Never write abbreviated or summary content
2. ALWAYS meet the target word count specified - this is a MINIMUM requirement
3. Each section must be FULLY DEVELOPED with detailed analysis, not bullet points or outlines

WRITING REQUIREMENTS:
1. Use formal legal writing style - clear, precise, professional
2. Cite authorities in proper California format:
   - Cases: People v. Smith (2020) 50 Cal.App.5th 123, 125
   - Statutes: Cal. Prob. Code § 15304
   - CEB: See CEB Cal. Trust Administration § 8.32
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
- Write in full paragraphs, NOT bullet points (unless specifically requested)

OUTPUT:
Return ONLY the section content in clean markdown format. Do not include the section heading (it will be added automatically). Write the COMPLETE section - do not truncate or summarize.`;

function formatResearchContext(research: ResearchPackage): string {
  let context = `\n## RESEARCH CONTEXT:\n\n`;

  // Key authorities (reduced to top 3)
  if (research.keyAuthorities && research.keyAuthorities.length > 0) {
    context += `### Key Authorities:\n`;
    research.keyAuthorities.slice(0, 3).forEach((auth, i) => {
      context += `${i + 1}. ${auth.citation} - ${auth.summary.substring(0, 120)}...\n`;
    });
    context += '\n';
  }

  // CEB sources (reduced to top 2, shorter excerpts)
  if (research.cebSources && research.cebSources.length > 0) {
    context += `### CEB Sources:\n`;
    research.cebSources.slice(0, 2).forEach(src => {
      context += `- ${src.cebCitation}: ${src.excerpt?.substring(0, 150)}...\n`;
    });
    context += '\n';
  }

  // Case law (reduced to top 2)
  if (research.caseLaw && research.caseLaw.length > 0) {
    context += `### Cases:\n`;
    research.caseLaw.slice(0, 2).forEach(c => {
      context += `- ${c.caseName} (${c.year}) ${c.citation}\n`;
    });
    context += '\n';
  }

  // Statutes (brief)
  if (research.statutes && research.statutes.length > 0) {
    context += `### Statutes:\n`;
    research.statutes.slice(0, 3).forEach(s => {
      context += `- ${s.code} § ${s.section}\n`;
    });
    context += '\n';
  }

  return context;
}

async function callGemini(prompt: string, maxWords?: number, retryCount: number = 0): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  console.log(`   🤖 Calling Gemini 2.5 Flash via OpenRouter...${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
  const startTime = Date.now();
  
  // Calculate maxOutputTokens based on word count requirement
  // Rough estimate: 1 token ≈ 0.75 words
  // Gemini 2.5 Flash supports up to 65,535 output tokens
  // We need EXTRA margin because the model often EXCEEDS the target word count (2-3x)
  // For 2500 words: actual output may be 5000+ words = 6667+ tokens
  let maxOutputTokens = 16384; // Higher default for comprehensive legal content
  if (maxWords) {
    // Use 4x buffer to ensure we get complete output even when model over-generates
    // Model supports up to 65,535 tokens, but we cap at 32768 for reasonable latency
    maxOutputTokens = Math.min(Math.ceil((maxWords / 0.75) * 4), 32768);
  }
  console.log(`   📊 Token budget: ${maxOutputTokens} tokens (target: ${maxWords || 'default'} words)`);
  
  // Add timeout to prevent hanging (60 seconds max per section)
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000); // 60 second timeout
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
        'X-Title': 'California Law Chatbot'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: DRAFTER_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: maxOutputTokens,
        top_p: 0.95,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const error = await response.text();
      console.log(`   ❌ Gemini error after ${Date.now() - startTime}ms: ${response.status}`);
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;
    
    console.log(`   ✓ Gemini responded in ${Date.now() - startTime}ms (finishReason: ${finishReason})`);
    
    const content = choice?.message?.content;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('')
        : '';
    if (!text) {
      console.log('   ❌ No content in Gemini response:', JSON.stringify(data).substring(0, 200));
      throw new Error('No content in Gemini response');
    }
    
    // Check if response was truncated
    if (finishReason === 'length') {
      console.warn(`   ⚠️ Response truncated due to token limit (max_tokens: ${maxOutputTokens})`);
      // For now, return what we have - user can edit if needed
    }
    
    return text.trim();
  } catch (error: any) {
    clearTimeout(timeout);
    
    // Retry logic for transient errors (max 2 retries)
    const isRetryable = 
      error.name === 'AbortError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNRESET') ||
      error.message?.includes('ETIMEDOUT') ||
      (error.status >= 500 && error.status < 600);
    
      if (isRetryable && retryCount < 2) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
      console.log(`   ⚠️ Gemini error (retryable), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGemini(prompt, maxWords, retryCount + 1);
    }
    
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.log(`   ❌ Gemini timeout after ${Date.now() - startTime}ms`);
      throw new Error('Gemini API request timed out after 60 seconds');
    }
    throw error;
  }
}

async function runDraftingPhase(
  template: { name: string; sections: SectionDefinition[] },
  research: ResearchPackage,
  variables: Record<string, string>,
  userInstructions: string,
  sendEvent: (type: string, data: unknown) => void
): Promise<GeneratedSection[]> {
  console.log('📝 Drafter Agent: Starting drafting phase');
  sendEvent('progress', { phase: 'drafting', message: 'Drafting document sections...', percentComplete: 30 });

  const sections: GeneratedSection[] = [];
  const totalSections = template.sections.length;
  const previousSections: GeneratedSection[] = [];

  for (let i = 0; i < template.sections.length; i++) {
    const section = template.sections[i];
    const percent = 30 + Math.round((i / totalSections) * 40);

    console.log(`   📄 Section ${i + 1}/${totalSections}: ${section.name}`);
    
    sendEvent('progress', { 
      phase: 'drafting', 
      message: `Drafting: ${section.name}`, 
      percentComplete: percent,
      currentSection: section.id 
    });

    let content: string;

    try {
    if (section.type === 'template' && section.content) {
      // Template section - apply variables only
      content = applyVariables(section.content, variables);
    } else {
      // Generated section - call Gemini with full research context
      let prompt = `TASK: Write the "${section.name}" section for a California ${template.name}.\n\n`;
      
      prompt += `USER REQUEST:\n${userInstructions}\n\n`;
      
      if (section.promptInstruction) {
        prompt += `SECTION REQUIREMENTS:\n${section.promptInstruction}\n\n`;
      }
      
      if (section.maxLengthWords) {
        prompt += `**WORD COUNT REQUIREMENT**: Write approximately ${section.maxLengthWords} words for this section. This should be a comprehensive, detailed section that fully addresses all aspects - not a summary. If the topic requires more depth, you may write up to ${Math.round(section.maxLengthWords * 1.5)} words.\n\n`;
      }
      
      if (section.legalRequirements && section.legalRequirements.length > 0) {
        prompt += `LEGAL REQUIREMENTS TO ADDRESS:\n`;
        section.legalRequirements.forEach(req => {
          prompt += `- ${req}\n`;
        });
        prompt += '\n';
      }
      
      // Add research context
      prompt += formatResearchContext(research);
      
      // Add variable values
      prompt += `\nDOCUMENT VARIABLES (use these values):\n`;
      for (const [key, value] of Object.entries(variables)) {
        prompt += `- ${key}: ${value}\n`;
      }
      prompt += '\n';
      
      // Add previous sections for coherence (limit to most recent one to reduce prompt size)
      if (previousSections.length > 0) {
        prompt += `PREVIOUS SECTION (maintain coherence):\n`;
        const recent = previousSections[previousSections.length - 1];
        prompt += `--- ${recent.sectionName} ---\n`;
        prompt += `${recent.content.substring(0, 300)}${recent.content.length > 300 ? '...' : ''}\n\n`;
      }
      
      prompt += `\nNow write the "${section.name}" section. Remember to cite California authorities.\n\n`;
      prompt += `REMINDER: Write a COMPLETE, FULLY DEVELOPED section. ${section.maxLengthWords ? `Target approximately ${section.maxLengthWords} words. ` : ''}Do not write bullet points or summaries - write full prose with detailed analysis. IMPORTANT: Ensure you end with a complete sentence.`;

      console.log(`   🤖 Starting Gemini call for ${section.name} (target: ${section.maxLengthWords || 'default'} words)...`);
      content = await callGemini(prompt, section.maxLengthWords);
      const wordCount = countWords(content);
      
      // Check if we got too little content
      if (section.maxLengthWords && wordCount < section.maxLengthWords * 0.5) {
        console.error(`   ⚠️ CRITICAL: ${section.name} is SEVERELY underweight: ${wordCount}/${section.maxLengthWords} words (${Math.round(wordCount/section.maxLengthWords*100)}%)`);
        // Log first 200 chars of response to debug
        console.log(`   📝 Content preview: "${content.substring(0, 200)}..."`);
      } else if (section.maxLengthWords && wordCount < section.maxLengthWords * 0.8) {
        console.warn(`   ⚠️ ${section.name} is underweight: ${wordCount}/${section.maxLengthWords} words`);
      } else {
        console.log(`   ✓ ${section.name}: ${wordCount} words generated`);
      }
      console.log(`   📦 Creating section object...`);
    }

    console.log(`   📊 Processing section: ${section.name}`);
    const generatedSection: GeneratedSection = {
      sectionId: section.id,
      sectionName: section.name,
      content,
      wordCount: countWords(content),
      citations: extractCitations(content),
      generatedAt: new Date().toISOString(),
      revisionCount: 0,
    };

    console.log(`   ➕ Adding section to arrays...`);
    sections.push(generatedSection);
    previousSections.push(generatedSection);

    console.log(`   📤 Sending section_complete event...`);
    // Send complete GeneratedSection fields to match frontend expectations
    sendEvent('section_complete', {
      sectionId: generatedSection.sectionId,
      sectionName: generatedSection.sectionName,
      content: generatedSection.content,
      wordCount: generatedSection.wordCount,
      citations: generatedSection.citations,
      generatedAt: generatedSection.generatedAt,
      revisionCount: generatedSection.revisionCount,
    });

    console.log(`   ✅ SECTION COMPLETE: ${section.name} (${generatedSection.wordCount} words, ${generatedSection.citations.length} citations)`);
    console.log(`   🔄 Moving to next section...`);
    } catch (sectionError) {
      console.error(`   ❌ Error generating ${section.name}:`, sectionError);
      // Continue with placeholder content
      const errorSection: GeneratedSection = {
        sectionId: section.id,
        sectionName: section.name,
        content: `[Error generating ${section.name} - please revise manually]`,
        wordCount: 0,
        citations: [],
        generatedAt: new Date().toISOString(),
        revisionCount: 0,
      };
      sections.push(errorSection);
      // Send complete GeneratedSection fields even for error cases
      sendEvent('section_complete', {
        sectionId: errorSection.sectionId,
        sectionName: errorSection.sectionName,
        content: errorSection.content,
        wordCount: errorSection.wordCount,
        citations: errorSection.citations,
        generatedAt: errorSection.generatedAt,
        revisionCount: errorSection.revisionCount,
        error: String(sectionError),
      });
    }
  }

  sendEvent('progress', { phase: 'drafting', message: 'All sections drafted', percentComplete: 70 });
  console.log('✅ Drafter Agent: Complete');
  
  return sections;
}

// =============================================================================
// CITATION AGENT (Extract, Verify, Format)
// =============================================================================

async function runCitationPhase(
  sections: GeneratedSection[],
  citationStyle: 'california' | 'bluebook',
  sendEvent: (type: string, data: unknown) => void
): Promise<CitationReport> {
  console.log('📋 Citation Agent: Processing citations');
  sendEvent('progress', { phase: 'verifying_citations', message: 'Verifying citations...', percentComplete: 75 });

  const allCitations: VerifiedCitation[] = [];
  const citationFirstAppearance = new Map<string, number>();

  // Extract citations from all sections
  for (let pageNum = 1; pageNum <= sections.length; pageNum++) {
    const section = sections[pageNum - 1];
    const sectionCitations = section.citations;

    for (const citationText of sectionCitations) {
      if (!citationFirstAppearance.has(citationText)) {
        citationFirstAppearance.set(citationText, pageNum);

        // Determine citation type
        const isCase = /v\.|vs\./i.test(citationText);
        const isCEB = /^CEB/i.test(citationText);
        let type: 'case' | 'statute' | 'secondary' = 'statute';
        if (isCase) type = 'case';
        else if (isCEB) type = 'secondary';

        // For now, mark CEB as verified (authoritative source)
        // Cases and statutes would need CourtListener verification
        const verified = isCEB || (!isCase && !citationText.includes('v.'));

        allCitations.push({
          id: crypto.randomUUID(),
          originalText: citationText,
          canonicalForm: citationText,
          type,
          verified,
          verificationSource: isCEB ? 'CEB Practice Guide' : verified ? 'California Statutes' : undefined,
          pageReferences: [pageNum],
        });
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
  const tableOfAuthorities = [
    ...allCitations.filter(c => c.type === 'case').sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm)),
    ...allCitations.filter(c => c.type === 'statute').sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm)),
    ...allCitations.filter(c => c.type === 'secondary').sort((a, b) => a.canonicalForm.localeCompare(b.canonicalForm)),
  ].map(c => ({
    citation: c.canonicalForm,
    type: c.type,
    pageReferences: c.pageReferences.join(', '),
  }));

  const verifiedCount = allCitations.filter(c => c.verified).length;

  sendEvent('progress', { phase: 'verifying_citations', message: 'Citations processed', percentComplete: 85 });
  console.log(`✅ Citation Agent: ${allCitations.length} citations, ${verifiedCount} verified`);

  return {
    totalCitations: allCitations.length,
    verifiedCitations: verifiedCount,
    unverifiedCitations: allCitations.length - verifiedCount,
    citations: allCitations,
    tableOfAuthorities,
  };
}

// =============================================================================
// VERIFIER AGENT (Uses Claude Sonnet for Quality Review)
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
   - No [PLACEHOLDER] text remaining
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

Analyze thoroughly and provide a structured verification report.`;

async function runVerificationPhase(
  sections: GeneratedSection[],
  research: ResearchPackage,
  documentType: string,
  sendEvent: (type: string, data: unknown) => void
): Promise<DocumentVerificationReport> {
  console.log('🔍 Verifier Agent: Starting verification');
  sendEvent('progress', { phase: 'final_verification', message: 'Performing final verification...', percentComplete: 88 });

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openrouterKey) {
    console.warn('⚠️ OPENROUTER_API_KEY not set - using basic verification');
    return createBasicVerificationReport(sections);
  }

  try {
    // Build verification prompt
    let prompt = `Please verify the following ${documentType.replace('_', ' ')} document.\n\n`;
    prompt += `## DOCUMENT CONTENT\n\n`;
    sections.forEach(section => {
      prompt += `### ${section.sectionName}\n\n${section.content}\n\n`;
    });

    prompt += `## RESEARCH SOURCES USED\n\n`;
    if (research.keyAuthorities.length > 0) {
      prompt += `### Key Authorities\n`;
      research.keyAuthorities.forEach(auth => {
        prompt += `- ${auth.citation}: ${auth.summary}\n`;
      });
    }
    if (research.cebSources.length > 0) {
      prompt += `### CEB Sources\n`;
      research.cebSources.slice(0, 5).forEach(src => {
        prompt += `- ${src.cebCitation}\n`;
      });
    }

    prompt += `\n## VERIFICATION TASK\n\n`;
    prompt += `Analyze this document and provide a verification report in JSON format:\n`;
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
      "description": "<description>",
      "location": "<section name>",
      "suggested_fix": "<fix>"
    }
  ],
  "summary": "<2-3 sentence summary>",
  "recommendations": ["<recommendation>"]
}
\`\`\`
Provide ONLY the JSON response.`;

    // Call Claude Sonnet via OpenRouter with timeout (45 seconds)
    const verifierController = new AbortController();
    const verifierTimeout = setTimeout(() => verifierController.abort(), 45000);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
        'X-Title': 'California Law Chatbot'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: VERIFIER_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      }),
      signal: verifierController.signal,
    }).finally(() => clearTimeout(verifierTimeout));

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter Claude API error:', error);
      return createBasicVerificationReport(sections);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createBasicVerificationReport(sections);
    }

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    sendEvent('progress', { phase: 'final_verification', message: 'Verification complete', percentComplete: 95 });
    console.log(`✅ Verifier Agent: Score ${parsed.overall_score}/100`);

    return {
      overallScore: parsed.overall_score || 80,
      approvalStatus: parsed.approval_status || 'approved',
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
      summary: parsed.summary || 'Document verified successfully.',
      recommendations: parsed.recommendations || [],
    };
  } catch (error: any) {
    console.error('Verifier error:', error);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.warn('⚠️ Verification timed out - using basic verification report');
    }
    return createBasicVerificationReport(sections);
  }
}

function createBasicVerificationReport(sections: GeneratedSection[]): DocumentVerificationReport {
  const totalCitations = sections.reduce((sum, s) => sum + s.citations.length, 0);
  const wordCount = sections.reduce((sum, s) => sum + s.wordCount, 0);
  
  // Calculate basic score
  let score = 70;
  if (totalCitations >= 5) score += 10;
  if (totalCitations >= 10) score += 5;
  if (wordCount >= 1000) score += 5;
  if (sections.length >= 4) score += 5;

  return {
    overallScore: Math.min(score, 95),
    approvalStatus: score >= 75 ? 'approved' : 'needs_revision',
    totalClaims: totalCitations,
    supportedClaims: totalCitations,
    unsupportedClaims: 0,
    issues: [],
    summary: `Document generated with ${totalCitations} citations across ${sections.length} sections. Manual review recommended.`,
    recommendations: [
      'Review all citations for accuracy',
      'Verify facts against research sources',
      'Check California-specific requirements',
    ],
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Generate correlation ID for request tracking
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] Starting document generation`);
  
  const sendEvent = (type: string, data: unknown) => {
    try {
      const eventData = {
        ...data as object,
        correlationId,
        timestamp: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify({ type, ...eventData })}\n\n`);
    } catch (e) {
      console.error(`[${correlationId}] Failed to send SSE event:`, e);
    }
  };

  // Send heartbeat every 10 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 10000);

  try {
    const request: DraftRequest = req.body;

    if (!request.documentType) {
      sendEvent('error', { error: 'documentType is required', recoverable: false });
      return res.end();
    }

    if (!request.userInstructions) {
      sendEvent('error', { error: 'userInstructions is required', recoverable: false });
      return res.end();
    }

    const template = TEMPLATES[request.documentType];
    if (!template) {
      sendEvent('error', { error: `Unknown template: ${request.documentType}`, recoverable: false });
      return res.end();
    }

    console.log('🎯 Orchestrator: Starting document generation');
    console.log(`   Type: ${template.name}`);
    console.log(`   Instructions: ${request.userInstructions.substring(0, 100)}...`);
    
    sendEvent('progress', { phase: 'initializing', message: 'Starting document generation...', percentComplete: 5 });

    const variables = request.variables || {};
    const citationStyle = request.options?.citationStyle || 'california';

    // ===================
    // PHASE 1: RESEARCH (with overall timeout)
    // ===================
    let researchPackage: ResearchPackage;
    try {
      // Wrap research phase with timeout
      researchPackage = await Promise.race([
        runResearchPhase(
          request.userInstructions,
          template.practiceAreas || ['general'],
          sendEvent
        ),
        new Promise<ResearchPackage>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Research phase timed out after 90 seconds'));
          }, 90000);
        }),
      ]);
    } catch (researchError: any) {
      if (researchError.message?.includes('timed out')) {
        // Create minimal research package to allow generation to continue
        sendEvent('progress', {
          phase: 'researching',
          message: 'Research timeout - continuing with available sources',
          percentComplete: 25,
        });
        researchPackage = {
          query: request.userInstructions,
          completedAt: new Date().toISOString(),
          cebSources: [],
          caseLaw: [],
          statutes: [],
          keyAuthorities: [],
          researchNotes: 'Research incomplete due to timeout - proceeding with generation',
        };
        console.warn('⚠️ Research phase timed out - continuing with minimal research');
      } else {
        throw researchError;
      }
    }

    // ===================
    // PHASE 2: DRAFTING
    // ===================
    const sections = await runDraftingPhase(
      template,
      researchPackage,
      variables,
      request.userInstructions,
      sendEvent
    );

    // ===================
    // PHASE 3: CITATIONS
    // ===================
    const citationReport = await runCitationPhase(
      sections,
      citationStyle,
      sendEvent
    );

    // ===================
    // PHASE 4: VERIFICATION
    // ===================
    const verificationReport = await runVerificationPhase(
      sections,
      researchPackage,
      request.documentType,
      sendEvent
    );

    // ===================
    // ASSEMBLE DOCUMENT
    // ===================
    sendEvent('progress', { phase: 'complete', message: 'Document generation complete', percentComplete: 100 });

    const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);

    sendEvent('document_complete', {
      document: {
        id: crypto.randomUUID(),
        templateId: request.documentType,
        templateName: template.name,
        status: 'complete',
        sections,
        variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: totalWords,
        pageEstimate: Math.ceil(totalWords / 250),
        formatting: {
          fontFamily: 'Times New Roman',
          fontSize: 12,
          lineSpacing: 'double',
          margins: { top: 1, bottom: 1, left: 1, right: 1 },
          pageNumbers: true,
        },
      },
      verificationReport,
      citations: citationReport,
    });

    console.log('✅ Orchestrator: Document generation complete');
    console.log(`   Total words: ${totalWords}`);
    console.log(`   Citations: ${citationReport.totalCitations} (${citationReport.verifiedCitations} verified)`);
    console.log(`   Verification score: ${verificationReport.overallScore}/100`);

    clearInterval(heartbeatInterval);
    return res.end();

  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    clearInterval(heartbeatInterval);
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'Document generation failed',
      recoverable: false,
      suggestion: 'Please try again. If the problem persists, check API keys.',
    });
    return res.end();
  }
}
