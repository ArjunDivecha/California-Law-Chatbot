"""
================================================================================
CEB RAG DIRECT UPSTASH TEST
================================================================================
INPUT FILES:
  - None (queries Upstash Vector database directly)
  - Requires: .env file with UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN

OUTPUT FILES:
  - Console output with test results

DESCRIPTION:
  Tests the CEB RAG system by querying Upstash Vector database directly,
  bypassing the need for a running web server.

VERSION: 1.0
LAST UPDATED: 2025-11-02
================================================================================
"""

import os
import sys
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

def generate_embedding(text):
    """Generate OpenAI embedding for query text"""
    response = requests.post(
        'https://api.openai.com/v1/embeddings',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {OPENAI_API_KEY}'
        },
        json={
            'input': text,
            'model': 'text-embedding-3-small'
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"OpenAI API error: {response.text}")
    
    return response.json()['data'][0]['embedding']

def query_upstash(query_text, category='trusts_estates', top_k=5):
    """Query Upstash Vector database directly"""
    
    # Generate embedding
    print(f"  → Generating embedding for query...")
    embedding = generate_embedding(query_text)
    
    # Query Upstash
    print(f"  → Querying Upstash namespace: ceb_{category}...")
    response = requests.post(
        f'{UPSTASH_URL}/query',
        headers={
            'Authorization': f'Bearer {UPSTASH_TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'vector': embedding,
            'topK': top_k,
            'includeMetadata': True,
            'namespace': f'ceb_{category}'
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Upstash API error: {response.text}")
    
    return response.json()

def main():
    print("\n" + "="*80)
    print("CEB RAG - ALL THREE VERTICALS TEST")
    print("="*80)
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Upstash URL: {UPSTASH_URL}")
    print("="*80 + "\n")
    
    # Verify credentials
    if not UPSTASH_URL or not UPSTASH_TOKEN or not OPENAI_API_KEY:
        print("❌ ERROR: Missing credentials in .env file")
        print("   Required: UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN, OPENAI_API_KEY")
        sys.exit(1)
    
    # Test queries for all three verticals
    test_queries = [
        # Trusts & Estates (40,263 vectors)
        ("trusts_estates", "How do I administer a trust after the settlor dies?"),
        ("trusts_estates", "What are the trustee's duties in California?"),
        ("trusts_estates", "What is a Heggstad petition?"),
        
        # Family Law (7,511 vectors)
        ("family_law", "How is child support calculated in California?"),
        ("family_law", "What are the grounds for divorce in California?"),
        ("family_law", "How is child custody determined?"),
        
        # Business Litigation (13,711 vectors)
        ("business_litigation", "What are the elements of a breach of contract claim?"),
        ("business_litigation", "How do I file a complaint in California superior court?"),
        ("business_litigation", "What is discovery in civil litigation?"),
    ]
    
    passed = 0
    failed = 0
    vertical_results = {'trusts_estates': [], 'family_law': [], 'business_litigation': []}
    
    for i, (category, query) in enumerate(test_queries, 1):
        print(f"\n{'='*80}")
        print(f"TEST {i}/{len(test_queries)}: {category.upper().replace('_', ' ')}")
        print(f"Query: {query}")
        print('='*80)
        
        try:
            results = query_upstash(query, category=category)
            
            # Parse response (handle both formats)
            if isinstance(results, dict) and 'result' in results:
                results = results['result']
            
            if results and len(results) > 0:
                print(f"\n✅ SUCCESS: Found {len(results)} results")
                print(f"   Top result confidence: {results[0].get('score', 0):.4f}")
                
                # Show top result
                top_result = results[0]
                metadata = top_result.get('metadata', {})
                
                print(f"\n📄 Top Result:")
                print(f"   Title: {metadata.get('title', 'N/A')}")
                print(f"   Citation: {metadata.get('ceb_citation', 'N/A')}")
                print(f"   Page: {metadata.get('page_number', 'N/A')}")
                print(f"   Section: {metadata.get('section', 'N/A')}")
                print(f"   Confidence: {top_result.get('score', 0):.4f}")
                
                # Show snippet of text
                text = metadata.get('text', '')
                if text:
                    snippet = text[:200] + "..." if len(text) > 200 else text
                    print(f"\n   Text Preview:")
                    print(f"   {snippet}")
                
                passed += 1
                vertical_results[category].append(True)
            else:
                print(f"\n❌ FAIL: No results returned")
                failed += 1
                vertical_results[category].append(False)
                
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            failed += 1
            vertical_results[category].append(False)
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print('='*80)
    print(f"Total Tests: {len(test_queries)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Pass Rate: {(passed/len(test_queries)*100):.1f}%")
    print()
    print("VERTICAL BREAKDOWN:")
    print(f"  • Trusts & Estates: {sum(vertical_results['trusts_estates'])}/3 passed")
    print(f"  • Family Law: {sum(vertical_results['family_law'])}/3 passed")
    print(f"  • Business Litigation: {sum(vertical_results['business_litigation'])}/3 passed")
    print('='*80 + "\n")

if __name__ == '__main__':
    main()

