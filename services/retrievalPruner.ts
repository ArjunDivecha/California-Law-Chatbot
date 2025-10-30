/**
 * Retrieval Pruner - Light retrieval pruning for cost and quality
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility service)
 * 
 * Implements top-k selection, deduplication, and lexical reranking
 * to reduce tokens sent to LLM while maintaining answer quality.
 * 
 * Version: 1.0
 * Last Updated: 2024
 */

import type { Source } from '../types';

export interface PrunedSource extends Source {
  score?: number; // Relevance score for reranking
}

export class RetrievalPruner {
  private static readonly MAX_SOURCES = 3; // Top-k limit
  private static readonly DEDUPE_THRESHOLD = 0.8; // Jaccard similarity threshold for deduplication
  
  /**
   * Calculate Jaccard similarity between two texts
   */
  private static jaccardSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Calculate simple token overlap score (TF-based)
   */
  private static tokenOverlapScore(query: string, sourceText: string): number {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const sourceTokens = sourceText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    let matches = 0;
    for (const token of sourceTokens) {
      if (queryTokens.has(token)) {
        matches++;
      }
    }
    
    // Normalize by query length
    return queryTokens.size > 0 ? matches / queryTokens.size : 0;
  }
  
  /**
   * Deduplicate near-identical sources using Jaccard similarity
   */
  private static deduplicateSources(sources: PrunedSource[]): PrunedSource[] {
    const deduplicated: PrunedSource[] = [];
    const seen = new Set<number>();
    
    for (let i = 0; i < sources.length; i++) {
      if (seen.has(i)) continue;
      
      const current = sources[i];
      const currentText = `${current.title} ${current.excerpt || ''}`.trim();
      
      deduplicated.push(current);
      seen.add(i);
      
      // Find and mark duplicates
      for (let j = i + 1; j < sources.length; j++) {
        if (seen.has(j)) continue;
        
        const other = sources[j];
        const otherText = `${other.title} ${other.excerpt || ''}`.trim();
        
        const similarity = this.jaccardSimilarity(currentText, otherText);
        
        if (similarity > this.DEDUPE_THRESHOLD) {
          // Keep the one with higher score, or the first if scores are equal
          if ((other.score || 0) > (current.score || 0)) {
            deduplicated[deduplicated.length - 1] = other;
          }
          seen.add(j);
        }
      }
    }
    
    return deduplicated;
  }
  
  /**
   * Rerank sources by lexical overlap with query
   */
  private static rerankSources(sources: PrunedSource[], query: string): PrunedSource[] {
    return sources.map(source => {
      const sourceText = `${source.title} ${source.excerpt || ''}`.trim();
      const score = this.tokenOverlapScore(query, sourceText);
      
      return {
        ...source,
        score
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  
  /**
   * Prune sources: dedupe, rerank, top-k
   */
  static pruneSources(
    sources: Source[],
    query: string,
    maxSources: number = this.MAX_SOURCES
  ): PrunedSource[] {
    if (sources.length === 0) return [];
    
    // Step 1: Convert to PrunedSource format
    let prunedSources: PrunedSource[] = sources.map(s => ({
      ...s,
      score: 0
    }));
    
    // Step 2: Rerank by lexical overlap
    prunedSources = this.rerankSources(prunedSources, query);
    
    // Step 3: Deduplicate
    prunedSources = this.deduplicateSources(prunedSources);
    
    // Step 4: Apply top-k limit
    prunedSources = prunedSources.slice(0, maxSources);
    
    return prunedSources;
  }
  
  /**
   * Estimate token count for sources (approximate)
   */
  static estimateTokens(sources: PrunedSource[]): number {
    const totalText = sources
      .map(s => `${s.title} ${s.excerpt || ''}`)
      .join(' ');
    
    // Rough estimate: ~4 chars per token
    return Math.ceil(totalText.length / 4);
  }
  
  /**
   * Check if pruning reduced token count significantly
   */
  static getReductionStats(originalSources: Source[], prunedSources: PrunedSource[]): {
    originalCount: number;
    prunedCount: number;
    reductionPercent: number;
    estimatedTokensOriginal: number;
    estimatedTokensPruned: number;
  } {
    const originalTokens = this.estimateTokens(originalSources.map(s => ({ ...s, score: 0 })));
    const prunedTokens = this.estimateTokens(prunedSources);
    
    return {
      originalCount: originalSources.length,
      prunedCount: prunedSources.length,
      reductionPercent: originalSources.length > 0 
        ? ((originalSources.length - prunedSources.length) / originalSources.length) * 100 
        : 0,
      estimatedTokensOriginal: originalTokens,
      estimatedTokensPruned: prunedTokens
    };
  }
}
