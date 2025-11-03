# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

California Law Chatbot is a sophisticated legal research assistant powered by a two-pass AI verification system combining Google Gemini 2.5 Pro (generator) with Anthropic Claude Sonnet 4.5 (verifier). The system includes a fully-implemented CEB (Continuing Education of the Bar) RAG system with 77,406 vector embeddings across 5 legal verticals.

**Tech Stack**: React 19, TypeScript, Vite, serverless functions (Vercel), Upstash Vector, OpenAI embeddings

## Development Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build to dist/
npm run preview          # Preview production build

# Testing
npm run test:verification # Run verification system tests
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
```

**Available categories**: `trusts_estates`, `family_law`, `business_litigation`, `business_entities`, `business_transactions`

## Architecture Overview

### Two-Pass Verification System

The core architecture uses a two-stage AI pipeline:

1. **Generator (Gemini 2.5 Pro)**:
   - Generates comprehensive legal answers with Google Search grounding
   - Extracts claims and citations from sources
   - Located in: `gemini/chatService.ts`

2. **Verifier (Claude Sonnet 4.5)**:
   - Validates claims against source excerpts
   - Produces verification reports with coverage metrics
   - Rewrites answers to remove unsupported claims
   - Located in: `services/verifierService.ts`

### Three Source Modes

The system supports three operational modes (see `types.ts`):

- **CEB Only**: Searches only CEB practice guides (no verification needed, authoritative)
- **AI Only**: Uses case law, legislation, web search (standard verification)
- **Hybrid**: Combines CEB + case law + legislation (recommended)

Mode selection is controlled by `SourceModeSelector.tsx` component.

### Data Flow

```
User Query → ChatService.sendMessage()
    ↓
[Mode Detection: CEB Only / AI Only / Hybrid]
    ↓
[CEB Search] → /api/ceb-search.ts → Upstash Vector → OpenAI embeddings
    ↓
[Case Law?] → /api/courtlistener-search.ts → CourtListener API
    ↓
[Generate Answer] → /api/gemini-chat.ts → Gemini 2.5 Pro
    ↓
[Verify Answer] → /api/claude-chat.ts → Claude Sonnet 4.5
    ↓
[Confidence Gating] → services/confidenceGating.ts
    ↓
Response → UI (Message.tsx with badges)
```

### Serverless API Endpoints

All AI/database operations are server-side via `/api/*.ts` endpoints:

- **ceb-search.ts**: Query Upstash Vector for CEB content
- **gemini-chat.ts**: Stream Gemini responses
- **claude-chat.ts**: Verify answers with Claude
- **courtlistener-search.ts**: Search California case law
- **openstates-search.ts**: Legislative API (handler ready, integration pending)
- **legiscan-search.ts**: Bill text API (handler ready, integration pending)

These are Vercel serverless functions with CORS enabled and 60s max duration.

### CEB RAG System

The CEB (Continuing Education of the Bar) integration provides authoritative legal practice guides:

**Storage**: Upstash Vector database with cosine similarity
**Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensions)
**Namespace structure**: `ceb_trusts_estates`, `ceb_family_law`, etc.

**Query flow**: User query → OpenAI embedding → Upstash vector search → Top K results → Context formatting

**Response handling**: CEB-based responses bypass verification (marked as authoritative with amber badge)

## Key Files and Their Roles

### Core Services

**`gemini/chatService.ts`** (105KB)
- Main orchestrator for all AI interactions
- Manages conversation history with context expansion (10 messages)
- Detects query type (case law vs. legislation vs. general)
- Implements three source modes (CEB Only, AI Only, Hybrid)
- Coordinates CEB search, CourtListener, and legislative APIs
- Handles verification pipeline

**`gemini/cebIntegration.ts`**
- CEB-specific utilities
- Category detection (routes queries to correct CEB vertical)
- Formats CEB context for LLM consumption

**`services/verifierService.ts`**
- Extracts claims from generator output
- Calls Claude via `/api/claude-chat.ts` for verification
- Parses verification reports (coverage, supported/unsupported claims)
- Returns verified answer or refusal

**`services/guardrailsService.ts`**
- Input validation and safety checks
- Detects confidential information warnings
- Prevents harmful queries

**`services/confidenceGating.ts`**
- Post-verification quality checks
- Ensures minimum confidence thresholds

### Frontend Components

**`components/Message.tsx`**
- Renders chat messages with rich formatting
- Displays verification badges (CEB Verified, CourtListener Enhanced)
- Parses and links legal citations (California codes, case names)
- Shows verification reports and warnings

**`components/SourceModeSelector.tsx`**
- UI for selecting CEB Only / AI Only / Hybrid modes
- Persists selection to localStorage

**`hooks/useChat.ts`**
- React hook managing chat state
- Handles message sending, loading states, errors
- Manages source mode selection

## Environment Variables

Required for development/deployment (set in `.env` or Vercel dashboard):

```env
# Required: AI Models
GEMINI_API_KEY=xxx                    # Google Gemini 2.5 Pro (generator)
ANTHROPIC_API_KEY=xxx                 # Claude Sonnet 4.5 (verifier)
OPENAI_API_KEY=xxx                    # Embeddings (text-embedding-3-small)

# Required: CEB RAG System
UPSTASH_VECTOR_REST_URL=https://xxx.upstash.io
UPSTASH_VECTOR_REST_TOKEN=xxx

# Optional: Case Law
COURTLISTENER_API_KEY=xxx             # Enhances case law searches

# Optional: Legislative APIs (handlers exist, integration pending)
OPENSTATES_API_KEY=xxx
LEGISCAN_API_KEY=xxx
```

**Important**: All API keys are used server-side only. Frontend never has access to keys.

## Common Development Patterns

### Adding a New API Endpoint

1. Create `/api/your-endpoint.ts` with default export function
2. Add CORS headers (see existing endpoints)
3. Validate inputs, check environment variables
4. Use try-catch with detailed error logging
5. Return JSON with proper status codes

### Modifying Verification Logic

Verification happens in two places:
1. `gemini/chatService.ts` - decides when to verify (skips for CEB-only responses)
2. `services/verifierService.ts` - implements verification via Claude

To adjust verification strictness, modify the system prompt in `verifierService.ts` constructor.

### Adding CEB Categories

To add new CEB verticals:
1. Process PDFs: `scripts/process_ceb_pdfs.py --category new_category`
2. Generate embeddings: `scripts/generate_embeddings.py --category new_category`
3. Upload to Upstash: `scripts/upload_to_upstash.py --category new_category`
4. Update `types.ts` CEBSource category union type
5. Update category detection in `gemini/cebIntegration.ts`

### Frontend State Management

State is managed via React hooks (no Redux/Zustand):
- Chat history: `useChat` hook with useState
- Source mode: `useChat` hook with localStorage persistence
- Individual message state: Component-local state

## Type System

**`types.ts`** defines all core interfaces:

- `ChatMessage`: Chat message with verification metadata
- `Source` / `CEBSource`: Legal source references
- `SourceMode`: 'ceb-only' | 'ai-only' | 'hybrid'
- `VerificationReport`: Claims coverage and support metrics
- `VerificationStatus`: 'verified' | 'partially_verified' | 'refusal' | 'unverified' | 'not_needed'

CEB sources have `isCEB: true` flag and additional metadata (category, citation, page number, confidence score).

## Deployment (Vercel)

**Configuration**: `vercel.json`
- API functions: 1024MB memory, 60s timeout
- CORS headers configured for `/api/*` routes

**Deployment steps**:
1. Push to GitHub (auto-deploys if connected to Vercel)
2. Set environment variables in Vercel dashboard (Production, Preview, Development)
3. Redeploy if env vars change

**Build command**: `npm run build`
**Output directory**: `dist/`

## Legislative API Integration (Incomplete)

The OpenStates and LegiScan API handlers are implemented (`/api/openstates-search.ts`, `/api/legiscan-search.ts`) but not integrated into the chat flow. To complete:

1. Implement `fetchLegislationData()` method in `gemini/chatService.ts`
2. Call `/api/openstates-search` and `/api/legiscan-search` endpoints
3. Process results into Source[] format
4. Add legislative query detection logic

See `README.md` lines 393-430 for suggested implementation.

## Testing and Debugging

**Verification testing**: `npm run test:verification` runs `test-verification-system.js`

**Console logging**:
- CEB searches log to console with 🔍 emoji
- API endpoints log request/response details
- Verification reports include coverage metrics

**Local testing of API endpoints**:
```bash
# Start dev server
npm run dev

# Test CEB search (requires UPSTASH_* and OPENAI_API_KEY)
curl -X POST http://localhost:5173/api/ceb-search \
  -H "Content-Type: application/json" \
  -d '{"query": "revocable living trust", "topK": 3}'
```

## Important Constraints

1. **No client-side API keys**: All keys must be in environment variables (server-side)
2. **CEB responses skip verification**: They're authoritative, no need to verify
3. **Conversation history**: Limited to 10 most recent messages (with intelligent context expansion)
4. **Vercel function timeout**: 60s max (set in vercel.json)
5. **CORS**: Required for all `/api/*` endpoints

## Legal Compliance

The system implements California State Bar guidance for AI in legal practice:
- Prominent confidentiality warnings
- Verification system for accuracy
- Source citations with direct links
- Disclosure of AI usage and limitations

See `COMPLIANCE_ANALYSIS.md` and `PRIVACY_AND_CONFIDENTIALITY.md` for details.
