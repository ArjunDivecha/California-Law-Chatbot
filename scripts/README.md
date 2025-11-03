# CEB Processing Scripts

This directory contains scripts for processing CEB (Continuing Education of the Bar) PDFs into a RAG (Retrieval Augmented Generation) system.

## Quick Start Guide

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root with:

```bash
# Required for embeddings
OPENAI_API_KEY=your_openai_api_key_here

# Required for Upstash Vector upload
UPSTASH_VECTOR_REST_URL=https://your-endpoint.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your_upstash_token_here
```

### 3. Process PDFs (Phase 1: Trusts & Estates)

```bash
# Process 1,687 Trusts & Estates PDFs
python process_ceb_pdfs.py \
  --category trusts_estates \
  --input-dir "/Users/macbook2024/Library/CloudStorage/Dropbox/AAA Backup/A Working/CEB Sources/output/ceb_trusts_estates/pdf"
```

**Expected output:**
- `data/ceb_processed/trusts_estates/chunks.jsonl` - Text chunks with metadata
- `data/ceb_processed/trusts_estates/processing_log.xlsx` - Statistics
- `data/ceb_processed/trusts_estates/failed_pdfs.txt` - Any failures

**Time estimate:** 3-4 hours on M4 Max

### 4. Generate Embeddings

```bash
# Generate OpenAI embeddings for chunks
python generate_embeddings.py --category trusts_estates
```

**Expected output:**
- `data/ceb_processed/trusts_estates/embeddings.jsonl` - Chunks with embeddings
- `data/ceb_processed/trusts_estates/embedding_log.xlsx` - Statistics

**Cost estimate:** ~$3-5
**Time estimate:** 1-2 hours

### 5. Upload to Upstash Vector

```bash
# Upload embeddings to Upstash
python upload_to_upstash.py --category trusts_estates
```

**Expected output:**
- Vectors uploaded to namespace: `ceb_trusts_estates`
- `data/ceb_processed/trusts_estates/upload_log.xlsx` - Statistics
- `data/ceb_processed/trusts_estates/upload_report.txt` - Report

**Time estimate:** 30-60 minutes

## Adding New Verticals (Phase 2 & 3)

Once Family Law and Business Litigation PDFs are downloaded, simply repeat the same commands with different categories:

```bash
# Family Law
python process_ceb_pdfs.py --category family_law --input-dir "/path/to/family_law/pdfs"
python generate_embeddings.py --category family_law
python upload_to_upstash.py --category family_law

# Business Litigation
python process_ceb_pdfs.py --category business_litigation --input-dir "/path/to/business_litigation/pdfs"
python generate_embeddings.py --category business_litigation
python upload_to_upstash.py --category business_litigation
```

## Script Details

### process_ceb_pdfs.py

Extracts text from PDFs and chunks them intelligently.

**Options:**
- `--chunk-size`: Chunk size in tokens (default: 1000)
- `--chunk-overlap`: Overlap in tokens (default: 200)
- `--checkpoint-interval`: Save checkpoint every N PDFs (default: 100)
- `--resume-from`: Resume from PDF index

**Example:**
```bash
python process_ceb_pdfs.py \
  --category trusts_estates \
  --input-dir "/path/to/pdfs" \
  --chunk-size 1200 \
  --chunk-overlap 250
```

### generate_embeddings.py

Generates OpenAI embeddings for text chunks.

**Options:**
- `--model`: Embedding model (default: text-embedding-3-small)
- `--batch-size`: Batch size for API calls (default: 100)
- `--max-retries`: Maximum retry attempts (default: 3)

**Example:**
```bash
python generate_embeddings.py \
  --category trusts_estates \
  --batch-size 50
```

### upload_to_upstash.py

Uploads embeddings to Upstash Vector database.

**Options:**
- `--batch-size`: Batch size for uploads (default: 100)
- `--max-retries`: Maximum retry attempts (default: 3)

**Example:**
```bash
python upload_to_upstash.py \
  --category trusts_estates \
  --batch-size 50
```

## Troubleshooting

### "No PDF files found"
- Check that the `--input-dir` path is correct
- Ensure PDFs are directly in the specified directory (not in subdirectories)

### "OPENAI_API_KEY is not set"
- Create a `.env` file in the project root
- Add your OpenAI API key

### "Rate limit exceeded"
- Reduce `--batch-size` (try 50 or 25)
- The scripts will automatically retry with exponential backoff

### "Upstash credentials not found"
- Set `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` in `.env`
- Create your Upstash Vector index at https://console.upstash.com/

### Processing fails midway
- Scripts save checkpoints every 100 PDFs
- Use `--resume-from` to continue from where it stopped
- Check `failed_pdfs.txt` for specific errors

## Output File Structure

```
data/ceb_processed/
├── trusts_estates/
│   ├── chunks.jsonl              # Text chunks with metadata
│   ├── embeddings.jsonl          # Chunks with embeddings
│   ├── processing_log.xlsx       # PDF processing stats
│   ├── embedding_log.xlsx        # Embedding generation stats
│   ├── upload_log.xlsx           # Upload stats
│   ├── upload_report.txt         # Upload report
│   ├── failed_pdfs.txt           # Failed PDFs (if any)
│   └── checkpoint_*.json         # Processing checkpoints
├── family_law/
│   └── ... (same structure)
└── business_litigation/
    └── ... (same structure)
```

## Performance Tips

### Maximize M4 Max Performance
- Close other applications to free up RAM
- The scripts are already optimized for your hardware
- Processing uses minimal CPU (mostly I/O bound)

### Cost Optimization
- Use `text-embedding-3-small` (cheaper, sufficient quality)
- Process in batches to avoid rate limits
- Cache embeddings (scripts handle this automatically)

### Speed Optimization
- Increase `--batch-size` if not hitting rate limits
- Run on fast SSD (your Dropbox folder should be synced locally)
- Ensure stable internet connection for API calls

## Next Steps

After completing the processing:
1. Set up Upstash Vector account (if not done)
2. Create the `/api/ceb-search` endpoint
3. Integrate into ChatService
4. Add UI badge
5. Test and deploy!

See `../CEB.md` for the complete implementation plan.

