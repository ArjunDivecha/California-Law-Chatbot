# Deployment Guide - Updated Models

## 🚀 Quick Deploy to Vercel

### 1. Build and Test Locally (Optional)
```bash
yarn install
yarn build
vercel dev  # Test locally on http://localhost:3000
```

### 2. Deploy to Vercel
```bash
vercel --prod
```

### 3. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and add:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
COURTLISTENER_API_KEY=your_courtlistener_key_here  # Optional
```

**CRITICAL**: After adding environment variables, you MUST redeploy:
```bash
vercel --prod
```

## 📝 Environment Variable Details

### GEMINI_API_KEY (Required)
- **Purpose**: Generator model (Gemini 2.5 Flash-Lite)
- **Get it**: https://aistudio.google.com/apikey
- **Used in**: `/api/gemini-generate.ts`

### ANTHROPIC_API_KEY (Required)
- **Purpose**: Verifier model (Claude Haiku 4.5)
- **Get it**: https://console.anthropic.com/
- **Used in**: `/api/claude-chat.ts`

### COURTLISTENER_API_KEY (Optional)
- **Purpose**: Case law search enhancement
- **Get it**: https://www.courtlistener.com/help/api/
- **Used in**: `/api/courtlistener-search.ts`

## ✅ Verification Checklist

After deployment, test these scenarios:

### Test 1: Basic Legal Query
```
Query: "Tell me about prenups in California"
Expected: 
- Fast response (~9 seconds for generation)
- Comprehensive answer with Family Code references
- Verification report showing claim validation
```

### Test 2: Code Section Detection
```
Query: "What does Family Code § 1615 say?"
Expected:
- Direct link to leginfo.legislature.ca.gov created
- Specific code section information
- Blue "CourtListener Enhanced" or green "Legal Sources" badge
```

### Test 3: Case Law Query
```
Query: "Smith v. Jones California case"
Expected:
- CourtListener API search triggered
- Case law results from database
- "CourtListener Enhanced" blue badge
```

## 📊 Expected Performance

| Operation | Expected Time | Model Used |
|-----------|--------------|------------|
| Generation | ~8-9 seconds | Gemini 2.5 Flash-Lite |
| Verification | ~13 seconds | Claude Haiku 4.5 |
| Total Response | ~22 seconds | Both models |

## 🐛 Troubleshooting

### Problem: 500 Internal Server Error

**Check:**
1. Are environment variables set in Vercel?
2. Did you redeploy after setting env vars?
3. Check Vercel function logs for specific errors

**Solution:**
```bash
# Verify env vars are set
vercel env ls

# Redeploy
vercel --prod
```

### Problem: "GEMINI_API_KEY is not set"

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `GEMINI_API_KEY` with your API key
3. Select all environments (Production, Preview, Development)
4. Save and redeploy

### Problem: Slow responses (>30 seconds)

**Check:**
1. Vercel function timeout (default 10s for Hobby, 60s for Pro)
2. API rate limits
3. Network issues

**Solution:**
- Upgrade to Vercel Pro for longer timeouts
- Check API usage quotas
- Monitor Vercel function logs

### Problem: No verification happening

**Check:**
1. Console logs for "Calling Claude API" message
2. ANTHROPIC_API_KEY is set
3. Vercel function logs for errors

**Solution:**
- Ensure Claude API endpoint (`/api/claude-chat.ts`) is deployed
- Verify API key is valid
- Check for model access issues

## 📱 Monitor Deployment

### View Logs
```bash
vercel logs --follow
```

### Check Function Performance
1. Go to Vercel Dashboard
2. Click on your project
3. Navigate to "Analytics" or "Functions"
4. Monitor response times and errors

## 🔄 Rolling Back

If issues occur, roll back to previous deployment:

1. Go to Vercel Dashboard
2. Click "Deployments"
3. Find last working deployment
4. Click "..." → "Promote to Production"

## 📈 Post-Deployment Monitoring

Monitor these metrics:
- ✅ Average response time (~22 seconds expected)
- ✅ Error rate (should be < 1%)
- ✅ API usage (stay within quotas)
- ✅ User feedback on response quality

## 🎯 Success Criteria

Deployment is successful when:
1. ✅ Build completes without errors
2. ✅ Environment variables are set
3. ✅ Test query returns response in ~22 seconds
4. ✅ Verification report appears
5. ✅ Code section links work
6. ✅ No 500 errors in console
7. ✅ SVG viewBox errors are gone

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Review browser console for client-side errors
3. Test API endpoints individually:
   - `https://your-domain.vercel.app/api/gemini-generate`
   - `https://your-domain.vercel.app/api/claude-chat`
4. Verify environment variables are accessible in functions

---

**Ready to deploy?**
```bash
vercel --prod
```

Then test it and enjoy your blazing-fast California Law Chatbot! 🚀⚡

