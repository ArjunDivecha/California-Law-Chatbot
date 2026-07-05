# Workflows

## 1. Research chat

Primary surface: `components/v2/V2ChatPage.tsx`.

This is the main attorney-facing interaction model:

- a session id is created or restored
- the user asks a legal question
- the page streams a turn from `useV2AgentStream`
- the UI shows sanitization status, tool affordances, streamed text, and final turn summaries

Useful source files:

- `components/v2/V2ChatPage.tsx`
- `hooks/useV2AgentStream.ts`
- `api/agent/turn-stream.ts`
- `api/_lib/agentLoop.ts`
- `api/_lib/tools/index.ts`

Watch-outs:

- The page depends on device-side sanitization being ready before sending sensitive text.
- The stream client must preserve turn/session ownership to avoid cross-session leakage.
- Tool availability is policy-driven, not purely UI-driven.

## 2. Draft document workflow

Primary surface: `components/v2/V2DraftPage.tsx`.

This workflow lets a user load an existing document, describe edits, and receive discrete proposed changes rather than a silent rewrite. The UI is built around reviewable edit proposals.

Useful source files:

- `components/v2/V2DraftPage.tsx`
- `hooks/useV2AgentStream.ts`
- `services/sanitization/chatAdapter.ts`
- `services/sanitization/wireGuard.ts`
- `components/v2/V2DraftingMagicPage.tsx` for the higher-complexity drafting flow

Watch-outs:

- The prompt contract expects structured JSON output with atomic changes.
- File ingestion happens in-browser.
- Sanitization applies to the full payload before it leaves the device.
- Draft/export behavior is split between browser generation and server export, so confirm which path a change uses.

## 3. Citation verification workflow

Primary surface: `components/v2/V2VerifyPage.tsx`.

The verification page is a focused workflow for pasting legal text and checking citations against the verification sub-agent. It exposes per-citation verdicts and summary counts.

Useful source files:

- `components/v2/V2VerifyPage.tsx`
- `hooks/useV2VerifyStream.ts`
- `api/agent/verify-stream.ts`
- `api/_lib/tools/citationVerify.ts`
- `api/_lib/tools/statuteVerify.ts`
- `api/_lib/tools/courtlistenerSearch.ts`

Watch-outs:

- The workflow is intentionally narrower than the main chat surface.
- The verifier is about citations and public law sources, not client-confidential matter work.
- Status labels distinguish real, fake, ambiguous, and error outcomes.

## 4. Drafting Magic workflow

Primary surface: `components/v2/V2DraftingMagicPage.tsx`.

This is the most complex V2 surface. It combines source ingestion, packet comparison, drafting guidance, sanitization, and export-like behaviors into a guided document-generation experience.

Useful source files:

- `components/v2/V2DraftingMagicPage.tsx`
- `hooks/useV2DraftingMagicStream.ts`
- `services/sanitization/chatAdapter.ts`
- `services/workspaceCrypto.ts`
- files under `components/draftingMagic/`

Watch-outs:

- There is a custom markdown parser for streamed sections.
- Packet/workspace state can be encrypted locally.
- The page depends on shared sanitization behavior and local token maps.
- This is a good place to inspect when changing document generation or packet comparison logic.

## 5. Matter mode and consent workflow

Primary surface: `components/v2/MatterModeSelector.tsx` backed by `api/matter-context.ts`.

This workflow records whether a session is public research, client confidential, or protected discovery, and it stores client AI-use consent. The server is the authoritative source of truth.

Useful source files:

- `components/v2/MatterModeSelector.tsx`
- `api/matter-context.ts`
- `api/_lib/compliance/policyEngine.ts`
- `api/_lib/compliance/attestations.ts`
- `api/_lib/sessionStore.ts`

Watch-outs:

- protected discovery is treated as a locked state with downgrade protection.
- consent is not just a UI toggle; it is persisted and used by policy decisions.
- the selector is coupled to session ownership checks.

## 6. Chat storage and export

Related surface: `api/chats.ts` and `api/export-document.ts`.

`api/chats.ts` manages chat CRUD, while `api/export-document.ts` generates DOCX, PDF, or HTML exports from generated documents.

Useful source files:

- `api/chats.ts`
- `api/export-document.ts`
- `api/_lib/httpGuard.ts`
- `api/_shared/routeSecurity.ts`

Watch-outs:

- `api/chats.ts` contains a server-side pre-save PII backstop.
- `api/export-document.ts` requires authentication and rate limiting.
- If you change export or persistence, check route security and auth first.
