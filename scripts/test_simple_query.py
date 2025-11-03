"""Simple Upstash query test"""
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
