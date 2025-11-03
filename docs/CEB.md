# CEB RAG Integration - Implementation Plan

## Overview
Integrate CEB (Continuing Education of the Bar) scraped documents as the **primary authoritative source** for the California Law Chatbot. CEB content will be treated as verified legal authority and will **bypass the Claude verification system** entirely.

**Data Inventory:**
- **Trusts & Estates**: 1,687 PDFs (~950MB) ✅ **READY - START HERE**
- **Family Law**: 150 PDFs (~85MB) ⏳ **Downloading - Add Later**
- **Business Litigation**: TBD PDFs ⏳ **Downloading - Add Later**
- **Location**: `/Users/macbook2024/Library/CloudStorage/Dropbox/AAA Backup/A Working/CEB Sources/output/`

## Implementation Strategy: Phased Rollout

### 🎯 Phase 1: Build Core System with Trusts & Estates (START HERE)
**Goal**: Build complete RAG pipeline with 1,687 Trusts & Estates PDFs as proof of concept

### 🎯 Phase 2: Add Family Law Vertical (After Phase 1 Complete)
**Goal**: Extend system to include Family Law documents

### 🎯 Phase 3: Add Business Litigation Vertical (After Phase 2 Complete)
**Goal**: Add third vertical using established pipeline

---

## Architecture Decision: Vercel-Compatible Vector Database

**Selected Solution: Upstash Vector**

**Why Upstash Vector:**
1. **Vercel-native integration** - Serverless, edge-compatible
2. **Zero cold starts** - Critical for user experience
3. **Pay-per-request pricing** - No idle costs
4. **Built-in Redis compatibility** - Can use existing Vercel infrastructure patterns
5. **No infrastructure management** - Fully managed
6. **Multi-namespace support** - Perfect for separating verticals (trusts_estates, family_law, business_litigation)

**Alternative considered**: Supabase pgvector (rejected due to cold start issues on free tier)

---

## PHASE 1: Core System with Trusts & Estates

### Step 1.1: Create Modular PDF Processing Script

**File**: `scripts/process_ceb_pdfs.py`

**INPUT FILES:**
- `/Users/macbook2024/Library/CloudStorage/Dropbox/AAA Backup/A Working/CEB Sources/output/ceb_trusts_estates/pdf/*.pdf`

**OUTPUT FILES:**
- `data/ceb_processed/trusts_estates/chunks.jsonl` - Processed text chunks with metadata
- `data/ceb_processed/trusts_estates/embeddings.jsonl` - Vector embeddings
- `data/ceb_processed/trusts_estates/processing_log.xlsx` - Processing statistics and errors
- `data/ceb_processed/trusts_estates/failed_pdfs.txt` - List of PDFs that failed processing

**Design Principles:**
- **Modular & Reusable**: Accept `--category` parameter to process any vertical
- **Resumable**: Save checkpoints every 100 PDFs, can resume from failure
- **Configurable**: Chunk size, overlap, and embedding model as CLI parameters
- **Parallel Processing**: Use multiprocessing to maximize M4 Max CPU/GPU

**Key Features:**
```python
# Usage examples:
python scripts/process_ceb_pdfs.py --category trusts_estates --input-dir "path/to/pdfs"
python scripts/process_ceb_pdfs.py --category family_law --input-dir "path/to/pdfs"
python scripts/process_ceb_pdfs.py --category business_litigation --input-dir "path/to/pdfs"
```

**Processing Pipeline:**
1. **PDF Text Extraction**: 
   - Use `PyMuPDF` (fitz) for robust text extraction
   - Handle scanned PDFs with OCR fallback (if needed)
   - Preserve formatting (headers, lists, tables)

2. **Intelligent Chunking**:
   - Chunk size: 1000 tokens with 200 token overlap
   - Preserve section boundaries (detect headers/subheaders)
   - Keep related content together (tables, lists, code samples)
   - Use semantic chunking (don't break mid-sentence)

3. **Metadata Extraction**:
   ```json
   {
     "chunk_id": "te_001_chunk_042",
     "source_file": "administering_a_single_person_trust_after_settlors_death_0011_iii_conducting_first_meeting_with_client.pdf",
     "category": "trusts_estates",
     "title": "Administering a Single Person Trust After Settlor's Death",
     "section": "III. Conducting First Meeting with Client",
     "page_number": 15,
     "chunk_index": 42,
     "total_chunks": 156,
     "ceb_citation": "CEB: Administering a Single Person Trust After Settlor's Death, § III",
     "text": "...",
     "token_count": 987,
     "processed_date": "2025-11-01T12:00:00Z"
   }
   ```

4. **Progress Tracking**:
   - Real-time progress bar (tqdm)
   - Save checkpoint every 100 PDFs
   - Log errors without stopping
   - Generate summary statistics

### Step 1.2: Generate Embeddings

**File**: `scripts/generate_embeddings.py`

**Embedding Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Why**: Cost-effective ($0.02/1M tokens), high quality, Vercel-compatible
- **Batch Processing**: Process 100 chunks at a time
- **Rate Limiting**: Respect OpenAI rate limits (3,000 RPM)
- **Estimated Cost for Trusts & Estates**: ~$3-5 for 1,687 PDFs

**Features:**
- Read from `chunks.jsonl`
- Generate embeddings in batches
- Save to `embeddings.jsonl` with metadata
- Resume from last checkpoint
- Retry failed embeddings

### Step 1.3: Upload to Upstash Vector

**File**: `scripts/upload_to_upstash.py`

**Process:**
```python
# Usage:
python scripts/upload_to_upstash.py --category trusts_estates
```

1. Create Upstash Vector index (if not exists)
2. Create namespace: `ceb_trusts_estates`
3. Batch upload vectors (100 at a time)
4. Store full metadata with each vector
5. Create index on `category` field for filtering
6. Verify upload completeness
7. Generate upload report

**Upstash Index Configuration:**
```json
{
  "name": "california-law-ceb",
  "dimension": 1536,
  "metric": "cosine",
  "namespaces": [
    "ceb_trusts_estates",
    "ceb_family_law",
    "ceb_business_litigation"
  ]
}
```

### Step 1.4: Create CEB Search API Endpoint

**File**: `api/ceb-search.ts`

**Endpoint**: `/api/ceb-search`

**Request:**
```typescript
{
  query: string;           // User's question
  category?: string;       // "trusts_estates" | "family_law" | "business_litigation" | undefined (search all)
  topK?: number;          // Number of results (default: 5)
  minScore?: number;      // Minimum similarity score (default: 0.7)
}
```

**Response:**
```typescript
{
  sources: CEBSource[];   // Matched CEB sources with excerpts
  context: string;        // Formatted context for LLM
  isCEB: true;           // Flag indicating CEB source
  category: string;      // Which vertical matched
  confidence: number;    // Average similarity score
}
```

**Implementation:**
```typescript
import { Index } from '@upstash/vector';

export default async function handler(req: any, res: any) {
  const { query, category, topK = 5, minScore = 0.7 } = req.body;
  
  // Initialize Upstash Vector client
  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
  
  // Generate query embedding
  const embedding = await generateEmbedding(query);
  
  // Determine namespace(s) to search
  const namespaces = category 
    ? [`ceb_${category}`]
    : ['ceb_trusts_estates', 'ceb_family_law', 'ceb_business_litigation'];
  
  // Search across namespace(s)
  const results = await Promise.all(
    namespaces.map(ns => 
      index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        namespace: ns,
        filter: `score >= ${minScore}`
      })
    )
  );
  
  // Merge and rank results
  const allResults = results.flat().sort((a, b) => b.score - a.score);
  
  // Format response
  const sources = allResults.map(result => ({
    title: result.metadata.title,
    url: `ceb://${result.metadata.source_file}`,
    excerpt: result.metadata.text.substring(0, 500),
    isCEB: true,
    category: result.metadata.category,
    cebCitation: result.metadata.ceb_citation,
    pageNumber: result.metadata.page_number,
    section: result.metadata.section,
    confidence: result.score
  }));
  
  // Format context for LLM
  const context = formatCEBContext(sources);
  
  res.json({ sources, context, isCEB: true, category, confidence: avgScore });
}
```

### Step 1.5: Update Type Definitions

**File**: `types.ts`

```typescript
export interface CEBSource extends Source {
  isCEB: true;
  category: 'trusts_estates' | 'family_law' | 'business_litigation';
  cebCitation: string;
  pageNumber?: number;
  section?: string;
  confidence: number;
}

export interface BotResponse {
  text: string;
  sources: (Source | CEBSource)[];
  verificationStatus?: VerificationStatus;
  verificationReport?: VerificationReport;
  claims?: Claim[];
  isCEBBased?: boolean;  // NEW: Flag for CEB-based responses
  cebCategory?: string;   // NEW: Which CEB vertical was used
}
```

### Step 1.6: Integrate into ChatService

**File**: `gemini/chatService.ts`

**Key Changes:**

1. **Add CEB Category Detection**:
```typescript
private detectCEBCategory(message: string): string | undefined {
  const lowerMessage = message.toLowerCase();
  
  // Trusts & Estates keywords
  const trustsEstatesKeywords = [
    'trust', 'estate', 'probate', 'will', 'executor', 'beneficiary', 
    'settlor', 'testamentary', 'intestate', 'heir', 'fiduciary',
    'conservatorship', 'guardianship', 'power of attorney', 'advance directive'
  ];
  
  // Family Law keywords (for Phase 2)
  const familyLawKeywords = [
    'divorce', 'custody', 'support', 'marriage', 'prenup', 'DVRO',
    'dissolution', 'separation', 'alimony', 'visitation', 'paternity'
  ];
  
  // Business Litigation keywords (for Phase 3)
  const businessLitigationKeywords = [
    'contract', 'breach', 'damages', 'tort', 'negligence', 'liability',
    'corporation', 'partnership', 'shareholder', 'commercial', 'fraud'
  ];
  
  // Count matches for each category
  const trustsScore = trustsEstatesKeywords.filter(k => lowerMessage.includes(k)).length;
  const familyScore = familyLawKeywords.filter(k => lowerMessage.includes(k)).length;
  const businessScore = businessLitigationKeywords.filter(k => lowerMessage.includes(k)).length;
  
  // Return category with highest score (if any)
  if (trustsScore > 0 || familyScore > 0 || businessScore > 0) {
    const maxScore = Math.max(trustsScore, familyScore, businessScore);
    if (trustsScore === maxScore) return 'trusts_estates';
    if (familyScore === maxScore) return 'family_law';
    if (businessScore === maxScore) return 'business_litigation';
  }
  
  return undefined; // No clear category, search all
}
```

2. **Add CEB Search Method**:
```typescript
private async searchCEB(message: string, signal?: AbortSignal): Promise<{
  sources: CEBSource[];
  context: string;
  category?: string;
}> {
  const category = this.detectCEBCategory(message);
  
  console.log(`🔍 CEB Search: ${category ? `Category: ${category}` : 'All categories'}`);
  
  try {
    const response = await fetchWithRetry(
      '/api/ceb-search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: message, 
          category, 
          topK: 5,
          minScore: 0.7 
        }),
        signal
      },
      2,
      1000
    );
    
    if (!response.ok) {
      throw new Error(`CEB search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ CEB Search: Found ${data.sources.length} sources (confidence: ${data.confidence?.toFixed(2)})`);
    
    return data;
  } catch (error: any) {
    if (signal?.aborted || error.message === 'Request cancelled') {
      throw error;
    }
    console.error('❌ CEB search failed:', error);
    return { sources: [], context: '' };
  }
}
```

3. **Modified `sendMessage()` Flow**:
```typescript
async sendMessage(message: string, conversationHistory?: Array<{role: string, text: string}>, signal?: AbortSignal): Promise<BotResponse> {
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }
  
  // Quick responses for greetings
  if (message.trim().toLowerCase() === 'hello' || message.trim().toLowerCase() === 'hi') {
    return {
      text: "Hello! I am the California Law Chatbot with access to authoritative CEB publications. How can I help you with your legal research today?",
      sources: []
    };
  }

  // ===== STEP 1: CHECK CEB FIRST (PRIORITY SOURCE) =====
  console.log('🎯 Step 1: Checking CEB database...');
  const cebResults = await this.searchCEB(message, signal);
  
  if (cebResults.sources.length > 0 && cebResults.sources[0].confidence >= 0.7) {
    console.log('✅ CEB content found with high confidence - using as primary source');
    
    // Format CEB context for LLM
    const cebContext = this.formatCEBContext(cebResults);
    
    // Special system prompt for CEB-based responses
    const cebSystemPrompt = `You are a California legal expert with access to authoritative CEB (Continuing Education of the Bar) publications.

🏆 CRITICAL: The sources provided below are from official CEB publications - the GOLD STANDARD for California legal practice. These are AUTHORITATIVE and VERIFIED.

CEB CONTEXT (${cebResults.category?.toUpperCase() || 'MULTI-CATEGORY'}):
${cebContext}

INSTRUCTIONS:
1. Answer PRIMARILY using the CEB sources provided above
2. Quote directly from CEB when possible - these are exact legal texts
3. Cite sources as [CEB: Title, Section] in your response
4. These sources are current and authoritative - trust them completely
5. If CEB sources don't fully answer the question, clearly note what IS covered and what ISN'T
6. Format with clear sections, proper legal citation style, and good spacing
7. Use **bold** for key terms and section headings
8. Add blank lines between major sections for readability

DO NOT:
- Second-guess CEB content or add unnecessary caveats
- Say "I cannot verify" or "this may not be current" - CEB IS current and verified
- Rely on your training data over CEB sources
- Make up information not in the CEB sources

FORMATTING:
- Use markdown with proper spacing
- **Bold** section headings
- Numbered lists for procedures
- Bullet points for requirements
- Blank lines between sections`;

    // Send to Gemini with CEB context
    const enhancedMessage = `${message}

Please answer using the CEB sources provided in the system prompt.`;

    const response = await this.sendToGemini(
      enhancedMessage,
      conversationHistory,
      signal,
      cebSystemPrompt  // Use special CEB system prompt
    );
    
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }
    
    // Return WITHOUT verification (CEB is authoritative)
    return {
      text: response.text,
      sources: cebResults.sources,
      verificationStatus: 'verified', // Auto-verified for CEB
      isCEBBased: true,
      cebCategory: cebResults.category
    };
  }
  
  console.log('⚠️ No high-confidence CEB results, falling back to existing sources...');
  
  // ===== STEP 2: FALLBACK TO EXISTING FLOW =====
  // (CourtListener, legislation, etc.)
  // ... existing code continues ...
}
```

4. **Add CEB Context Formatter**:
```typescript
private formatCEBContext(cebResults: { sources: CEBSource[]; context: string }): string {
  let formatted = '';
  
  cebResults.sources.forEach((source, index) => {
    formatted += `\n[SOURCE ${index + 1}] ${source.cebCitation}\n`;
    formatted += `Section: ${source.section || 'N/A'}\n`;
    formatted += `Page: ${source.pageNumber || 'N/A'}\n`;
    formatted += `Confidence: ${(source.confidence * 100).toFixed(1)}%\n`;
    formatted += `\nContent:\n${source.excerpt}\n`;
    formatted += `\n${'='.repeat(80)}\n`;
  });
  
  return formatted;
}
```

5. **Update `sendToGemini` to accept custom system prompt**:
```typescript
private async sendToGemini(
  message: string, 
  conversationHistory?: Array<{role: string, text: string}>, 
  signal?: AbortSignal,
  customSystemPrompt?: string  // NEW: Allow custom system prompt
): Promise<{ text: string; hasGrounding?: boolean; groundingMetadata?: any }> {
  // ... existing code ...
  
  const systemPrompt = customSystemPrompt || this.defaultSystemPrompt;
  
  // ... rest of existing code ...
}
```

### Step 1.7: Add CEB Badge to UI

**File**: `components/Message.tsx`

```typescript
// Add after existing imports
import { CEBSource } from '../types';

// Inside the Message component, add CEB badge rendering:
const hasCEBSources = message.sources?.some((s): s is CEBSource => 'isCEB' in s && s.isCEB);
const cebCategory = hasCEBSources 
  ? (message.sources?.find((s): s is CEBSource => 'isCEB' in s && s.isCEB) as CEBSource)?.category
  : undefined;

// Add this badge before the existing source badges:
{hasCEBSources && (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#fef3c7', // Gold/amber background
    border: '2px solid #f59e0b',
    borderRadius: '8px',
    marginBottom: '12px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#92400e'
  }}>
    <span style={{ fontSize: '18px' }}>✅</span>
    <span>CEB VERIFIED</span>
    <span style={{ 
      fontSize: '12px', 
      fontWeight: 500,
      padding: '2px 8px',
      backgroundColor: '#fbbf24',
      borderRadius: '4px',
      color: '#78350f'
    }}>
      {cebCategory === 'trusts_estates' && 'Trusts & Estates'}
      {cebCategory === 'family_law' && 'Family Law'}
      {cebCategory === 'business_litigation' && 'Business Litigation'}
    </span>
  </div>
)}
```

### Step 1.8: Testing & Validation

**File**: `scripts/test_ceb_rag.py`

**Test Cases for Trusts & Estates:**

1. **Retrieval Accuracy**:
   ```python
   test_queries = [
       "How do I administer a trust after the settlor dies?",
       "What are the trustee's duties in California?",
       "How do I handle trust accounting?",
       "What is a Heggstad petition?",
       "How do I distribute trust assets to beneficiaries?"
   ]
   ```

2. **Confidence Scoring**:
   - Verify high confidence (>0.8) for direct matches
   - Verify medium confidence (0.7-0.8) for related topics
   - Verify low confidence (<0.7) triggers fallback

3. **Category Detection**:
   - Trust queries → trusts_estates namespace
   - Generic queries → search all namespaces

4. **Latency**:
   - Target: <2s end-to-end
   - Measure: embedding generation + vector search + LLM response

5. **Edge Cases**:
   - Empty query
   - Very long query (>1000 tokens)
   - Query with no matches
   - Ambiguous query (could be multiple categories)

**Manual Testing Checklist:**
- [ ] Query "How do I administer a trust?" → Returns CEB Trusts & Estates content
- [ ] Query "What are trustee duties?" → Returns CEB with high confidence
- [ ] Query "Who won People v. Anderson?" → Falls back to CourtListener (no CEB match)
- [ ] Verify CEB badge displays with gold styling
- [ ] Verify no verification step for CEB responses
- [ ] Test with conversation history (multi-turn)
- [ ] Check response formatting (bold, spacing, citations)

### Step 1.9: Documentation

**Update this file (CEB.md)** with:
- Architecture diagrams
- API reference
- Maintenance procedures
- Troubleshooting guide

**Update README.md** with:
```markdown
### 📚 CEB Integration (Primary Authoritative Source)

This chatbot uses **CEB (Continuing Education of the Bar)** publications as its primary authoritative source:

- ✅ **1,687 Trusts & Estates documents** (LIVE)
- ⏳ **Family Law documents** (Coming Soon)
- ⏳ **Business Litigation documents** (Coming Soon)

**Why CEB?**
- Gold standard for California legal practice
- Written by expert practitioners and judges
- Regularly updated with latest law changes
- **No verification needed** - CEB IS the authoritative source

CEB-based responses are marked with a ✅ **CEB VERIFIED** badge.
```

### Step 1.10: Deployment

**Pre-Deployment Checklist:**
- [ ] All 1,687 Trusts & Estates PDFs processed successfully
- [ ] Embeddings uploaded to Upstash Vector (namespace: `ceb_trusts_estates`)
- [ ] Environment variables set in Vercel (UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN)
- [ ] API endpoint `/api/ceb-search` tested locally
- [ ] ChatService integration tested locally
- [ ] CEB badge displays correctly
- [ ] Manual testing complete

**Deployment Steps:**
```bash
# 1. Process PDFs locally (one-time)
cd scripts
python process_ceb_pdfs.py --category trusts_estates --input-dir "/Users/macbook2024/Library/CloudStorage/Dropbox/AAA Backup/A Working/CEB Sources/output/ceb_trusts_estates/pdf"

# 2. Generate embeddings
python generate_embeddings.py --category trusts_estates

# 3. Upload to Upstash
python upload_to_upstash.py --category trusts_estates

# 4. Deploy to Vercel
cd ..
git add .
git commit -m "feat: Add CEB Trusts & Estates RAG integration (Phase 1)"
git push origin main
```

**Monitoring:**
- Upstash Dashboard: Query volume, latency, costs
- Vercel Analytics: `/api/ceb-search` performance
- Error logs: Failed CEB queries
- User feedback: CEB response quality

---

## PHASE 2: Add Family Law Vertical

**Prerequisites**: Phase 1 complete and tested

**Timeline**: Start when Family Law PDFs finish downloading

**Steps** (using established pipeline):

1. **Process Family Law PDFs**:
   ```bash
   python scripts/process_ceb_pdfs.py --category family_law --input-dir "/path/to/family_law/pdfs"
   ```

2. **Generate embeddings**:
   ```bash
   python scripts/generate_embeddings.py --category family_law
   ```

3. **Upload to Upstash** (new namespace: `ceb_family_law`):
   ```bash
   python scripts/upload_to_upstash.py --category family_law
   ```

4. **Update category detection** in `chatService.ts`:
   - Family Law keywords already defined in `detectCEBCategory()`
   - No code changes needed - system will automatically search new namespace

5. **Test Family Law queries**:
   - "How do I file for divorce in California?"
   - "What are child custody factors?"
   - "How is child support calculated?"

6. **Deploy**:
   ```bash
   git commit -m "feat: Add CEB Family Law vertical (Phase 2)"
   git push origin main
   ```

**Estimated Time**: 1-2 days (mostly processing time)

---

## PHASE 3: Add Business Litigation Vertical

**Prerequisites**: Phase 2 complete and tested

**Timeline**: Start when Business Litigation PDFs finish downloading

**Steps** (using established pipeline):

1. **Process Business Litigation PDFs**:
   ```bash
   python scripts/process_ceb_pdfs.py --category business_litigation --input-dir "/path/to/business_litigation/pdfs"
   ```

2. **Generate embeddings**:
   ```bash
   python scripts/generate_embeddings.py --category business_litigation
   ```

3. **Upload to Upstash** (new namespace: `ceb_business_litigation`):
   ```bash
   python scripts/upload_to_upstash.py --category business_litigation
   ```

4. **Update category detection** in `chatService.ts`:
   - Business Litigation keywords already defined in `detectCEBCategory()`
   - No code changes needed - system will automatically search new namespace

5. **Test Business Litigation queries**:
   - "What are the elements of breach of contract?"
   - "How do I prove fraud in California?"
   - "What damages are available for breach of fiduciary duty?"

6. **Deploy**:
   ```bash
   git commit -m "feat: Add CEB Business Litigation vertical (Phase 3)"
   git push origin main
   ```

**Estimated Time**: 1-2 days (mostly processing time)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ChatService.sendMessage()                     │
│                                                                  │
│  1. Detect CEB Category (trusts_estates | family_law |          │
│     business_litigation | undefined)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STEP 1: Query CEB First                        │
│                    (Priority Source)                             │
│                                                                  │
│  POST /api/ceb-search                                           │
│  ├─ Generate query embedding (OpenAI)                           │
│  ├─ Search Upstash Vector (namespace: ceb_{category})           │
│  ├─ Return top 5 results with confidence scores                 │
│  └─ Format CEB context for LLM                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
          High Confidence      Low Confidence
            (>= 0.7)              (< 0.7)
                    │                 │
                    ▼                 ▼
    ┌───────────────────────┐  ┌──────────────────────────┐
    │  USE CEB RESPONSE     │  │  FALLBACK TO EXISTING    │
    │                       │  │  SOURCES                 │
    │  ✅ Skip Verification │  │  - CourtListener         │
    │  ✅ Add CEB Badge     │  │  - OpenStates/LegiScan   │
    │  ✅ Return Immediately│  │  - Google Search         │
    │                       │  │  ✓ Run Verification      │
    └───────────────────────┘  └──────────────────────────┘
```

---

## File Structure

```
California-Law-Chatbot/
├── api/
│   └── ceb-search.ts                    # NEW: CEB vector search endpoint
├── scripts/                              # NEW: Processing scripts
│   ├── process_ceb_pdfs.py              # PDF → chunks (modular, reusable)
│   ├── generate_embeddings.py           # Chunks → embeddings
│   ├── upload_to_upstash.py             # Embeddings → Upstash Vector
│   └── test_ceb_rag.py                  # Test suite
├── data/                                 # NEW: Processed data (gitignored)
│   └── ceb_processed/
│       ├── trusts_estates/              # Phase 1
│       │   ├── chunks.jsonl
│       │   ├── embeddings.jsonl
│       │   ├── processing_log.xlsx
│       │   └── failed_pdfs.txt
│       ├── family_law/                  # Phase 2
│       │   └── ... (same structure)
│       └── business_litigation/         # Phase 3
│           └── ... (same structure)
├── gemini/
│   └── chatService.ts                   # MODIFIED: Add CEB-first logic
├── components/
│   └── Message.tsx                      # MODIFIED: Add CEB badge
├── types.ts                             # MODIFIED: Add CEBSource type
├── CEB.md                               # THIS FILE: Complete documentation
├── README.md                            # MODIFIED: Add CEB section
└── .env                                 # Add Upstash credentials
```

---

## Cost Estimates

### Phase 1: Trusts & Estates (1,687 PDFs)
**One-Time Setup:**
- OpenAI Embeddings: ~$3-5
- Processing Time: ~3-4 hours on M4 Max
- Upstash Vector Setup: Free

**Ongoing (Monthly):**
- Upstash Vector: ~$10-15/month (pay-per-request)
- OpenAI Embeddings (new queries): ~$1-2/month

### Phase 2: Family Law (150 PDFs)
**One-Time Setup:**
- OpenAI Embeddings: ~$0.50-1
- Processing Time: ~30 minutes

**Ongoing**: Included in Phase 1 costs

### Phase 3: Business Litigation (TBD PDFs)
**One-Time Setup:**
- OpenAI Embeddings: TBD (depends on PDF count)
- Processing Time: TBD

**Total First Month**: ~$20-30
**Ongoing**: ~$15-25/month

---

## Success Metrics

### Phase 1 (Trusts & Estates)
- [ ] **Coverage**: >70% of trusts/estates queries answered by CEB
- [ ] **Accuracy**: >90% user satisfaction with CEB responses
- [ ] **Performance**: <2s average response time
- [ ] **Adoption**: >80% of trusts/estates queries use CEB

### Phase 2 (Family Law)
- [ ] **Coverage**: >70% of family law queries answered by CEB
- [ ] **Multi-Category**: System correctly routes to appropriate vertical

### Phase 3 (Business Litigation)
- [ ] **Coverage**: >70% of business litigation queries answered by CEB
- [ ] **Cross-Category**: Handle queries spanning multiple verticals

---

## Environment Variables

Add to `.env` and Vercel:
```bash
# Upstash Vector Database
UPSTASH_VECTOR_REST_URL=https://your-endpoint.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your_token_here

# OpenAI for Embeddings (may already exist)
OPENAI_API_KEY=your_openai_key
```

---

## Dependencies

### NPM Packages
```bash
npm install @upstash/vector
npm install openai  # For embeddings
```

### Python Packages
```bash
pip install PyMuPDF pandas openpyxl openai python-dotenv tqdm
```

---

## Implementation Timeline

### Phase 1: Trusts & Estates (START IMMEDIATELY)
- **Week 1, Days 1-2**: Setup environment, create processing scripts
- **Week 1, Days 3-4**: Process 1,687 PDFs, generate embeddings
- **Week 1, Day 5**: Upload to Upstash, create API endpoint
- **Week 2, Days 1-2**: Integrate into ChatService
- **Week 2, Days 3-4**: Add UI badge, testing
- **Week 2, Day 5**: Documentation, deployment

**Total**: ~2 weeks

### Phase 2: Family Law (AFTER DOWNLOAD COMPLETE)
- **Days 1-2**: Process PDFs, upload to Upstash
- **Day 3**: Testing and deployment

**Total**: ~3 days

### Phase 3: Business Litigation (AFTER DOWNLOAD COMPLETE)
- **Days 1-2**: Process PDFs, upload to Upstash
- **Day 3**: Testing and deployment

**Total**: ~3 days

---

## Maintenance & Updates

### Adding New CEB Documents
1. Place new PDFs in appropriate category folder
2. Run processing script: `python scripts/process_ceb_pdfs.py --category {category} --input-dir {path}`
3. Generate embeddings: `python scripts/generate_embeddings.py --category {category}`
4. Upload: `python scripts/upload_to_upstash.py --category {category}`
5. No code changes needed - new content automatically available

### Monitoring
- **Upstash Dashboard**: Query volume, latency, costs
- **Vercel Analytics**: API performance
- **Error Logs**: Track failed queries
- **User Feedback**: Collect ratings on CEB responses

### Troubleshooting

**Problem**: Low confidence scores (<0.7) for relevant queries
**Solution**: Adjust chunk size, overlap, or minScore threshold

**Problem**: Slow response times (>3s)
**Solution**: Reduce topK, implement caching, or optimize embedding generation

**Problem**: Wrong category detected
**Solution**: Update keyword lists in `detectCEBCategory()`

**Problem**: Upstash rate limits
**Solution**: Implement request batching or upgrade Upstash plan

---

## Future Enhancements

1. **Hybrid Search**: Combine vector similarity with keyword/BM25 matching
2. **Multi-Document Synthesis**: Combine multiple CEB sources in single answer
3. **PDF Hosting**: Host PDFs and link directly from citations
4. **Automatic Updates**: Pipeline to process new CEB publications automatically
5. **Additional Verticals**: Criminal Law, Real Estate, Employment Law, etc.
6. **User Feedback Loop**: Learn from ratings to improve retrieval
7. **Reranking**: Add cross-encoder reranking for better relevance
8. **Caching**: Cache frequent queries to reduce costs

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Upstash Vector downtime | High | Implement fallback to existing sources, cache frequent queries |
| Poor retrieval quality | High | Tune chunk size/overlap/topK, add reranking, collect user feedback |
| Outdated CEB content | Medium | Add "last updated" dates to metadata, periodic refresh process |
| High costs at scale | Medium | Implement caching layer, optimize embedding calls, monitor usage |
| PDF processing failures | Low | Robust error handling, log failures, manual review |

---

## Ready to Start?

**Phase 1 is ready to implement!** The Trusts & Estates PDFs are available and the system is designed to be modular, making Phases 2 and 3 straightforward additions.

**Next Steps:**
1. Set up Upstash Vector account
2. Run `scripts/process_ceb_pdfs.py` on Trusts & Estates PDFs
3. Generate embeddings and upload to Upstash
4. Create `/api/ceb-search` endpoint
5. Integrate into ChatService
6. Test and deploy!

Let me know when you're ready to begin implementation! 🚀

