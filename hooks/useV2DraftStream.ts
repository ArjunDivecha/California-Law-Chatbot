/**
 * V2 drafting SSE client. Consumes POST /api/agent/draft-stream and
 * exposes incremental state to V2DraftPage. Mirrors useV2AgentStream
 * (chat-flow hook) but with the drafting-specific event types added:
 *
 *   template          — emitted once up-front w/ template_id + skill_loaded
 *   sanitization      — privileged + compound_risk + redactions
 *   iteration         — tool-round counter (1-indexed)
 *   tool_use_start    — model called a tool ("Searching CEB…")
 *   tool_use_input    — tool input JSON
 *   tool_result       — tool returned (elapsed_ms, is_error)
 *   token             — text delta (most frequent)
 *   done              — final RunTurnResult summary
 *   quality_warning   — emitted after `done` when output is short or
 *                       missing sections (non-terminal)
 *   error / proxy_error — terminal failure
 */

import { useCallback, useRef, useState } from 'react';
import {
  getChatSanitizer,
  tokenizeForWire,
} from '../services/sanitization/chatAdapter';
import { assertNoRawPii } from '../services/sanitization/wireGuard';

export interface V2DraftToolEvent {
  id: string;
  tool_use_id: string;
  name: string;
  round: number;
  status: 'running' | 'done' | 'error';
  elapsed_ms?: number;
  input?: unknown;
}

export interface V2DraftSanitization {
  privileged: boolean;
  compound_risk_buckets: number;
  redactions_count: number;
}

export interface V2DraftDoneSummary {
  final_text: string;
  tool_rounds: number;
  total_tokens: number;
  elapsed_ms: number;
  stop_reason: string;
  exhausted_iterations: boolean;
}

export interface V2DraftQualityWarning {
  issues: string[];
  word_count: number;
  missing_sections: string[];
  expected_section_count: number;
  emitted_section_count: number;
}

export interface V2DraftStreamError {
  code: string;
  message: string;
  status_code?: number;
  proxy: boolean;
}

export interface V2DraftState {
  template_id: string | null;
  skill_loaded: string | null;
  sanitization: V2DraftSanitization | null;
  tokens: string;
  toolEvents: V2DraftToolEvent[];
  isStreaming: boolean;
  error: V2DraftStreamError | null;
  done: V2DraftDoneSummary | null;
  quality_warning: V2DraftQualityWarning | null;
  round: number;
}

const INITIAL_STATE: V2DraftState = {
  template_id: null,
  skill_loaded: null,
  sanitization: null,
  tokens: '',
  toolEvents: [],
  isStreaming: false,
  error: null,
  done: null,
  quality_warning: null,
  round: 0,
};

export interface DraftSendOpts {
  session_id: string;
  template_id: string;
  variables: Record<string, string>;
  user_instructions: string;
  options?: Record<string, unknown>;
  user_id?: string | null;
  model?: string;
}

export function useV2DraftStream() {
  const [state, setState] = useState<V2DraftState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const send = useCallback(async (opts: DraftSendOpts): Promise<void> => {
    setState({ ...INITIAL_STATE, isStreaming: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Browser-side tokenization gate (Option C, 6th addendum). Tokenize
    // every free-text field — user_instructions and every entry in
    // variables — before send. The template_id is non-sensitive.
    let tokenizedOpts: DraftSendOpts;
    try {
      const wireInstructions = await tokenizeForWire(opts.user_instructions ?? '');
      const tokenizedVariables: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts.variables ?? {})) {
        const wire = await tokenizeForWire(String(v));
        tokenizedVariables[k] = wire.sanitized;
      }
      tokenizedOpts = {
        ...opts,
        user_instructions: wireInstructions.sanitized,
        variables: tokenizedVariables,
      };
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'sanitizer_unavailable',
          message: `Sanitization failed: ${(err as Error).message}. The draft request was blocked to prevent raw client text from leaving the device.`,
          proxy: true,
        },
      }));
      return;
    }

    // Plan §S browser-side CI assertion — final regex check on the
    // outbound body; abort if any raw HIGH_RISK pattern survived.
    try {
      assertNoRawPii(tokenizedOpts);
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'wire_guard_violation',
          message: (err as Error).message,
          proxy: true,
        },
      }));
      return;
    }

    let resp: Response;
    try {
      resp = await fetch('/api/agent/draft-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(tokenizedOpts),
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

function handleSseEvent(
  raw: string,
  setState: React.Dispatch<React.SetStateAction<V2DraftState>>,
): void {
  if (!raw.trim()) return;
  let eventKind = '';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) eventKind = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!eventKind || dataLines.length === 0) return;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  } catch {
    return;
  }

  switch (eventKind) {
    case 'template':
      setState((s) => ({
        ...s,
        template_id: String(data.template_id ?? ''),
        skill_loaded: String(data.skill_loaded ?? ''),
      }));
      break;
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
      setState((s) => ({
        ...s,
        toolEvents: s.toolEvents.map((e) =>
          e.tool_use_id === id
            ? { ...e, status: isError ? 'error' : 'done', elapsed_ms: elapsed }
            : e,
        ),
      }));
      break;
    }
    case 'token': {
      // Rehydrate tokens via the device-local IndexedDB map before display.
      const sanitizer = getChatSanitizer();
      const incoming = String(data.text ?? '');
      setState((s) => ({ ...s, tokens: s.tokens + sanitizer.rehydrateMessage(incoming) }));
      break;
    }
    case 'done': {
      const sanitizer = getChatSanitizer();
      const result = data.result as V2DraftDoneSummary | undefined;
      const rehydratedResult = result
        ? { ...result, final_text: sanitizer.rehydrateMessage(result.final_text ?? '') }
        : undefined;
      setState((s) => ({
        ...s,
        done: rehydratedResult ?? (data.result as unknown as V2DraftDoneSummary),
        isStreaming: false,
      }));
      break;
    }
    case 'quality_warning':
      setState((s) => ({
        ...s,
        quality_warning: {
          issues: (data.issues as string[]) ?? [],
          word_count: Number(data.word_count ?? 0),
          missing_sections: (data.missing_sections as string[]) ?? [],
          expected_section_count: Number(data.expected_section_count ?? 0),
          emitted_section_count: Number(data.emitted_section_count ?? 0),
        },
      }));
      break;
    case 'error':
    case 'proxy_error':
      setState((s) => ({
        ...s,
        error: {
          code: String(data.code ?? 'error'),
          message: String(data.message ?? ''),
          status_code: data.status_code as number | undefined,
          proxy: eventKind === 'proxy_error',
        },
        isStreaming: false,
      }));
      break;
  }
}
