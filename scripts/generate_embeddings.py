#!/usr/bin/env python3
"""
CEB Embedding Generation Script

INPUT FILES:
- data/ceb_processed/{category}/chunks.jsonl - Processed text chunks

OUTPUT FILES:
- data/ceb_processed/{category}/embeddings.jsonl - Chunks with embeddings
- data/ceb_processed/{category}/embedding_log.xlsx - Generation statistics

DESCRIPTION:
Generates OpenAI embeddings for processed CEB chunks. Uses batch processing
and includes retry logic for robustness. Designed to be resumable in case of
failures or rate limiting.

USAGE:
    python generate_embeddings.py --category trusts_estates
    python generate_embeddings.py --category family_law --batch-size 50

Version: 1.0
Last Updated: November 1, 2025
"""

import os
import sys
import json
import argparse
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Third-party imports
try:
    import pandas as pd
    from tqdm import tqdm
    from openai import OpenAI
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install requirements: pip install -r requirements.txt")
    sys.exit(1)

# Load environment variables
load_dotenv()


class EmbeddingGenerator:
    """
    Generates OpenAI embeddings for CEB text chunks.
    
    Simple explanation:
    This class takes text chunks and converts them into numbers (vectors)
    that capture the meaning of the text. These numbers help the computer
    understand which chunks are similar to each other.
    """
    
    def __init__(
        self,
        category: str,
        data_dir: str = "data/ceb_processed",
        model: str = "text-embedding-3-small",
        batch_size: int = 100,
        max_retries: int = 3
    ):
        """
        Initialize the embedding generator.
        
        Args:
            category: Category name (e.g., "trusts_estates")
            data_dir: Base directory for data files
            model: OpenAI embedding model to use
            batch_size: Number of chunks to process at once
            max_retries: Maximum retry attempts for failed requests
        """
        self.category = category
        self.data_dir = Path(data_dir) / category
        self.model = model
        self.batch_size = batch_size
        self.max_retries = max_retries
        
        # Input/output files
        self.chunks_file = self.data_dir / "chunks.jsonl"
        self.embeddings_file = self.data_dir / "embeddings.jsonl"
        self.log_file = self.data_dir / "embedding_log.xlsx"
        
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("ERROR: OPENAI_API_KEY environment variable not set")
            print("Please set it in your .env file or export it")
            sys.exit(1)
        
        self.client = OpenAI(api_key=api_key)
        
        # Statistics
        self.stats = {
            "total_chunks": 0,
            "successful_embeddings": 0,
            "failed_embeddings": 0,
            "total_tokens": 0,
            "estimated_cost": 0.0,
            "start_time": datetime.now().isoformat(),
            "model": model
        }
    
    def load_chunks(self) -> List[Dict[str, Any]]:
        """Load chunks from JSONL file."""
        if not self.chunks_file.exists():
            print(f"ERROR: Chunks file not found: {self.chunks_file}")
            print("Please run process_ceb_pdfs.py first")
            sys.exit(1)
        
        chunks = []
        with open(self.chunks_file, 'r') as f:
            for line in f:
                chunks.append(json.loads(line))
        
        return chunks
    
    def generate_embedding(self, text: str, retry_count: int = 0) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            retry_count: Current retry attempt
            
        Returns:
            Embedding vector (list of floats)
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text
            )
            
            # Update token count
            self.stats["total_tokens"] += response.usage.total_tokens
            
            return response.data[0].embedding
            
        except Exception as e:
            if retry_count < self.max_retries:
                # Exponential backoff
                wait_time = 2 ** retry_count
                print(f"\n⚠️  API error, retrying in {wait_time}s... ({retry_count + 1}/{self.max_retries})")
                time.sleep(wait_time)
                return self.generate_embedding(text, retry_count + 1)
            else:
                raise Exception(f"Failed after {self.max_retries} retries: {str(e)}")
    
    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            
            # Update token count
            self.stats["total_tokens"] += response.usage.total_tokens
            
            # Extract embeddings in order
            embeddings = [item.embedding for item in response.data]
            
            return embeddings
            
        except Exception as e:
            # Fall back to individual processing if batch fails
            print(f"\n⚠️  Batch failed, processing individually: {str(e)}")
            embeddings = []
            for text in texts:
                try:
                    embedding = self.generate_embedding(text)
                    embeddings.append(embedding)
                except Exception as e2:
                    print(f"\n❌ Failed to embed chunk: {str(e2)}")
                    embeddings.append(None)
            return embeddings
    
    def process_all_chunks(self):
        """Generate embeddings for all chunks."""
        # Load chunks
        print(f"\n{'='*80}")
        print(f"CEB EMBEDDING GENERATION - {self.category.upper()}")
        print(f"{'='*80}")
        print(f"Loading chunks from: {self.chunks_file}")
        
        chunks = self.load_chunks()
        self.stats["total_chunks"] = len(chunks)
        
        print(f"Total Chunks: {len(chunks)}")
        print(f"Model: {self.model}")
        print(f"Batch Size: {self.batch_size}")
        print(f"{'='*80}\n")
        
        # Check if embeddings file already exists
        start_idx = 0
        if self.embeddings_file.exists():
            # Count existing embeddings
            with open(self.embeddings_file, 'r') as f:
                start_idx = sum(1 for _ in f)
            print(f"ℹ️  Found existing embeddings file with {start_idx} entries")
            print(f"ℹ️  Resuming from chunk {start_idx + 1}\n")
        
        # Open output file in append mode
        mode = 'a' if start_idx > 0 else 'w'
        with open(self.embeddings_file, mode) as out_file:
            # Process in batches
            for i in tqdm(range(start_idx, len(chunks), self.batch_size), 
                         desc="Generating embeddings",
                         initial=start_idx // self.batch_size):
                
                batch = chunks[i:i + self.batch_size]
                texts = [chunk["text"] for chunk in batch]
                
                try:
                    # Generate embeddings for batch
                    embeddings = self.generate_batch_embeddings(texts)
                    
                    # Write to file
                    for chunk, embedding in zip(batch, embeddings):
                        if embedding is not None:
                            chunk["embedding"] = embedding
                            chunk["embedding_model"] = self.model
                            chunk["embedding_dimensions"] = len(embedding)
                            out_file.write(json.dumps(chunk) + '\n')
                            self.stats["successful_embeddings"] += 1
                        else:
                            self.stats["failed_embeddings"] += 1
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    print(f"\n❌ Batch error: {str(e)}")
                    self.stats["failed_embeddings"] += len(batch)
        
        # Calculate cost (text-embedding-3-small: $0.02 per 1M tokens)
        self.stats["estimated_cost"] = (self.stats["total_tokens"] / 1_000_000) * 0.02
        self.stats["end_time"] = datetime.now().isoformat()
        
        # Save statistics
        self.save_statistics()
        
        print(f"\n{'='*80}")
        print(f"EMBEDDING GENERATION COMPLETE")
        print(f"{'='*80}")
        print(f"✅ Successful: {self.stats['successful_embeddings']} embeddings")
        print(f"❌ Failed: {self.stats['failed_embeddings']} embeddings")
        print(f"🔢 Total Tokens: {self.stats['total_tokens']:,}")
        print(f"💰 Estimated Cost: ${self.stats['estimated_cost']:.2f}")
        print(f"💾 Output: {self.embeddings_file}")
        print(f"📊 Statistics: {self.log_file}")
        print(f"{'='*80}\n")
    
    def save_statistics(self):
        """Save generation statistics to Excel file."""
        df = pd.DataFrame([self.stats])
        df.to_excel(self.log_file, index=False)


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Generate OpenAI embeddings for CEB chunks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate embeddings for Trusts & Estates
  python generate_embeddings.py --category trusts_estates
  
  # Use smaller batch size (if hitting rate limits)
  python generate_embeddings.py --category family_law --batch-size 50
  
  # Use different embedding model
  python generate_embeddings.py --category business_litigation --model text-embedding-3-large
        """
    )
    
    parser.add_argument(
        '--category',
        required=True,
        choices=['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'],
        help='CEB category to process'
    )
    
    parser.add_argument(
        '--data-dir',
        default='data/ceb_processed',
        help='Base data directory (default: data/ceb_processed)'
    )
    
    parser.add_argument(
        '--model',
        default='text-embedding-3-small',
        choices=['text-embedding-3-small', 'text-embedding-3-large'],
        help='OpenAI embedding model (default: text-embedding-3-small)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Batch size for API calls (default: 100)'
    )
    
    parser.add_argument(
        '--max-retries',
        type=int,
        default=3,
        help='Maximum retry attempts (default: 3)'
    )
    
    args = parser.parse_args()
    
    # Create generator and run
    generator = EmbeddingGenerator(
        category=args.category,
        data_dir=args.data_dir,
        model=args.model,
        batch_size=args.batch_size,
        max_retries=args.max_retries
    )
    
    generator.process_all_chunks()


if __name__ == "__main__":
    main()

