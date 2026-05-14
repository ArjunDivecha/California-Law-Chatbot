/**
 * V2 verification SSE client. Consumes POST /api/agent/verify-stream
 * and exposes progressive verdict state. Events:
 *
 *   manifest        — fired once after extraction; citation list + count
 *   verdict         — fired per citation (status, reasoning, etc.)
 *   done            — terminal; counts and elapsed
 *   error           — terminal failure
 *
 * UI consumes `verdicts` array (indexed by manifest position) and
 * `isStreaming` to render progressive rows + a final summary.
 */

import { useCallback, useRef, useState } from 'react';

export interface V2Verdict {
  index: number;
  citation: string;
  status: 'real' | 'fake' | 'error' | 'pending';
  case_name?: string;
  match_url?: string;
  confidence?: number;
  reasoning?: string;
  tool_rounds?: number;
  elapsed_ms?: number;
  error?: string;
}

export interface V2VerifyDoneSummary {
  verified: number;
  fake: number;
  total: number;
  elapsed_ms: number;
}

export interface V2VerifyState {
  manifest: string[] | null;
  verdicts: V2Verdict[];
  done: V2VerifyDoneSummary | null;
  isStreaming: boolean;
  error: { code: string; message: string } | null;
}

const INITIAL_STATE: V2VerifyState = {
  manifest: null,
  verdicts: [],
  done: null,
  isStreaming: false,
  error: null,
};

export function useV2VerifyStream() {
  const [state, setState] = useState<V2VerifyState>(INITIAL_STATE);
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

  const verify = useCallback(async (text: string): Promise<void> => {
    setState({ ...INITIAL_STATE, isStreaming: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let resp: Response;
    try {
      resp = await fetch('/api/agent/verify-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ text }),
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
        error: { code: 'network_error', message: (err as Error).message },
      }));
      return;
    }

    if (!resp.ok || !resp.body) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: 'http_error', message: `HTTP ${resp.status}` },
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
          error: { code: 'stream_error', message: (err as Error).message },
        }));
        return;
      }
    } finally {
      setState((s) => ({ ...s, isStreaming: false }));
      abortRef.current = null;
    }
  }, []);

  return { state, verify, reset, cancel };
}

function handleEvent(raw: string, setState: React.Dispatch<React.SetStateAction<V2VerifyState>>) {
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
    case 'manifest': {
      const citations = (data.citations as string[]) ?? [];
      setState((s) => ({
        ...s,
        manifest: citations,
        // Pre-populate verdicts as `pending` so the UI can show rows
        // with spinners up-front.
        verdicts: citations.map((c, i) => ({ index: i, citation: c, status: 'pending' })),
      }));
      break;
    }
    case 'verdict': {
      const v: V2Verdict = {
        index: Number(data.index ?? 0),
        citation: String(data.citation ?? ''),
        status: (data.status as V2Verdict['status']) ?? 'error',
        case_name: data.case_name as string | undefined,
        match_url: data.match_url as string | undefined,
        confidence: data.confidence as number | undefined,
        reasoning: data.reasoning as string | undefined,
        tool_rounds: data.tool_rounds as number | undefined,
        elapsed_ms: data.elapsed_ms as number | undefined,
        error: data.error as string | undefined,
      };
      setState((s) => {
        const next = [...s.verdicts];
        next[v.index] = v;
        return { ...s, verdicts: next };
      });
      break;
    }
    case 'done':
      setState((s) => ({
        ...s,
        done: {
          verified: Number(data.verified ?? 0),
          fake: Number(data.fake ?? 0),
          total: Number(data.total ?? 0),
          elapsed_ms: Number(data.elapsed_ms ?? 0),
        },
        isStreaming: false,
      }));
      break;
    case 'error':
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
