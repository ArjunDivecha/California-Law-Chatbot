/**
 * Research Agent
 * 
 * Gathers relevant legal authorities from CEB, CourtListener, and statutory sources.
 * Uses Claude Haiku for fast, cost-effective research operations.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ResearchPackage, CEBSource, CaseLawSource, StatuteSource } from '../types';
import {
  cebSearchTool,
  courtListenerSearchTool,
  statuteLookupTool,
  legislativeSearchTool,
  type CEBSearchResult,
} from './tools';

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESEARCH_SYSTEM_PROMPT = `You are a legal research specialist for California law. Your job is to gather comprehensive, relevant legal authorities for document drafting.

SOURCES AVAILABLE (use the provided tools):
- ceb_search: Search CEB Practice Guides for authoritative California legal practice guidance and model language
- courtlistener_search: Search CourtListener for California and federal case law
- statute_lookup: Look up specific California statutory sections
- legislative_search: Search for California legislation and bills

RESEARCH METHODOLOGY:
1. Identify the core legal issues in the query
2. Search CEB first for practice guide coverage and model language
3. Find controlling California cases (prioritize Supreme Court > Court of Appeal)
4. Locate applicable statutes with exact section numbers
5. Check for recent legislative changes if the topic involves recent law

OUTPUT FORMAT:
After gathering sources, provide a structured summary with:
- Key authorities ranked by relevance
- CEB sections with relevant excerpts
- Case holdings summarized
- Applicable statutory text
- Any model language found

Be thorough but focused. Quality over quantity. Prioritize California-specific authorities.`;

// =============================================================================
// TOOL DEFINITIONS FOR CLAUDE
// =============================================================================

const researchTools: Anthropic.Tool[] = [
  {
    name: 'ceb_search',
    description: 'Search CEB practice guides for relevant content. Use for authoritative California legal guidance and model language.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query for CEB content',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'CEB categories to search: trusts_estates, family_law, business_litigation, business_entities, business_transactions',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (default 5, max 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'courtlistener_search',
    description: 'Search CourtListener for California case law',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Case law search query',
        },
        court_filter: {
          type: 'string',
          description: 'Court filter: california_all, california_supreme, california_appeals, federal_ninth, all',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of cases to return (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'statute_lookup',
    description: 'Look up a specific California statute section',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string',
          description: 'California code name (e.g., "Code of Civil Procedure", "Family Code", "Probate Code")',
        },
        section: {
          type: 'string',
          description: 'Section number (e.g., "2030.300", "1615")',
        },
      },
      required: ['code', 'section'],
    },
  },
  {
    name: 'legislative_search',
    description: 'Search for California legislation and bills',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Legislative search query',
        },
        bill_number: {
          type: 'string',
          description: 'Specific bill number (e.g., "AB 123", "SB 456")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'complete_research',
    description: 'Signal that research is complete and provide final summary',
    input_schema: {
      type: 'object' as const,
      properties: {
        research_notes: {
          type: 'string',
          description: 'Summary of research findings, key issues identified, and any caveats',
        },
        key_authorities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'number' },
              type: { type: 'string' },
              citation: { type: 'string' },
              summary: { type: 'string' },
            },
          },
          description: 'Ranked list of key authorities',
        },
      },
      required: ['research_notes'],
    },
  },
];

// =============================================================================
// RESEARCH AGENT CLASS
// =============================================================================

export class ResearchAgent {
  private client: Anthropic;
  private cebSources: CEBSource[] = [];
  private caseLaw: CaseLawSource[] = [];
  private statutes: StatuteSource[] = [];
  private modelLanguage: CEBSearchResult['modelLanguage'] = [];
  private researchNotes: string = '';
  private keyAuthorities: ResearchPackage['keyAuthorities'] = [];

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Execute research based on the given query and sources
   */
  async research(
    query: string,
    sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'legislative'>,
    focusAreas?: string[]
  ): Promise<ResearchPackage> {
    console.log('🔍 Research Agent: Starting research for:', query);
    
    // Reset state
    this.cebSources = [];
    this.caseLaw = [];
    this.statutes = [];
    this.modelLanguage = [];
    this.researchNotes = '';
    this.keyAuthorities = [];

    // Build the user message
    const userMessage = this.buildUserMessage(query, sources, focusAreas);

    // Run the agent loop
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;
      console.log(`🔄 Research Agent: Iteration ${iterations}`);

      try {
        const response = await this.client.messages.create({
          model: 'claude-haiku-4-5-20250514',
          max_tokens: 2048,
          system: RESEARCH_SYSTEM_PROMPT,
          tools: researchTools,
          messages,
        });

        // Check if we're done
        if (response.stop_reason === 'end_turn') {
          console.log('✅ Research Agent: Completed (end_turn)');
          break;
        }

        // Process tool calls
        if (response.stop_reason === 'tool_use') {
          const toolResults = await this.processToolCalls(response.content);
          
          // Check if research is complete
          const completeCall = response.content.find(
            (block) => block.type === 'tool_use' && block.name === 'complete_research'
          );
          
          if (completeCall) {
            console.log('✅ Research Agent: Completed (complete_research called)');
            break;
          }

          // Add assistant response and tool results to messages
          messages.push({ role: 'assistant', content: response.content });
          messages.push({ role: 'user', content: toolResults });
        }
      } catch (error) {
        console.error('❌ Research Agent error:', error);
        break;
      }
    }

    // Build and return the research package
    return this.buildResearchPackage(query);
  }

  /**
   * Build the user message for the research query
   */
  private buildUserMessage(
    query: string,
    sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'legislative'>,
    focusAreas?: string[]
  ): string {
    let message = `Research the following legal topic for a California legal document:\n\n"${query}"\n\n`;
    
    message += `Available sources to search: ${sources.join(', ')}\n`;
    
    if (focusAreas && focusAreas.length > 0) {
      message += `Focus areas: ${focusAreas.join(', ')}\n`;
    }
    
    message += `\nPlease:\n`;
    message += `1. Search relevant sources for authorities on this topic\n`;
    message += `2. Identify key cases, statutes, and practice guidance\n`;
    message += `3. Find any model language or sample clauses if available\n`;
    message += `4. When done, call complete_research with your findings summary\n`;
    
    return message;
  }

  /**
   * Process tool calls from Claude's response
   */
  private async processToolCalls(
    content: Anthropic.ContentBlock[]
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of content) {
      if (block.type !== 'tool_use') continue;

      console.log(`  🔧 Tool call: ${block.name}`);
      
      try {
        const result = await this.executeTool(block.name, block.input as Record<string, any>);
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        console.error(`  ❌ Tool error (${block.name}):`, error);
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
          is_error: true,
        });
      }
    }

    return results;
  }

  /**
   * Execute a specific tool
   */
  private async executeTool(
    toolName: string,
    input: Record<string, any>
  ): Promise<unknown> {
    switch (toolName) {
      case 'ceb_search': {
        const result = await cebSearchTool({
          query: input.query,
          categories: input.categories,
          topK: input.top_k || 5,
        });
        
        // Accumulate results
        this.cebSources.push(...result.sources);
        if (result.modelLanguage) {
          this.modelLanguage?.push(...result.modelLanguage);
        }
        
        return {
          found: result.sources.length,
          sources: result.sources.map(s => ({
            title: s.title,
            citation: s.cebCitation,
            excerpt: s.excerpt?.substring(0, 300) + '...',
            confidence: s.confidence,
          })),
          hasModelLanguage: !!result.modelLanguage?.length,
        };
      }

      case 'courtlistener_search': {
        const result = await courtListenerSearchTool({
          query: input.query,
          courtFilter: input.court_filter,
          maxResults: input.max_results || 5,
        });
        
        // Accumulate results
        this.caseLaw.push(...result);
        
        return {
          found: result.length,
          cases: result.map(c => ({
            caseName: c.caseName,
            citation: c.citation,
            court: c.court,
            year: c.year,
            holding: c.holding?.substring(0, 200) + '...',
          })),
        };
      }

      case 'statute_lookup': {
        const result = await statuteLookupTool({
          code: input.code,
          section: input.section,
        });
        
        if (result) {
          this.statutes.push(result);
        }
        
        return result || { error: 'Statute not found' };
      }

      case 'legislative_search': {
        const result = await legislativeSearchTool({
          query: input.query,
          billNumber: input.bill_number,
        });
        
        return {
          found: result.bills.length,
          bills: result.bills,
        };
      }

      case 'complete_research': {
        this.researchNotes = input.research_notes || '';
        this.keyAuthorities = (input.key_authorities || []).map((a: any, i: number) => ({
          rank: a.rank || i + 1,
          type: a.type || 'unknown',
          citation: a.citation || '',
          relevanceScore: 1 - (i * 0.1), // Decreasing relevance
          summary: a.summary || '',
        }));
        
        return { status: 'research_complete' };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Build the final research package
   */
  private buildResearchPackage(query: string): ResearchPackage {
    // Deduplicate sources
    const uniqueCEB = this.deduplicateByField(this.cebSources, 'cebCitation');
    const uniqueCases = this.deduplicateByField(this.caseLaw, 'citation');
    const uniqueStatutes = this.deduplicateByField(this.statutes, 'section');

    return {
      query,
      completedAt: new Date().toISOString(),
      cebSources: uniqueCEB,
      caseLaw: uniqueCases,
      statutes: uniqueStatutes,
      keyAuthorities: this.keyAuthorities,
      modelLanguage: this.modelLanguage,
      researchNotes: this.researchNotes || 'Research completed. Review sources for relevant authorities.',
    };
  }

  /**
   * Deduplicate array by a specific field
   */
  private deduplicateByField<T>(array: T[], field: keyof T): T[] {
    const seen = new Set<unknown>();
    return array.filter(item => {
      const value = item[field];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
}

/**
 * Run research and return the package
 */
export async function runResearchAgent(
  query: string,
  sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'legislative'> = ['ceb', 'courtlistener', 'statutes'],
  focusAreas?: string[]
): Promise<ResearchPackage> {
  const agent = new ResearchAgent();
  return agent.research(query, sources, focusAreas);
}
