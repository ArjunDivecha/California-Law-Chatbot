/**
 * Research Agent
 *
 * Gathers relevant legal authorities from CEB, CourtListener, and statutory sources.
 * Uses Anthropic on AWS Bedrock to synthesize the collected research.
 */

import type {
  ResearchPackage,
  CEBSource,
  CaseLawSource,
  StatuteSource,
  LegislativeSource,
} from '../types';
import {
  cebSearchTool,
  courtListenerSearchTool,
  statuteLookupTool,
  legislativeSearchTool,
  type CEBSearchResult,
} from './tools';
import { generateText, hasBedrockProviderCredentials } from '../api/_shared/anthropicBedrock';
import {
  BedrockConfigError,
  resolveBedrockModel,
} from '../api/_shared/bedrockModels';

const RESEARCH_SYSTEM_PROMPT = `You are a California legal research specialist. Your job is to organize collected source material into a concise, practical research package for legal drafting.

OUTPUT REQUIREMENTS:
- Prioritize California-specific authorities.
- Rank the most important authorities first.
- Keep summaries factual and source-bound.
- Do not invent citations or holdings that are not present in the supplied material.

Return JSON only:
{
  "research_notes": "2-4 paragraph summary of the research findings and any gaps",
  "key_authorities": [
    {
      "rank": 1,
      "type": "ceb|case|statute|legislation",
      "citation": "citation text",
      "summary": "why this authority matters"
    }
  ]
}`;

type ResearchSourceName = 'ceb' | 'courtlistener' | 'statutes' | 'legislative';

export class ResearchAgent {
  private cebSources: CEBSource[] = [];
  private caseLaw: CaseLawSource[] = [];
  private statutes: StatuteSource[] = [];
  private legislativeSources: LegislativeSource[] = [];
  private modelLanguage: CEBSearchResult['modelLanguage'] = [];
  private researchNotes = '';
  private keyAuthorities: ResearchPackage['keyAuthorities'] = [];

  async research(
    query: string,
    sources: ResearchSourceName[],
    focusAreas?: string[]
  ): Promise<ResearchPackage> {
    console.log(`🔍 Research Agent: Starting research via Anthropic Bedrock (${query.length} query chars)`);

    this.cebSources = [];
    this.caseLaw = [];
    this.statutes = [];
    this.legislativeSources = [];
    this.modelLanguage = [];
    this.researchNotes = '';
    this.keyAuthorities = [];

    await Promise.all([
      sources.includes('ceb') ? this.runCEBSearch(query, focusAreas) : Promise.resolve(),
      sources.includes('courtlistener') ? this.runCaseLawSearch(query) : Promise.resolve(),
      sources.includes('statutes') ? this.runStatuteSearch(query) : Promise.resolve(),
      sources.includes('legislative') ? this.runLegislativeSearch(query) : Promise.resolve(),
    ]);

    await this.generateResearchSummary(query, sources, focusAreas);
    return this.buildResearchPackage(query);
  }

  private async runCEBSearch(query: string, focusAreas?: string[]): Promise<void> {
    const result = await cebSearchTool({
      query,
      categories: this.inferCEBCategories(query, focusAreas),
      topK: 5,
    });

    this.cebSources.push(...result.sources);
    if (result.modelLanguage) {
      this.modelLanguage.push(...result.modelLanguage);
    }
  }

  private async runCaseLawSearch(query: string): Promise<void> {
    const result = await courtListenerSearchTool({
      query,
      courtFilter: 'california_all',
      maxResults: 5,
    });

    this.caseLaw.push(...result);
  }

  private async runStatuteSearch(query: string): Promise<void> {
    const lookups = this.extractStatuteLookups(query);
    if (lookups.length === 0) {
      return;
    }

    const results = await Promise.all(
      lookups.map((lookup) => statuteLookupTool(lookup).catch(() => null))
    );

    for (const result of results) {
      if (result) {
        this.statutes.push(result);
      }
    }
  }

  private async runLegislativeSearch(query: string): Promise<void> {
    const result = await legislativeSearchTool({ query });
    if (!result?.bills?.length) return;

    for (const bill of result.bills) {
      const billNumber = (bill.billNumber || '').trim();
      if (!billNumber) continue;
      this.legislativeSources.push({
        billNumber,
        title: bill.title || billNumber,
        status: bill.status || 'Unknown',
        lastAction: bill.lastAction || undefined,
        url: bill.url || '',
        // Tool currently routes through OpenStates by default; provider label
        // will become more accurate when LegiScan is wired in alongside it.
        provider: 'openstates',
      });
    }
  }

  private inferCEBCategories(query: string, focusAreas?: string[]): string[] | undefined {
    const searchText = `${query} ${focusAreas?.join(' ') || ''}`.toLowerCase();
    const categories: string[] = [];

    if (/(trust|estate|probate|will|conservatorship)/.test(searchText)) {
      categories.push('trusts_estates');
    }
    if (/(family|divorce|custody|support|domestic partner|parentage)/.test(searchText)) {
      categories.push('family_law');
    }
    if (/(litigation|discovery|motion|deposition|complaint)/.test(searchText)) {
      categories.push('business_litigation');
    }
    if (/(corporation|llc|partnership|shareholder|entity)/.test(searchText)) {
      categories.push('business_entities');
    }
    if (/(transaction|merger|acquisition|agreement|contract)/.test(searchText)) {
      categories.push('business_transactions');
    }

    return categories.length > 0 ? categories : undefined;
  }

  private extractStatuteLookups(query: string): Array<{ code: string; section: string }> {
    const lookups: Array<{ code: string; section: string }> = [];
    const seen = new Set<string>();
    const pattern =
      /\b(Family|Probate|Civil|Penal|Government|Corporations|Evidence|Labor|Code of Civil Procedure)\s+Code\s*(?:§|section)?\s*(\d+(?:\.\d+)?)/gi;

    let match;
    while ((match = pattern.exec(query)) !== null) {
      const code = match[1];
      const section = match[2];
      const key = `${code}:${section}`;
      if (!seen.has(key)) {
        seen.add(key);
        lookups.push({ code: `${code} Code`, section });
      }
    }

    return lookups;
  }

  private async generateResearchSummary(
    query: string,
    sources: ResearchSourceName[],
    focusAreas?: string[]
  ): Promise<void> {
    const fallbackNotes = this.buildFallbackResearchNotes(query, sources, focusAreas);

    if (!hasBedrockProviderCredentials()) {
      this.researchNotes = fallbackNotes;
      this.keyAuthorities = this.buildFallbackAuthorities();
      return;
    }

    let researchModelId: string;
    try {
      researchModelId = resolveBedrockModel('research').id;
    } catch (err) {
      if (err instanceof BedrockConfigError) {
        console.error('Research Agent Bedrock config error:', err.message);
      } else {
        console.error('Research Agent Bedrock config error:', err);
      }
      this.researchNotes = fallbackNotes;
      this.keyAuthorities = this.buildFallbackAuthorities();
      return;
    }

    const prompt = `Research query: ${query}

Requested source types: ${sources.join(', ')}
${focusAreas?.length ? `Focus areas: ${focusAreas.join(', ')}` : ''}

Collected CEB sources:
${this.cebSources.slice(0, 5).map((source) => `- ${source.cebCitation}: ${(source.excerpt || '').substring(0, 220)}`).join('\n') || '- None'}

Collected case law:
${this.caseLaw.slice(0, 5).map((source) => `- ${source.caseName} ${source.citation}: ${(source.holding || '').substring(0, 220)}`).join('\n') || '- None'}

Collected statutes:
${this.statutes.slice(0, 5).map((source) => `- ${source.code} § ${source.section}: ${(source.text || '').substring(0, 160)}`).join('\n') || '- None'}

Collected legislation:
${this.legislativeSources.slice(0, 5).map((source) => `- ${source.billNumber}: ${(source.title || '').substring(0, 160)} [${source.status}]`).join('\n') || '- None'}

Model language:
${this.modelLanguage?.slice(0, 3).map((item) => `- ${item.citation}: ${item.text.substring(0, 160)}`).join('\n') || '- None'}

Return JSON only.`;

    try {
      const response = await generateText({
        model: researchModelId,
        messages: [{ role: 'user', content: prompt }],
        systemInstruction: RESEARCH_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      });

      const parsed = JSON.parse(response.text);
      this.researchNotes =
        typeof parsed?.research_notes === 'string' && parsed.research_notes.trim()
          ? parsed.research_notes.trim()
          : fallbackNotes;

      const authorities = Array.isArray(parsed?.key_authorities) ? parsed.key_authorities : [];
      this.keyAuthorities = authorities
        .filter((authority) => authority && authority.citation)
        .slice(0, 8)
        .map((authority, index) => ({
          rank: typeof authority.rank === 'number' ? authority.rank : index + 1,
          type: typeof authority.type === 'string' ? authority.type : 'unknown',
          citation: String(authority.citation),
          relevanceScore: Math.max(0.1, 1 - index * 0.1),
          summary: typeof authority.summary === 'string' ? authority.summary : '',
        }));

      if (this.keyAuthorities.length === 0) {
        this.keyAuthorities = this.buildFallbackAuthorities();
      }
    } catch (error) {
      console.error('Research Agent Bedrock summary generation error:', error);
      this.researchNotes = fallbackNotes;
      this.keyAuthorities = this.buildFallbackAuthorities();
    }
  }

  private buildFallbackResearchNotes(
    query: string,
    sources: ResearchSourceName[],
    focusAreas?: string[]
  ): string {
    const parts = [
      `Research completed for "${query}".`,
      `Sources searched: ${sources.join(', ')}.`,
    ];

    if (focusAreas?.length) {
      parts.push(`Focus areas: ${focusAreas.join(', ')}.`);
    }
    if (this.cebSources.length) {
      parts.push(`Found ${this.cebSources.length} CEB source(s).`);
    }
    if (this.caseLaw.length) {
      parts.push(`Found ${this.caseLaw.length} case law source(s).`);
    }
    if (this.statutes.length) {
      parts.push(`Found ${this.statutes.length} statute reference(s).`);
    }
    if (this.legislativeSources.length) {
      parts.push(`Found ${this.legislativeSources.length} legislative source(s).`);
    }

    return parts.join(' ');
  }

  private buildFallbackAuthorities(): ResearchPackage['keyAuthorities'] {
    const authorities: ResearchPackage['keyAuthorities'] = [];

    this.cebSources.slice(0, 3).forEach((source) => {
      authorities.push({
        rank: authorities.length + 1,
        type: 'ceb',
        citation: source.cebCitation,
        relevanceScore: Math.max(0.1, 1 - authorities.length * 0.1),
        summary: (source.excerpt || '').substring(0, 180),
      });
    });

    this.caseLaw.slice(0, 3).forEach((source) => {
      authorities.push({
        rank: authorities.length + 1,
        type: 'case',
        citation: `${source.caseName} ${source.citation}`.trim(),
        relevanceScore: Math.max(0.1, 1 - authorities.length * 0.1),
        summary: (source.holding || '').substring(0, 180),
      });
    });

    this.statutes.slice(0, 2).forEach((source) => {
      authorities.push({
        rank: authorities.length + 1,
        type: 'statute',
        citation: `${source.code} § ${source.section}`,
        relevanceScore: Math.max(0.1, 1 - authorities.length * 0.1),
        summary: source.title || '',
      });
    });

    this.legislativeSources.slice(0, 3).forEach((source) => {
      authorities.push({
        rank: authorities.length + 1,
        type: 'legislation',
        citation: source.billNumber,
        relevanceScore: Math.max(0.1, 1 - authorities.length * 0.1),
        summary: `${source.title} — ${source.status}`.trim(),
      });
    });

    return authorities;
  }

  private buildResearchPackage(query: string): ResearchPackage {
    const uniqueCEB = this.deduplicateByField(this.cebSources, 'cebCitation');
    const uniqueCases = this.deduplicateByField(this.caseLaw, 'citation');
    const uniqueStatutes = this.deduplicateByField(this.statutes, 'section');
    const uniqueLegislation = this.deduplicateByField(this.legislativeSources, 'billNumber');

    return {
      query,
      completedAt: new Date().toISOString(),
      cebSources: uniqueCEB,
      caseLaw: uniqueCases,
      statutes: uniqueStatutes,
      legislativeSources: uniqueLegislation,
      keyAuthorities: this.keyAuthorities,
      modelLanguage: this.modelLanguage,
      researchNotes: this.researchNotes || 'Research completed. Review sources for relevant authorities.',
    };
  }

  private deduplicateByField<T>(array: T[], field: keyof T): T[] {
    const seen = new Set<unknown>();
    return array.filter((item) => {
      const value = item[field];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
}

export async function runResearchAgent(
  query: string,
  sources: ResearchSourceName[] = ['ceb', 'courtlistener', 'statutes'],
  focusAreas?: string[]
): Promise<ResearchPackage> {
  const agent = new ResearchAgent();
  return agent.research(query, sources, focusAreas);
}
