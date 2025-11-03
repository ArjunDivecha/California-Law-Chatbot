"""Test fetching vectors by ID"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')

# Get the first vector ID from embeddings file
import json
with open('data/ceb_processed/trusts_estates/embeddings.jsonl', 'r') as f:
    first_record = json.loads(f.readline())
    vector_id = first_record['chunk_id']
    print(f"Testing with vector ID: {vector_id}\n")

# Try to fetch by ID
print("1. Fetching vector by ID...")
response = requests.post(
    f'{UPSTASH_URL}/fetch',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json={
        'ids': [vector_id],
        'namespace': 'ceb_trusts_estates',
        'includeMetadata': True
    }
)

print(f"   Status: {response.status_code}")
print(f"   Response: {response.text[:1000]}\n")

# Try range query
print("2. Trying range query (first 5 vectors)...")
response2 = requests.post(
    f'{UPSTASH_URL}/range',
    headers={
        'Authorization': f'Bearer {UPSTASH_TOKEN}',
        'Content-Type': 'application/json'
    },
    json={
        'cursor': '',
        'limit': 5,
        'namespace': 'ceb_trusts_estates',
        'includeMetadata': True
    }
)

print(f"   Status: {response2.status_code}")
print(f"   Response: {response2.text[:1000]}")
