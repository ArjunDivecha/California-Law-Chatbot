---
type: "Reference"
title: "OpenWiki quickstart"
description: "Entry point for the AskPauli OpenWiki knowledge base. Covers the V2 product line, dual web/desktop surfaces, automatic model resolution, entry points, common agent tasks, repo map, build scripts, and key source docs."
---

# OpenWiki quickstart

AskPauli (renamed from California Law Chatbot on 2026-07-22) is a Vite + React + TypeScript legal research and drafting assistant for California solo and small firms. It ships as two surfaces sharing one Anthropic-direct agent engine: a hosted web app (`app.askpauli.com`, Vercel + Clerk + Upstash Redis) and a local-first macOS desktop app (Tauri 2 sidecar bound to `127.0.0.1`, sessions/drafts/audit logs in per-user SQLite, no cloud data stores). Both surfaces share the V2/V4 product line: Clerk-authenticated research, drafting, citation verification, and drafting-magic workflows, with a strong privacy/compliance layer and on-device sanitization.

Start here if you are new to the repo:

1. Read the [architecture overview](architecture.md) to understand the runtime split between the React app, Vercel functions, session storage, and sanitization pipeline.
2. Read the [workflows guide](workflows.md) to understand the user-facing paths and how the V2 pages fit together.
3. Read the [domain model](domain-model.md) for the core concepts and shared types.

## What this repository does

At a high level, the app:

- authenticates attorneys (Clerk on web; dev-user bypass only off Vercel on desktop)
- routes users into a single front end at `/v2`
- runs an Anthropic-direct agent loop on the server/sidecar (newest Fable/Opus/Sonnet auto-tracked, see [architecture](architecture.md))
- gates model and tool access with a server-authoritative compliance policy engine and a fail-closed model allowlist
- tokenizes/redacts client text on the device before it leaves the browser/app
- stores session history and matter metadata in Upstash Redis (web) or local SQLite (desktop)
- supports document drafting, citation verification, and export workflows

The repo also contains a large body of legal/compliance research in `docs/`, but the canonical product behavior lives in the source files above.

## Entry points

- Front end: `index.tsx` → `App.tsx`
- Main chat surface: `components/v2/V2ChatPage.tsx`
- Drafting surface: `components/v2/V2DraftPage.tsx`
- Verification surface: `components/v2/V2VerifyPage.tsx`
- Drafting Magic surface: `components/v2/V2DraftingMagicPage.tsx`
- Agent loop: `api/_lib/agentLoop.ts`
- Model resolution + allowlist: `api/_lib/modelResolver.ts` and `api/_lib/approvedModels.ts`
- Compliance policy: `api/_lib/compliance/policyEngine.ts`
- Session store (web): `api/_lib/sessionStore.ts`; desktop SQLite adapter: `api/_lib/desktop/sqliteKv.ts`
- Sanitization: `services/sanitization/detectionPipeline.ts` and `services/sanitization/realSanitizer.ts`
- Citation verification: `api/_lib/tools/citationVerify.ts` (CiteLaw identity gate + CourtListener), `api/agent/verify-stream.ts`
- Desktop sidecar: `desktop-server.mjs` (env/credential stripping in `desktop-env.mjs`)

## Common tasks for future agents

- Changing the chat loop or tool behavior: start in `api/_lib/agentLoop.ts`, then inspect `api/_lib/tools/index.ts`, `api/_lib/compliance/policyEngine.ts`, and the V2 hooks.
- Changing model selection or the approved-model guard: start in `api/_lib/modelResolver.ts` (auto-tracking + pinned `KNOWN_GOOD` defaults) and `api/_lib/approvedModels.ts` (fail-closed `assertApprovedModel`); `agentLoop.ts` `resolveModel` is the only path that swaps in the fallback on an unavailability error.
- Changing confidentiality rules or matter modes: start in `api/_lib/compliance/policyEngine.ts` and `api/matter-context.ts`, then follow the UI selector in `components/v2/MatterModeSelector.tsx`.
- Changing sanitization/tokenization: start in `services/sanitization/detectionPipeline.ts`, `services/sanitization/realSanitizer.ts`, and `hooks/useSanitizer.tsx`.
- Changing export behavior: inspect `api/export-document.ts` and the drafting/export components together.
- Changing citation or statute verification: inspect `api/_lib/tools/citationVerify.ts` (CiteLaw identity gate + CourtListener fallback), `api/agent/verify-stream.ts` (batch prefetch + per-citation sub-agent), `api/_lib/verifierSubAgent.ts`, `api/_lib/tools/statuteVerify.ts`, and `api/_lib/tools/courtlistenerSearch.ts`.
- Changing unverified-citation visibility (chat sources badges, Draft banner, Drafting Magic QC status): start in `services/guardrailsServiceV2.ts` (`checkAnswer`), `utils/citationHeuristic.ts` (`hasCitationLikeText`), `api/agent/draft-qc.ts` + `hooks/useV2DraftQC.ts` (per-section `partial` status), and the three V2 page render blocks; the regression suite is `yarn test:citation-visibility`.
- Changing the desktop build: start in `desktop-server.mjs` and `desktop-env.mjs` (import order matters), then `api/_lib/desktop/sqliteKv.ts` and `src-tauri/tauri.conf.json`.

## Repo map

- `api/` — serverless endpoints and shared server logic
- `components/` — UI pages, shell, and reusable widgets
- `hooks/` — React hooks for agent streaming and sanitization
- `services/` — sanitization, guardrails, workspace crypto, and retrieval helpers
- `agents/` — system prompts and skill markdown for the V2 agent line
- `desktop-server.mjs` / `desktop-env.mjs` — Tauri sidecar (loopback API + static front end) and local-only env/credential setup
- `src-tauri/` — Tauri 2 native shell, build config, and icons
- `docs/` — product and compliance docs, including decision records and evidence packs
- `tests/` — unit tests for policy, routing, storage, sanitization, compliance, and citation verification
- `scripts/` — smoke tests, baselines, evaluation helpers, and the citation-provider benchmark

## Build and test

Common scripts from `package.json`:

```bash
yarn dev:full           # local web dev (API :3000 + vite :5173)
yarn build              # vite build → dist/
yarn desktop            # desktop sidecar dev (loopback :8477 + native window)
yarn desktop:app        # build → sign → notarize AskPauli.app
yarn test:sanitization  # tests/sanitization.test.mjs
yarn test:citation-verify  # tests/citation-verify.test.mjs (CiteLaw identity-gate matrix)
yarn test:citation-visibility  # tests/unverified-citation-visibility.test.mjs (heuristic + guardrail + draft-qc partial-status matrix)
yarn test:traps         # tests/traps/runTraps.mjs
yarn agent:smoke        # scripts/agent-loop-smoke.mjs
yarn agent:smoke-stream # scripts/agent-loop-stream-smoke.mjs
yarn latency:baseline   # scripts/latency-baseline.mjs
yarn benchmark:citations --require-all  # citation-provider benchmark (CL + CiteLaw)
yarn smoke:citelaw      # live CiteLaw batch smoke (1 credit, public cites only)
```

The repo also uses Vercel functions, so route/security changes should be checked against the API handlers and any relevant tests under `tests/`.

## Source docs worth keeping in mind

- `README.md` — broad project overview and historical context
- `CLAUDE.md` — agent guidance and development notes
- `docs/PRD_COPRAC_ZDR_COMPLIANCE.md` — canonical compliance/product spec
- `docs/VERIFICATION_ALTERNATIVES_REVIEW_2026-07-02.md` — verification substrate research
- `docs/browser-gliner-integration-2026-06-30.md` — sanitization detector integration notes

If you only read one source page after this, read [architecture.md](architecture.md).
