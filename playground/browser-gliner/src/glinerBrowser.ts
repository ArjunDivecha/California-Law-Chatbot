/**
 * =============================================================================
 * FILE: glinerBrowser.ts  (browser-gliner prototype)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   Thin wrapper around GLiNER.js (npm `gliner`) that runs the
 *   urchade/gliner_multi_pii-v1 model entirely in the browser via ONNX
 *   Runtime Web (WASM floor, WebGPU when selected). It:
 *     1. loads the chosen ONNX weight variant (int8 / fp16) from cache,
 *     2. initializes GLiNER.js with the production label set,
 *     3. exposes detect(text) which runs inference at the production 0.7
 *        threshold and applies the verbatim production post-processing
 *        (postProcess.ts), returning categorized spans + the wall-clock
 *        inference time.
 *
 *   This is the IN-BROWSER replacement candidate for the local Python
 *   daemon (tools/gliner-daemon/gliner_daemon.py). Same model, same labels,
 *   same threshold, same post-processing — only the engine differs.
 *
 * INPUT FILES:  ONNX weights via modelCache.ts (HuggingFace, cached).
 *               Tokenizer fetched by GLiNER.js/transformers.js from
 *               HuggingFace repo onnx-community/gliner_multi_pii-v1.
 * OUTPUT FILES: none.
 * =============================================================================
 */

import { Gliner, type ExecutionProvider } from 'gliner';
import { getModelBytes, type ModelVariant, type ProgressInfo } from './modelCache';
import {
  GLINER_LABELS,
  DETECT_THRESHOLD,
  postProcess,
  type RawGlinerSpan,
  type CategorizedSpan,
} from './postProcess';

// gliner_config.json (read 2026-06-30): max_width 12, span_mode markerV0,
// max_len 384. NOTE: GLiNER.js's `modelType` is its OWN vocabulary
// ("span-level" | "token-level"), NOT the HF model_type field. This is a
// span model → "span-level" (else GLiNER.js builds TokenModel feeds and
// inference throws "input 'span_idx' is missing in 'feeds'").
const MAX_WIDTH = 12;
const MODEL_TYPE = 'span-level';

// ORT wasm binaries MUST match the onnxruntime-web version GLiNER.js
// bundles internally — gliner@0.0.19 pins onnxruntime-web@1.19.2 (NOT the
// hoisted version). A mismatch throws a WASM LinkError at init. Pinned CDN
// for the prototype; production would vendor these locally (CSP).
const ORT_WASM_PATHS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';

export interface DetectOutput {
  spans: CategorizedSpan[];
  inferenceMs: number;
}

export class BrowserGliner {
  private gliner: Gliner | null = null;
  private _provider: ExecutionProvider | null = null;
  private _variant: ModelVariant | null = null;

  get ready(): boolean {
    return this.gliner !== null;
  }
  get provider(): ExecutionProvider | null {
    return this._provider;
  }
  get variant(): ModelVariant | null {
    return this._variant;
  }

  async load(
    variant: ModelVariant,
    provider: ExecutionProvider,
    onProgress: (p: ProgressInfo) => void,
  ): Promise<void> {
    const modelBytes = await getModelBytes(variant, onProgress);

    const gliner = new Gliner({
      tokenizerPath: 'onnx-community/gliner_multi_pii-v1',
      onnxSettings: {
        modelPath: modelBytes,
        executionProvider: provider,
        wasmPaths: ORT_WASM_PATHS,
        // Single-thread: avoids requiring cross-origin isolation
        // (COOP/COEP), which would block the HF cross-origin model/
        // tokenizer fetches. This is the conservative WASM latency floor.
        multiThread: false,
      },
      transformersSettings: {
        allowLocalModels: false,
        useBrowserCache: true,
      },
      maxWidth: MAX_WIDTH,
      modelType: MODEL_TYPE,
    });

    await gliner.initialize();
    this.gliner = gliner;
    this._provider = provider;
    this._variant = variant;
  }

  /** DEBUG: return the raw GLiNER.js inference output (pre-post-process). */
  async detectRaw(text: string, threshold = DETECT_THRESHOLD, entities: string[] = GLINER_LABELS): Promise<unknown> {
    if (!this.gliner) throw new Error('BrowserGliner not loaded');
    return this.gliner.inference({
      texts: [text],
      entities,
      flatNer: true,
      threshold,
      multiLabel: false,
    });
  }

  /** Run inference on one text and return categorized spans + timing. */
  async detect(text: string): Promise<DetectOutput> {
    if (!this.gliner) throw new Error('BrowserGliner not loaded');
    if (!text) return { spans: [], inferenceMs: 0 };

    const t0 = performance.now();
    const results = await this.gliner.inference({
      texts: [text],
      entities: GLINER_LABELS,
      // flatNer:true matches Python GLiNER predict_entities default
      // (greedy, non-overlapping spans).
      flatNer: true,
      threshold: DETECT_THRESHOLD,
      multiLabel: false,
    });
    const inferenceMs = performance.now() - t0;

    const raw = (results?.[0] ?? []) as RawGlinerSpan[];
    return { spans: postProcess(raw), inferenceMs };
  }
}
