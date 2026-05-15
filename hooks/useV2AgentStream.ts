/**
 * V2 agent SSE client. Consumes POST /api/agent/turn-stream and exposes
 * incremental state to the V2 chat page:
 *
 *   sanitization   — privileged + compound_risk + redactions (set once
 *                    early, before any tokens)
 *   tokens         — accumulated text (paints assistant message bubble)
 *   toolEvents     — ordered list of tool affordances (Searching CEB…, ✓ done)
 *   isStreaming    — true while a turn is in flight
 *   error          — terminal error if the stream blew up or proxy
 *                    returned a gate error (e.g. sanitizer_unavailable)
 *   done           — final RunTurnResult summary from the 'done' event
 *
 * Uses fetch + ReadableStream rather than the browser-built-in
 * EventSource because the V2 route is POST (EventSource is GET-only).
 * Parses the line-oriented SSE format manually — events look like:
 *
 *   event: <kind>
 *   data: <json>
 *
 * separated by blank lines. The reader buffers partial chunks and
 * splits on `\n\n` to find complete events.
 */

import { useCallback, useRef, useState } from 'react';
import {
  getChatSanitizer,
  tokenizeForWire,
} from '../services/sanitization/chatAdapter';

export interface V2ToolEvent {
  /** Stable id for keying the React list. */
  id: string;
  tool_use_id: string;
  name: string;
  /** Round (1-indexed) this tool fired in. */
  round: number;
  /** Latest status — flips from 'running' to 'done' / 'error' on result. */
  status: 'running' | 'done' | 'error';
  /** ms — present once the tool returned. */
  elapsed_ms?: number;
  /** Tool input JSON, captured from `tool_use_input` event. */
  input?: unknown;
}

export interface V2SourceSummary {
  tool_name: string;
  source_type: string;
  title: string;
  detail?: string;
  url?: string;
  status?: string;
}

export interface V2Sanitization {
  privileged: boolean;
  compound_risk_buckets: number;
  redactions_count: number;
}

export interface V2DoneSummary {
  final_text: string;
  tool_rounds: number;
  total_tokens: number;
  elapsed_ms: number;
  stop_reason: string;
  exhausted_iterations: boolean;
}

export interface V2StreamError {
  code: string;
  message: string;
  status_code?: number;
  /** Whether this is a gate-layer error (sanitizer down etc.) vs runtime. */
  proxy: boolean;
}

export interface V2TurnState {
  sanitization: V2Sanitization | null;
  tokens: string;
  toolEvents: V2ToolEvent[];
  /** Per-tool source summaries collected from tool_result events. */
  sources: V2SourceSummary[];
  isStreaming: boolean;
  error: V2StreamError | null;
  done: V2DoneSummary | null;
  /** Current iteration round (1-indexed) — useful for UI affordances. */
  round: number;
}

const INITIAL_STATE: V2TurnState = {
  sanitization: null,
  tokens: '',
  toolEvents: [],
  sources: [],
  isStreaming: false,
  error: null,
  done: null,
  round: 0,
};

interface SendOpts {
  session_id: string;
  user_text: string;
  user_id?: string | null;
  model?: string;
  system_prompt?: string;
  /** 'quick' (Sonnet, no tools) or 'research' (Opus + full tool set). */
  workflow?: 'quick' | 'research';
}

export function useV2AgentStream() {
  const [state, setState] = useState<V2TurnState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  /** Reset state — used between turns. */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  /** Cancel an in-flight stream. State is preserved (user can see partial). */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const send = useCallback(async (opts: SendOpts): Promise<void> => {
    // Reset to fresh turn state, but keep the user message ownership
    // up to the page — this hook only manages the assistant-side.
    setState({ ...INITIAL_STATE, isStreaming: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Browser-side tokenization gate (Option C, 6th addendum). Raw text
    // never leaves the laptop. If the sanitizer is unavailable we fail
    // closed here rather than send raw to the server.
    let wireText: string;
    try {
      const wire = await tokenizeForWire(opts.user_text);
      wireText = wire.sanitized;
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'sanitizer_unavailable',
          message: `Sanitization failed: ${(err as Error).message}. The request was blocked to prevent raw client text from leaving the device.`,
          proxy: true,
        },
      }));
      return;
    }

    let resp: Response;
    try {
      resp = await fetch('/api/agent/turn-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          session_id: opts.session_id,
          // Tokenized text — raw PII has been replaced by @@TOKEN@@
          // placeholders via the browser-side OPF + IndexedDB token map.
          // The token map stays on the device.
          user_text: wireText,
          user_id: opts.user_id,
          model: opts.model,
          system_prompt: opts.system_prompt,
          workflow: opts.workflow,
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState((s) => ({ ...s, isStreaming: false }));
        return;
      }
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'network_error',
          message: (err as Error).message,
          proxy: false,
        },
      }));
      return;
    }

    if (!resp.ok || !resp.body) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'http_error',
          message: `HTTP ${resp.status}`,
          status_code: resp.status,
          proxy: false,
        },
      }));
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by `\n\n`. Drain complete ones; leave
        // the trailing partial in the buffer for the next read.
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          handleSseEvent(raw, setState);
          sep = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState((s) => ({
          ...s,
          isStreaming: false,
          error: {
            code: 'stream_error',
            message: (err as Error).message,
            proxy: false,
          },
        }));
        return;
      }
    } finally {
      setState((s) => ({ ...s, isStreaming: false }));
      abortRef.current = null;
    }
  }, []);

  return { state, send, reset, cancel };
}

// ---------------------------------------------------------------------------
// Event parsing
// ---------------------------------------------------------------------------

function handleSseEvent(
  raw: string,
  setState: React.Dispatch<React.SetStateAction<V2TurnState>>,
): void {
  if (!raw.trim()) return;
  // Each event is a sequence of "field: value" lines.
  let eventKind = '';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      eventKind = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!eventKind || dataLines.length === 0) return;
  const dataStr = dataLines.join('\n');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    return; // skip malformed
  }

  switch (eventKind) {
    case 'sanitization':
      setState((s) => ({
        ...s,
        sanitization: {
          privileged: Boolean(data.privileged),
          compound_risk_buckets: Number(data.compound_risk_buckets ?? 0),
          redactions_count: Number(data.redactions_count ?? 0),
        },
      }));
      break;
    case 'iteration':
      setState((s) => ({ ...s, round: Number(data.round ?? 0) }));
      break;
    case 'tool_use_start': {
      const id = String(data.tool_use_id);
      const name = String(data.name);
      const round = Number(data.round ?? 0);
      setState((s) => ({
        ...s,
        toolEvents: [
          ...s.toolEvents,
          { id, tool_use_id: id, name, round, status: 'running' },
        ],
      }));
      break;
    }
    case 'tool_use_input': {
      const id = String(data.tool_use_id);
      setState((s) => ({
        ...s,
        toolEvents: s.toolEvents.map((e) =>
          e.tool_use_id === id ? { ...e, input: data.input } : e,
        ),
      }));
      break;
    }
    case 'tool_result': {
      const id = String(data.tool_use_id);
      const isError = Boolean(data.is_error);
      const elapsed = Number(data.elapsed_ms ?? 0);
      const summaries = Array.isArray(data.source_summary)
        ? (data.source_summary as V2SourceSummary[])
        : [];
      setState((s) => ({
        ...s,
        toolEvents: s.toolEvents.map((e) =>
          e.tool_use_id === id
            ? { ...e, status: isError ? 'error' : 'done', elapsed_ms: elapsed }
            : e,
        ),
        sources: [...s.sources, ...summaries],
      }));
      break;
    }
    case 'token': {
      // Rehydrate token-form tokens (@@CLIENT_001@@ etc.) back to real
      // names using the device-local IndexedDB map before display.
      const sanitizer = getChatSanitizer();
      const incoming = String(data.text ?? '');
      const rehydrated = sanitizer.rehydrateMessage(incoming);
      setState((s) => ({ ...s, tokens: s.tokens + rehydrated }));
      break;
    }
    case 'done': {
      const sanitizer = getChatSanitizer();
      const result = data.result as V2DoneSummary | undefined;
      const rehydratedResult = result
        ? {
            ...result,
            final_text: sanitizer.rehydrateMessage(result.final_text ?? ''),
          }
        : undefined;
      setState((s) => ({
        ...s,
        done: rehydratedResult ?? (data.result as unknown as V2DoneSummary),
        isStreaming: false,
      }));
      break;
    }
    case 'error':
      setState((s) => ({
        ...s,
        error: {
          code: String(data.code ?? 'error'),
          message: String(data.message ?? ''),
          proxy: false,
        },
        isStreaming: false,
      }));
      break;
    case 'proxy_error':
      setState((s) => ({
        ...s,
        error: {
          code: String(data.code ?? 'proxy_error'),
          message: String(data.message ?? ''),
          status_code: Number(data.status_code ?? 0) || undefined,
          proxy: true,
        },
        isStreaming: false,
      }));
      break;
    default:
      // Unknown event — ignore. The server may add events the client
      // doesn't recognize; we should not crash on those.
      break;
  }
}
