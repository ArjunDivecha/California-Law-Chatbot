# Browser-GLiNER prototype — results (2026-06-30)

Environment: headless Chromium (Playwright, "Chrome for Testing" 1223), M4 Max.
Pipeline: in-browser GLiNER + **verbatim** production post-processing + the real
regex/allowlist/compound-risk modules, scored exactly like
`tests/traps/runTrapsWire.mjs --gliner-only` over all 120 traps.
Target = production daemon's **120/120, 0 wire leaks**.

## Gate result (correctness)

| Variant | Provider | Pass | Wire leaks | FP | Missed | Verdict |
|--------|----------|------|-----------|----|--------|---------|
| int8 (333 MB) | wasm | **60/120** | 60 | 0 | 60 | ❌ FAIL — score collapse |
| fp16 (553 MB) | wasm | **120/120** | 0 | 0 | 0 | ✅ run 1 |
| fp16 (553 MB) | wasm | **120/120** | 0 | 0 | 0 | ✅ run 2 (consecutive) |
| fp16 (553 MB) | webgpu | **120/120** | 0 | 0 | 0 | ✅ |
| fp32 (1103 MB) | wasm | **120/120** | 0 | 0 | 0 | ✅ |
| fp32 (1103 MB) | webgpu | **120/120** | 0 | 0 | 0 | ✅ |

**int8 fails because quantization collapses GLiNER confidence scores**, and the
production threshold is 0.7 (tuned for fp32):

| name | int8 score | fp16 score | fp32 (Python, per gliner_detect.py) |
|------|-----------|-----------|--------------------------------------|
| "Maria Sotomayor" | 0.39 | 0.997 | typically >0.9 |
| "Nguyen" | 0.08 | 0.74 | >0.9 |

Offsets and detections are correct in all variants — only int8's *scores* are wrong.
Lowering the threshold for int8 would invalidate the hand-tuned 0.7 stoplist/threshold
and risk false positives, so **int8 is rejected. fp16 is the variant.**

fp16 satisfies the plan §0.c gate: **two consecutive zero-leak runs.**

## Latency (per-trap inference)

| Variant | Provider | median | p95 | max | full 120-run |
|--------|----------|--------|-----|-----|--------------|
| int8 | wasm (1 thread) | 339 ms | 467 | 515 | 42 s |
| fp16 | wasm (1 thread) | ~700 ms | ~840 | ~1180 | ~86 s |
| fp16 | webgpu | 52 ms | 86 | 940 | ~5 s |
| fp32 | wasm (1 thread) | 328 ms | 479 | 601 | 23 s |
| fp32 | **webgpu** | **22 ms** | 30 | 869 | 3.7 s |

WebGPU is ~13× faster than single-thread WASM. Max-latency spikes are first-call/
warmup; median is the right metric.

**fp32 is the FASTEST variant on both backends** (not just most accurate). Reason:
fp32 is the model's native precision — every ONNX op has a native fp32 kernel.
fp16 on WASM/CPU has no native kernels for several ops (the "Could not find a CPU
kernel … ReduceMean" warnings) → ORT inserts cast-to-fp32 nodes and runs fp32 math
anyway, plus casting overhead, so fp16/wasm (~700 ms) is SLOWER than fp32/wasm
(328 ms). On WebGPU fp16 needs the `shader-f16` feature and pays emulation overhead.
The only cost of fp32 is the 1.1 GB download (once, then CacheStorage → 1.5 s load)
and ~1.1 GB tab memory.

**Safari note:** fp32/WASM is native and provider-independent, so it sidesteps
Safari's weaker WebGPU / shader-f16 support entirely — the most robust Safari path
(~330 ms/trap, no WebGPU dependency).

## Open / next

- **Safari is the remaining unknown.** These numbers are Chromium. Open
  `http://localhost:5199` in Safari, run fp16 on webgpu and on wasm, and record the
  numbers. Safari's WebGPU is the weakest of the majors — this is the real go/no-go
  for latency.
- fp16 = ~553 MB first-load (vs int8 333 MB). Cached in CacheStorage after first load
  (proven here: 1.0 s "load" on cache hit). Production must persist via OPFS/Cache +
  service worker (HTTP cache can evict a blob this size).
- WASM here was single-threaded (no COOP/COEP). Multi-thread could cut the ~700 ms
  floor, at the cost of cross-origin-isolation complexity.
- The cheap independent win still stands: surface GLiNER's per-span score (fp16 gives
  clean ~0.99 scores) to unblock the §E `confidence < 0.98` gate.
