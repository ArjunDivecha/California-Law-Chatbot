# California Law Chatbot

A sophisticated AI-powered legal research assistant specializing in California law, featuring real-time integration with authoritative legal databases and comprehensive citation verification.

## 🎯 Overview

This chatbot combines Google's Gemini 3 Pro (generator, via OpenRouter) with Anthropic's Claude Sonnet 4.5 (verifier, via OpenRouter) and direct access to official California legal sources to provide accurate, well-researched answers to legal questions. It automatically detects case law queries and searches CourtListener's database of millions of court opinions, while providing verified citations to official legal codes and statutes.

## ✨ Key Features

### 🤖 AI-Powered Legal Analysis
- **Generator**: Google Gemini 3 Pro (primary) via OpenRouter for comprehensive legal research and answer generation
- **Fallback**: Google Gemini 2.5 Pro via OpenRouter (automatic fallback when primary model returns empty)
- **Verifier**: Anthropic Claude Sonnet 4.5 via OpenRouter for claim verification and fact-checking
- **Research Agent**: Anthropic Claude Haiku 4.5 via OpenRouter for fast research tasks
- **Embeddings**: Native OpenAI API (`text-embedding-3-small`) for CEB document search
- Two-pass verification system for accuracy
- Contextual understanding of California law
- Comprehensive explanations with proper citations
- Intelligent query analysis and response generation
- **ZDR Compliance**: All models support Zero Data Retention policies where available

### 📚 CEB (Continuing Education of the Bar) Integration
- **✅ Fully Implemented**: Authoritative CEB practice guides integrated as primary RAG source
- **5 Legal Verticals**: Trusts & Estates (40,263 chunks), Family Law (7,511 chunks), Business Litigation (13,711 chunks), Business Entities (10,766 chunks), Business Transactions (7,517 chunks)
- **Total Coverage**: 77,406 vector embeddings from 2,554 PDF documents
- **3 Source Modes**:
  - **📚 CEB Only**: Authoritative CEB practice guides only (fastest, no verification needed)
  - **🔄 Hybrid**: CEB + case law + legislation (recommended, most comprehensive)
  - **🤖 AI Only**: Case law, legislation, and web search (no CEB)
- **Vector Database**: Upstash Vector for fast semantic search
- **Smart Category Detection**: Automatically routes queries to relevant CEB verticals
- **CEB Verified Badge**: Responses from CEB sources display authoritative badge (no verification needed)

### 🏛️ CourtListener Integration
- **✅ Fully Implemented**: Real-time case law searches via CourtListener API v4 (`/api/rest/v4/search/`)
- Automatic detection of case law queries (keywords like "v.", "case", "court", "opinion")
- California filtering uses CourtListener’s `court_id:<abbrev>` query operators (e.g., `court_id:cal`, `court_id:calctapp`)
- Enhanced analysis with actual court case data

### 📋 Legislative Research ✅ (Harvey Upgrade #1)
- **✅ Fully Integrated**: OpenStates and LegiScan APIs wired into main chat flow
- Automatic detection of legislative queries ("bills passed", "statute", "legislature", "AB 123", "SB 456")
- Real-time California bill tracking and statute text retrieval
- Seamless integration with verification and response generation pipeline
- Response times: 500-900ms for legislative queries

### 🔍 Smart Legal Source Detection
- **CourtListener Enhanced** responses (blue badge) - Real case law data from CourtListener
- **Legal Sources Included** responses (green badge) - Official California legal sources
- Automatic citation linking to official legal documents
- Response verification against primary legal sources

### 📜 Statutory Citation Pre-Filter ✅ (Harvey Upgrade #2)
- **✅ Implemented**: Automatic detection and parsing of California code citations
- Parses 29 California codes: Family Code, Probate Code, Penal Code, Civil Code, etc.
- Handles formats: "Family Code section 1615", "Cal. Fam. Code § 1615(a)", "FAM § 1615"
- Query boost: Statutory terms automatically boosted for better semantic matching
- Direct links to leginfo.legislature.ca.gov for each statute
- Response times: 230-1400ms with pre-filter active

### 🔗 Citation Verification ✅ (Harvey Upgrade #3)
- **✅ Implemented**: Real-time citation verification against CourtListener database
- Supports California and Federal case citations
- Verifies format accuracy and existence of cases
- Direct links to full case opinions on CourtListener
- Integration with verifier service for claim validation
- Response times: 550-1270ms for citation verification

### 🏳️‍🌈 LGBT Practice Area Features ✅ (Harvey Upgrade #4)
- **✅ Implemented**: Specialized query expansion for LGBT family law topics
- Enhanced keywords: same-sex couples, domestic partners, parentage, adoption
- Automatic expansion: Queries mention "same-sex" → adds "registered domestic partner", "Cal. Fam. Code 297"
- Optimized search: Better results for LGBT-specific legal scenarios
- Coverage includes: Same-sex marriage, domestic partnerships, parentage, surrogacy, donor agreements
- Support for: Second parent adoption, stepparent adoption, co-parent rights

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
                                         │ ✅ Full │ ✅ Fully│ ✅ Fully│
                                         │         │ Integrated │ Integrated│
                                         └─────────┴──────┴──────┘
```

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Engine**: 
  - **Generator**: Google Gemini 3 Pro via OpenRouter (primary, deeper reasoning)
  - **Fallback**: Google Gemini 2.5 Pro via OpenRouter (automatic fallback)
  - **Verifier**: Anthropic Claude Sonnet 4.5 via OpenRouter (comprehensive claim verification)
  - **Research**: Anthropic Claude Haiku 4.5 via OpenRouter (fast research tasks)
  - **Embeddings**: Native OpenAI API `text-embedding-3-small` (for CEB RAG)
- **API Routing**: OpenRouter for unified AI model access (ZDR-compliant endpoints)
- **Vector Database**: Upstash Vector (for CEB document search)
- **Styling**: Tailwind CSS (via inline styles)
- **APIs**: CourtListener API v4, LegiScan API, OpenStates API
- **Data Processing**: Python scripts for PDF processing and embedding generation
- **Deployment**: Vercel-ready configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenRouter API key (for Gemini and Claude models via OpenRouter)
- OpenAI API key (for embeddings via native OpenAI API)
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
   # Required: OpenRouter API key (for Gemini 3 Pro, Gemini 2.5 Pro, Claude Sonnet 4.5, Claude Haiku 4.5)
   OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
   
   # Required: OpenAI API key (for embedding generation via native OpenAI API)
   OPENAI_API_KEY=sk-proj-your_openai_key_here

   # Required: Upstash Vector credentials (for CEB vector database)
   UPSTASH_VECTOR_REST_URL=https://your-index.upstash.io
   UPSTASH_VECTOR_REST_TOKEN=your_upstash_token_here

   # Optional: CourtListener API key for enhanced case law searches
   COURTLISTENER_API_KEY=your_courtlistener_api_key_here

   # Optional: Legislative research APIs (fully integrated - enables legislative query detection)
   OPENSTATES_API_KEY=your_openstates_api_key_here
   LEGISCAN_API_KEY=your_legiscan_api_key_here
   
   # Legacy keys (kept for backward compatibility, not actively used)
   GEMINI_API_KEY=your_gemini_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to `http://localhost:5173`

## ⚙️ Configuration

### Required API Keys

#### OpenRouter API (Required - AI Models)
1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Create an account and generate an API key
3. Add it to your `.env` file as `OPENROUTER_API_KEY`
4. Used for:
   - **Gemini 3 Pro** (primary generator): `google/gemini-3-pro-preview`
   - **Gemini 2.5 Pro** (fallback generator): `google/gemini-2.5-pro`
   - **Claude Sonnet 4.5** (verifier): `anthropic/claude-sonnet-4.5`
   - **Claude Haiku 4.5** (research agent): `anthropic/claude-haiku-4.5`
5. **ZDR Support**: Enable Zero Data Retention in OpenRouter settings for privacy compliance
6. **Cost**: Pay-per-use pricing, typically $0.10-0.50 per document

#### OpenAI API (Required - Embeddings)
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file as `OPENAI_API_KEY`
4. Used for generating embeddings via **native OpenAI API** (`text-embedding-3-small` model)
5. **Why Native API**: Better reliability and direct control over data retention policies
6. **Cost**: ~$0.00002 per 1K tokens (very affordable)

#### Upstash Vector (Required - CEB Database)
1. Visit [Upstash Console](https://console.upstash.com/)
2. Create a new Vector database
3. Set dimension to **1536** (for `text-embedding-3-small`)
4. Set metric to **cosine**
5. Copy the REST URL and token
6. Add to your `.env` file:
   - `UPSTASH_VECTOR_REST_URL`: Your vector database URL
   - `UPSTASH_VECTOR_REST_TOKEN`: Your vector database token
7. Used to store and search 77,406 CEB document embeddings

#### OpenStates API (Optional)
1. Visit [OpenStates API](https://openstates.org/api/)
2. Register for a free API key
3. Add it to your `.env` file as `OPENSTATES_API_KEY`

#### LegiScan API (Optional)
1. Visit [LegiScan API](https://legiscan.com/legiscan)
2. Register for a free API key (30,000 queries/month free tier)
3. Add it to your `.env` file as `LEGISCAN_API_KEY`

### Recommended API Keys

These APIs enable key features and are fully integrated:
- **OpenStates API**: For California legislative information ✅ Fully integrated
  - Enables legislative query detection and real-time bill tracking
  - Recommended for comprehensive research on California legislation

- **LegiScan API**: For comprehensive bill text retrieval ✅ Fully integrated
  - Provides detailed bill information and amendments
  - Recommended for in-depth legislative research

- **CourtListener API**: For enhanced case law searches
  - Improves quality of case law results (optional but recommended)

**Note**: While CourtListener is optional, OpenStates and LegiScan APIs are recommended for comprehensive legislative research capabilities.

## 💡 Usage

### Source Mode Selection

Before asking questions, select your preferred source mode using the mode selector in the header:

- **📚 CEB Only**: Fastest mode, uses only authoritative CEB practice guides (no verification needed)
  - Best for: Trusts & Estates, Family Law, Business Litigation, Business Entities, Business Transactions questions
  - Responses marked with "CEB VERIFIED" badge
  
- **🔄 Hybrid** (Recommended): Combines CEB practice guides with case law and legislation
  - Best for: Comprehensive legal research combining authoritative guides with current case law
  - Responses include both CEB sources and external legal sources
  
- **🤖 AI Only**: Uses case law, legislation, and web search only (no CEB)
  - Best for: General legal research or when CEB coverage is insufficient
  - Standard verification applies

### Basic Interaction

1. **Select your source mode** using the mode selector buttons

2. **Ask legal questions** in natural language:
   - "How do I establish a revocable living trust in California?" (CEB Only recommended)
   - "What are the penalties for burglary in California?"
   - "How does California define domestic violence?"
   - "What is Penal Code section 459?"

3. **Case law queries** are automatically detected (in Hybrid or AI Only modes):
   - "What was the ruling in People v. Anderson?"
   - "Search for cases about Miranda rights in California"

4. **View responses** with automatic citations and source links

### Response Types

- **CEB VERIFIED** (🟡 Amber badge with 📚 icon): Authoritative CEB practice guide source (no verification needed)
- **CourtListener Enhanced** (🔵 Blue badge): Real case law data retrieved
- **Legal Sources Included** (🟢 Green badge): Official California legal sources
- **Mode Badge**: Shows which mode was used (CEB Only, AI Only, or Hybrid Mode)

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
│   ├── ceb-search.ts            # ✅ CEB vector search endpoint
│   ├── courtlistener-search.ts  # ✅ Complete CourtListener handler
│   ├── gemini-chat.ts           # ✅ Gemini chat API
│   ├── claude-chat.ts            # ✅ Claude verifier API
│   ├── legiscan-search.ts       # ✅ LegiScan API handler (ready)
│   └── openstates-search.ts      # ✅ OpenStates API handler (ready)
├── components/             # React components
│   ├── ChatInput.tsx
│   ├── ChatWindow.tsx
│   ├── Message.tsx
│   ├── SourceModeSelector.tsx   # ✅ Source mode selector (CEB/AI/Hybrid)
│   └── CEBBadge.tsx             # ✅ CEB verified badge component
├── gemini/                # AI service layer
│   └── chatService.ts     # ✅ Complete with CEB integration
├── hooks/                 # React hooks
│   └── useChat.ts         # ✅ Includes source mode management
├── services/              # Service layer
│   ├── verifierService.ts # ✅ Verification engine
│   └── confidenceGating.ts
├── scripts/               # Data processing scripts
│   ├── process_ceb_pdfs.py      # ✅ PDF text extraction & chunking
│   ├── generate_embeddings.py   # ✅ OpenAI embedding generation
│   ├── upload_to_upstash.py     # ✅ Vector database upload
│   └── requirements.txt         # Python dependencies
├── data/                  # Processed CEB data
│   └── ceb_processed/     # Per-vertical processed chunks & embeddings
├── types.ts               # TypeScript type definitions (includes CEB types)
├── App.tsx               # Main application component
├── index.tsx             # Application entry point
└── package.json          # Dependencies and scripts
```

### Implementation Status

#### ✅ Fully Implemented

**Core Infrastructure:**
- **CEB RAG System**: Complete integration with 77,406 document embeddings across 5 verticals
  - PDF processing pipeline (extract, chunk, embed, upload)
  - Upstash Vector database integration
  - Semantic search with category detection
  - Three source modes (CEB Only, AI Only, Hybrid)
  - Frontend mode selector and badges
- CourtListener API v4 integration
- React frontend with chat interface
- Response verification engine
- Legal citation parsing and linking
- Case law query detection

**Harvey Upgrade Features (All Complete):**
- **🟢 Priority 1**: Legislative Research APIs fully integrated
  - OpenStates API v3 integration (`/api/openstates-search`)
  - LegiScan API integration (`/api/legiscan-search`)
  - Automatic detection of legislative queries
  - Real-time bill tracking and statute text retrieval
  - Response times: 500-900ms

- **🟢 Priority 2**: Statutory Citation Pre-Filter
  - Inline statutory citation detection (29 California codes)
  - Query boosting with exact statutory terms
  - Direct links to leginfo.legislature.ca.gov
  - Handles: "Family Code section 1615", "Cal. Fam. Code § 1615(a)", "FAM § 1615"
  - Response times: 230-1400ms

- **🟢 Priority 3**: Citation Verification
  - `/api/verify-citations` endpoint fully functional
  - Real-time verification against CourtListener database
  - Supports California and Federal case citations
  - Integration with verifier service
  - Response times: 550-1270ms

- **🟢 Priority 4**: LGBT Practice Area Features
  - Enhanced query expansion for LGBT family law topics
  - Automatic synonym expansion for same-sex, domestic partners, parentage
  - Optimized search results for LGBT-specific scenarios
  - Support for second parent adoption, surrogacy, donor agreements

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm run test         # Run test suite (if configured)
```

### CEB Document Processing Pipeline

To add new CEB documents to the RAG system, follow these steps:

1. **Install Python dependencies**:
   ```bash
   cd scripts
   pip install -r requirements.txt
   ```

2. **Process PDFs** (extract text and create chunks):
   ```bash
   python3 process_ceb_pdfs.py \
     --category <category> \
     --input-dir "/path/to/ceb_pdfs" \
     --chunk-size 1000
   ```
   
   Categories: `trusts_estates`, `family_law`, `business_litigation`, `business_entities`, `business_transactions`
   
   Output: `data/ceb_processed/<category>/chunks.jsonl`

3. **Generate embeddings** (create vector representations):
   ```bash
   python3 generate_embeddings.py \
     --category <category> \
     --input-file data/ceb_processed/<category>/chunks.jsonl
   ```
   
   Output: `data/ceb_processed/<category>/embeddings.jsonl`
   
   **Cost**: ~$0.0001 per 1K tokens (approximately $0.01-0.20 per 1,000 chunks)

4. **Upload to Upstash Vector**:
   ```bash
   python3 upload_to_upstash.py \
     --category <category> \
     --input-file data/ceb_processed/<category>/embeddings.jsonl
   ```
   
   Requires `.env` file with:
   - `UPSTASH_VECTOR_REST_URL`
   - `UPSTASH_VECTOR_REST_TOKEN`
   - `OPENAI_API_KEY`

**Current Status**: 77,406 vectors across 5 categories are already processed and uploaded.

### Legislative API Integration ✅ (Complete)

OpenStates and LegiScan APIs are now fully integrated into the chat flow:

**Implementation Details:**
- `isLegislativeQuery()` method in `gemini/chatService.ts` automatically detects legislative queries
- Supports patterns: "bill", "legislation", "statute", "law passed", "AB 123", "SB 456", etc.
- `searchLegislativeAPIs()` method queries both APIs in parallel
- Results are formatted and included in the verification pipeline
- Responses processed through standard verification and citation linking
- Automatic detection activates legislative search for relevant queries

**Example Queries Handled:**
- "What AI bills passed in California in 2024?"
- "Recent family law legislation in California"
- "Governor signed laws 2024"
- "AB 123 status"
- "SB 456 bill text"

### API Integration Details

#### CourtListener API v4 ✅
- **Status**: Fully integrated
- **Endpoint**: `https://www.courtlistener.com/api/rest/v4/`
- **Features**: Case law search, opinion retrieval, citation lookup
- **Rate Limits**: Free tier with reasonable limits
- **Authentication**: API key required
- **Implementation**: `/api/courtlistener-search.ts`

#### OpenStates API ✅
- **Status**: Fully integrated into chat flow
- **Endpoint**: `https://v3.openstates.org/bills`
- **Features**: California legislative bills, status tracking, bill text
- **Rate Limits**: Free API key required
- **Authentication**: X-API-KEY header
- **Implementation**: `/api/openstates-search.ts` integrated into `chatService.ts`
- **Response Time**: 500-900ms for legislative queries

#### LegiScan API ✅
- **Status**: Fully integrated into chat flow
- **Endpoint**: `https://api.legiscan.com/`
- **Features**: Comprehensive legislative data, bill text, amendments
- **Rate Limits**: 30,000 queries/month free tier
- **Authentication**: API key in query parameters
- **Implementation**: `/api/legiscan-search.ts` integrated into `chatService.ts`
- **Response Time**: 500-900ms for legislative queries

#### Legal Source Detection
The system automatically parses AI responses for legal citations and creates direct links to:
- California Legislature codes
- CourtListener case opinions
- Judicial Council forms
- CALCRIM/CACI jury instructions

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard (all three environments: Production, Preview, Development):
   - `OPENROUTER_API_KEY`: Your OpenRouter API key (for Gemini and Claude models)
   - `OPENAI_API_KEY`: Your OpenAI API key (for embeddings via native API)
   - `UPSTASH_VECTOR_REST_URL`: Your Upstash Vector REST URL
   - `UPSTASH_VECTOR_REST_TOKEN`: Your Upstash Vector REST token
   - `COURTLISTENER_API_KEY`: Your CourtListener API key (optional)
   - `OPENSTATES_API_KEY`: Your OpenStates API key (optional, for legislative research)
   - `LEGISCAN_API_KEY`: Your LegiScan API key (optional, for bill text)
3. **Deploy automatically** on git push

**Important**: After adding environment variables, you must redeploy for changes to take effect.

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

**Last Updated**: January 31, 2026 (OpenRouter migration complete: Gemini 3 Pro primary, Gemini 2.5 Pro fallback, native OpenAI embeddings, ZDR compliance support)
