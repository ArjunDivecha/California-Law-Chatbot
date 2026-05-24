# PRD: Morgan Protective-Order Compliance Layer for V2

**Date:** 2026-05-21  
**Status:** Draft for F&F/Rachel review  
**Target branch:** `V2`  
**Primary product:** California Law Chatbot V2  
**Primary legal trigger:** `Morgan v. V2X, Inc.`, Civil Action No. 25-cv-01991-SKC-MDB (D. Colo. Mar. 30, 2026)  
**Owner:** Arjun  
**Required reviewers before build-complete:** Rachel/compliance counsel, F&F partner, implementation lead  

This PRD defines the product, backend, audit, and governance changes required for V2 to support Morgan-style use of AI with confidential litigation material and protective-order material. It assumes the current V2 substrate: local GLiNER tokenization, browser-held token map, Anthropic Team plan without ZDR, HMAC-only audit records, server-side wire guard, tool-output sanitization, and the May 13 decision that ordinary V2 use keeps `web_search` available while surfacing privilege detection as attorney-facing telemetry.

This is a product and engineering plan, not legal advice. The final policy language, client disclosures, and protective-order representations require attorney sign-off.

Reviewer note for M0:

- The direct-Anthropic assumption must be confirmed against the production route before provider records are approved. The V2 agent routes currently use `api/_lib/agentLoop.ts` / `api/_lib/agentProxy.ts` and call `anthropic.messages.*` with `ANTHROPIC_API_KEY`, while legacy OpenRouter/Gemini endpoints still exist in the repo and stale references remain in `CLAUDE.md`.
- If any protected-discovery traffic can reach OpenRouter, Google GenAI, Bedrock, or any other inference intermediary, that intermediary must be added as a first-class provider in FR2 and the Compliance Pack. The protected-discovery release must also block legacy endpoints unless they satisfy the same provider-registry standard.

---

## 1. Executive Summary

V2 is already much stronger than V1 for client-confidential use because it sends tokenized prompts to Anthropic rather than raw identifiers. However, Morgan creates a stricter product requirement for material designated `CONFIDENTIAL` under a protective order:

1. The system must not input, upload, submit, process, or store protected confidential information in an AI platform unless approved contractual safeguards exist.
2. The system must be able to document which AI tools/providers were used.
3. The system must preserve written documentation of provider safeguards, deletion rights, disclosure limits, and chain-of-custody evidence.
4. The attorney must remain the legal decision-maker and must review AI outputs before use in client advice or court filings.

The PRD therefore adds a new compliance layer on top of V2:

- Matter/session classification: `public_research`, `client_confidential`, `protected_discovery`.
- Provider contract registry and runtime gating.
- Hard protected-discovery tool policy that overrides ordinary V2 attorney-agency mode.
- Provider-chain audit manifest per turn.
- Morgan Compliance Pack export per matter/session.
- Updated disclosure and attorney-review gates.
- Compound-risk seed-list upgrade and protected-content classifier beyond classic PII.
- CI/e2e proof that protected-discovery mode fails closed.

Core product principles:

> Ordinary V2 can preserve attorney agency. Protected-discovery V2 must preserve court-order compliance.

> For protected-discovery use, provider contract compliance is the primary control. Tokenization is defense-in-depth, not a substitute for the provider/legal safeguard.

---

## 2. Source Background

### 2.1 Morgan requirement

Morgan approves AI use in litigation only if confidential information is not entrusted to AI platforms lacking specific contractual safeguards. The order also compelled disclosure of AI tool identity where the AI tool had been used with confidential material. Kirkland's alert summarizes the adopted provision as requiring contractual bars on model training/use, limits on third-party disclosure, deletion/removal rights, and retained written documentation.

Engineering implication:

- V2 cannot treat "sanitized enough" as the only compliance control for protected discovery.
- V2 needs a mode that proves the provider and tool path were approved for the matter before use.
- V2 must assume tool identity and provider chain may be discoverable.

### 2.2 California lawyer obligations

California State Bar guidance treats generative AI as a technology lawyers may use only in a manner consistent with professional obligations. It flags confidentiality, technology competence, client communication, independent professional judgment, candor to tribunals, and review of AI-generated outputs before submission.

Engineering implication:

- V2 needs attorney-facing decision points and review records, not just background model controls.
- Any generated court-facing output needs a review attestation separate from the machine compliance attestation.

### 2.3 Current V2 posture

Current V2 strengths:

- Local GLiNER tokenization runs before prompt text reaches Vercel or Anthropic.
- If the local daemon is unreachable, V2 fails closed.
- Token map is stored in browser IndexedDB, not server-side.
- Server-side wire guard rejects deterministic raw PII leakage.
- Tool-output sanitization redacts returned tool results before reintroduction into the agent loop.
- Audit records use HMAC/metadata, not raw prompt text.
- 120-trap zero-wire-leak runs are documented.

Current V2 gaps for Morgan-grade protected-discovery compliance:

- `web_search` is always included in ordinary V2 after the May 13 addendum.
- Provider-chain metadata is not yet first-class per turn.
- Provider contractual evidence is not a runtime gate.
- Disclosure modal is soft and stale relative to V2.
- No matter-level `protected_discovery` classification exists.
- Compound-risk detection is minimum viable and needs a firm matter-pattern seed list.
- Protected facts and strategy can be confidential even when they are not classic PII.
- Morgan-ready export packet is not yet implemented.
- The current HMAC/KV audit posture is not enough by itself for long-term court evidence; protected-discovery artifacts need WORM-grade storage and signed integrity checkpoints.
- Local browser token maps create a litigation-hold/spoliation question for protected matters because the rehydration map may be discoverable but is intentionally not centrally recoverable.

---

## 3. Compliance Posture and Product Modes

V2 will support three compliance modes. Each mode must be explicit in UI, stored in session metadata, included in every audit record, and visible in the Morgan Compliance Pack.

### 3.1 `public_research`

Use case:

- General legal research.
- Public statutes, cases, CEB summaries, legislative updates.
- No client facts, no confidential matter facts, no protected discovery.

Runtime policy:

- Broad web search allowed.
- Approved public legal-data tools allowed.
- No Morgan Compliance Pack required, but basic audit still runs.

### 3.2 `client_confidential`

Use case:

- Real client work where the attorney is relying on V2's local tokenization boundary.
- No material designated confidential by a court protective order unless attorney explicitly switches to `protected_discovery`.

Runtime policy:

- Local tokenization is mandatory and fail-closed.
- Server wire guard is mandatory.
- Tool-output sanitization is mandatory.
- `web_search` may remain available as ordinary V2 attorney-agency behavior, but UI must warn when privilege/compound-risk signals fire.
- Per-turn provider-chain audit is required.
- Attorney review attestation required before court filing or external client deliverable export.
- If the protected-content classifier detects protective-order labels, attorney-eyes-only language, confidential exhibit text, or other high-confidence protected-discovery indicators, the turn must force escalation to `protected_discovery` or block. It may not remain a mere warning.

### 3.3 `protected_discovery`

Use case:

- Any material designated `CONFIDENTIAL`, `HIGHLY CONFIDENTIAL`, protected health/personnel/financial material, trade secret, or material governed by an AI-specific protective order.
- Any session where the attorney wants Morgan-style compliance evidence.

Runtime policy:

- Hard fail-closed if matter lacks approved provider contract records.
- Hard fail-closed if local tokenization daemon unavailable.
- Hard fail-closed if provider registry says any outbound provider lacks required safeguards.
- Broad public `web_search` disabled categorically in the protected-discovery v1 scope.
- MCP providers disabled by default unless approved for the matter.
- Tool set is allowlisted per matter.
- No raw protected-document excerpts may leave the trusted boundary unless the matter policy explicitly permits it and the provider registry allows it.
- Attorney approval required before first protected-discovery turn and before any external provider/tool call that is not purely local.
- Morgan Compliance Pack generated automatically at session end and exportable on demand.

Protected-discovery mode does not replace attorney judgment; it sets a minimum court-order compliance floor.

### 3.4 Turn-Level Escalation and Refusal States

Matter mode is a default, not the only enforcement point. V2 must also support turn-level escalation.

Escalation rules:

- A `public_research` turn that includes client facts escalates to `client_confidential` or blocks.
- A `client_confidential` turn that includes protected-discovery indicators escalates to `protected_discovery` or blocks.
- A `protected_discovery` turn that lacks approved provider contracts, approved tools, or required attorney approval blocks before model/tool invocation.

Terminal outcomes:

- `allowed`: request proceeds under the active mode.
- `requires_escalation`: user must move the turn/session to a stricter mode.
- `requires_approval`: attorney must approve a specific provider/tool action.
- `local_only`: V2 may process only within the trusted browser/local boundary and cannot call external model/search providers.
- `blocked`: V2 refuses to process the turn.

Certain material, including `HIGHLY CONFIDENTIAL`, `ATTORNEYS' EYES ONLY`, trade-secret source material, or court-order terms that bar third-party AI processing, may be `local_only` or `blocked` even when the matter is already in `protected_discovery`.

### 3.5 Enforcement Decision Table

This table is the implementation source of truth for the runtime policy engine.

| Current mode | Signal | Default outcome | External model/search allowed? | Required user action |
|---|---|---|---|---|
| `public_research` | No client facts, no protected indicators | `allowed` | Yes, ordinary public tool policy | None |
| `public_research` | PII/high-risk client facts detected | `requires_escalation` | No, until escalated | Move to `client_confidential` or remove client facts |
| `public_research` | Protective-order label, confidential exhibit, AEO/HCO label, or protected-content classifier hard gate | `requires_escalation` | No | Move to `protected_discovery` or remove protected content |
| `client_confidential` | Tokenized PII/high-risk spans only | `allowed` | Yes, ordinary V2 attorney-agency policy | Acknowledge warnings if UI requires |
| `client_confidential` | Compound-risk buckets without protected-content hard gate | `allowed` with warning | Yes, ordinary V2 attorney-agency policy | Attorney judgment; warning recorded |
| `client_confidential` | Protected-content classifier hard gate | `requires_escalation` | No, until escalated | Move to `protected_discovery`, rewrite, or abandon |
| `client_confidential` | AEO/HCO or provider-forbidden protected substance | `local_only` or `blocked` | No | Local-only handling or no V2 processing |
| `protected_discovery` | Approved provider snapshot, approved tools, local sanitizer healthy | `allowed` | Yes, only allowlisted providers/tools | Matter-level approval must already exist |
| `protected_discovery` | Provider registry missing, stale, or insufficient for the routed data class | `blocked` | No | Update provider evidence or use local-only path |
| `protected_discovery` | Broad public `web_search` requested | `blocked` | No | Remove tool; use only approved citation/search providers if policy allows |
| `protected_discovery` | MCP/search provider not matter-approved | `blocked` | No | Remove tool or approve provider |
| `protected_discovery` | Local sanitizer/wire guard unavailable | `blocked` | No | Restore local daemon/wire guard |
| `protected_discovery` | Audit/WORM write unavailable for protected turn | `local_only` or `blocked` | No external model/search | Restore evidence store or use local-only |

The M0.5 legal answer on provider standards must be a configuration input to this table, not a schema rewrite.

### 3.6 Protected-Discovery V1 Product Scope

The initial protected-discovery product is intentionally narrower than ordinary V2. It is a court-order compliance mode, not a full research mode.

Enabled in v1:

- Tokenized prompt drafting, summarization, issue spotting, and analysis through approved model providers only.
- Local GLiNER/token-map workflow and server wire guard.
- Approved citation/statute/case queries that contain no protected substance.
- Compliance Pack generation, provider-chain manifest, and attorney attestation.
- Local-only handling for matters where provider contracts, WORM storage, or audit requirements are not yet approved.

Disabled in v1:

- Broad public `web_search` in protected-discovery mode, even with per-turn attorney approval.
- MCP/search providers that are not matter-approved.
- Raw protected-substance embedding queries.
- Retrieval that requires sending protected facts to an unapproved embedding/vector/search provider.

Degraded by design:

- CEB/vector retrieval in protected-discovery mode may run only on citation/statute-only queries, tokenized queries, or an approved protected-discovery embedding provider. Tokenized semantic retrieval may have lower recall; the UI must label this as a protected-mode limitation rather than silently pretending ordinary CEB search quality applies.

This v1 scope is still useful because it gives attorneys a defensible protected drafting and analysis workspace. A broader research experience can be added only after provider evidence, embeddings, search, and MCP providers clear the protected-discovery registry standard.

---

## 4. Goals

1. Make V2 court-defensible under Morgan-style protective-order language.
2. Preserve V2's existing local-tokenization advantage.
3. Give attorneys a clear mode switch when a matter involves protected discovery.
4. Prevent accidental use of unapproved providers/tools with protected material.
5. Produce a matter/session export that answers "what AI tool did you use and what protections existed?"
6. Update attorney-facing disclosure and review workflows for V2's real architecture.
7. Add tests that prove protected-discovery mode fails closed.
8. Define a minimum viable protected-discovery compliance floor that can ship before the full admin/compliance suite.

---

## 5. Non-Goals

1. No claim that V2 makes AI output legally correct.
2. No claim that Morgan is binding law in California.
3. No replacement for protective-order negotiation or attorney review.
4. No requirement to obtain ZDR for ordinary `client_confidential` use, though provider policy must still be documented.
5. No general central recovery of the browser token map. Protected-discovery matters require a separate legal decision on encrypted hold/export of token maps or frozen rehydrated outputs.
6. No broad rewrite of the existing agent loop unless required for gating.
7. No use of hosted Managed Agents for protected-discovery workflows.

---

## 6. User Stories

### 6.1 Attorney starts a protected matter

As an attorney, I need to classify a matter as `protected_discovery` so that V2 automatically applies stricter provider and tool controls.

Acceptance criteria:

- Matter creation UI includes a required "Material type" selector.
- `protected_discovery` selection shows a concise Morgan-style warning.
- User cannot continue until the matter has approved provider policy records.
- Session metadata stores `matter_id`, `matter_mode`, `protective_order_id`, and provider policy snapshot hash.

### 6.2 Attorney uses normal client-confidential V2

As an attorney, I need to use V2 for client work with tokenization, while retaining control over web search where no protective order applies.

Acceptance criteria:

- `client_confidential` sessions show local tokenization status and provider-chain disclosure.
- Privilege/compound-risk signals appear as warnings.
- `web_search` remains available unless the matter or admin policy disables it.
- Attorney can export a basic provider manifest and review attestation.

### 6.3 Attorney sends protected discovery through V2

As an attorney, I need V2 to block any unapproved outbound provider/tool path when protected material is present.

Acceptance criteria:

- If provider registry is missing or stale, V2 blocks the turn.
- If broad public `web_search` is attempted or present in the protected-discovery tool list, V2 blocks the turn before model invocation.
- If local tokenizer/wire guard fails, no outbound request is sent.
- The audit record captures the block reason.

### 6.4 Attorney exports Morgan Compliance Pack

As an attorney, I need a signed packet showing which AI tools/providers were used, what protections existed, and what the system did.

Acceptance criteria:

- Export is available from matter/session UI.
- Export includes JSON as the source of truth and PDF as a human-readable rendering.
- JSON verifies via a standalone CLI.
- Export includes provider-chain manifest, contract records, deletion rights, model/tool list, audit anchors, sanitized prompt HMACs, redaction counts, and final-output hashes.

### 6.5 Compliance reviewer updates provider records

As a compliance reviewer, I need to add/update provider contract evidence so protected mode can rely on current records.

Acceptance criteria:

- Provider registry supports reviewer, source URL/document path, retrieval date, effective date, expiration/review date, and approval scope.
- Protected mode refuses stale provider records.
- Changes are versioned and signed or hash-anchored.

### 6.6 Attorney reviews output before use

As an attorney, I need to mark AI output as reviewed before exporting a client-facing or court-facing document.

Acceptance criteria:

- Export flow prompts for lawyer-review attestation.
- Review record includes user, timestamp, output hash, purpose, and optional notes.
- Review record is separate from machine compliance attestation.

---

## 7. Functional Requirements

### FR1. Matter Classification

Add first-class matter/session mode support.

Data fields:

```ts
type MatterMode = 'public_research' | 'client_confidential' | 'protected_discovery';

interface MatterPolicy {
  matter_id: string;
  title: string;
  mode: MatterMode;
  protective_order_id?: string;
  protective_order_label?: string;
  allowed_provider_policy_snapshot_sha256: string;
  allowed_tools: string[];
  web_search_policy: 'allowed' | 'blocked' | 'requires_per_turn_approval';
  mcp_policy: 'blocked' | 'approved_only';
  created_by: string;
  created_at: string;
  updated_at: string;
  schema_version: 1;
}
```

`web_search_policy` is a mode-general field. In protected-discovery v1, the runtime policy overrides it to `blocked` for broad public `web_search` even if an old or lower-mode policy record contains another value. For matters in `protected_discovery`, schema validation should reject `'allowed'` at write time; the field exists only to support per-turn approval or explicit block in lower modes.

Matter ID and mode-mutability rules:

- Matter IDs are server-issued ULIDs created by an authenticated user with matter-create permission.
- Matter mode may be escalated upward (`public_research` → `client_confidential` → `protected_discovery`) at any time and produces a versioned policy record.
- Matter mode may not be de-escalated. Once a matter is `protected_discovery`, it remains so for the audit lifecycle; spinning up a new matter is required if the attorney wants a lower-classification workspace.
- Matter records are append-only; updates produce a new versioned record with a `previous_version_sha256` link.
- Existing V2 sessions and matters created before this feature ships default to `client_confidential` on first read and require explicit user action to escalate. No retroactive Compliance Pack generation is required for pre-feature sessions; their audit records remain available but are marked `pre_morgan_layer = true`.

Storage:

- `matter:{id}:policy`
- `user:{userId}:matters`
- `session:{id}:meta.matter_id`
- `session:{id}:meta.matter_mode`
- `session:{id}:meta.policy_snapshot_sha256`

### FR2. Provider Contract Registry

Create a machine-readable registry for every outbound provider/subprocessor that may receive user prompt text, sanitized prompt text, tool query text, tool output, audit metadata, identity data, or vector queries.

Initial providers:

- Anthropic Messages API.
- Anthropic web_search tool.
- OpenAI embeddings API.
- Upstash Redis/KV.
- Upstash Vector.
- Vercel hosting/functions/logging.
- Any observability or error-reporting provider that may receive prompt/response excerpts, request bodies, or stack traces (for example Sentry, Datadog, LogRocket). Each must be registered separately even if currently configured to scrub bodies.
- Clerk authentication.
- CourtListener / Free Law Project.
- LegiScan.
- OpenStates.
- CEB corpus/vector content.
- Any future MCP provider.

Registry shape:

```ts
type ProviderDataClass =
  | 'raw_client_text'
  | 'protected_substance'
  | 'tokenized_prompt'
  | 'tool_query'
  | 'tool_output'
  | 'audit_metadata'
  | 'identity_metadata'
  | 'vector_query'
  | 'embedding_query'
  | 'source_document'
  | 'compliance_metadata';

interface ProviderPolicyRecord {
  provider_id: string;
  display_name: string;
  service_type: 'model' | 'embedding' | 'search' | 'mcp' | 'storage' | 'auth' | 'hosting' | 'logging';
  allowed_modes: MatterMode[];
  allowed_data_classes: ProviderDataClass[];
  no_training_status: 'contractual_yes' | 'policy_yes' | 'unknown' | 'no';
  retention_summary: string;
  deletion_rights: 'contractual_yes' | 'policy_yes' | 'unknown' | 'no';
  third_party_disclosure_summary: string;
  subprocessors_bound: 'contractual_yes' | 'policy_yes' | 'unknown' | 'no';
  subprocessors: Array<{ name: string; purpose: string; data_classes: ProviderDataClass[] }>;
  data_residency_summary: string;
  processing_locations: string[];
  breach_notification: 'contractual_yes' | 'policy_yes' | 'unknown' | 'no';
  audit_rights: 'contractual_yes' | 'policy_yes' | 'unknown' | 'no';
  structured_retention: Array<{ data_class: ProviderDataClass; retention: string; deletion_method: string }>;
  model_or_endpoint_versions: string[];
  protected_discovery_approved: boolean;
  approval_scope: string;
  evidence_refs: ProviderEvidenceRef[];
  reviewed_by: string;
  reviewed_at: string;
  expires_at: string;
  schema_version: 1;
}

interface ProviderEvidenceRef {
  kind: 'contract' | 'dpa' | 'privacy_doc' | 'trust_center' | 'email_confirmation' | 'protective_order' | 'internal_memo';
  title: string;
  url_or_path: string;
  retrieved_at?: string;
  effective_date?: string;
  sha256?: string;
  notes?: string;
}
```

Protected-discovery gate:

- Gate strictness is data-class-aware.
- Providers receiving `raw_client_text`, `protected_substance`, `tokenized_prompt`, `embedding_query`, or protected `tool_query` data must have `protected_discovery_approved = true`.
- `no_training_status` must be `contractual_yes` for protected substance or raw protected text. Counsel may explicitly approve `policy_yes` only for tokenized-only or public-data paths.
- `deletion_rights` must be `contractual_yes` or counsel-approved equivalent for protected data classes.
- `subprocessors_bound` must not be `unknown` for protected data classes.
- `expires_at` must be in the future.

Important classification:

- Embedding queries are model-provider-equivalent exfiltration paths. A protected prompt sent to any embeddings provider must clear the same provider-record standard as other AI/model calls.
- Protected-discovery v1 must not send raw protected substance to OpenAI embeddings. It may use OpenAI embeddings only for citation/statute-only queries, tokenized queries with attorney-visible recall caveats, or another scope explicitly approved in the provider registry and matter policy.
- Public-source lookups such as CourtListener may have a lower bar only when the query is public/statutory/citation-only and contains no protected substance.

### FR3. Runtime Policy Engine

Add a central policy engine used by all V2 model/tool routes.

API:

```ts
interface RuntimePolicyDecision {
  outcome: 'allowed' | 'requires_escalation' | 'requires_approval' | 'local_only' | 'blocked';
  mode: MatterMode;
  blocked_reason?: string;
  escalation_target?: MatterMode;
  allowed_tools: string[];
  allowed_providers: string[];
  policy_snapshot_sha256: string;
  requires_attorney_approval: boolean;
  warnings: string[];
}

function evaluateRuntimePolicy(input: {
  user_id: string;
  session_id: string;
  matter_policy: MatterPolicy;
  provider_registry: ProviderPolicyRecord[];
  requested_tools: string[];
  detected_privileged: boolean;
  compound_risk_buckets: number;
  outbound_data_classes: ProviderDataClass[];
}): RuntimePolicyDecision;
```

Protected-discovery behavior:

- Block if provider registry is unavailable.
- Block if any requested tool maps to an unapproved provider.
- Block if broad public `web_search` is present in protected-discovery mode.
- Block if MCP toolsets are present and not matter-approved.
- Block if attorney approval is required and no approval record exists.
- Block if local sanitization status is stale/unavailable.
- Force escalation if a lower-mode turn contains high-confidence protected-discovery indicators.
- Return `local_only` or `blocked` if the protective-order label or provider registry forbids external processing entirely.

### FR4. Protected-Discovery Tool Builder

Refactor `buildToolsArray(...)` so tool availability depends on `MatterPolicy`, not only `privileged`.

Proposed API:

```ts
interface BuildToolsOptions {
  mode: MatterMode;
  matterPolicy: MatterPolicy;
  providerPolicySnapshot: ProviderPolicyRecord[];
  detectedPrivileged: boolean;
}

function buildToolsArray(options: BuildToolsOptions): ToolDefinition[];
```

Rules:

- `public_research`: current broad tool behavior allowed.
- `client_confidential`: current ordinary V2 behavior allowed unless admin/matter policy disables tools.
- `protected_discovery`: only allow `allowed_tools` from matter policy and provider registry.
- Do not rely on prompt instructions for protected-discovery restrictions.
- Tests must assert broad public `web_search` is absent in protected-discovery mode.

### FR5. Protected-Content Classifier

Add a second classification layer beyond classic PII/tokenization.

Purpose:

- Identify content that is confidential even after names/addresses/dates are tokenized.
- Flag or block protected-document excerpts, settlement posture, strategy, internal investigation summaries, personnel details, trade secrets, medical/financial specifics, and unique matter combinations.

Signals:

- Existing GLiNER spans.
- Existing regex high-risk categories.
- Compound-risk buckets.
- F&F matter-pattern seed n-grams.
- Protected-order document labels.
- User-selected matter mode.
- Uploaded-document source metadata.
- Phrases such as "produced under protective order", "confidential exhibit", "attorney eyes only", "settlement demand", "internal investigation", "trade secret", "personnel file", "medical record".

Output:

```ts
interface ProtectedContentAnalysis {
  contains_protected_content: boolean;
  protected_categories: string[];
  confidence: number;
  explanation_codes: string[];
  requires_hard_gate: boolean;
}
```

Protected-discovery behavior:

- If `contains_protected_content` and provider policy is not approved, block.
- If classifier confidence is low but mode is protected, require attorney confirmation before any outbound call.

### FR6. F&F Compound-Risk Seed List

Add a versioned seed-list mechanism.

Requirements:

- Counsel can provide sanitized matter-pattern seed n-grams without raw client names.
- Seeds are versioned, reviewed, and hash-addressed.
- Trap manifest includes seed-derived cases.
- Seed-list updates require two consecutive zero-wire-leak runs before production enablement.

Data:

```ts
interface CompoundSeedSet {
  id: string;
  version: number;
  description: string;
  seeds: Array<{
    label: string;
    ngrams: string[];
    category: string;
    risk_weight: number;
  }>;
  reviewed_by: string;
  reviewed_at: string;
  sha256: string;
}
```

### FR7. Provider-Chain Audit Manifest

Extend audit logging and session metadata to record provider/tool identity in a discoverable, export-ready form.

Per turn:

```ts
interface ProviderChainManifest {
  manifest_version: 1;
  session_id: string;
  turn_id: string;
  matter_id?: string;
  matter_mode: MatterMode;
  policy_snapshot_sha256: string;
  providers: Array<{
    provider_id: string;
    display_name: string;
    service_type: string;
    model_or_endpoint?: string;
    data_classes: ProviderDataClass[];
    policy_record_sha256: string;
  }>;
  tools: Array<{
    tool_name: string;
    provider_id: string;
    enabled: boolean;
    reason: string;
  }>;
  created_at: string;
}
```

Storage:

- Store manifest hash in daily audit record.
- Store full manifest under `session:{id}:provider_manifest:{turn_id}` or a compact equivalent.
- Include manifest in Morgan Compliance Pack.

### FR8. Morgan Compliance Pack

Create `/v2/compliance/:matterId` UI and export endpoints.

Export contents:

- Matter/session identifiers.
- Matter classification history.
- Protective order metadata.
- Provider-chain manifest.
- Provider contract/evidence bundle.
- Negative enforcement evidence: blocked turns, omitted tools, stale-provider blocks, and approval denials.
- Tool list and enabled/disabled reasons.
- Sanitization summary: redaction counts, categories, compound buckets, detector versions, trap-suite version.
- HMAC-only prompt evidence and audit-log anchors.
- Final-output hashes. Under `no_server_map`, these must be client-computed and submitted because the raw rehydrated output is not durably persisted server-side unless encrypted under counsel-controlled keys.
- Source/tool-call hashes.
- Attorney approval records.
- Lawyer-review attestations.
- Deletion-request records.
- Human-readable explanation of V2 tokenization architecture.
- Limitations section that states what the pack proves and does not prove.

Disclosure tiers:

- Internal pack: may include richer metadata for F&F/counsel, still without raw protected text by default.
- External/disclosable pack: strips or generalizes metadata that could reveal work product, including seed-list labels, fine-grained protected categories, internal explanation codes, and privileged review notes.
- Raw appendix: excluded by default. If counsel decides raw protected text must be included, it is generated as a separate privileged appendix with explicit approval and hold controls.

Formats:

- Signed JSON: legally binding source artifact.
- PDF: human-readable rendering.
- Optional ZIP: JSON + PDF + provider evidence PDFs/markdown + verifier CLI.

Endpoint sketches:

```http
GET /api/compliance/matters/:matterId/pack
POST /api/compliance/matters/:matterId/pack
GET /api/compliance/sessions/:sessionId/pack
POST /api/compliance/verify-pack
```

Acceptance:

- Export verifies offline with `verify-compliance-pack`.
- Export never contains raw prompt text unless explicitly included by attorney after legal review.
- Export includes every provider that received any outbound data class.
- Export has a "pack leak" test suite proving no protected trap strings appear in external/disclosable output.

Signature and trust root:

- Compliance Pack JSON is signed with an Ed25519 key under counsel-controlled custody (see M0.5).
- Each pack embeds the signing key's fingerprint, key version, and issuance date.
- The corresponding public-key bundle is published at a versioned, immutable location (for example `https://compliance.<firm-domain>/keys/{fingerprint}.pub`) and is also embedded in the `verify-compliance-pack` CLI binary at release time. The CLI verifies against the embedded bundle by default and rejects keys it does not recognize unless invoked with `--trust-fetched` and an explicit fingerprint.
- Key rotation produces a new fingerprint; superseded keys are retained in the public bundle with a `valid_until` date so older packs continue to verify.

### FR9. Deletion and Litigation-Hold Workflow

Add operational workflows for Morgan-style deletion/removal rights and litigation holds.

Requirements:

- `POST /api/compliance/matters/:matterId/deletion-request`
- `POST /api/compliance/matters/:matterId/litigation-hold`
- `POST /api/compliance/matters/:matterId/release-hold`
- Log who triggered the action, why, and provider target list.
- Store provider responses/evidence.
- Matter under hold cannot be deleted from audit/attestation storage.
- Deletion request must not remove records subject to litigation hold.

Incident-response runbook:

- Confirmed protected-mode wire leak opens an incident record.
- V2 immediately disables protected-discovery external calls for the affected provider/matter.
- Compliance reviewer receives provider/tool/payload hash, policy snapshot, and affected session list.
- Counsel decides whether court, opposing counsel, client, carrier, or vendor notification is required.
- Compliance Pack marks the incident and any remediation.

Meta-discovery runbook:

- Provide a repeatable process for meet-and-confer requests about AI tool use.
- Generate the external/disclosable Compliance Pack tier.
- Log what was produced, to whom, when, and under what privilege/protective-order designation.

Token-map hold/spoliation runbook:

- For protected matters, counsel must choose one of two policies before production use:
  - `no_server_map`: token map remains browser-only; V2 does not claim durable rehydration or court-ready reconstruction if the device map is lost. Any rehydrated final output may be viewed or exported locally, but if it is persisted to server/WORM storage it must first be encrypted under counsel-controlled keys. Counsel must sign an explicit spoliation-risk acceptance before this policy can be used for protected production matters.
  - `encrypted_hold_map`: token map is exported into an encrypted, WORM-stored hold artifact under counsel-controlled keys.
- The selected policy is stored in `matter:{id}:policy` and included in Compliance Pack.

### FR10. Disclosure Modal Rewrite

Replace the current soft placeholder with a V2-accurate disclosure and optional hard gate.

Modes:

- General V2 disclosure: hard gate once per user/version.
- Matter-level protected-discovery disclosure: hard gate per protected matter.
- Tool-use approval dialog: per turn when policy says `requires_per_turn_approval`.

Required content:

- V2 uses local tokenization before outbound model calls.
- Token map stays in browser IndexedDB.
- Anthropic receives tokenized prompts in ordinary V2.
- Provider identity/tool identity may be discoverable.
- The attorney remains responsible for confidentiality, client instructions, accuracy, and review.
- Protected-discovery mode applies stricter rules than ordinary mode.
- Failure modes: lost browser data, unsupported device, sanitizer unavailable, provider policy stale.

Remove stale references to Gemini/OpenRouter/Bedrock if not active in V2.

### FR11. Lawyer Review Attestation

Add a separate lawyer-review record for client-facing/court-facing exports.

Shape:

```ts
interface LawyerReviewAttestation {
  id: string;
  user_id: string;
  matter_id?: string;
  session_id?: string;
  output_hash: string;
  reviewed_for: 'client_advice' | 'court_filing' | 'discovery_response' | 'internal_research' | 'other';
  statement_version: string;
  reviewer_statement: string;
  reviewed_at: string;
  notes?: string;
}
```

Rules:

- Required before exporting final pleading/discovery/client-advice artifacts from protected-discovery sessions.
- Optional but encouraged for client-confidential research.
- Included in Compliance Pack.

### FR12. CORS/Auth/Legacy Route Lockdown

Protected-discovery mode cannot coexist with permissive route behavior.

Requirements:

- All `/api/agent/*` and `/api/compliance/*` routes require Clerk auth.
- Session ownership check on every session/matter route.
- CORS allowlist for production and allowed preview origins only.
- No wildcard CORS on protected-discovery-capable routes.
- Legacy V1 routes cannot receive protected-discovery sessions.
- Any route that accepts attorney text must call runtime policy engine or explicitly reject protected sessions.

### FR13. Admin and Compliance UI

Add admin pages:

- `/v2/admin/providers`
- `/v2/admin/matters`
- `/v2/admin/compliance-packs`
- `/v2/admin/holds`

Capabilities:

- View provider registry and stale records.
- Upload/link evidence documents.
- Approve provider/mode/data-class combinations.
- View matter mode and tool policy.
- Generate/export Compliance Pack.
- Freeze matter under litigation hold.

Access:

- Roles are defined as Clerk organization roles and resolved server-side on every admin/compliance route.
  - `attorney`: ordinary V2 user. Can create matters, escalate matter mode, run sessions, request lawyer-review attestations, request Compliance Pack export.
  - `compliance_reviewer`: can read/write provider registry records, upload provider evidence, approve provider/mode/data-class combinations, view all matters and Compliance Packs, place and release litigation holds. Cannot delete audit records.
  - `compliance_admin`: superset of `compliance_reviewer`. Can rotate Compliance Pack signing keys, configure WORM store endpoints, and edit role assignments. Required for any destructive admin action that is not blocked by litigation hold.
- Any sensitive admin action (provider approval, key rotation, hold placement/release, deletion-request issuance) writes an audit record that includes acting user, role, before/after hashes, and reason text.
- Role escalation and assignment changes are themselves audited and visible in the Compliance Pack metadata for affected matters.

### FR14. Protective-Order Document Parser

Add a server-side parser used at matter creation to inspect uploaded protective orders or NDA-style documents and surface machine-readable obligations.

Purpose:

- Detect protective-order labels (`CONFIDENTIAL`, `HIGHLY CONFIDENTIAL`, `ATTORNEYS' EYES ONLY`, trade-secret designations).
- Detect AI-specific clauses, including no-third-party-AI, no-training, deletion/return obligations, retention windows, court-jurisdiction notice requirements.
- Detect deadlines (production windows, destruction-by dates).
- Produce a structured `ProtectiveOrderProfile` linked to the matter record.

Shape:

```ts
interface ProtectiveOrderProfile {
  matter_id: string;
  source_document_sha256: string;
  source_document_storage_ref: string;
  labels_detected: string[];
  ai_clauses_detected: Array<{
    clause_type: 'no_third_party_ai' | 'no_training' | 'deletion_required' | 'retention_window' | 'court_notice' | 'other';
    excerpt_hash: string;
    confidence: number;
  }>;
  deadlines: Array<{ kind: string; date: string; source_excerpt_hash: string }>;
  recommended_matter_mode: MatterMode;
  recommended_tool_restrictions: string[];
  parser_version: string;
  parsed_at: string;
}
```

Rules:

- Parser is invoked at matter creation if a protective-order document is uploaded and at any later upload.
- Output drives policy recommendations but does not unilaterally set matter mode. The attorney must confirm.
- If parser detects a no-third-party-AI clause, the matter creation flow displays a hard warning and defaults the matter to `protected_discovery` with `local_only` posture pending counsel decision.
- Parser failures (low confidence, OCR failure, scanned image without text) must surface explicitly in the UI; the matter cannot auto-classify based on a failed parse.
- Source documents are stored in the protected-discovery WORM tier when the matter is or becomes `protected_discovery`.

---

## 8. Technical Architecture

### 8.1 Request Flow

Protected-discovery request:

1. Client loads matter policy.
2. Client verifies GLiNER daemon readiness.
3. Client tokenizes prompt and stores token map locally.
4. Client runs preflight wire guard.
5. Client sends tokenized prompt + session/matter identifiers to Vercel.
6. Server loads session, matter policy, provider registry, and policy snapshot.
7. Server runs deterministic wire guard and the protected-content classifier. Both operate only on the tokenized prompt, attorney-supplied labels (protective-order metadata, matter mode, uploaded-document source metadata), and detector signals. They do not see raw client text; raw text never leaves the browser under the V2 architecture. Wire guard's role is to reject outbound payloads that still contain deterministic raw-PII patterns after tokenization, not to inspect or store raw user input. The classifier evaluates tokenized-prompt structure, label metadata, and seed-list signals to decide whether protected-content indicators are present.
8. Server evaluates runtime policy.
9. If blocked, server writes block audit and returns safe error.
10. If allowed, server builds tools array from matter policy.
11. Server calls Anthropic/tool providers.
12. Server sanitizes tool outputs before reintroducing them.
13. Server writes provider-chain manifest and audit entries.
14. Server streams response.
15. Client rehydrates locally for display.
16. Session end triggers Compliance Pack record generation.

### 8.2 Policy Snapshotting

Every turn must bind to an immutable policy snapshot:

- Matter policy JSON canonical hash.
- Provider registry subset canonical hash.
- Tool builder policy hash.
- Detector version and seed-list hash.
- System prompt and agent config hash.

This prevents later provider-registry changes from obscuring what was true at generation time.

### 8.2.1 Latency and Cost Budget

Per-turn overhead added by the Morgan compliance layer must remain bounded so that protected-discovery mode is usable in interactive drafting:

- Policy evaluation, classifier inference, provider-registry lookup, snapshot hashing, and manifest preparation together must add no more than 250 ms to first-token latency for protected turns on warm-cache requests.
- WORM and signature writes for the audit and manifest may run after first-token streaming begins, but must complete before the response is marked `final` and made eligible for export.
- Cost overhead per protected turn (excluding the underlying model call) must remain under approximately $0.01 covering classifier inference, WORM put, signature compute, and policy snapshot read.
- M1 and later milestones must include benchmark tests that fail CI if any of these budgets regress by more than 20%.

### 8.3 Tool Mapping

Maintain a table from tool name to provider/data class.

Example:

```ts
const TOOL_PROVIDER_MAP = {
  web_search: {
    provider_id: 'anthropic_web_search',
    data_classes: ['tool_query', 'tool_output'],
    protected_default: 'blocked',
  },
  ceb_search: {
    provider_id: 'upstash_vector_ceb',
    data_classes: ['vector_query', 'source_document'],
    protected_default: 'approved_only',
  },
  courtlistener_search: {
    provider_id: 'courtlistener',
    data_classes: ['tool_query', 'tool_output'],
    protected_default: 'approved_only',
  },
  openai_embeddings: {
    provider_id: 'openai_embeddings',
    data_classes: ['vector_query'],
    protected_default: 'approved_only',
  },
};
```

### 8.4 Storage

New keys:

| Key | Purpose | Retention |
|---|---|---|
| `matter:{id}:policy` | Matter mode and tool policy | 7 years or matter retention |
| `matter:{id}:provider_snapshot:{sha}` | Immutable provider policy snapshot | 7 years |
| `provider_policy:{id}:{version}` | Provider registry record | While active + 7 years |
| `session:{id}:provider_manifest:{turn_id}` | Provider/tool manifest per turn | 7 years for protected, 90 days otherwise |
| `compliance_pack:{id}` | Signed pack metadata | 7 years, WORM |
| `lawyer_review:{id}` | Lawyer output review record | 7 years |
| `litigation_hold:{matter_id}` | Hold status | Until released |
| `deletion_request:{id}` | Provider deletion workflow evidence | 7 years |

Protected-discovery evidence storage:

- Upstash may remain the operational cache and daily audit store.
- Court-facing protected-discovery artifacts must be anchored to WORM-grade storage such as S3 Object Lock or equivalent.
- Each daily audit chain must be checkpointed with a detached signature by a key not stored only in Vercel.
- Compliance Pack verification must check WORM object identifiers, signatures, and hash-chain continuity.

---

## 9. UX Requirements

### 9.1 Matter Creation

Required fields:

- Matter title.
- Matter mode.
- Optional protective order upload/reference.
- Protected-discovery provider approval status.
- Default tool policy.

### 9.2 Chat/Drafting UI

Display:

- Mode badge.
- Sanitizer status.
- Provider status.
- Tool policy.
- Protected-content warnings.
- Attorney approval state.

For protected-discovery mode:

- If blocked, show precise next step: "Provider policy evidence missing", "web_search not approved", "GLiNER unavailable", etc.
- No generic failure text that encourages retrying raw content elsewhere.

Stale-policy surfacing:

- The matter view displays the earliest `expires_at` across all approved providers that the matter relies on, with a banner when any record expires in 14 days or fewer.
- A provider that has already expired triggers a hard banner ("This matter cannot send turns to <provider> until evidence is renewed") and the matter chat input is disabled for any tool/provider chain that depends on the expired record. Other tool chains remain available.
- The same expiry data is exposed in `/v2/admin/providers` with sortable expiration columns and a "stale or expiring within 30 days" filter.

### 9.3 Compliance Pack UI

Tabs:

- Overview.
- Provider chain.
- Tools.
- Sanitization.
- Audit anchors.
- Attorney review.
- Deletion/hold.
- Export.

### 9.4 Disclosure Copy

Product copy should be reviewed by counsel but must convey:

- What V2 sends.
- What it does not send.
- Which providers may receive tokenized text.
- That provider/tool identity may be disclosed.
- That protected-discovery mode exists for court-order confidential material.
- That lawyers must review AI output.

---

## 10. Testing and Verification

### 10.1 Unit Tests

Add tests for:

- `evaluateRuntimePolicy`.
- Provider registry validation.
- Protected-discovery tool omission.
- Matter policy snapshot hash stability.
- Provider manifest canonicalization.
- Protected-content classifier.
- Seed-list matching.
- Lawyer-review attestation.
- Compliance Pack signature verification.

### 10.2 Integration Tests

Add tests:

- Protected session with missing provider registry blocks.
- Protected session with stale provider registry blocks.
- Protected session with `web_search` blocked omits tool from Anthropic request.
- Protected session with approved provider permits CEB/CourtListener if policy allows.
- Client-confidential session preserves current ordinary V2 behavior.
- Legacy V1 route rejects protected-discovery session/matter ID.
- CORS forged-origin request blocked.
- Unauthenticated protected route returns 401.
- Cross-user matter/session access returns 403.
- Misclassified `client_confidential` turn with protective-order labels forces escalation/block.
- Audit-write failure in protected mode blocks or degrades to local-only, rather than silently proceeding.
- Embedding-query provider gate blocks protected text when OpenAI provider policy is missing/stale.

### 10.3 Browser E2E

Add Playwright checks:

- Create protected matter.
- Attempt chat before provider approval: blocked.
- Approve provider snapshot as admin.
- Run protected chat and intercept network bodies: no raw trap strings.
- Assert Anthropic request has no broad public `web_search` in tool list for protected-discovery turns.
- Generate Compliance Pack and verify JSON signature.
- Export PDF and inspect visible provider list.
- Lawyer review attestation required before protected export.
- Verify external/disclosable pack does not leak raw strings, protected categories beyond approved labels, seed-list labels, or internal work-product notes.

### 10.4 Trap Suite

Add Morgan-specific trap category:

- Confidential exhibit excerpts.
- Personnel-file details.
- Trade-secret business details.
- Settlement posture.
- Unique compound facts without names.
- Public-document overlap that reintroduces names through tool outputs.
- Protective-order labels.
- Prompt-injection attempts to disable protected mode.

Exit gate:

- Two consecutive full-suite zero-wire-leak runs.
- One run with `web_search` blocked.
- One run with provider registry stale to prove fail-closed.
- One fuzzed trap run generated from seed-list patterns.
- One Compliance Pack leak run.

---

## 11. Rollout Plan

### Phase M0 - PRD and legal review

Deliverables:

- This PRD.
- Rachel/F&F comments.
- Final decision on whether Anthropic Team plan written confirmation is sufficient for tokenized-only protected workflows.

Exit:

- PRD accepted or revised.

### Phase M0.5 - Provider-contract procurement decision

Deliverables:

- Written answer on whether Anthropic Team-plan no-training/policy language is sufficient for tokenized-only protected workflows.
- Written answer on whether protected-substance prompts require Enterprise/ZDR/custom terms.
- Provider-contract evidence for OpenAI embeddings and any public-search/MCP providers intended for protected mode.
- Decision memo: `protected_discovery` is enabled, `protected_discovery` is local-only, or `protected_discovery` is blocked until procurement closes.
- WORM store decision for protected-discovery evidence (for example S3 Object Lock or equivalent).
- Signing-key custody decision for daily audit checkpoints and Compliance Pack signatures.
- Browser token-map at-rest protection decision for protected-discovery matters. The options are: (a) require an attorney-set local passphrase that wraps the IndexedDB token-map material with a user-derived key, (b) require OS-level disk encryption attestation plus session-scoped in-memory keys with no IndexedDB persistence, or (c) require the `no_server_map` path with explicit spoliation-risk acceptance. Whichever option is chosen must be a hard gate in `protected_discovery` before any external model/tool call; this decision cannot remain open after M1.5.

Exit:

- Counsel-approved provider standard and procurement path.
- If provider standard is not met, implementation continues only for local-only/blocking flows.
- M1.5 local-only/blocking protected-discovery floor remains committed regardless of procurement outcome.

### Phase M1 - Provider registry and matter modes

Deliverables:

- Provider policy schema.
- Matter policy schema.
- Admin provider registry UI.
- Runtime policy skeleton.
- Storage keys.

Exit:

- Unit tests pass.
- Manual admin flow creates provider record and matter policy.

### Phase M1.5 - MVP protected-discovery floor

Deliverables:

- Protected matter creation.
- Provider evidence required before external model calls.
- Minimal `web_search` block for protected matters, even if implemented as a hardcoded protected-mode rule before the full policy engine.
- Minimal provider-chain manifest sufficient to answer "what model/tools/providers were used?"
- Basic "what tools/providers were used" export.
- Incident runbook draft.

Exit:

- One protected test matter can run or block for the correct reason.
- This is the earliest defensible pilot floor; full Compliance Pack comes later.

### Phase M2 - Protected tool gating

Deliverables:

- Refactor `buildToolsArray`.
- Runtime policy engine blocks unapproved providers/tools.
- Full policy-engine-driven protected tool gating, replacing the M1.5 hardcoded block.
- Legacy route blocking for protected sessions.

Exit:

- Integration tests prove tool omission/blocking.

### Phase M3 - Compound and protected-content hardening

Deliverables:

- F&F matter-pattern seed-list loader.
- Protected-content classifier.
- Morgan trap-set expansion.

Exit:

- Two consecutive zero-wire-leak runs.

### Phase M4 - Provider-chain manifest

Deliverables:

- Full per-turn provider manifest with policy snapshot hash, data classes, provider-record hashes, and enabled/disabled reasons.
- Audit schema extension.
- Policy snapshot hashing.

Exit:

- Provider manifest export matches intercepted runtime calls.

### Phase M5 - Disclosure and attorney approvals

Deliverables:

- V2 disclosure modal rewrite.
- Protected-discovery matter gate.
- Per-turn approval when needed.
- Lawyer-review attestation for exports.

Exit:

- Browser e2e proves approvals are required and recorded.

### Phase M6 - Morgan Compliance Pack

Deliverables:

- Compliance Pack JSON/PDF generator.
- Signature/key rotation.
- Verification CLI.
- Matter/session export UI.

Exit:

- Generate pack for a protected test matter.
- Verify offline.

### Phase M7 - Deletion and litigation hold

Deliverables:

- Deletion request workflow.
- Litigation-hold workflow.
- Provider response/evidence store.
- Incident-response workflow.
- Meta-discovery workflow.
- Token-map hold/spoliation policy implementation.

Exit:

- Simulated deletion request and hold runbook pass.
- Simulated protected-mode leak incident runbook pass.

### Phase M8 - Shadow and production readiness

Deliverables:

- 7-day protected-mode shadow observation.
- No raw leak.
- No unapproved provider/tool call.
- Final legal signoff.

Exit:

- Protected-discovery mode enabled for selected matters.

---

## 12. Acceptance Criteria

The project is complete when:

1. A protected-discovery matter cannot call any unapproved provider/tool.
2. Broad public `web_search` is omitted categorically in protected-discovery v1.
3. Provider policy records are required, versioned, and included in audit.
4. Every turn has a provider-chain manifest.
5. Compliance Pack export verifies offline.
6. Attorney approval/review records exist for protected exports.
7. CORS/auth/session ownership tests pass.
8. Legacy routes reject protected-discovery traffic.
9. Morgan test gate passes every required run: two consecutive full-suite zero-wire-leak runs, one protected `web_search` blocked run, one stale-provider fail-closed run, one seed-list fuzzed run, and one Compliance Pack leak run.
10. Rachel/F&F sign off on disclosure language and provider registry standard.
11. Provider-contract procurement decision is resolved in writing.
12. Protected-discovery artifacts are WORM-anchored and signature-verifiable under the M0.5-approved storage and signing-key custody model.
13. Token-map hold/spoliation policy is implemented for protected matters.
14. Detected protected content in lower modes forces escalation/block, with residual classifier false-negative risk documented for counsel approval.
15. Protected-mode audit/WORM write failure blocks the external turn or degrades it to local-only with attorney-visible reason text.
16. Every protected-discovery turn binds to an immutable policy snapshot covering matter policy, provider policy, tool policy, detector/seed-list versions, and system/agent configuration.

---

## 13. Open Questions

1. Is Anthropic Team-plan written no-training confirmation sufficient for tokenized-only protected-discovery prompts, or must protected mode require Enterprise/ZDR/custom terms?
2. Which narrow citation/search providers, if any, should be approved for protected-discovery matters after M1.5? Broad public `web_search` is out of scope for protected-discovery v1.
3. Which provider evidence records can be public links versus internal contract PDFs?
4. Does F&F want the Compliance Pack to include raw protected text under privilege controls, or only hashes/metadata?
5. Who owns quarterly provider-policy recertification?
6. ~~Should protected-discovery mode require a local passphrase before token map access?~~ Resolved by the M0.5 token-map at-rest decision (passphrase wrap, attested disk encryption, or `no_server_map` with spoliation-risk acceptance). Open question retained for traceability.
7. How should V2 handle a protected matter when an attorney switches devices and the token map is unavailable?
8. Which client engagement-letter language should be embedded in the disclosure pack?
9. Confirm whether the default protected-discovery v1 stance is acceptable: citation/statute-only retrieval is fully allowed, tokenized semantic CEB/vector retrieval may be enabled with attorney-visible recall caveats, and raw protected-substance embeddings remain blocked unless a protected-discovery embedding provider is approved.
10. Should `HIGHLY CONFIDENTIAL` / `ATTORNEYS' EYES ONLY` material be categorically local-only?
11. Which WORM store and signing-key custody model will F&F use for seven-year evidence? This must be answered in M0.5 before protected-mode evidence is represented as court-ready.

---

## 14. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---:|---|
| Sanitizer misses compound protected facts | Critical | F&F seed list, Morgan trap suite, protected-content classifier, attorney warning |
| Provider policy changes after approval | High | Expiring provider records, quarterly recertification, policy snapshot per turn |
| Tool identity disclosure surprises attorney | High | Disclosure modal, provider manifest, Compliance Pack |
| Web search receives protected terms | Critical | Protected mode omits broad public `web_search` categorically and tests request payloads |
| Attorney bypasses protected mode | High | Matter classification training, UI warnings, protected-order upload parser, audit warning |
| Legacy V1 route accepts protected content | Critical | Route blocking and CI tests |
| Compliance Pack leaks raw privileged content | Critical | Hash-only default, explicit counsel-controlled raw appendix if ever needed |
| Audit log unavailable | Medium | Protected mode should fail closed for compliance audit writes, unlike ordinary audit |
| Local token map lost | Medium | UI warning, no central recovery, export limitation |
| Token map lost under litigation hold | High | Counsel chooses no-server-map with written spoliation-risk acceptance or encrypted-hold-map before protected use |
| Classifier false negative leaves protected facts in client mode | Critical | Conservative detector thresholds, protected-order upload parser, warning telemetry, attorney training, counsel-owned residual-risk acceptance |
| Attorney deliberately misclassifies protected matter | Critical | Matter-mode warnings, audit trail, protected-order upload parser, compliance review |
| HMAC-only evidence challenged in discovery | High | WORM storage, detached signatures, hash-chain checkpoints |
| Metadata in Compliance Pack reveals work product | High | Internal/external pack tiers and metadata privilege review |

---

Residual classifier risk cannot be eliminated by the classifier itself. The protected-content classifier forces escalation only when it detects protected material; false negatives remain a Morgan-relevant risk in `client_confidential` because ordinary V2 may still allow external tools. The launch decision must either accept that residual risk in writing, tighten ordinary client-confidential defaults, or require attorneys to classify any matter with a protective order as `protected_discovery` before entering matter-specific facts.

---

## 15. Documentation Updates

Update:

- `README.md` V2 status and stale web-search privilege-gating claims.
- `CLAUDE.md` stale OpenRouter/ZDR/Gemini references.
- `docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md` to link this PRD and replace the May 13 seventh-addendum language so that protected-discovery mode reinstates hard `web_search` omission. Ordinary `client_confidential` may keep the attorney-agency posture, but the document must say so explicitly and reference this PRD's §3 modes.
- `docs/q-ff-communication-memo-2026-05-15.md` with Morgan/protected-discovery addendum.
- `docs/upstash-kv-schema-v1.md` with matter/policy/manifest keys.
- `components/ConfidentialityAttestation.tsx` copy and hard-gate behavior.
- Admin/runbook docs for deletion, litigation hold, provider recertification.

---

## 16. Reference Links

- Morgan order: https://cases.justia.com/federal/district-courts/colorado/codce/1%3A2025cv01991/245077/65/0.pdf
- Kirkland alert on Morgan: https://www.kirkland.com/publications/kirkland-alert/2026/05/a-federal-court-charts-a-path-on-ai-protective-orders-and-work-product-in-discovery
- California State Bar Practical Guidance for the Use of Generative AI in the Practice of Law: https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
- Anthropic commercial model-training policy: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Anthropic retention overview: https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
