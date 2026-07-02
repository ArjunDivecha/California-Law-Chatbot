/**
 * =============================================================================
 * FILE: glinerWebClient.ts  (services/sanitization — PRODUCTION)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   In-browser replacement for the local Python GLiNER daemon. Runs
 *   `urchade/gliner_multi_pii-v1` (fp32 ONNX) entirely in the page via
 *   GLiNER.js + ONNX Runtime Web (WebGPU, falling back to WASM), applies the
 *   verbatim production post-processing (glinerPostProcess.ts), and maps the
 *   result to our Span taxonomy EXACTLY as the daemon→opfClient chain does,
 *   so it is a behavioural drop-in for `opfClient.detectSpans()`.
 *
 *   It exposes the same three functions opfClient does — detectSpans /
 *   getHealth / warmup — so opfClient can route to it behind the
 *   VITE_DETECTOR flag with no change to detectionPipeline or useSanitizer.
 *
 *   FAIL-CLOSED preserved: if the model fails to download/initialize, the
 *   engine promise rejects and detectSpans throws — exactly like a daemon
 *   being unreachable. No silent degradation.
 *
 *   NODE-SAFE: nothing browser- or ONNX-specific is imported at module top
 *   level (only types + the pure post-processor). `gliner` is dynamically
 *   imported inside load(), and all browser globals (caches, fetch, window,
 *   performance) are used only inside functions. So importing this module
 *   (transitively, via opfClient) under Node — e.g. the trap runner — does
 *   not pull ONNX into Node.
 *
 * INPUT FILES (network / browser storage, not local disk):
 *   - ONNX weights: VITE_GLINER_MODEL_URL (prod: self-hosted Vercel Blob;
 *     dev default: HuggingFace fp32). Cached in CacheStorage "gliner-onnx-v1".
 *   - ORT wasm: served from /ort/ (vendored in public/ort/).
 *   - Tokenizer: fetched by GLiNER.js/transformers.js from
 *     VITE_GLINER_TOKENIZER (default HF repo). Cached by the browser.
 * OUTPUT FILES: none on disk.
 * =============================================================================
 */

import type { Span, SpanCategory } from '../../api/_shared/sanitization/index.js';
import {
  postProcess,
  GLINER_LABELS,
  DETECT_THRESHOLD,
  type RawGlinerSpan,
  type CategorizedSpan,
} from './glinerPostProcess.js';

// --- config (Node-safe env read: import.meta.env is undefined under Node) ---
const ENV: Record<string, string | undefined> =
  ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};

const MODEL_URL =
  ENV.VITE_GLINER_MODEL_URL ||
  'https://huggingface.co/onnx-community/gliner_multi_pii-v1/resolve/main/onnx/model.onnx'; // fp32
const TOKENIZER_PATH = ENV.VITE_GLINER_TOKENIZER || 'onnx-community/gliner_multi_pii-v1';
const PROVIDER_PREF = (ENV.VITE_GLINER_PROVIDER || 'webgpu') as 'webgpu' | 'wasm';
const WASM_PATHS = ENV.VITE_GLINER_WASM_PATHS || '/ort/';
const CACHE_NAME = 'gliner-onnx-v1';
const MAX_WIDTH = 12;          // gliner_config.json max_width
const MODEL_TYPE = 'span-level'; // GLiNER.js model class (span model → "span-level")
const VERSION = 'web-gliner-fp32-0.1.0';

// ---------------------------------------------------------------------------
// Category mapping — IDENTICAL to the daemon→opfClient chain
// ---------------------------------------------------------------------------
// GLiNER (unlike the legacy OPF model the daemon wrapped) natively
// distinguishes ssn / credit_card / driver_license, so we keep those
// SPECIFIC SpanCategory values rather than collapsing them to
// bank_account the way the daemon→opfClient chain did (account_number →
// bank_account). Keeping them specific (a) matches the trap manifest's
// per-category coverage checks and (b) avoids a collapsed bank_account
// span suppressing a regex driver_license/ssn span during mergeSpans in
// detectPii. All targets here are valid HIGH_RISK SpanCategory values, so
// the fail-closed wire posture is unchanged.
//
// date / zip / medical_record from GLiNER are DROPPED: regex specializes
// dates and zips precisely downstream in detectPii (and the validated
// 2026-06-30 prototype passed 120/120 with GLiNER contributing only the
// categories below + regex for the rest). This matches the daemon path,
// where opfClient.opfLabelToCategory also dropped these.
function catToCategory(cat: string): SpanCategory | null {
  switch (cat) {
    case 'name': return 'name';
    case 'street_address': return 'street_address';
    case 'phone': return 'phone';
    case 'email': return 'email';
    case 'ssn': return 'ssn';
    case 'credit_card': return 'credit_card';
    case 'driver_license': return 'driver_license';
    case 'date':
    case 'zip':
    case 'medical_record': return null;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Engine lifecycle (lazy, single load, fail-closed)
// ---------------------------------------------------------------------------
interface EngineHandle {
  inference(args: {
    texts: string[];
    entities: string[];
    flatNer?: boolean;
    threshold?: number;
    multiLabel?: boolean;
  }): Promise<RawGlinerSpan[][]>;
}

let enginePromise: Promise<EngineHandle> | null = null;
let loaded = false;
let activeProvider: 'webgpu' | 'wasm' | null = null;
let lastRequestAt: number | null = null;
const startedAt = nowMs();

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// ---------------------------------------------------------------------------
// Load progress — surfaced to the UI so a multi-hundred-MB first download
// shows "downloading 42%…" instead of a silent hang.
// ---------------------------------------------------------------------------
export type LoadPhase = 'idle' | 'downloading' | 'initializing' | 'ready' | 'error';
export interface LoadProgress {
  phase: LoadPhase;
  receivedBytes: number;
  totalBytes: number | null; // null if the server didn't send content-length
  fromCache: boolean;        // true when served from CacheStorage (no download)
  percent: number | null;    // 0-100, null when total unknown
}
let loadProgress: LoadProgress = {
  phase: 'idle', receivedBytes: 0, totalBytes: null, fromCache: false, percent: null,
};
function setProgress(p: Partial<LoadProgress>): void {
  loadProgress = { ...loadProgress, ...p };
  if (loadProgress.totalBytes && loadProgress.totalBytes > 0) {
    loadProgress.percent = Math.min(100, Math.round((loadProgress.receivedBytes / loadProgress.totalBytes) * 100));
  }
}
/** Current model-load progress (for the sanitizer status UI). */
export function getLoadProgress(): LoadProgress {
  return { ...loadProgress };
}

/**
 * Ask the browser to mark this origin's storage "persistent" so the cached
 * ~1.1 GB model is NOT evicted under disk pressure — making it a true
 * one-time download. On Chrome this is granted for engaged/installed origins.
 * Best-effort: failures are ignored (worst case the model re-downloads).
 */
async function requestPersistentStorage(): Promise<void> {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (s?.persist && s?.persisted) {
      const already = await s.persisted();
      if (!already) {
        const granted = await s.persist();
        console.info(`[glinerWebClient] persistent storage ${granted ? 'granted' : 'not granted'}`);
      }
    }
  } catch { /* ignore */ }
}

// Known on-disk sizes per ONNX variant (bytes). Used only as a fallback for
// the progress meter when the CORS response hides Content-Length. Approximate
// is fine — the meter just needs a denominator.
function expectedTotalBytes(url: string): number | null {
  if (/fp16/i.test(url)) return 579_717_643;
  if (/q4f16/i.test(url)) return 471_000_000;
  if (/int8|uint8|quantized/i.test(url)) return 349_000_000;
  if (/fp32|model_fp32|\/model\.onnx/i.test(url)) return 1_157_129_714;
  return null;
}

async function fetchModelBytes(): Promise<Uint8Array> {
  // Persist across reloads so a large fp32/fp16 download happens at most once.
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME) : null;
  if (cache) {
    const hit = await cache.match(MODEL_URL);
    if (hit) {
      const buf = await hit.arrayBuffer();
      setProgress({ phase: 'downloading', fromCache: true, receivedBytes: buf.byteLength, totalBytes: buf.byteLength, percent: 100 });
      return new Uint8Array(buf);
    }
  }
  // About to download the large model — request durable storage first so the
  // CacheStorage entry we're about to write survives eviction.
  await requestPersistentStorage();

  const resp = await fetch(MODEL_URL, { mode: 'cors', cache: 'no-store' });
  if (!resp.ok) throw new Error(`GLiNER model download failed: HTTP ${resp.status} for ${MODEL_URL}`);

  // Vercel Blob's CORS response does NOT expose Content-Length to fetch()
  // (no Access-Control-Expose-Headers), so resp.headers.get('content-length')
  // is null in the browser even though the file has a known size. Fall back
  // to the known size for this model variant so the % meter works.
  const headerLen = Number(resp.headers.get('content-length')) || 0;
  const totalBytes = headerLen > 0 ? headerLen : expectedTotalBytes(MODEL_URL);
  setProgress({ phase: 'downloading', fromCache: false, receivedBytes: 0, totalBytes, percent: totalBytes ? 0 : null });

  // Stream so we can report progress AND avoid a single giant arrayBuffer()
  // allocation up front. Fall back to arrayBuffer() if the body isn't a
  // readable stream (older engines).
  let bytes: Uint8Array;
  if (resp.body && typeof resp.body.getReader === 'function') {
    const reader = resp.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      setProgress({ receivedBytes: received });
    }
    bytes = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  } else {
    const buf = await resp.arrayBuffer();
    bytes = new Uint8Array(buf);
    setProgress({ receivedBytes: bytes.byteLength, totalBytes: bytes.byteLength, percent: 100 });
  }

  if (cache) {
    try {
      await cache.put(MODEL_URL, new Response(bytes.buffer as ArrayBuffer, {
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.byteLength) },
      }));
    } catch (err) {
      // Safari's CacheStorage quota can reject a >~1GB blob — non-fatal, but
      // it means the model re-downloads next visit. Surface it for debugging.
      console.warn('[glinerWebClient] CacheStorage persist failed (non-fatal; model will re-download next load):', err);
    }
  }
  return bytes;
}

/** Reject if `p` doesn't settle within `ms` — so a hung engine init can't wedge the app forever. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function newEngine(provider: 'webgpu' | 'wasm', modelBytes: Uint8Array): Promise<EngineHandle> {
  const { Gliner } = await import('gliner');
  const gliner = new Gliner({
    tokenizerPath: TOKENIZER_PATH,
    onnxSettings: {
      modelPath: modelBytes,
      executionProvider: provider,
      wasmPaths: WASM_PATHS,
      multiThread: false,
    },
    transformersSettings: { allowLocalModels: false, useBrowserCache: true },
    maxWidth: MAX_WIDTH,
    modelType: MODEL_TYPE,
  });
  await gliner.initialize();
  return gliner as unknown as EngineHandle;
}

async function load(): Promise<EngineHandle> {
  try {
    const modelBytes = await fetchModelBytes();
    // Compiling/instantiating the ONNX graph is itself multi-second on a
    // large model — mark it distinctly so the UI shows "initializing" after
    // the download bar hits 100%.
    setProgress({ phase: 'initializing' });
    // Try the preferred provider; on init failure, fall back to wasm. This is
    // a performance/availability fallback ONLY — fp32 passes the trap gate
    // identically on both providers (see playground/browser-gliner/RESULTS.md),
    // so it is NOT a quality degradation.
    // Init is timed out so a hung WebGPU driver can't wedge the app forever —
    // it falls back to WASM instead. WebGPU init is normally a few seconds;
    // 30s only trips on a genuine hang. WASM gets a longer budget (fp32 graph).
    let eng: EngineHandle;
    try {
      eng = await withTimeout(newEngine(PROVIDER_PREF, modelBytes), 30_000, `${PROVIDER_PREF} init`);
      activeProvider = PROVIDER_PREF;
    } catch (err) {
      if (PROVIDER_PREF === 'wasm') throw err;
      console.warn(`[glinerWebClient] ${PROVIDER_PREF} init failed/timed out, falling back to wasm:`, err);
      setProgress({ phase: 'initializing' });
      eng = await withTimeout(newEngine('wasm', modelBytes), 120_000, 'wasm init');
      activeProvider = 'wasm';
    }
    loaded = true;
    setProgress({ phase: 'ready' });
    return eng;
  } catch (err) {
    setProgress({ phase: 'error' });
    throw err;
  }
}

function ensureEngine(): Promise<EngineHandle> {
  if (!enginePromise) {
    enginePromise = load().catch((err) => {
      // Reset so a later call can retry rather than caching a permanent failure.
      enginePromise = null;
      loaded = false;
      throw err;
    });
  }
  return enginePromise;
}

// ---------------------------------------------------------------------------
// Public surface — structurally identical to opfClient's
// ---------------------------------------------------------------------------
export interface DetectResult {
  spans: Span[];
  elapsedMs: number;
  modelLoaded: boolean;
}
export interface DaemonHealth {
  ok: boolean;
  modelLoaded: boolean;
  uptimeS: number;
  lastRequestAgeS: number | null;
  idleUnloadSeconds: number;
  version: string;
  /** Model download/init progress (web detector only). */
  loadProgress?: LoadProgress;
}
export interface DetectOptions {
  warmupOnly?: boolean;
  timeoutMs?: number;
}

/** Load the model in the background (called by SanitizerProvider on mount). */
export async function warmup(): Promise<void> {
  await detectSpans('warmup', { warmupOnly: true });
}

/**
 * Health probe. Unlike the daemon (a network call that can be unreachable),
 * the in-page engine is always "reachable"; `modelLoaded` reflects whether
 * the (possibly large) weights have finished loading in this tab.
 */
export async function getHealth(): Promise<DaemonHealth> {
  return {
    ok: true,
    modelLoaded: loaded,
    uptimeS: (nowMs() - startedAt) / 1000,
    lastRequestAgeS: lastRequestAt == null ? null : (nowMs() - lastRequestAt) / 1000,
    idleUnloadSeconds: 0, // in-page engine does not idle-unload
    version: activeProvider ? `${VERSION}/${activeProvider}` : VERSION,
    loadProgress: { ...loadProgress },
  };
}

/** Which provider actually initialized (webgpu | wasm | null-if-unloaded). */
export function getActiveProvider(): 'webgpu' | 'wasm' | null {
  return activeProvider;
}

/**
 * Detect PII spans in `text`. Throws on model load/inference failure so the
 * caller can fail-closed (identical contract to opfClient.detectSpans).
 */
export async function detectSpans(text: string, opts: DetectOptions = {}): Promise<DetectResult> {
  const engine = await ensureEngine();
  if (!text || opts.warmupOnly) {
    return { spans: [], elapsedMs: 0, modelLoaded: loaded };
  }
  const t0 = nowMs();
  const results = await engine.inference({
    texts: [text],
    entities: GLINER_LABELS,
    flatNer: true,            // matches Python predict_entities default
    threshold: DETECT_THRESHOLD,
    multiLabel: false,
  });
  const elapsedMs = nowMs() - t0;
  lastRequestAt = nowMs();

  const raw = (results?.[0] ?? []) as RawGlinerSpan[];
  const categorized: CategorizedSpan[] = postProcess(raw);
  const spans: Span[] = [];
  for (const s of categorized) {
    const category = catToCategory(s.category);
    if (!category) continue;
    spans.push({
      start: s.start,
      end: s.end,
      category,
      raw: s.text,
      label: `gliner:${s.label}`,
      // optional audit signal — see Span.score (added in index.ts)
      score: s.score,
    } as Span);
  }
  return { spans, elapsedMs, modelLoaded: loaded };
}

/** In-page engine needs no Safari bridge. No-op for interface parity. */
export async function connectBridge(): Promise<void> {
  /* intentionally empty — the model runs in this page, no loopback bridge */
}
