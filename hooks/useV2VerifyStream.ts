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
import { useAuth } from '@clerk/clerk-react';
import {
  getChatSanitizer,
  tokenizeForWire,
} from '../services/sanitization/chatAdapter';
import { assertNoRawPii } from '../services/sanitization/wireGuard';

export interface V2Verdict {
  index: number;
  citation: string;
  /**
   * `real` — positive evidence (matching CL hit or CEB ref)
   * `fake` — contradictory evidence (different case at the cite, etc.)
   * `ambiguous` — tools returned no evidence either way; manual verify needed
   * `pending` — in-flight (UI placeholder)
   * `error` — sub-agent crashed / network failure
   */
  status: 'real' | 'fake' | 'ambiguous' | 'error' | 'pending';
  /** 'case' (court decision) or 'statute' (code section). */
  citation_type?: 'case' | 'statute';
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
  ambiguous: number;
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
  const { getToken } = useAuth();

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

    // Tokenize the passage before send — verify-stream's input is a
    // free-form passage that may contain party names + facts. Citation
    // patterns (case names, reporters) are explicitly allowlisted in
    // the sanitizer, so legal citations pass through untokenized.
    let wireText: string;
    try {
      const wire = await tokenizeForWire(text);
      wireText = wire.sanitized;
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: {
          code: 'sanitizer_unavailable',
          message: `Sanitization failed: ${(err as Error).message}. The verify request was blocked to prevent raw client text from leaving the device.`,
        },
      }));
      return;
    }

    // Plan §S browser-side CI assertion — final regex check.
    try {
      assertNoRawPii({ text: wireText });
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: 'wire_guard_violation', message: (err as Error).message },
      }));
      return;
    }

    const token = await getToken().catch(() => null);
    let resp: Response;
    try {
      resp = await fetch('/api/agent/verify-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: wireText }),
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
  }, [getToken]);

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

  // Rehydrate any tokens the server may have echoed back in citation
  // strings / case names / reasoning — the user's passage may have
  // contained tokenized party names that flow into the verifier's
  // output strings.
  const sanitizer = getChatSanitizer();

  switch (eventKind) {
    case 'manifest': {
      const citations = ((data.citations as string[]) ?? []).map((c) =>
        sanitizer.rehydrateMessage(c),
      );
      const types = (data.citation_types as Array<'case' | 'statute'>) ?? [];
      setState((s) => ({
        ...s,
        manifest: citations,
        // Pre-populate verdicts as `pending` so the UI can show rows
        // with spinners up-front.
        verdicts: citations.map((c, i) => ({
          index: i,
          citation: c,
          citation_type: types[i],
          status: 'pending',
        })),
      }));
      break;
    }
    case 'verdict': {
      const v: V2Verdict = {
        index: Number(data.index ?? 0),
        citation: sanitizer.rehydrateMessage(String(data.citation ?? '')),
        citation_type: data.citation_type as 'case' | 'statute' | undefined,
        status: (data.status as V2Verdict['status']) ?? 'error',
        case_name: data.case_name != null ? sanitizer.rehydrateMessage(String(data.case_name)) : undefined,
        match_url: data.match_url as string | undefined,
        confidence: data.confidence as number | undefined,
        reasoning: data.reasoning != null ? sanitizer.rehydrateMessage(String(data.reasoning)) : undefined,
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
          ambiguous: Number(data.ambiguous ?? 0),
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
