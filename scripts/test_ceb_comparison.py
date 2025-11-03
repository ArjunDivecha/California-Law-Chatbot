#!/usr/bin/env python3
"""
================================================================================
CEB RAG COMPARISON TEST - WITH vs WITHOUT CEB
================================================================================
INPUT FILES:
  - None (queries Upstash Vector database and external APIs)
  - Requires: .env file with API credentials

OUTPUT FILES:
  - Console output with side-by-side comparison
  - comparison_results.xlsx (detailed results)

DESCRIPTION:
  Compares the quality and relevance of responses with CEB RAG system
  versus without (using only external APIs like CourtListener, OpenStates).
  
  Tests across all three verticals:
  1. Trusts & Estates
  2. Family Law
  3. Business Litigation

VERSION: 1.0
LAST UPDATED: 2025-11-02
================================================================================
"""

import os
import sys
import json
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
COURTLISTENER_API_KEY = os.getenv('COURTLISTENER_API_KEY')

# Test queries for each vertical
TEST_QUERIES = {
    'trusts_estates': [
        {
            'query': 'What are the trustee\'s duties when administering a trust in California?',
            'expected_topics': ['fiduciary duty', 'prudent investor', 'accounting', 'notification']
        },
        {
            'query': 'How do I handle trust assets after the settlor dies?',
            'expected_topics': ['inventory', 'valuation', 'distribution', 'beneficiary notice']
        },
        {
            'query': 'What is a Heggstad petition and when is it used?',
            'expected_topics': ['schedule of assets', 'trust funding', 'probate avoidance']
        }
    ],
    'family_law': [
        {
            'query': 'How is child support calculated in California?',
            'expected_topics': ['guideline formula', 'income', 'timeshare', 'DissoMaster']
        },
        {
            'query': 'What factors determine child custody in California?',
            'expected_topics': ['best interest', 'parenting plan', 'stability', 'child preference']
        },
        {
            'query': 'What are the grounds for divorce in California?',
            'expected_topics': ['no-fault', 'irreconcilable differences', 'incurable insanity']
        }
    ],
    'business_litigation': [
        {
            'query': 'What are the elements of a breach of contract claim in California?',
            'expected_topics': ['contract existence', 'performance', 'breach', 'damages', 'causation']
        },
        {
            'query': 'What is the discovery process in California civil litigation?',
            'expected_topics': ['interrogatories', 'depositions', 'requests for production', 'admissions']
        },
        {
            'query': 'How do I file a complaint in California superior court?',
            'expected_topics': ['jurisdiction', 'venue', 'caption', 'causes of action', 'prayer for relief']
        }
    ]
}

def generate_embedding(text):
    """Generate OpenAI embedding for query text."""
    response = requests.post(
        'https://api.openai.com/v1/embeddings',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'input': text,
            'model': 'text-embedding-3-small'
        }
    )
    response.raise_for_status()
    return response.json()['data'][0]['embedding']

def query_ceb(query_text, category, top_k=3):
    """Query CEB RAG system via Upstash."""
    embedding = generate_embedding(query_text)
    
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
    response.raise_for_status()
    result = response.json()
    
    # Parse response
    if isinstance(result, dict) and 'result' in result:
        result = result['result']
    
    return result

def query_courtlistener(query_text, top_k=3):
    """Query CourtListener API V4 (external legal database)."""
    if not COURTLISTENER_API_KEY:
        return []
    
    try:
        response = requests.get(
            'https://www.courtlistener.com/api/rest/v4/search/',
            headers={'Authorization': f'Token {COURTLISTENER_API_KEY}'},
            params={
                'q': query_text,
                'type': 'o',  # opinions
                'order_by': 'score desc'
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('results', [])[:top_k]
        return []
    except Exception as e:
        print(f"    ⚠️  CourtListener error: {str(e)}")
        return []

def analyze_relevance(results, expected_topics):
    """Analyze how many expected topics are covered in results."""
    if not results:
        return 0, []
    
    # Combine all result text
    combined_text = ""
    for result in results:
        if isinstance(result, dict):
            # Handle CEB results (from Upstash)
            metadata = result.get('metadata', {})
            combined_text += metadata.get('text', '') + " "
            
            # Handle CourtListener results
            combined_text += result.get('snippet', '') + " "
            combined_text += result.get('caseName', '') + " "
            combined_text += result.get('caseNameFull', '') + " "
    
    combined_text = combined_text.lower()
    
    # Check which topics are covered
    covered_topics = []
    for topic in expected_topics:
        if topic.lower() in combined_text:
            covered_topics.append(topic)
    
    coverage = len(covered_topics) / len(expected_topics) if expected_topics else 0
    return coverage, covered_topics

def compare_query(query_data, category):
    """Compare CEB vs non-CEB results for a single query."""
    query = query_data['query']
    expected_topics = query_data['expected_topics']
    
    print(f"\n{'='*80}")
    print(f"Query: {query}")
    print(f"Category: {category.upper().replace('_', ' ')}")
    print('='*80)
    
    # Test WITH CEB
    print("\n📚 WITH CEB RAG:")
    try:
        ceb_start = time.time()
        ceb_results = query_ceb(query, category)
        ceb_time = time.time() - ceb_start
        
        ceb_coverage, ceb_topics = analyze_relevance(ceb_results, expected_topics)
        
        print(f"  ✅ Found {len(ceb_results)} results in {ceb_time:.2f}s")
        print(f"  📊 Topic Coverage: {ceb_coverage*100:.0f}% ({len(ceb_topics)}/{len(expected_topics)})")
        if ceb_results:
            print(f"  🎯 Top Confidence: {ceb_results[0].get('score', 0):.4f}")
            print(f"  ✓ Covered: {', '.join(ceb_topics) if ceb_topics else 'None'}")
        
        ceb_data = {
            'results_count': len(ceb_results),
            'time': ceb_time,
            'coverage': ceb_coverage,
            'topics_covered': len(ceb_topics),
            'confidence': ceb_results[0].get('score', 0) if ceb_results else 0
        }
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        ceb_data = {'results_count': 0, 'time': 0, 'coverage': 0, 'topics_covered': 0, 'confidence': 0}
    
    # Test WITHOUT CEB (external APIs only)
    print("\n🌐 WITHOUT CEB (CourtListener only):")
    try:
        external_start = time.time()
        external_results = query_courtlistener(query)
        external_time = time.time() - external_start
        
        external_coverage, external_topics = analyze_relevance(external_results, expected_topics)
        
        print(f"  ✅ Found {len(external_results)} results in {external_time:.2f}s")
        print(f"  📊 Topic Coverage: {external_coverage*100:.0f}% ({len(external_topics)}/{len(expected_topics)})")
        if external_topics:
            print(f"  ✓ Covered: {', '.join(external_topics)}")
        else:
            print(f"  ✗ No expected topics found")
        
        external_data = {
            'results_count': len(external_results),
            'time': external_time,
            'coverage': external_coverage,
            'topics_covered': len(external_topics),
            'confidence': 0  # CourtListener doesn't provide confidence scores
        }
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        external_data = {'results_count': 0, 'time': 0, 'coverage': 0, 'topics_covered': 0, 'confidence': 0}
    
    # Comparison
    print("\n📈 COMPARISON:")
    print(f"  Results:  CEB: {ceb_data['results_count']} | External: {external_data['results_count']}")
    print(f"  Speed:    CEB: {ceb_data['time']:.2f}s | External: {external_data['time']:.2f}s")
    print(f"  Coverage: CEB: {ceb_data['coverage']*100:.0f}% | External: {external_data['coverage']*100:.0f}%")
    
    # Winner
    if ceb_data['coverage'] > external_data['coverage']:
        print(f"  🏆 WINNER: CEB (better topic coverage)")
    elif external_data['coverage'] > ceb_data['coverage']:
        print(f"  🏆 WINNER: External (better topic coverage)")
    else:
        print(f"  🤝 TIE: Equal coverage")
    
    return {
        'query': query,
        'category': category,
        'expected_topics': expected_topics,
        'ceb': ceb_data,
        'external': external_data
    }

def main():
    """Run comparison tests."""
    print("="*80)
    print("CEB RAG COMPARISON TEST - WITH vs WITHOUT")
    print("="*80)
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Testing: {sum(len(queries) for queries in TEST_QUERIES.values())} queries across 3 verticals")
    print("="*80)
    
    if not all([UPSTASH_URL, UPSTASH_TOKEN, OPENAI_API_KEY]):
        print("❌ ERROR: Missing credentials in .env file")
        sys.exit(1)
    
    all_results = []
    
    # Test each vertical
    for category, queries in TEST_QUERIES.items():
        print(f"\n\n{'#'*80}")
        print(f"# VERTICAL: {category.upper().replace('_', ' ')}")
        print(f"{'#'*80}")
        
        for query_data in queries:
            result = compare_query(query_data, category)
            all_results.append(result)
            time.sleep(1)  # Rate limiting
    
    # Summary
    print(f"\n\n{'='*80}")
    print("FINAL SUMMARY")
    print('='*80)
    
    total_tests = len(all_results)
    ceb_wins = sum(1 for r in all_results if r['ceb']['coverage'] > r['external']['coverage'])
    external_wins = sum(1 for r in all_results if r['external']['coverage'] > r['ceb']['coverage'])
    ties = total_tests - ceb_wins - external_wins
    
    avg_ceb_coverage = sum(r['ceb']['coverage'] for r in all_results) / total_tests * 100
    avg_external_coverage = sum(r['external']['coverage'] for r in all_results) / total_tests * 100
    avg_ceb_time = sum(r['ceb']['time'] for r in all_results) / total_tests
    avg_external_time = sum(r['external']['time'] for r in all_results) / total_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"  🏆 CEB Wins: {ceb_wins} ({ceb_wins/total_tests*100:.0f}%)")
    print(f"  🌐 External Wins: {external_wins} ({external_wins/total_tests*100:.0f}%)")
    print(f"  🤝 Ties: {ties} ({ties/total_tests*100:.0f}%)")
    
    print(f"\nAverage Topic Coverage:")
    print(f"  📚 CEB: {avg_ceb_coverage:.1f}%")
    print(f"  🌐 External: {avg_external_coverage:.1f}%")
    print(f"  📈 CEB Advantage: +{avg_ceb_coverage - avg_external_coverage:.1f}%")
    
    print(f"\nAverage Response Time:")
    print(f"  📚 CEB: {avg_ceb_time:.2f}s")
    print(f"  🌐 External: {avg_external_time:.2f}s")
    
    print("\n" + "="*80)
    
    # Save detailed results to Excel
    try:
        df_data = []
        for r in all_results:
            df_data.append({
                'Category': r['category'].replace('_', ' ').title(),
                'Query': r['query'],
                'Expected Topics': ', '.join(r['expected_topics']),
                'CEB Results': r['ceb']['results_count'],
                'CEB Coverage %': r['ceb']['coverage'] * 100,
                'CEB Topics Found': r['ceb']['topics_covered'],
                'CEB Time (s)': r['ceb']['time'],
                'CEB Confidence': r['ceb']['confidence'],
                'External Results': r['external']['results_count'],
                'External Coverage %': r['external']['coverage'] * 100,
                'External Topics Found': r['external']['topics_covered'],
                'External Time (s)': r['external']['time'],
                'Winner': 'CEB' if r['ceb']['coverage'] > r['external']['coverage'] 
                         else ('External' if r['external']['coverage'] > r['ceb']['coverage'] else 'Tie')
            })
        
        df = pd.DataFrame(df_data)
        output_file = 'comparison_results.xlsx'
        df.to_excel(output_file, index=False)
        print(f"\n✅ Detailed results saved to: {output_file}")
        
    except Exception as e:
        print(f"\n⚠️  Could not save Excel file: {str(e)}")
    
    print("="*80 + "\n")

if __name__ == '__main__':
    main()

