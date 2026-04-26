# CLAUDE.md

## ⚠️ CRITICAL: Sanitization is ALWAYS LOCAL

The OPF daemon and all PII detection runs on the user's machine (127.0.0.1:47821). This is non-negotiable — the entire point of the architecture is that client confidential data never leaves the device before being sanitized. **Never suggest moving PII detection server-side, to a cloud function, Railway, Vercel, or any remote service.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

California Law Chatbot is a legal research assistant powered by a two-pass AI verification system: Google Gemini (generator, via OpenRouter) + Anthropic Claude Sonnet 4.5 (verifier, via OpenRouter). Includes a CEB (Continuing Education of the Bar) RAG system with 77,406 vector embeddings across 5 legal verticals.

**Tech Stack**: React 19, TypeScript, Vite, Vercel serverless functions, Upstash Vector, OpenAI embeddings (native API), OpenRouter (AI model routing)

> **In-progress migration**: `utils/googleGenAI.ts` (untracked) and local branches are migrating the generator + verifier from OpenRouter to Google GenAI directly. Not yet merged to main.

## Development Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build to dist/
npm run preview          # Preview production build

# Testing
npm run test:verification # Run verification system tests
node test-harvey-upgrades.js  # Test Harvey upgrade features

# Local API testing (requires dev server running)
curl -X POST http://localhost:5173/api/ceb-search \
  -H "Content-Type: application/json" \
  -d '{"query": "revocable living trust", "topK": 3}'
```

## Python Scripts (CEB Processing)

Located in `/scripts/`, these process CEB PDFs into vector embeddings:

```bash
cd scripts
pip install -r requirements.txt

# 1. Extract and chunk PDFs
python3 process_ceb_pdfs.py --category trusts_estates --input-dir "/path/to/pdfs" --chunk-size 1000

# 2. Generate embeddings (requires OPENAI_API_KEY)
python3 generate_embeddings.py --category trusts_estates --input-file data/ceb_processed/trusts_estates/chunks.jsonl

# 3. Upload to Upstash Vector
python3 upload_to_upstash.py --category trusts_estates --input-file data/ceb_processed/trusts_estates/embeddings.jsonl

# Test CEB RAG queries
python3 test_ceb_rag.py
```

**Categories**: `trusts_estates`, `family_law`, `business_litigation`, `business_entities`, `business_transactions`

## Architecture

### Two-Pass Verification Pipeline

```
User Query → ChatService.sendMessage()
    ↓
[Mode Detection: CEB Only / AI Only / Hybrid]
    ↓
[CEB Search] → /api/ceb-search.ts → Upstash Vector
    ↓                                    ↓
[Embeddings] ← Native OpenAI API (text-embedding-3-small)
    ↓
[Case Law?] → /api/courtlistener-search.ts → CourtListener API
    ↓
[Legislative?] → /api/openstates-search.ts + /api/legiscan-search.ts
    ↓
[Generate] → /api/gemini-chat.ts → OpenRouter → Gemini 3.1 Pro (primary)
    ↓                                    ↓
[Fallback if empty] ← Gemini 2.5 Pro (via OpenRouter)
    ↓
[Verify] → /api/claude-chat.ts → OpenRouter → Claude Sonnet 4.5
    ↓
[Research Agent] → agents/researchAgent.ts → OpenRouter → Claude Haiku 4.5
    ↓
[Confidence Gating] → services/confidenceGating.ts
    ↓
Response → UI (Message.tsx)
```

### Three Source Modes

Defined in `types.ts` as `SourceMode`:

- **CEB Only** (`ceb-only`): Authoritative CEB practice guides only. Bypasses verification (trusted source).
- **AI Only** (`ai-only`): Case law, legislation, web search. Standard verification applies.
- **Hybrid** (`hybrid`): CEB + case law + legislation. Recommended mode.

Mode selection: `components/SourceModeSelector.tsx` → persists to localStorage

### Key Services

| File | Role |
|------|------|
| `gemini/chatService.ts` | Main orchestrator: query detection, source coordination, verification pipeline |
| `gemini/cebIntegration.ts` | CEB category routing and context formatting |
| `services/verifierService.ts` | Claim extraction, Gemini verification, report parsing |
| `services/confidenceGating.ts` | Post-verification quality checks |
| `services/guardrailsService.ts` | Input validation and safety checks |

### API Endpoints (`/api/*.ts`)

All are Vercel serverless functions (1024MB, 60s timeout, CORS enabled):

| Endpoint | Purpose |
|----------|---------|
| `ceb-search.ts` | Upstash Vector search with statutory pre-filter & LGBT query expansion. Uses native OpenAI API for embeddings. |
| `gemini-chat.ts` | Stream Gemini responses via OpenRouter (Gemini 3.1 Pro primary, Gemini 2.5 Pro fallback) |
| `claude-chat.ts` | Claude verification via OpenRouter (Claude Sonnet 4.5) |
| `courtlistener-search.ts` | California case law search |
| `openstates-search.ts` | California bills via OpenStates API |
| `legiscan-search.ts` | Bill text via LegiScan API |
| `verify-citations.ts` | Citation verification against CourtListener |
| `orchestrate-document.ts` | Multi-agent document drafting (uses OpenRouter for Claude) |
| `debug.ts` | Environment variable diagnostic endpoint |

### CEB RAG System

**Storage**: Upstash Vector (cosine similarity)
**Embeddings**: Native OpenAI API `text-embedding-3-small` (1536 dimensions)
**Namespace**: `ceb_trusts_estates`, `ceb_family_law`, etc.
**API**: Direct OpenAI API (`https://api.openai.com/v1/embeddings`) - not via OpenRouter

CEB-based responses bypass verification and display an amber "CEB Verified" badge.

## Environment Variables

```env
# Required: AI Models (via OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-xxx       # Unified API key for all AI models
  # Models used:
  # - google/gemini-3.1-pro (primary generator)
  # - google/gemini-2.5-pro (fallback generator)
  # - anthropic/claude-sonnet-4.5 (verifier)
  # - anthropic/claude-haiku-4.5 (research agent)

# Required: Embeddings (native OpenAI API)
OPENAI_API_KEY=sk-proj-xxx            # Direct OpenAI API for embeddings

# Required: CEB RAG
UPSTASH_VECTOR_REST_URL=https://xxx.upstash.io
UPSTASH_VECTOR_REST_TOKEN=xxx

# Optional: External APIs
COURTLISTENER_API_KEY=xxx             # Case law (enhances results)
OPENSTATES_API_KEY=xxx                # Legislative bills
LEGISCAN_API_KEY=xxx                  # Bill text

# Legacy (kept for backward compatibility, not actively used)
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

All keys are server-side only. **ZDR Compliance**: Enable Zero Data Retention in OpenRouter settings for privacy compliance.

## Type System

Core interfaces in `types.ts`:

- `ChatMessage`: Message with verification metadata
- `Source` / `CEBSource`: Legal source references (CEB sources have `isCEB: true`)
- `SourceMode`: `'ceb-only' | 'ai-only' | 'hybrid'`
- `VerificationReport`: Coverage metrics and claim status
- `VerificationStatus`: `'verified' | 'partially_verified' | 'refusal' | 'unverified' | 'not_needed'`

## Development Patterns

### Adding a New API Endpoint

1. Create `/api/your-endpoint.ts` with default export function
2. Copy CORS headers from existing endpoints
3. Validate inputs and check environment variables
4. Return JSON with proper status codes

### Adding CEB Categories

1. Process PDFs: `python3 process_ceb_pdfs.py --category new_category`
2. Generate embeddings: `python3 generate_embeddings.py --category new_category`
3. Upload: `python3 upload_to_upstash.py --category new_category`
4. Update `types.ts` CEBSource category type
5. Update category detection in `gemini/cebIntegration.ts`

### Query Detection

`chatService.ts` has detection methods:
- `isLegislativeQuery()`: Detects "bill", "legislation", "AB 123", "SB 456"
- `isCaseLawQuery()`: Detects "v.", "case", "court", "opinion"

## Constraints

1. **No client-side API keys**: All keys in env vars (server-side)
2. **CEB responses skip verification**: Authoritative source
3. **Conversation history**: 10 messages with intelligent context expansion
4. **Vercel timeout**: 60s max
5. **CORS required**: All `/api/*` endpoints

## Deployment (Vercel)

1. Push to GitHub (auto-deploys)
2. Set env vars in Vercel dashboard (Production, Preview, Development):
   - `OPENROUTER_API_KEY` (required)
   - `OPENAI_API_KEY` (required)
   - `UPSTASH_VECTOR_REST_URL` (required)
   - `UPSTASH_VECTOR_REST_TOKEN` (required)
   - `COURTLISTENER_API_KEY` (optional)
   - `OPENSTATES_API_KEY` (optional)
   - `LEGISCAN_API_KEY` (optional)
3. Redeploy after env var changes

**Build**: `npm run build` → `dist/`

**Local Development**: Use `npm run dev:api` (terminal 1) + `npm run dev` (terminal 2) or `npm run dev:full` for both.

## Legal Compliance

Implements California State Bar guidance for AI in legal practice:
- Confidentiality warnings
- Verification system
- Source citations with direct links
- AI usage disclosure

See `COMPLIANCE_ANALYSIS.md` and `PRIVACY_AND_CONFIDENTIALITY.md` for details.
