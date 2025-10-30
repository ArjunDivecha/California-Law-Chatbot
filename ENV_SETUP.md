# Environment Variables for California Law Chatbot

## Required Variables

### ANTHROPIC_API_KEY (NEW)
- **Purpose**: API key for Claude Sonnet 4.5 (Generator/Primary LLM)
- **Where to get it**: https://console.anthropic.com/
- **Usage**: Used by `ChatService` to generate legal research answers
- **Example**: `sk-ant-api03-...`

### GEMINI_API_KEY
- **Purpose**: API key for Google Gemini 2.5 Pro (Verifier/Secondary LLM)
- **Where to get it**: https://aistudio.google.com/app/apikey
- **Usage**: Used by `VerifierService` to verify claims against sources
- **Example**: `AIza...`

### COURTLISTENER_API_KEY (Optional)
- **Purpose**: API key for CourtListener case law search
- **Where to get it**: https://www.courtlistener.com/api/rest-info/
- **Usage**: Enables case law search functionality
- **Example**: `your_courtlistener_token_here`

## Vercel Setup

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `GEMINI_API_KEY` = your Google Gemini API key
   - `COURTLISTENER_API_KEY` = your CourtListener API key (optional)

## Local Development Setup

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIza...
COURTLISTENER_API_KEY=your_token_here
```
