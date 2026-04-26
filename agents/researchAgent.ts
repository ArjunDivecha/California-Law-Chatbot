/**
 * Research Agent
 * 
 * Gathers relevant legal authorities from CEB, CourtListener, and statutory sources.
 * Uses Claude Haiku 4.5 via OpenRouter for fast, cost-effective research operations.
 */

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
// TOOL DEFINITIONS FOR OPENROUTER (OpenAI format)
// =============================================================================

const researchTools = [
  {
    type: 'function',
    function: {
      name: 'ceb_search',
      description: 'Search CEB practice guides for relevant content. Use for authoritative California legal guidance and model language.',
      parameters: {
        type: 'object',
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
  },
  {
    type: 'function',
    function: {
      name: 'courtlistener_search',
      description: 'Search CourtListener for California case law',
      parameters: {
        type: 'object',
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
  },
  {
    type: 'function',
    function: {
      name: 'statute_lookup',
      description: 'Look up a specific California statute section',
      parameters: {
        type: 'object',
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
  },
  {
    type: 'function',
    function: {
      name: 'legislative_search',
      description: 'Search for California legislation and bills',
      parameters: {
        type: 'object',
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
  },
  {
    type: 'function',
    function: {
      name: 'complete_research',
      description: 'Signal that research is complete and provide final summary',
      parameters: {
        type: 'object',
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
  },
];

// =============================================================================
// OPENROUTER API TYPES
// =============================================================================

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

// =============================================================================
// RESEARCH AGENT CLASS
// =============================================================================

export class ResearchAgent {
  private cebSources: CEBSource[] = [];
  private caseLaw: CaseLawSource[] = [];
  private statutes: StatuteSource[] = [];
  private modelLanguage: CEBSearchResult['modelLanguage'] = [];
  private researchNotes: string = '';
  private keyAuthorities: ResearchPackage['keyAuthorities'] = [];

  constructor() {
    // No client initialization needed - using fetch
  }

  /**
   * Execute research based on the given query and sources
   */
  async research(
    query: string,
    sources: Array<'ceb' | 'courtlistener' | 'statutes' | 'legislative'>,
    focusAreas?: string[]
  ): Promise<ResearchPackage> {
    console.log('🔍 Research Agent: Starting research via OpenRouter for:', query);
    
    // Reset state
    this.cebSources = [];
    this.caseLaw = [];
    this.statutes = [];
    this.modelLanguage = [];
    this.researchNotes = '';
    this.keyAuthorities = [];

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      return this.buildResearchPackage(query);
    }

    // Build the user message
    const userMessage = this.buildUserMessage(query, sources, focusAreas);

    // Run the agent loop
    const messages: OpenRouterMessage[] = [
      { role: 'user', content: userMessage },
    ];

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;
      console.log(`🔄 Research Agent: Iteration ${iterations}`);

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
            model: 'anthropic/claude-haiku-4-5-20251001',
            messages: [
              { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
              ...messages
            ],
            tools: researchTools,
            tool_choice: 'auto',
            temperature: 0.2,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenRouter API error:', errorText);
          break;
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const finishReason = choice?.finish_reason;
        const assistantMessage = choice?.message;

        // Check if we're done
        if (finishReason === 'stop' || !assistantMessage?.tool_calls?.length) {
          console.log('✅ Research Agent: Completed (no more tool calls)');
          break;
        }

        // Process tool calls
        if (assistantMessage?.tool_calls?.length > 0) {
          // Add assistant message to history
          messages.push({
            role: 'assistant',
            content: assistantMessage.content,
            tool_calls: assistantMessage.tool_calls
          });

          // Process each tool call
          let researchComplete = false;
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            console.log(`  🔧 Tool call: ${toolName}`);
            
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await this.executeTool(toolName, args);
              
              // Add tool result to messages
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });

              if (toolName === 'complete_research') {
                researchComplete = true;
              }
            } catch (error) {
              console.error(`  ❌ Tool error (${toolName}):`, error);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' })
              });
            }
          }

          if (researchComplete) {
            console.log('✅ Research Agent: Completed (complete_research called)');
            break;
          }
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
