# CourtListener API Version Update

**Date:** October 26, 2025

**Issue:** Chatbot was using deprecated CourtListener API v3

**Resolution:** Updated all endpoints to use CourtListener API v4

**Files Updated:**
- `test-courtlistener-api.js` - Updated test endpoint from `/api/rest/v3/` to `/api/rest/v4/`
- `gemini/chatService.ts` - Updated search endpoint from `/api/rest/v3/` to `/api/rest/v4/`

**API Changes:**
- v4 uses improved ElasticSearch backend
- Better performance and more features
- v3 is deprecated, v4 is the current stable version

**Testing:** API key validation test now uses v4 endpoint and passes successfully.

**Note:** If Google/Gemini AI tools reference CourtListener API, they should use v4 endpoints for best compatibility.
