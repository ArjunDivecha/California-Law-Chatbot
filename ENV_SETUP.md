# Environment Variables for California Law Chatbot

## Required Variables

### OPENROUTER_API_KEY (Required)
- **Purpose**: Unified API key for all AI models (Gemini and Claude) via OpenRouter
- **Where to get it**: https://openrouter.ai/keys
- **Usage**: 
  - Gemini 3 Pro (primary generator): `google/gemini-3-pro-preview`
  - Gemini 2.5 Pro (fallback generator): `google/gemini-2.5-pro`
  - Claude Sonnet 4.5 (verifier): `anthropic/claude-sonnet-4.5`
  - Claude Haiku 4.5 (research agent): `anthropic/claude-haiku-4.5`
- **ZDR Support**: Enable Zero Data Retention in OpenRouter settings for privacy compliance
- **Example**: `sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Cost**: Pay-per-use, typically $0.10-0.50 per document

### OPENAI_API_KEY (Required)
- **Purpose**: API key for OpenAI embeddings via native OpenAI API
- **Where to get it**: https://platform.openai.com/api-keys
- **Usage**: Used for generating embeddings (`text-embedding-3-small`) for CEB document search
- **Why Native API**: Better reliability and direct control over data retention policies
- **Example**: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Cost**: ~$0.00002 per 1K tokens (very affordable)

### UPSTASH_VECTOR_REST_URL (Required)
- **Purpose**: Upstash Vector database REST URL for CEB document search
- **Where to get it**: https://console.upstash.com/
- **Usage**: Stores 77,406 CEB document embeddings across 5 legal verticals
- **Example**: `https://curious-monster-4578-gcp-usc1-vector.upstash.io`

### UPSTASH_VECTOR_REST_TOKEN (Required)
- **Purpose**: Upstash Vector database authentication token
- **Where to get it**: https://console.upstash.com/
- **Usage**: Authentication for Upstash Vector database
- **Example**: `AB0FMGN1cmlvdXMtbW9uc3Rlci00NTc4LWdjcC11c2MxYWRtaW5abVUwT1RCa05qQXROemt3WXkwME16WmhMVGswWmpZdFkySmhOREpqT0dVelpUSXk=`

### COURTLISTENER_API_KEY (Optional)
- **Purpose**: API key for CourtListener case law search
- **Where to get it**: https://www.courtlistener.com/api/rest-info/
- **Usage**: Enables enhanced case law search functionality
- **Example**: `82eaae0cecc5735d372c00f3911bab91c7de5973`

### OPENSTATES_API_KEY (Optional)
- **Purpose**: API key for OpenStates legislative research
- **Where to get it**: https://openstates.org/api/
- **Usage**: Enables legislative query detection and real-time bill tracking
- **Example**: `e7e77768-70b8-42f2-bfe2-de9923d63784`

### LEGISCAN_API_KEY (Optional)
- **Purpose**: API key for LegiScan bill text retrieval
- **Where to get it**: https://legiscan.com/legiscan
- **Usage**: Provides comprehensive bill information and amendments
- **Example**: `45107a685b35863663e4413dce78a010`

### SERPER_API_KEY (Optional)
- **Purpose**: API key for Serper Google Scholar search
- **Where to get it**: https://serper.dev/
- **Usage**: Enhanced scholarly research capabilities
- **Example**: `60a73f2f2705ebb5279cbf35320de647d91d0432`

## Vercel Setup

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables (for all environments: Production, Preview, Development):
   - `OPENROUTER_API_KEY` = your OpenRouter API key (required)
   - `OPENAI_API_KEY` = your OpenAI API key (required)
   - `UPSTASH_VECTOR_REST_URL` = your Upstash Vector REST URL (required)
   - `UPSTASH_VECTOR_REST_TOKEN` = your Upstash Vector REST token (required)
   - `COURTLISTENER_API_KEY` = your CourtListener API key (optional)
   - `OPENSTATES_API_KEY` = your OpenStates API key (optional)
   - `LEGISCAN_API_KEY` = your LegiScan API key (optional)
   - `SERPER_API_KEY` = your Serper API key (optional)
4. **Important**: After adding environment variables, redeploy for changes to take effect

## Local Development Setup

Create a `.env` file in the project root:

```bash
# Required: AI Models (via OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here

# Required: Embeddings (native OpenAI API)
OPENAI_API_KEY=sk-proj-your_openai_key_here

# Required: CEB Vector Database
UPSTASH_VECTOR_REST_URL=https://your-index.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your_upstash_token_here

# Optional: External APIs
COURTLISTENER_API_KEY=your_courtlistener_api_key_here
OPENSTATES_API_KEY=your_openstates_api_key_here
LEGISCAN_API_KEY=your_legiscan_api_key_here
SERPER_API_KEY=your_serper_api_key_here

# Legacy keys (kept for backward compatibility, not actively used)
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Local Development Server

For local development, you need to run both the API server and the Vite frontend:

**Option 1: Two terminals**
```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start Vite frontend
npm run dev
```

**Option 2: Single command**
```bash
npm run dev:full
```

The API server runs on `http://localhost:3000` and Vite runs on `http://localhost:5173` (or next available port).

## ZDR (Zero Data Retention) Compliance

OpenRouter supports Zero Data Retention policies. To enable:

1. Go to https://openrouter.ai/settings/privacy
2. Enable "Zero Data Retention" mode
3. This ensures all requests only route to ZDR-compliant endpoints

**Note**: The following models support ZDR:
- ✅ `google/gemini-3-pro-preview`
- ✅ `google/gemini-2.5-pro`
- ✅ `anthropic/claude-sonnet-4.5`
- ✅ `anthropic/claude-haiku-4.5`
- ❌ `openai/text-embedding-3-small` (via OpenRouter) - **Use native OpenAI API instead**

For embeddings, we use the native OpenAI API directly, which provides better control over data retention policies.

## Troubleshooting

### "OPENROUTER_API_KEY is not set"
- Ensure the key is set in your `.env` file
- For Vercel, check that it's set in all environments (Production, Preview, Development)
- Redeploy after adding environment variables

### "OPENAI_API_KEY is not set"
- Ensure the key is set in your `.env` file
- Verify the key is valid and has credits available
- Check that you're using the correct key format (`sk-proj-...`)

### "Upstash credentials not configured"
- Verify `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` are set
- Check that the vector database exists and is accessible
- Ensure the dimension is set to 1536 (for `text-embedding-3-small`)

### API calls failing
- Check browser console for error messages
- Verify all required API keys are set
- Check OpenRouter account balance and rate limits
- Verify OpenAI API key has sufficient credits

## Cost Estimates

- **OpenRouter**: ~$0.10-0.50 per document (varies by model and usage)
- **OpenAI Embeddings**: ~$0.00002 per 1K tokens (~$0.01-0.20 per 1,000 chunks)
- **Upstash Vector**: Free tier available, then pay-per-use
- **CourtListener**: Free tier with reasonable limits
- **OpenStates**: Free API key
- **LegiScan**: 30,000 queries/month free tier
