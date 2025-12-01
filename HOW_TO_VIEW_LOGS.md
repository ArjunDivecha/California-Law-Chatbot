# How to View Application Logs

## 📊 Vercel Deployment Logs (Production)

### Option 1: Vercel Dashboard (Easiest)

1. **Go to Vercel Dashboard**:
   - Visit: https://vercel.com/dashboard
   - Sign in to your account

2. **Navigate to Your Project**:
   - Click on "California-Law-Chatbot" project
   - Or go directly to: https://vercel.com/[your-username]/california-law-chatbot

3. **View Logs**:
   - Click on the **"Deployments"** tab
   - Click on the latest deployment (should show "Ready" status)
   - Click on the **"Functions"** tab or **"Logs"** tab
   - You'll see real-time logs from your API endpoints

4. **Filter Logs**:
   - Look for logs from `/api/gemini-chat` or `/api/gemini-generate`
   - Search for keywords like "gemini-3-pro", "fallback", "Success", etc.

### Option 2: Vercel CLI (Command Line)

```bash
# View logs for your project
vercel logs

# Follow logs in real-time
vercel logs --follow

# Filter by function
vercel logs --function api/gemini-chat

# View logs for specific deployment
vercel logs [deployment-url]
```

### What to Look For in Logs:

**Successful Gemini 3 Pro Usage:**
```
✅ Success with gemini-3-pro-preview
🤖 Initializing chat with model: gemini-3-pro-preview
📤 Sending message to gemini-3-pro-preview...
```

**Fallback Triggered:**
```
⚠️  Failed with gemini-3-pro-preview: [error message]
🔄 Falling back to gemini-2.5-pro due to capacity error...
✅ Success with fallback model gemini-2.5-pro
```

**Errors:**
```
❌ Fallback model also failed: [error]
Gemini Chat API error: [error details]
```

---

## 🌐 Browser Console Logs (Client-Side)

### How to Access:

1. **Open Your App**:
   - Go to: https://california-law-chatbot-20n8hw5vp.vercel.app
   - Or your local dev: http://localhost:5173

2. **Open Developer Tools**:
   - **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox**: Press `F12` or `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
   - **Safari**: Enable Developer menu first, then `Cmd+Option+C`

3. **View Console Tab**:
   - Click on the **"Console"** tab
   - You'll see client-side logs and any JavaScript errors

4. **View Network Tab**:
   - Click on the **"Network"** tab
   - Filter by "Fetch/XHR" to see API calls
   - Click on any `/api/gemini-chat` or `/api/gemini-generate` request
   - Check the "Response" tab to see the `model` field indicating which model was used

### What to Look For:

**Client-Side Logs:**
```
🔀 Routing to hybrid mode
💬 Sending regular chat message to Gemini 3 Pro (with fallback to 2.5 Pro)...
```

**API Response:**
```json
{
  "text": "...",
  "model": "gemini-3-pro-preview"  // or "gemini-2.5-pro"
}
```

---

## 💻 Local Development Logs

### If Running `vercel dev`:

1. **Terminal Output**:
   - The terminal where you ran `vercel dev` shows all logs
   - Look for API endpoint logs directly in the terminal

2. **Vite Dev Server**:
   - Browser console shows client-side logs
   - Network tab shows API requests

### Example Local Logs:

```
> vercel dev
...
[API] POST /api/gemini-chat
🤖 Initializing chat with model: gemini-3-pro-preview
📤 Sending message to gemini-3-pro-preview...
✅ Success with gemini-3-pro-preview
```

---

## 🔍 Quick Log Check Commands

### Check Latest Deployment Status:
```bash
vercel ls
```

### View Recent Logs:
```bash
vercel logs --follow
```

### Check Specific Function:
```bash
vercel logs --function api/gemini-generate
```

---

## 📝 Log Message Reference

### Model Selection Logs:
- `🤖 Initializing chat with model: gemini-3-pro-preview` - Using primary model
- `✅ Success with gemini-3-pro-preview` - Primary model succeeded
- `⚠️  Failed with gemini-3-pro-preview: [error]` - Primary model failed
- `🔄 Falling back to gemini-2.5-pro due to capacity error...` - Fallback triggered
- `✅ Success with fallback model gemini-2.5-pro` - Fallback succeeded
- `❌ Fallback model also failed` - Both models failed

### API Call Logs:
- `Calling Gemini API with model: gemini-3-pro-preview` - API call started
- `📡 Using streaming mode for real-time response...` - Streaming enabled
- `✅ Google Search grounding was used!` - Grounding feature active

---

## 🎯 Best Practice

**For Production Testing:**
1. Use Vercel Dashboard → Deployments → Latest → Logs
2. Keep it open while testing
3. Send a test message in the app
4. Watch logs appear in real-time

**For Debugging:**
1. Use Browser Console (F12) for client-side issues
2. Use Vercel Logs for server-side/API issues
3. Check Network tab to see API request/response details

