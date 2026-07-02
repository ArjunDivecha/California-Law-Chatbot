"""
=============================================================================
SCRIPT NAME: test_simple_query.py
=============================================================================

DESCRIPTION:
    Tests Upstash vector database query functionality. Generates a text
    embedding for the query "trust administration" using OpenAI's
    text-embedding-3-small API, then sends two queries to an Upstash Vector
    index: one without a namespace and one with the namespace
    'ceb_trusts_estates'. Results are printed to stdout for comparison.

INPUT FILES:
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/Drafting Magic/.env
        Environment variables loaded via python-dotenv containing
        UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN, and
        OPENAI_API_KEY.

OUTPUT FILES:
    (none — this script only prints query results to stdout)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - requests
    - python-dotenv

USAGE:
    python test_simple_query.py

NOTES:
    - Requires a valid .env file with Upstash and OpenAI credentials.
    - The Upstash Vector index must already exist and be populated.
=============================================================================
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Generate embedding
query_text = "trust administration"
print(f"Query: {query_text}\n")

print("1. Generating embedding...")
emb_response = requests.post(
    'https://api.openai.com/v1/embeddings',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    },
    json={
        'input': query_text,
        'model': 'text-embedding-3-small'
    }
)
embedding = emb_response.json()['data'][0]['embedding']
print(f"   Embedding dimension: {len(embedding)}\n")

# Query without namespace first
print("2. Querying WITHOUT namespace...")
query_payload = {
    'vector': embedding,
    'topK': 3,
    'includeMetadata': True
}
print(f"   Payload keys: {list(query_payload.keys())}")

response = requests.post(
    f'{UPSTASH_URL}/query',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json=query_payload
)
print(f"   Status: {response.status_code}")
print(f"   Response: {response.text[:500]}\n")

# Query WITH namespace
print("3. Querying WITH namespace (ceb_trusts_estates)...")
query_payload['namespace'] = 'ceb_trusts_estates'
print(f"   Payload keys: {list(query_payload.keys())}")

response2 = requests.post(
    f'{UPSTASH_URL}/query',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json=query_payload
)
print(f"   Status: {response2.status_code}")
print(f"   Response: {response2.text[:1000]}")
