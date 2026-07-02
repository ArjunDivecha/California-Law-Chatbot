/**
 * =============================================================================
 * FILE: modelCache.ts  (browser-gliner prototype)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   Downloads a GLiNER ONNX weight file from HuggingFace ONCE, shows a
 *   progress bar while it streams, and stores it in the browser's Cache
 *   Storage so a page reload does NOT re-download ~349-580 MB. Returns the
 *   weights as a Uint8Array to hand directly to GLiNER.js (onnxSettings.
 *   modelPath accepts a Uint8Array).
 *
 *   This directly prototypes the production caching strategy the llmchat
 *   flagged as MANDATORY (the browser HTTP cache can evict a blob this
 *   large; Cache Storage / OPFS persists it). Here we use the Cache API.
 *
 * INPUT FILES (network, not local disk):
 *   https://huggingface.co/onnx-community/gliner_multi_pii-v1/resolve/main/onnx/model_int8.onnx
 *   https://huggingface.co/onnx-community/gliner_multi_pii-v1/resolve/main/onnx/model_fp16.onnx
 * OUTPUT FILES: none on disk. Persists into browser CacheStorage ("gliner-onnx-v1").
 * =============================================================================
 */

const HF_BASE =
  'https://huggingface.co/onnx-community/gliner_multi_pii-v1/resolve/main/onnx';
const CACHE_NAME = 'gliner-onnx-v1';

export type ModelVariant = 'int8' | 'fp16' | 'q4f16' | 'fp32';

const VARIANT_FILE: Record<ModelVariant, string> = {
  int8: 'model_int8.onnx',
  fp16: 'model_fp16.onnx',
  q4f16: 'model_q4f16.onnx',
  fp32: 'model.onnx',
};

export interface ProgressInfo {
  receivedBytes: number;
  totalBytes: number | null;
  fromCache: boolean;
}

/**
 * Get the ONNX weights for `variant`, from CacheStorage if present, else
 * stream-download from HuggingFace (reporting progress) and persist.
 */
export async function getModelBytes(
  variant: ModelVariant,
  onProgress: (p: ProgressInfo) => void,
): Promise<Uint8Array> {
  const url = `${HF_BASE}/${VARIANT_FILE[variant]}`;
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(url);
  if (cached) {
    const buf = await cached.arrayBuffer();
    onProgress({ receivedBytes: buf.byteLength, totalBytes: buf.byteLength, fromCache: true });
    return new Uint8Array(buf);
  }

  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok || !resp.body) {
    throw new Error(`model download failed: HTTP ${resp.status} for ${url}`);
  }
  const totalBytes = Number(resp.headers.get('content-length')) || null;

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ receivedBytes: received, totalBytes, fromCache: false });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }

  // Persist for next reload. Store a fresh Response (body already consumed).
  try {
    await cache.put(url, new Response(bytes, {
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(received) },
    }));
  } catch (err) {
    // Non-fatal: caching can fail (quota, private mode). Model still usable.
    console.warn('[modelCache] failed to persist to CacheStorage:', err);
  }

  return bytes;
}

export async function clearModelCache(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
