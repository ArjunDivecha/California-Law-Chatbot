---
type: "Reference"
title: "Domain model"
description: "Core domain concepts of AskPauli: sessions, matter modes, client AI consent, sanitized text and token maps, turn manifests, tool registry, model-family resolver and approved-model guard, two-provider citation identity gate, and chat/document types."
---

# Domain model

This page covers the AskPauli (formerly California Law Chatbot) domain. The product serves California solo and small firms (Femme & Femme LLP) with research, drafting, and citation-verification workflows under a confidentiality-first posture.

## Core application concepts

### Session

A session is the unit of conversational state for the V2 agent loop. Session metadata is stored in Upstash Redis and includes the owner, timestamps, model, matter context, consent, and attestation fields.

Source files:

- `api/_lib/sessionStore.ts`
- `api/agent/session.ts`
- `api/matter-context.ts`

### Matter mode

Matter mode determines the confidentiality posture of a session.

The three modes are:

- `public_research`
- `client_confidential`
- `protected_discovery`

The policy engine treats matter mode as the floor and allows detection to escalate only upward. `protected_discovery` can be locked.

Source files:

- `api/_lib/compliance/policyEngine.ts`
- `api/matter-context.ts`
- `components/v2/MatterModeSelector.tsx`

### Client AI consent

Consent is recorded separately from matter mode. The UI allows an attorney to record statuses such as allowed, restricted, prohibited, or revoked, and the server persists the record alongside attestations.

Source files:

- `api/matter-context.ts`
- `api/_lib/compliance/attestations.ts`
- `api/_lib/compliance/policyEngine.ts`

### Sanitized text and token maps

The app uses placeholder tokens on the wire and rehydrates them locally for display. The token map remains on the device.

Conceptually:

- raw client text is detected and tokenized on the device
- wire payloads use placeholders
- assistant text is rehydrated locally where needed
- invented token references are surfaced as warnings

Source files:

- `services/sanitization/detectionPipeline.ts`
- `services/sanitization/realSanitizer.ts`
- `services/sanitization/chatAdapter.ts`
- `hooks/useSanitizer.tsx`

### Turn manifest

Each turn can produce a structured manifest that records policy decisions, tools called, evidence sinks, model policy, and hashes. The manifest is designed to avoid storing raw prompt text.

Source files:

- `api/_lib/compliance/turnManifest.ts`
- `api/_lib/agentLoop.ts`

### Tool registry and policy ids

The agent loop works with a logical tool registry. Policy decisions are mapped to allowed tool ids, and dispatch is split into a controlled registry rather than ad hoc calls.

Source files:

- `api/_lib/tools/index.ts`
- `api/_lib/compliance/policyEngine.ts`
- `api/_lib/compliance/toolQueryGuard.ts`

### Model family, resolver, and approved-model guard

The active model is not pinned to a single id. The domain has three roles — primary research (Fable), unavailability failover (Opus), and quick mode plus citation verifier (Sonnet) — each auto-tracked to the newest approved id, with a fail-closed family guard.

- The model resolver keeps a cached newest id per role; getters are synchronous and fall back to pinned `KNOWN_GOOD` defaults so a Models-API outage never blocks a turn.
- The approved-model guard fails closed before any client-content request if the resolved id is outside `claude-(fable|opus|sonnet|haiku)-*` or is a preview/mythos surface. Adding a model is a compliance event requiring counsel sign-off and disclosure-copy review, not a code-only change.

Source files:

- `api/_lib/modelResolver.ts`
- `api/_lib/approvedModels.ts`
- `api/_lib/agentLoop.ts` (`resolveModel`, `assertApprovedModel` call sites)
- `api/_lib/verifierSubAgent.ts` (verifier model via `latestFast`)

### Chat message and document types

Shared TypeScript types define the main shapes used across the repo:

- chat messages and verification metadata
- source references
- document templates and sections
- verification reports
- generated documents and citations

Source file:

- `types.ts`

### Citation verification and the two-provider identity gate

Case-citation verification cross-checks two independent public providers before any citation is stamped `verified`. CiteLaw supplies a structured identity check (reporter citation + case title + year) with `confirmed` / `possible_match` / `no_match` results; CourtListener supplies independent search/opinion evidence. The gated status (`verified`, `unconfirmed`, `not_found`, `unverified`, `unavailable`) records which providers supplied positive evidence (`verification_source`). A CiteLaw near-match or identity conflict blocks a CourtListener-only green badge; provider outages degrade to CourtListener and surface as `unavailable`, never as fabricated.

Source files:

- `api/_lib/tools/citationVerify.ts`
- `api/agent/verify-stream.ts`
- `api/_lib/verifierSubAgent.ts`
- `tests/citation-verify.test.mjs`

## Business / product concepts

### One front end, one active line

The repo history shows a consolidation to a single V2/V4 front end. Legacy V1 paths redirect to `/v2`, and the active UI is intentionally unified.

Source files:

- `App.tsx`
- `README.md`

### Legal research vs drafting vs verification

The product is not just chat. It has separate workflows for research, drafting, and citation verification, with different UI surfaces and different prompt / policy behavior.

Source files:

- `components/v2/V2ChatPage.tsx`
- `components/v2/V2DraftPage.tsx`
- `components/v2/V2VerifyPage.tsx`
- `components/v2/V2DraftingMagicPage.tsx`

### Compliance posture

The documentation and code treat compliance as a first-class product constraint rather than a deployment footnote. The policy engine, sanitized wire path, matter mode, consent, and per-turn manifest are all part of that posture.

Source files:

- `docs/PRD_COPRAC_ZDR_COMPLIANCE.md`
- `api/_lib/compliance/policyEngine.ts`
- `api/_lib/compliance/turnManifest.ts`
- `services/sanitization/detectionPipeline.ts`
