# API Key Problem Diagnosis

## Problem Identified

The application is failing because:

1. **Missing API Keys**: All required environment variables are missing
2. **Incorrect Dev Server**: Running `npm run dev` (Vite) instead of `vercel dev` (which runs serverless functions)

## Required API Keys

The following environment variables MUST be set:

### Required:
- `GEMINI_API_KEY` - Google Gemini 2.5 Pro (Generator)
- `ANTHROPIC_API_KEY` - Claude Sonnet 4.5 (Verifier)  
- `OPENAI_API_KEY` - OpenAI Embeddings (CEB RAG)
- `UPSTASH_VECTOR_REST_URL` - Upstash Vector Database URL
- `UPSTASH_VECTOR_REST_TOKEN` - Upstash Vector Database Token

### Optional:
- `COURTLISTENER_API_KEY` - CourtListener API (Case Law)
- `SERPER_API_KEY` - Serper API (Google Search)
- `OPENSTATES_API_KEY` - OpenStates API (Legislation)
- `LEGISCAN_API_KEY` - LegiScan API (Bill Text)

## Solution

### Step 1: Create `.env` file

Create a `.env` file in the project root with your API keys:

```bash
GEMINI_API_KEY=your_gemini_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
UPSTASH_VECTOR_REST_URL=your_upstash_url_here
UPSTASH_VECTOR_REST_TOKEN=your_upstash_token_here
COURTLISTENER_API_KEY=your_courtlistener_key_here  # optional
```

### Step 2: Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

### Step 3: Run with Vercel Dev

Instead of `npm run dev`, use:

```bash
vercel dev
```

This will:
- Start Vite dev server on port 5173 (frontend)
- Start Vercel serverless functions on port 3000 (API endpoints)
- Load environment variables from `.env` file

### Step 4: Test the Application

1. Open http://localhost:5173 in your browser
2. Try sending a test message
3. Check browser console (F12) for any errors
4. Check terminal for API endpoint logs

## Testing API Keys

Run the test script to verify your API keys are configured:

```bash
node test-api-keys.js
```

## Current Status

✅ Dev server is running on port 5173
❌ API endpoints are not accessible (need `vercel dev`)
❌ No API keys configured (need `.env` file)

## Next Steps

1. Create `.env` file with your API keys
2. Stop current dev server (`npm run dev`)
3. Run `vercel dev` instead
4. Test the application in browser

