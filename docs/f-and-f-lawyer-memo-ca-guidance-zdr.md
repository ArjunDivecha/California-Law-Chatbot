# Memo: Practical Changes to the Chatbot After California AI Guidance and ZDR

Date: June 23, 2026

To: F&F Lawyers

From: California Law Chatbot Project Team

Re: Expected chatbot changes after the 2026 California AI guidance and Anthropic ZDR

Two developments materially change how the California Law Chatbot should be designed and used. First, the State Bar of California's 2026 generative AI guidance makes clear that lawyer duties around competence, confidentiality, supervision, client communication, billing, candor to tribunals, discrimination, and court-rule compliance apply when lawyers use generative or agentic AI. Second, F&F plans to use an Anthropic Enterprise / Claude Platform arrangement with Zero Data Retention for the organization that supplies the chatbot's API key. Together, these developments point to a better product design: less friction for ordinary confidential legal analysis, but much more explicit controls around tools, protected discovery, review, and auditability.

The California guidance means the chatbot cannot be treated as a general research toy that happens to answer legal questions. It needs to be a lawyer-supervised work system. The product should distinguish public legal research from client-confidential work and protected-discovery work. It should preserve a record of which providers and tools were used. It should require attorney review before output is treated as final, sent to a client, copied into a pleading, or used for filing. It should also support citation checking, court-specific AI disclosure checks, billing separation, and controls against biased or discriminatory uses. In short, the guidance pushes the chatbot toward matter-aware workflows, not one undifferentiated chat box.

ZDR changes the confidentiality analysis for the direct Anthropic model call. If F&F's production API key is confirmed to belong to the ZDR-enabled Anthropic organization, eligible prompts and responses sent through the direct Claude API are not stored at rest after the response, subject to Anthropic's stated legal and misuse-enforcement exceptions. That means ordinary client-confidential prompts likely do not need to be aggressively tokenized before being sent to Claude. This should improve quality, because the model can see the real facts, dates, actors, procedural posture, and legal context instead of placeholder tokens.

But ZDR does not eliminate the controls required by the California guidance. It only reduces one risk: retention by Anthropic on the direct eligible API path. It does not cover public web search, CEB/OpenAI embeddings, Upstash storage, Vercel logs, CourtListener/LegiScan/OpenStates query logs, MCP connectors, browser local storage, document exports, or the firm's own litigation-hold and file-retention duties. Those remain separate disclosure surfaces. As a result, the chatbot still needs a provider registry, per-turn manifests, tool-query gating, matter modes, and lawyer review gates.

The practical changes should be these. For ordinary client-confidential work, the chatbot can become less redaction-heavy when using the verified Anthropic ZDR path. Sanitization should shift from "mask everything before Claude sees it" to "detect sensitivity, route correctly, and prevent leakage into the wrong tools." Public web search should be allowed for public research, but should not receive client facts. For client-confidential matters, web search should be limited to lawyer-approved sanitized public-law queries. For protected-discovery matters, broad public web search should remain blocked.

Protected discovery should remain the narrowest mode. ZDR makes Anthropic a much more plausible approved inference provider for protected material, but it should not be treated as automatic permission. Protected-discovery use should still require matter-level approval, provider evidence, tool restrictions, audit or manifest capture, and attorney review. If a protective order requires deletion evidence, no-training terms, downstream restrictions, or written documentation, the product should be able to produce that compliance record.

The expected result is a chatbot that is easier to use for normal confidential legal work, but stricter and more transparent where the California guidance creates lawyer-duty risk. The immediate next steps are to confirm F&F's ZDR status and API-key provenance, update the provider registry and disclosure language, relax tokenization only for the direct ZDR Anthropic path, and implement policy-based gating for web search, embeddings, exports, protected discovery, and final-output review.

