/**
 * Phase 4.5 shadow run endpoint.
 *
 * V1 (main branch, production) fires this fire-and-forget after each
 * chat turn. V2 runs the SAME agent loop on the SAME input — but
 * doesn't stream back to the user. The user sees V1's answer only;
 * V2 writes a "shadow audit record" containing its own answer + tool
 * trace + sanitization metadata. Comparison happens out-of-band via
 * scripts/shadow-run-report.mjs.
 *
 * POST /api/agent/shadow
 *   body: {
 *     v1_session_id: string,    // V1's chat id
 *     v1_turn_id?: string,      // V1's turn id if available
 *     user_text: string,        // the actual prompt the attorney sent
 *     v1_response_text?: string,// V1's answer (for delta computation)
 *     v1_source_count?: number, // V1's source count
 *     user_id?: string | null,  // Clerk user id of the attorney
 *   }
 *   → 202 Accepted (immediate, BEFORE the V2 agent loop completes)
 *
 * The endpoint:
 *   1. Validates input
 *   2. Returns 202 immediately so V1 doesn't block
 *   3. Spawns the agent loop asynchronously
 *   4. On completion: writes shadow:{v1_session_id}:{v1_turn_id} record
 *      to Upstash KV with V1+V2 sides side-by-side
 *
 * Per §6 Option C: NO raw query text in audit; HMAC + length only.
 * The shadow record is gated on V2 reaching production and runs
 * exclusively under firm-API-key billing.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentProxy } from '../_lib/agentProxy.js';
import { Redis } from '@upstash/redis';
import { createHmac } from 'node:crypto';

interface ShadowBody {
  v1_session_id?: string;
  v1_turn_id?: string;
  user_text?: string;
  v1_response_text?: string;
  v1_source_count?: number;
  user_id?: string | null;
}

function redis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function hmacHex(s: string): string {
  const key = process.env.AUDIT_HMAC_KEY ?? 'fallback-dev-key';
  return createHmac('sha256', key).update(s).digest('hex');
}

interface ShadowAuditRecord {
  v1_session_id: string;
  v1_turn_id: string;
  user_id: string | null;
  shadow_run_at: string;
  user_text_hmac: string;
  user_text_len: number;
  v1: {
    response_len: number | null;
    response_hmac: string | null;
    source_count: number | null;
  };
  v2: {
    response_len: number;
    response_hmac: string;
    tool_rounds: number;
    total_tokens: number;
    elapsed_ms: number;
    stop_reason: string;
    exhausted_iterations: boolean;
    sanitization: {
      privileged: boolean;
      compound_risk_buckets: number;
      redactions_count: number;
    };
    tool_output_redactions: number;
  };
  /** Computed deltas for at-a-glance comparison. */
  delta: {
    response_len_diff: number | null;
    same_privileged_assessment: boolean | null;
  };
}

async function runShadow(body: ShadowBody): Promise<void> {
  const v1SessionId = body.v1_session_id ?? 'unknown';
  const v1TurnId = body.v1_turn_id ?? `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userText = body.user_text ?? '';

  try {
    const v2 = await runAgentProxy({
      session_id: `shadow_${v1SessionId}_${v1TurnId}`,
      user_text: userText,
      user_id: body.user_id ?? null,
    });
    if (v2.ok === false) {
      // Write a failure-shaped record so we can still see V1/V2 mismatches
      // even when V2 errored.
      await writeRecord({
        v1_session_id: v1SessionId,
        v1_turn_id: v1TurnId,
        user_id: body.user_id ?? null,
        shadow_run_at: new Date().toISOString(),
        user_text_hmac: hmacHex(userText),
        user_text_len: userText.length,
        v1: {
          response_len: body.v1_response_text?.length ?? null,
          response_hmac: body.v1_response_text ? hmacHex(body.v1_response_text) : null,
          source_count: body.v1_source_count ?? null,
        },
        v2: {
          response_len: 0,
          response_hmac: '',
          tool_rounds: 0,
          total_tokens: 0,
          elapsed_ms: 0,
          stop_reason: `error:${v2.error.code}`,
          exhausted_iterations: false,
          sanitization: { privileged: false, compound_risk_buckets: 0, redactions_count: 0 },
          tool_output_redactions: 0,
        },
        delta: {
          response_len_diff: null,
          same_privileged_assessment: null,
        },
      });
      return;
    }

    const rec: ShadowAuditRecord = {
      v1_session_id: v1SessionId,
      v1_turn_id: v1TurnId,
      user_id: body.user_id ?? null,
      shadow_run_at: new Date().toISOString(),
      user_text_hmac: hmacHex(userText),
      user_text_len: userText.length,
      v1: {
        response_len: body.v1_response_text?.length ?? null,
        response_hmac: body.v1_response_text ? hmacHex(body.v1_response_text) : null,
        source_count: body.v1_source_count ?? null,
      },
      v2: {
        response_len: v2.result.final_text.length,
        response_hmac: hmacHex(v2.result.final_text),
        tool_rounds: v2.result.tool_rounds,
        total_tokens: v2.result.total_tokens,
        elapsed_ms: Math.round(v2.result.elapsed_ms),
        stop_reason: v2.result.stop_reason,
        exhausted_iterations: v2.result.exhausted_iterations,
        sanitization: {
          privileged: v2.privileged,
          compound_risk_buckets: v2.compound_risk_buckets,
          redactions_count: 0, // computed from v2.result if needed
        },
        tool_output_redactions: v2.result.tool_output_redactions,
      },
      delta: {
        response_len_diff:
          body.v1_response_text != null
            ? v2.result.final_text.length - body.v1_response_text.length
            : null,
        same_privileged_assessment: null, // V1 doesn't expose this signal
      },
    };
    await writeRecord(rec);
  } catch {
    // Shadow failures are non-fatal — never affects the user.
  }
}

async function writeRecord(rec: ShadowAuditRecord): Promise<void> {
  try {
    const r = redis();
    const key = `shadow:${rec.v1_session_id}:${rec.v1_turn_id}`;
    // 14-day TTL — long enough for a 1-week shadow + buffer.
    await r.set(key, JSON.stringify(rec), { ex: 14 * 24 * 60 * 60 });
    // Per-user-per-day index for the report script to query.
    const day = rec.shadow_run_at.slice(0, 10); // YYYY-MM-DD
    const userId = rec.user_id ?? 'unknown';
    await r.zadd(`shadow_index:${userId}:${day}`, {
      score: Date.parse(rec.shadow_run_at),
      member: key,
    });
    await r.expire(`shadow_index:${userId}:${day}`, 14 * 24 * 60 * 60);
  } catch {
    // KV-write failures are non-fatal.
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const body = (req.body ?? {}) as ShadowBody;
  if (!body.user_text || typeof body.user_text !== 'string') {
    res.status(400).json({ error: 'invalid_input', message: 'user_text required' });
    return;
  }
  if (!body.v1_session_id || typeof body.v1_session_id !== 'string') {
    res.status(400).json({ error: 'invalid_input', message: 'v1_session_id required' });
    return;
  }

  // Respond 202 IMMEDIATELY. The actual agent loop runs in the
  // background — V1 must not block on shadow processing.
  res.status(202).json({ ok: true, message: 'shadow run accepted' });

  // Fire-and-forget. Don't await — the response has already flushed.
  void runShadow(body);
}
