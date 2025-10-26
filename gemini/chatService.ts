
import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
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
        if (message.trim().toLowerCase() === 'hello' || message.trim().toLowerCase() === 'hi') {
            return {
                text: "Hello! I am the California Law Chatbot. How can I help you with your legal research today?",
                sources: []
            };
        }

        let response = await this.chat.sendMessage({ message });
        const finalSources: Source[] = [];

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'search_case_law') {
                const caseQuery = call.args.query as string;
                
                // --- MOCK API CALL to CourtListener ---
                console.log(`Simulating API call to CourtListener for: "${caseQuery}"`);
                const apiResult = this.mockCourtListenerAPI(caseQuery);
                // -----------------------------------------
                
                // Hold on to the sources from our API call
                finalSources.push(...apiResult.sources);

                // Send the content from our API back to the model to generate a response
                response = await this.chat.sendMessage({
                    message: {
                        toolResponse: {
                            functionResponses: {
                                id: call.id,
                                name: call.name,
                                response: { content: apiResult.content }, // Only send content to the model
                            }
                        }
                    }
                });
            }
        }
        
        const text = response.text;
        
        // Extract sources from Google Search grounding, if it was used
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingSources: Source[] = groundingChunks
            .map((chunk: any) => {
                if (chunk.web) {
                    return { title: chunk.web.title || 'Untitled Source', url: chunk.web.uri };
                }
                return null;
            })
            .filter((source): source is Source => source !== null);
        
        // Combine sources from our function call and Google Search
        finalSources.push(...groundingSources);
        
        // Remove duplicates to ensure a clean list
        const uniqueSources = Array.from(new Map(finalSources.map(s => [s.url, s])).values());

        return { text, sources: uniqueSources };
    }

    private mockCourtListenerAPI(query: string): { content: string, sources: Source[] } {
        // This is a mock response. A real API would return structured data.
        const lowerQuery = query.toLowerCase();
        let resultText: string;
        let source: Source;

        if (lowerQuery.includes("anderson")) {
            resultText = "In *People v. Anderson* (1972) 6 Cal.3d 628, the California Supreme Court found the death penalty to be unconstitutional, cruel, and unusual punishment under the California Constitution.";
            source = { title: "People v. Anderson, 6 Cal. 3d 628", url: "https://www.courtlistener.com/opinion/207000/people-v-anderson/" };
        } else if (lowerQuery.includes("tarasoff")) {
             resultText = "In *Tarasoff v. Regents of the University of California* (1976) 17 Cal.3d 425, the court established a 'duty to protect' for psychotherapists, requiring them to take reasonable care to protect third parties from dangers posed by a patient.";
            source = { title: "Tarasoff v. Regents of Univ. of Cal., 17 Cal. 3d 425", url: "https://www.courtlistener.com/opinion/189728/tarasoff-v-regents-of-univ-of-cal/"};
        } else {
            resultText = `No specific information found for the case "${query}". The mock database only contains information for 'People v. Anderson' and 'Tarasoff v. Regents'.`;
            source = { title: "CourtListener", url: "https://www.courtlistener.com/" };
        }

        return {
            content: resultText,
            sources: [source]
        };
    }
}
