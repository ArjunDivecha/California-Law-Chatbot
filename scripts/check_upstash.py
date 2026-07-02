"""
=============================================================================
SCRIPT NAME: check_upstash.py
=============================================================================

DESCRIPTION:
    Checks the status of an Upstash Vector database by making HTTP GET
    requests to its REST API. Loads connection credentials (URL and API
    token) from a .env file in the project root, then queries the /info
    and /list-namespaces endpoints, printing both the HTTP status codes
    and the raw JSON response bodies to stdout. Useful for verifying that
    the Upstash Vector instance is reachable and operational before running
    dependent operations.

INPUT FILES:
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/Drafting Magic/.env
        Environment variables loaded via python-dotenv. Must define:
        UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN.

OUTPUT FILES:
    (none — this script only prints status info to stdout)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - os
    - requests
    - python-dotenv

USAGE:
    python check_upstash.py

NOTES:
    - The .env file must exist with valid Upstash Vector credentials.
    - No changes are made to the database — read-only query.
=============================================================================
"""
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
