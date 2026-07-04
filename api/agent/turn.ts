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
import { acquireLock, releaseLock } from '../_lib/sessionStore.js';
import {
  handlePreflight,
  applyCors,
  requireUser,
  checkRateLimit,
  assertSessionAccess,
  isValidSessionId,
} from '../_lib/httpGuard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const userId = await requireUser(req, res);
  if (!userId) return;
  const rl = await checkRateLimit(userId);
  if (!rl.ok) {
    res.status(rl.status).json({ error: 'rate_limited', message: rl.message });
    return;
  }

  const body = (req.body ?? {}) as {
    session_id?: string;
    user_text?: string;
    model?: string;
    system_prompt?: string;
    user_allowlist?: string[];
  };

  const sessionId = (body.session_id ?? '').trim();
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'invalid_session_id' });
    return;
  }
  const access = await assertSessionAccess(sessionId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: 'forbidden', message: access.message });
    return;
  }

  // Single-flight lock — same guard as turn-stream (code-review fix C3):
  // concurrent turns interleave Redis appends and corrupt tool_use/
  // tool_result pairing. TTL auto-expiry prevents a wedged session.
  const locked = await acquireLock(sessionId);
  if (!locked) {
    res.status(409).json({
      error: 'turn_in_flight',
      message: 'A turn is already running on this session. Wait for it to finish and try again.',
    });
    return;
  }

  let result;
  try {
    result = await runAgentProxy({
      session_id: sessionId,
      user_text: body.user_text ?? '',
      user_id: userId,
      model: body.model,
      system_prompt: body.system_prompt,
      user_allowlist: body.user_allowlist,
    });
  } finally {
    await releaseLock(sessionId).catch(() => {});
  }

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
    refusal: result.result.refusal,
    truncated: result.result.truncated,
    privileged: result.privileged,
    compound_risk_buckets: result.compound_risk_buckets,
  });
}
