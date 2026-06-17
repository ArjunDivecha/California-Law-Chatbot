/**
 * Per-section drafting revision endpoint.
 *
 * POST /api/agent/revise-section
 *   body: {
 *     template_id, section_id, current_text, revision_instructions,
 *     variables, full_context (other sections for context),
 *     session_id, user_id?
 *   }
 *
 * Same SSE event shape as draft-stream but scoped to a SINGLE section.
 * The model receives:
 *   - the drafting Skill for the template (so it knows the format)
 *   - the section's current text
 *   - the attorney's revision instructions
 *   - other sections as context (so cross-references stay consistent)
 *
 * Output: ONLY the replacement content for that one section. No `##
 * SECTION: <id>` header — the client knows which section it asked
 * about and slots the response in.
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

interface ReviseBody {
  template_id?: string;
  section_id?: string;
  section_name?: string;
  current_text?: string;
  revision_instructions?: string;
  variables?: Record<string, string>;
  full_context?: string;
  session_id?: string;
  user_id?: string | null;
  user_allowlist?: string[];
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
  const body = (req.body ?? {}) as ReviseBody;
  const templateId = (body.template_id ?? '').trim();
  const sectionId = (body.section_id ?? '').trim();
  const sessionId = (body.session_id ?? '').trim();
  if (!templateId || !sectionId || !sessionId || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'invalid_input', message: 'template_id, section_id, session_id required' });
    return;
  }
  const access = await assertSessionAccess(sessionId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: 'forbidden', message: access.message });
    return;
  }
  const cfg = getAgentConfig();
  const draftingSkills = cfg.drafting_skills ?? {};
  if (!draftingSkills[templateId]) {
    res.status(400).json({ error: 'invalid_template_id' });
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

  // Build a SECTION-SCOPED system prompt: load the drafting Skill +
  // override the output contract so the model emits ONLY the replacement
  // section content (no SECTION header, no preamble).
  const baseSystem = buildSystemPrompt({ template_id: templateId }).prompt;
  const sectionScope = `\n\n---\n\nSECTION REVISION MODE\n\nYou are revising ONE section of a document the attorney already drafted. Output rules:\n  - Return ONLY the replacement body content for section "${sectionId}". No section header marker. No preamble. No closing summary. No "##" headings.\n  - Maintain consistency with the other sections (provided as context below). Cross-references must still resolve.\n  - Apply the attorney's revision instructions faithfully. If the instructions conflict with the Skill's structural requirements, prioritize the attorney.\n  - Do NOT touch any other section.\n\nKeep the response tight — at most ${sectionId === 'analysis' || sectionId === 'mpa_argument' ? '~2000' : '~500'} words.`;
  const systemPrompt = baseSystem + sectionScope;

  const userText = [
    `TEMPLATE: ${templateId}`,
    `SECTION: ${sectionId}${body.section_name ? ` (${body.section_name})` : ''}`,
    'VARIABLES:',
    ...Object.entries(body.variables ?? {}).map(([k, v]) => `  ${k}: ${v}`),
    '',
    'CURRENT SECTION TEXT:',
    body.current_text ?? '(empty)',
    '',
    'OTHER SECTIONS (for context — do not modify):',
    body.full_context ?? '(none)',
    '',
    'REVISION INSTRUCTIONS:',
    body.revision_instructions ?? 'Improve this section.',
  ].join('\n');

  writeEvent('revise_start', { kind: 'revise_start', template_id: templateId, section_id: sectionId });

  let terminal: 'done' | 'error' | 'proxy_error' | null = null;
  try {
    for await (const event of runAgentProxyStream({
      session_id: sessionId,
      user_text: userText,
      user_id: userId,
      user_allowlist: body.user_allowlist,
      system_prompt: systemPrompt,
    })) {
      writeEvent(event.kind, event);
      if (event.kind === 'done' || event.kind === 'error' || event.kind === 'proxy_error') {
        terminal = event.kind;
        break;
      }
    }
    if (!terminal) {
      writeEvent('error', { code: 'no_terminal_event', message: 'stream ended without done/error' });
    }
  } catch (err) {
    writeEvent('error', { code: 'internal_error', message: scrubMessage(err instanceof Error ? err.message : String(err)) });
  } finally {
    res.end();
  }
}
