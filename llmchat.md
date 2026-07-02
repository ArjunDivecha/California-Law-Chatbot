# llmchat.md — Project Context Log

This file is the shared memory between Claude.ai and Claude Code.
It is append-only. Do not edit existing entries.
Each session appends a timestamped block at the bottom.

---

---
SESSION START: 2026-06-29 16:45 PST | Agent: Claude.ai
---

### Session Summary
Evaluated whether two external/alternate PII models could improve the V2 sanitization layer, now that V3 is dead. Net: reject Rampart; the real move is to run the EXISTING GLiNER model in-browser to delete the local daemon. Corrected a stale assumption (the live ML detector is GLiNER, not "OPF").

### Decisions Made
- **V3 is abandoned**: Anthropic will not provide ZDR, so the ZDR-constrained Anthropic-only V3 stack is dead. V2 is the active line. V2 was always built for the no-ZDR Team-plan reality — on-device sanitization is the ONLY confidentiality mechanism, so detector recall must not regress.
- **Reject Rampart** (`nationaldesignstudio/rampart`) for V2. It's a 14.7MB in-browser ONNX MiniLM PII tagger (CC BY 4.0, bundled Luhn/checksum layer, placeholder/rehydrate). Disqualifiers vs current GLiNER: (a) Latin-only, ~13.7% non-Latin recall (Han 8.8%, Korean 15.2%, Arabic 4.8%) — catastrophic for CA; our model is multilingual. (b) Fixed 17-type taxonomy vs GLiNER zero-shot custom labels. (c) No legal-domain stoplist — would discard the v1→v8 trap tuning. (d) Drops dates by design (we deliberately detect DOB). (e) Its "white-box confidence" is no edge over GLiNER, which already produces scores. Rampart's ONLY real advantage is in-browser delivery — obtainable without its weaker model.
- **Target architecture**: port the existing `urchade/gliner_multi_pii-v1` to in-browser ONNX (via GLiNER.js + ONNX Runtime Web), vendored, to retire the local daemon while keeping multilingual + zero-shot + the hand-tuned stoplist.
- **Cheap independent win**: surface GLiNER's per-span score in the daemon `/v1/detect` response now — it's currently dropped — to unblock the §E `confidence < 0.98` gate. The old audit said confidence was unobtainable; that was true for OPF, not GLiNER.

### Architecture / Design (V2 sanitizer — ground truth, read from source this session)
Three detector layers, all client-side/loopback (data never leaves device for detection):
1. Deterministic regex — `api/_shared/sanitization/patterns.ts` (12+ categories incl. DOLLAR_AMOUNT, DATE_ISO, DATE_VERBOSE, CA_BAR_NUMBER added in commit a720572).
2. Name heuristics — `api/_shared/sanitization/detectNames.ts` (6 signals; fallback when daemon down).
3. ML layer = **GLiNER**, model `urchade/gliner_multi_pii-v1`, run by LOCAL loopback daemon `tools/gliner-daemon/gliner_daemon.py` (author: Arjun, last touched 2026-06-17). Packaged as macOS `.pkg` under `installer-pkg/` (binary `fflp-gliner-daemon` ~172MB; launchd `com.fflp.gliner-daemon.plist`). Built as a drop-in for the prior "OPF" daemon so `services/sanitization/opfClient.ts` + `detectionPipeline.ts` hit the same `/v1/detect` contract unchanged.

Daemon specifics: zero-shot labels (person/full name/address/phone/email/date/DOB/ssn/credit card/driver license/medical/zip) → V2 SpanCategory → OPF-compat labels (private_person, etc.); threshold 0.7; large hand-tuned STOPLIST (legal roles, CA cities/counties/neighborhoods, govt bodies, ethnic adjectives, legislative subject terms); prefix-trim ("Mr. Smith"→"Smith"); loopback-only; cold start ~7s; idle-unload 10min; serves `/bridge` HTML for Safari/HTTPS via postMessage. **The daemon drops GLiNER's per-span score from `out_spans` — surfacing it is ~1 line.**

Token store: client-side IndexedDB, AES-256-GCM, PBKDF2 per-attorney passphrase. Server backstop `guard.ts` = regex only (no names, no ML). Compound-identifier risk (W1, the $4.3M+Marin+tech-founder problem) handled by `api/_shared/sanitization/compoundRisk.ts` (8-bucket dictionary, threshold ≥3). The detection seam is detector-agnostic, so swapping the detector is low-cost.
NOTE: `docs/sanitization-audit-2026-05-10.md` (W1–W13 weaknesses) predates the GLiNER swap and calls the ML detector "OPF" — STALE on that point; everything else still useful.

### In-browser GLiNER route — findings
- ONNX weights for the exact model already exist: `onnx-community/gliner_multi_pii-v1`.
- transformers.js `pipeline()` does NOT support GLiNER (span decoding isn't a standard task). Working path = **GLiNER.js** (npm `gliner`, Ingvarstep/GLiNER.js) over ONNX Runtime Web (WASM floor, WebGPU when available). Returns spans + scores; takes the same zero-shot label list.
- GLiNER.js health: lightly maintained (last release ~1yr ago, 1 maintainer, ~3.8k weekly downloads) → **vendor it**, don't depend live. Alt engine: `gline_rs` (Rust→WASM).
- ONNX quant sizes (onnx-community repo): fp32 1.16GB | fp16 580MB | q4 894MB (NOT smaller than int8!) | q4f16 472MB | int8/uint8/quantized 349MB. + tokenizer.json 16.3MB + spm.model 4.31MB → smallest viable ≈ **~370MB cold load** (vs Rampart 14.7MB, ~25×). NOT disqualifying: we already ship a 172MB daemon, so ~370MB browser-cached-once is the same order, delivered cleaner (no .pkg/launchd/cold-start/Safari bridge). In-browser WASM also eliminates the Safari `/bridge` popup.

### What to Build Next
1. Surface GLiNER per-span confidence in `gliner_daemon.py` `/v1/detect` (`out_spans` currently drops `r` score); wire into `AnalyzeResult.confidence` + the §E `confidence < 0.98` gate. Cheap, do regardless of the in-browser migration.
2. Prototype in-browser GLiNER: vendored GLiNER.js + `onnx-community/gliner_multi_pii-v1` (int8 349MB first; fp16 580MB fallback) on ONNX Runtime Web. Persist model to OPFS / Cache API via service worker (browser HTTP cache can evict a 370MB blob).
3. Port the daemon's `GLINER_LABELS`, `STOPLIST`, `PREFIX_TRIM`, `LABEL_MAP` into the JS path verbatim (pure config/post-processing).
4. Re-run the v1→v8 trap suite against the in-browser build — 2 consecutive zero-leak runs required before wiring to the wire path. int8 is where quantization may shift scores; fall back to fp16 if the gate fails.
5. Once green, retire `fflp-gliner-daemon`, the `.pkg` installer, the launchd plist, and the `/bridge` popup.

### Constraints & Gotchas
- No ZDR — on-device sanitization is the only confidentiality layer; do not regress recall.
- Don't swap to a Latin-only model (Rampart) — CA non-Latin names.
- transformers.js pipeline won't run GLiNER; use GLiNER.js or gline_rs.
- q4 ONNX is NOT smaller than int8 for this mDeBERTa backbone.
- GLiNER.js lightly maintained → vendor it.
- `sanitization-audit-2026-05-10.md` labels the ML detector "OPF" — it's GLiNER now.
- Dropbox MCP: `.ts` files mis-typed as video/mp2t; read via get_file_content or download_link+curl; ns:1252269/ prefix for scoped search.

### Open Questions
- Is ~370MB first-load acceptable to F&F attorneys, or is fp16 (580MB) worth it for accuracy? (Both ≈ the existing 172MB daemon footprint.)
- WebGPU availability across attorneys' browsers (esp. Safari) — is WASM-floor latency acceptable?
- Does int8 hold the zero-leak gate, or must we ship fp16?

### Context for Claude Code
Canonical source = the V2 Dropbox worktree (`ns:1252269//AAA Backup/A Working/California-Law-Chatbot-V2`), not memory/notes. Key files: `tools/gliner-daemon/gliner_daemon.py`; `services/sanitization/{detectionPipeline,opfClient,realSanitizer}.ts`; `api/_shared/sanitization/*` (patterns, detectNames, compoundRisk, guard, tokenize, store, crypto); `docs/sanitization-audit-2026-05-10.md` (stale on "OPF"=GLiNER).

---
SESSION END: 2026-06-29 16:45 PST | Agent: Claude.ai
---

---
SESSION START: 2026-06-30 18:30 PDT | Agent: Claude Code
---

### Session Summary
Implemented AND shipped the 2026-06-29 plan: in-browser GLiNER now runs the V2
sanitization detection, replacing the local Python daemon. fp32 ONNX runs in the
browser (GLiNER.js + ONNX Runtime Web), self-hosted on Vercel Blob, behind a
`VITE_DETECTOR` flag. Proven 120/120, 0 wire leaks through the REAL `detectPii`;
deployed + tested on Preview; **Production flipped to the web detector** (daemon no
longer required in V2 prod). All work on branch `claude/browser-gliner-prototype`.

### Decisions Made
- **Variant = fp32.** int8 REJECTED (quantization collapses GLiNER scores — "Nguyen"
  0.08, "Maria Sotomayor" 0.39 vs fp32 ~0.99; fails the 0.7 threshold → 60/120). fp16
  REJECTED (118/120 — 2 zip category-coverage misses, 0 leaks; also SLOWER on webgpu,
  57ms vs fp32 22ms, because fp16 is emulated). fp32 = 120/120 and fastest. fp16 blob
  left on Blob as a fallback only.
- **Provider = webgpu with wasm fallback** (both pass the gate identically; webgpu
  ~22ms/trap, wasm ~330ms — perf-only fallback, not a quality one).
- **Persistence = CacheStorage + `navigator.storage.persist()`, NOT OPFS.** OPFS/SW was
  aimed at Safari's cache eviction; audience is Chrome, so it's unnecessary. persist()
  makes the 1.1GB a true one-time download on Chrome (verified: 2nd load = no fetch).
- **Self-host on Vercel Blob** (not HuggingFace) for the model; ORT wasm vendored.

### Architecture / Design (what changed, all behind the flag)
- NEW `services/sanitization/glinerWebClient.ts` — in-browser engine; exposes
  detectSpans/getHealth/warmup with opfClient-identical shapes; Node-safe top level
  (dynamic `import('gliner')`, guarded `import.meta.env`); streaming download +
  `getLoadProgress()`; catToCategory keeps ssn/credit_card/driver_license SPECIFIC
  (GLiNER distinguishes them, unlike the daemon's account_number collapse).
- NEW `services/sanitization/glinerPostProcess.ts` — verbatim port of gliner_daemon.py
  LABEL_MAP/STOPLIST/PREFIX_TRIM/0.7 threshold (+ visa codes EB-1..5/H-1B/etc. added to
  stoplist; GLiNER mis-tagged "EB-3" as driver_license).
- `opfClient.ts` — detectSpans/getHealth/warmup/connectBridge delegate to the web
  engine when `VITE_DETECTOR==='web'` (default 'daemon'). detectionPipeline.ts and
  useSanitizer.tsx UNCHANGED.
- `detectionPipeline.ts` — added ONE post-merge bare-place filter (drops spans whose
  whole text is a stoplisted place/role or "<X> County/City"); fixes pre-existing
  opf-internal-bigram FPs on "San Jose"/"Fresno County"/"Long Beach". Benefits daemon
  path too (shared).
- `api/_shared/sanitization/index.ts` — `Span.score?` added (web detector populates).
- `public/ort/` — vendored ORT 1.19.2 wasm (MUST match gliner@0.0.19's bundled
  onnxruntime-web version; served at `/ort/` = wasmPaths). `gliner` added to deps.
- Prototype (isolated, deletable): `playground/browser-gliner/`. Dev verification
  harness (runs REAL detectPii over 120 traps in-browser): root `traps-verify.{html,ts}`.

### Deploy / Vercel state
- Model: `https://cyrnh0egabzbngzf.public.blob.vercel-storage.com/gliner/model_fp32-vrAnlNVLkxhgSpHM1yfWeQi1KbPen7.onnx`
  (public Blob store `clc-v2-model-public` / `store_CyRNH0EgaBzbNgZF`; CORS *, 1yr cache).
  fp16 also uploaded: `…/model_fp16-t0tTeXu8hwxHbnOodI2iLhKZWRRSMq.onnx` (unused).
- Env (project california-law-chatbot-v2): VITE_DETECTOR=web (Preview+Production),
  VITE_GLINER_MODEL_URL=fp32 blob (all envs), CLERK_SECRET_KEY (now Preview+Prod).
- **Production target = `california-law-chatbot-v2-m4nu8o12g.vercel.app`** (web detector).
  ROLLBACK: `vercel rollback california-law-chatbot-v2-l6notb8ou.vercel.app` → daemon build.

### Constraints & Gotchas
- CLERK_SECRET_KEY was MISSING on Preview → `/api/chats` 500 → app stuck on "Loading…"
  (NOT a model bug). Preview uses the TEST Clerk instance `emerging-treefrog-49`
  (pk_test_/sk_test_); Production uses live keys. sk_test_ is in `.env.txt` (tagged
  "califrnia law chatbot").
- GLiNER.js `modelType` MUST be `"span-level"` (its own vocab, not the HF model_type),
  else inference throws "input 'span_idx' is missing".
- ORT wasm version in public/ort/ must equal gliner's nested onnxruntime-web (1.19.2)
  or WASM LinkError at init.
- Vercel CLI v54.12.0 loops on `env add … preview`; use the REST API (v10 /env upsert).
- Preview/prod .vercel.app URLs are Vercel-SSO-protected; test via the project's
  protection-bypass header/cookie + `@clerk/testing` sign-in (test user
  v2-playwright-e2e+clerk_test@v2.example.com).

### What To Build Next / Open
1. Live-Clerk-instance prod sign-in click-through NOT tested by agent (no live creds);
   identical code fully passed on Preview + harness 120/120. Human should click through
   the prod URL once.
2. Tokenizer still loads from HuggingFace (~20MB, public, no PII) — optional self-host
   via VITE_GLINER_TOKENIZER for a fully first-party load.
3. No visible download-progress BANNER (data exposed via getLoadProgress()/DaemonHealth
   .loadProgress; model loads in background; daemonStatus is a readiness gate only).
4. Consider retiring the daemon installer (tools/gliner-daemon, installer-pkg) once the
   browser path is confirmed in real use.

### Context for Next Session
Everything is on branch `claude/browser-gliner-prototype` (committed + pushed). The
daemon path still exists and is the instant fallback (`VITE_DETECTOR=daemon` or
`vercel rollback`). Full writeup: `docs/browser-gliner-integration-2026-06-30.md`.

---
SESSION END: 2026-06-30 18:30 PDT | Agent: Claude Code
---
