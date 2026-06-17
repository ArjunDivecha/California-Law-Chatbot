/**
 * V2 drafting endpoint — SSE streaming.
 *
 * POST /api/agent/draft-stream
 *   body: {
 *     template_id: 'legal_memo' | 'demand_letter' | 'client_letter' | 'motion_compel',
 *     variables: Record<string, string>,
 *     user_instructions: string,
 *     options?: {
 *       citationStyle?: 'california' | 'bluebook',
 *       maxLength?: 'short' | 'medium' | 'long',
 *       tone?: 'formal' | 'persuasive' | 'neutral',
 *       includeTableOfAuthorities?: boolean,
 *     },
 *     session_id: string,
 *     user_id?: string | null,
 *   }
 *
 * Same SSE event shape as /api/agent/turn-stream. The drafting Skill
 * (loaded by buildSystemPrompt({ template_id })) instructs the model to
 * emit `## SECTION: <id>` headers, so the client can detect section
 * boundaries from the token stream — no separate `section` event type
 * is required.
 *
 * The first user message is a structured representation of the template
 * variables + the attorney's free-text instructions. The sanitizer runs
 * on that combined string before any inference — if the attorney's
 * inputs contain PII, web_search is omitted from the tools array (same
 * §E privilege-gate as the chat path).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentProxyStream } from '../_lib/agentProxy.js';
import { buildSystemPrompt, getAgentConfig } from '../_lib/skills.js';
import { scrubMessage } from '../_lib/scrubError.js';
import {
  handlePreflight,
  applyCors,
  requireUser,
  checkRateLimit,
  assertSessionAccess,
  isValidSessionId,
} from '../_lib/httpGuard.js';

interface DraftStreamBody {
  template_id?: string;
  variables?: Record<string, string>;
  user_instructions?: string;
  options?: Record<string, unknown>;
  session_id?: string;
  user_id?: string | null;
  model?: string;
}

function formatUserText(body: DraftStreamBody): string {
  const lines: string[] = [];
  lines.push(`TEMPLATE: ${body.template_id ?? ''}`);
  lines.push('VARIABLES:');
  const vars = body.variables ?? {};
  for (const [k, v] of Object.entries(vars)) {
    lines.push(`  ${k}: ${v}`);
  }
  if (body.options && Object.keys(body.options).length > 0) {
    lines.push('OPTIONS:');
    for (const [k, v] of Object.entries(body.options)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (body.user_instructions && body.user_instructions.trim().length > 0) {
    lines.push('USER INSTRUCTIONS:');
    lines.push(body.user_instructions.trim());
  }
  return lines.join('\n');
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

  const body = (req.body ?? {}) as DraftStreamBody;
  const templateId = (body.template_id ?? '').trim();
  const sessionId = (body.session_id ?? '').trim();

  // Validate template_id against the agent config's drafting_skills map.
  const cfg = getAgentConfig();
  const draftingSkills = cfg.drafting_skills ?? {};
  if (!templateId || !draftingSkills[templateId]) {
    res.status(400).json({
      error: 'invalid_template_id',
      message: `template_id must be one of: ${Object.keys(draftingSkills).join(', ') || '(none configured)'}`,
    });
    return;
  }
  if (!sessionId || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'invalid_session_id', message: 'session_id is required' });
    return;
  }
  const access = await assertSessionAccess(sessionId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: 'forbidden', message: access.message });
    return;
  }

  // SSE headers BEFORE any res.write.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeEvent = (kind: string, data: unknown) => {
    res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Compose the drafting system prompt from the template_id.
  const systemPrompt = buildSystemPrompt({ template_id: templateId }).prompt;
  const userText = formatUserText(body);

  // Emit a small `template` event up-front so the UI knows which template
  // is rendering before any tokens arrive.
  writeEvent('template', {
    kind: 'template',
    template_id: templateId,
    skill_loaded: draftingSkills[templateId],
  });

  // Per-template expected section IDs — used for the post-completion
  // quality_warning event. These match the section_id values the
  // drafting Skills are instructed to emit. Keeping the list here (not
  // in the Skill files) so the parser owns its own contract.
  const EXPECTED_SECTIONS: Record<string, string[]> = {
    legal_memo: ['header', 'question_presented', 'brief_answer', 'facts', 'analysis', 'conclusion'],
    demand_letter: ['letterhead', 'introduction', 'factual_background', 'legal_basis', 'demand', 'consequences', 'closing'],
    client_letter: ['letterhead', 'introduction', 'facts_summary', 'legal_analysis', 'options', 'next_steps', 'closing'],
    motion_compel: ['caption', 'notice_of_motion', 'mpa_introduction', 'mpa_facts', 'mpa_argument', 'mpa_prayer', 'declaration', 'separate_statement', 'pos_reference', 'signature'],
  };
  const expected = EXPECTED_SECTIONS[templateId] ?? [];
  let accumulatedText = '';

  let terminal: 'done' | 'error' | 'proxy_error' | null = null;
  try {
    for await (const event of runAgentProxyStream({
      session_id: sessionId,
      user_text: userText,
      user_id: userId,
      model: body.model,
      system_prompt: systemPrompt,
    })) {
      // Accumulate token text so we can run a completeness check at the
      // end. Cheap — sum the deltas as they pass through.
      if (event.kind === 'token' && typeof (event as { text?: unknown }).text === 'string') {
        accumulatedText += (event as { text: string }).text;
      }
      writeEvent(event.kind, event);
      if (event.kind === 'done' || event.kind === 'error' || event.kind === 'proxy_error') {
        terminal = event.kind;
        // After `done` (a successful loop completion), validate the
        // response against the template's expected-section list. Emit
        // `quality_warning` when the model emitted a too-short
        // response or skipped sections. Non-terminal — clients can
        // choose to retry or surface a banner.
        if (event.kind === 'done' && expected.length > 0) {
          const wordCount = accumulatedText.split(/\s+/).filter((w) => w.length > 0).length;
          const emittedSections = new Set(
            [...accumulatedText.matchAll(/## SECTION: (\w+)/g)].map((m) => m[1]),
          );
          const missingSections = expected.filter((s) => !emittedSections.has(s));
          const SHORT_THRESHOLD = 300; // a complete draft is always > 300 words
          const issues: string[] = [];
          if (wordCount < SHORT_THRESHOLD) issues.push('short_response');
          if (missingSections.length > 0) issues.push('missing_sections');
          if (issues.length > 0) {
            writeEvent('quality_warning', {
              kind: 'quality_warning',
              issues,
              word_count: wordCount,
              missing_sections: missingSections,
              expected_section_count: expected.length,
              emitted_section_count: emittedSections.size,
            });
          }
        }
        break;
      }
    }
    if (!terminal) {
      writeEvent('error', {
        code: 'no_terminal_event',
        message: 'stream ended without done/error',
      });
    }
  } catch (err) {
    const message = scrubMessage(err instanceof Error ? err.message : String(err));
    writeEvent('error', { code: 'internal_error', message });
  } finally {
    res.end();
  }
}
