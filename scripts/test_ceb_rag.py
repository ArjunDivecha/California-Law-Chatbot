#!/usr/bin/env python3
"""
CEB RAG Testing Suite

Tests the CEB RAG system for retrieval accuracy, category detection, and performance.
Run this after uploading embeddings to Upstash to verify the system works correctly.

USAGE:
    python test_ceb_rag.py --category trusts_estates
    python test_ceb_rag.py --all-categories

Version: 1.0
Last Updated: November 1, 2025
"""

import os
import sys
import json
import time
import argparse
from typing import List, Dict, Any
from datetime import datetime

try:
    import requests
    import pandas as pd
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install: pip install requests pandas python-dotenv")
    sys.exit(1)

load_dotenv()


class CEBRAGTester:
    """Test suite for CEB RAG system"""
    
    def __init__(self, api_url: str = "http://localhost:5173/api/ceb-search"):
        self.api_url = api_url
        self.results: List[Dict[str, Any]] = []
        
    def test_query(self, query: str, expected_category: str, min_confidence: float = 0.7) -> Dict[str, Any]:
        """
        Test a single query against the CEB API
        
        Args:
            query: Test query
            expected_category: Expected CEB category
            min_confidence: Minimum acceptable confidence score
            
        Returns:
            Test result dictionary
        """
        start_time = time.time()
        
        try:
            response = requests.post(
                self.api_url,
                json={"query": query, "topK": 5, "minScore": 0.7},
                timeout=10
            )
            
            elapsed_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                result = {
                    "query": query,
                    "expected_category": expected_category,
                    "actual_category": data.get("category"),
                    "num_results": len(data.get("sources", [])),
                    "confidence": data.get("confidence", 0),
                    "response_time": elapsed_time,
                    "passed": (
                        data.get("category") == expected_category and
                        data.get("confidence", 0) >= min_confidence and
                        len(data.get("sources", [])) > 0
                    ),
                    "sources": [s.get("cebCitation") for s in data.get("sources", [])[:3]]
                }
            else:
                result = {
                    "query": query,
                    "expected_category": expected_category,
                    "actual_category": None,
                    "num_results": 0,
                    "confidence": 0,
                    "response_time": elapsed_time,
                    "passed": False,
                    "error": f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            elapsed_time = time.time() - start_time
            result = {
                "query": query,
                "expected_category": expected_category,
                "actual_category": None,
                "num_results": 0,
                "confidence": 0,
                "response_time": elapsed_time,
                "passed": False,
                "error": str(e)
            }
        
        self.results.append(result)
        return result
    
    def run_trusts_estates_tests(self):
        """Test queries for Trusts & Estates category"""
        print("\n" + "="*80)
        print("TESTING: TRUSTS & ESTATES")
        print("="*80 + "\n")
        
        test_queries = [
            "How do I administer a trust after the settlor dies?",
            "What are the trustee's duties in California?",
            "How do I handle trust accounting?",
            "What is a Heggstad petition?",
            "How do I distribute trust assets to beneficiaries?",
            "What notices must a trustee provide?",
            "How do I prepare a trust accounting?",
            "What are the requirements for a valid trust amendment?",
            "How do I handle creditor claims against a trust?",
            "What is the trustee's duty to inform beneficiaries?"
        ]
        
        for query in test_queries:
            result = self.test_query(query, "trusts_estates")
            self._print_result(result)
    
    def run_family_law_tests(self):
        """Test queries for Family Law category"""
        print("\n" + "="*80)
        print("TESTING: FAMILY LAW")
        print("="*80 + "\n")
        
        test_queries = [
            "How do I file for divorce in California?",
            "What are child custody factors?",
            "How is child support calculated?",
            "What is community property?",
            "How do I get a domestic violence restraining order?",
            "What are the grounds for legal separation?",
            "How is spousal support determined?",
            "What is a prenuptial agreement?",
            "How do I modify a custody order?",
            "What are the requirements for adoption?"
        ]
        
        for query in test_queries:
            result = self.test_query(query, "family_law")
            self._print_result(result)
    
    def run_business_litigation_tests(self):
        """Test queries for Business Litigation category"""
        print("\n" + "="*80)
        print("TESTING: BUSINESS LITIGATION")
        print("="*80 + "\n")
        
        test_queries = [
            "What are the elements of breach of contract?",
            "How do I prove fraud in California?",
            "What damages are available for breach of fiduciary duty?",
            "What is the statute of limitations for contract claims?",
            "How do I enforce a judgment?",
            "What is piercing the corporate veil?",
            "What are the requirements for a valid contract?",
            "How do I prove negligence?",
            "What is the business judgment rule?",
            "How do I dissolve a partnership?"
        ]
        
        for query in test_queries:
            result = self.test_query(query, "business_litigation")
            self._print_result(result)
    
    def _print_result(self, result: Dict[str, Any]):
        """Print test result"""
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} | {result['query'][:60]}")
        print(f"       Category: {result['actual_category']} (expected: {result['expected_category']})")
        print(f"       Confidence: {result['confidence']:.2f} | Results: {result['num_results']} | Time: {result['response_time']:.2f}s")
        if result.get("sources"):
            print(f"       Top sources: {', '.join(result['sources'][:2])}")
        if result.get("error"):
            print(f"       Error: {result['error']}")
        print()
    
    def generate_report(self, output_file: str = "data/ceb_processed/test_report.xlsx"):
        """Generate test report"""
        if not self.results:
            print("No test results to report")
            return
        
        # Calculate statistics
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["passed"])
        failed_tests = total_tests - passed_tests
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        avg_confidence = sum(r["confidence"] for r in self.results) / total_tests if total_tests > 0 else 0
        avg_response_time = sum(r["response_time"] for r in self.results) / total_tests if total_tests > 0 else 0
        
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        print(f"Avg Confidence: {avg_confidence:.2f}")
        print(f"Avg Response Time: {avg_response_time:.2f}s")
        print("="*80 + "\n")
        
        # Save to Excel
        df = pd.DataFrame(self.results)
        
        # Create summary sheet
        summary = {
            "Metric": ["Total Tests", "Passed", "Failed", "Pass Rate (%)", "Avg Confidence", "Avg Response Time (s)"],
            "Value": [total_tests, passed_tests, failed_tests, f"{pass_rate:.1f}", f"{avg_confidence:.2f}", f"{avg_response_time:.2f}"]
        }
        df_summary = pd.DataFrame(summary)
        
        # Write to Excel
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df_summary.to_excel(writer, sheet_name="Summary", index=False)
            df.to_excel(writer, sheet_name="Detailed Results", index=False)
        
        print(f"📊 Test report saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Test CEB RAG system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test Trusts & Estates only
  python test_ceb_rag.py --category trusts_estates
  
  # Test all categories
  python test_ceb_rag.py --all-categories
  
  # Test with custom API URL
  python test_ceb_rag.py --api-url http://localhost:3000/api/ceb-search --all-categories
        """
    )
    
    parser.add_argument(
        '--category',
        choices=['trusts_estates', 'family_law', 'business_litigation'],
        help='Test specific category'
    )
    
    parser.add_argument(
        '--all-categories',
        action='store_true',
        help='Test all categories'
    )
    
    parser.add_argument(
        '--api-url',
        default='http://localhost:5173/api/ceb-search',
        help='CEB Search API URL (default: http://localhost:5173/api/ceb-search)'
    )
    
    args = parser.parse_args()
    
    if not args.category and not args.all_categories:
        parser.error("Please specify --category or --all-categories")
    
    # Create tester
    tester = CEBRAGTester(api_url=args.api_url)
    
    print(f"\n{'='*80}")
    print(f"CEB RAG TESTING SUITE")
    print(f"{'='*80}")
    print(f"API URL: {args.api_url}")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"{'='*80}")
    
    # Run tests
    if args.all_categories or args.category == 'trusts_estates':
        tester.run_trusts_estates_tests()
    
    if args.all_categories or args.category == 'family_law':
        tester.run_family_law_tests()
    
    if args.all_categories or args.category == 'business_litigation':
        tester.run_business_litigation_tests()
    
    # Generate report
    tester.generate_report()


if __name__ == "__main__":
    main()

