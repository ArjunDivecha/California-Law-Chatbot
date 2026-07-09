"""
=============================================================================
SCRIPT NAME: test_upsert_format.py
=============================================================================

DESCRIPTION:
    Tests the correct format for Upstash vector database upsert operations.
    Generates a text embedding via the OpenAI Embeddings API, then upserts
    the vector into an Upstash vector index with metadata. After a short
    indexing delay, queries the index to verify the vector was stored
    correctly and results can be retrieved.

INPUT FILES:
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/.env
        Environment variables loaded via python-dotenv: UPSTASH_VECTOR_REST_URL,
        UPSTASH_VECTOR_REST_TOKEN, and OPENAI_API_KEY.

OUTPUT FILES:
    (none — this script only prints results to stdout)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - python-dotenv
    - requests

USAGE:
    python scripts/test_upsert_format.py

NOTES:
    - Requires a running Upstash vector index and valid OpenAI API key,
      both configured in the .env file.
    - The script sends test vectors to the configured Upstash namespace
      and then queries them back to confirm the upsert succeeded.
=============================================================================
"""
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Generate a simple embedding
print("1. Generating test embedding...")
emb_response = requests.post(
    'https://api.openai.com/v1/embeddings',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    },
    json={
        'input': 'California trust administration duties',
        'model': 'text-embedding-3-small'
    }
)
embedding = emb_response.json()['data'][0]['embedding']
print(f"   Generated {len(embedding)}-dim vector\n")

# Try upsert with correct format
print("2. Testing upsert...")
test_vector = {
    "id": "test_vector_002",
    "vector": embedding,
    "metadata": {
        "text": "California trust administration duties include providing notice to beneficiaries.",
        "category": "trusts_estates",
        "title": "Trust Administration"
    },
    "namespace": "ceb_trusts_estates"
}

response = requests.post(
    f'{UPSTASH_URL}/upsert',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json=[test_vector]
)

print(f"   Status: {response.status_code}")
print(f"   Response: {response.text}\n")

# Wait for indexing
print("3. Waiting 3 seconds for indexing...")
time.sleep(3)

# Now try to query it
print("4. Querying for similar vectors...")
query_response = requests.post(
    f'{UPSTASH_URL}/query',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json={
        'vector': embedding,
        'topK': 3,
        'namespace': 'ceb_trusts_estates',
        'includeMetadata': True
    }
)

print(f"   Status: {query_response.status_code}")
result = query_response.json()
print(f"   Found {len(result.get('result', []))} results")
if result.get('result'):
    for i, r in enumerate(result['result'][:2], 1):
        print(f"\n   Result {i}:")
        print(f"     ID: {r.get('id', 'N/A')}")
        print(f"     Score: {r.get('score', 0):.4f}")
        print(f"     Text: {r.get('metadata', {}).get('text', 'N/A')[:100]}...")
