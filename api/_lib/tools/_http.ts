/**
 * Shared fetch helper for in-process tools.
 *
 * Why this exists: the V2 tools (courtlistener_search,
 * legiscan_search, openstates_search, citation_verify) called bare
 * `fetch()` with no timeout. A single hung upstream (CourtListener /
 * LegiScan / OpenStates) would block the whole agent turn until
 * the Vercel function's 300s ceiling — burning a function-minute and
 * stranding the attorney. `statuteVerify.ts` already used an
 * AbortController; this generalises that pattern.
 *
 * Behaviour (intentionally behaviour-PRESERVING for callers):
 *   - Adds a per-attempt AbortController timeout (default 12s).
 *   - Retries ONLY on a thrown error (network failure / timeout) or a
 *     transient HTTP status (429 / 5xx), up to `retries` extra attempts
 *     with linear backoff.
 *   - RETURNS the final Response (even a non-OK one) so each tool's
 *     existing `if (!resp.ok)` / "no results = []" handling is unchanged.
 *     It does NOT throw on 4xx — a CourtListener 404/no-hit stays a
 *     normal empty result, not an error.
 *   - On total failure (all attempts threw) it re-throws the last error,
 *     which the agent loop's dispatcher turns into a tool_result
 *     {is_error:true} the model can react to. FAIL IS FAIL: no silent
 *     empty-result substitution.
 *
 * INPUT FILES:  none (network helper)
 * OUTPUT FILES: none
 */

export interface ToolFetchOptions {
  /** Abort each attempt after this many ms (default 12000). */
  timeoutMs?: number;
  /** Extra attempts after the first, on transient failure (default 1). */
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 1;
/** Linear backoff between attempts. */
const RETRY_BACKOFF_MS = 400;

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * `fetch` with a hard per-attempt timeout and bounded transient retry.
 * Drop-in for `fetch(url, init)` in the tool layer.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  opts: ToolFetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      // Retry transient HTTP statuses, but on the LAST attempt return the
      // response so the caller's own non-OK handling runs.
      if (isTransientStatus(res.status) && attempt < retries) {
        lastError = new Error(`transient HTTP ${res.status}`);
        await delay(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await delay(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      // Out of attempts — surface a clear, scrub-safe error (no user
      // content; these are public-research endpoints).
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? `timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err);
      throw new Error(`fetch ${String(url).split('?')[0]} failed: ${reason}`);
    }
  }
  // Unreachable, but satisfies the type checker.
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
