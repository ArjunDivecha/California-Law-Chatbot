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
import {
  EMPTY_ENTITIES,
  EMPTY_GAP_PLAN,
  extractEntities,
  extractEntitiesHeuristic,
  identifyGaps,
  mergeEntities,
  type ExtractedEntities,
  type GapPlan,
  type RetrievalSnapshot,
} from '../api/_shared/researchPlanner';

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

    // Phase 5 — Pass 1: planner
    // Heuristic extraction is deterministic and always runs. Claude
    // extraction augments it when Bedrock is reachable; fails open.
    const heuristic = extractEntitiesHeuristic(query);
    const llmEntities = await extractEntities(query);
    const entities = mergeEntities(heuristic, llmEntities);

    // Phase 5 — Initial retrieval (steered by extracted entities)
    await Promise.all([
      sources.includes('ceb') ? this.runCEBSearch(query, focusAreas, entities) : Promise.resolve(),
      sources.includes('courtlistener') ? this.runCaseLawSearch(query, entities) : Promise.resolve(),
      sources.includes('statutes') ? this.runStatuteSearch(query, entities) : Promise.resolve(),
      sources.includes('legislative') ? this.runLegislativeSearch(query, entities) : Promise.resolve(),
    ]);

    // Phase 5 — Pass 2: single refinement round based on gap analysis
    await this.runRefinementRound(query, entities, sources);

    await this.generateResearchSummary(query, sources, focusAreas, entities);
    return this.buildResearchPackage(query);
  }

  private async runCEBSearch(
    query: string,
    focusAreas?: string[],
    entities: ExtractedEntities = EMPTY_ENTITIES
  ): Promise<void> {
    // Prefer Claude-extracted practice areas; fall back to heuristic mapper.
    const categories =
      entities.practice_areas.length > 0
        ? Array.from(new Set(entities.practice_areas))
        : this.inferCEBCategories(query, focusAreas);

    const result = await cebSearchTool({
      query,
      categories,
      topK: 5,
    });

    this.cebSources.push(...result.sources);
    if (result.modelLanguage) {
      this.modelLanguage.push(...result.modelLanguage);
    }
  }

  private async runCaseLawSearch(
    query: string,
    entities: ExtractedEntities = EMPTY_ENTITIES
  ): Promise<void> {
    // Augment the query with legal concepts when available so CourtListener
    // sees the canonical term rather than whatever client-shaped phrasing
    // survived sanitization. Falls back to the raw query if empty.
    const augmented =
      entities.legal_concepts.length > 0
        ? `${query} ${entities.legal_concepts.slice(0, 3).join(' ')}`
        : query;

    const result = await courtListenerSearchTool({
      query: augmented,
      courtFilter: 'california_all',
      maxResults: 5,
    });

    this.caseLaw.push(...result);
  }

  private async runStatuteSearch(
    query: string,
    entities: ExtractedEntities = EMPTY_ENTITIES
  ): Promise<void> {
    const heuristicLookups = this.extractStatuteLookups(query);
    const entityLookups = entities.statutes.map((s) => ({ code: s.code, section: s.section }));

    const lookups = this.dedupeStatuteLookups([...heuristicLookups, ...entityLookups]);
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

  private async runLegislativeSearch(
    query: string,
    entities: ExtractedEntities = EMPTY_ENTITIES
  ): Promise<void> {
    // Build a better upstream query: prefer explicit legislative terms when
    // the planner identified any, otherwise fall back to the raw question.
    const upstreamQuery =
      entities.legislative_terms.length > 0
        ? `California ${entities.legislative_terms.slice(0, 3).join(' ')} ${entities.legislative_session_year || ''}`.trim()
        : query;

    const result = await legislativeSearchTool({ query: upstreamQuery });
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

  private dedupeStatuteLookups(
    lookups: Array<{ code: string; section: string }>
  ): Array<{ code: string; section: string }> {
    const seen = new Set<string>();
    const out: Array<{ code: string; section: string }> = [];
    for (const l of lookups) {
      const key = `${l.code.toLowerCase()}:${l.section}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
    return out;
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

  private async runRefinementRound(
    query: string,
    entities: ExtractedEntities,
    sources: ResearchSourceName[]
  ): Promise<void> {
    // Snapshot current state for the gap-analysis prompt. Kept short so the
    // second Claude call stays cheap.
    const snapshot: RetrievalSnapshot = {
      cebCount: this.cebSources.length,
      caseCount: this.caseLaw.length,
      statuteCount: this.statutes.length,
      legislativeCount: this.legislativeSources.length,
      cebExcerpts: this.cebSources.slice(0, 3).map((s) => `${s.cebCitation}: ${s.excerpt || ''}`),
      caseHeadings: this.caseLaw.slice(0, 3).map((c) => `${c.caseName} ${c.citation}`),
      statuteHeadings: this.statutes.slice(0, 3).map((s) => `${s.code} § ${s.section}`),
      legislativeHeadings: this.legislativeSources.slice(0, 3).map((b) => `${b.billNumber}: ${b.title}`),
    };

    const plan = await identifyGaps(query, entities, snapshot);

    // Fail-open: nothing to do if the planner returned the empty plan.
    if (
      plan.statute_followups.length === 0 &&
      plan.case_followup_queries.length === 0 &&
      plan.legislative_followup_queries.length === 0 &&
      plan.ceb_followup_queries.length === 0
    ) {
      return;
    }

    const followupTasks: Array<Promise<unknown>> = [];

    if (sources.includes('statutes') && plan.statute_followups.length > 0) {
      const existing = new Set(
        this.statutes.map((s) => `${s.code.toLowerCase()}:${s.section}`)
      );
      const fresh = plan.statute_followups.filter(
        (s) => !existing.has(`${s.code.toLowerCase()}:${s.section}`)
      );
      for (const lookup of fresh.slice(0, 5)) {
        followupTasks.push(
          statuteLookupTool(lookup)
            .then((r) => { if (r) this.statutes.push(r); })
            .catch(() => null)
        );
      }
    }

    if (sources.includes('courtlistener') && plan.case_followup_queries.length > 0) {
      const existing = new Set(this.caseLaw.map((c) => c.citation));
      for (const followup of plan.case_followup_queries.slice(0, 3)) {
        followupTasks.push(
          courtListenerSearchTool({
            query: followup,
            courtFilter: 'california_all',
            maxResults: 3,
          })
            .then((results) => {
              for (const c of results) {
                if (c.citation && !existing.has(c.citation)) {
                  existing.add(c.citation);
                  this.caseLaw.push(c);
                }
              }
            })
            .catch(() => null)
        );
      }
    }

    if (sources.includes('legislative') && plan.legislative_followup_queries.length > 0) {
      const existing = new Set(this.legislativeSources.map((b) => b.billNumber));
      for (const followup of plan.legislative_followup_queries.slice(0, 3)) {
        followupTasks.push(
          legislativeSearchTool({ query: followup })
            .then((r) => {
              for (const bill of r?.bills || []) {
                const billNumber = (bill.billNumber || '').trim();
                if (!billNumber || existing.has(billNumber)) continue;
                existing.add(billNumber);
                this.legislativeSources.push({
                  billNumber,
                  title: bill.title || billNumber,
                  status: bill.status || 'Unknown',
                  lastAction: bill.lastAction || undefined,
                  url: bill.url || '',
                  provider: 'openstates',
                });
              }
            })
            .catch(() => null)
        );
      }
    }

    if (sources.includes('ceb') && plan.ceb_followup_queries.length > 0) {
      const existing = new Set(this.cebSources.map((s) => s.cebCitation));
      for (const followup of plan.ceb_followup_queries.slice(0, 2)) {
        followupTasks.push(
          cebSearchTool({
            query: followup,
            categories:
              entities.practice_areas.length > 0 ? Array.from(new Set(entities.practice_areas)) : undefined,
            topK: 3,
          })
            .then((r) => {
              for (const src of r.sources) {
                if (!existing.has(src.cebCitation)) {
                  existing.add(src.cebCitation);
                  this.cebSources.push(src);
                }
              }
              if (r.modelLanguage) this.modelLanguage.push(...r.modelLanguage);
            })
            .catch(() => null)
        );
      }
    }

    await Promise.all(followupTasks);
    if (plan.rationale) {
      console.log(`🔁 Research Agent: refinement rationale — ${plan.rationale}`);
    }
  }

  private async generateResearchSummary(
    query: string,
    sources: ResearchSourceName[],
    focusAreas?: string[],
    entities: ExtractedEntities = EMPTY_ENTITIES
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

    const plannerSummary =
      entities.statutes.length ||
      entities.cases.length ||
      entities.legal_concepts.length ||
      entities.practice_areas.length ||
      entities.legislative_terms.length
        ? `Planner-extracted entities:
- Statutes: ${entities.statutes.map((s) => `${s.code} §${s.section}`).join(', ') || 'none'}
- Cases: ${entities.cases.join(', ') || 'none'}
- Legal concepts: ${entities.legal_concepts.join(', ') || 'none'}
- Practice areas: ${entities.practice_areas.join(', ') || 'none'}
- Legislative terms: ${entities.legislative_terms.join(', ') || 'none'}${entities.legislative_session_year ? ` (session ${entities.legislative_session_year})` : ''}
- Current-law query: ${entities.is_current_law_query ? 'yes' : 'no'}\n\n`
        : '';

    const prompt = `Research query: ${query}

Requested source types: ${sources.join(', ')}
${focusAreas?.length ? `Focus areas: ${focusAreas.join(', ')}` : ''}

${plannerSummary}Collected CEB sources:
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
