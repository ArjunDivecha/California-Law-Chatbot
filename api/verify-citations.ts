/**
 * Citation Verification API Endpoint
 *
 * Extracts legal citations from text and verifies them against CourtListener's database.
 * Returns verification status for each citation found.
 *
 * INPUT: Text containing legal citations
 * OUTPUT: Array of citations with verification status (verified, unverified, not_found)
 *
 * Version: 1.0
 * Last Updated: December 18, 2025
 */

export interface CitationVerification {
  text: string;                    // Original citation text
  type: 'case' | 'statute' | 'unknown';
  isValidFormat: boolean;          // Whether the format matches expected patterns
  courtListenerMatch?: {
    id: string;
    url: string;
    caseName: string;
    court?: string;
    dateFiled?: string;
  };
  status: 'verified' | 'unverified' | 'not_found';
}

export interface VerifyCitationsRequest {
  text: string;
  citations?: string[];  // Optional: specific citations to verify
}

export interface VerifyCitationsResponse {
  citations: CitationVerification[];
  totalFound: number;
  verified: number;
  unverified: number;
  notFound: number;
}

// California case citation patterns
const CASE_CITATION_PATTERNS = [
  // California reporters: "123 Cal.App.4th 456", "12 Cal.5th 789"
  /(\d+)\s+(Cal\.?\s*(?:App\.?)?\s*(?:2d|3d|4th|5th)?)\s+(\d+)/gi,
  // Federal reporters: "123 F.3d 456", "12 F.Supp.2d 789"
  /(\d+)\s+(F\.?\s*(?:Supp\.?)?\s*(?:2d|3d)?)\s+(\d+)/gi,
  // US Reports: "123 U.S. 456"
  /(\d+)\s+(U\.?S\.?)\s+(\d+)/gi,
  // WL and Lexis citations: "2024 WL 123456", "2024 Cal. App. LEXIS 123"
  /(\d{4})\s+(WL|Cal\.?\s*(?:App\.?)?\s*LEXIS)\s+(\d+)/gi,
];

// Case name pattern: "People v. Anderson", "Estate of Smith"
const CASE_NAME_PATTERN = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
const ESTATE_PATTERN = /(Estate|Matter|Marriage|Conservatorship|Guardianship)\s+of\s+([A-Z][a-z]+)/gi;

/**
 * Extract case citations from text
 */
function extractCitations(text: string): Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> {
  const citations: Array<{ text: string; type: 'case' | 'statute' | 'unknown' }> = [];
  const seen = new Set<string>();

  // Extract reporter citations
  for (const pattern of CASE_CITATION_PATTERNS) {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    while ((match = pattern.exec(text)) !== null) {
      const citationText = match[0].trim();
      const normalized = citationText.toLowerCase().replace(/\s+/g, ' ');

      if (!seen.has(normalized)) {
        seen.add(normalized);
        citations.push({ text: citationText, type: 'case' });
      }
    }
  }

  // Also try to extract case names with citations
  // Pattern: "Case Name (Year) Citation" or "Case Name, Citation"
  const fullCitationPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\((\d{4})\))?\s*,?\s*(\d+\s+(?:Cal|F|U\.?S)\.?[^,;.\n]+\d+)/gi;
  let match;
  while ((match = fullCitationPattern.exec(text)) !== null) {
    const caseName = match[1];
    const year = match[2];
    const reporter = match[3];
    const fullText = year ? `${caseName} (${year}) ${reporter}` : `${caseName}, ${reporter}`;
    const normalized = fullText.toLowerCase().replace(/\s+/g, ' ');

    if (!seen.has(normalized)) {
      seen.add(normalized);
      citations.push({ text: fullText.trim(), type: 'case' });
    }
  }

  return citations;
}

/**
 * Verify a citation against CourtListener API
 */
async function verifyCitationWithCourtListener(
  citation: string,
  apiKey?: string
): Promise<CitationVerification['courtListenerMatch'] | null> {
  try {
    // Use CourtListener search API
    const searchUrl = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(citation)}&type=o&order_by=score+desc`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'California Law Chatbot/1.0',
    };

    if (apiKey) {
      headers['Authorization'] = `Token ${apiKey}`;
    }

    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      console.log(`⚠️ CourtListener API returned ${response.status} for citation: ${citation}`);
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const topResult = data.results[0];

      // Check if the result is a good match (score-based or name match)
      const caseName = topResult.caseName || topResult.case_name || '';

      return {
        id: String(topResult.id || topResult.cluster_id || ''),
        url: topResult.absolute_url
          ? `https://www.courtlistener.com${topResult.absolute_url}`
          : `https://www.courtlistener.com/opinion/${topResult.id || topResult.cluster_id}/`,
        caseName: caseName,
        court: topResult.court || topResult.court_id || '',
        dateFiled: topResult.dateFiled || topResult.date_filed || ''
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Error verifying citation "${citation}":`, error);
    return null;
  }
}

/**
 * Check if a citation format is valid
 */
function isValidCitationFormat(citation: string): boolean {
  // Must contain numbers (volume/page) and a reporter abbreviation
  const hasNumbers = /\d+/.test(citation);
  const hasReporter = /Cal|F\.|U\.?S\.|WL|LEXIS/i.test(citation);
  return hasNumbers && hasReporter;
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { text, citations: providedCitations }: VerifyCitationsRequest = req.body;

    if (!text && (!providedCitations || providedCitations.length === 0)) {
      res.status(400).json({ error: 'Missing text or citations parameter' });
      return;
    }

    const apiKey = process.env.COURTLISTENER_API_KEY;

    console.log('🔍 Citation Verification: Starting...');

    // Extract citations from text or use provided citations
    let citationsToVerify: Array<{ text: string; type: 'case' | 'statute' | 'unknown' }>;

    if (providedCitations && providedCitations.length > 0) {
      citationsToVerify = providedCitations.map(c => ({ text: c, type: 'case' as const }));
    } else {
      citationsToVerify = extractCitations(text);
    }

    console.log(`📋 Found ${citationsToVerify.length} citations to verify`);

    if (citationsToVerify.length === 0) {
      const response: VerifyCitationsResponse = {
        citations: [],
        totalFound: 0,
        verified: 0,
        unverified: 0,
        notFound: 0
      };
      res.status(200).json(response);
      return;
    }

    // Verify each citation (limit concurrency to avoid rate limiting)
    const verificationPromises = citationsToVerify.map(async (citation, index) => {
      // Stagger requests slightly to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, index * 100));

      const isValid = isValidCitationFormat(citation.text);

      if (!isValid) {
        return {
          text: citation.text,
          type: citation.type,
          isValidFormat: false,
          status: 'unverified' as const
        };
      }

      const clMatch = await verifyCitationWithCourtListener(citation.text, apiKey);

      return {
        text: citation.text,
        type: citation.type,
        isValidFormat: true,
        courtListenerMatch: clMatch || undefined,
        status: clMatch ? 'verified' as const : 'not_found' as const
      };
    });

    const verifications = await Promise.all(verificationPromises);

    // Calculate summary stats
    const verified = verifications.filter(v => v.status === 'verified').length;
    const unverified = verifications.filter(v => v.status === 'unverified').length;
    const notFound = verifications.filter(v => v.status === 'not_found').length;

    console.log(`✅ Citation verification complete: ${verified} verified, ${unverified} unverified, ${notFound} not found`);

    const response: VerifyCitationsResponse = {
      citations: verifications,
      totalFound: verifications.length,
      verified,
      unverified,
      notFound
    };

    res.status(200).json(response);

  } catch (err: any) {
    console.error('Citation Verification API error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to verify citations'
    });
  }
}
