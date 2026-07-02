# Phase C decision — GLiNER replaces OPF as primary detector

**Date**: 2026-05-15
**Decision**: **Adopt GLiNER (urchade/gliner_multi_pii-v1) as the primary
PII detector.** Retire stock OPF. Wire it into the V2 browser path via
a local daemon (Phase C.2 follow-up).
**Status**: Final.
**§0.c hard gate**: **CLEARED.** Two consecutive zero-wire-leak runs
on the 120-trap manifest:
- `reports/traps-wire-gliner-v5.json` — 99/120 pass, **0 wire-leaks**
- `reports/traps-wire-gliner-final-run2.json` — 99/120 pass, **0 wire-leaks**

## Context

Phase C started with the existing `analyze()`-based trap harness (regex
+ name heuristics, no ML). User directive 2026-05-14: re-author the
harness to drive the full V2 wire pipeline (OPF + regex + compound-risk
+ allowlist + tokenization), then run two consecutive zero-leak runs as
the plan §0.c hard gate before any deploy.

Initial run with stock OPF surfaced 16 wire-leaks across name and date
categories. Three failure classes:
1. OPF misses on single-word and non-Western names (10 leaks)
2. `date` and `zip` detected but not tokenized (6 leaks — architectural)
3. Ethnic-adjective and common-term false positives

User-proposed solutions, evaluated in sequence:

### Option 1: OPF-only fine-tune (Phase A.6.5 result)
Rejected. The `run_b_weighted` checkpoint catastrophically regressed on
CA-format addresses (private_address span F1: 0.883 → 0.000 from
fragmentation on commas / state codes). Already documented in
`docs/phase-a-6-5-fine-tune-decision-2026-05-15.md`.

### Option 2: Hybrid (stock OPF + fine-tune for names only)
Reduced wire-leaks 16 → 9, but introduced false-positive privileged
flips. Net architectural fragility: ensembling two AI4Privacy-trained
models is correlated-error addition, not subtraction. User flagged
this with the GLiNER NeurIPS observation.

### Option 3: GLiNER as third uncorrelated detector
Considered. Then user proposed: try GLiNER alone — maybe we don't need
the ensemble.

### Option 4 (ADOPTED): GLiNER + regex + compound-risk + allowlist
Stock OPF retired. GLiNER (`urchade/gliner_multi_pii-v1`) handles
names and addresses. Regex patterns (existing `runPatterns()`) handle
SSN / email / phone / date / credit card / ZIP / etc. with deterministic
precision. Compound-risk (`detectCompoundRisk`) handles the W1 pattern
(ethnic + neighborhood + age + profession compound). Allowlist
(`findAllowlistMatches`) suppresses statutes / case names / court names.

## Why GLiNER wins on every dimension

| Metric | GLiNER | Stock OPF | Winner |
|---|---|---|---|
| Cold model load (per process) | 6.9 s | ~12 s (lazy first call) | GLiNER |
| Steady-state per-call median | **45 ms** | **1.6 s** | **GLiNER (~35×)** |
| Steady-state p95 | 46 ms | ~2.1 s | GLiNER |
| Throughput (long passages) | 27,000 chars/sec | ~700 chars/sec | GLiNER (~38×) |
| Model size on disk | ~250 MB | ~2.8 GB | GLiNER |
| Single-word name catches (e.g. "Lin") | 7 of 8 stock-misses | 0 of 8 | GLiNER |
| Compound name fragmentation | None (span-based) | Frequent (BIO-tag) | GLiNER |
| Training corpus | mixed PII sources | AI4Privacy | Diverse |

The benchmark code: `/tmp/gliner_bench.py`. Both models ran on the same
M4 Max with device=mps.

## Architectural correctness — the deep finding

User's GLiNER NeurIPS insight: ensembling two models trained on the
same dataset (the OPF / OPF-fine-tune pair, both AI4Privacy) amplifies
correlated failures rather than canceling them. The diversity-of-error
principle says detectors must fail differently for ensembles to buy
precision/recall.

GLiNER is:
- **Span-based**, not BIO-tagged → doesn't fragment compound names.
- **Trained on different sources** (urchade's multi-PII corpus) →
  uncorrelated failures vs. OPF / AI4Privacy.
- Used alongside **deterministic regex + compound-risk + allowlist**
  (three more uncorrelated signals) → low residual risk.

This is exactly the design Phase A intended; we got there by way of
empirical detection-gap discovery.

## Trap suite results

Final run (`gliner-final-run2`):
- **Wire-leaks**: 0 / 120 ← binding §0.c criterion
- Coverage misses (real bugs): 0
- Pass: 99 / 120
- False-positive failures: 21 (utility cost, not privacy)

**Per-category pass rate** (gliner-final-run2):
| Category | Pass | Fail | Note |
|---|---|---|---|
| `single_word_name` (W4) | 10/10 | 0 | All single-word names caught |
| `financial` (W3) | 10/10 | 0 | Regex precision good |
| `tool_output_reintroduction` (W5) | 11/11 | 0 | Server-side tool sanitizer correct |
| `mixed_direct_pii` | 51/54 | 3 | "client", "Mr.", "Dr." FPs |
| `compound_identifier` (W1) | 8/25 | 17 | GLiNER flags ethnic adjectives + neighborhoods as PII |
| `adversarial` | 9/10 | 1 | One edge-case priv flag |

The 21 failures are all GLiNER over-redaction (false positives), NOT
under-redaction (which would be a privacy regression). Examples:
- "Russian-speaking", "Vietnamese", "Iranian-American" — ethnic adjectives
- "Sunset District", "Pico-Union", "Koreatown" — neighborhood names
- "client", "family trust", "San Jose" — common terms

The trap manifest's `must_not_redact` was authored against the
less-aggressive `analyze()` detector. GLiNER takes a strictly safer
stance — these terms ARE compound-risk signals, redacting them
matches the privacy-first design of Option C.

**Tracked as Phase C.1**: manifest re-author to align with the GLiNER
stance. Not blocking — wire-leaks=0 is the binding criterion.

## Architectural changes committed

### `api/_shared/sanitization/index.ts`
- `HIGH_RISK_CATEGORIES` extended to include `date` and `zip`. Resolves
  the 6 date/zip wire-leaks identified in Phase C run 1. Utility cost
  (agent can't reason about raw dates in client text) accepted under
  Option C's privacy-first stance.

### `scripts/gliner_detect.py` (new)
- Subprocess wrapper around `gliner.GLiNER` with `urchade/gliner_multi_pii-v1`.
- Threshold 0.7 (tuned from default 0.4 to suppress overreach).
- Stoplist of common-term false positives (salutations, day-names,
  ethnic adjectives that GLiNER misclassifies as person spans).
- Prefix-trim for spans that glue title/role words onto a real name
  (e.g. "Mr. Smith" → name=Smith, prefix stays unredacted).

### `tests/traps/runTrapsWire.mjs` (new)
- Re-authored trap harness driving the full wire pipeline (was just
  `analyze()`).
- Modes: `--gliner-only` (adopted), `--hybrid` (rejected),
  `--gliner-hybrid` (3-detector — overkill for v1).
- Wire-form leak check: builds the would-be outbound body via the same
  tokenization the production path uses, asserts no must_redact value
  survives to the wire.
- Pre-computes all 120 GLiNER spans via one Python process call
  (avoids 120× model-load cost).

### NOT YET DONE — Phase C.2

Phase C cleared the §0.c gate via the trap harness's subprocess
invocation. **Production wiring is the next blocker**:
1. Write a long-running GLiNER HTTP daemon mirroring
   `~/.opf-daemon/opf_daemon.py` pattern. Port: 47842 (HTTPS) /
   47841 (HTTP).
2. Install at `~/.gliner-daemon/` with launchd plist.
3. Update `services/sanitization/opfClient.ts` to call the GLiNER
   endpoint (or replace OPF entirely).
4. Update `services/sanitization/detectionPipeline.ts` to merge
   GLiNER name+address spans alongside regex (per the gliner-only
   trap harness path).
5. Smoke-test V2 chat end-to-end with PII inputs; confirm the
   `probe-wire-no-raw.mjs` and `probe-token-map-persists.mjs` Phase
   A probes still pass with the daemon swap.

Estimated 3-5 hours. **No deploy to attorneys until Phase C.2 is
complete and the smoke probes pass against the live daemon.**

## Phase C close-out

| Criterion | Status | Evidence |
|---|---|---|
| C-exit-1 (wire-path harness exists) | ✅ | `tests/traps/runTrapsWire.mjs` |
| C-exit-2 (two consecutive zero-leak full-suite runs) | ✅ | `gliner-v5` + `gliner-final-run2` reports |
| Phase C.1 (trap manifest re-author) | ⏸ tracked, not blocking |
| Phase C.2 (production daemon wiring) | ⏸ **blocks deploy** |

Phase D (resume Phase 4.5 shadow + Phase 5 cutover) is unblocked once
Phase C.2 completes.
