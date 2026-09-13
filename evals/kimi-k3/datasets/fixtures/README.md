# NON-LIVE fixture dataset

These 12 records exist only to exercise the offline evaluation harness. They
span all six canonical categories, use frozen evidence packets, and have two
synthetic `fixture_non_live` attestations per task.

They are not the canonical 120-task benchmark, are not independent human
review, and must never be used to support a provider or model recommendation.
The Phase 4 fixture attestations are nevertheless cryptographically bound to
the exact normalized fixture dataset, proposition records, and declared source
hashes so the same integrity checks exercised for live data can reject a
modified or unattested fixture task before calibration.

`calibration.jsonl` is likewise NON-LIVE. It contains 30 mechanical controls
and 30 synthetic evidence-locked legal traps for testing the judge gate. Every
row is marked `fixture_non_live: true`; legal rows are additionally marked
`primary_source_locked: true`. Its fixture URLs, excerpts, and zero hashes are
not independently reviewed primary authorities and must not be promoted into a
live benchmark or used to qualify a model.
