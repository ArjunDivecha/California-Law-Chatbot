/**
 * Agent Tool Implementations
 * 
 * This file contains the implementations for tools that agents can use.
 * These tools wrap existing API endpoints and provide structured interfaces.
 */

import type {
  CEBSource,
  CaseLawSource,
  StatuteSource,
  VerifiedCitation,
} from '../types';

// =============================================================================
// CEB SEARCH TOOL
// =============================================================================

export interface CEBSearchParams {
  query: string;
  categories?: string[];
  topK?: number;
  includeStatutes?: boolean;
}

export interface CEBSearchResult {
  sources: CEBSource[];
  modelLanguage?: Array<{
    source: string;
    citation: string;
    text: string;
    contentType: string;
  }>;
}

export async function cebSearchTool(params: CEBSearchParams): Promise<CEBSearchResult> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173';
  
  try {
    const response = await fetch(`${baseUrl}/api/ceb-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        categories: params.categories,
        topK: params.topK || 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`CEB search failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract model language from sources that contain sample language
    const modelLanguage = data.sources
      ?.filter((s: CEBSource) => 
        s.excerpt?.toLowerCase().includes('sample') ||
        s.excerpt?.toLowerCase().includes('checklist') ||
        s.excerpt?.toLowerCase().includes('practice tip')
      )
      .map((s: CEBSource) => ({
        source: s.title,
        citation: s.cebCitation,
        text: s.excerpt || '',
        contentType: identifyContentType(s.excerpt || ''),
      }));

    return {
      sources: data.sources || [],
      modelLanguage: modelLanguage?.length > 0 ? modelLanguage : undefined,
    };
  } catch (error) {
    console.error('CEB search tool error:', error);
    return { sources: [] };
  }
}

function identifyContentType(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('checklist')) return 'checklist';
  if (lowerText.includes('sample') || lowerText.includes('form')) return 'sample_clause';
  if (lowerText.includes('practice tip') || lowerText.includes('note:')) return 'practice_tip';
  return 'form_language';
}

// =============================================================================
// COURTLISTENER SEARCH TOOL
// =============================================================================

export interface CourtListenerSearchParams {
  query: string;
  courtFilter?: 'california_all' | 'california_supreme' | 'california_appeals' | 'federal_ninth' | 'all';
  dateAfter?: string;
  maxResults?: number;
}

export async function courtListenerSearchTool(params: CourtListenerSearchParams): Promise<CaseLawSource[]> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173';
  
  try {
    const response = await fetch(`${baseUrl}/api/courtlistener-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        jurisdiction: params.courtFilter === 'california_all' ? 'ca' : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`CourtListener search failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform to CaseLawSource format
    return (data.results || []).slice(0, params.maxResults || 5).map((r: any) => ({
      caseName: r.caseName || r.case_name || 'Unknown Case',
      citation: r.citation || '',
      court: r.court || 'California',
      year: r.dateFiled ? new Date(r.dateFiled).getFullYear() : 0,
      holding: r.snippet || r.holding || '',
      relevance: 'Relevant to query',
      url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : undefined,
      courtlistenerId: r.id?.toString(),
    }));
  } catch (error) {
    console.error('CourtListener search tool error:', error);
    return [];
  }
}

// =============================================================================
// STATUTE LOOKUP TOOL
// =============================================================================

export interface StatuteLookupParams {
  code: string;
  section: string;
}

export async function statuteLookupTool(params: StatuteLookupParams): Promise<StatuteSource | null> {
  // Map code names to leginfo abbreviations
  const codeMap: Record<string, string> = {
    'civil': 'civ',
    'civil code': 'civ',
    'code of civil procedure': 'ccp',
    'ccp': 'ccp',
    'family': 'fam',
    'family code': 'fam',
    'probate': 'prob',
    'probate code': 'prob',
    'penal': 'pen',
    'penal code': 'pen',
    'business and professions': 'bpc',
    'corporations': 'corp',
    'corporations code': 'corp',
    'evidence': 'evid',
    'evidence code': 'evid',
    'government': 'gov',
    'government code': 'gov',
    'labor': 'lab',
    'labor code': 'lab',
  };

  const codeAbbr = codeMap[params.code.toLowerCase()] || params.code.toLowerCase();
  const url = `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=${params.section}&lawCode=${codeAbbr.toUpperCase()}`;

  return {
    code: params.code,
    section: params.section,
    title: `${params.code} § ${params.section}`,
    text: `[Statutory text for ${params.code} section ${params.section}]`, // Would need actual API to get text
    url,
  };
}

// =============================================================================
// CITATION VERIFICATION TOOL
// =============================================================================

export interface VerifyCitationParams {
  citation: string;
  citationType: 'case' | 'statute';
}

export async function verifyCitationTool(params: VerifyCitationParams): Promise<VerifiedCitation> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173';
  
  try {
    const response = await fetch(`${baseUrl}/api/verify-citations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citations: [params.citation],
      }),
    });

    if (!response.ok) {
      throw new Error(`Citation verification failed: ${response.status}`);
    }

    const data = await response.json();
    const result = data.results?.[0];

    return {
      id: crypto.randomUUID(),
      originalText: params.citation,
      canonicalForm: result?.canonicalCitation || params.citation,
      type: params.citationType,
      verified: result?.verified || false,
      verificationSource: result?.source,
      url: result?.url,
      pageReferences: [],
      errorMessage: result?.error,
    };
  } catch (error) {
    console.error('Citation verification tool error:', error);
    return {
      id: crypto.randomUUID(),
      originalText: params.citation,
      canonicalForm: params.citation,
      type: params.citationType,
      verified: false,
      pageReferences: [],
      errorMessage: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// =============================================================================
// LEGISLATIVE SEARCH TOOL
// =============================================================================

export interface LegislativeSearchParams {
  query: string;
  billNumber?: string;
  sessionYear?: string;
}

export interface LegislativeResult {
  bills: Array<{
    billNumber: string;
    title: string;
    status: string;
    lastAction: string;
    url: string;
  }>;
}

export async function legislativeSearchTool(params: LegislativeSearchParams): Promise<LegislativeResult> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173';
  
  try {
    // Try OpenStates first
    const response = await fetch(`${baseUrl}/api/legislative-search?q=${encodeURIComponent(params.billNumber || params.query)}&source=openstates`, {
      method: 'GET',
    });

    if (!response.ok) {
      return { bills: [] };
    }

    const data = await response.json();
    
    return {
      bills: (data.bills || []).map((b: any) => ({
        billNumber: b.identifier || b.bill_number,
        title: b.title,
        status: b.latest_action?.description || 'Unknown',
        lastAction: b.latest_action?.date || '',
        url: b.openstates_url || '',
      })),
    };
  } catch (error) {
    console.error('Legislative search tool error:', error);
    return { bills: [] };
  }
}

// =============================================================================
// TEMPLATE OPERATIONS
// =============================================================================

export function applyVariablesToTemplate(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  
  for (const [key, value] of Object.entries(variables)) {
    // Handle {{variable}} syntax
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
    
    // Also handle {{variable | filter}} syntax (e.g., {{name | uppercase}})
    const filterRegex = new RegExp(`\\{\\{${key}\\s*\\|\\s*uppercase\\}\\}`, 'gi');
    result = result.replace(filterRegex, value.toUpperCase());
  }
  
  return result;
}

// =============================================================================
// WORD COUNT UTILITY
// =============================================================================

export function countWords(text: string): number {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[#*_`~\[\]]/g, '') // Remove markdown formatting
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

// =============================================================================
// CITATION EXTRACTION
// =============================================================================

export function extractCitations(text: string): string[] {
  const citations: string[] = [];
  
  // California case citations: e.g., "People v. Smith (2020) 50 Cal.App.5th 123"
  const casePattern = /[A-Z][a-z]+\s+v\.\s+[A-Z][a-z]+\s*\(\d{4}\)\s*\d+\s+Cal\.\s*(?:App\.)?\s*\d+(?:th|st|nd|rd)?\s*\d+/g;
  const caseMatches = text.match(casePattern) || [];
  citations.push(...caseMatches);
  
  // California statute citations: e.g., "Cal. Fam. Code § 1615" or "CCP § 2030.300"
  const statPattern = /(?:Cal\.\s*)?(?:[A-Z][a-z]+\.?\s*)+(?:Code\s*)?§\s*\d+(?:\.\d+)?(?:\([a-z]\))?/gi;
  const statMatches = text.match(statPattern) || [];
  citations.push(...statMatches);
  
  // CEB citations: e.g., "CEB Cal. Civil Discovery Practice § 8.32"
  const cebPattern = /CEB\s+[A-Za-z\s]+§\s*\d+(?:\.\d+)?/gi;
  const cebMatches = text.match(cebPattern) || [];
  citations.push(...cebMatches);
  
  return [...new Set(citations)]; // Remove duplicates
}
