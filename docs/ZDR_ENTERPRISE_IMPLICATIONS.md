# ZDR Enterprise Implications For California Law Chatbot V2

> ## ⚠️ OVERTAKEN BY EVENTS — 2026-07-01
>
> **The core assumption of this document is dead.** F&F was told an enterprise
> account (~$6k/yr) would include Zero Data Retention; in fact Anthropic ZDR
> requires a ~**$100k/yr** commitment, which F&F declined on 2026-07-01.
>
> This document is retained for the record (its "what ZDR does NOT cover"
> analysis remains a correct map of the non-LLM disclosure surfaces). Do NOT
> implement its tokenization-relaxation recommendations. The operative posture
> is Anthropic standard commercial terms + DPA (no-train, deletion-on-request,
> 30-day default retention), which per the Morgan v. V2X research memo
> (2026-06-02) satisfies the protective-order standard without ZDR. Strict
> on-device tokenization/sanitization remains load-bearing on every leg. The
> Fable-5 model decision below is also superseded: Fable 5 was restored from
> suspension and re-approved as primary 2026-07-01 (see
> `api/_lib/approvedModels.ts`). See the 2026-07-01 addendum in
> `docs/PRD_COPRAC_ZDR_COMPLIANCE.md`, which governs.

Date: 2026-06-23
Target repo: `California-Law-Chatbot-V2`
Assumption: F&F will obtain an Anthropic Enterprise / Claude Platform arrangement with Zero Data Retention enabled for the organization that supplies the chatbot's Anthropic API key.
Model decision: F&F will not use Claude Fable for the chatbot. Confidential and protected Anthropic inference should use Opus, subject to current ZDR eligibility verification.

This is a product and architecture analysis, not legal advice. The short version is: ZDR makes the direct Anthropic inference path much easier and materially reduces the need to mask ordinary client facts before sending them to Claude. It does not eliminate the need for matter modes, tool gating, provider registry evidence, audit manifests, review gates, or protected-discovery controls.

## Source Baseline

Official Anthropic sources reviewed on 2026-06-23:

- Anthropic API and data retention docs: `https://platform.claude.com/docs/en/manage-claude/api-and-data-retention`
- Anthropic Privacy Center ZDR scope article: `https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to`
- Anthropic API feature overview and ZDR eligibility table: `https://platform.claude.com/docs/en/build-with-claude/overview`
- Anthropic Enterprise plan overview: `https://support.claude.com/en/articles/9797531-what-is-the-enterprise-plan`
- Anthropic commercial data processor/no-training article: `https://privacy.claude.com/en/articles/9267385-does-anthropic-act-as-a-data-processor-or-controller`
- Anthropic Files API docs: `https://platform.claude.com/docs/en/build-with-claude/files`
- Anthropic Claude Code ZDR docs: `https://code.claude.com/docs/en/zero-data-retention`

Important source takeaways:

- Anthropic's API ZDR arrangement means customer data is not stored at rest after the API response is returned, except where needed for law or misuse enforcement.
- ZDR applies to eligible Claude APIs, especially Messages API and token counting, when the organization has the ZDR arrangement.
- ZDR is applied per organization and must be confirmed in the relevant organization/workspace; Enterprise alone should not be treated as proof that ZDR is active.
- Anthropic may still retain safety classifier results, and if a session is flagged for a usage-policy violation it may retain inputs and outputs longer.
- Some features are not ZDR-eligible, including Message Batches, Code Execution, Programmatic Tool Calling, Files API, and MCP connector.
- Some current models are not available under ZDR. Anthropic's docs currently identify Claude Fable 5 and Claude Mythos 5 as requiring 30-day retention.
- CORS is not supported for ZDR organizations, so browser code must call a backend proxy rather than the Anthropic API directly.

## Bottom Line

Having ZDR changes the risk model for the direct Anthropic Messages API path from "we must avoid sending raw client information unless tokenized" to "we can allow raw or lightly sanitized client-confidential prompts to Anthropic if the matter policy, client consent, model, and feature set are all ZDR-approved."

That is a real simplification. It means OPF/tokenization no longer has to be the primary confidentiality control for normal `client_confidential` prompts sent only to Anthropic Messages API.

But ZDR is not a general privacy shield for the chatbot. It does not cover:

- OpenAI embeddings used by `ceb_search`.
- Upstash Redis session history.
- Upstash Vector retrieval.
- Vercel runtime logs, Blob/KV, or hosting metadata.
- Clerk/auth provider data.
- CourtListener, LegiScan, OpenStates, or other public-law API query logs.
- Browser localStorage/IndexedDB token maps and chat caches.
- Anthropic Files API.
- Anthropic Message Batches.
- Anthropic Code Execution / Programmatic Tool Calling.
- Anthropic MCP connector.
- Third-party MCP servers.
- Web publishers or external sites reached by web fetch/search-like workflows.
- The firm's own retention, litigation-hold, export, review, and billing duties.

## What Gets Easier

### 1. Ordinary Client-Confidential Inference Can Be Less Tokenized

Before ZDR, the defensible V2 posture was: tokenize client names, client facts, and identifiers before Anthropic sees them, then reconstruct locally. With ZDR, for normal attorney-client confidential work, the product can move to:

- Raw or minimally tokenized prompt to Anthropic direct Messages API.
- Strict provider/matter manifest showing the API key belonged to the ZDR-enabled organization.
- Client consent / matter policy authorizing Anthropic ZDR processing.
- No public tools unless separately approved.
- Lawyer review before relying on output.

This will likely improve answer quality. Legal analysis often depends on dates, roles, relationships, procedural posture, settlement posture, and narrative texture. Heavy tokenization can make Claude less useful because placeholders remove context.

Recommended posture:
- `public_research`: no tokenization needed unless the prompt accidentally contains client facts.
- `client_confidential`: raw or lightly tokenized direct-Anthropic prompts allowed if ZDR is verified and no disallowed tools/features are present.
- `protected_discovery`: ZDR makes Anthropic a plausible approved inference provider, but OPF and evidence controls should remain in place until counsel approves otherwise.

### 2. Provider Registry For Anthropic Becomes Much Simpler

The direct Anthropic provider entry can move from "potentially not approved unless tokenized" to "approved for client-confidential data and potentially protected-discovery data if ZDR evidence is current."

The registry should still record:

- organization id
- workspace id
- API key provenance
- ZDR status and proof
- covered models
- disallowed models
- allowed features
- disallowed features
- retention exceptions
- review date and expiry
- counsel approval for each data class

### 3. Bedrock Becomes Less Urgent

Previously Bedrock or Azure were attractive partly because Anthropic Enterprise ZDR was not assumed. If F&F now has direct Anthropic ZDR, staying on the existing direct Messages API path is likely simpler than moving inference to Bedrock.

Bedrock may still be relevant if counsel wants AWS-operated infrastructure, VPC controls, or a different procurement route, but it is no longer the obvious first remediation step.

### 4. Client Disclosure Can Be More Straightforward

The disclosure can say, after counsel review, that the chatbot uses Anthropic's ZDR-enabled API for model inference and that prompts/responses are not stored by Anthropic after the response except for legal/misuse exceptions.

That is much cleaner than explaining local tokenization as the main protection. The disclosure still needs to identify non-Anthropic providers and tools.

### 5. Sanitization Can Shift From "Mask Everything" To "Route And Guard"

Sanitization should become less about hiding all client facts from Claude and more about:

- detecting matter mode
- preventing accidental public-tool leakage
- preventing cross-provider disclosure
- preventing protected-discovery leakage into non-approved tools
- warning when facts are sensitive or protected
- creating an audit trail

In other words, the primary control becomes policy routing, not blanket redaction.

## What Does Not Get Easier

### 1. `web_search` Still Needs Gating

Anthropic's current API table lists web search as ZDR-eligible for the Anthropic side, but that does not mean client facts should be used as search queries. Search can disclose private facts through query construction, result retrieval, publisher logs, search intermediaries, or the generated record of what was searched.

V2 currently includes `WEB_SEARCH_TOOL` unconditionally in research mode. ZDR does not make that safe for confidential or protected facts.

Recommended policy:
- `public_research`: web search allowed.
- `client_confidential`: web search allowed only for lawyer-approved sanitized public-law queries.
- `protected_discovery`: broad public web search categorically blocked in v1.

### 2. CEB Search Still Sends Queries To OpenAI And Upstash

`api/_lib/tools/cebSearch.ts` currently embeds the query via OpenAI and searches Upstash Vector. Anthropic ZDR does nothing for that path.

If a prompt contains client facts and the model calls `ceb_search` with those facts in the query, the disclosure surface is OpenAI plus Upstash, not Anthropic.

Recommended policy:
- Add a `toolQueryGuard` before `ceb_search`.
- Permit only public-law/citation/statute-style queries by default.
- For protected matters, either use citation-only queries, tokenize queries with quality caveats, or move embeddings to an approved ZDR/equivalent provider.
- Consider an Anthropic-native or local embedding alternative only if its retention posture is approved.

### 3. MCP Connector Is Still A No-Go For Confidential/Protected Work

Anthropic's feature table currently marks the MCP connector as not ZDR-eligible. The repo already has comments saying MCP is not ZDR-eligible and retained on Anthropic's side under the prior Team-plan posture.

Recommended policy:
- Keep MCP disabled for `client_confidential` unless counsel explicitly approves a particular MCP provider and data class.
- Keep MCP categorically blocked for `protected_discovery` v1.
- Prefer in-process tools that the chatbot executes and audits itself.

### 4. Files API, Batches, Code Execution, And Programmatic Tool Calling Stay Out

Anthropic's docs mark these as not ZDR-eligible:

- Files API
- Message Batches
- Code Execution
- Programmatic Tool Calling

The chatbot should not use these for confidential or protected material unless a later provider contract and registry entry explicitly approve them. Inline PDF support through Messages API is a different path and can be ZDR-eligible, but the product should be careful not to silently switch to Files API.

### 5. Fable 5 Is Out; Opus Becomes The Planned Model

Current V2 code defaults research/draft workflows to:

- `V2_PRIMARY_MODEL` or `claude-fable-5`
- fallback `claude-opus-4-8`
- quick/verifier paths on Sonnet 4.6

Anthropic's current API retention docs say Claude Fable 5 and Claude Mythos 5 require 30-day retention and are not available under ZDR. F&F has decided not to use Fable for the chatbot and to use Opus instead. That resolves the biggest model-retention conflict, but the code/config still needs to enforce the decision so a future default or fallback cannot silently reintroduce a non-ZDR model.

Recommended change:
- Set `V2_PRIMARY_MODEL` for confidential/protected deployments to the approved Opus model.
- Set `V2_FALLBACK_MODEL` only to the same approved Opus model or another counsel-approved ZDR-eligible Opus-family fallback.
- Add a `zdr_eligible_models` registry and CI/runtime assertion.
- Fail closed if a protected/confidential matter attempts to use a Covered Model requiring retention.
- Remove Fable from confidential/protected app configuration and docs. If anyone later wants Fable for public/non-confidential workflows, it should be a separate explicit product decision, not a fallback.

### 6. Vercel, Upstash, Browser Storage, And Audit Logs Still Matter

V2 persists user/assistant messages in Upstash session storage and keeps local browser state. Even if Anthropic stores nothing, the app itself stores content.

Recommended policy:
- For `client_confidential`, keep server-side session storage only if F&F has approved Upstash/Vercel retention and security.
- For `protected_discovery`, use the compliance manifest/WORM or hash-chain evidence plan and matter-scoped retention.
- Keep raw protected text out of ordinary logs.
- Keep browser token maps and local caches matter-scoped with litigation-hold treatment.

### 7. ZDR Does Not Remove Lawyer Review Duties

COPRAC duties do not disappear because the provider has ZDR. Lawyers still need:

- competence
- confidentiality judgment
- client communication/consent where required
- supervision
- citation verification
- court AI disclosure checks
- billing controls
- bias/discrimination controls
- independent judgment

ZDR primarily helps confidentiality and provider-retention risk. It does not solve accuracy, hallucination, candor, fee, supervision, or unauthorized-practice risks.

## Sanitization Strategy After ZDR

### Old Model

Sanitization was the primary defense:

1. Browser detects sensitive spans.
2. Browser tokenizes.
3. Server sends tokenized prompt to Anthropic.
4. Server reconstructs or displays with local map.

This reduced disclosure to Anthropic but made quality and server policy harder. In particular, once the browser tokenizes, the server may not know what categories were originally present.

### New Model

Sanitization becomes a routing and containment layer:

1. Browser and server detect data class and matter mode.
2. Server chooses policy based on ZDR provider registry, matter mode, consent, and tool availability.
3. For direct Anthropic Messages API under ZDR, raw or lightly tokenized `client_confidential` prompts may be allowed.
4. Before any tool call, `toolQueryGuard` checks the exact query.
5. For non-Anthropic tools, protected tools, or non-ZDR features, tokenization or blocking still applies.

Recommended mode matrix:

| Mode | Direct Anthropic ZDR inference | OPF/tokenization | Web search | CEB/OpenAI embeddings | MCP | Files/Batches/Code Execution |
| --- | --- | --- | --- | --- | --- | --- |
| `public_research` | Allowed | Off unless sensitive facts detected | Allowed | Allowed for public-law queries | Optional if public and approved | Avoid unless approved |
| `client_confidential` | Allowed after ZDR verification and consent | Light/default optional; strict for high-risk categories | Sanitized lawyer-approved public-law queries only | Guarded; no client-fact queries unless provider approved | Block by default | Block |
| `protected_discovery` | Potentially allowed if counsel approves Anthropic ZDR for protected data | Strict or matter-policy controlled | Block | Citation-only/tokenized/approved provider only | Block | Block |

## Concrete V2 Change Delta

The COPRAC compliance plan remains directionally right, but ZDR changes the priority order and a few controls.

### Priority 0: Verify ZDR Is Actually Active

Before changing sanitizer behavior, verify:

- F&F's Anthropic organization has ZDR enabled.
- The chatbot's `ANTHROPIC_API_KEY` belongs to that ZDR-enabled organization.
- The production Vercel environment uses that key and no legacy fallback key.
- The API key is not from a personal, Team, non-ZDR, or developer account.
- The relevant workspace has no 30-day retention override unless intentionally used for non-confidential work.
- Claude Console privacy controls show ZDR for the workspace/org.
- F&F has written terms or account-team confirmation suitable for provider registry evidence.

### Priority 1: Replace Fable 5 Defaults With Opus

Required code/config changes:

- Set confidential/protected `V2_PRIMARY_MODEL` to the approved ZDR-eligible Opus model.
- Set confidential/protected `V2_FALLBACK_MODEL` to the same approved Opus model or remove fallback for those modes.
- Add model-policy logic: matter mode determines allowed model family.
- Add a runtime ZDR eligibility check before Anthropic calls.
- Update comments in `api/_lib/agentLoop.ts` that currently say Fable and Opus have the same retention posture.
- Add tests proving protected/confidential matters cannot use non-ZDR models.

### Priority 2: Relax OPF Only For Direct Anthropic ZDR, Not Globally

Change from "all confidential facts must be tokenized" to:

- Direct Anthropic ZDR path: raw or lightly tokenized allowed for `client_confidential`.
- Direct Anthropic ZDR protected path: allowed only after counsel approval and protected-mode evidence controls.
- Non-Anthropic provider paths: keep strict tokenization or block.
- Tool queries: still guarded.
- Logs/session storage: still controlled.

### Priority 3: Restore Policy-Based Tool Gating

ZDR increases confidence in Anthropic inference, but does not justify unconditional tool exposure.

Required changes:

- Replace `buildToolsArray(privileged)` with `buildToolsForPolicy(policyDecision)`.
- Do not include web search in protected mode.
- Do not include MCP connector in confidential/protected modes unless separately approved.
- Add per-tool provider metadata.
- Add exact-query `toolQueryGuard`.

### Priority 4: Provider Registry Changes

Add an Anthropic provider registry entry like:

```yaml
provider_id: anthropic_direct_zdr
service: Claude Messages API
org_id: TBD
workspace_id: TBD
zdr_enabled: true
evidence:
  - Anthropic account-team confirmation
  - Console privacy controls screenshot/export
  - commercial agreement / DPA clause
allowed_modes:
  - public_research
  - client_confidential
  - protected_discovery_if_counsel_approved
allowed_features:
  - messages
  - token_counting
  - inline_pdf_support_if_messages_api
  - citations
  - search_results
  - prompt_cache
  - extended_thinking
blocked_features:
  - files_api
  - batches
  - code_execution
  - programmatic_tool_calling
  - mcp_connector
  - Fable/Mythos or any covered model requiring 30-day retention
exceptions:
  - law_enforcement_or_legal_retention
  - usage_policy_violation_retention
review_owner: TBD
review_expiry: TBD
```

### Priority 5: Update Client Disclosure

The disclosure should become clearer:

- "The chatbot uses F&F's Anthropic ZDR-enabled Claude API organization for model inference."
- "Prompts and responses sent to eligible Claude API features are not stored by Anthropic after the response, except for legal/misuse exceptions."
- "The chatbot may also use other providers for search, embeddings, authentication, hosting, and storage; those are governed separately."
- "Public web search and third-party retrieval tools are disabled or restricted when client-confidential or protected-discovery material is present."

Do not say:

- "Nothing is ever stored."
- "ZDR means no sanitization is needed."
- "Protected discovery is automatically safe."
- "All Claude Enterprise use is ZDR."

## Updated Answer To The Sanitization Question

Yes, ZDR makes sanitization much easier for the Anthropic inference path.

For normal client-confidential attorney work, the product can probably stop treating OPF as the main protection against Anthropic retention and instead use ZDR plus matter policy plus client consent as the primary control. That should improve answer quality and reduce annoying redaction artifacts.

But sanitization remains necessary as:

1. A classifier for matter mode and sensitivity.
2. A guardrail before public web search.
3. A guardrail before OpenAI embeddings / CEB search.
4. A guardrail before CourtListener, LegiScan, OpenStates, MCP, or any external tool query.
5. A protected-discovery containment layer.
6. A logging/session-storage minimization tool.
7. An audit signal for lawyer review.

So the right product shift is:

- Less blanket tokenization before Anthropic.
- More policy-aware routing.
- More exact-query gating before tools.
- Better provider registry evidence.
- ZDR-aware model and feature allowlists.

## Recommended Implementation Sequence

1. Verify ZDR activation and API key provenance.
2. Switch production confidential/protected model defaults from Fable 5 to Opus.
3. Add `anthropic_direct_zdr` provider registry entry.
4. Add model/feature ZDR allowlist enforcement.
5. Replace tool selection with policy-based `buildToolsForPolicy`.
6. Add `toolQueryGuard` for all non-Anthropic and public-search tools.
7. Relax OPF for `client_confidential` direct-Anthropic-only calls.
8. Keep strict/protected OPF path until counsel approves raw protected-discovery inference under ZDR.
9. Update disclosure and attestation copy.
10. Add tests proving non-ZDR models/features/tools are blocked.

## Practical Conclusion

ZDR is a big win. It likely removes the need to contort ordinary client-confidential prompts through heavy OPF before Anthropic sees them, provided the chatbot uses the firm's ZDR-enabled API organization and ZDR-eligible models/features.

The hard remaining work is not hiding from Anthropic. The hard remaining work is making sure client facts do not leak sideways into web search, OpenAI embeddings, Upstash/vector/session stores, MCP, Files API, Vercel logs, local caches, exports, or unsupervised attorney-facing workflows.
