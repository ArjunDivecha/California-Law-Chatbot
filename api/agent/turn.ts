/**
 * V2 agent turn — thin Vercel route handler around runAgentProxy.
 *
 * POST /api/agent/turn
 *   body: { session_id, user_text, user_id? }
 *
 * Auth, CORS, rate-limiting, etc. live in this file (Phase 1 stub —
 * proper Clerk auth wiring follows in Phase 4). The route is intentionally
 * stateless: all session state lives in Upstash KV via sessionStore.
 *
 * Streaming is not in this first cut — SSE wrapper lands in a follow-up
 * commit and shares the same proxy. This non-streaming endpoint stays
 * available for headless integrations.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentProxy } from '../_lib/agentProxy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

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
  };

  const result = await runAgentProxy({
    session_id: body.session_id ?? '',
    user_text: body.user_text ?? '',
    user_id: body.user_id ?? null,
    model: body.model,
    system_prompt: body.system_prompt,
  });

  if (result.ok === false) {
    res.status(result.status_code).json({ error: result.error });
    return;
  }
  res.status(200).json({
    final_text: result.result.final_text,
    tool_rounds: result.result.tool_rounds,
    total_tokens: result.result.total_tokens,
    elapsed_ms: Math.round(result.result.elapsed_ms),
    stop_reason: result.result.stop_reason,
    privileged: result.privileged,
    compound_risk_buckets: result.compound_risk_buckets,
  });
}
