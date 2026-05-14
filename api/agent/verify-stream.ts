/**
 * Citation verification SSE endpoint.
 *
 * POST /api/agent/verify-stream
 *   body: { text: string, session_id?: string, user_id?: string | null }
 *
 * Pipeline:
 *   1. Extract every case-citation from the input text (reporter patterns
 *      + full "Name v. Name (year) Reporter" patterns).
 *   2. Emit a `manifest` event with the extracted citation list so the
 *      UI can render a placeholder row per citation up-front.
 *   3. For each citation, call verifyCitationViaSubAgent and emit a
 *      `verdict` event with {citation, status, case_name?, match_url?,
 *      reasoning, confidence, elapsed_ms}. Run sequentially — the
 *      sub-agent does its own multi-round tool calls, so parallel
 *      calls would saturate the Anthropic API rate-limit fast.
 *   4. Emit `done` when all citations have a verdict.
 *
 * Latency note: ~18s/citation median (Phase 3 baseline). A 10-cite
 * passage takes ~3 min. The UI shows progressive rows so the wait is
 * tolerable. Not suitable for inline-on-every-turn verification; this
 * is an attorney-triggered workflow.
 *
 * Per plan §Phase 3: "Adversarial verification as a SEPARATE agent-loop
 * invocation. Separate conversation per verification run, fresh
 * messages array, no shared context with workbench." This endpoint
 * spawns a fresh sub-agent per citation — no session persistence,
 * nothing in Upstash KV.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCitations } from '../_lib/tools/citationVerify.js';
import { verifyCitationViaSubAgent } from '../_lib/verifierSubAgent.js';

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

  const body = (req.body ?? {}) as {
    text?: string;
  };

  const text = (body.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'invalid_input', message: 'text is required' });
    return;
  }

  // SSE headers before any write.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeEvent = (kind: string, data: unknown) => {
    res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const extracted = extractCitations(text);
    writeEvent('manifest', {
      kind: 'manifest',
      citation_count: extracted.length,
      citations: extracted.map((c) => c.text),
    });

    if (extracted.length === 0) {
      writeEvent('done', {
        kind: 'done',
        verified: 0,
        fake: 0,
        ambiguous: 0,
        total: 0,
        elapsed_ms: 0,
      });
      res.end();
      return;
    }

    const t0 = performance.now();
    let verifiedCount = 0;
    let fakeCount = 0;
    let ambiguousCount = 0;

    for (let i = 0; i < extracted.length; i += 1) {
      const c = extracted[i];
      try {
        const verdict = await verifyCitationViaSubAgent(c.text);
        if (verdict.status === 'real') verifiedCount += 1;
        else if (verdict.status === 'fake') fakeCount += 1;
        else ambiguousCount += 1;
        writeEvent('verdict', {
          kind: 'verdict',
          index: i,
          citation: c.text,
          status: verdict.status,
          case_name: verdict.case_name,
          match_url: verdict.match_url,
          confidence: verdict.confidence,
          reasoning: verdict.reasoning,
          tool_rounds: verdict.tool_rounds,
          elapsed_ms: verdict.elapsed_ms,
        });
      } catch (err) {
        // Sub-agent crash counts as error, not fake — surface separately.
        writeEvent('verdict', {
          kind: 'verdict',
          index: i,
          citation: c.text,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    writeEvent('done', {
      kind: 'done',
      verified: verifiedCount,
      fake: fakeCount,
      ambiguous: ambiguousCount,
      total: extracted.length,
      elapsed_ms: Math.round(performance.now() - t0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeEvent('error', { code: 'internal_error', message });
  } finally {
    res.end();
  }
}
