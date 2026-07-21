---
type: "Reference"
title: "OpenWiki quickstart"
description: "Entry point for the California Law Chatbot OpenWiki knowledge base. Covers the V2 product line, entry points, common agent tasks, repo map, build scripts, and key source docs."
---

# OpenWiki quickstart

California Law Chatbot is a Vite + React + TypeScript application backed by Vercel serverless APIs. The current mainline is the V2/V4 product line: a Clerk-authenticated legal research and drafting assistant for California practice, with a strong privacy/compliance layer, on-device sanitization, and workflow-specific pages for chat, drafting, verification, and drafting magic.

Start here if you are new to the repo:

1. Read the [architecture overview](architecture.md) to understand the runtime split between the React app, Vercel functions, session storage, and sanitization pipeline.
2. Read the [workflows guide](workflows.md) to understand the user-facing paths and how the V2 pages fit together.
3. Read the [domain model](domain-model.md) for the core concepts and shared types.

## What this repository does

At a high level, the app:

- authenticates attorneys with Clerk
- routes users into a single front end at `/v2`
- runs an agent loop on the server using Anthropic Messages API directly
- gates tool access with a server-authoritative compliance policy engine
- tokenizes/redacts client text on the device before it leaves the browser
- stores session history and matter metadata in Upstash Redis
- supports document drafting, citation verification, and export workflows

The repo also contains a large body of legal/compliance research in `docs/`, but the canonical product behavior lives in the source files above.

## Entry points

- Front end: `index.tsx` → `App.tsx`
- Main chat surface: `components/v2/V2ChatPage.tsx`
- Drafting surface: `components/v2/V2DraftPage.tsx`
- Verification surface: `components/v2/V2VerifyPage.tsx`
- Drafting Magic surface: `components/v2/V2DraftingMagicPage.tsx`
- Agent loop: `api/_lib/agentLoop.ts`
- Compliance policy: `api/_lib/compliance/policyEngine.ts`
- Session store: `api/_lib/sessionStore.ts`
- Sanitization: `services/sanitization/detectionPipeline.ts` and `services/sanitization/realSanitizer.ts`

## Common tasks for future agents

- Changing the chat loop or tool behavior: start in `api/_lib/agentLoop.ts`, then inspect `api/_lib/tools/index.ts`, `api/_lib/compliance/policyEngine.ts`, and the V2 hooks.
- Changing confidentiality rules or matter modes: start in `api/_lib/compliance/policyEngine.ts` and `api/matter-context.ts`, then follow the UI selector in `components/v2/MatterModeSelector.tsx`.
- Changing sanitization/tokenization: start in `services/sanitization/detectionPipeline.ts`, `services/sanitization/realSanitizer.ts`, and `hooks/useSanitizer.tsx`.
- Changing export behavior: inspect `api/export-document.ts` and the drafting/export components together.
- Changing citation or statute verification: inspect `api/_lib/tools/citationVerify.ts`, `api/_lib/tools/statuteVerify.ts`, `api/_lib/tools/courtlistenerSearch.ts`, and the verify page.

## Repo map

- `api/` — serverless endpoints and shared server logic
- `components/` — UI pages, shell, and reusable widgets
- `hooks/` — React hooks for agent streaming and sanitization
- `services/` — sanitization, guardrails, workspace crypto, and retrieval helpers
- `agents/` — system prompts and skill markdown for the V2 agent line
- `docs/` — product and compliance docs, including decision records and evidence packs
- `tests/` — unit tests for policy, routing, storage, sanitization, and compliance
- `scripts/` — smoke tests, baselines, and evaluation helpers

## Build and test

Common scripts from `package.json`:

```bash
yarn dev
yarn build
yarn test:sanitization
yarn test:traps
yarn agent:smoke
yarn agent:smoke-stream
yarn latency:baseline
```

The repo also uses Vercel functions, so route/security changes should be checked against the API handlers and any relevant tests under `tests/`.

## Source docs worth keeping in mind

- `README.md` — broad project overview and historical context
- `CLAUDE.md` — agent guidance and development notes
- `docs/PRD_COPRAC_ZDR_COMPLIANCE.md` — canonical compliance/product spec
- `docs/VERIFICATION_ALTERNATIVES_REVIEW_2026-07-02.md` — verification substrate research
- `docs/browser-gliner-integration-2026-06-30.md` — sanitization detector integration notes

If you only read one source page after this, read [architecture.md](architecture.md).
