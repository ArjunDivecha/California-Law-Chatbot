
import { GoogleGenAI, Chat, FunctionDeclaration, Type, FunctionResponsePart } from "@google/genai";
import type { Source } from '../types';

export interface BotResponse {
    text: string;
    sources: Source[];
}

const searchCaseLawTool: FunctionDeclaration = {
    name: "search_case_law",
    description: "Searches for and retrieves information about a specific California court case from the CourtListener database.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: "The name of the court case, a citation, or a description of the case to search for. E.g., 'People v. Anderson' or '5 Cal. 4th 950'.",
            },
        },
        required: ["query"],
    },
};

export class ChatService {
    private chat: Chat;

    constructor() {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        this.chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are an expert legal research assistant specializing in California law. Your answers must be accurate and grounded in the provided search results or function call results. When a user asks about specific case law, use the `search_case_law` tool. For general questions or statutes, you can use Google Search. Cite your sources clearly using the format [1], [2], etc.",
                tools: [
                    { functionDeclarations: [searchCaseLawTool] },
                    { googleSearch: {} }
                ],
            }
        });
    }

    async sendMessage(message: string): Promise<BotResponse> {
        let response = await this.chat.sendMessage(message);
        const finalSources: Source[] = [];

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            
            const functionResponseParts: FunctionResponsePart[] = [];

            for (const call of functionCalls) {
                if (call.name === 'search_case_law') {
                    const caseQuery = call.args.query as string;
                    
                    const apiResult = await this.searchCourtListenerAPI(caseQuery);
                    
                    finalSources.push(...apiResult.sources);

                    functionResponseParts.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: apiResult.content },
                        },
                    });
                }
            }
            
            if (functionResponseParts.length > 0) {
                 response = await this.chat.sendMessage(functionResponseParts);
            }
        }
        
        const text = response.text;
        
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

        return { text, sources: uniqueSources };
    }
    
    private async searchCourtListenerAPI(query: string): Promise<{ content: string; sources: Source[] }> {
        const apiKey = process.env.COURTLISTENER_API_KEY;
        if (!apiKey) {
            console.warn("COURTLISTENER_API_KEY is not set. Falling back to general search.");
            return {
                content: "The specialized CourtListener search is currently unavailable. The following results are from a general web search.",
                sources: [],
            };
        }

        const endpoint = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(query)}&type=o&order_by=score%20desc&stat_Precedential=on`;

        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Token ${apiKey}`,
                },
            });

            if (!response.ok) {
                console.error(`CourtListener API error: ${response.status} ${response.statusText}`);
                return {
                    content: `I encountered an error while searching the CourtListener database. The API responded with status ${response.status}: ${response.statusText}.`,
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
                content: "I failed to connect to the CourtListener database due to a network error. Please check your internet connection.",
                sources: [],
            };
        }
    }
}
