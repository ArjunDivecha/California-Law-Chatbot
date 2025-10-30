# California Law Chatbot

A sophisticated AI-powered legal research assistant specializing in California law, featuring real-time integration with authoritative legal databases and comprehensive citation verification.

## 🎯 Overview

This chatbot combines Google's Gemini 2.5 Flash-Lite (generator) with Anthropic's Claude Haiku 4.5 (verifier) and direct access to official California legal sources to provide accurate, well-researched answers to legal questions. It automatically detects case law queries and searches CourtListener's database of millions of court opinions, while providing verified citations to official legal codes and statutes.

## ✨ Key Features

### 🤖 AI-Powered Legal Analysis
- **Generator**: Google Gemini 2.5 Flash-Lite for fast legal research and answer generation (8.8s avg response time)
- **Verifier**: Anthropic Claude Haiku 4.5 for claim verification and fact-checking (13.3s avg response time)
- Two-pass verification system for accuracy
- Contextual understanding of California law
- Comprehensive explanations with proper citations
- Intelligent query analysis and response generation

### 🏛️ CourtListener Integration
- **✅ Fully Implemented**: Real-time case law searches from CourtListener database
- Automatic detection of case law queries (keywords like "v.", "case", "court", "opinion")
- Access to millions of California court opinions
- Enhanced analysis with actual court case data

### 📋 Legislative Research (Partial Implementation)
- **⚠️ API Handlers Ready**: OpenStates and LegiScan API endpoints implemented
- **🔄 Integration Pending**: Legislative data fetching in chat service needs completion
- Designed for California bill tracking and statute text retrieval
- Framework for comprehensive legislative information access

### 🔍 Smart Legal Source Detection
- **CourtListener Enhanced** responses (blue badge) - Real case law data from CourtListener
- **Legal Sources Included** responses (green badge) - Official California legal sources
- Automatic citation linking to official legal documents
- Response verification against primary legal sources

### 📚 Comprehensive Legal Coverage
Supports citations for:
- California Penal Code
- California Civil Code
- California Family Code
- California Vehicle Code
- California Business & Professions Code
- California Government Code
- California Health & Safety Code
- California Labor Code
- California Corporations Code
- California Evidence Code
- California Code of Civil Procedure
- California Constitution
- Judicial Council Forms (FL, DV, CR series)
- CALCRIM Jury Instructions
- CACI Jury Instructions
- Attorney General Opinions

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React UI      │    │  Gemini AI       │    │  Legal APIs     │
│   (Frontend)    │◄──►│  (Backend)       │◄──►│  (External)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                       │
                              │                       │
                              ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Verification   │    │ API Handlers    │
                       │   Engine        │    │ (Partial)       │
                       └─────────────────┘    └─────────────────┘
                                                │      │      │
                                                ▼      ▼      ▼
                                         ┌─────────┬──────┬──────┐
                                         │ Court-  │ Open- │ Legi- │
                                         │ Listener│ States│ Scan │
                                         │ ✅ Full │ ⚠️ API │ ⚠️ API │
                                         │         │ Handler│ Handler│
                                         └─────────┴──────┴──────┘
```

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Engine**: 
  - **Generator**: Google Gemini 2.5 Flash-Lite (fastest model, 8.8s avg)
  - **Verifier**: Anthropic Claude Haiku 4.5 (fast verification, 13.3s avg)
- **Styling**: Tailwind CSS (via inline styles)
- **APIs**: CourtListener API v4, LegiScan API, OpenStates API
- **Deployment**: Vercel-ready configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key (for Gemini 2.5 Flash-Lite generator)
- Anthropic API key (for Claude Haiku 4.5 verifier)
- CourtListener API key (optional, enhances functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ArjunDivecha/California-Law-Chatbot.git
   cd California-Law-Chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```env
   # Required: Anthropic API key (for Claude Sonnet 4.5 generator)
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   
   # Required: Google Gemini API key (for Gemini 2.5 Pro verifier)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: CourtListener API key for enhanced case law searches
   COURTLISTENER_API_KEY=your_courtlistener_api_key_here

   # Optional: Legislative research APIs (integration pending)
   OPENSTATES_API_KEY=your_openstates_api_key_here
   LEGISCAN_API_KEY=your_legiscan_api_key_here
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to `http://localhost:5173`

## ⚙️ Configuration

### Required API Keys

#### Anthropic API (Required - Generator)
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create a new API key
3. Add it to your `.env` file as `ANTHROPIC_API_KEY`
4. Used by Claude Sonnet 4.5 for generating legal research answers

#### Google Gemini API (Required - Verifier)
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`
4. Used by Gemini 2.5 Pro for verifying claims against sources

#### OpenStates API (Optional)
1. Visit [OpenStates API](https://openstates.org/api/)
2. Register for a free API key
3. Add it to your `.env` file as `OPENSTATES_API_KEY`

#### LegiScan API (Optional)
1. Visit [LegiScan API](https://legiscan.com/legiscan)
2. Register for a free API key (30,000 queries/month free tier)
3. Add it to your `.env` file as `LEGISCAN_API_KEY`

### Optional API Keys

The chatbot infrastructure supports these APIs, but integration is incomplete:
- **LegiScan API**: For comprehensive bill text retrieval (handler exists, integration pending)
- **OpenStates API**: For California legislative information (handler exists, integration pending)

**Note**: While the API handlers are implemented, the `fetchLegislationData` method in the chat service needs to be completed to fully integrate legislative research.

## 💡 Usage

### Basic Interaction

1. **Ask legal questions** in natural language:
   - "What are the penalties for burglary in California?"
   - "How does California define domestic violence?"
   - "What is Penal Code section 459?"

2. **Case law queries** are automatically detected:
   - "What was the ruling in People v. Anderson?"
   - "Search for cases about Miranda rights in California"

3. **View responses** with automatic citations and source links

### Response Types

- **CourtListener Enhanced** (🔵 Blue badge): Real case law data retrieved
- **Legal Sources Included** (🟢 Green badge): Official California legal sources
- **General AI Response** (No badge): Based on AI training data

### Verification Features

- Responses include verification status
- ⚠️ Warning badges for claims requiring additional verification
- Direct links to official legal sources
- Console logging for debugging query detection

## 🔧 Development

### Project Structure

```
california-law-chatbot/
├── api/                    # API integration modules
│   ├── courtlistener-search.ts  # ✅ Complete CourtListener handler
│   ├── legiscan-search.ts       # ✅ LegiScan API handler (ready)
│   └── openstates-search.ts     # ✅ OpenStates API handler (ready)
├── components/             # React components
│   ├── ChatInput.tsx
│   ├── ChatWindow.tsx
│   └── Message.tsx
├── gemini/                # AI service layer
│   └── chatService.ts     # ⚠️ Missing fetchLegislationData method
├── hooks/                 # React hooks
│   └── useChat.ts
├── services/              # Service layer
│   └── geminiService.ts   # Empty file
├── types.ts               # TypeScript type definitions
├── App.tsx               # Main application component
├── index.tsx             # Application entry point
└── package.json          # Dependencies and scripts
```

### Implementation Status

#### ✅ Fully Implemented
- CourtListener API v4 integration
- React frontend with chat interface
- Response verification engine
- Legal citation parsing and linking
- Case law query detection

#### ⚠️ Partially Implemented
- OpenStates API handler (`/api/openstates-search`)
- LegiScan API handler (`/api/legiscan-search`)
- Legislative data structures

#### 🔄 Pending Implementation
- `fetchLegislationData` method in `ChatService`
- Integration of legislative APIs into chat flow
- Legislative query detection and processing

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm run test         # Run test suite (if configured)
```

### Completing Legislative Integration

To fully enable OpenStates and LegiScan integration, implement the missing `fetchLegislationData` method in `gemini/chatService.ts`:

```typescript
private async fetchLegislationData(message: string): Promise<{ sources: Source[]; context?: string }> {
    try {
        // Call OpenStates API
        const openStatesResponse = await fetch(`/api/openstates-search?q=${encodeURIComponent(message)}`);
        const openStatesData = await openStatesResponse.json();

        // Call LegiScan API
        const legiScanResponse = await fetch(`/api/legiscan-search?q=${encodeURIComponent(message)}`);
        const legiScanData = await legiScanResponse.json();

        // Process and combine results
        const sources: Source[] = [];
        let context = '';

        // Process OpenStates results
        if (openStatesData.items) {
            openStatesData.items.forEach((item: any) => {
                sources.push({
                    title: `${item.identifier}: ${item.title}`,
                    url: item.url
                });
            });
            context += `OpenStates results: ${openStatesData.items.length} bills found.\\n`;
        }

        // Process LegiScan results
        // Add similar processing logic for LegiScan data

        return { sources, context };
    } catch (error) {
        console.error('Failed to fetch legislation data:', error);
        return { sources: [] };
    }
}
```

### API Integration Details

#### CourtListener API v4 ✅
- **Status**: Fully integrated
- **Endpoint**: `https://www.courtlistener.com/api/rest/v4/`
- **Features**: Case law search, opinion retrieval, citation lookup
- **Rate Limits**: Free tier with reasonable limits
- **Authentication**: API key required
- **Implementation**: `/api/courtlistener-search.ts`

#### OpenStates API ⚠️
- **Status**: Handler implemented, integration pending
- **Endpoint**: `https://v3.openstates.org/bills`
- **Features**: California legislative bills, status tracking, bill text
- **Rate Limits**: Free API key required
- **Authentication**: X-API-KEY header
- **Implementation**: `/api/openstates-search.ts`

#### LegiScan API ⚠️
- **Status**: Handler implemented, integration pending
- **Endpoint**: `https://api.legiscan.com/`
- **Features**: Comprehensive legislative data, bill text, amendments
- **Rate Limits**: 30,000 queries/month free tier
- **Authentication**: API key in query parameters
- **Implementation**: `/api/legiscan-search.ts`

#### Legal Source Detection
The system automatically parses AI responses for legal citations and creates direct links to:
- California Legislature codes
- CourtListener case opinions
- Judicial Council forms
- CALCRIM/CACI jury instructions

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (for Claude Sonnet 4.5 generator)
   - `GEMINI_API_KEY`: Your Google Gemini API key (for Gemini 2.5 Pro verifier)
   - `COURTLISTENER_API_KEY`: Your CourtListener API key (optional)
3. **Deploy automatically** on git push

### Manual Deployment

```bash
# Build the application
npm run build

# Serve the dist/ directory with any static server
# Example with Vercel CLI
npm i -g vercel
vercel --prod
```

## 🔒 Security & Privacy

- API keys are stored securely server-side
- No user data is persisted
- All legal research is performed in real-time
- Responses include verification warnings for unverified claims

## ⚖️ California State Bar Compliance

This chatbot is designed to comply with the [California State Bar's Practical Guidance for the Use of Generative Artificial Intelligence in the Practice of Law](https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf).

### Key Compliance Features

#### ✅ Confidentiality Protection
- **Prominent warnings** against inputting confidential client information
- **Guidance on anonymization** of client data before use
- **Disclosure** that data is transmitted to third-party AI services (Google Gemini)
- **No persistent storage** of user queries or conversations

#### ✅ Competence & Diligence
- **Verification system** checks AI outputs against authoritative sources
- **Source citations** provided for all legal claims
- **Warning badges** indicate when verification is needed
- **Explicit disclaimers** that outputs require attorney review

#### ✅ AI Disclosure
- **Initial disclosure modal** explains use of Google Gemini AI
- **Risks disclosed** including hallucinations, inaccuracies, and bias
- **Technology transparency** about data transmission to third parties

#### ✅ Court Filing Compliance
- **Warnings** about court submission requirements
- **Guidance** on verifying citations and checking court rules
- **Reminders** to review all content before submission

### For Attorneys & Law Firms

**Before using this tool:**

1. **Review the initial disclosure** - Understand how generative AI is used
2. **Anonymize client data** - Never input confidential client information
3. **Review all outputs** - Every AI-generated response must be reviewed by a qualified attorney
4. **Verify citations** - Check all legal citations against primary sources
5. **Check court rules** - Verify local court rules for AI disclosure requirements
6. **Consult IT professionals** - Before using with any confidential information, consult cybersecurity experts

**Client Communication:**
- Consider disclosing to clients that generative AI will be used in their representation
- Explain benefits and risks of AI use
- Review any client instructions that may restrict AI use

**Supervision:**
- Law firms should establish policies on permissible AI use
- Provide training on ethical and practical aspects of AI
- Supervise lawyers and nonlawyers using AI tools

### Limitations & Risks

- **AI Hallucinations**: The system may generate false citations or legal authorities
- **Inaccuracies**: Information may be incomplete, outdated, or incorrect
- **Bias**: AI systems may reflect biases in training data
- **No Professional Judgment**: AI cannot replace attorney analysis and judgment
- **Third-Party Data Transmission**: Queries are transmitted to Google's servers

### Safe Usage Guidelines

1. **Never input confidential client information**
2. **Anonymize all client data** before use
3. **Use as a research starting point only**
4. **Always verify** against primary legal sources
5. **Have a qualified attorney review** all outputs
6. **Supplement AI research** with traditional legal research
7. **Check for court disclosure requirements** before filing

**Related Documentation:**
- [COMPLIANCE_ANALYSIS.md](./COMPLIANCE_ANALYSIS.md) - Detailed compliance analysis
- [PRIVACY_AND_CONFIDENTIALITY.md](./PRIVACY_AND_CONFIDENTIALITY.md) - Confidentiality guidelines and anonymization practices
- [GEMINI_API_REVIEW.md](./GEMINI_API_REVIEW.md) - Google Gemini API Terms of Use and data handling review

## ⚖️ Legal Disclaimer

**⚠️ CRITICAL WARNING: NOT LEGAL ADVICE**

This chatbot provides general legal information and research assistance. It is **NOT a substitute for professional legal counsel** and should **NOT be considered legal advice**.

**IMPORTANT:**
- **This tool uses Google Gemini AI**, a generative artificial intelligence system
- **AI systems may produce inaccurate, incomplete, or biased information**
- **AI may "hallucinate" or generate false citations and legal authorities**
- **All outputs MUST be reviewed and verified by a qualified attorney**
- **Professional judgment cannot be delegated to AI systems**
- **No attorney-client relationship** is created by using this tool
- **DO NOT input confidential client information** - anonymize all data before use

**For Court Filings:**
- Review all AI-generated content for accuracy before submission
- Verify all citations against primary legal sources
- Check applicable court rules for AI disclosure requirements
- Correct any errors or misleading statements

**Always verify responses against official sources:**
- California Legislature: [leginfo.legislature.ca.gov](https://leginfo.legislature.ca.gov/)
- California Courts: [courts.ca.gov](https://courts.ca.gov/)
- CourtListener: [courtlistener.com](https://www.courtlistener.com/)

**Laws change frequently** - verify current status of any legal information. **Always consult qualified attorneys** for your specific situation.

### Information Verification

**Always verify responses against official sources:**
- California Legislature: [leginfo.legislature.ca.gov](https://leginfo.legislature.ca.gov/)
- California Courts: [courts.ca.gov](https://courts.ca.gov/)
- CourtListener: [courtlistener.com](https://www.courtlistener.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Add proper error handling
- Include comprehensive logging
- Test API integrations
- Update documentation

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for advanced language processing
- **Free Law Project** (CourtListener) for comprehensive case law database
- **OpenStates** and **LegiScan** for legislative data access
- **California Legislature** for official legal code access

## 📞 Support

For technical issues or feature requests:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include browser console logs for debugging

---

**Last Updated**: October 27, 2025 (Updated to reflect OpenStates/LegiScan integration status)
