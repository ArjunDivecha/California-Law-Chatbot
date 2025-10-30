#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sanity-check Google Search grounding with Gemini.
Requires:
  export GEMINI_API_KEY=...   (Gemini Developer API key)
"""

import os
from google import genai
from google.genai import types

QUESTION = "What did California SB 243 (Oct 2025) require for chatbot disclosures? Cite sources."

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Set GEMINI_API_KEY in your environment.")

    client = genai.Client(api_key=api_key)

    # Enable Google Search grounding (new tool name is `google_search`)
    # Supported on Gemini 2.5 Pro/Flash and 1.5 Pro/Flash.  [oai_citation:2‡Google AI for Developers](https://ai.google.dev/gemini-api/docs/grounding/search-suggestions?utm_source=chatgpt.com)
    config = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())],
        temperature=0.2,
    )

    system_instruction = types.SystemInstruction.from_text(
        "You are a California legal research assistant. "
        "Prefer authoritative sources (.ca.gov, courts.ca.gov, leginfo.legislature.ca.gov, courtlistener.com). "
        "Include dates for recent items. If unsure, say you cannot verify."
    )

    resp = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=[types.Content(role="user", parts=[types.Part.from_text(QUESTION)])],
        config=config,
        system_instruction=system_instruction,
    )

    print("\n=== ANSWER ===\n")
    print(resp.text or "")

    # Inspect grounding metadata (queries + sources)
    cand = resp.candidates[0]
    meta = getattr(cand, "grounding_metadata", None)
    if not meta:
        print("\n(No grounding metadata returned — check model, tools, or API key.)")
        return

    print("\n=== WEB SEARCH QUERIES ISSUED ===")
    for q in getattr(meta, "web_search_queries", []) or []:
        print(" -", q)

    print("\n=== SOURCES ===")
    chunks = getattr(meta, "grounding_chunks", []) or []
    for i, ch in enumerate(chunks, start=1):
        web = getattr(ch, "web", None)
        if web and web.uri:
            print(f"[{i}] {web.title or ''} {web.uri}")

if __name__ == "__main__":
    main()