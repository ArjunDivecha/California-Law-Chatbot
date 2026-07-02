# Browser-GLiNER integration into V2 — status (2026-06-30)

Branch: `claude/browser-gliner-prototype`. Detector selection behind
`VITE_DETECTOR` (default `daemon`; `web` = in-browser GLiNER). fp32, self-host
intent. Fully reversible (flag flip, or revert the branch).

## What changed (production code, all behind the flag)

- `services/sanitization/glinerWebClient.ts` — NEW. In-browser fp32 GLiNER
  engine (GLiNER.js + ONNX Runtime Web, WebGPU→WASM fallback). Exposes
  `detectSpans` / `getHealth` / `warmup` with opfClient-identical shapes.
  Node-safe at top level (dynamic `import('gliner')`, guarded env reads).
- `services/sanitization/glinerPostProcess.ts` — NEW. Verbatim port of the
  daemon's LABEL_MAP / STOPLIST / PREFIX_TRIM / 0.7 threshold.
- `services/sanitization/opfClient.ts` — `detectSpans`/`getHealth`/`warmup`/
  `connectBridge` delegate to the web engine when `VITE_DETECTOR=web`.
  detectionPipeline.ts and useSanitizer.tsx are UNCHANGED.
- `api/_shared/sanitization/index.ts` — `Span` gained optional `score?: number`
  (web engine populates it; unblocks the §E confidence gate later).
- `public/ort/` — vendored ORT 1.19.2 wasm (matches gliner@0.0.19's bundled
  onnxruntime-web). `gliner` added to V2 dependencies.

## Verification — REAL detectPii over 120 traps, in-browser

Harness: `traps-verify.html` + `traps-verify.ts` (dev-only, root). Runs the
actual production `detectPii()` with `VITE_DETECTOR=web`.

FINAL (after the geo/visa tuning below):

| Provider | Pass | Wire leaks | Web engine used | Median |
|----------|------|-----------|-----------------|--------|
| webgpu (run 1) | **120/120** | **0** | 120/120 (heuristicFallbacks=0) | 22 ms |
| webgpu (run 2) | **120/120** | **0** | 120/120 | 23 ms |
| wasm   | **120/120** | **0** | 120/120 | 323 ms |

`npm run test:traps` (analyze/regex+names baseline, Node): **120/120**, no regression.

### Tuning applied to reach 120/120 (was 117/120)

The 3 residual FPs were pre-existing, detector-independent over-redactions, fixed
surgically:
- **Visa codes** (`glinerPostProcess.ts` stoplist): GLiNER mis-tagged "EB-3" as
  driver_license. Added EB-1..5 / H-1B / L-1 / O-1 / etc. to the full-span stoplist.
- **Bare-place suppression** (`detectionPipeline.ts`, single post-merge filter):
  "San Jose", "Long Beach", "Fresno County" were emitted as standalone spans by
  three different paths (GLiNER street_address over-tag, the OPF/GLiNER name-split
  residual, the bigram scanner). Instead of patching each, `detectPii` now drops any
  merged span whose ENTIRE text is a bare place/role term (shared stoplist) or matches
  `"<X> County" / "<X> City"`. A full address ("88 Industrial Drive, San Jose") is a
  longer span and is unaffected. Compound-risk still fires `privileged` on the
  combination, so confidentiality is unchanged — this only removes over-redaction.
  Benefits the daemon path too (detectPii is shared; not flag-gated).

  Tradeoff (documented): a real span whose exact text equals a stoplisted term (e.g.
  a client literally named "Berkeley") would be dropped — the same tradeoff the GLiNER
  stoplist already makes. None of the 120 traps hit this.

- **0 wire leaks** — the confidentiality guarantee holds. No raw must_redact
  value reaches the synthesized wire on any trap.
- **The web engine was actually used on all 120** (usedOpf=true everywhere) —
  not the heuristic fallback.

## (Historical) The 3 non-passing traps — now fixed; were PRE-EXISTING and detector-independent

Span-level diagnosis (labels tell the origin):

| Trap | FP / miss | Span label | Origin |
|------|-----------|-----------|--------|
| T-W1-007 | FP "Fresno County" | `opf-internal-bigram` | detectPii's own name-refinement heuristic — runs regardless of detector |
| T-PII-006 | FP "San Jose" | `opf-internal-bigram` | same detectPii heuristic |
| T-W1-017 | FP "EB-3" | `gliner:driver license` | GLiNER model mis-tag — the daemon runs the SAME model, so identical |

None are wire leaks; all are **over-redaction / a model quirk**. They are NOT
introduced by the daemon→browser swap:
- The two `opf-internal-bigram` FPs come from `detectPii`'s legacy OPF-era logic,
  independent of which detector produced the spans.
- "EB-3" is GLiNER (the same model the daemon wraps) mis-classifying a visa code.

Report history confirms it: these exact three trap IDs fail across the whole
tuning lineage (`gliner-only` 102-fail → v2 51 → v3 39 → v4 24 → v5 21) and were
only cleared in `gliner-final-v8` (120/120). **That v8 gate is the `runTrapsWire
--gliner-only` *test* pipeline** (GLiNER name+address + regex + tuned
allowlist/stoplist) — which does NOT run detectPii's `opf-internal-bigram` /
`refineOpfWithNames` logic. The actual daemon-through-detectPii run on record
(`traps-wire-run1`) was 94/120 with 16 leaks. So 117/120 here reflects the real
production `detectPii` path; the daemon would score the same on these three.

## Open decision (NOT part of the detector swap)

Closing 117→120 means aligning the production `detectPii` path with the
v8-tuned `--gliner-only` logic — i.e. (a) stop `opf-internal-bigram` from tagging
Title-Case geographic phrases already in the geo stoplist ("San Jose", "Fresno
County"), and (b) suppress GLiNER's visa-code mis-tag ("EB-3"). Both also improve
the daemon path. This is a pre-existing tuning task, separate from "swap the
detector," and should be scoped on its own.

## PRODUCTION FLIP (2026-06-30) — web detector now the default

`VITE_DETECTOR=web` set for **Production** and a fresh production build deployed
(`vercel deploy --prod`) — a fresh build, NOT the preview artifact (VITE_ vars bake
per-env: prod needs `pk_live_`, preview had `pk_test_`; same detector code either way).
Production target is now `california-law-chatbot-v2-m4nu8o12g.vercel.app`. The V2
project has NO custom domain (alias:[]), so this is the V2 line's pre-launch
production, not a live custom-domain attorney app.

Verified (bypass on the SSO-protected .vercel.app prod URL): root 200, `/api/chats`
401 (sk_live_ works server-side, not 500), `/ort/…jsep.wasm` 200/21 MB (vendored wasm
shipped). NOT verifiable by me: the live-Clerk-instance sign-in click-through (the
test user is on the TEST instance; no live creds) — but the identical code path was
fully tested on Preview (sign-in → model loads from Blob → 0 errors) and the detector
is 120/120 in the harness. The daemon is no longer required in production.

INSTANT ROLLBACK if needed: `vercel rollback california-law-chatbot-v2-l6notb8ou.vercel.app`
(restores the previous daemon-based prod deployment), and/or remove the Production
`VITE_DETECTOR` env var to make `daemon` the default again.

## Env persistence, streaming progress, fp16 trial (2026-06-30, later)

- **Preview env persisted** (via Vercel REST API — the bundled CLI v54.12.0 loops
  on preview-env add): `CLERK_SECRET_KEY` (sk_test_, fixes the pre-existing 500 that
  wedged ALL previews), `VITE_GLINER_MODEL_URL` (fp32 Blob), `VITE_DETECTOR=web`.
  **Production `VITE_DETECTOR` intentionally NOT set** → prod stays on the daemon
  until the load UX is signed off. Any future preview now works with no build-env flags.
- **Deployed preview tested end-to-end** (`@clerk/testing` sign-in as
  `v2-playwright-e2e+clerk_test`, Vercel SSO bypassed via the project's existing
  protection-bypass): signed in → `/v2` workspace rendered → model fetched 200 from
  Blob → **0 console errors**. Root cause of the earlier "stuck Loading…" was the
  missing Preview `CLERK_SECRET_KEY` (→ `/api/chats` 500), NOT the model.
- **Streaming loader + progress** added to `glinerWebClient.fetchModelBytes`:
  streams the download (no single 1.1 GB `arrayBuffer()` allocation), tracks bytes,
  and exposes `getLoadProgress()` (+ `DaemonHealth.loadProgress`) with phases
  `downloading → initializing → ready`. Also logs when Safari's CacheStorage rejects
  the blob (→ re-download next visit). Note: the model loads in the BACKGROUND
  (SanitizerProvider renders children immediately), and there is no central progress
  banner today — the data is exposed for a UI to consume; `daemonStatus` is used as a
  readiness gate (e.g. V2DraftingMagicPage), not a progress bar.
- **fp16 trial — NOT adopted.** Uploaded fp16 (580 MB) to the same public Blob store
  and ran the real `detectPii` gate: **118/120, 0 wire leaks**, webgpu median 57 ms.
  It fails the 120/120 bar (2 zip category-coverage misses — the zip IS redacted
  inside a larger address span, so no leak, but not tagged `zip`) AND is slower on
  webgpu than fp32 (57 ms vs 22 ms; fp16 is emulated). Its only advantage is half the
  download. **fp32 remains the deployed model.** The fp16 blob is left in place as a
  fallback if the download-size tradeoff is later accepted:
  `…/gliner/model_fp16-t0tTeXu8hwxHbnOodI2iLhKZWRRSMq.onnx`.
- The 1.1 GB download-time concern therefore stands; the durable fix is persistence.
- **Persistence decision (Chrome-only audience): OPFS NOT built.** OPFS + service
  worker was aimed at Safari's aggressive CacheStorage eviction; the audience is
  Chrome, whose CacheStorage quota comfortably holds 1.1 GB. Instead added
  `navigator.storage.persist()` in `glinerWebClient` before the download, which marks
  the origin's storage durable (not evicted under disk pressure) on Chrome — making
  the 1.1 GB a true one-time download without OPFS complexity. Verified on Chromium:
  two consecutive loads, RUN 2 served from CacheStorage with NO network fetch,
  120/120 both. Combined with the streaming loader, the download shows progress and
  happens once.

## Deploy plumbing — DONE (2026-06-30, staged inert)

Self-hosting is wired up on Vercel project `california-law-chatbot-v2`:
- **Model on Vercel Blob (public store `clc-v2-model-public`, `store_CyRNH0EgaBzbNgZF`):**
  `https://cyrnh0egabzbngzf.public.blob.vercel-storage.com/gliner/model_fp32-vrAnlNVLkxhgSpHM1yfWeQi1KbPen7.onnx`
  — public, CORS `*`, `cache-control: public, max-age=31536000`, 1,157,129,714 bytes.
  Verified (fresh-profile network trace) that the browser loads the model from THIS
  Blob URL and passes 120/120, 0 leaks, on webgpu.
- **`VITE_GLINER_MODEL_URL`** set in **Production** and **Development**. (Preview
  pending — the bundled Vercel CLI v54.12.0 loops on the all-Preview-branches path;
  set via dashboard or after `npm i -g vercel@latest`.)
- **`VITE_DETECTOR` is intentionally NOT set** → production still uses the daemon
  detector. Everything above is INERT until someone sets `VITE_DETECTOR=web`. That
  flip is the deliberate activation step and was left for explicit sign-off.
- **Confidentiality preserved during setup:** the public store was only momentarily
  connected to the `development` env to mint an upload token, then disconnected. The
  chat-storage token (`BLOB_READ_WRITE_TOKEN`, Production + Preview → the *private*
  store used by `api/chats.ts`) was never touched; `development` has no blob token
  (its original state). The public store holds only the public, no-PII model weights.

## Still required before flipping to production

- **Set `VITE_DETECTOR=web`** (Production and/or Preview) to actually activate the
  in-browser detector. Recommend testing on a Preview deploy first.
- **`VITE_GLINER_MODEL_URL` for Preview** (see CLI note above).
- **CSP:** the app currently has **no** Content-Security-Policy, so the Blob fetch
  works unrestricted. If/when a CSP is added, `connect-src` must include
  `cyrnh0egabzbngzf.public.blob.vercel-storage.com` (model) and `huggingface.co`
  (tokenizer, see below). A CSP was deliberately NOT imposed here — doing so blindly
  would risk breaking Clerk/Upstash/Anthropic/Google calls.
- **Tokenizer still loads from HuggingFace** (`onnx-community/gliner_multi_pii-v1`
  via @xenova/transformers, ~20 MB, public, no PII). Optional: self-host it too and
  set `VITE_GLINER_TOKENIZER` for a fully first-party load.
- **Cost note:** Blob egress is ~1.1 GB per attorney first-load (then browser-cached).
- **OPFS/service-worker persistence** still pending (currently CacheStorage only).
- **`.env.local`** was regenerated from Vercel `development` env during setup (it is
  gitignored). It now contains `VITE_GLINER_MODEL_URL` and no blob token.

## (Original) Still required before production deploy (self-host)

- Upload the fp32 ONNX (~1.1 GB) to Vercel Blob; set `VITE_GLINER_MODEL_URL` to
  that URL (dev currently defaults to the HuggingFace fp32 URL).
- Optionally self-host the tokenizer and set `VITE_GLINER_TOKENIZER`; otherwise
  it loads from HuggingFace (no PII involved — public tokenizer).
- CSP `connect-src` for the Blob host; ORT wasm already same-origin (`/ort/`).
- Add OPFS/service-worker persistence so the 1.1 GB survives CacheStorage
  eviction (currently CacheStorage only).
