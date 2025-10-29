# SECURITY IMPROVEMENTS NEEDED

## Critical Security Issue: API Key Exposure

**Current Status:** The Gemini API key is currently exposed to client-side code via `vite.config.ts`. This is a security risk because anyone can view the API key in the browser's developer tools or bundled JavaScript.

**Current Implementation:**
- `vite.config.ts` exposes `API_KEY` and `GEMINI_API_KEY` to client bundle
- `ChatService` runs client-side with direct API key access
- API key is visible in browser DevTools → Sources → bundled JS

**Proper Solution:**
All AI API calls should be made through server-side API routes where API keys remain secure.

## Migration Path

### Phase 1: Create Server-Side Chat API ✅ COMPLETED
- Created `/api/chat.ts` - server-side endpoint for Gemini API calls
- API key stays on server, never exposed to client

### Phase 2: Refactor ChatService to Use API Route ⚠️ PENDING
- Update `ChatService.sendMessage()` to call `/api/chat` instead of direct Gemini SDK
- Remove Gemini SDK from client-side code
- Remove API key from `vite.config.ts`
- Update `package.json` to remove `@google/genai` dependency (or keep only for server-side if needed)

### Phase 3: Enhanced Server-Side Features ⚠️ PENDING
- Move citation parsing to server-side
- Move CourtListener integration to server-side
- Move verification logic to server-side
- Add rate limiting
- Add request validation

## Immediate Action Required

**Before Production:**
1. Update `ChatService` to use `/api/chat` endpoint instead of direct Gemini SDK
2. Remove API key exposure from `vite.config.ts`
3. Test that all functionality still works

**Recommended Timeline:**
- High Priority: Complete Phase 2 before production deployment
- Medium Priority: Complete Phase 3 for better security and performance

## Files Modified for Security Improvements

✅ Created `/api/chat.ts` - Server-side chat endpoint  
✅ Created `/api/config.ts` - Safe configuration endpoint  
✅ Added security warnings in `chatService.ts`  
⚠️ Still needs: Refactor `ChatService` to use API routes

## Testing Checklist

- [ ] Verify `/api/chat` endpoint works correctly
- [ ] Test that ChatService can use API route instead of direct SDK
- [ ] Verify API key is no longer in client bundle
- [ ] Test all chat functionality still works
- [ ] Test error handling in API route
- [ ] Test rate limiting (if implemented)
