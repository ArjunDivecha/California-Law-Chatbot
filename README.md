<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1UH1n_Box33X_j5u6KB1u_bigEmkplW1x

## Features

### 🤖 AI-Powered Legal Analysis
- Advanced legal research using Google Gemini AI
- Contextual understanding of California law
- Comprehensive explanations with citations

### 🏛️ CourtListener Integration
- Real-time case law searches from CourtListener database
- Automatic detection of case law queries
- Enhanced analysis with actual court case data
- Access to millions of legal opinions and decisions

### 🔍 Smart Query Detection
- Automatically identifies legal questions vs. case law requests
- Keywords like "v.", "case", "court", "opinion" trigger CourtListener
- Fallback to general AI responses for other queries

### 📊 Response Indicators
- **CourtListener Enhanced** badge appears when real case law data is used
- Source links provide direct access to CourtListener case pages
- Console logging shows query detection and API usage (F12 to view)

## Verification & Sources

### 📚 Official Legal Sources
- **California Legislature**: [leginfo.legislature.ca.gov](https://leginfo.legislature.ca.gov/)
- **California Courts**: [courts.ca.gov](https://courts.ca.gov/)
- **CourtListener Database**: [courtlistener.com](https://www.courtlistener.com/)

### 🔗 API Documentation
- **Google Gemini AI**: [ai.google.dev](https://ai.google.dev/)
- **CourtListener API**: [courtlistener.com/help/api/](https://www.courtlistener.com/help/api/)

### ✅ Information Verification
All legal information provided by this chatbot should be verified against official sources. While the AI provides accurate analysis, always consult with qualified legal professionals for your specific situation.

### 🔍 How to Verify Responses

**CourtListener Enhanced Responses:**
- Look for the blue "CourtListener Enhanced" badge
- Click source links to view original case documents
- Verify information against official court records

**General AI Responses:**
- No CourtListener badge = general legal information
- Still accurate but based on AI training data
- Cross-reference with official legal sources listed above

**Console Logging (F12):**
- Open browser dev tools to see detailed logs
- Shows query detection and API usage
- Helps debug and verify system behavior

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
    `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
    `npm run dev`
