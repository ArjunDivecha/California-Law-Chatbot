/**
 * OPF daemon client — talks to the local OpenAI Privacy Filter daemon
 * running on loopback. Deployed HTTPS pages use the daemon's local HTTPS
 * endpoint first because Safari/WebKit blocks public HTTPS pages from
 * calling a plain HTTP localhost service.
 *
 * This module is the SHARED ENTRY POINT for any feature in the app that
 * needs PII detection — the research chat, the drafting magic flow,
 * future features. It's intentionally framework-agnostic (no React) so
 * any layer can call it.
 *
 * Health and lifecycle are managed in hooks/useSanitizer.tsx:
 *   - On mount, the SanitizerProvider calls warmup() to load the model
 *     in the background.
 *   - It polls getHealth() periodically and exposes daemonStatus to
 *     consumers.
 *
 * Detection at the wire path goes through detectSpans(). Spans are
 * mapped from OPF's label vocabulary to our existing SpanCategory
 * taxonomy so the rest of the sanitization pipeline (tokenize,
 * rehydrate, store) doesn't have to change.
 */

import type { SpanCategory, Span } from '../../api/_shared/sanitization/index.js';

export const OPF_DAEMON_URL = 'https://localhost:47822';
export const OPF_DAEMON_URLS = [
  OPF_DAEMON_URL,
  'https://127.0.0.1:47822',
  'https://[::1]:47822',
  // Backward compatibility for existing Chrome/local-development installs.
  'http://127.0.0.1:47821',
  'http://localhost:47821',
  'http://[::1]:47821',
];
export const OPF_BRIDGE_URL = 'http://127.0.0.1:47821/bridge';
const OPF_BRIDGE_ORIGIN = 'http://127.0.0.1:47821';

const DETECT_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 1_500;
let preferredDaemonUrl: string | null = null;
let bridgeWindow: Window | null = null;
let bridgeReady = false;
let bridgeListenerAttached = false;
const pendingBridgeRequests = new Map<
  string,
  {
    resolve: (res: Response) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof globalThis.setTimeout>;
  }
>();

// ---------------------------------------------------------------------------
// Label mapping: OPF labels → our SpanCategory taxonomy
// ---------------------------------------------------------------------------

interface OpfRawSpan {
  label: string;
  start: number;
  end: number;
  text: string;
  placeholder?: string;
}

interface OpfDetectResponse {
  spans: OpfRawSpan[];
  elapsed_ms: number;
  model_loaded: boolean;
}

/**
 * Map OPF label vocabulary to our SpanCategory. OPF collapses several
 * specific identifier types into `account_number`; we keep the bucket
 * generic and rely on regex patterns (already running upstream) to
 * specialize when the format is recognizable (SSN dashes, credit-card
 * digit grouping, etc.).
 */
function opfLabelToCategory(label: string): SpanCategory | null {
  switch (label) {
    case 'private_person': return 'name';
    case 'private_address': return 'street_address';
    case 'private_email': return 'email';
    case 'private_phone': return 'phone';
    case 'private_date': return 'date';
    case 'account_number': return 'bank_account'; // generic bucket; regex specializes
    case 'private_url': return null; // ignore — URLs aren't PII per our taxonomy
    case 'secret': return 'client_matter'; // catch-all for unique opaque tokens
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface DaemonHealth {
  ok: boolean;
  modelLoaded: boolean;
  uptimeS: number;
  lastRequestAgeS: number | null;
  idleUnloadSeconds: number;
  version: string;
}

export type DaemonStatus =
  | { state: 'unknown' }                  // before first probe
  | { state: 'healthy'; health: DaemonHealth }
  | { state: 'unreachable'; error: string };

function daemonUrlCandidates(): string[] {
  const candidates = preferredDaemonUrl
    ? [preferredDaemonUrl, ...OPF_DAEMON_URLS]
    : OPF_DAEMON_URLS;
  return [...new Set(candidates)];
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.open === 'function';
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function attachBridgeListener(): void {
  if (!isBrowserRuntime() || bridgeListenerAttached) return;
  window.addEventListener('message', (event) => {
    if (event.origin !== OPF_BRIDGE_ORIGIN) return;
    const data = event.data as {
      type?: string;
      id?: string;
      ok?: boolean;
      status?: number;
      body?: unknown;
      error?: string;
    } | null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'opf-bridge-ready') {
      bridgeReady = true;
      return;
    }
    if (data.type !== 'opf-bridge-response' || typeof data.id !== 'string') return;
    const pending = pendingBridgeRequests.get(data.id);
    if (!pending) return;
    pendingBridgeRequests.delete(data.id);
    globalThis.clearTimeout(pending.timer);
    if (!data.ok) {
      pending.reject(new Error(data.error || `OPF bridge http ${data.status ?? 0}`));
      return;
    }
    pending.resolve(
      new Response(JSON.stringify(data.body ?? {}), {
        status: data.status || 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
  bridgeListenerAttached = true;
}

async function waitForBridgeReady(timeoutMs: number): Promise<void> {
  if (bridgeReady) return;
  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const timer = globalThis.setInterval(() => {
      if (bridgeReady) {
        globalThis.clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        globalThis.clearInterval(timer);
        reject(new Error('OPF bridge did not become ready'));
      }
    }, 100);
  });
}

export async function connectBridge(timeoutMs = 12_000): Promise<void> {
  if (!isBrowserRuntime()) throw new Error('OPF bridge is only available in a browser');
  attachBridgeListener();
  if (!bridgeWindow || bridgeWindow.closed) {
    bridgeWindow = window.open(
      OPF_BRIDGE_URL,
      'fflp-opf-privacy-filter-bridge',
      'popup,width=560,height=420'
    );
  } else {
    bridgeWindow.focus();
  }
  if (!bridgeWindow) {
    throw new Error('Safari blocked the privacy filter bridge window');
  }
  await waitForBridgeReady(timeoutMs);
}

async function fetchViaBridge(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  if (!isBrowserRuntime()) throw new Error('OPF bridge is only available in a browser');
  attachBridgeListener();
  if (!bridgeReady || !bridgeWindow || bridgeWindow.closed) {
    throw new Error('OPF bridge is not connected');
  }
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const body = typeof init.body === 'string' ? init.body : undefined;

  return new Promise<Response>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      pendingBridgeRequests.delete(id);
      reject(new Error(`OPF bridge timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pendingBridgeRequests.set(id, { resolve, reject, timer });
    bridgeWindow?.postMessage(
      {
        type: 'opf-bridge-request',
        id,
        path,
        method: init.method || 'GET',
        headers: normalizeHeaders(init.headers),
        body,
      },
      OPF_BRIDGE_ORIGIN
    );
  });
}

async function fetchFromDaemon(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  let lastError: unknown = null;

  for (const baseUrl of daemonUrlCandidates()) {
    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        mode: 'cors',
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`${baseUrl}${path} http ${res.status}`);
      }
      preferredDaemonUrl = baseUrl;
      return res;
    } catch (err) {
      lastError = err;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  try {
    return await fetchViaBridge(path, init, timeoutMs);
  } catch (err) {
    lastError = err;
  }

  throw new Error(
    `OPF daemon unreachable on loopback (${daemonUrlCandidates().join(', ')}, bridge): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * Lightweight health probe. Returns within ~1.5s or rejects.
 */
export async function getHealth(): Promise<DaemonHealth> {
  const res = await fetchFromDaemon('/v1/health', { method: 'GET' }, HEALTH_TIMEOUT_MS);
  const data = (await res.json()) as {
    ok: boolean;
    model_loaded: boolean;
    uptime_s: number;
    last_request_age_s: number | null;
    idle_unload_seconds: number;
    version: string;
  };
  return {
    ok: data.ok,
    modelLoaded: data.model_loaded,
    uptimeS: data.uptime_s,
    lastRequestAgeS: data.last_request_age_s,
    idleUnloadSeconds: data.idle_unload_seconds,
    version: data.version,
  };
}

// ---------------------------------------------------------------------------
// Warmup
// ---------------------------------------------------------------------------

/**
 * Trigger model load without caring about the result. Send a tiny detect
 * payload so the daemon transitions from "model unloaded" → "model
 * loaded" in the background while the user is still reading the page.
 *
 * Resolves when the daemon answers (which itself takes ~19s the first
 * time after a fresh launchd start because PyTorch import is slow).
 * Errors are non-fatal — the caller should not rely on warmup
 * succeeding.
 */
export async function warmup(): Promise<void> {
  await detectSpans('warmup', { warmupOnly: true });
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

export interface DetectResult {
  spans: Span[];
  elapsedMs: number;
  modelLoaded: boolean;
}

export interface DetectOptions {
  /** Skip span construction overhead — we only care about completing the call. */
  warmupOnly?: boolean;
  /** Override default 10s timeout. */
  timeoutMs?: number;
}

/**
 * Send `text` to the daemon and return spans mapped into our taxonomy.
 * Throws on network error, non-2xx response, or timeout. The caller
 * decides whether to fail-closed (block sends) or fall back to the
 * heuristic detector for non-critical paths like live preview.
 */
export async function detectSpans(
  text: string,
  opts: DetectOptions = {}
): Promise<DetectResult> {
  const res = await fetchFromDaemon(
    '/v1/detect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    opts.timeoutMs ?? DETECT_TIMEOUT_MS
  );
  const data = (await res.json()) as OpfDetectResponse;
  if (opts.warmupOnly) {
    return { spans: [], elapsedMs: data.elapsed_ms, modelLoaded: data.model_loaded };
  }
  const spans: Span[] = [];
  for (const raw of data.spans) {
    const category = opfLabelToCategory(raw.label);
    if (!category) continue;
    spans.push({
      start: raw.start,
      end: raw.end,
      category,
      raw: raw.text,
      label: `opf:${raw.label}`,
    });
  }
  return { spans, elapsedMs: data.elapsed_ms, modelLoaded: data.model_loaded };
}

/**
 * Convenience wrapper: best-effort detect that returns null on any error
 * instead of throwing. Useful for the live preview where a failed
 * detect should not blow up the UI — the wire path uses the throwing
 * version directly so it can fail-closed.
 */
export async function detectSpansSafe(text: string): Promise<DetectResult | null> {
  try {
    return await detectSpans(text);
  } catch {
    return null;
  }
}
