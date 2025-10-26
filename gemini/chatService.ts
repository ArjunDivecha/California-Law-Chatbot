
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
7. Include specific citations like "Case Name (Year)" for each case mentioned

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

                    // Perform verification of AI response against CourtListener data
                    const verificationResult = this.verifyResponse(response.text, specificSources, apiResult.content);

                    // Add verification status to response
                    const verifiedText = response.text + (verificationResult.needsVerification ?
                        '\n\n⚠️ Note: Some claims in this response may require verification against primary legal sources.' : '');

                    return { text: verifiedText, sources: uniqueSources };
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

            // Create specific source links based on citations in the response
            const specificSources: Source[] = [];

            // Parse response for legal citations and create specific links
            const responseText = response.text;

            // California Family Code citations (e.g., "Family Code § 1615(c)")
            const familyCodeMatches = responseText.match(/Family Code § (\d+)(?:\(([^)]+)\))?/gi);
            if (familyCodeMatches) {
                familyCodeMatches.forEach(match => {
                    const sectionMatch = match.match(/Family Code § (\d+)(?:\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=${section}.${subsection || '00000'}`;
                        specificSources.push({
                            title: `Family Code § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // California Penal Code citations
            const penalCodeMatches = responseText.match(/Penal Code § (\d+)(?:\(([^)]+)\))?/gi);
            if (penalCodeMatches) {
                penalCodeMatches.forEach(match => {
                    const sectionMatch = match.match(/Penal Code § (\d+)(?:\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=${section}.${subsection || '00000'}`;
                        specificSources.push({
                            title: `Penal Code § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // Case law citations (e.g., "People v. Anderson (1972)")
            const caseMatches = responseText.match(/([A-Za-z\s]+ v\. [A-Za-z\s]+)\s*\((\d{4})\)/g);
            if (caseMatches) {
                caseMatches.forEach(match => {
                    const caseMatch = match.match(/([A-Za-z\s]+ v\. [A-Za-z\s]+)\s*\((\d{4})\)/);
                    if (caseMatch) {
                        const caseName = caseMatch[1].trim();
                        const year = caseMatch[2];
                        // Create a search URL for CourtListener
                        const searchQuery = encodeURIComponent(`${caseName} ${year}`);
                        const url = `https://www.courtlistener.com/?q=${searchQuery}&type=o&order_by=score%20desc&stat_Precedential=on`;
                        specificSources.push({
                            title: `${caseName} (${year})`,
                            url: url
                        });
                    }
                });
            }

            // Add official sources as fallback
            const officialSources: Source[] = [
                { title: 'California Family Code', url: 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM' },
                { title: 'California Legislature', url: 'https://leginfo.legislature.ca.gov/' },
                { title: 'California Courts', url: 'https://courts.ca.gov/' },
                { title: 'CourtListener', url: 'https://www.courtlistener.com/' }
            ];

            // Combine sources: specific citations first, then official sources
            const allSources = [...specificSources, ...groundingSources, ...officialSources];
            const uniqueSources = Array.from(new Map(allSources.map(s => [s.url, s])).values());

            // Perform verification of AI response against sources
            const verificationResult = this.verifyResponse(response.text, specificSources, '');

            // Add verification status to response
            const verifiedText = response.text + (verificationResult.needsVerification ?
                '\n\n⚠️ Note: Some claims in this response may require verification against primary legal sources.' : '');

            return { text: verifiedText, sources: uniqueSources };

        } catch (error) {
            console.error('❌ Chat error:', error);
            console.error('Error details:', error.message, error.stack);
            return {
                text: "I'm having trouble connecting right now. Please try again.",
                sources: []
            };
        }
    }

    private verifyResponse(responseText: string, specificSources: Source[], courtListenerContent: string): { needsVerification: boolean; verifiedClaims: string[]; unverifiedClaims: string[] } {
        const verifiedClaims: string[] = [];
        const unverifiedClaims: string[] = [];

        // Extract factual claims from response
        const claims = this.extractClaims(responseText);

        for (const claim of claims) {
            let isVerified = false;

            // Check against specific sources (citations)
            for (const source of specificSources) {
                if (this.claimSupportedBySource(claim, source)) {
                    isVerified = true;
                    verifiedClaims.push(claim);
                    break;
                }
            }

            // Check against CourtListener content if available
            if (!isVerified && courtListenerContent && this.claimSupportedByCourtListener(claim, courtListenerContent)) {
                isVerified = true;
                verifiedClaims.push(claim);
            }

            if (!isVerified) {
                unverifiedClaims.push(claim);
            }
        }

        console.log('🔍 Verification Results:', {
            totalClaims: claims.length,
            verified: verifiedClaims.length,
            unverified: unverifiedClaims.length,
            needsVerification: unverifiedClaims.length > 0
        });

        return {
            needsVerification: unverifiedClaims.length > 0,
            verifiedClaims,
            unverifiedClaims
        };
    }

    private extractClaims(text: string): string[] {
        const claims: string[] = [];

        // Extract sentences that make factual claims about law
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

        for (const sentence of sentences) {
            // Look for sentences that mention legal requirements, definitions, or citations
            if (sentence.match(/\b(requires?|must|shall|defines?|means?|states?|provides?)\b/i) ||
                sentence.match(/\b(Family Code|Penal Code|Code of Civil Procedure|Evidence Code)\b/i) ||
                sentence.match(/\b(section|§)\s*\d+/i)) {
                claims.push(sentence.trim());
            }
        }

        return claims;
    }

    private claimSupportedBySource(claim: string, source: Source): boolean {
        // For statute citations, check if the source URL contains the cited section
        if (claim.includes('Family Code') && source.url.includes('leginfo.legislature.ca.gov') && source.url.includes('FAM')) {
            return true;
        }
        if (claim.includes('Penal Code') && source.url.includes('leginfo.legislature.ca.gov') && source.url.includes('PEN')) {
            return true;
        }
        // For case citations, check if source is CourtListener
        if (claim.match(/\bv\.\s/i) && source.url.includes('courtlistener.com')) {
            return true;
        }

        return false;
    }

    private claimSupportedByCourtListener(claim: string, courtListenerContent: string): boolean {
        // Check if the claim's key terms appear in the CourtListener content
        const claimWords = claim.toLowerCase().split(/\s+/).filter(word =>
            word.length > 3 && !['that', 'with', 'this', 'from', 'under', 'shall', 'must', 'requires'].includes(word)
        );

        const contentWords = courtListenerContent.toLowerCase();
        const matchingWords = claimWords.filter(word => contentWords.includes(word));

        // If more than 60% of significant words match, consider it verified
        return matchingWords.length / claimWords.length > 0.6;
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
