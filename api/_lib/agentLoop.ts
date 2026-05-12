/**
 * V2 agent loop — the only code that talks to anthropic.messages.create().
 *
 * Responsibilities:
 *   1. Build the tools array via the registry (privilege-aware web_search
 *      inclusion per §E of the V2 plan).
 *   2. Invoke messages.create() with the full conversation history
 *      reconstructed from Upstash KV.
 *   3. For each assistant turn that contains tool_use blocks: dispatch
 *      each to its in-process handler, build matching tool_result
 *      blocks, append to messages, and re-invoke. Loop until
 *      stop_reason === 'end_turn' or until MAX_ITERATIONS — whichever
 *      comes first.
 *   4. Persist every message (user input, assistant turns w/ tool blocks)
 *      to the session store as append-only.
 *   5. Write an audit record per request.
 *
 * Streaming is NOT in this first cut — non-streaming is enough to prove
 * the loop. SSE streaming is layered on later, gated on a separate
 * agentLoopStream entry that shares this dispatcher.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildToolsArray, dispatchTool, type ToolUseBlock } from './tools/index.js';
import {
  appendMessage,
  readMessages,
  readToolResult,
  writeToolResult,
  touchLastActive,
  type SessionMessage,
} from './sessionStore.js';
import { buildAuditRecord, writeAuditRecord } from '../_shared/auditLog.js';
import {
  analyze,
  HIGH_RISK_CATEGORIES,
  type Span,
} from '../_shared/sanitization/index.js';
import { COMPOUND_RISK_BUCKET_THRESHOLD } from '../_shared/sanitization/compoundRisk.js';
import { buildSystemPrompt } from './skills.js';

// Anthropic's 2026-05-12 legal-industry launch cites Opus 4.7 as their
// flagship legal-reasoning model (90.9% on Harvey's BigLaw Bench). V2
// adopts it as the workbench default per the fifth addendum. Sonnet 4.6
// remains the right model for a future tier-route (fifth addendum cost-
// impact note, decision deferred to Arjun pre-Phase-4.5 shadow run).
const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_MAX_TOKENS = 4096;
const MAX_ITERATIONS = 8; // safety cap on tool-use rounds within one turn

// ---------------------------------------------------------------------------
// Tool-output sanitization wrapper (audit §8 #8 / second addendum compliance)
// ---------------------------------------------------------------------------

/**
 * Attestation produced by sanitizeToolOutput. Recorded in the per-turn audit
 * trail so a litigation hold can prove WHICH tool calls had their outputs
 * scrubbed before the model saw them.
 */
export interface ToolOutputSanitization {
  /** Number of HIGH_RISK spans redacted out of the tool's content. */
  redactions_count: number;
  /** Breakdown by SpanCategory. */
  by_category: Record<string, number>;
  /** Bucket count from the compound-risk detector (W1). */
  compound_risk_buckets: number;
  /** Whether the OR'd privileged flag fired on the tool output. */
  privileged: boolean;
}

/**
 * Sanitize a single tool result's content BEFORE it's appended to the
 * outbound `tool_result` block.
 *
 * 2026-05-10 second addendum (Sanitization scope: Inputs AND tool outputs)
 * and `docs/sanitization-audit-2026-05-10.md` §8 item #8 both require this:
 * every tool_result block runs through the same span detector that
 * processes user input. Without this, a public-records tool (CourtListener,
 * CEB) could surface a party name or address that re-identifies a
 * privileged matter — that text would then flow into the next
 * messages.create() call with no defense.
 *
 * Behavior:
 *   - Runs analyze() on the content string.
 *   - Walks detected HIGH_RISK_CATEGORIES spans from end to start (so the
 *     index shifts after substitution don't cascade) and replaces each
 *     span with a `[REDACTED:<category>]` placeholder. Destructive — the
 *     model never sees the privileged text.
 *   - Returns the sanitized content + a structured attestation for the
 *     audit record. The attestation also captures compound-risk buckets
 *     even when there's nothing to redact, because a compound-risk-only
 *     tool output is itself a flag worth recording.
 *
 * Trade-off (accepted per the second addendum): false positives on
 * tool outputs may redact legitimately-public identifiers — e.g., a case
 * caption "People v. Smith" could have "Smith" detected as a single-word
 * name. The model will see "People v. [REDACTED:name]." Better than
 * leaking, and the user can ask for clarification if needed.
 */
export function sanitizeToolOutput(
  content: string,
): { content: string; attestation: ToolOutputSanitization | null } {
  if (!content || typeof content !== 'string') {
    return { content: content ?? '', attestation: null };
  }
  const result = analyze(content);
  const highRisk = result.spans.filter((s: Span) => HIGH_RISK_CATEGORIES.has(s.category));
  const compoundBuckets = result.compoundRiskBuckets ?? 0;

  if (highRisk.length === 0 && compoundBuckets < COMPOUND_RISK_BUCKET_THRESHOLD) {
    return { content, attestation: null };
  }

  // Sort spans from highest start index to lowest so index-based slice
  // substitution doesn't shift the indexes of subsequent spans.
  const sorted = [...highRisk].sort((a, b) => b.start - a.start);
  let redacted = content;
  for (const span of sorted) {
    redacted =
      redacted.slice(0, span.start) +
      `[REDACTED:${span.category}]` +
      redacted.slice(span.end);
  }

  const byCategory: Record<string, number> = {};
  for (const span of highRisk) {
    byCategory[span.category] = (byCategory[span.category] ?? 0) + 1;
  }

  return {
    content: redacted,
    attestation: {
      redactions_count: highRisk.length,
      by_category: byCategory,
      compound_risk_buckets: compoundBuckets,
      privileged: Boolean(result.privileged),
    },
  };
}

export interface RunTurnOptions {
  session_id: string;
  /** The attorney's input text (already sanitized — agentProxy handles that). */
  user_text: string;
  /**
   * True when the input contains compound-risk or HIGH_RISK_CATEGORIES
   * spans. Controls whether web_search is included in the tools array.
   */
  privileged: boolean;
  /** Sanitization attestation for the audit record + turn-snapshot. */
  sanitization: {
    privileged: boolean;
    compound_risk_buckets: number;
    redactions_count: number;
    by_category: Record<string, number>;
  };
  /** Optional model override (defaults to claude-sonnet-4-6). */
  model?: string;
  /** Optional system prompt. Defaults to the V2 CA legal-research prompt. */
  system_prompt?: string;
  /** Optional turn-id (sequence). Defaults to a generated stable id. */
  turn_id?: string;
  /** Optional Clerk user id for the audit record. */
  user_id?: string | null;
  /** Optional Anthropic SDK instance — tests inject a fake. */
  anthropic_client?: Anthropic;
}

export interface RunTurnResult {
  /** The final assistant text rendered to the user, with all tool_use rounds resolved. */
  final_text: string;
  /** Number of tool dispatch rounds executed (0 if the model answered directly). */
  tool_rounds: number;
  /** Total input + output tokens across all rounds in this turn. */
  total_tokens: number;
  /** End-to-end wall-clock for the turn. */
  elapsed_ms: number;
  /** Stop reason from the final assistant message. */
  stop_reason: string;
  /** True if MAX_ITERATIONS was hit (the model is still trying to use tools). */
  exhausted_iterations: boolean;
  /**
   * Total count of HIGH_RISK spans redacted from tool outputs during this
   * turn (audit §8 #8 / 2026-05-10 second addendum compliance). 0 when no
   * tool surfaced privileged-looking content.
   */
  tool_output_redactions: number;
  /** Per-category breakdown of tool-output redactions. */
  tool_output_redactions_by_category: Record<string, number>;
  /** How many tool outputs had their privileged flag fire. */
  tool_outputs_privileged_count: number;
}

// System prompt content was extracted into agents/california-legal/skills/*.md
// per the 2026-05-12 fifth addendum portability principle. Composed at
// request time by `buildSystemPrompt()` from `./skills.ts` so we can
// load by workflow / intent rather than concatenating every skill into
// every turn. The loader has a built-in fallback if the agents/ tree
// isn't on disk (e.g., a stripped deployment), so this code path never
// dies on a missing file.

/** Build a stable turn id. Format: t_{epoch_ms}_{rand}. */
function newTurnId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Coerce SessionMessage[] into Anthropic's MessageParam[] shape. */
function toAnthropicMessages(history: SessionMessage[]): Anthropic.Messages.MessageParam[] {
  return history.map(
    (m) => ({ role: m.role, content: m.content }) as Anthropic.Messages.MessageParam,
  );
}

function extractTextFromAssistantBlocks(
  blocks: Anthropic.Messages.ContentBlock[],
): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text') parts.push(b.text);
  }
  return parts.join('\n');
}

function extractToolUses(blocks: Anthropic.Messages.ContentBlock[]): ToolUseBlock[] {
  const out: ToolUseBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'tool_use') {
      out.push({
        type: 'tool_use',
        id: b.id,
        name: b.name,
        input: (b.input ?? {}) as Record<string, unknown>,
      });
    }
  }
  return out;
}

async function dispatchWithCache(
  sessionId: string,
  use: ToolUseBlock,
): Promise<{
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  /** Sanitization attestation. null when no spans/buckets fired. */
  sanitization: ToolOutputSanitization | null;
}> {
  const cached = await readToolResult(sessionId, use.id).catch(() => null);
  if (cached) {
    // Cached results are already sanitized (we wrote the sanitized form
    // back to cache below). Re-emit them WITHOUT re-running analyze() —
    // doing so would double-redact placeholders like "[REDACTED:name]"
    // which contain the substring "name" and could trigger spurious
    // false positives. Trust the cache contract.
    return {
      tool_use_id: use.id,
      content: typeof cached.result === 'string' ? cached.result : JSON.stringify(cached.result),
      sanitization: null, // already-sanitized cache hit; no new attestation
    };
  }

  const raw = await dispatchTool(use);
  const rawContent = typeof raw.content === 'string' ? raw.content : JSON.stringify(raw.content);

  // 2026-05-10 second-addendum mandate / audit §8 #8 — every tool_result
  // block runs through the same span detector as user input. Destructive
  // redaction (HIGH_RISK_CATEGORIES → [REDACTED:<category>]) before the
  // model sees it.
  const { content: sanitizedContent, attestation } = sanitizeToolOutput(rawContent);

  // Cache the SANITIZED content, not the raw. If we cached raw and only
  // sanitized at emit time, the second time we read from cache we'd
  // bypass the wrapper. Storing the sanitized form makes the cache
  // contract self-enforcing: anything that comes out is already safe.
  await writeToolResult(sessionId, {
    tool_use_id: use.id,
    name: use.name,
    input: use.input,
    result: sanitizedContent,
    hash: simpleHash(sanitizedContent),
    written_at: new Date().toISOString(),
  }).catch(() => {
    // Idempotency cache write failure is non-fatal; the tool already ran.
  });

  return {
    tool_use_id: raw.tool_use_id,
    content: sanitizedContent,
    is_error: raw.is_error,
    sanitization: attestation,
  };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

/**
 * Run ONE turn (user message → assistant final answer). Handles any
 * number of tool-use rounds internally up to MAX_ITERATIONS. Returns
 * the final assistant text and round telemetry.
 */
export async function runTurn(opts: RunTurnOptions): Promise<RunTurnResult> {
  const t0 = performance.now();
  const turnId = opts.turn_id ?? newTurnId();
  const model = opts.model ?? DEFAULT_MODEL;
  const systemPrompt =
    opts.system_prompt ?? buildSystemPrompt({ user_text: opts.user_text }).prompt;
  const client =
    opts.anthropic_client ??
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? undefined });

  // ── 1. Persist the user turn first so a crash mid-loop leaves an
  //       auditable trace.
  const existing = await readMessages(opts.session_id).catch(() => [] as SessionMessage[]);
  const nextSequence = existing.length;

  const userMessage: SessionMessage = {
    role: 'user',
    content: opts.user_text, // string content is shorthand for [{ type: 'text', text }]
    turn_id: turnId,
    sequence: nextSequence,
    appended_at: new Date().toISOString(),
    sanitization: opts.sanitization,
  };
  await appendMessage(opts.session_id, userMessage);

  // ── 2. Build the tools array (privilege-gated web_search).
  const tools = buildToolsArray(opts.privileged) as unknown as Anthropic.Messages.Tool[];

  // ── 3. Loop: call messages.create → if assistant emitted tool_use,
  //       dispatch and append tool_result, loop again. Cap at
  //       MAX_ITERATIONS.
  let totalTokens = 0;
  let toolRounds = 0;
  let stopReason = 'unknown';
  let finalText = '';
  let exhausted = false;
  // Tool-output sanitization accumulators (audit §8 #8 compliance).
  let toolOutputRedactions = 0;
  const toolOutputByCategory: Record<string, number> = {};
  let toolOutputsPrivilegedCount = 0;

  // Build the rolling history we send to the SDK on each iteration.
  let history: SessionMessage[] = [...existing, userMessage];

  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    const messages = toAnthropicMessages(history);
    const response = await client.messages.create({
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools,
    });

    if (response.usage) {
      totalTokens +=
        (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);
    }
    stopReason = response.stop_reason ?? 'unknown';

    // Persist the assistant turn (with whatever blocks it emitted).
    const assistantMessage: SessionMessage = {
      role: 'assistant',
      content: response.content,
      turn_id: turnId,
      sequence: nextSequence + 1 + 2 * iter,
      appended_at: new Date().toISOString(),
    };
    await appendMessage(opts.session_id, assistantMessage);
    history = [...history, assistantMessage];

    const toolUses = extractToolUses(response.content);

    if (toolUses.length === 0) {
      finalText = extractTextFromAssistantBlocks(response.content);
      break;
    }

    // Dispatch each tool_use; collect tool_result blocks into one
    // synthetic "user" message per Anthropic's convention.
    toolRounds += 1;
    const toolResults = await Promise.all(
      toolUses.map((use) => dispatchWithCache(opts.session_id, use)),
    );

    // Accumulate tool-output sanitization telemetry across the turn.
    for (const tr of toolResults) {
      if (!tr.sanitization) continue;
      toolOutputRedactions += tr.sanitization.redactions_count;
      for (const [cat, n] of Object.entries(tr.sanitization.by_category)) {
        toolOutputByCategory[cat] = (toolOutputByCategory[cat] ?? 0) + n;
      }
      if (tr.sanitization.privileged) toolOutputsPrivilegedCount += 1;
    }

    const toolResultUserMessage: SessionMessage = {
      role: 'user',
      content: toolResults.map((tr) => ({
        type: 'tool_result',
        tool_use_id: tr.tool_use_id,
        content: tr.content,
        ...(tr.is_error ? { is_error: true } : {}),
      })),
      turn_id: turnId,
      sequence: nextSequence + 2 + 2 * iter,
      appended_at: new Date().toISOString(),
    };
    await appendMessage(opts.session_id, toolResultUserMessage);
    history = [...history, toolResultUserMessage];

    if (iter === MAX_ITERATIONS - 1) {
      exhausted = true;
    }
  }

  if (!finalText && exhausted) {
    finalText =
      'I reached the maximum number of tool-use rounds without converging on an answer. Try narrowing the question or asking again.';
  }

  // ── 4. Touch session meta + write audit record.
  await touchLastActive(opts.session_id).catch(() => {
    // non-fatal
  });

  const elapsedMs = performance.now() - t0;
  const auditWarnings: string[] = [];
  if (toolOutputRedactions > 0) {
    auditWarnings.push(`tool_output_redactions:${toolOutputRedactions}`);
  }
  if (toolOutputsPrivilegedCount > 0) {
    auditWarnings.push(`tool_outputs_privileged:${toolOutputsPrivilegedCount}`);
  }
  await writeAuditRecord(
    buildAuditRecord({
      route: 'agent_loop',
      sanitizedPrompt: opts.user_text,
      flowType: opts.privileged ? 'accuracy_client' : 'public_research',
      userId: opts.user_id ?? null,
      model,
      sourceProviders: tools
        .map((t: { name?: string }) => t.name)
        .filter((n): n is string => typeof n === 'string'),
      latencyMs: Math.round(elapsedMs),
      statusCode: 200,
      warningFlags: auditWarnings.length > 0 ? auditWarnings : undefined,
    }),
  );

  return {
    final_text: finalText,
    tool_rounds: toolRounds,
    total_tokens: totalTokens,
    elapsed_ms: elapsedMs,
    stop_reason: stopReason,
    exhausted_iterations: exhausted,
    tool_output_redactions: toolOutputRedactions,
    tool_output_redactions_by_category: toolOutputByCategory,
    tool_outputs_privileged_count: toolOutputsPrivilegedCount,
  };
}

// ---------------------------------------------------------------------------
// Streaming variant — async generator that yields events as they happen
// ---------------------------------------------------------------------------

/**
 * Events emitted by runTurnStream. The SSE route serializes these to
 * `event: <kind>\ndata: <json>\n\n` lines on the wire. Headless callers
 * just iterate the generator.
 */
export type TurnStreamEvent =
  | { kind: 'token'; text: string }
  | { kind: 'tool_use_start'; tool_use_id: string; name: string; round: number }
  | { kind: 'tool_use_input'; tool_use_id: string; input: unknown }
  | {
      kind: 'tool_result';
      tool_use_id: string;
      name: string;
      is_error: boolean;
      elapsed_ms: number;
      /** Count of HIGH_RISK spans redacted from this tool's output, if any.
       *  Surfaces tool-output sanitization decisions to the UI. */
      output_redactions_count?: number;
      /** Compound-risk buckets detected in this tool's output. */
      output_compound_risk_buckets?: number;
    }
  | { kind: 'iteration'; round: number }
  | { kind: 'done'; result: RunTurnResult }
  | { kind: 'error'; code: string; message: string };

/**
 * Same contract as runTurn but yields events as they arrive. The model's
 * text deltas surface immediately as 'token' events so the UI can paint
 * partial output during the multi-second inference. Tool dispatch happens
 * between iteration boundaries; tool events surface as `tool_use_start`
 * (with name) → `tool_result` (with timing) so the UI can render a
 * "Searching CEB…" affordance.
 *
 * Keeps runTurn (non-streaming) as a separate function so headless
 * integrations don't have to consume an async generator. Persistence,
 * audit, and dispatch logic are deliberately duplicated rather than
 * abstracted — both functions are small and readable side-by-side.
 */
export async function* runTurnStream(
  opts: RunTurnOptions,
): AsyncGenerator<TurnStreamEvent, void, void> {
  const t0 = performance.now();
  const turnId = opts.turn_id ?? newTurnId();
  const model = opts.model ?? DEFAULT_MODEL;
  const systemPrompt =
    opts.system_prompt ?? buildSystemPrompt({ user_text: opts.user_text }).prompt;
  const client =
    opts.anthropic_client ??
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? undefined });

  const existing = await readMessages(opts.session_id).catch(
    () => [] as SessionMessage[],
  );
  const nextSequence = existing.length;

  const userMessage: SessionMessage = {
    role: 'user',
    content: opts.user_text,
    turn_id: turnId,
    sequence: nextSequence,
    appended_at: new Date().toISOString(),
    sanitization: opts.sanitization,
  };
  await appendMessage(opts.session_id, userMessage);

  const tools = buildToolsArray(opts.privileged) as unknown as Anthropic.Messages.Tool[];

  let totalTokens = 0;
  let toolRounds = 0;
  let stopReason = 'unknown';
  let finalText = '';
  let exhausted = false;
  // Tool-output sanitization accumulators (audit §8 #8 compliance).
  let toolOutputRedactions = 0;
  const toolOutputByCategory: Record<string, number> = {};
  let toolOutputsPrivilegedCount = 0;
  let history: SessionMessage[] = [...existing, userMessage];

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
      yield { kind: 'iteration', round: iter + 1 };

      const messages = toAnthropicMessages(history);
      const stream = client.messages.stream({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      });

      // Track tool_use blocks as they're announced via content_block_start
      // so the UI can render an affordance immediately, before the full
      // input JSON has been built up.
      const announcedToolUses = new Map<number, { id: string; name: string }>();

      for await (const event of stream) {
        if (
          event.type === 'content_block_start' &&
          event.content_block?.type === 'tool_use'
        ) {
          const tu = event.content_block;
          announcedToolUses.set(event.index, { id: tu.id, name: tu.name });
          yield {
            kind: 'tool_use_start',
            tool_use_id: tu.id,
            name: tu.name,
            round: iter + 1,
          };
        } else if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          if (event.delta.text) {
            yield { kind: 'token', text: event.delta.text };
          }
        }
      }

      const finalMsg = await stream.finalMessage();
      if (finalMsg.usage) {
        totalTokens +=
          (finalMsg.usage.input_tokens ?? 0) +
          (finalMsg.usage.output_tokens ?? 0);
      }
      stopReason = finalMsg.stop_reason ?? 'unknown';

      // Persist this assistant turn (full content block array).
      const assistantMessage: SessionMessage = {
        role: 'assistant',
        content: finalMsg.content,
        turn_id: turnId,
        sequence: nextSequence + 1 + 2 * iter,
        appended_at: new Date().toISOString(),
      };
      await appendMessage(opts.session_id, assistantMessage);
      history = [...history, assistantMessage];

      const toolUses = extractToolUses(finalMsg.content);
      if (toolUses.length === 0) {
        finalText = extractTextFromAssistantBlocks(finalMsg.content);
        break;
      }

      toolRounds += 1;

      // Emit the now-resolved tool_use inputs (after stream finalization
      // we have the full input JSON, not just the partial deltas).
      for (const use of toolUses) {
        yield {
          kind: 'tool_use_input',
          tool_use_id: use.id,
          input: use.input,
        };
      }

      // Dispatch each tool with timing for the per-tool result event.
      const dispatched: Array<{
        tool_use_id: string;
        name: string;
        content: string;
        is_error?: boolean;
        elapsed_ms: number;
      }> = [];
      for (const use of toolUses) {
        const dt0 = performance.now();
        const result = await dispatchWithCache(opts.session_id, use);
        const elapsed = performance.now() - dt0;
        // Tool-output sanitization telemetry (audit §8 #8 compliance).
        if (result.sanitization) {
          toolOutputRedactions += result.sanitization.redactions_count;
          for (const [cat, n] of Object.entries(result.sanitization.by_category)) {
            toolOutputByCategory[cat] = (toolOutputByCategory[cat] ?? 0) + n;
          }
          if (result.sanitization.privileged) toolOutputsPrivilegedCount += 1;
        }
        yield {
          kind: 'tool_result',
          tool_use_id: result.tool_use_id,
          name: use.name,
          is_error: Boolean(result.is_error),
          elapsed_ms: elapsed,
          output_redactions_count: result.sanitization?.redactions_count,
          output_compound_risk_buckets: result.sanitization?.compound_risk_buckets,
        };
        dispatched.push({
          tool_use_id: result.tool_use_id,
          name: use.name,
          content: result.content,
          is_error: result.is_error,
          elapsed_ms: elapsed,
        });
      }

      const toolResultUserMessage: SessionMessage = {
        role: 'user',
        content: dispatched.map((tr) => ({
          type: 'tool_result',
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          ...(tr.is_error ? { is_error: true } : {}),
        })),
        turn_id: turnId,
        sequence: nextSequence + 2 + 2 * iter,
        appended_at: new Date().toISOString(),
      };
      await appendMessage(opts.session_id, toolResultUserMessage);
      history = [...history, toolResultUserMessage];

      if (iter === MAX_ITERATIONS - 1) exhausted = true;
    }

    if (!finalText && exhausted) {
      finalText =
        'I reached the maximum number of tool-use rounds without converging on an answer. Try narrowing the question or asking again.';
    }

    await touchLastActive(opts.session_id).catch(() => {
      /* non-fatal */
    });

    const elapsedMs = performance.now() - t0;
    const auditWarnings: string[] = [];
    if (toolOutputRedactions > 0) {
      auditWarnings.push(`tool_output_redactions:${toolOutputRedactions}`);
    }
    if (toolOutputsPrivilegedCount > 0) {
      auditWarnings.push(`tool_outputs_privileged:${toolOutputsPrivilegedCount}`);
    }
    await writeAuditRecord(
      buildAuditRecord({
        route: 'agent_loop_stream',
        sanitizedPrompt: opts.user_text,
        flowType: opts.privileged ? 'accuracy_client' : 'public_research',
        userId: opts.user_id ?? null,
        model,
        sourceProviders: tools
          .map((t: { name?: string }) => t.name)
          .filter((n): n is string => typeof n === 'string'),
        latencyMs: Math.round(elapsedMs),
        statusCode: 200,
        warningFlags: auditWarnings.length > 0 ? auditWarnings : undefined,
      }),
    );

    yield {
      kind: 'done',
      result: {
        final_text: finalText,
        tool_rounds: toolRounds,
        total_tokens: totalTokens,
        elapsed_ms: elapsedMs,
        stop_reason: stopReason,
        exhausted_iterations: exhausted,
        tool_output_redactions: toolOutputRedactions,
        tool_output_redactions_by_category: toolOutputByCategory,
        tool_outputs_privileged_count: toolOutputsPrivilegedCount,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { kind: 'error', code: 'inference_error', message };
  }
}
