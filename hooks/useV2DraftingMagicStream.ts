/**
 * V2 Drafting Magic SSE client. Consumes POST /api/agent/drafting-magic
 * and exposes incremental state similar to useV2DraftStream.
 */

import { useCallback, useRef, useState } from 'react';

export interface MagicSource {
  id: string;
  name: string;
  role: string;
  included: boolean;
  base: boolean;
  text: string;
  description?: string;
}

export interface MagicSendOpts {
  session_id: string;
  packet: MagicSource[];
  instructions: string;
  output_type: 'draft' | 'review_memo';
  user_id?: string | null;
}

export interface MagicDoneSummary {
  final_text: string;
  tool_rounds: number;
  total_tokens: number;
  elapsed_ms: number;
  stop_reason: string;
}

export interface MagicState {
  isStreaming: boolean;
  tokens: string;
  done: MagicDoneSummary | null;
  error: { code: string; message: string } | null;
  source_count: number | null;
  output_type: 'draft' | 'review_memo' | null;
  round: number;
  privileged: boolean | null;
}

const INITIAL: MagicState = {
  isStreaming: false,
  tokens: '',
  done: null,
  error: null,
  source_count: null,
  output_type: null,
  round: 0,
  privileged: null,
};

export function useV2DraftingMagicStream() {
  const [state, setState] = useState<MagicState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const send = useCallback(async (opts: MagicSendOpts) => {
    setState({ ...INITIAL, isStreaming: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let resp: Response;
    try {
      resp = await fetch('/api/agent/drafting-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(opts),
        signal: ctrl.signal,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: 'network', message: (err as Error).message },
      }));
      return;
    }
    if (!resp.ok || !resp.body) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: 'http', message: `HTTP ${resp.status}` },
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
          handleEvent(buffer.slice(0, sep), setState);
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState((s) => ({
          ...s,
          isStreaming: false,
          error: { code: 'stream', message: (err as Error).message },
        }));
        return;
      }
    } finally {
      setState((s) => ({ ...s, isStreaming: false }));
      abortRef.current = null;
    }
  }, []);

  return { state, send, reset };
}

function handleEvent(raw: string, setState: React.Dispatch<React.SetStateAction<MagicState>>) {
  if (!raw.trim()) return;
  let kind = '';
  const dataLines: string[] = [];
  for (const l of raw.split('\n')) {
    if (l.startsWith('event:')) kind = l.slice(6).trim();
    else if (l.startsWith('data:')) dataLines.push(l.slice(5).trimStart());
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  } catch {
    return;
  }
  switch (kind) {
    case 'magic_start':
      setState((s) => ({
        ...s,
        source_count: Number(data.source_count ?? 0),
        output_type: (data.output_type as 'draft' | 'review_memo') ?? 'draft',
      }));
      break;
    case 'sanitization':
      setState((s) => ({ ...s, privileged: Boolean(data.privileged) }));
      break;
    case 'iteration':
      setState((s) => ({ ...s, round: Number(data.round ?? 0) }));
      break;
    case 'token':
      setState((s) => ({ ...s, tokens: s.tokens + String(data.text ?? '') }));
      break;
    case 'done':
      setState((s) => ({
        ...s,
        done: data.result as unknown as MagicDoneSummary,
        isStreaming: false,
      }));
      break;
    case 'error':
    case 'proxy_error':
      setState((s) => ({
        ...s,
        error: {
          code: String(data.code ?? 'error'),
          message: String(data.message ?? ''),
        },
        isStreaming: false,
      }));
      break;
  }
}
