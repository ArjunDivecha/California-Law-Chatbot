/**
 * =============================================================================
 * Draft citation-QC SSE endpoint — api/agent/draft-qc.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Automatic quality-control pass over a completed draft, section by
 *   section. For each named section it extracts every case citation and
 *   statute citation, verifies each one through the citation-verifier
 *   sub-agent (CourtListener + official statute sources — the same
 *   verifier behind /api/agent/verify-stream), and streams per-citation
 *   verdicts tagged with their section id. The client aggregates verdicts
 *   into per-section clean/flagged badges and offers a "Fix flagged"
 *   action that regenerates only the flagged sections.
 *
 *   Pattern credit: the flag-by-key → revise-only-flagged loop from the
 *   Apache-2.0 AI-Blueprint project (adopted 2026-07-24), grafted onto
 *   AskPauli's existing verifier + section machinery. The attorney stays
 *   in the loop: QC flags, a human clicks fix, and revised sections come
 *   back marked "Needs review" — nothing is silently rewritten.
 *
 * POST /api/agent/draft-qc
 *   body: {
 *     session_id: string,
 *     sections: Array<{ section_id: string, title?: string, text: string }>,
 *     user_allowlist?: string[],
 *   }
 *
 * SSE events:
 *   manifest — { sections: [{section_id, citation_count}], total_citations,
 *               skipped } (skipped = citations over the per-run cap,
 *               reported explicitly — no silent drop)
 *   verdict  — { section_id, citation, citation_type, status
 *               ('real'|'fake'|'ambiguous'|'error'), confidence?,
 *               reasoning?, case_name?, match_url?, elapsed_ms? }
 *   summary  — { sections: [{section_id, status ('clean'|'flagged'|
 *               'no_citations'), issue_count}], verified, fake, ambiguous,
 *               errors, total, skipped, elapsed_ms }
 *   error    — terminal failure
 *
 * Latency: ~18s per citation (sequential by design — the sub-agent runs
 * its own multi-round tool calls). The per-run citation cap keeps a QC
 * pass bounded; the client renders progressive badges so the attorney
 * can keep reading while QC fills in.
 *
 * Guards: Clerk auth, per-user rate limit, session ownership, size caps,
 * and the fail-closed server-side PII regex backstop (sections arrive
 * tokenized from the client; the backstop catches tokenizer bugs).
 *
 * INPUT FILES:  none. OUTPUT FILES: none (audit flows through the
 * verifier's own instrumentation).
 * =============================================================================
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCitations } from '../_lib/tools/citationVerify.js';
import { extractStatuteCitations } from '../_lib/tools/statuteVerify.js';
import { verifyCitationViaSubAgent } from '../_lib/verifierSubAgent.js';
import {
  detectPiiServerBackstop,
  RawInputDetectedError,
} from '../../services/sanitization/detectionPipeline.js';
import { scrubMessage } from '../_lib/scrubError.js';
import {
  handlePreflight,
  applyCors,
  requireUser,
  checkRateLimit,
  assertSessionAccess,
  isValidSessionId,
} from '../_lib/httpGuard.js';

const MAX_SECTIONS = 40;
const MAX_SECTION_CHARS = 40_000;
const MAX_TOTAL_CHARS = 200_000;
/** Per-run verification cap. Each citation is an ~18s sub-agent run. */
const MAX_CITATIONS = 15;

interface QcSectionIn {
  section_id?: string;
  title?: string;
  text?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
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
    sections?: QcSectionIn[];
    user_allowlist?: string[];
  };
  const sessionId = (body.session_id ?? '').trim();
  if (!sessionId || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'invalid_input', message: 'session_id required' });
    return;
  }
  const access = await assertSessionAccess(sessionId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: 'forbidden', message: access.message });
    return;
  }

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const sections = rawSections
    .map((s) => ({
      section_id: String(s.section_id ?? '').trim(),
      title: String(s.title ?? '').trim(),
      text: String(s.text ?? ''),
    }))
    .filter((s) => s.section_id && s.text.trim().length > 0);
  if (sections.length === 0) {
    res.status(400).json({ error: 'invalid_input', message: 'sections[] required' });
    return;
  }
  if (sections.length > MAX_SECTIONS) {
    res.status(400).json({ error: 'invalid_input', message: `max ${MAX_SECTIONS} sections` });
    return;
  }
  let totalChars = 0;
  for (const s of sections) {
    if (s.text.length > MAX_SECTION_CHARS) {
      res.status(400).json({
        error: 'invalid_input',
        message: `section "${s.section_id}" exceeds ${MAX_SECTION_CHARS} character limit`,
      });
      return;
    }
    totalChars += s.text.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    res.status(400).json({ error: 'invalid_input', message: `total text exceeds ${MAX_TOTAL_CHARS} characters` });
    return;
  }

  // Fail-closed server-side PII backstop over every section body.
  const userAllow = new Set(
    (Array.isArray(body.user_allowlist) ? body.user_allowlist : [])
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean),
  );
  const joined = sections.map((s) => s.text).join('\n\n');
  const detection = detectPiiServerBackstop(joined, userAllow);
  if (detection.spans.length > 0) {
    const cats = Array.from(new Set(detection.spans.map((s) => s.category)));
    const err = new RawInputDetectedError(cats, detection.spans.length);
    res.status(503).json({ error: 'sanitizer_unavailable', message: err.message });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const writeEvent = (kind: string, data: unknown) => {
    res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Sentence context for statute cites (same trick as verify-stream) so
  // the verifier can content-match the asserted proposition.
  const sentenceFor = (text: string, needle: string): string => {
    const idx = text.indexOf(needle);
    if (idx === -1) return needle;
    const start = Math.max(text.lastIndexOf('.', idx) + 1, text.lastIndexOf('\n', idx) + 1);
    let end = text.indexOf('.', idx + needle.length);
    if (end === -1) end = text.length;
    return text.slice(start, end + 1).trim() || needle;
  };

  try {
    type Extracted = {
      section_id: string;
      display: string;
      query: string;
      type: 'case' | 'statute';
    };
    const allExtracted: Extracted[] = [];
    const perSectionCounts: Array<{ section_id: string; citation_count: number }> = [];
    for (const s of sections) {
      const cases = extractCitations(s.text).map((c) => ({
        section_id: s.section_id,
        display: c.text,
        query: c.text,
        type: 'case' as const,
      }));
      const statutes = extractStatuteCitations(s.text).map((st) => ({
        section_id: s.section_id,
        display: st.raw,
        query: sentenceFor(s.text, st.raw),
        type: 'statute' as const,
      }));
      perSectionCounts.push({ section_id: s.section_id, citation_count: cases.length + statutes.length });
      allExtracted.push(...cases, ...statutes);
    }

    const extracted = allExtracted.slice(0, MAX_CITATIONS);
    const skipped = allExtracted.length - extracted.length;
    writeEvent('manifest', {
      kind: 'manifest',
      sections: perSectionCounts,
      total_citations: extracted.length,
      total_found: allExtracted.length,
      skipped,
    });

    const t0 = performance.now();
    let verified = 0;
    let fake = 0;
    let ambiguous = 0;
    let errors = 0;
    const issueCount = new Map<string, number>();

    for (let i = 0; i < extracted.length; i += 1) {
      const c = extracted[i];
      try {
        const verdict = await verifyCitationViaSubAgent(c.query);
        if (verdict.status === 'real') verified += 1;
        else if (verdict.status === 'fake') {
          fake += 1;
          issueCount.set(c.section_id, (issueCount.get(c.section_id) ?? 0) + 1);
        } else {
          ambiguous += 1;
          issueCount.set(c.section_id, (issueCount.get(c.section_id) ?? 0) + 1);
        }
        writeEvent('verdict', {
          kind: 'verdict',
          index: i,
          section_id: c.section_id,
          citation: c.display,
          citation_type: verdict.citation_type ?? c.type,
          status: verdict.status,
          case_name: verdict.case_name,
          match_url: verdict.match_url,
          confidence: verdict.confidence,
          reasoning: verdict.reasoning,
          elapsed_ms: verdict.elapsed_ms,
        });
      } catch (err) {
        // Verifier crash = 'error', surfaced but NOT auto-fixable — the
        // attorney sees "unverified", never a silent pass. (No deterministic
        // fallback by policy: FAIL IS FAIL.)
        errors += 1;
        writeEvent('verdict', {
          kind: 'verdict',
          index: i,
          section_id: c.section_id,
          citation: c.display,
          citation_type: c.type,
          status: 'error',
          error: scrubMessage(err instanceof Error ? err.message : String(err)),
        });
      }
    }

    writeEvent('summary', {
      kind: 'summary',
      sections: perSectionCounts.map((s) => ({
        section_id: s.section_id,
        status:
          s.citation_count === 0
            ? 'no_citations'
            : (issueCount.get(s.section_id) ?? 0) > 0
              ? 'flagged'
              : 'clean',
        issue_count: issueCount.get(s.section_id) ?? 0,
      })),
      verified,
      fake,
      ambiguous,
      errors,
      total: extracted.length,
      skipped,
      elapsed_ms: Math.round(performance.now() - t0),
    });
  } catch (err) {
    writeEvent('error', {
      code: 'internal_error',
      message: scrubMessage(err instanceof Error ? err.message : String(err)),
    });
  } finally {
    res.end();
  }
}
