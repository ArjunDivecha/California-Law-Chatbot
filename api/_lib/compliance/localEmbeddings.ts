/**
 * =============================================================================
 * Local embeddings daemon client (P5-infra) — California Law Chatbot V3
 * api/_lib/compliance/localEmbeddings.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   For protected_discovery (and any firm-controlled-store path), embeddings
 *   must be computed WITHOUT sending client text to a third party. This client
 *   talks to a LOCAL embedding daemon (BGE-M3 / Qwen3-Embedding) over loopback
 *   — the same pattern as the existing OPF/GLiNER daemon — so the text never
 *   leaves the firm's boundary. Chosen 2026-06-24: sqlite-vec store + local
 *   BGE-M3 embeddings (PRD §5.7a, §10 decisions 4-5).
 *
 *   FAIL CLOSED: if the daemon URL is not configured or the daemon is
 *   unreachable/malformed, this THROWS. It never silently falls back to a cloud
 *   embedding provider for protected data (CLAUDE.md: "FAIL IS FAIL").
 *
 * OPS (to provision): run the BGE-M3 daemon locally (HTTP POST {texts,model} ->
 *   {embeddings: number[][]}) and set EMBEDDINGS_DAEMON_URL. See
 *   scripts/reembed-ceb-local.mjs to re-embed the 77,406 CEB vectors.
 *
 * INPUT FILES:  none (network client; daemon is external).
 * OUTPUT FILES: none.
 * =============================================================================
 */

export interface LocalEmbeddingsConfig {
  /** Daemon endpoint. Defaults to EMBEDDINGS_DAEMON_URL. */
  url?: string;
  /** Model id the daemon should use. */
  model?: string;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = 'bge-m3';

/** True if a local embeddings daemon URL is configured. */
export function isLocalEmbeddingsConfigured(url: string | undefined = process.env.EMBEDDINGS_DAEMON_URL): boolean {
  return Boolean(url);
}

/**
 * Embed `texts` via the local daemon. Fail-closed on missing config, transport
 * error, non-200, or malformed response. Returns one vector per input text.
 */
export async function embedLocal(texts: string[], cfg: LocalEmbeddingsConfig = {}): Promise<number[][]> {
  const url = cfg.url ?? process.env.EMBEDDINGS_DAEMON_URL;
  if (!url) {
    throw new Error(
      'local embeddings daemon not configured (set EMBEDDINGS_DAEMON_URL). ' +
        'Refusing to use a cloud embedding provider for protected/firm-controlled data.',
    );
  }
  if (texts.length === 0) return [];
  const f = cfg.fetchImpl ?? fetch;
  let resp: Response;
  try {
    resp = await f(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts, model: cfg.model ?? DEFAULT_MODEL }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`local embeddings daemon unreachable at ${url}: ${msg}`);
  }
  if (!resp.ok) {
    throw new Error(`local embeddings daemon error ${resp.status} at ${url}`);
  }
  const data: unknown = await resp.json().catch(() => null);
  const embeddings = (data as { embeddings?: unknown })?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error('local embeddings daemon returned a malformed or mismatched response');
  }
  for (const e of embeddings) {
    if (!Array.isArray(e) || e.some((n) => typeof n !== 'number')) {
      throw new Error('local embeddings daemon returned a non-numeric embedding');
    }
  }
  return embeddings as number[][];
}
