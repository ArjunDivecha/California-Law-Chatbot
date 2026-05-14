/**
 * V2 agent turn — SSE streaming variant.
 *
 * POST /api/agent/turn-stream
 *   body: { session_id, user_text, user_id?, model?, system_prompt? }
 *
 * Response is Server-Sent Events: one line per event of the form
 *
 *   event: <kind>
 *   data: <json>
 *
 * Event kinds, in order of typical arrival:
 *   sanitization      — fired ONCE up-front with privileged + compound_risk_buckets
 *   iteration         — fired at the start of each tool-use round (1-indexed)
 *   token             — text delta from the model (most frequent)
 *   tool_use_start    — model is about to call a tool (UI: "Searching CEB…")
 *   tool_use_input    — fully assembled input JSON for the tool call
 *   tool_result       — tool returned (timing + is_error)
 *   done              — final summary (final_text, tool_rounds, total_tokens, elapsed_ms)
 *   error             — model-side error mid-stream
 *   proxy_error       — sanitization or gate-layer error (terminal)
 *
 * Clients should stop reading after a `done`, `error`, or `proxy_error`.
 * Connection close without one of those terminal events indicates an
 * unclean disconnect — clients may retry with the same session_id; the
 * agent loop's tool-result idempotency cache (24h) prevents double
 * tool dispatch.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentProxyStream } from '../_lib/agentProxy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for the streaming path. Browsers require explicit headers
  // *before* the stream starts.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = (req.body ?? {}) as {
    session_id?: string;
    user_text?: string;
    user_id?: string | null;
    model?: string;
    system_prompt?: string;
    workflow?: 'quick' | 'research';
  };

  // SSE headers. X-Accel-Buffering disables nginx buffering on
  // intermediaries — without it, events can be batched and feel choppy.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeEvent = (kind: string, data: unknown) => {
    res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let terminal: 'done' | 'error' | 'proxy_error' | null = null;
  try {
    for await (const event of runAgentProxyStream({
      session_id: body.session_id ?? '',
      user_text: body.user_text ?? '',
      user_id: body.user_id ?? null,
      model: body.model,
      system_prompt: body.system_prompt,
      workflow: body.workflow,
    })) {
      writeEvent(event.kind, event);
      if (event.kind === 'done' || event.kind === 'error' || event.kind === 'proxy_error') {
        terminal = event.kind;
        break;
      }
    }
    if (!terminal) {
      // Generator returned without yielding a terminal event — emit a
      // synthetic error so the client knows the stream ended cleanly.
      writeEvent('error', { code: 'no_terminal_event', message: 'stream ended without done/error' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeEvent('error', { code: 'internal_error', message });
  } finally {
    res.end();
  }
}
