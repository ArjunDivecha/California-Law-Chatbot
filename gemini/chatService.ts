
import { GoogleGenAI, Chat } from "@google/genai";
import type { Source } from '../types';

export interface BotResponse {
    text: string;
    sources: Source[];
}

export class ChatService {
    private chat: Chat;
    private courtListenerApiKey: string | null;

    constructor(courtListenerApiKey: string | null) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }
        this.courtListenerApiKey = courtListenerApiKey;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        this.chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are an expert legal research assistant specializing in California law. I have access to CourtListener database for specific case law searches. For general legal questions, I use web search capabilities. I provide accurate, well-researched answers with proper citations.",
                // Removed tools - now using keyword detection instead of function calling
            }
        });
    }

    async sendMessage(message: string): Promise<BotResponse> {
        if (message.trim().toLowerCase() === 'hello' || message.trim().toLowerCase() === 'hi') {
            return {
                text: "Hello! I am the California Law Chatbot. How can I help you with your legal research today?",
                sources: []
            };
        }

        // Check if this looks like a case law query (be more specific to avoid false positives)
        const isCaseQuery = /\b(v\.|versus)\b/i.test(message) || // case names like "People v. Anderson"
                           /\b\d+\s+(cal\.?|calif\.?|ca\.?|sup\.?ct\.?|app\.?|f\.(supp\.)?)\s+\d+\b/i.test(message) || // citations like "123 Cal. 456"
                           /\bcourt.*case\b|\bcase.*law\b|\blegal.*precedent\b/i.test(message); // explicit case law requests

        console.log('🔍 Query analysis:', {
            message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            isCaseQuery,
            hasCourtListenerKey: !!this.courtListenerApiKey
        });

        let finalSources: Source[] = [];

        if (isCaseQuery && this.courtListenerApiKey) {
            try {
                console.log('🔍 Detected case law query, searching CourtListener...');
                const apiResult = await this.searchCourtListenerAPI(message);

                // Check if CourtListener actually returned useful results
                if (apiResult.sources.length > 0 && !apiResult.content.includes('error') && !apiResult.content.includes('No specific case law found')) {
                    console.log('✅ CourtListener API call successful with results');
                    finalSources.push(...apiResult.sources);

                    // Create enhanced prompt with CourtListener data
                    const enhancedMessage = `${message}

I have retrieved the following case information from CourtListener database. Please analyze these cases comprehensively:

${apiResult.content}

INSTRUCTIONS:
1. For each case, identify the legal issues, parties involved, and jurisdiction
2. Analyze the significance and precedential value based on available metadata
3. If opinion text is available, summarize key holdings and reasoning
4. If only metadata is available, provide context using your legal knowledge
5. Compare cases where relevant and identify trends or patterns
6. Note any limitations in the analysis due to missing full text

Provide a thorough legal analysis citing specific case details and explaining their relevance to the query.`;

                    console.log('🤖 Sending enhanced message to Gemini...');
                    const response = await this.chat.sendMessage({ message: enhancedMessage });
                    console.log('✅ Gemini response received');

                    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                    const groundingSources: Source[] = groundingChunks
                        .map((chunk: any) => {
                            if (chunk.web) {
                                return { title: chunk.web.title || 'Untitled Source', url: chunk.web.uri };
                            }
                            return null;
                        })
                        .filter((source): source is Source => source !== null);

                    finalSources.push(...groundingSources);
                    const uniqueSources = Array.from(new Map(finalSources.map(s => [s.url, s])).values());

                    return { text: response.text, sources: uniqueSources };
                } else {
                    console.log('⚠️ CourtListener returned no useful results, falling back to regular chat');
                    // Fall back to regular chat if CourtListener didn't find anything useful
                }

            } catch (error) {
                console.error('❌ CourtListener integration failed:', error);
                // Fall back to regular chat
            }
        }

        // Regular chat without CourtListener
        try {
            console.log('💬 Sending regular chat message to Gemini...');

            // Enhance the prompt to request citations for legal information
            const enhancedMessage = `${message}

Please provide comprehensive, accurate information. For any legal claims, statutes, or case law mentioned, include specific citations and references. Format citations as [Source Name](URL) or reference official legal sources.

Key California legal sources to reference:
- California Family Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM
- California Civil Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV
- California Probate Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=PROB
- California Courts: https://courts.ca.gov/
- Official court opinions and case law through CourtListener`;

            const response = await this.chat.sendMessage({ message: enhancedMessage });
            console.log('✅ Regular chat response received');

            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const groundingSources: Source[] = groundingChunks
                .map((chunk: any) => {
                    if (chunk.web) {
                        return { title: chunk.web.title || 'Untitled Source', url: chunk.web.uri };
                    }
                    return null;
                })
                .filter((source): source is Source => source !== null);

            // Add official California legal sources if not already included
            const officialSources: Source[] = [
                { title: 'California Family Code', url: 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM' },
                { title: 'California Legislature', url: 'https://leginfo.legislature.ca.gov/' },
                { title: 'California Courts', url: 'https://courts.ca.gov/' },
                { title: 'CourtListener', url: 'https://www.courtlistener.com/' }
            ];

            // Combine and deduplicate sources
            const allSources = [...groundingSources, ...officialSources];
            const uniqueSources = Array.from(new Map(allSources.map(s => [s.url, s])).values());

            return { text: response.text, sources: uniqueSources };

        } catch (error) {
            console.error('❌ Chat error:', error);
            console.error('Error details:', error.message, error.stack);
            return {
                text: "I'm having trouble connecting right now. Please try again.",
                sources: []
            };
        }
    }
    
    private async searchCourtListenerAPI(query: string): Promise<{ content: string; sources: Source[] }> {
        const apiKey = this.courtListenerApiKey;
        console.log('🔑 CourtListener API key present:', !!apiKey);

        if (!apiKey) {
            console.warn("COURTLISTENER_API_KEY is not set. Falling back to general search.");
            return {
                content: "The specialized CourtListener search is currently unavailable because an API key has not been provided. The following results are from a general web search.",
                sources: [],
            };
        }

        const endpoint = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&order_by=score%20desc&stat_Precedential=on`;

        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'User-Agent': 'California Law Chatbot/1.0',
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error(`❌ CourtListener API error: ${response.status} ${response.statusText}`);
                console.error(`Error details: ${errorText}`);
                return {
                    content: `ERROR: CourtListener API returned ${response.status} - ${errorText}`,
                    sources: [],
                };
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                return {
                    content: `No specific case law found on CourtListener for the query: "${query}".`,
                    sources: [],
                };
            }

            const topResults = data.results.slice(0, 3);

            // Debug: Log available fields
            console.log('🔍 CourtListener result fields:', Object.keys(topResults[0] || {}));

            const contentForAI = topResults.map((result: any, index: number) => {
                return `Result ${index + 1}:
Case Name: ${result.caseName}
Citation: ${result.citation}
Date Filed: ${result.dateFiled}
Snippet: ${result.snippet}`;
            }).join('\n\n');

            const sources: Source[] = topResults.map((result: any) => ({
                title: result.caseName || 'Untitled Case',
                url: `https://www.courtlistener.com${result.absolute_url}`
            }));

            return {
                content: contentForAI,
                sources: sources,
            };

        } catch (error) {
            console.error("Failed to fetch from CourtListener API:", error);
            return {
                content: "There was an error connecting to the CourtListener database.",
                sources: [],
            };
        }
    }
}
