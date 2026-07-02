"""
=============================================================================
SCRIPT NAME: check_upstash.py
=============================================================================

DESCRIPTION:
    Queries the Upstash Vector REST API to check the status and available
    namespaces of a vector database. Loads connection credentials from a
    .env file, then calls the /info and /list-namespaces endpoints,
    printing the raw JSON responses to stdout.

INPUT FILES:
    /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-drafting-magic-sanitized/.env
        Environment file containing UPSTASH_VECTOR_REST_URL and
        UPSTASH_VECTOR_REST_TOKEN.

OUTPUT FILES:
    (none — this script only prints results to stdout)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - requests
    - python-dotenv

USAGE:
    python check_upstash.py

NOTES:
    - Requires a valid .env file with Upstash Vector REST credentials.
    - The .env path is resolved relative to the script's location.
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
