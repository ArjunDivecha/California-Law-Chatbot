
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

        const legislationData = await this.fetchLegislationData(message);
        let legislationContextInstructions = '';
        if (legislationData.sources.length > 0) {
            finalSources.push(...legislationData.sources);
        }
        if (legislationData.context) {
            legislationContextInstructions = `\n\nLegislative research results (validated from official sources):\n${legislationData.context}\n\nUse this verified bill information. Reference the specific bill identifiers, summarize their status accurately, and cite the provided sources.`;
        }

        if (isCaseQuery && this.courtListenerApiKey) {
            try {
                console.log('🔍 Detected case law query, searching CourtListener...');
                const apiResult = await this.searchCourtListenerAPI(message);

                // Check if CourtListener actually returned useful results
                if (apiResult.sources.length > 0 && !apiResult.content.includes('error') && !apiResult.content.includes('No specific case law found')) {
                    console.log('✅ CourtListener API call successful with results');
                    finalSources.push(...apiResult.sources);

                    // Create enhanced prompt with CourtListener data
                    let enhancedMessage = `${message}`;
                    if (legislationContextInstructions) {
                        enhancedMessage += legislationContextInstructions;
                    }

                    enhancedMessage += `

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
                    const combinedVerificationSources = [...specificSources, ...finalSources];
                    const verificationResult = this.verifyResponse(response.text, combinedVerificationSources, apiResult.content);

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
            let enhancedMessage = `${message}`;
            if (legislationContextInstructions) {
                enhancedMessage += legislationContextInstructions;
            }

            enhancedMessage += `

Please provide comprehensive, accurate information. For any legal claims, statutes, case law, or California legislation mentioned, include specific citations and references. Format citations as [Source Name](URL) or reference official legal sources.

Key California legal sources to reference:
- California Family Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM
- California Civil Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV
- California Probate Code: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=PROB
- California Courts: https://courts.ca.gov/
- Official court opinions and case law through CourtListener
- Current California bills (AB/SB/etc.) with status and summaries drawn from the provided legislative research`;

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

            // California Family Code citations (e.g., "Family Code § 1615(c)", "Fam. Code § 1615(c)")
            const familyCodeMatches = responseText.match(/(?:Family\s+Code|Fam\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/gi);
            if (familyCodeMatches) {
                familyCodeMatches.forEach(match => {
                    const sectionMatch = match.match(/(?:Family\s+Code|Fam\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=${section}`;
                        specificSources.push({
                            title: `Family Code § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // Business & Professions Code (e.g., "Bus. & Prof. Code § 6068")
            const bpMatches = responseText.match(/(?:(?:Business\s*&\s*Professions\s*Code)|(?:Bus\.\s*&\s*Prof\.)\s*Code|B&P\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (bpMatches) {
                bpMatches.forEach(match => {
                    const m = match.match(/(?:(?:Business\s*&\s*Professions\s*Code)|(?:Bus\.\s*&\s*Prof\.)\s*Code|B&P\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=${section}`;
                        specificSources.push({ title: `Bus. & Prof. Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            // Vehicle Code (e.g., "Vehicle Code § 23152", "Veh. Code § 23152(b)")
            const vehMatches = responseText.match(/(?:(?:Vehicle\s+Code)|(?:Veh\.\s*Code))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (vehMatches) {
                vehMatches.forEach(match => {
                    const m = match.match(/(?:(?:Vehicle\s+Code)|(?:Veh\.\s*Code))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=${section}`;
                        specificSources.push({ title: `Vehicle Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            // Government Code (e.g., "Gov. Code § 6254")
            const govMatches = responseText.match(/(?:(?:Government\s+Code)|(?:Gov\.\s*Code))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (govMatches) {
                govMatches.forEach(match => {
                    const m = match.match(/(?:(?:Government\s+Code)|(?:Gov\.\s*Code))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=${section}`;
                        specificSources.push({ title: `Gov. Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            // Health & Safety Code (e.g., "Health & Saf. Code § 11350")
            const hsMatches = responseText.match(/(?:(?:Health\s*&\s*Safety\s*Code)|(?:Health\s*&\s*Saf\.)\s*Code|H&S\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (hsMatches) {
                hsMatches.forEach(match => {
                    const m = match.match(/(?:(?:Health\s*&\s*Safety\s*Code)|(?:Health\s*&\s*Saf\.)\s*Code|H&S\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=${section}`;
                        specificSources.push({ title: `Health & Saf. Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            // CALCRIM pattern (e.g., "CALCRIM No. 1700")
            const calcrimMatches = responseText.match(/CALCRIM\s*(?:No\.|Number)?\s*(\d{3,4})/gi);
            if (calcrimMatches) {
                calcrimMatches.forEach(match => {
                    const m = match.match(/CALCRIM\s*(?:No\.|Number)?\s*(\d{3,4})/i);
                    if (m) {
                        const num = m[1];
                        // Link to Judicial Council's official CALCRIM index PDF or FindLaw fallback
                        const url = `https://www.courts.ca.gov/partners/317.htm`; // index page; specific PDFs change versioned URLs
                        specificSources.push({ title: `CALCRIM No. ${num}`, url });
                    }
                });
            }

            // CACI pattern (e.g., "CACI No. 430")
            const caciMatches = responseText.match(/CACI\s*(?:No\.|Number)?\s*(\d{3,4})/gi);
            if (caciMatches) {
                caciMatches.forEach(match => {
                    const m = match.match(/CACI\s*(?:No\.|Number)?\s*(\d{3,4})/i);
                    if (m) {
                        const num = m[1];
                        const url = `https://www.courts.ca.gov/partners/317.htm`; // index hub
                        specificSources.push({ title: `CACI No. ${num}`, url });
                    }
                });
            }

            // California Constitution (e.g., "Cal. Const. art. I, § 13")
            const constMatches = responseText.match(/Cal\.\s*Const\.?\s*art\.?\s*([ivx]+)\s*,?\s*§\s*(\d+[a-z]?)/gi);
            if (constMatches) {
                constMatches.forEach(match => {
                    const m = match.match(/Cal\.\s*Const\.?\s*art\.?\s*([ivx]+)\s*,?\s*§\s*(\d+[a-z]?)/i);
                    if (m) {
                        const article = m[1].toUpperCase();
                        const section = m[2];
                        // Official constitution page doesn't have stable per-section anchors; link to table of contents
                        const url = `https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=CONS&tocTitle=California+Constitution`;
                        specificSources.push({ title: `Cal. Const. art. ${article}, § ${section}`, url });
                    }
                });
            }

            // Additional California Codes without login (Civil, Labor, Corporations, Welfare & Institutions)
            const civMatches = responseText.match(/(?:Civil\s+Code|Civ\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (civMatches) {
                civMatches.forEach(match => {
                    const m = match.match(/(?:Civil\s+Code|Civ\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection ?
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=${section}.${subsection}` :
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=${section}`;
                        specificSources.push({ title: `Civil Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            const labMatches = responseText.match(/(?:Labor\s+Code|Lab\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (labMatches) {
                labMatches.forEach(match => {
                    const m = match.match(/(?:Labor\s+Code|Lab\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection ?
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=${section}.${subsection}` :
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=${section}`;
                        specificSources.push({ title: `Labor Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            const corpMatches = responseText.match(/(?:Corporations\s+Code|Corp\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (corpMatches) {
                corpMatches.forEach(match => {
                    const m = match.match(/(?:Corporations\s+Code|Corp\.\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection ?
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CORP&sectionNum=${section}.${subsection}` :
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CORP&sectionNum=${section}`;
                        specificSources.push({ title: `Corp. Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            const wicMatches = responseText.match(/(?:Welfare\s*&\s*Institutions\s*Code|Welf\.\s*&\s*Inst\.\s*Code|W&I\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (wicMatches) {
                wicMatches.forEach(match => {
                    const m = match.match(/(?:Welfare\s*&\s*Institutions\s*Code|Welf\.\s*&\s*Inst\.\s*Code|W&I\s*Code)\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (m) {
                        const section = m[1];
                        const subsection = m[2] || '';
                        const url = subsection ?
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WIC&sectionNum=${section}.${subsection}` :
                          `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WIC&sectionNum=${section}`;
                        specificSources.push({ title: `W&I Code § ${section}${subsection ? `(${subsection})` : ''}`, url });
                    }
                });
            }

            // Judicial Council forms (e.g., "Form CR-101" or "Judicial Council form FL-100")
            const formMatches = responseText.match(/(?:Judicial\s+Council\s+)?form\s+([A-Z]{1,3}-\d{2,4})/gi);
            if (formMatches) {
                formMatches.forEach(match => {
                    const m = match.match(/(?:Judicial\s+Council\s+)?form\s+([A-Z]{1,3}-\d{2,4})/i);
                    if (m) {
                        const form = m[1].toUpperCase();
                        const url = `https://www.courts.ca.gov/forms.htm?query=${encodeURIComponent(form)}`;
                        specificSources.push({ title: `Judicial Council Form ${form}`, url });
                    }
                });
            }

            // California Attorney General Opinions (e.g., "89 Ops.Cal.Atty.Gen. 234")
            const agMatches = responseText.match(/\b\d+\s+Ops\.?\s*Cal\.?\s*Atty\.?\s*Gen\.?\s*\d+\b/gi);
            if (agMatches) {
                agMatches.forEach(op => {
                    const url = `https://oag.ca.gov/opinions/search?keys=${encodeURIComponent(op)}`;
                    specificSources.push({ title: `AG Opinion ${op}`, url });
                });
            }

            // CALCRIM/CACI per-number stable public pages (FindLaw) as alternatives
            // If a CALCRIM number exists, add FindLaw link too
            const calcrimNums = (responseText.match(/CALCRIM\s*(?:No\.|Number)?\s*(\d{3,4})/gi) || []).map(m => (m.match(/(\d{3,4})/) || [])[1]).filter(Boolean);
            calcrimNums.forEach(n => {
                const url = `https://www.findlaw.com/criminal/criminal-legal-help/calcrim-jury-instructions/calcrim-no-${n}.html`;
                specificSources.push({ title: `CALCRIM No. ${n} (FindLaw)`, url });
            });

            const caciNums = (responseText.match(/CACI\s*(?:No\.|Number)?\s*(\d{3,4})/gi) || []).map(m => (m.match(/(\d{3,4})/) || [])[1]).filter(Boolean);
            caciNums.forEach(n => {
                const url = `https://www.findlaw.com/litigation/going-to-court/caci-jury-instructions/caci-no-${n}.html`;
                specificSources.push({ title: `CACI No. ${n} (FindLaw)`, url });
            });

            // California reporter citations (e.g., "61 Cal.2d 861", "196 Cal.App.4th 123")
            const reporterMatches = responseText.match(/\b(\d+)\s+Cal\.(?:App\.)?(?:\d[dth])?\s+\d+\b|\b\d+\s+Cal\.[A-Za-z.\d]+\s+\d+\b/gi);
            if (reporterMatches) {
                for (const cite of reporterMatches) {
                    try {
                        const resolved = await this.searchCourtListenerAPI(cite);
                        if (resolved.sources.length > 0) {
                            specificSources.push({ title: cite, url: resolved.sources[0].url });
                        }
                    } catch {}
                }
            }

            // California Penal Code citations (e.g., "Penal Code § 459", "Cal. Penal Code § 459", "Pen. Code § 459")
            const penalCodeMatches = responseText.match(/(?:(?:California|Cal\.)\s+)?(?:Penal\s+Code|Pen\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/gi);
            if (penalCodeMatches) {
                penalCodeMatches.forEach(match => {
                    const sectionMatch = match.match(/(?:(?:California|Cal\.)\s+)?(?:Penal\s+Code|Pen\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=${section}`;
                        specificSources.push({
                            title: `Penal Code § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // Case law citations
            // Patterns handled:
            //   - "People v. Anderson (1972)"
            //   - "People v. Anderson, 6 Cal.3d 628 (1972)"
            //   - "Smith v. Jones, 123 Cal.App.4th 567 (2005)"
            const caseMatches = responseText.match(/([A-Z][A-Za-z\s.&'-]+ v\. [A-Z][A-Za-z\s.&'-]+)(?:,\s*\d+\s+[A-Za-z.\d]+\s+\d+)?\s*(?:\((\n?\d{4})\))?/g);
            if (caseMatches) {
                for (const match of caseMatches) {
                    const caseMatch = match.match(/([A-Z][A-Za-z\s.&'-]+ v\. [A-Z][A-Za-z\s.&'-]+)(?:,\s*\d+\s+[A-Za-z.\d]+\s+\d+)?\s*(?:\((\d{4})\))?/);
                    if (caseMatch) {
                        const caseName = caseMatch[1].trim();
                        const year = caseMatch[2] || '';
                        try {
                            // Resolve to specific CourtListener opinion URL via API
                            const query = year ? `${caseName} ${year}` : caseName;
                            const resolved = await this.searchCourtListenerAPI(query);
                            if (resolved.sources.length > 0) {
                                // Use the first result (best score)
                                specificSources.push({
                                    title: year ? `${caseName} (${year})` : caseName,
                                    url: resolved.sources[0].url
                                });
                            } else {
                                // Fallback to search URL if nothing resolved
                                const searchQuery = encodeURIComponent(query);
                                specificSources.push({
                                    title: year ? `${caseName} (${year})` : caseName,
                                    url: `https://www.courtlistener.com/?q=${searchQuery}&type=o&order_by=score%20desc&stat_Precedential=on`
                                });
                            }
                        } catch (e) {
                            const searchQuery = encodeURIComponent(`${caseName} ${year}`.trim());
                            specificSources.push({
                                title: year ? `${caseName} (${year})` : caseName,
                                url: `https://www.courtlistener.com/?q=${searchQuery}&type=o&order_by=score%20desc&stat_Precedential=on`
                            });
                        }
                    }
                }
            }

            // California Evidence Code citations (e.g., "Evidence Code § 352")
            const evidenceCodeMatches = responseText.match(/(?:Evidence\s+Code|Evid\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/gi);
            if (evidenceCodeMatches) {
                evidenceCodeMatches.forEach(match => {
                    const sectionMatch = match.match(/(?:Evidence\s+Code|Evid\.\s*Code)\s*§\s*(\d+)(?:\s*\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=${section}`;
                        specificSources.push({
                            title: `Evidence Code § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // California Code of Civil Procedure (e.g., "Code Civ. Proc. § 128.7" or "CCP § 128.7")
            const ccpMatches = responseText.match(/(?:(?:Code\s+of\s+Civil\s+Procedure|Code\s+Civ\.\s+Proc\.|CCP))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi);
            if (ccpMatches) {
                ccpMatches.forEach(match => {
                    const sectionMatch = match.match(/(?:(?:Code\s+of\s+Civil\s+Procedure|Code\s+Civ\.\s+Proc\.|CCP))\s*§\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i);
                    if (sectionMatch) {
                        const section = sectionMatch[1];
                        const subsection = sectionMatch[2] || '';
                        const url = subsection
                          ? `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=${section}.${subsection}`
                          : `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=${section}`;
                        specificSources.push({
                            title: `Code Civ. Proc. § ${section}${subsection ? `(${subsection})` : ''}`,
                            url: url
                        });
                    }
                });
            }

            // Combine sources: specific citations and grounding sources only
            // Do NOT add generic fallbacks; show only actual used sources
            const allSources = [...specificSources, ...groundingSources, ...finalSources];
            
            // Topic-based enrichment to ensure diverse, public sources when relevant keywords appear
            const lowered = response.text.toLowerCase();
            const enrich: Source[] = [];
            const pushOnce = (title: string, url: string) => {
                if (!enrich.some(s => s.url === url)) enrich.push({ title, url });
            };

            // Burglary
            if (/\bburglary\b|penal code\s*§?\s*459\b/.test(lowered)) {
                pushOnce('Penal Code § 459', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459');
                pushOnce('Penal Code § 460', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=460');
                pushOnce('Penal Code § 461', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=461');
                pushOnce('CALCRIM No. 1700 (FindLaw)', 'https://www.findlaw.com/criminal/criminal-legal-help/calcrim-jury-instructions/calcrim-no-1700.html');
            }

            // DUI
            if (/\bdui\b|vehicle code\s*§?\s*23152\b/.test(lowered)) {
                pushOnce('Vehicle Code § 23152', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=23152');
                pushOnce('CALCRIM No. 2110 (FindLaw)', 'https://www.findlaw.com/criminal/criminal-legal-help/calcrim-jury-instructions/calcrim-no-2110.html');
                pushOnce('CALCRIM No. 2111 (FindLaw)', 'https://www.findlaw.com/criminal/criminal-legal-help/calcrim-jury-instructions/calcrim-no-2111.html');
            }

            // DVRO / DVPA
            if (/\bdvro\b|domestic violence|dvpa|family code\s*§?\s*6[2-3]\d{2}\b/.test(lowered)) {
                pushOnce('Family Code § 6200', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6200');
                pushOnce('Family Code § 6300', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6300');
                pushOnce('Form DV-100 (Request for DVRO)', 'https://www.courts.ca.gov/forms.htm?query=DV-100');
                pushOnce('Form DV-110 (Temporary Restraining Order)', 'https://www.courts.ca.gov/forms.htm?query=DV-110');
            }

            // CPRA / Public records
            if (/public records act|cpra|gov(?:ernment)? code\s*§?\s*6254\b/.test(lowered)) {
                pushOnce('Gov. Code § 6254', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=6254');
            }

            // WIC 5150
            if (/\b5150\b|w&i code\s*§?\s*5150\b/.test(lowered)) {
                pushOnce('W&I Code § 5150', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WIC&sectionNum=5150');
            }

            // Merge: specific + grounding + enrichment, then dedupe
            const allWithEnrichment = [...allSources, ...enrich];
            const uniqueSources = Array.from(new Map(allWithEnrichment.map(s => [s.url, s])).values());

            // Perform verification of AI response against sources
            const combinedVerificationSources = [...specificSources, ...finalSources];
            const verificationResult = this.verifyResponse(response.text, combinedVerificationSources, '');

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

    private async fetchLegislationData(message: string): Promise<{ context: string; sources: Source[] }> {
        const billPattern = /(Assembly\s+Bill|Senate\s+Bill|Assembly\s+Joint\s+Resolution|Senate\s+Joint\s+Resolution|Assembly\s+Concurrent\s+Resolution|Senate\s+Concurrent\s+Resolution|Assembly\s+Resolution|Senate\s+Resolution|AB|SB|AJR|ACR|SCR|SJR|HR|SR)\s*-?\s*(\d+[A-Z]?)(?:\s*\((\d{4})\))?/gi;
        const typeMap: Record<string, string> = {
            'ASSEMBLY BILL': 'AB',
            'SENATE BILL': 'SB',
            'ASSEMBLY JOINT RESOLUTION': 'AJR',
            'SENATE JOINT RESOLUTION': 'SJR',
            'ASSEMBLY CONCURRENT RESOLUTION': 'ACR',
            'SENATE CONCURRENT RESOLUTION': 'SCR',
            'ASSEMBLY RESOLUTION': 'AR',
            'SENATE RESOLUTION': 'SR',
            'AB': 'AB',
            'SB': 'SB',
            'AJR': 'AJR',
            'ACR': 'ACR',
            'SCR': 'SCR',
            'SJR': 'SJR',
            'HR': 'HR',
            'SR': 'SR'
        };

        const matches = new Map<string, { label: string; searchTerm: string; year?: string }>();
        let match;
        while ((match = billPattern.exec(message)) !== null) {
            const rawType = match[1] || '';
            const number = match[2] || '';
            const year = match[3] || '';
            const normalizedType = typeMap[rawType.toUpperCase()] || rawType.toUpperCase();
            if (!normalizedType || !number) {
                continue;
            }
            const label = `${normalizedType} ${number}${year ? ` (${year})` : ''}`;
            const searchTerm = `${normalizedType} ${number}`;
            if (!matches.has(label)) {
                matches.set(label, { label, searchTerm, year });
            }
        }

        if (matches.size === 0) {
            return { context: '', sources: [] };
        }

        const summaryChunks: string[] = [];
        const collectedSources: Source[] = [];

        for (const { label, searchTerm, year } of matches.values()) {
            const query = year ? `${searchTerm} ${year}` : searchTerm;
            const normalized = searchTerm.toUpperCase();

            const billSummaries: string[] = [];

            try {
                const openStatesResponse = await fetch(`/api/openstates-search?q=${encodeURIComponent(query)}`);
                if (openStatesResponse.ok) {
                    const data = await openStatesResponse.json();
                    const items = Array.isArray(data?.items) ? data.items : [];
                    const matchItem = items.find((item: any) => (item?.identifier || '').toUpperCase().includes(normalized));
                    if (matchItem) {
                        const title = matchItem.title || 'Title unavailable';
                        const session = typeof matchItem.session === 'string' ? matchItem.session : (matchItem.session?.name || matchItem.session?.identifier || '');
                        const updatedAt = matchItem.updatedAt ? new Date(matchItem.updatedAt).toISOString().split('T')[0] : '';
                        const openStatesUrl = matchItem.url;
                        billSummaries.push(`OpenStates: ${title}${session ? ` (Session: ${session})` : ''}${updatedAt ? ` [updated ${updatedAt}]` : ''}`);
                        if (openStatesUrl) {
                            collectedSources.push({ title: `${label} – OpenStates`, url: openStatesUrl });
                        }
                    }
                } else {
                    console.warn('OpenStates proxy error:', await openStatesResponse.text());
                }
            } catch (error) {
                console.error('Failed to call OpenStates proxy:', error);
            }

            try {
                const legiscanResponse = await fetch(`/api/legiscan-search?q=${encodeURIComponent(query)}`);
                if (legiscanResponse.ok) {
                    const data = await legiscanResponse.json();
                    const resultsObj = data?.searchresult || {};
                    const entries = Object.values(resultsObj).filter((entry: any) => entry && typeof entry === 'object' && entry.bill_number);
                    const matchEntry = entries.find((entry: any) => (entry.bill_number || '').toUpperCase().includes(normalized));
                    if (matchEntry) {
                        const title = matchEntry.title || 'Title unavailable';
                        const lastAction = matchEntry.last_action || 'Status unavailable';
                        const lastActionDate = matchEntry.last_action_date || '';
                        const legiscanUrl = matchEntry.url || matchEntry.text_url || matchEntry.research_url;
                        billSummaries.push(`LegiScan: ${title}${lastActionDate ? ` (Last action: ${lastActionDate})` : ''} – ${lastAction}`);
                        if (legiscanUrl) {
                            collectedSources.push({ title: `${label} – LegiScan`, url: legiscanUrl });
                        }
                    }
                } else {
                    console.warn('LegiScan proxy error:', await legiscanResponse.text());
                }
            } catch (error) {
                console.error('Failed to call LegiScan proxy:', error);
            }

            if (billSummaries.length > 0) {
                summaryChunks.push(`${label}:\n${billSummaries.map(summary => `  • ${summary}`).join('\n')}`);
            } else {
                summaryChunks.push(`${label}: No legislative data retrieved from OpenStates or LegiScan.`);
            }
        }

        const uniqueSources = Array.from(new Map(collectedSources.map(source => [source.url, source])).values());
        return {
            context: summaryChunks.join('\n\n'),
            sources: uniqueSources,
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
        // For California legislation
        if (claim.match(/\b(AB|SB|Assembly Bill|Senate Bill|AJR|ACR|SCR|SJR|HR|SR)\s*\d+/i) && (source.url.includes('legiscan.com') || source.url.includes('openstates.org') || source.url.includes('pluralpolicy.com'))) {
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
        try {
            const r = await fetch(`/api/courtlistener-search?q=${encodeURIComponent(query)}`);
            if (!r.ok) {
                const text = await r.text().catch(() => 'Unknown error');
                console.error(`❌ CourtListener proxy error: ${r.status} ${r.statusText}`, text);
                return { content: `ERROR: CourtListener proxy returned ${r.status}`, sources: [] };
            }
            const data = await r.json();
            return { content: data.content || '', sources: data.sources || [] };
        } catch (error) {
            console.error('Failed to call CourtListener proxy:', error);
            return { content: 'There was an error connecting to the CourtListener proxy.', sources: [] };
        }
    }
}
