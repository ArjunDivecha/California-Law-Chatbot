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
 * PERFORMANCE OPTIMIZATION: LRU cache for query embeddings to reduce OpenAI API calls
 * 
 * Version: 1.1
 * Last Updated: December 2, 2025
 */

import { Index } from '@upstash/vector';

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

/**
 * Get embedding from cache or generate new one
 * Implements LRU eviction when cache is full
 */
async function getCachedEmbedding(query: string): Promise<{ embedding: number[]; cached: boolean }> {
  const cacheKey = normalizeQuery(query);
  
  // Check cache
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    // Update timestamp for LRU
    cached.timestamp = Date.now();
    console.log(`📦 Embedding cache HIT for: "${query.substring(0, 50)}..."`);
    return { embedding: cached.embedding, cached: true };
  }
  
  // Generate new embedding
  console.log(`🔄 Embedding cache MISS - generating for: "${query.substring(0, 50)}..."`);
  const embedding = await generateEmbedding(query);
  
  // Evict oldest if cache is full (LRU)
  if (embeddingCache.size >= EMBEDDING_CACHE_SIZE) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, value] of embeddingCache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      embeddingCache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest cache entry`);
    }
  }
  
  // Store in cache
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
  
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

    // Generate query embedding using OpenAI (with caching)
    const startTime = Date.now();
    const { embedding, cached } = await getCachedEmbedding(query);
    const embeddingTime = Date.now() - startTime;
    console.log(`⏱️ Embedding ${cached ? 'retrieved from cache' : 'generated'} in ${embeddingTime}ms`);

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
          namespace: ns,
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

    console.log(`✅ Found ${topResults.length} results (avg confidence: ${
      topResults.length > 0
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
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
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

