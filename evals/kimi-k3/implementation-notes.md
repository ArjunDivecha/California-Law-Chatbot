# Kimi K3 evaluation implementation notes

## Dataset batch B0 infrastructure

- `datasets/california-law-v1/sources.jsonl` is the append-only registry for
  primary-source records. `datasetTools/ingestSources.ts` validates the exact
  record schema, requires HTTPS canonical URLs and nonblank excerpts, computes
  SHA-256 over the exact stored UTF-8 excerpt bytes, rejects duplicate source
  ids and duplicate canonical-URL-plus-locator pairs, and atomically replaces
  the file only after the complete proposed append validates.
- `datasetTools/authorTasks.ts` accepts task drafts, resolves every proposition
  through the registry, copies the source metadata and source hash into the
  EvalTask evidence/provenance interfaces, and requires each proposition's
  quoted excerpt to occur in the stored source excerpt after whitespace
  normalization. Material criteria must link bidirectionally to known
  propositions. Authored records are limited to the canonical category and
  track enums and to `public` or `synthetic` data.
- Every authored task includes `task_content_sha256`, a stable canonical JSON
  hash over the task with that field omitted. The authoring CLI also reports
  the proposition and source hashes used by the external attestation workflow.
  Existing non-live fixtures remain compatible because the new task hash field
  is optional when reading legacy EvalTask records.
- `datasetTools/verifySources.ts` defaults to offline, hash-only verification
  and makes no network call unless `--live` is explicit. Live mode uses only
  public HTTP GET requests and reports source drift when the normalized stored
  excerpt is absent from the fetched page or the request fails.
- An explicit canonical dataset path in dry-run mode is treated as a
  construction-in-progress dataset: record integrity and category overflow
  still fail closed, while fewer than 120 tasks return progress and remaining
  counts. Live mode continues to use the strict benchmark-integrity path and
  therefore still requires the exact 120-task distribution and bound external
  attestations.
- Offline B0 coverage proves duplicate rejection without file mutation,
  source-entailment rejection, independent excerpt-hash stability, stable task
  hashes, zero-fetch offline verification, and one-of-120 dry-run progress.

## Phase 1 boundaries

- This phase implements only the offline scaffolding required by B1, B2, and
  B7. Judge execution, scoring, calibration, live dataset construction,
  reports, bootstrap inference, and paid transports remain intentionally
  absent until their later phases.
- `prices.json` intentionally leaves Fireworks Kimi K3 and GPT-5.6 Sol as
  `null`. Their authoring-time vendor prices are not pinned in the contract.
  Dry-run reports both missing entries, and live mode refuses before any
  provider request. This differs from the completed-live B1 example's expected
  value of zero and is required by the Phase 1 deliverable.
- Dry-run without `--dataset` validates the canonical 120-task plan and its
  declared category distribution. Fixture mode validates the repository's
  12-task non-live dataset and its 24 explicitly non-live attestations.
- The fixture excerpts and attestations are test-only records. They must never
  be promoted into the canonical live corpus or treated as independent human
  review.
- Provider adapters have no built-in SDK or HTTP fallback. Every call requires
  an injected transport, which makes accidental network access impossible in
  fixture tests. Live transports are deliberately not wired in Phase 1.

## Phase 2 boundaries and deviations

- Phase 2 adds only B3/B4 judge, mirroring, and calibration behavior. Scoring,
  bootstrap inference, candidate journaling beyond Phase 1, canonical live
  dataset construction, and final evaluation reports remain deferred.
- The GPT-5.6 Sol judge has no SDK, HTTP, or environment-key fallback. Like the
  Phase 1 candidate providers, it can run only through an injected transport.
  The transport request freezes `gpt-5.6-sol`, high reasoning, `store: false`,
  no tools, and a task-specific strict JSON schema.
- Strict schema validation is repository-owned and dependency-free. It rejects
  extra or missing fields, invalid enums and ranges, duplicate hard failures,
  wrong model ids, and missing or duplicate atomic criteria. A structurally
  valid legal verdict with a source id or locator outside the frozen packet is
  retained as schema-valid but forced to `ungradable`.
- Candidate text is length-delimited as untrusted data and the judge
  instructions explicitly make embedded evaluator instructions inert.
  Provider and model identities are never placed in the judge prompt.
- Mirroring always issues AB and BA passes. An initially inconsistent mapping
  receives exactly one additional AB pass; absence of a two-of-three mapped
  result becomes `ungradable`. Hard-failure codes are unioned only from
  schema-valid passes and mapped back to candidate identities afterward.
- `datasets/fixtures/calibration.jsonl` contains 60 synthetic, explicitly
  non-live pairs: 30 mechanical controls and 30 evidence-locked legal traps.
  The legal records cover every contract trap class, including ten
  candidate-output injection pairs. Their official-looking URLs and zero hashes
  are fixture markers, not independently reviewed primary authorities, and the
  file must not be promoted to the canonical live benchmark.
- Fixture CLI mode executes all 120 mirrored calibration calls through a
  deterministic in-memory transport before returning its offline plan. Live
  mode is wired to the same gate after paid-run prerequisites, but still
  requires an externally injected judge transport and remains unable to call
  candidate providers in this phase.
- Calibration comparisons use the contract's inclusive bounds. In particular,
  the legal-trap gate is `false_cleared / 30 <= 0.05`, so 1/30 passes and 2/30
  fails. A failure raises `JUDGE_CALIBRATION_FAILED`, writes the diagnostic JSON
  before returning, and never invokes the candidate phase.
- Failed CLI diagnostics default to the gitignored
  `evals/kimi-k3/.calibration-reports/latest-failed.json`; tests use a temporary
  path. Successful fixture calibration does not write a report file.

## Phase 3 scoring, inference, and reporting

- Phase 3 adds B5 scoring, within-task aggregation, category-stratified paired
  task-cluster inference, efficiency accounting, recommendations, and final
  reports. It extends the Phase 1/2 provider and judge adapters; it does not add
  an SDK, HTTP client, or any other network path.
- `scorePair` evaluates repository-owned deterministic assertions before
  Harvey-LAB all-pass. A failed deterministic assertion contributes only one of
  the contract's eight hard-failure codes, remains present even when the judge
  prefers that answer, and makes all-pass false. Mirrored, schema-valid judge
  votes are mapped back to candidate identity before criterion and hard-failure
  unioning.
- Aggregation materializes both expected replicate cells for both providers.
  Missing, failed, and ungradable cells retain distinct statuses. A complete
  paired task requires two gradable replicates for both arms; its binary
  replicate endpoints average to exactly 0, 0.5, or 1.
- Bootstrap inference uses the locally implemented Mulberry32 32-bit PRNG,
  default seed 5601, and default 10,000 resamples. Each draw selects an entire
  task cluster, preserving both providers and both replicates. Strata are
  sampled to the original dataset's category counts (the canonical counts in a
  canonical run), even when the analyzable cluster pool is smaller. The 5th and
  95th empirical percentiles are the one-sided bounds. Fixture/test runs may
  lower only the resample count with `--bootstrap-resamples`.
- Latency and token summaries are computed from normalized response journal
  records. Per-task cost and paired efficiency deltas use the mean of the two
  replicate calls so a task, rather than a replicate, remains the inference
  unit. Router records already include classifier latency/tokens/cost; when a
  cost must be reconstructed, candidate and classifier usage are priced
  separately against their pinned models.
- The recommendation engine evaluates each challenger independently.
  Benchmark/calibration/integrity/identity/inference completeness failures are
  inconclusive; global quality or safety failures keep Anthropic. Category
  weakness can produce escalation shadowing only when every weak category has
  a predeclared deterministic escalation rule. The router additionally needs a
  strictly negative point-estimate mean-cost delta; otherwise it emits
  `ROUTER_NO_COST_ADVANTAGE`.
- Fixture mode now runs 72 in-memory candidate calls, 48 scored baseline-
  anchored pairs with mirrored in-memory judgments, aggregation, bootstrap,
  efficiency, recommendations, and reporting after its 120-call calibration.
  The run id and generated timestamp are fixed fixture constants, so
  `summary.json` has identical bytes and SHA-256 across reruns for the same seed
  and resample count. Because the fixture has only 12 non-live tasks, both
  challenger recommendations correctly remain `INCONCLUSIVE`; fixture output
  must not be used as provider evidence.
- Reports are written to `reports/kimi-k3-eval/<run-id>/summary.json` and
  `report.md`, with `reports/kimi-k3-eval/latest.json` as a relative pointer.
  Markdown separates frozen-evidence and shared-agent tracks, labels primary,
  safety co-primary, and secondary endpoints, and includes overall/category
  metrics, efficiency deltas, routing mix, visible incomplete cells, and one
  recommendation per challenger. Undefined display values use an em dash; a
  supplied prior value is retained with a trailing asterisk. Machine-readable
  JSON retains `null`. Artifact sanitization removes credential, token-map, and
  hidden-reasoning-shaped fields and redacts secret-looking strings.
- Fireworks Kimi K3 and GPT-5.6 Sol prices remain `null` for the same contract
  reason recorded in Phase 1. Fixture reports therefore render Kimi cost
  endpoints as undefined, while live mode still refuses before any request
  until every required vendor price is pinned.

## Phase 4 journal, resume, manifest, and run integrity

- Phase 4 replaces the fixture evaluator's in-memory run journal with
  `provider-journal.jsonl`. Candidate cells use the contract key
  `task|arm|replicate-N`; router classifier records use the same cell identity
  plus `|classifier`. Each line is opened in append mode, written, fsynced, and
  closed before evaluation continues. Duplicate keys and malformed resume
  journals fail closed.
- `--resume <run-id>` loads candidate cells from that durable journal before
  either the router classifier or candidate transport is reached. The offline
  interruption proof stops after three fsynced candidate cells, resumes with
  all three skipped, records zero repeated provider calls, and produces the
  exact same summary bytes and SHA-256 as an uninterrupted fixture run.
- `manifest.json` is atomically created before calibration and atomically
  finalized after reporting. It binds repository SHA/dirty state; normalized
  dataset and attestation hashes; prompt, tool, limit, router mapping/config,
  and price-table hashes; exact static and Kimi ids plus the complete router
  pool; judge settings; bootstrap seed/resamples; timestamps; and run mode.
  Resume refuses a missing, finalized, or configuration-mismatched manifest.
- Every non-append Phase 4 artifact is written to a same-directory temporary
  file, fsynced, and renamed: manifest, summary, Markdown report, latest
  pointer, judge results, deterministic results, and failed calibration
  diagnostics. The provider journal is the only append artifact.
- Benchmark integrity now runs before calibration in fixture and live modes.
  It enforces the expected category distribution and total, complete
  source/proposition/criterion bidirectional links, exact evidence/provenance
  source-hash binding, and two distinct `APPROVE` attestations per task bound
  to the normalized dataset, proposition hashes, and source hashes. Any
  invalid or unattested task is excluded and creates an explicit replacement
  requirement; the evaluator never silently accepts a reduced task set.
- The 24 non-live fixture attestations were re-bound to the normalized 12-task
  fixture hash and each task's normalized proposition hashes. They remain
  synthetic and non-live; hash binding tests evaluator integrity behavior but
  does not turn them into independent review or primary-authority validation.
- Artifact values are sanitized before persistence for secret-shaped strings,
  configured provider-key environment values, and hidden-reasoning-shaped
  fields. After the fixture manifest is finalized, the entire run directory is
  scanned; any `sk-`, key assignment, bearer credential, configured provider
  key value, or hidden-reasoning field fails the run.
- Dry-run output includes minimum and maximum candidate, classifier,
  mirrored-judge, calibration-judge, and total calls. Its
  `context_window_max` cost estimate uses the frozen price table and
  deliberately high token ceilings as an informational ceiling. A `null`
  price makes that estimate `null` and appears as a blocking gap; live mode
  separately refuses missing prices.
- No SDK, HTTP client, fetch call, or other network path was added. Fixture
  candidate, classifier, calibration, and pairwise judge behavior remains
  transport-injected and deterministic.

## JUDGE CANDIDATE registry and bakeoff

- `judge/judgeRegistry.ts` is the single judge allowlist. The default remains
  `gpt-5.6-sol`; the registered candidates are native `deepseek-v4-pro` and
  the Fireworks fallback `accounts/fireworks/models/deepseek-v4-pro`. Unknown
  `--judge` values fail
  during argument parsing, and a candidate run selects one adapter before
  calibration. The same adapter is then used for every mirrored calibration
  and candidate-comparison judgment in that run.
- The GPT-5.6 Sol Responses request and both DeepSeek V4 Pro
  chat-completions routes share `judge/sharedJudge.ts` for anonymous
  length-delimited answers, frozen-evidence instructions, task-specific strict
  JSON schema construction, client-side validation, complete-criterion checks,
  and exact supplied source-id-plus-locator grounding. Provider response-format
  enforcement is defense in depth; schema-invalid JSON is always ungradable and
  lowers calibration schema validity.
- The parameterized DeepSeek adapter freezes temperature 0, top-p 1, seed 5601,
  4,096 output tokens, no tools, and no web search. The native route uses
  `https://api.deepseek.com`, `DEEPSEEK_API_KEY`, model `deepseek-v4-pro`, and
  JSON-object output mode; the Fireworks fallback retains its distinct base
  URL, environment-variable name, model id, and strict JSON-schema response
  format. Both use the same authoritative client-side strict-schema validation.
  The adapter contains no SDK, HTTP, or `fetch` path and can run only through
  an injected transport. Live wiring reads only the configured key from
  `process.env` and never persists it. The native endpoint is PRC-hosted and is
  permitted here only for anonymized candidate outputs plus public or synthetic
  evidence; a judge-input data-class change requires re-review.
- `--judge-bakeoff` runs the identical 60-pair, mirrored calibration set across
  every registered adapter. Fixture mode creates a deterministic transport per
  judge; live mode requires a separately injected transport for every judge.
  A judge failure is retained as a per-judge FAIL verdict rather than aborting
  the comparison. JSON and Markdown artifacts report all six calibration
  rates, threshold failures, input/output tokens, pinned-price cost, total and
  mean latency, and the passing winner.
- Bakeoff artifacts are
  `reports/kimi-k3-eval/<run-id>/judge-bakeoff.json` and
  `judge-bakeoff.md`. Candidate-run `manifest.json` binds both `judge_id` and
  `judge_model`; every `judge-results.jsonl` record carries the same explicit
  identity. Resume therefore rejects a changed judge through the existing
  manifest-configuration comparison.
- `config/prices.json` pins native DeepSeek V4 Pro cache-miss pricing at $0.435
  input and $0.87 output per million tokens from
  `api-docs.deepseek.com/quick_start/pricing` fetched 2026-07-27, while retaining
  the Fireworks fallback at $1.74/$3.48.

## B7.5 live-calibration integration

- `judge/calibration.ts` now classifies each calibration file as exactly one
  set kind. A row is live when `live_calibration: true`; this authoritative
  marker intentionally supersedes the legacy `fixture_non_live: true` field
  retained on the immutable B7.5 rows for compatibility. A fixture-only row
  requires `fixture_non_live: true`. Unmarked rows and files mixing live and
  fixture-only rows are rejected.
- Live calibration rows must declare non-empty `source_ids`. The loader derives
  `sources.jsonl` from the calibration file's dataset directory, resolves every
  id, and builds the judge packet from the registry record's id, locator,
  excerpt, jurisdiction, authority status, dates, canonical URL, and hash.
  Missing registry ids fail closed. Synthetic evidence is used only for
  fixture-kind rows that omit `source_ids`.
- Every normalized pair and calibration diagnostic records whether its evidence
  packet came from `source_registry` or `fixture_synthesis`, including the
  resolved registry path and ids for registry packets. Calibration reports also
  record `calibration_set_kind` and set `fixture_non_live` from that kind.
- `--calibration <path>` selects the calibration file. Fixture mode still
  defaults to `datasets/fixtures/calibration.jsonl`. Live mode requires an
  explicit calibration path and rejects a fixture-kind resolved set with
  `LIVE_CALIBRATION_REQUIRED` before any judge transport is called.
- Candidate-run manifests bind `calibration_path`, `calibration_hash`, and
  `calibration_set_kind`, so resume comparison rejects calibration drift or a
  fixture/live kind change.
- Offline tests exercise the unchanged fixture and live 60-pair files through
  deterministic judge transports, verify live registry excerpts reach the
  judge packet, cover unmarked/mixed refusal and the CLI live gate, and confirm
  a fixture-mode run against the live set records `live` in its manifest.

## Attestation preflight and machine-only disclosure

- Supplying `--attestations` now always loads the external JSONL in benchmark
  preflight, including dry-run. When dry-run omits `--dataset`, the supplied
  attestations are checked against the current canonical
  `datasets/california-law-v1/tasks.jsonl`; no declared 240-record count is
  substituted for the file.
- Preflight recomputes the normalized dataset, proposition, and source hashes
  with the same `integrity.ts` helpers used by `makeAttestation.ts`. It accepts
  exactly two bound `APPROVE` records per task from distinct reviewer ids.
  Malformed records, stale or mismatched bindings, unknown task ids, missing
  approvals, duplicate-reviewer coverage, and excess approvals fail closed.
- CLI success and integrity-error JSON now expose
  `reviewer_attestations`, `attestation_reviewer_ids`, and
  `attestation_binding_failures`. The valid canonical machine-attestation
  preflight reports 240 records and the two registered verifier ids; a
  one-record dataset-hash tamper reports 239 valid records plus the precise
  binding failure without making a network request.
- Manifests bind sorted `attestation_reviewer_ids` and classify them as
  `machine_only` only when every id is one of
  `verifier-claude-opus-5` or `verifier-gpt-5.6-sol`; otherwise the value is
  `human` or `mixed`. Reports prominently disclose machine-only cross-vendor
  LLM attestation and zero human review. Repository fixture reports instead
  label their existing records as non-live fixture-only and also state that
  they are not human review.

## LIVE transport and paid-run wiring

- `live/transports.ts` is the only fetch implementation for this harness.
  `runCli` constructs it only in confirmed live mode, after required argument,
  key, price, live-calibration, conservative-cost, and manifest checks have
  completed; candidate-comparison runs additionally require the complete
  attested benchmark-integrity gate. Bakeoff-only runs do not load the
  candidate dataset or its attestations because no candidate arm is in play.
  Fixture and dry-run modes still construct no live transport and make zero
  network calls.
- Anthropic candidates, routed pool calls, and the Haiku classifier use
  `https://api.anthropic.com/v1/messages`, the process-time
  `ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, and the existing
  approved-family guard immediately before every fetch attempt. Candidate
  `max_tokens` comes from the frozen run limit. The request omits `thinking`
  entirely so Fable retains its model default and does not receive an explicit
  disabled value.
- Kimi uses Fireworks chat completions. GPT-5.6 Sol uses OpenAI Responses with
  high reasoning, `store: false`, no tools, and the exact strict task schema
  built by `gpt56Judge.ts`. Native DeepSeek uses its distinct
  `/chat/completions` endpoint and JSON-object mode; the Fireworks DeepSeek
  fallback keeps strict JSON-schema response formatting. Keys are resolved
  from `process.env` at call time and never enter a request journal or error
  message.
- Candidate calls use a 120-second timeout, long-context candidates use 600
  seconds, and judge calls use 180 seconds. HTTP 429 and 5xx responses receive
  at most two retries with exponential backoff and jitter. Wall-clock latency
  covers the complete logical call, including retries. Provider failures are
  converted to normalized candidate or judge error fields.
- `paid-call-journal.jsonl` fsyncs every HTTP attempt and successful real usage
  before execution continues. Successful entries also retain the sanitized
  normalized transport response, closing the crash window between the HTTP
  response and the higher-level candidate/judge journal; resume can replay it
  without another paid request. Recorded input/output tokens are priced
  against the manifest-bound table. Before every fetch attempt, `LiveCostCap`
  checks recorded spend plus a conservative upper bound for that request; a
  refusal is fsynced in the paid-call journal as `COST_CAP_HARD_STOP` and
  returned through the normalized candidate or judge error fields before the
  CLI stops. A cap refusal is deliberately not marked as a completed
  candidate/judge cell, so resume can continue it under a larger cap without
  repeating any successful call.
- `judge-journal.jsonl` durably records calibration, bakeoff, and candidate
  judgments by judge, phase, pair, order, and pass index. Resume replays these
  normalized results without another paid call. Candidate and classifier
  resume continues to use `provider-journal.jsonl`.
- Live candidate order is manifest, selected-judge calibration, all three
  candidate arms, baseline-anchored mirrored judging, aggregation/reporting,
  manifest finalization, and artifact-hygiene scan. Live `--judge-bakeoff`
  writes its manifest, runs the same 60 live pairs across all three registered
  judges, writes both bakeoff reports, finalizes the manifest, and returns with
  zero candidate-provider calls.
- Offline mocked-fetch coverage exercises every provider URL/header/body,
  Anthropic guard calls and thinking omission, OpenAI high-reasoning
  `store:false`, DeepSeek JSON-object mode, retry delays, durable cost-cap
  stop/resume, the per-provider missing-key matrix, a complete 2,040-request
  mocked live run, and bakeoff-only termination. No real provider request was
  made while implementing or testing this layer.

## Live judge schema/transport incident (2026-07-28)

- The paid run at
  `reports/kimi-k3-eval/live-2026-07-28T04-01-20-354Z` did not use a ghost
  transport for native DeepSeek. Its 120 successful DeepSeek paid-call records
  match all 120 DeepSeek judge-journal records on response id, input tokens,
  output tokens, and latency. The real `normalized_response.output_text`
  therefore reached `executeJudgeRequest` and strict client validation.
- The actual native-DeepSeek failure was a wire-prompt omission. The route used
  `response_format: {"type":"json_object"}`, which enforces JSON syntax but
  not a schema, while the exact task-specific schema returned by
  `buildSharedJudgePrompt` was neither sent through `response_format` nor
  serialized into either chat message. The model consequently returned many
  valid JSON objects with ad-hoc keys such as `hard_failure` and
  `material_hard_failure`; strict validation correctly rejected all 120.
- Native DeepSeek now receives the exact task-specific output schema in its
  system message, explicitly labeled `REQUIRED_OUTPUT_JSON_SCHEMA`. Fireworks
  continues to send the schema through strict `json_schema` response format,
  and OpenAI continues to send it through Responses structured output. The
  repository-owned validator remains authoritative for every route.
- A separate injection bug existed at the CLI seam: live judge bakeoff honored
  `judge_transports[judgeId]` but silently ignored the singular
  `judge_transport` dependency used for the selected judge, even though the
  fixture bakeoff and ordinary selected-judge path accepted it. Transport
  selection is now centralized. The selected judge uses the same singular
  seam in fixture, live bakeoff, calibration, and candidate judging; keyed
  per-judge injection takes precedence when supplied.
- Offline full-live-CLI regressions inject a singular OpenAI sentinel and keyed
  native-DeepSeek/Fireworks sentinels while making fallback fetch fatal. A
  schema-valid run produces `schema_validity: 1.0`; an invalid-JSON run
  produces `schema_validity: 0`. In both cases each judge makes exactly 120
  transport calls, writes exactly 120 matching judge-journal records with the
  same response ids/tokens/latencies, and performs zero fallback fetches or
  ghost calls.

## Calibration-pass binding (2026-07-28)

- Live candidate-comparison runs accept
  `--bind-calibration <path-to-bakeoff-run-dir>`. The directory must contain
  both `judge-bakeoff.json` and `manifest.json` from a standalone live bakeoff.
  Binding is accepted only when the selected judge has a complete passing
  six-rate result, its judge-config hash matches the current code, the exact
  calibration-file content hash matches, and the manifest-bound run start is
  no more than 24 hours old and not in the future.
- A judge-config hash is stable canonical JSON over the exact judge instruction
  string (including the native-DeepSeek JSON-schema instruction where
  applicable), that route's response schema form (including OpenAI's
  wire-compatible schema sanitization), and the registered deterministic
  transport configuration for that judge id. These executed prompt/schema
  constants are exported from their judge modules so the executed and hashed
  forms cannot drift independently.
- New bakeoff JSON records the run start and calibration content hash at the
  report level and repeats the start, set hash, judge-config hash, and all six
  metric rates in every judge row. Bakeoff manifests record the per-judge
  config-hash map alongside their existing start and calibration hash. The
  passing run at
  `reports/kimi-k3-eval/live-2026-07-28T18-44-50-987Z` predates these config
  fields and is therefore deliberately unbindable; attempting to bind an old
  artifact logs that a fresh standalone bakeoff is required.
- An accepted binding skips only the in-run calibration phase. Candidate calls
  and all baseline-anchored mirrored judgments still use the selected current
  judge adapter. The canonical manifest records `bound_run_id`,
  `bound_judge_id`, `bound_run_started_at`, all six bound metrics, both matched
  hashes, and `binding_verified: true`.
- Any unreadable artifact, missing legacy field, cross-artifact disagreement,
  judge-id mismatch, current config drift, calibration-set drift, stale/future
  timestamp, incomplete rates, or failed threshold logs the exact reason and
  falls back to the unchanged in-run calibration. If that in-run calibration
  fails, the existing `JUDGE_CALIBRATION_FAILED` hard stop still occurs before
  any candidate call.
- Offline coverage uses a stub-built bakeoff directory for a full accepted
  live run, proves that it makes zero calibration judge calls and writes the
  binding manifest block, rejects each required mismatch dimension
  independently, checks the explicit legacy-artifact message, and re-proves
  that fallback calibration failure permits zero candidate fetches.

## Dataset-derived live-start cost preflight (2026-07-28)

- Live start now compares `--max-cost-usd` with the B8 dataset-derived
  conservative projection, not the context-window-max ceiling. The projection
  measures every real task's assembled candidate and judge inputs, applies the
  B8 1.25x input padding, 4,000-token system/tool allowance, 4,096-token
  candidate and judge output allowances, worst-price router tier, and pinned
  model prices.
- The estimate covers exactly the phases the run will execute: candidates,
  classifier, pairwise judging, and calibration. A successfully verified
  calibration binding sets only the calibration phase to zero. A missing or
  rejected binding includes fallback in-run calibration.
- Live manifests record `conservative_cost_estimate_usd`,
  `cost_estimate_method: "dataset_derived_conservative"`, and the candidates,
  classifier, pairwise-judging, calibration, and total phase breakdown. The
  CLI also returns the old context-window-max number separately for
  informational comparison.
- Cap semantics remain strict `estimate > cap`: the current real dataset's
  unbound GPT-5.6 Sol projection is about $470, so a $600 cap passes preflight
  while a $5 cap refuses before any fetch. The journaled actual-usage
  `LiveCostCap` check before every paid call is unchanged.
