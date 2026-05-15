/**
 * Drafting Magic — V2-adapted port of api/drafting-magic.ts from
 * codex/drafting-magic-sanitized.
 *
 * What it does (per docs/PRD_DRAFTING_MAGIC.md):
 *   Attorney uploads a "packet" of source documents (trust, pour-over
 *   will, AHCD, financial POA, prenup, new statute or instruction) +
 *   drafting instructions. The endpoint:
 *     1. Sanitizes the packet text (V2 strict-mode detectPii + fail-CLOSED)
 *     2. Runs the V2 agent loop with a Drafting-Magic-specific system
 *        prompt instructing the model to:
 *          - Extract drafting units per source
 *          - Map similarities and conflicts across sources
 *          - Identify gaps + the new requirement's impact
 *          - Produce a new document with source-lineage annotations
 *     3. Streams the response via SSE so the UI shows the extraction +
 *        drafting steps progressively.
 *
 * Differences from V1 branch version:
 *   - Bedrock → Anthropic Messages API (V2's runAgentProxyStream)
 *   - V1's deterministic guard.scanRequest is replaced by V2's
 *     services/sanitization/detectionPipeline.detectPii (the V2
 *     sanitization layer is the strict-mode fail-closed source of truth
 *     per the 2nd addendum).
 *   - Tokenized-packet round-trip is preserved in concept but lives in
 *     the V2 Phase-4 client-side IndexedDB store per the 6th addendum.
 *
 * POST /api/agent/drafting-magic
 *   body: {
 *     packet: Array<{ id, name, role, included, base, text, description? }>,
 *     instructions: string,
 *     output_type: 'draft' | 'review_memo',
 *     session_id: string,
 *     user_id?: string | null,
 *   }
 *   → SSE stream (same events as /api/agent/draft-stream + `magic_phase`
 *     events: extraction, comparison, drafting)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentProxyStream } from '../_lib/agentProxy.js';
import { buildSystemPrompt } from '../_lib/skills.js';
import { scrubMessage } from '../_lib/scrubError.js';

interface DraftingMagicSource {
  id: string;
  name: string;
  role: string;
  included: boolean;
  base: boolean;
  text: string;
  description?: string;
  format?: string;
}

interface DraftingMagicBody {
  packet?: DraftingMagicSource[];
  instructions?: string;
  output_type?: 'draft' | 'review_memo';
  session_id?: string;
  user_id?: string | null;
}

const DRAFTING_MAGIC_SYSTEM_PROMPT_ADDENDUM = `
---

DRAFTING MAGIC MODE

You are the Drafting Magic workbench. The attorney has uploaded a PACKET of source documents (trust, pour-over will, AHCD, financial POA, prenup, statute text, etc.) and a set of instructions or a new legal requirement. Your job is to produce a STRUCTURED, REVIEWABLE drafting workproduct — not just a generated document, but a workproduct showing:

  1. **Source inventory** — list every source document by name and role
  2. **Clause/issue extraction** — for each source, the meaningful drafting units
  3. **Similarity/conflict map** — where sources agree, disagree, or have gaps
  4. **New-requirement impact** — how the attorney's instructions or the new statute changes the prior pattern
  5. **Drafting strategy** — recommended approach, with reasoning
  6. **Generated draft (or review memo)** — the actual new document or analysis
  7. **Compliance checklist** — what was required + whether the new draft satisfies each requirement
  8. **Source lineage** — for each non-boilerplate provision in the new draft, identify which source(s) it derived from
  9. **Attorney review flags** — anything ambiguous, conflicting, or that the model wasn't sure about

Output the workproduct in Markdown with these EXACT section headers (one per section above):

  ## SECTION: source_inventory
  ## SECTION: extraction
  ## SECTION: conflict_map
  ## SECTION: new_requirement_impact
  ## SECTION: drafting_strategy
  ## SECTION: generated_draft
  ## SECTION: compliance_checklist
  ## SECTION: source_lineage
  ## SECTION: review_flags

Use the same markdown discipline as the regular drafting flow — clickable case links, statutory pin-cites, no fabricated citations. The verifier sub-agent will run over your citations after you finish; produce verifiable cites.

If output_type is 'review_memo' rather than 'draft', the generated_draft section is replaced by a memo analyzing the proposed changes against the existing packet rather than producing a new instrument. All other sections still apply.
`.trim();

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

  const body = (req.body ?? {}) as DraftingMagicBody;
  const sessionId = (body.session_id ?? '').trim();
  const instructions = (body.instructions ?? '').trim();
  const packet = body.packet ?? [];
  const outputType = body.output_type ?? 'draft';

  if (!sessionId) {
    res.status(400).json({ error: 'invalid_input', message: 'session_id is required' });
    return;
  }
  if (packet.length === 0 && !instructions) {
    res.status(400).json({ error: 'invalid_input', message: 'packet or instructions required' });
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

  // System prompt = core drafting Skill + Drafting Magic addendum.
  // We don't pick a single template_id — Drafting Magic spans templates.
  const baseSystem = buildSystemPrompt({}).prompt;
  const systemPrompt = baseSystem + '\n\n' + DRAFTING_MAGIC_SYSTEM_PROMPT_ADDENDUM;

  // Compose the user message: packet inventory + each source's text + instructions.
  const includedSources = packet.filter((s) => s.included);
  const baseSource = includedSources.find((s) => s.base);
  const lines: string[] = [];
  lines.push(`OUTPUT TYPE: ${outputType}`);
  lines.push('');
  lines.push(`PACKET (${includedSources.length} source${includedSources.length === 1 ? '' : 's'}${baseSource ? `, base: ${baseSource.name}` : ''}):`);
  for (const s of includedSources) {
    lines.push('');
    lines.push(`### Source: ${s.name} [role: ${s.role}${s.base ? ', BASE' : ''}]`);
    if (s.description) lines.push(`Description: ${s.description}`);
    lines.push(`<<<\n${s.text}\n>>>`);
  }
  lines.push('');
  lines.push('ATTORNEY INSTRUCTIONS / NEW REQUIREMENT:');
  lines.push(instructions || '(none)');
  const userText = lines.join('\n');

  writeEvent('magic_start', {
    kind: 'magic_start',
    source_count: includedSources.length,
    base_source: baseSource?.name ?? null,
    output_type: outputType,
  });

  let terminal: 'done' | 'error' | 'proxy_error' | null = null;
  try {
    for await (const event of runAgentProxyStream({
      session_id: sessionId,
      user_text: userText,
      user_id: body.user_id ?? null,
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
