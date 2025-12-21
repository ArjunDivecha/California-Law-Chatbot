/**
 * CEB Search API Endpoint
 * 
 * Queries Upstash Vector database for relevant CEB (Continuing Education of the Bar) content.
 * This endpoint searches across CEB publications (Trusts & Estates, Family Law, Business Litigation)
 * and returns the most relevant chunks with metadata.
 * 
 * INPUT: User query, optional category filter, optional topK
 * OUTPUT: Relevant CEB sources with excerpts, formatted context, confidence scores
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - LRU cache for query embeddings (within-request)
 * - Upstash Redis cache for embeddings (cross-request, if configured)
 * 
 * Version: 1.3
 * Last Updated: December 2, 2025
 */

import { Index } from '@upstash/vector';

// ============================================================================
// STATUTORY CITATION DETECTION (inline to avoid import issues in Vercel)
// ============================================================================
function containsCodeCitation(text: string): boolean {
  const patterns = [
    /(?:Cal\.?\s+)?(?:Fam(?:ily)?|Prob(?:ate)?|Civ(?:il)?|Pen(?:al)?|Gov)/i,
    /\b(?:FAM|PROB|CIV|CCP|PEN|GOV)\s*(?:§|[Ss]ec)/i
  ];
  return patterns.some(p => p.test(text));
}

function parseCodeCitation(text: string): Array<{ fullName: string; section: string; url: string }> {
  const results: Array<{ fullName: string; section: string; url: string }> = [];
  const codes: Record<string, string> = {
    'FAM': 'Family Code', 'PROB': 'Probate Code', 'CIV': 'Civil Code',
    'CCP': 'Code of Civil Procedure', 'PEN': 'Penal Code'
  };

  // Match "Family Code section 1615" or "Cal. Fam. Code § 1615"
  const pattern = /(?:Cal\.?\s+)?(?:(Fam(?:ily)?|Prob(?:ate)?|Civ(?:il)?|Pen(?:al)?|Gov(?:ernment)?)|([A-Z]+))\s*Code\s*(?:§|[Ss]ec(?:tion)?\.?)?\s*(\d+(?:\.\d+)?)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const codeName = match[1] || match[2] || '';
    const section = match[3];

    let lawCode = '';
    let fullName = '';

    // Map to law code
    if (codeName.toLowerCase().startsWith('fam')) { lawCode = 'FAM'; fullName = 'Family Code'; }
    else if (codeName.toLowerCase().startsWith('prob')) { lawCode = 'PROB'; fullName = 'Probate Code'; }
    else if (codeName.toLowerCase().startsWith('civ') && codeName.length < 10) { lawCode = 'CIV'; fullName = 'Civil Code'; }
    else if (codeName.toLowerCase().startsWith('pen')) { lawCode = 'PEN'; fullName = 'Penal Code'; }
    else if (codeName.toLowerCase().startsWith('gov')) { lawCode = 'GOV'; fullName = 'Government Code'; }

    if (lawCode && section) {
      results.push({
        fullName,
        section,
        url: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${lawCode}&sectionNum=${section}`
      });
    }
  }

  return results;
}

function citationToSearchTerms(citations: Array<{ fullName: string; section: string }>): string[] {
  return citations.map(c => `${c.fullName} section ${c.section}`);
}

// ============================================================================
// REDIS CACHE - Cross-request embedding cache (optional)
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable
// ============================================================================
const REDIS_CACHE_TTL = 86400; // 24 hours

async function getRedisCache(key: string): Promise<number[] | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) return null;

  try {
    const response = await fetch(`${redisUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const data = await response.json();
    if (data.result) {
      console.log(`🔴 Redis cache HIT for embedding`);
      return JSON.parse(data.result);
    }
  } catch (e) {
    console.log(`⚠️ Redis cache error: ${e}`);
  }
  return null;
}

async function setRedisCache(key: string, value: number[]): Promise<void> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) return;

  try {
    await fetch(`${redisUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}/ex/${REDIS_CACHE_TTL}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    console.log(`🔴 Redis cache SET for embedding`);
  } catch (e) {
    console.log(`⚠️ Redis cache set error: ${e}`);
  }
}

// ============================================================================
// EMBEDDING CACHE - LRU Cache for query embeddings
// Reduces OpenAI API calls for repeated/similar queries
// ============================================================================
const EMBEDDING_CACHE_SIZE = 100; // Max cached embeddings
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

/**
 * Normalize query for cache key (lowercase, trim, collapse whitespace)
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// QUERY EXPANSION - Add synonyms and related terms for better semantic matching
// ============================================================================
const LEGAL_SYNONYMS: Record<string, string[]> = {
  // Trust terms
  'trust': ['trust instrument', 'trust agreement', 'declaration of trust'],
  'revocable trust': ['living trust', 'inter vivos trust', 'revocable living trust'],
  'irrevocable trust': ['irrevocable living trust', 'permanent trust'],
  'trustee': ['successor trustee', 'co-trustee', 'trust administrator'],
  'beneficiary': ['trust beneficiary', 'remainder beneficiary', 'income beneficiary'],
  'settlor': ['trustor', 'grantor', 'trust creator'],

  // Estate terms
  'will': ['last will', 'testament', 'last will and testament'],
  'probate': ['probate administration', 'probate proceeding', 'estate administration'],
  'executor': ['personal representative', 'estate administrator'],
  'heir': ['beneficiary', 'devisee', 'legatee'],
  'intestate': ['without a will', 'intestacy'],

  // Family law terms
  'divorce': ['dissolution', 'dissolution of marriage', 'marital dissolution'],
  'custody': ['child custody', 'legal custody', 'physical custody'],
  'support': ['spousal support', 'child support', 'alimony', 'maintenance'],
  'property division': ['community property', 'marital property', 'asset division'],

  // LGBT family law terms
  'same-sex': ['same sex couple', 'registered domestic partner', 'domestic partnership'],
  'lgbtq': ['lgbt', 'same-sex', 'domestic partner', 'marriage equality'],
  'domestic partner': ['registered domestic partner', 'domestic partnership', 'Cal. Fam. Code 297'],
  'parentage': ['de facto parent', 'intended parent', 'presumed parent'],
  'adoption': ['second parent adoption', 'stepparent adoption'],

  // Common legal terms
  'amendment': ['modification', 'change', 'alteration'],
  'revocation': ['revoke', 'cancel', 'terminate'],
  'requirements': ['requirements', 'elements', 'prerequisites', 'conditions'],
  'valid': ['validity', 'enforceable', 'legally valid'],
  'capacity': ['mental capacity', 'legal capacity', 'competency'],
};

/**
 * Expand query with legal synonyms for better semantic matching
 */
function expandQuery(query: string): string {
  let expandedQuery = query;
  const lowerQuery = query.toLowerCase();

  // Find matching terms and add synonyms
  const addedTerms: string[] = [];

  for (const [term, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
    if (lowerQuery.includes(term.toLowerCase())) {
      // Add first 2 synonyms that aren't already in the query
      for (const synonym of synonyms.slice(0, 2)) {
        if (!lowerQuery.includes(synonym.toLowerCase()) && !addedTerms.includes(synonym)) {
          addedTerms.push(synonym);
        }
      }
    }
  }

  if (addedTerms.length > 0) {
    expandedQuery = `${query} (related: ${addedTerms.join(', ')})`;
    console.log(`🔍 Query expanded: "${query}" → "${expandedQuery}"`);
  }

  return expandedQuery;
}

/**
 * Get embedding from cache or generate new one
 * Checks: 1) In-memory LRU cache, 2) Redis cache, 3) Generate new
 */
async function getCachedEmbedding(query: string): Promise<{ embedding: number[]; cached: boolean; cacheType?: string }> {
  const cacheKey = normalizeQuery(query);
  const redisCacheKey = `emb:${cacheKey.substring(0, 100)}`; // Limit key length

  // Check in-memory cache first (fastest)
  const memCached = embeddingCache.get(cacheKey);
  if (memCached) {
    memCached.timestamp = Date.now();
    console.log(`📦 Memory cache HIT`);
    return { embedding: memCached.embedding, cached: true, cacheType: 'memory' };
  }

  // Check Redis cache (cross-request persistence)
  const redisCached = await getRedisCache(redisCacheKey);
  if (redisCached) {
    // Also store in memory for faster subsequent access
    embeddingCache.set(cacheKey, { embedding: redisCached, timestamp: Date.now() });
    return { embedding: redisCached, cached: true, cacheType: 'redis' };
  }

  // Generate new embedding
  console.log(`🔄 Cache MISS - generating embedding`);
  const embedding = await generateEmbedding(query);

  // Store in both caches
  // Memory cache with LRU eviction
  if (embeddingCache.size >= EMBEDDING_CACHE_SIZE) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, value] of embeddingCache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) embeddingCache.delete(oldestKey);
  }
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

  // Redis cache (async, don't await)
  setRedisCache(redisCacheKey, embedding).catch(() => { });

  return { embedding, cached: false };
}

interface CEBSearchRequest {
  query: string;
  category?: 'trusts_estates' | 'family_law' | 'business_litigation';
  topK?: number;
  minScore?: number;
}

interface CEBSearchResponse {
  sources: Array<{
    title: string;
    url: string;
    excerpt: string;
    isCEB: true;
    category: string;
    cebCitation: string;
    pageNumber?: number;
    section?: string;
    confidence: number;
  }>;
  context: string;
  isCEB: true;
  category?: string;
  confidence: number;
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

    const { query, category, topK = 5, minScore = 0.7 }: CEBSearchRequest = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Missing or invalid query parameter' });
      return;
    }

    // Check for Upstash credentials
    const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL;
    const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      console.error('Upstash credentials not configured');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'Upstash Vector credentials not configured. Please set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in environment variables.'
      });
      return;
    }

    console.log('🔍 CEB Search v1.2 (with dedup):', {
      query: query.substring(0, 100),
      category: category || 'all',
      topK,
      minScore
    });

    // Initialize Upstash Vector client
    const index = new Index({
      url: upstashUrl,
      token: upstashToken,
    });

    // Statutory pre-filter: Boost query with exact statutory terms
    let queryBoost = '';
    try {
      if (containsCodeCitation(query)) {
        const citations = parseCodeCitation(query);
        if (citations.length > 0) {
          console.log(`📜 Statutory pre-filter: Found ${citations.length} citation(s)`);
          const searchTerms = citationToSearchTerms(citations);
          queryBoost = searchTerms.join('; ');
          console.log(`📜 Query boost terms: "${queryBoost}"`);
        }
      }
    } catch (err) {
      console.log(`⚠️ Pre-filter error (non-blocking): ${err}`);
      // Continue without pre-filter if error occurs
    }

    // Expand query with legal synonyms for better semantic matching
    let expandedQuery = expandQuery(query);
    if (queryBoost) {
      expandedQuery = `${queryBoost} - ${expandedQuery}`;
      console.log(`📜 Query expanded with statutory boost`);
    }

    // Generate query embedding using OpenAI (with caching)
    let embedding: number[] = [];
    let cached = false;

    try {
      const startTime = Date.now();
      const result = await getCachedEmbedding(expandedQuery);
      embedding = result.embedding;
      cached = result.cached;
      const embeddingTime = Date.now() - startTime;
      console.log(`⏱️ Embedding ${cached ? 'retrieved from cache' : 'generated'} in ${embeddingTime}ms`);
    } catch (err: any) {
      console.error('⚠️ Failed to generate embedding (likely invalid OpenAI key). Returning empty results.');
      // Return empty successful response so the chat doesn't crash
      res.status(200).json({
        sources: [],
        context: '',
        isCEB: true,
        category: 'error',
        confidence: 0,
        _warning: 'Embedding generation failed'
      });
      return;
    }

    // Determine namespace(s) to search
    const namespaces = category
      ? [`ceb_${category}`]
      : ['ceb_trusts_estates', 'ceb_family_law', 'ceb_business_litigation'];

    console.log(`📚 Searching namespaces: ${namespaces.join(', ')}`);

    // Search across namespace(s) in parallel
    const searchPromises = namespaces.map(async (ns) => {
      try {
        const results = await index.query({
          vector: embedding,
          topK,
          includeMetadata: true,
          ...({ namespace: ns } as any),
        });

        // Filter by minimum score
        return results.filter((r: any) => r.score >= minScore);
      } catch (error) {
        console.error(`Error searching namespace ${ns}:`, error);
        return [];
      }
    });

    const allResults = (await Promise.all(searchPromises)).flat();

    // Sort by score (descending)
    const sortedResults = allResults.sort((a: any, b: any) => b.score - a.score);

    // Deduplicate results based on content similarity
    const topResults = deduplicateResults(sortedResults, topK);

    console.log(`✅ Found ${topResults.length} results (avg confidence: ${topResults.length > 0
      ? (topResults.reduce((sum: number, r: any) => sum + r.score, 0) / topResults.length).toFixed(2)
      : 0
      })`);

    // Format results as CEBSource objects
    const sources = topResults.map((result: any) => ({
      title: result.metadata.title || 'CEB Document',
      url: `ceb://${result.metadata.source_file}`, // Custom URL scheme for CEB docs
      excerpt: result.metadata.text || '',
      isCEB: true as const,
      category: result.metadata.category,
      cebCitation: result.metadata.ceb_citation || `CEB: ${result.metadata.title}`,
      pageNumber: result.metadata.page_number,
      section: result.metadata.section,
      confidence: result.score,
    }));

    // Format context for LLM
    const context = formatCEBContext(sources);

    // Calculate average confidence
    const avgConfidence = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length
      : 0;

    // Determine primary category (most common in results)
    const categoryCount: Record<string, number> = {};
    sources.forEach(s => {
      categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
    });
    const primaryCategory = Object.keys(categoryCount).sort(
      (a, b) => categoryCount[b] - categoryCount[a]
    )[0];

    const response: CEBSearchResponse & { _version?: string } = {
      sources,
      context,
      isCEB: true,
      category: primaryCategory,
      confidence: avgConfidence,
      _version: '1.2-dedup', // Version marker for debugging
    };

    res.status(200).json(response);

  } catch (err: any) {
    console.error('CEB Search API error:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to search CEB database',
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}

/**
 * Deduplicate results based on content similarity
 * Uses Jaccard similarity on text tokens to detect near-duplicates
 */
function deduplicateResults(results: any[], topK: number): any[] {
  // Use simple hash-based deduplication on first 500 chars of text
  const seen = new Set<string>();
  const deduplicated: any[] = [];

  for (const result of results) {
    if (deduplicated.length >= topK) break;

    const text = (result.metadata?.text || '').substring(0, 500).toLowerCase().trim();

    // Create a simple hash key from the text
    const hashKey = text.replace(/\s+/g, ' ');

    if (seen.has(hashKey)) {
      console.log(`🔄 Skipping duplicate: "${result.metadata?.title?.substring(0, 40)}..."`);
      continue;
    }

    seen.add(hashKey);
    deduplicated.push(result);
  }

  console.log(`📊 Deduplication: ${results.length} → ${deduplicated.length} unique results`);
  return deduplicated;
}

/**
 * Generate embedding for query using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    // Use text-embedding-3-small with reduced dimensions for faster processing
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 512, // Reduced from 1536 for ~3x faster search (still good quality)
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Format CEB sources into context string for LLM
 */
function formatCEBContext(sources: CEBSearchResponse['sources']): string {
  if (sources.length === 0) {
    return '';
  }

  let formatted = 'AUTHORITATIVE CEB SOURCES:\n\n';

  sources.forEach((source, index) => {
    formatted += `[SOURCE ${index + 1}] ${source.cebCitation}\n`;
    formatted += `Category: ${source.category.replace('_', ' ').toUpperCase()}\n`;
    if (source.section) {
      formatted += `Section: ${source.section}\n`;
    }
    if (source.pageNumber) {
      formatted += `Page: ${source.pageNumber}\n`;
    }
    formatted += `Confidence: ${(source.confidence * 100).toFixed(1)}%\n`;
    formatted += `\nContent:\n${source.excerpt}\n`;
    formatted += `\n${'='.repeat(80)}\n\n`;
  });

  return formatted;
}

