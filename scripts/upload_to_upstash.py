#!/usr/bin/env python3
"""
CEB Upstash Vector Upload Script

INPUT FILES:
- data/ceb_processed/{category}/embeddings.jsonl - Chunks with embeddings

OUTPUT FILES:
- data/ceb_processed/{category}/upload_log.xlsx - Upload statistics
- data/ceb_processed/{category}/upload_report.txt - Detailed upload report

DESCRIPTION:
Uploads CEB embeddings to Upstash Vector database. Uses batch uploading
for efficiency and includes verification to ensure all vectors were uploaded
successfully.

USAGE:
    python upload_to_upstash.py --category trusts_estates
    python upload_to_upstash.py --category family_law --batch-size 50

PREREQUISITES:
- Upstash Vector database created
- Environment variables set: UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN

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
    import requests
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install requirements: pip install -r requirements.txt")
    sys.exit(1)

# Load environment variables
load_dotenv()


class UpstashUploader:
    """
    Uploads CEB embeddings to Upstash Vector database.
    
    Simple explanation:
    This class takes the embedded chunks (text converted to numbers) and
    uploads them to a cloud database (Upstash) where they can be quickly
    searched later.
    """
    
    def __init__(
        self,
        category: str,
        data_dir: str = "data/ceb_processed",
        batch_size: int = 100,
        max_retries: int = 3
    ):
        """
        Initialize the Upstash uploader.
        
        Args:
            category: Category name (e.g., "trusts_estates")
            data_dir: Base directory for data files
            batch_size: Number of vectors to upload at once
            max_retries: Maximum retry attempts for failed requests
        """
        self.category = category
        self.data_dir = Path(data_dir) / category
        self.batch_size = batch_size
        self.max_retries = max_retries
        
        # Upstash configuration
        self.upstash_url = os.getenv("UPSTASH_VECTOR_REST_URL")
        self.upstash_token = os.getenv("UPSTASH_VECTOR_REST_TOKEN")
        
        if not self.upstash_url or not self.upstash_token:
            print("ERROR: Upstash credentials not found")
            print("Please set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN")
            print("in your .env file or as environment variables")
            sys.exit(1)
        
        # Namespace for this category
        self.namespace = f"ceb_{category}"
        
        # Input/output files
        self.embeddings_file = self.data_dir / "embeddings.jsonl"
        self.log_file = self.data_dir / "upload_log.xlsx"
        self.report_file = self.data_dir / "upload_report.txt"
        
        # Statistics
        self.stats = {
            "total_vectors": 0,
            "successful_uploads": 0,
            "failed_uploads": 0,
            "start_time": datetime.now().isoformat(),
            "namespace": self.namespace
        }
    
    def load_embeddings(self) -> List[Dict[str, Any]]:
        """Load embeddings from JSONL file."""
        if not self.embeddings_file.exists():
            print(f"ERROR: Embeddings file not found: {self.embeddings_file}")
            print("Please run generate_embeddings.py first")
            sys.exit(1)
        
        embeddings = []
        with open(self.embeddings_file, 'r') as f:
            for line in f:
                embeddings.append(json.loads(line))
        
        return embeddings
    
    def create_index_if_needed(self):
        """
        Create Upstash Vector index if it doesn't exist.
        
        Note: This is a placeholder. In practice, you should create the index
        through the Upstash dashboard or CLI before running this script.
        """
        print(f"ℹ️  Using namespace: {self.namespace}")
        print(f"ℹ️  Make sure your Upstash Vector index is created and configured")
        print(f"ℹ️  Recommended settings:")
        print(f"     - Dimension: 1536 (for text-embedding-3-small)")
        print(f"     - Metric: cosine")
        print()
    
    def upload_batch(self, vectors: List[Dict[str, Any]], retry_count: int = 0) -> bool:
        """
        Upload a batch of vectors to Upstash.
        
        Args:
            vectors: List of vector data to upload
            retry_count: Current retry attempt
            
        Returns:
            True if successful, False otherwise
        """
        # Format vectors for Upstash API
        # Upstash expects: { "id": str, "vector": [float], "metadata": dict, "namespace": str }
        formatted_vectors = []
        for vec in vectors:
            formatted_vectors.append({
                "id": vec["chunk_id"],
                "vector": vec["embedding"],
                "metadata": {
                    "source_file": vec["source_file"],
                    "category": vec["category"],
                    "title": vec["title"],
                    "section": vec.get("section", ""),
                    "page_number": vec.get("page_number", 0),
                    "chunk_index": vec.get("chunk_index", 0),
                    "text": vec["text"][:10000],  # Store up to 10KB of text (Upstash limit is 40KB per metadata)
                    "ceb_citation": vec.get("ceb_citation", ""),
                    "token_count": vec.get("token_count", 0)
                },
                "namespace": self.namespace  # Include namespace in each vector
            })
        
        try:
            # Upstash Vector upsert endpoint (namespace in payload, not URL)
            url = f"{self.upstash_url}/upsert"
            headers = {
                "Authorization": f"Bearer {self.upstash_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                url,
                headers=headers,
                json=formatted_vectors,
                timeout=30
            )
            
            if response.status_code == 200:
                return True
            else:
                raise Exception(f"API returned status {response.status_code}: {response.text}")
                
        except Exception as e:
            if retry_count < self.max_retries:
                wait_time = 2 ** retry_count
                print(f"\n⚠️  Upload error, retrying in {wait_time}s... ({retry_count + 1}/{self.max_retries})")
                print(f"    Error: {str(e)}")
                time.sleep(wait_time)
                return self.upload_batch(vectors, retry_count + 1)
            else:
                print(f"\n❌ Failed after {self.max_retries} retries: {str(e)}")
                return False
    
    def upload_all_embeddings(self):
        """Upload all embeddings to Upstash Vector."""
        # Load embeddings
        print(f"\n{'='*80}")
        print(f"CEB UPSTASH UPLOAD - {self.category.upper()}")
        print(f"{'='*80}")
        print(f"Loading embeddings from: {self.embeddings_file}")
        
        embeddings = self.load_embeddings()
        self.stats["total_vectors"] = len(embeddings)
        
        print(f"Total Vectors: {len(embeddings)}")
        print(f"Namespace: {self.namespace}")
        print(f"Batch Size: {self.batch_size}")
        print(f"Upstash URL: {self.upstash_url}")
        print(f"{'='*80}\n")
        
        # Check index
        self.create_index_if_needed()
        
        # Upload in batches
        for i in tqdm(range(0, len(embeddings), self.batch_size), 
                     desc="Uploading to Upstash"):
            
            batch = embeddings[i:i + self.batch_size]
            
            success = self.upload_batch(batch)
            
            if success:
                self.stats["successful_uploads"] += len(batch)
            else:
                self.stats["failed_uploads"] += len(batch)
            
            # Small delay between batches
            time.sleep(0.2)
        
        # Final statistics
        self.stats["end_time"] = datetime.now().isoformat()
        self.save_statistics()
        self.save_report()
        
        print(f"\n{'='*80}")
        print(f"UPLOAD COMPLETE")
        print(f"{'='*80}")
        print(f"✅ Successful: {self.stats['successful_uploads']} vectors")
        print(f"❌ Failed: {self.stats['failed_uploads']} vectors")
        print(f"📊 Statistics: {self.log_file}")
        print(f"📄 Report: {self.report_file}")
        print(f"{'='*80}\n")
        
        if self.stats["failed_uploads"] > 0:
            print(f"⚠️  WARNING: {self.stats['failed_uploads']} vectors failed to upload")
            print(f"⚠️  Please check the logs and retry if needed")
    
    def save_statistics(self):
        """Save upload statistics to Excel file."""
        df = pd.DataFrame([self.stats])
        df.to_excel(self.log_file, index=False)
    
    def save_report(self):
        """Save detailed upload report to text file."""
        with open(self.report_file, 'w') as f:
            f.write(f"CEB Upstash Upload Report - {self.category}\n")
            f.write(f"{'='*80}\n\n")
            f.write(f"Upload Date: {datetime.now().isoformat()}\n")
            f.write(f"Namespace: {self.namespace}\n")
            f.write(f"Total Vectors: {self.stats['total_vectors']}\n")
            f.write(f"Successful: {self.stats['successful_uploads']}\n")
            f.write(f"Failed: {self.stats['failed_uploads']}\n")
            f.write(f"Success Rate: {(self.stats['successful_uploads'] / self.stats['total_vectors'] * 100):.1f}%\n")
            f.write(f"\n{'='*80}\n\n")
            
            if self.stats["failed_uploads"] == 0:
                f.write("✅ All vectors uploaded successfully!\n")
            else:
                f.write(f"⚠️  {self.stats['failed_uploads']} vectors failed to upload\n")
                f.write(f"Please check logs and retry if needed\n")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Upload CEB embeddings to Upstash Vector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Upload Trusts & Estates embeddings
  python upload_to_upstash.py --category trusts_estates
  
  # Use smaller batch size
  python upload_to_upstash.py --category family_law --batch-size 50

Prerequisites:
  1. Create Upstash Vector index at https://console.upstash.com/
  2. Set environment variables:
     - UPSTASH_VECTOR_REST_URL
     - UPSTASH_VECTOR_REST_TOKEN
        """
    )
    
    parser.add_argument(
        '--category',
        required=True,
        choices=['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'],
        help='CEB category to upload'
    )
    
    parser.add_argument(
        '--data-dir',
        default='data/ceb_processed',
        help='Base data directory (default: data/ceb_processed)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Batch size for uploads (default: 100)'
    )
    
    parser.add_argument(
        '--max-retries',
        type=int,
        default=3,
        help='Maximum retry attempts (default: 3)'
    )
    
    args = parser.parse_args()
    
    # Create uploader and run
    uploader = UpstashUploader(
        category=args.category,
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        max_retries=args.max_retries
    )
    
    uploader.upload_all_embeddings()


if __name__ == "__main__":
    main()

