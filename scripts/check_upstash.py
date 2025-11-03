"""Check Upstash Vector database status"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

UPSTASH_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')

print(f"Upstash URL: {UPSTASH_URL}\n")

# Try to get database info
response = requests.get(
    f'{UPSTASH_URL}/info',
    headers={'Authorization': f'Bearer {UPSTASH_TOKEN}'}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}\n")

# Try to list namespaces
response2 = requests.get(
    f'{UPSTASH_URL}/list-namespaces',
    headers={'Authorization': f'Bearer {UPSTASH_TOKEN}'}
)

print(f"Namespaces Status: {response2.status_code}")
print(f"Namespaces: {response2.text}")
