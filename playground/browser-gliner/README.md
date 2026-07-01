# Browser-GLiNER Prototype (isolated, reversible)

**Purpose.** Answer the two questions that gate retiring the local Python GLiNER
daemon in favour of running the model in the browser:

1. **Correctness** — does the quantized in-browser model (`int8`, fallback `fp16`)
   hold the production trap gate? Target = **120/120 pass, 0 wire leaks**, matching
   the production daemon (`reports/traps-wire-gliner-final-v8-run{1,2}.json`).
2. **Performance** — is inference latency acceptable in a real browser, **especially
   Safari**, on the WASM floor and on WebGPU?

It runs `urchade/gliner_multi_pii-v1` via **GLiNER.js + ONNX Runtime Web**, applies
the **verbatim** production post-processing (`postProcess.ts` ← `scripts/gliner_detect.py`)
and the **real** production scoring modules (regex / allowlist / compound-risk,
imported read-only), then scores all 120 traps exactly like
`tests/traps/runTrapsWire.mjs --gliner-only`.

## This is fully isolated and reversible

- It lives entirely under `playground/browser-gliner/` with its **own** `package.json`
  and `node_modules`. It **modifies no production file** — it only *reads*
  `tests/traps/manifest-v1.json` and three pure leaf modules under
  `api/_shared/sanitization/`.
- The live detection path (the Python daemon + `opfClient.ts` + `detectionPipeline.ts`)
  is **untouched**. It remains the production detector the whole time.
- **Two ways to revert completely:**
  - `git checkout V2` (this work is on branch `claude/browser-gliner-prototype`), or
  - `rm -rf playground/browser-gliner` on this branch.

## Run it

```bash
cd "playground/browser-gliner"
npm run dev          # serves on http://localhost:5199
```

Then in the browser: pick a **Variant** (start with int8) and **Provider**
(webgpu or wasm) → **Load model** (first load downloads ~349 MB once, then it is
cached in CacheStorage) → **Run 120 traps**. Download the JSON report for the record.

To test Safari specifically, open `http://localhost:5199` in Safari and run there.

## Notes / known limits

- The **tool-result phase** (11/120 traps) is evaluated server-side by `analyze()`
  (regex + name heuristics) in production. That path never touches GLiNER, so it is
  out of scope here; this harness scores the **input phase**, which is where the
  GLiNER engine matters.
- ORT WASM is run **single-threaded** (no COOP/COEP cross-origin isolation), so the
  WASM number is a conservative floor. Multi-threaded WASM could be faster but needs
  cross-origin isolation, which complicates the cross-origin HF model/tokenizer fetch.
- ORT wasm binaries are pulled from a pinned jsDelivr CDN for the prototype.
  Production would vendor them locally (CSP).
- If `postProcess.ts` / `HIGH_RISK_CATEGORIES` drift from
  `scripts/gliner_detect.py` / `api/_shared/sanitization/index.ts`, re-sync.
