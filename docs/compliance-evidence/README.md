<!--
=============================================================================
DOCUMENT: docs/compliance-evidence/README.md
WHAT THIS IS: Index of Femme & Femme's retained, date-stamped vendor
data-protection evidence (PRD_COPRAC_ZDR_COMPLIANCE.md §13, as revised by the
2026-07-01 addendum — post-ZDR posture). Each dated subfolder is an immutable
snapshot; SHA256SUMS.txt in each folder fixes the content as of retrieval.
INPUT SOURCES: public vendor URLs listed per document below.
OUTPUT FILES (this folder tree):
- /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/compliance-evidence/README.md
- /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/compliance-evidence/2026-07-02/*  (snapshots + SHA256SUMS.txt)
=============================================================================
-->

# Compliance Evidence Pack

Retained written documentation of vendor data-protection terms, per the
Morgan v. V2X standard (no-train · no third-party disclosure except
essential-to-service · deletion-on-request · **retained written
documentation**) and PRD §13. ZDR is NOT part of the posture (declined
2026-07-01; ~$100k/yr floor) — these standard terms ARE the operative
controls.

## Snapshot 2026-07-02 (retrieved by Claude Code; hashes in `2026-07-02/SHA256SUMS.txt`)

| File | Source URL | Why it matters |
|---|---|---|
| `anthropic-commercial-terms.html` | https://www.anthropic.com/legal/commercial-terms | Contains the no-training commitment ("will not use Customer Content to train") + incorporates the DPA. Governs the chatbot's direct Anthropic Messages API traffic. |
| `anthropic-dpa.html` | https://www.anthropic.com/legal/data-processing-addendum | Processor terms: subprocessor flow-down, deletion, security-incident duties. |
| `anthropic-privacy-policy.html` | https://www.anthropic.com/legal/privacy | General privacy posture reference. |
| `anthropic-api-data-retention.html` | https://privacy.claude.com/en/articles/10023548-… | Documents the ~30-day default API retention (and exceptions) the disclosure copy cites. |
| `upstash-dpa.pdf` | https://upstash.com/trust/dpa.pdf | §12.4 Restricted-Data prohibition — the contractual ceiling encoded in the provider registry (`restrictedDataProhibited`). |

## Code-level verifications (2026-07-02, this repo at the commit adding this file)

- **No feedback/thumbs path exists in the app.** The only opt-in path by which
  Anthropic may train on commercial content is its feedback feature; the
  codebase contains no Anthropic feedback/rating API usage (verified by
  source grep — nothing to disable).
- **Upstash Vector region: GCP us-central1 (US)** — visible in the REST host
  (`…-gcp-usc1-vector.upstash.io`). US processing confirmed for Vector.
- Per-turn manifests record the provider snapshot (retention posture +
  Restricted-Data flags) on every turn — live compliance evidence.

## Remaining items that require a human (as of 2026-07-02)

1. **Clerk: create a production instance** and swap keys in Vercel env —
   production currently runs a Development Clerk instance.
2. **Sign the OpenAI DPA** for the org that owns `OPENAI_API_KEY`
   (embeddings). Until then the provider registry keeps `privilegeClass:
   review_required` and `ceb_search` stays blocked for client-confidential
   matters (fail-closed, by design).
3. **Upstash dashboard checks**: confirm encryption-at-rest is enabled and
   record the Redis database's region (Vector confirmed US above).
4. **Counsel sign-offs**: privilege/waiver memo (PRD §7), audit-artifact
   discoverability schema (§5.9a), disclosure copy (FR-5.10a revised
   2026-07-01).

## Refresh procedure

Re-run the retrieval into a new dated folder before each recertification
review (provider registry `reviewExpiry` is 2026-12-31), regenerate
`SHA256SUMS.txt`, and update this index.
