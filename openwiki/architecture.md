# Architecture overview

## System shape

The repository is split into a React SPA and a set of Vercel serverless functions.

- `index.tsx` boots React, Clerk, and routing.
- `App.tsx` is the root router and mounts the single production front end.
- `api/` contains the serverless surface and most of the trust boundary logic.
- `services/` and `hooks/` hold client-side sanitization, stream handling, and workspace helpers.
- `agents/` provides system prompts and skill markdown for the V2 agent loop.

The current architecture is intentionally single-line: the app redirects root and legacy paths into `/v2`, and the V2 surfaces are the only active UI paths in `App.tsx`.

## Request flow

1. A signed-in user interacts with a V2 page.
2. The page calls `useV2AgentStream`, `useV2VerifyStream`, or a related hook.
3. The hook tokenizes text on the device using `services/sanitization/chatAdapter.ts` and `services/sanitization/detectionPipeline.ts`.
4. The request is sent to a Vercel route such as `api/agent/turn-stream.ts`.
5. The server authenticates with Clerk via `api/_lib/httpGuard.ts` and `utils/auth.ts`.
6. The policy engine decides which tools, models, disclosures, and review gates are allowed.
7. The agent loop dispatches approved tools and records a turn manifest and audit trail.
8. Results stream back to the UI for rendering.

## Server side trust boundary

The important boundary is inside `api/_lib/`.

### Authentication and route security

- `api/_lib/httpGuard.ts` centralizes Clerk auth, CORS, session ownership checks, and per-user rate limiting.
- `api/_shared/routeSecurity.ts` applies the hardened response headers and exact-origin allowlist.
- `api/chats.ts` and `api/export-document.ts` show the pattern of applying route security before doing any work.

### Session and persistence model

- `api/_lib/sessionStore.ts` wraps Upstash Redis and defines the session keys for messages, metadata, locks, and idempotency caches.
- `api/matter-context.ts` reads and writes matter mode, client consent, and protected-lock state against session metadata.
- `api/chats.ts` stores legacy chat history and includes a server-side raw-PII backstop before persistence.

### Agent loop and tool execution

- `api/_lib/agentLoop.ts` is the core turn engine and the only code path that talks to Anthropic Messages directly.
- `api/_lib/tools/index.ts` builds the tool registry and dispatches tool use blocks.
- `api/_lib/compliance/toolQueryGuard.ts` and the policy engine prevent tool misuse and exfiltration.
- `api/_lib/compliance/turnManifest.ts` records a structured per-turn compliance manifest.

### Compliance layer

`api/_lib/compliance/policyEngine.ts` is the main server-authoritative policy decision point. It decides:

- effective matter mode
- whether external calls are allowed
- tokenization level
- allowed and blocked tools
- required disclosures
- required review gates
- evidence sinks and blocking reasons

Related modules refine that policy with governance, conflict checks, billing, review gates, and storage rules.

## Client sanitization pipeline

The app uses an on-device privacy filter rather than trusting server-side redaction alone.

- `hooks/useSanitizer.tsx` initializes the active sanitizer.
- `services/sanitization/detectionPipeline.ts` combines OPF detection, regex patterns, allowlist suppression, and denylist logic. When overlapping spans disagree on category, deterministic regex-pattern spans (SSN, driver license, credit card, etc.) outrank OPF spans; when categories agree, the longer span wins as before.
- `services/sanitization/realSanitizer.ts` performs tokenize/rehydrate operations and maintains the in-memory token map.
- `services/sanitization/chatAdapter.ts` is the client-facing abstraction used by the V2 hooks.

The key design choice is fail-closed tokenization for wire traffic. If sanitization is unavailable on supported devices, the send path should block rather than leak raw text.

## UI architecture

`App.tsx` routes the signed-in shell to four active V2 surfaces:

- `/v2` — chat / research
- `/v2/draft` — document editing and proposal workflow
- `/v2/verify` — citation verification
- `/v2/magic` — Drafting Magic packet workflow

`components/v2/V2Sidebar.tsx` provides navigation. The V2 pages are intentionally separate so each workflow can evolve independently while sharing the same sanitizer and agent stream infrastructure.

## Data and storage

Current state is spread across three main stores:

- browser storage / IndexedDB for sanitization token maps and local UX state
- Upstash Redis for sessions, metadata, and audit-related state
- optional blob storage for chat payload persistence in `api/chats.ts`

Document export uses browser-side generation in some flows and a server export route in others, depending on the workflow.

## Historical context

The repository history shows a deliberate migration from an older OpenRouter/Gemini-era app to a single Anthropic-direct V2/V4 line. Several deleted files and historical docs in `README.md` and `docs/archive-v1/` are now reference-only.
e-v1/` are now reference-only.
