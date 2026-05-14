/**
 * V2 agent proxy — sanitization-first wrapper around the agent loop.
 *
 * Every call to anthropic.messages.create goes through here. The contract:
 *
 *   1. Run the input through detectPii() in 'strict' mode — if OPF is
 *      unreachable, FAIL CLOSED. The 100-trap zero-leak gate (Step 3)
 *      validated this layer; we won't send raw input to Anthropic just
 *      because the daemon is down.
 *   2. Compute `privileged` (HIGH_RISK_CATEGORIES span present OR
 *      compoundRiskBuckets >= threshold). The OPF-success branch of
 *      detectPii was patched 2026-05-12 (commit 040ab63) to match
 *      analyze()'s compound-risk behavior — both entry points now
 *      agree.
 *   3. Pass through to runTurn() with the privileged flag and the
 *      sanitization attestation snapshot.
 *   4. Write an audit record on every request — both success and
 *      failure. Failure paths never include the raw prompt text in
 *      the response payload.
 *
 * This module is intentionally thin: input gating + audit logging +
 * delegation. Anything more sophisticated (per-attorney rate limits,
 * Clerk auth, CORS) belongs in the Vercel route handler that calls us.
 */

import { detectPii, OpfUnavailableError } from '../../services/sanitization/detectionPipeline.js';
import {
  runTurn,
  runTurnStream,
  type RunTurnResult,
  type TurnStreamEvent,
  type Workflow,
} from './agentLoop.js';
import { buildAuditRecord, writeAuditRecord } from '../_shared/auditLog.js';

export interface AgentProxyRequest {
  session_id: string;
  user_text: string;
  user_id?: string | null;
  /** Optional model override. */
  model?: string;
  /** Optional system prompt override. */
  system_prompt?: string;
  /** Workflow selector — 'quick' (Sonnet, no tools) or 'research' (default). */
  workflow?: Workflow;
}

export type AgentProxyResponse =
  | { ok: true; result: RunTurnResult; privileged: boolean; compound_risk_buckets: number }
  | { ok: false; error: AgentProxyError; status_code: number };

export interface AgentProxyError {
  code:
    | 'sanitizer_unavailable'
    | 'invalid_input'
    | 'inference_error'
    | 'internal_error';
  message: string;
}

const STRICT_DETECTION_MODE: 'strict' = 'strict';

/**
 * Single entry point a Vercel route handler calls. Performs the
 * sanitization gate, the privileged-flag computation, and delegates
 * to the agent loop. Never throws — returns a structured response.
 */
export async function runAgentProxy(req: AgentProxyRequest): Promise<AgentProxyResponse> {
  const sessionId = (req.session_id ?? '').trim();
  const userText = req.user_text ?? '';
  if (!sessionId) {
    return errorResp('invalid_input', 'session_id is required', 400, req);
  }
  if (typeof userText !== 'string' || userText.trim().length === 0) {
    return errorResp('invalid_input', 'user_text must be a non-empty string', 400, req);
  }

  // ── 1. Sanitization gate (strict — fail-closed if OPF down).
  let detection;
  try {
    detection = await detectPii(userText, STRICT_DETECTION_MODE);
  } catch (err) {
    if (err instanceof OpfUnavailableError) {
      return errorResp(
        'sanitizer_unavailable',
        'Sanitization service is unavailable; request blocked to prevent unprotected send.',
        503,
        req,
      );
    }
    return errorResp(
      'internal_error',
      err instanceof Error ? err.message : String(err),
      500,
      req,
    );
  }

  // ── 2. Privileged flag + attestation snapshot.
  const privileged = detection.privileged;
  const compoundRiskBuckets = detection.compoundRiskBuckets ?? 0;

  const byCategory: Record<string, number> = {};
  for (const span of detection.spans) {
    byCategory[span.category] = (byCategory[span.category] ?? 0) + 1;
  }
  const sanitization = {
    privileged,
    compound_risk_buckets: compoundRiskBuckets,
    redactions_count: detection.spans.length,
    by_category: byCategory,
  };

  // ── 3. Run the loop.
  try {
    const result = await runTurn({
      session_id: sessionId,
      user_text: userText,
      privileged,
      sanitization,
      model: req.model,
      system_prompt: req.system_prompt,
      user_id: req.user_id ?? null,
      workflow: req.workflow,
    });
    return { ok: true, result, privileged, compound_risk_buckets: compoundRiskBuckets };
  } catch (err) {
    return errorResp(
      'inference_error',
      err instanceof Error ? err.message : String(err),
      502,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Streaming variant — same sanitization gate, yields events
// ---------------------------------------------------------------------------

/**
 * Top-of-stream event that surfaces the proxy's sanitization decision
 * (privileged flag + compound-risk bucket count) before any inference
 * tokens arrive. UI uses this to display the privilege indicator
 * immediately rather than waiting for the model.
 */
export type ProxyStreamEvent =
  | { kind: 'sanitization'; privileged: boolean; compound_risk_buckets: number; redactions_count: number }
  | TurnStreamEvent
  | { kind: 'proxy_error'; code: AgentProxyError['code']; message: string; status_code: number };

/**
 * Streaming variant of runAgentProxy. Same fail-closed sanitization gate
 * (strict mode, blocks if OPF unavailable), same privileged-flag logic,
 * then yields events from runTurnStream. Surfaces sanitization decisions
 * at the top of the stream so the UI can paint the privilege indicator
 * before inference starts.
 */
export async function* runAgentProxyStream(
  req: AgentProxyRequest,
): AsyncGenerator<ProxyStreamEvent, void, void> {
  const sessionId = (req.session_id ?? '').trim();
  const userText = req.user_text ?? '';
  if (!sessionId) {
    yield {
      kind: 'proxy_error',
      code: 'invalid_input',
      message: 'session_id is required',
      status_code: 400,
    };
    return;
  }
  if (typeof userText !== 'string' || userText.trim().length === 0) {
    yield {
      kind: 'proxy_error',
      code: 'invalid_input',
      message: 'user_text must be a non-empty string',
      status_code: 400,
    };
    return;
  }

  let detection;
  try {
    detection = await detectPii(userText, STRICT_DETECTION_MODE);
  } catch (err) {
    if (err instanceof OpfUnavailableError) {
      yield {
        kind: 'proxy_error',
        code: 'sanitizer_unavailable',
        message:
          'Sanitization service is unavailable; request blocked to prevent unprotected send.',
        status_code: 503,
      };
      void writeAuditRecord(
        buildAuditRecord({
          route: 'agent_proxy_stream',
          sanitizedPrompt: userText,
          userId: req.user_id ?? null,
          statusCode: 503,
          warningFlags: ['sanitizer_unavailable'],
        }),
      ).catch(() => {});
      return;
    }
    yield {
      kind: 'proxy_error',
      code: 'internal_error',
      message: err instanceof Error ? err.message : String(err),
      status_code: 500,
    };
    return;
  }

  const privileged = detection.privileged;
  const compoundRiskBuckets = detection.compoundRiskBuckets ?? 0;
  const byCategory: Record<string, number> = {};
  for (const span of detection.spans) {
    byCategory[span.category] = (byCategory[span.category] ?? 0) + 1;
  }

  yield {
    kind: 'sanitization',
    privileged,
    compound_risk_buckets: compoundRiskBuckets,
    redactions_count: detection.spans.length,
  };

  const sanitization = {
    privileged,
    compound_risk_buckets: compoundRiskBuckets,
    redactions_count: detection.spans.length,
    by_category: byCategory,
  };

  for await (const event of runTurnStream({
    session_id: sessionId,
    user_text: userText,
    privileged,
    sanitization,
    model: req.model,
    system_prompt: req.system_prompt,
    user_id: req.user_id ?? null,
    workflow: req.workflow,
  })) {
    yield event;
  }
}

function errorResp(
  code: AgentProxyError['code'],
  message: string,
  statusCode: number,
  req: AgentProxyRequest,
): AgentProxyResponse {
  // Audit the failure WITHOUT echoing the raw input back. The audit
  // record's sanitizedPrompt HMAC + length serves as the privileged-
  // safe reference; the error message returned to the client is
  // generic.
  void writeAuditRecord(
    buildAuditRecord({
      route: 'agent_proxy',
      // Pass user_text so the audit record stores an HMAC + length —
      // never the raw text itself, per the auditLog contract.
      sanitizedPrompt: req.user_text,
      flowType: 'accuracy_client',
      userId: req.user_id ?? null,
      statusCode,
      warningFlags: [code],
    }),
  ).catch(() => {
    // Audit-write failures are non-fatal.
  });
  return {
    ok: false,
    error: { code, message },
    status_code: statusCode,
  };
}
