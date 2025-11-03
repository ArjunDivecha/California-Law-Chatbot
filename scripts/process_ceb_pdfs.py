#!/usr/bin/env python3
"""
CEB PDF Processing Script

INPUT FILES:
- PDF files from specified input directory (e.g., ceb_trusts_estates/pdf/*.pdf)

OUTPUT FILES:
- data/ceb_processed/{category}/chunks.jsonl - Processed text chunks with metadata
- data/ceb_processed/{category}/processing_log.xlsx - Processing statistics
- data/ceb_processed/{category}/failed_pdfs.txt - List of failed PDFs
- data/ceb_processed/{category}/checkpoint_{timestamp}.json - Resume checkpoints

DESCRIPTION:
Extracts text from CEB PDFs, chunks them intelligently, and generates rich metadata
for RAG (Retrieval Augmented Generation). Designed to be modular and reusable across
different CEB verticals (trusts_estates, family_law, business_litigation).

USAGE:
    python process_ceb_pdfs.py --category trusts_estates --input-dir "/path/to/pdfs"
    python process_ceb_pdfs.py --category family_law --input-dir "/path/to/pdfs" --chunk-size 1200

Version: 1.0
Last Updated: November 1, 2025
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import multiprocessing as mp
from functools import partial

# Third-party imports
try:
    import fitz  # PyMuPDF
    import pandas as pd
    from tqdm import tqdm
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install requirements: pip install -r requirements.txt")
    sys.exit(1)


class CEBPDFProcessor:
    """
    Processes CEB PDFs into chunks suitable for vector embedding.
    
    A 10th grader's explanation:
    This class takes PDF files (like textbooks), reads all the text from them,
    breaks the text into smaller pieces (chunks), and saves information about
    each piece so we can search through them later.
    """
    
    def __init__(
        self,
        category: str,
        input_dir: str,
        output_dir: str = "data/ceb_processed",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        checkpoint_interval: int = 100
    ):
        """
        Initialize the PDF processor.
        
        Args:
            category: Category name (e.g., "trusts_estates", "family_law")
            input_dir: Directory containing PDF files
            output_dir: Base directory for output files
            chunk_size: Target size for each text chunk (in tokens, ~4 chars per token)
            chunk_overlap: Number of overlapping tokens between chunks
            checkpoint_interval: Save checkpoint every N PDFs
        """
        self.category = category
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir) / category
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.checkpoint_interval = checkpoint_interval
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Output files
        self.chunks_file = self.output_dir / "chunks.jsonl"
        self.log_file = self.output_dir / "processing_log.xlsx"
        self.failed_file = self.output_dir / "failed_pdfs.txt"
        
        # Statistics
        self.stats = {
            "total_pdfs": 0,
            "successful_pdfs": 0,
            "failed_pdfs": 0,
            "total_chunks": 0,
            "total_pages": 0,
            "start_time": datetime.now().isoformat(),
        }
        
        # Failed PDFs list
        self.failed_pdfs: List[Dict[str, str]] = []
        
    def extract_metadata_from_filename(self, filename: str) -> Dict[str, str]:
        """
        Extract title and section from CEB PDF filename.
        
        Example filename:
        "administering_a_single_person_trust_after_settlors_death_0011_iii_conducting_first_meeting_with_client.pdf"
        
        Returns:
            {
                "title": "Administering a Single Person Trust After Settlor's Death",
                "section": "III. Conducting First Meeting with Client"
            }
        """
        # Remove .pdf extension
        name = filename.replace('.pdf', '')
        
        # Split by underscores
        parts = name.split('_')
        
        # Find the numeric separator (e.g., "0011")
        separator_idx = None
        for i, part in enumerate(parts):
            if part.isdigit() and len(part) == 4:
                separator_idx = i
                break
        
        if separator_idx is None:
            # No separator found, use whole filename as title
            title = ' '.join(parts).title()
            return {"title": title, "section": ""}
        
        # Title is before separator
        title_parts = parts[:separator_idx]
        title = ' '.join(title_parts).replace('_', ' ').title()
        
        # Section is after separator
        section_parts = parts[separator_idx + 1:]
        section = ' '.join(section_parts).replace('_', ' ').title()
        
        return {"title": title, "section": section}
    
    def extract_text_from_pdf(self, pdf_path: Path) -> List[Dict[str, Any]]:
        """
        Extract text from PDF with page-level metadata.
        
        Returns:
            List of dicts with keys: page_number, text
        """
        pages = []
        
        try:
            doc = fitz.open(pdf_path)
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                
                # Skip empty pages
                if text.strip():
                    pages.append({
                        "page_number": page_num + 1,  # 1-indexed for humans
                        "text": text
                    })
            
            doc.close()
            
        except Exception as e:
            raise Exception(f"Failed to extract text: {str(e)}")
        
        return pages
    
    def chunk_text(self, text: str, page_number: int) -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks.
        
        Simple explanation:
        Imagine you have a long story. This function breaks it into smaller
        parts that overlap a bit (like reading the last paragraph of one page
        and the first paragraph of the next page together). This helps keep
        the meaning connected.
        
        Args:
            text: Text to chunk
            page_number: Page number this text came from
            
        Returns:
            List of chunks with metadata
        """
        # Approximate tokens (1 token ≈ 4 characters)
        char_chunk_size = self.chunk_size * 4
        char_overlap = self.chunk_overlap * 4
        
        chunks = []
        start = 0
        chunk_index = 0
        
        while start < len(text):
            # Get chunk
            end = start + char_chunk_size
            chunk_text = text[start:end]
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for last sentence ending in the chunk
                last_period = chunk_text.rfind('. ')
                last_newline = chunk_text.rfind('\n\n')
                break_point = max(last_period, last_newline)
                
                if break_point > char_chunk_size * 0.7:  # At least 70% through
                    chunk_text = chunk_text[:break_point + 1]
                    end = start + break_point + 1
            
            # Skip very short chunks
            if len(chunk_text.strip()) < 100:
                start = end
                continue
            
            chunks.append({
                "text": chunk_text.strip(),
                "page_number": page_number,
                "chunk_index": chunk_index,
                "token_count": len(chunk_text) // 4  # Approximate
            })
            
            chunk_index += 1
            start = end - char_overlap  # Overlap
        
        return chunks
    
    def process_pdf(self, pdf_path: Path) -> List[Dict[str, Any]]:
        """
        Process a single PDF file into chunks with full metadata.
        
        Returns:
            List of chunk dictionaries ready for embedding
        """
        try:
            # Extract metadata from filename
            metadata = self.extract_metadata_from_filename(pdf_path.name)
            
            # Extract text from PDF
            pages = self.extract_text_from_pdf(pdf_path)
            
            if not pages:
                raise Exception("No text extracted from PDF")
            
            # Chunk each page
            all_chunks = []
            for page_data in pages:
                page_chunks = self.chunk_text(page_data["text"], page_data["page_number"])
                all_chunks.extend(page_chunks)
            
            # Add full metadata to each chunk
            for i, chunk in enumerate(all_chunks):
                chunk.update({
                    "chunk_id": f"{self.category}_{pdf_path.stem}_{i:04d}",
                    "source_file": pdf_path.name,
                    "category": self.category,
                    "title": metadata["title"],
                    "section": metadata["section"],
                    "total_chunks": len(all_chunks),
                    "ceb_citation": f"CEB: {metadata['title']}" + (f", {metadata['section']}" if metadata['section'] else ""),
                    "processed_date": datetime.now().isoformat()
                })
            
            return all_chunks
            
        except Exception as e:
            raise Exception(f"Failed to process {pdf_path.name}: {str(e)}")
    
    def save_checkpoint(self, processed_count: int):
        """Save processing checkpoint for resumption."""
        checkpoint = {
            "category": self.category,
            "processed_count": processed_count,
            "timestamp": datetime.now().isoformat(),
            "stats": self.stats
        }
        
        checkpoint_file = self.output_dir / f"checkpoint_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2)
    
    def process_all_pdfs(self, resume_from: int = 0):
        """
        Process all PDFs in the input directory.
        
        Args:
            resume_from: Resume from this PDF index (for checkpoint recovery)
        """
        # Find all PDF files
        pdf_files = sorted(list(self.input_dir.glob("*.pdf")))
        
        if not pdf_files:
            print(f"ERROR: No PDF files found in {self.input_dir}")
            return
        
        self.stats["total_pdfs"] = len(pdf_files)
        
        print(f"\n{'='*80}")
        print(f"CEB PDF PROCESSING - {self.category.upper()}")
        print(f"{'='*80}")
        print(f"Input Directory: {self.input_dir}")
        print(f"Output Directory: {self.output_dir}")
        print(f"Total PDFs: {len(pdf_files)}")
        print(f"Chunk Size: {self.chunk_size} tokens (~{self.chunk_size * 4} characters)")
        print(f"Chunk Overlap: {self.chunk_overlap} tokens")
        if resume_from > 0:
            print(f"Resuming from PDF #{resume_from + 1}")
        print(f"{'='*80}\n")
        
        # Open output file in append mode
        mode = 'a' if resume_from > 0 else 'w'
        with open(self.chunks_file, mode) as chunks_out:
            # Process each PDF with progress bar
            for idx, pdf_path in enumerate(tqdm(pdf_files[resume_from:], 
                                                 desc="Processing PDFs",
                                                 initial=resume_from,
                                                 total=len(pdf_files))):
                try:
                    # Process PDF
                    chunks = self.process_pdf(pdf_path)
                    
                    # Write chunks to file
                    for chunk in chunks:
                        chunks_out.write(json.dumps(chunk) + '\n')
                    
                    # Update stats
                    self.stats["successful_pdfs"] += 1
                    self.stats["total_chunks"] += len(chunks)
                    
                except Exception as e:
                    # Log failure
                    self.stats["failed_pdfs"] += 1
                    self.failed_pdfs.append({
                        "filename": pdf_path.name,
                        "error": str(e)
                    })
                    print(f"\n❌ Failed: {pdf_path.name} - {str(e)}")
                
                # Save checkpoint periodically
                if (idx + 1) % self.checkpoint_interval == 0:
                    self.save_checkpoint(resume_from + idx + 1)
        
        # Final statistics
        self.stats["end_time"] = datetime.now().isoformat()
        self.save_statistics()
        self.save_failed_pdfs()
        
        print(f"\n{'='*80}")
        print(f"PROCESSING COMPLETE")
        print(f"{'='*80}")
        print(f"✅ Successful: {self.stats['successful_pdfs']} PDFs")
        print(f"❌ Failed: {self.stats['failed_pdfs']} PDFs")
        print(f"📄 Total Chunks: {self.stats['total_chunks']}")
        print(f"💾 Output: {self.chunks_file}")
        if self.stats['failed_pdfs'] > 0:
            print(f"⚠️  Failed PDFs logged to: {self.failed_file}")
        print(f"📊 Statistics: {self.log_file}")
        print(f"{'='*80}\n")
    
    def save_statistics(self):
        """Save processing statistics to Excel file."""
        df = pd.DataFrame([self.stats])
        df.to_excel(self.log_file, index=False, sheet_name="Summary")
        
        # Add failed PDFs sheet if any
        if self.failed_pdfs:
            with pd.ExcelWriter(self.log_file, mode='a', engine='openpyxl') as writer:
                df_failed = pd.DataFrame(self.failed_pdfs)
                df_failed.to_excel(writer, sheet_name="Failed PDFs", index=False)
    
    def save_failed_pdfs(self):
        """Save list of failed PDFs to text file."""
        if self.failed_pdfs:
            with open(self.failed_file, 'w') as f:
                f.write(f"Failed PDFs - {self.category}\n")
                f.write(f"Generated: {datetime.now().isoformat()}\n")
                f.write(f"{'='*80}\n\n")
                for item in self.failed_pdfs:
                    f.write(f"File: {item['filename']}\n")
                    f.write(f"Error: {item['error']}\n")
                    f.write(f"{'-'*80}\n")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Process CEB PDFs into chunks for RAG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process Trusts & Estates PDFs
  python process_ceb_pdfs.py --category trusts_estates --input-dir "/path/to/ceb_trusts_estates/pdf"
  
  # Process Family Law PDFs with custom chunk size
  python process_ceb_pdfs.py --category family_law --input-dir "/path/to/ceb_family_law/pdf" --chunk-size 1200
  
  # Resume from checkpoint
  python process_ceb_pdfs.py --category trusts_estates --input-dir "/path/to/pdfs" --resume-from 500
        """
    )
    
    parser.add_argument(
        '--category',
        required=True,
        choices=['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'],
        help='CEB category to process'
    )
    
    parser.add_argument(
        '--input-dir',
        required=True,
        help='Directory containing PDF files'
    )
    
    parser.add_argument(
        '--output-dir',
        default='data/ceb_processed',
        help='Base output directory (default: data/ceb_processed)'
    )
    
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=1000,
        help='Chunk size in tokens (default: 1000)'
    )
    
    parser.add_argument(
        '--chunk-overlap',
        type=int,
        default=200,
        help='Chunk overlap in tokens (default: 200)'
    )
    
    parser.add_argument(
        '--checkpoint-interval',
        type=int,
        default=100,
        help='Save checkpoint every N PDFs (default: 100)'
    )
    
    parser.add_argument(
        '--resume-from',
        type=int,
        default=0,
        help='Resume from PDF index (for checkpoint recovery)'
    )
    
    args = parser.parse_args()
    
    # Validate input directory
    if not os.path.isdir(args.input_dir):
        print(f"ERROR: Input directory does not exist: {args.input_dir}")
        sys.exit(1)
    
    # Create processor and run
    processor = CEBPDFProcessor(
        category=args.category,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        checkpoint_interval=args.checkpoint_interval
    )
    
    processor.process_all_pdfs(resume_from=args.resume_from)


if __name__ == "__main__":
    main()

