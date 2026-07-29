# Citation provider shadow benchmark

This benchmark compares citation identity/existence verification across:

1. the production `citationVerify()` implementation backed by CourtListener `/search/`;
2. CourtListener's dedicated `/api/rest/v4/citation-lookup/` endpoint;
3. CiteLaw's `/api/v1/citations/verify` endpoint.

It reuses `tests/citation-eval-set.json`, a 30-entry fixture containing 20 real
California citations and 10 fabricated citations. Several fabricated examples use
a real reporter location with the wrong case name, intentionally testing whether a
provider verifies the whole authority identity rather than reporter existence alone.

Run:

```bash
yarn benchmark:citations --require-all
```

Credentials:

- `COURTLISTENER_API_KEY`
- `CITELAW_API_KEY`

The runner loads existing project environment files but never writes credentials into
artifacts or logs. It sends only public case names, years, and reporter citations—never
client facts or documents.

Results are persisted under `benchmarks/citation-provider/results/` as timestamped
JSON and Markdown plus `latest.json` and `latest.md`.

The benchmark does **not** measure proposition support, quotation or pincite accuracy,
treatment, California citability, or current good-law status.
