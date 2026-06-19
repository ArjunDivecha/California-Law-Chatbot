"""
=============================================================================
SCRIPT NAME: check_upstash.py
=============================================================================

DESCRIPTION:
    Checks the status of an Upstash Vector database by making two REST API
    calls: one to fetch general database info (index size, dimensions, etc.)
    and one to list all namespaces. Environment variables for the Upstash REST
    URL and auth token are loaded from the project's .env file. Results are
    printed to stdout for manual inspection.

INPUT FILES:
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-V2/.env
        Loaded by python-dotenv. Must define UPSTASH_VECTOR_REST_URL and
        UPSTASH_VECTOR_REST_TOKEN.

OUTPUT FILES:
    (none — this script only prints results to stdout)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - python-dotenv
    - requests

USAGE:
    python check_upstash.py

NOTES:
    - Ensure the Upstash Vector database is active before running.
    - The .env file must be present in the project root directory.
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
