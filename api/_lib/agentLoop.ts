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
import {
  buildToolsArray,
  buildMcpServers,
  dispatchTool,
  type ToolUseBlock,
} from './tools/index.js';
import {
  appendMessage,
  readMessages,
  readMeta,
  writeMeta,
  readToolResult,
  writeToolResult,
  touchLastActive,
  indexUserSession,
  type SessionMessage,
} from './sessionStore.js';
import { buildAuditRecord, writeAuditRecord } from '../_shared/auditLog.js';
import {
  analyze,
  HIGH_RISK_CATEGORIES,
  type Span,
} from '../_shared/sanitization/index.js';
import { COMPOUND_RISK_BUCKET_THRESHOLD } from '../_shared/sanitization/compoundRisk.js';
import { buildSystemPrompt, getAgentConfig } from './skills.js';
import { scrubMessage } from './scrubError.js';

// Primary engine for Research/Draft workflows. Defaults to Claude Fable 5
// (flagship), overridable per-environment via V2_PRIMARY_MODEL in Vercel
// so Opus<->Fable can be flipped without a code change/redeploy. Quick
// mode and the citation verifier stay on Sonnet 4.6 (see workflow branches
// below + verifierSubAgent.ts). Prior default was claude-opus-4-7 (fifth
// addendum); switched to Fable 5 per Arjun 2026-06-12.
const DEFAULT_MODEL = process.env.V2_PRIMARY_MODEL ?? 'claude-fable-5';

// ── Automatic model failover (authorized by Arjun 2026-06-16) ──────────────
// If the primary engine is unavailable on this account — the Anthropic API
// returns HTTP 404 not_found_error, e.g. "Claude Fable 5 is not available.
// Please use Opus 4.8." — transparently retry on this fallback instead of
// erroring the whole turn. Both are Anthropic models on the SAME Messages API
// under the SAME Team-plan retention posture, so failover does NOT alter the
// data-handling / zero-leak invariant (this is why it is allowed, whereas a
// cross-PROVIDER fallback would not be). Override per-environment with
// V2_FALLBACK_MODEL. NOTE: this is unavailability failover, NOT refusal
// fallback — a stop_reason='refusal' is still surfaced and never retried.
const FALLBACK_MODEL = process.env.V2_FALLBACK_MODEL ?? 'claude-opus-4-8';
// Process-lifetime memo of models this account can't reach, so a warm function
// instance skips a dead primary after the first 404 rather than paying the
// failed round-trip on every subsequent turn.
const unavailableModels = new Set<string>();

/** Swap a known-unavailable model for the fallback. Never loops the fallback. */
function resolveModel(requested: string): string {
  if (requested !== FALLBACK_MODEL && unavailableModels.has(requested)) return FALLBACK_MODEL;
  return requested;
}

/**
 * True when an Anthropic SDK error means "this model isn't available to you"
 * (HTTP 404 / not_found_error) — the Messages endpoint returns 404 for an
 * unknown or un-entitled model id — as opposed to a transient transport error.
 */
function isModelUnavailableError(err: unknown): boolean {
  const e = err as { status?: number; error?: { type?: string }; message?: unknown };
  if (e?.status === 404) return true;
  if (e?.error?.type === 'not_found_error') return true;
  const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return msg.includes('not_found_error') || (msg.includes('not available') && msg.includes('model'));
}

const DEFAULT_MAX_TOKENS = 4096;
/**
 * Default safety cap on tool-use rounds within one turn. Overridden at
 * runtime by agents/california-legal/agent.json `max_iterations` (Phase 2:
 * motion_compel-class drafts legitimately need ~12 rounds for citation
 * verification). The agent-config value is read via getAgentConfig()
 * inside runTurn / runTurnStream.
 */
const DEFAULT_MAX_ITERATIONS = 8;

/** Beta header for the MCP connector — 2026-05-12 fifth addendum. */
const MCP_BETA_HEADER = 'mcp-client-2025-11-20';

/**
 * Source summary attached to each tool_result event so the V2 chat UI
 * can render a Sources panel below the assistant message. Per-tool
 * shapes are normalized into a single union.
 */
export interface ToolSourceSummary {
  tool_name: string;
  source_type: 'ceb' | 'courtlistener' | 'legiscan' | 'openstates' | 'citation_verify' | 'ca_code' | 'web' | 'unknown';
  title: string;
  detail?: string;
  url?: string;
  /** For citation_verify: 'verified' | 'not_found' | 'unverified' */
  status?: string;
}

/**
 * Parse the JSON-stringified tool output into 0-N normalized source
 * summaries. Best-effort — failures return []. Caps at first 5 per
 * tool to keep SSE event payloads compact.
 */
function summarizeToolOutputForSources(toolName: string, raw: string): ToolSourceSummary[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!body || typeof body !== 'object') return [];
  const out: ToolSourceSummary[] = [];
  const LIMIT = 5;
  if (toolName === 'ceb_search') {
    const hits = (body as { hits?: Array<Record<string, unknown>> }).hits ?? [];
    for (const h of hits.slice(0, LIMIT)) {
      const meta = (h.metadata ?? {}) as Record<string, unknown>;
      // CEB hits don't have a clean title field — derive one from
      // metadata.source_file (pdf basename) and metadata.category.
      const sourceFile = String(meta.source_file ?? '');
      const cleaned = sourceFile
        .replace(/\.pdf$/i, '')
        .replace(/^california_/i, '')
        .replace(/_[0-9]+_[0-9]+/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const niceTitle = cleaned
        ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
        : 'CEB practice guide';
      const category = String(meta.category ?? '').replace(/_/g, ' ');
      const score = typeof h.score === 'number' ? h.score.toFixed(2) : '';
      const detailParts: string[] = [];
      if (category) detailParts.push(`category: ${category}`);
      if (score) detailParts.push(`score: ${score}`);
      out.push({
        tool_name: toolName,
        source_type: 'ceb',
        title: niceTitle,
        detail: detailParts.join(' · ') || undefined,
        url: typeof meta.url === 'string' ? meta.url : undefined,
      });
    }
  } else if (toolName === 'courtlistener_search') {
    const hits = (body as { hits?: Array<Record<string, unknown>> }).hits ?? [];
    for (const h of hits.slice(0, LIMIT)) {
      out.push({
        tool_name: toolName,
        source_type: 'courtlistener',
        title: String(h.case_name ?? 'Case'),
        detail: [h.court, h.date_filed, h.citation].filter(Boolean).join(' · '),
        url: typeof h.absolute_url === 'string' ? h.absolute_url : undefined,
      });
    }
  } else if (toolName === 'legiscan_search') {
    const hits = (body as { hits?: Array<Record<string, unknown>> }).hits ?? [];
    for (const h of hits.slice(0, LIMIT)) {
      out.push({
        tool_name: toolName,
        source_type: 'legiscan',
        title: `${h.bill_number ?? ''} — ${h.title ?? ''}`.trim(),
        detail: String(h.status ?? h.last_action ?? ''),
        url: typeof h.url === 'string' ? h.url : undefined,
      });
    }
  } else if (toolName === 'openstates_search') {
    const hits = (body as { hits?: Array<Record<string, unknown>> }).hits ?? [];
    for (const h of hits.slice(0, LIMIT)) {
      out.push({
        tool_name: toolName,
        source_type: 'openstates',
        title: `${h.identifier ?? ''} — ${h.title ?? ''}`.trim(),
        detail: String(h.latest_action_description ?? ''),
        url: typeof h.openstates_url === 'string' ? h.openstates_url : undefined,
      });
    }
  } else if (toolName === 'california_code_lookup') {
    const hits = (body as { hits?: Array<Record<string, unknown>> }).hits ?? [];
    for (const h of hits.slice(0, LIMIT)) {
      out.push({
        tool_name: toolName,
        source_type: 'ca_code',
        title: `${h.code_full_name ?? ''} § ${h.section ?? ''}`.trim(),
        detail: String(h.raw_match ?? '') || undefined,
        url: typeof h.url === 'string' ? h.url : undefined,
      });
    }
  } else if (toolName === 'citation_verify') {
    const cits = (body as { citations?: Array<Record<string, unknown>> }).citations ?? [];
    for (const c of cits.slice(0, LIMIT)) {
      const m = (c.courtlistener_match ?? {}) as Record<string, unknown>;
      out.push({
        tool_name: toolName,
        source_type: 'citation_verify',
        title: String(c.text ?? 'citation'),
        detail: String(m.case_name ?? '') || undefined,
        url: typeof m.url === 'string' ? m.url : undefined,
        status: String(c.status ?? ''),
      });
    }
  }
  return out;
}

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
/**
 * Tool-output fields whose VALUES are public-record case captions and
 * should be exempt from `name`-category redaction. Task #71 fix: case
 * party names in CourtListener / citation_verify hits aren't privileged
 * client data — they're indexed public-record case-law. Redacting them
 * to `[REDACTED:name]` breaks the model's verification feedback loop
 * and produces broken Sources panels.
 *
 * Other HIGH_RISK categories (ssn, phone, etc.) STILL get redacted even
 * inside these fields — only `name` is exempted, and only inside these
 * specific fields. Privileged content the model received from a tool
 * still gets redacted everywhere else.
 */
const CAPTION_SAFE_FIELDS: Readonly<string[]> = [
  'case_name',
  'caseName',
  'caption',
  'caseTitle',
  'title', // for citation_verify entries whose top-level "text" is the cited case
  'text',  // citation_verify's `citations[].text` field is "Name v. Name (year) Reporter"
];

/**
 * Find byte ranges within a JSON string that correspond to values of
 * known case-caption fields. Returns sorted, non-overlapping ranges
 * where `name`-category spans should NOT be redacted.
 *
 * Implementation: regex over the raw JSON looking for `"field":"value"`
 * patterns. Imperfect for values containing escaped quotes (rare in
 * tool output), but safe-fallback is "redact normally" — i.e., the worst
 * case is we redact a case caption we could have left alone, which is
 * the pre-fix behavior. Never increases leak risk.
 */
function findCaptionSafeRanges(content: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const field of CAPTION_SAFE_FIELDS) {
    // Match: "field":"<value>" — value is non-greedy, terminated by an
    // unescaped quote. Captures the inner value's byte range.
    const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const valueStart = m.index + m[0].indexOf('"', m[0].indexOf(':')) + 1;
      const valueEnd = valueStart + m[1].length;
      ranges.push({ start: valueStart, end: valueEnd });
    }
  }
  // Sort + merge overlapping
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function spanInsideAnyRange(
  span: Span,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  for (const r of ranges) {
    if (span.start >= r.start && span.end <= r.end) return true;
  }
  return false;
}

export function sanitizeToolOutput(
  content: string,
  options?: { toolName?: string },
): { content: string; attestation: ToolOutputSanitization | null } {
  if (!content || typeof content !== 'string') {
    return { content: content ?? '', attestation: null };
  }
  const result = analyze(content);
  const highRiskRaw = result.spans.filter((s: Span) => HIGH_RISK_CATEGORIES.has(s.category));
  const compoundBuckets = result.compoundRiskBuckets ?? 0;

  // Task #71 — for tool outputs whose results contain public-record case
  // captions, exempt the `name` category from redaction when the span
  // falls inside a known caption field. Applies to case-law-shaped tools
  // (courtlistener_search, citation_verify) and CEB which sometimes
  // surfaces case names. Other categories (ssn/phone/etc.) still get
  // redacted everywhere.
  const captionAware = options?.toolName === 'courtlistener_search' ||
    options?.toolName === 'citation_verify' ||
    options?.toolName === 'ceb_search';
  const safeRanges = captionAware ? findCaptionSafeRanges(content) : [];
  const highRisk = captionAware
    ? highRiskRaw.filter((s) => !(s.category === 'name' && spanInsideAnyRange(s, safeRanges)))
    : highRiskRaw;

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

/**
 * Workflow selector — surfaces in V2 chat as a top-of-page button row.
 * - 'quick'    — Sonnet 4.6, NO tools, terse direct answer. Cheap + fast.
 * - 'research' — Opus 4.7 + full tool set. Default. Current behavior.
 *   (Draft and Verify workflows redirect to their own routes; they don't
 *    flow through this enum.)
 */
export type Workflow = 'quick' | 'research';

export interface RunTurnOptions {
  session_id: string;
  /** The attorney's input text (already sanitized — agentProxy handles that). */
  user_text: string;
  /** Workflow mode for this turn (default 'research'). */
  workflow?: Workflow;
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

export interface TurnRefusal {
  /** Refusal category from Anthropic stop_details (e.g. a safety topic). */
  category?: string;
  /** Human-readable explanation from stop_details. */
  explanation?: string;
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
  /**
   * Set when stop_reason === 'refusal'. Single-engine policy: SURFACE the
   * refusal (never fall back to another model); the UI shows category +
   * explanation and lets the attorney revise. undefined on a normal turn.
   */
  refusal?: TurnRefusal;
  /** True when stop_reason === 'max_tokens' (the answer was truncated). */
  truncated: boolean;
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

/**
 * After a user turn lands, update the per-user session index + write a
 * derived title on the first turn (so the sidebar has something readable
 * to display). Non-fatal — failures just degrade the sidebar UX, never
 * the agent loop.
 *
 * Title = first 80 chars of the user text with newlines collapsed.
 * Subsequent turns don't overwrite the title (first message wins —
 * matches how most chat UIs derive a thread title).
 */
async function registerSessionForUser(
  sessionId: string,
  userId: string | null,
  userText: string,
  isFirstTurn: boolean,
): Promise<void> {
  if (!userId) return;
  try {
    await indexUserSession(userId, sessionId);
    if (isFirstTurn) {
      const title = userText
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const meta = await readMeta(sessionId).catch(() => null);
      // Only write title + user_id + created_at if not already set —
      // idempotent across retries.
      const fields: Record<string, string> = {};
      if (!meta?.title) fields.title = title;
      if (!meta?.user_id) fields.user_id = userId;
      if (!meta?.created_at) fields.created_at = new Date().toISOString();
      fields.last_active_at = new Date().toISOString();
      if (Object.keys(fields).length > 0) {
        await writeMeta(sessionId, fields);
      }
    }
  } catch {
    // Index/meta writes are best-effort.
  }
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

/** Pull structured refusal detail off a Message when stop_reason==='refusal'. */
function extractRefusal(msg: Anthropic.Messages.Message): TurnRefusal {
  const details = (
    msg as unknown as { stop_details?: { category?: string; explanation?: string } }
  ).stop_details;
  return { category: details?.category, explanation: details?.explanation };
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
  /** Pre-sanitization source summaries — extracted from the raw JSON so
   *  it survives even when the sanitizer mangles the JSON structure.
   *  Empty on cache hits (we don't have the raw anymore). */
  source_summary: ToolSourceSummary[];
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
      source_summary: [], // raw is gone; sources unavailable on cache hit
    };
  }

  const raw = await dispatchTool(use);
  const rawContent = typeof raw.content === 'string' ? raw.content : JSON.stringify(raw.content);

  // Extract source summaries from the RAW content BEFORE sanitization.
  // The sanitizer's [REDACTED:name] insertions can corrupt JSON escape
  // sequences, making post-sanitize parsing unreliable. Source titles
  // (e.g., case names from CourtListener) are public-record by design,
  // so parsing from raw doesn't violate the sanitization contract.
  const sourceSummary = summarizeToolOutputForSources(use.name, rawContent);

  // 2026-05-10 second-addendum mandate / audit §8 #8 — every tool_result
  // block runs through the same span detector as user input. Destructive
  // redaction (HIGH_RISK_CATEGORIES → [REDACTED:<category>]) before the
  // model sees it.
  const { content: sanitizedContent, attestation } = sanitizeToolOutput(
    rawContent,
    { toolName: use.name },
  );

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
    source_summary: sourceSummary,
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

// ---------------------------------------------------------------------------
// Beta-call wrapper — routes to client.beta.messages.{create,stream} with
// the MCP beta header when at least one mcp_server is in the spec; uses the
// stable client.messages.{create,stream} surface otherwise.
//
// Per Codex review of the fifth addendum: don't jam mcp_servers into the
// stable call (it would be rejected as an unknown parameter). The two
// call paths share the same parameter prefix; only the suffix
// (mcp_servers + betas) is conditional.
// ---------------------------------------------------------------------------

interface BaseMessagesParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Anthropic.Messages.MessageParam[];
  tools: Anthropic.Messages.Tool[];
}

type McpServerEntry = ReturnType<typeof buildMcpServers>[number];

async function callMessagesCreate(
  client: Anthropic,
  params: BaseMessagesParams,
  mcpServers: McpServerEntry[],
): Promise<Anthropic.Messages.Message> {
  // One actual API call for a given model id (stable vs beta-MCP surface).
  const run = (model: string): Promise<Anthropic.Messages.Message> => {
    const p = { ...params, model };
    if (mcpServers.length === 0) {
      return client.messages.create(p);
    }
    // Beta surface — types diverge in the SDK between stable and beta, so
    // we cast at the wire. Functionally equivalent for our parameter set.
    return client.beta.messages.create({
      ...p,
      mcp_servers: mcpServers,
      betas: [MCP_BETA_HEADER],
    } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) as unknown as Promise<
      Anthropic.Messages.Message
    >;
  };

  const activeModel = resolveModel(params.model);
  try {
    return await run(activeModel);
  } catch (err) {
    // Unavailable primary → transparently retry once on the fallback model
    // (same provider/posture). Refusals are not errors and never reach here.
    if (activeModel !== FALLBACK_MODEL && isModelUnavailableError(err)) {
      unavailableModels.add(activeModel);
      console.warn(
        `[agentLoop] model ${activeModel} unavailable; failing over to ${FALLBACK_MODEL}`,
      );
      return await run(FALLBACK_MODEL);
    }
    throw err;
  }
}

// Anthropic SDK >= 0.45 removed the exported `MessageStream` /
// `MessageStreamParams` types in favor of a less rigid inference path.
// We type the return as `unknown`-cast and let the caller treat it as
// an async iterable + .finalMessage() — the runtime shape is unchanged.
function callMessagesStream(
  client: Anthropic,
  params: BaseMessagesParams,
  mcpServers: McpServerEntry[],
): ReturnType<typeof client.messages.stream> {
  if (mcpServers.length === 0) {
    return client.messages.stream(params);
  }
  // Beta stream — same return shape (async iterable + finalMessage()),
  // type-erased at the boundary.
  return client.beta.messages.stream({
    ...params,
    mcp_servers: mcpServers,
    betas: [MCP_BETA_HEADER],
  } as unknown as Parameters<typeof client.beta.messages.stream>[0]) as unknown as ReturnType<typeof client.messages.stream>;
}

/**
 * Run ONE turn (user message → assistant final answer). Handles any
 * number of tool-use rounds internally up to MAX_ITERATIONS. Returns
 * the final assistant text and round telemetry.
 */
export async function runTurn(opts: RunTurnOptions): Promise<RunTurnResult> {
  const t0 = performance.now();
  const turnId = opts.turn_id ?? newTurnId();
  const workflow: Workflow = opts.workflow ?? 'research';
  // Quick workflow trades depth for latency — Sonnet 4.6 + no tools.
  const model =
    opts.model ??
    (workflow === 'quick' ? 'claude-sonnet-4-6' : DEFAULT_MODEL);
  const systemPrompt =
    opts.system_prompt ??
    (workflow === 'quick'
      ? `You are a fast California legal-research assistant. Answer the attorney's question DIRECTLY in 2-5 sentences with NO tool calls and NO research detours. If you don't know, say so in one sentence. Do not include citations unless the attorney explicitly asked.`
      : buildSystemPrompt({ user_text: opts.user_text }).prompt);
  const client =
    opts.anthropic_client ??
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? undefined,
      // Bound a hung non-streaming call well under Vercel's 300s ceiling so
      // an Anthropic stall surfaces a clean error instead of blocking the
      // whole function. The SDK retries transient 429/5xx with backoff.
      timeout: 120_000,
      maxRetries: 2,
    });

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
    workflow: opts.workflow ?? 'research',
  };
  await appendMessage(opts.session_id, userMessage);
  // Sidebar index (Phase 4.x) — derives a thread title from first turn
  // and refreshes the per-user newest-first index.
  void registerSessionForUser(
    opts.session_id,
    opts.user_id ?? null,
    opts.user_text,
    nextSequence === 0,
  );

  // ── 2. Build the tools array (privilege-gated web_search + MCP toolsets)
  //       and the parallel mcp_servers spec (empty unless V2_MCP_ENABLED
  //       and a server is opted in via its per-server env flag).
  // Quick workflow → no tools at all (Sonnet answers directly). Research
  // (default) → full V2 tool set (CEB/CourtListener/LegiScan/OpenStates/
  // citation_verify/web_search).
  const tools =
    workflow === 'quick'
      ? ([] as unknown as Anthropic.Messages.Tool[])
      : (buildToolsArray(opts.privileged) as unknown as Anthropic.Messages.Tool[]);
  const mcpServers = buildMcpServers(opts.privileged);

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
  // Refusal surfaced from a 'refusal' stop_reason — single-engine policy:
  // never fall back to another model; surface it to the attorney.
  let refusal: TurnRefusal | undefined;

  const maxIterations = getAgentConfig().max_iterations ?? DEFAULT_MAX_ITERATIONS;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    const messages = toAnthropicMessages(history);
    const response = await callMessagesCreate(
      client,
      {
        model,
        max_tokens: getAgentConfig().max_tokens ?? DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      },
      mcpServers,
    );

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
      if (response.stop_reason === 'refusal') refusal = extractRefusal(response);
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

    if (iter === maxIterations - 1) {
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
      model: resolveModel(model),
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
    refusal,
    truncated: stopReason === 'max_tokens',
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
  | {
      /** Primary engine was unavailable (404); this turn failed over to `to`.
       *  Same provider / Messages API — emitted so the UI can note it. */
      kind: 'model_failover';
      from: string;
      to: string;
    }
  | {
      kind: 'tool_use_start';
      tool_use_id: string;
      name: string;
      round: number;
      /** True when this is an Anthropic-server-side MCP tool dispatch
       *  (mcp_tool_use content block) rather than an in-process tool. */
      is_mcp?: boolean;
      /** MCP server name when is_mcp=true. */
      mcp_server_name?: string;
    }
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
      /** True when this corresponds to an mcp_tool_result block —
       *  server-side dispatch by Anthropic; not sanitized at our wire
       *  (data already flowed through Anthropic per Team-plan retention
       *  per the fifth addendum's MCP-not-ZDR-eligible note). */
      is_mcp?: boolean;
      /** MCP server name when is_mcp=true. */
      mcp_server_name?: string;
      /** Per-source summaries extracted from the tool's result content —
       *  used by the V2 chat UI to render a Sources panel beneath the
       *  assistant message (Phase 4 P2.3). Caps at first 5 per tool. */
      source_summary?: ToolSourceSummary[];
    }
  | { kind: 'iteration'; round: number }
  | { kind: 'refusal'; category?: string; explanation?: string }
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
  const workflow: Workflow = opts.workflow ?? 'research';
  // Quick workflow trades depth for latency — Sonnet 4.6 + no tools.
  const model =
    opts.model ??
    (workflow === 'quick' ? 'claude-sonnet-4-6' : DEFAULT_MODEL);
  const systemPrompt =
    opts.system_prompt ??
    (workflow === 'quick'
      ? `You are a fast California legal-research assistant. Answer the attorney's question DIRECTLY in 2-5 sentences with NO tool calls and NO research detours. If you don't know, say so in one sentence. Do not include citations unless the attorney explicitly asked.`
      : buildSystemPrompt({ user_text: opts.user_text }).prompt);
  const client =
    opts.anthropic_client ??
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? undefined,
      // Generous bound for a long-but-healthy drafting stream, still under
      // Vercel's 300s ceiling so a truly hung connection aborts with a clean
      // error rather than being hard-killed mid-flight.
      timeout: 280_000,
      maxRetries: 2,
    });

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
    workflow: opts.workflow ?? 'research',
  };
  await appendMessage(opts.session_id, userMessage);
  void registerSessionForUser(
    opts.session_id,
    opts.user_id ?? null,
    opts.user_text,
    nextSequence === 0,
  );

  // Quick workflow → no tools at all (Sonnet answers directly). Research
  // (default) → full V2 tool set (CEB/CourtListener/LegiScan/OpenStates/
  // citation_verify/web_search).
  const tools =
    workflow === 'quick'
      ? ([] as unknown as Anthropic.Messages.Tool[])
      : (buildToolsArray(opts.privileged) as unknown as Anthropic.Messages.Tool[]);
  const mcpServers = buildMcpServers(opts.privileged);

  let totalTokens = 0;
  let toolRounds = 0;
  let stopReason = 'unknown';
  let finalText = '';
  let exhausted = false;
  // Tool-output sanitization accumulators (audit §8 #8 compliance).
  let toolOutputRedactions = 0;
  const toolOutputByCategory: Record<string, number> = {};
  let toolOutputsPrivilegedCount = 0;
  // MCP activity accumulator (Anthropic-dispatched, server-side; we just
  // observe via stream events).
  let mcpToolUses = 0;
  // Refusal surfaced from a 'refusal' stop_reason — single-engine policy.
  let refusal: TurnRefusal | undefined;
  let history: SessionMessage[] = [...existing, userMessage];
  // Set once if this turn fell over from an unavailable primary model.
  let didModelFailover = false;

  const maxIterations = getAgentConfig().max_iterations ?? DEFAULT_MAX_ITERATIONS;
  try {
    for (let iter = 0; iter < maxIterations; iter += 1) {
      yield { kind: 'iteration', round: iter + 1 };

      const messages = toAnthropicMessages(history);
      // Resolve through the failover memo, then guard the model call: an
      // "unavailable model" 404 (e.g. Fable 5 not entitled on this account)
      // transparently retries THIS iteration on FALLBACK_MODEL. The body below
      // is intentionally left at its original indentation inside this try.
      const activeModel = resolveModel(model);
      let finalMsg!: Anthropic.Messages.Message;
      try {
      const stream = callMessagesStream(
        client,
        {
          model: activeModel,
          max_tokens: getAgentConfig().max_tokens ?? DEFAULT_MAX_TOKENS,
          system: systemPrompt,
          messages,
          tools,
        },
        mcpServers,
      );

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
          event.type === 'content_block_start' &&
          (event.content_block as { type?: string })?.type === 'mcp_tool_use'
        ) {
          // MCP tool use — Anthropic dispatches server-side; we observe.
          // Surface as a tool_use_start with is_mcp=true so the UI can
          // paint an MCP-specific affordance.
          const mcpUse = event.content_block as unknown as {
            id: string;
            name: string;
            server_name?: string;
          };
          mcpToolUses += 1;
          yield {
            kind: 'tool_use_start',
            tool_use_id: mcpUse.id,
            name: mcpUse.name,
            round: iter + 1,
            is_mcp: true,
            mcp_server_name: mcpUse.server_name,
          };
        } else if (
          event.type === 'content_block_start' &&
          (event.content_block as { type?: string })?.type === 'mcp_tool_result'
        ) {
          // MCP tool result — server-side dispatch already produced this;
          // we emit a tool_result event for UI symmetry. elapsed_ms is
          // unknown to us (Anthropic dispatched it); set to 0.
          const mcpRes = event.content_block as unknown as {
            tool_use_id: string;
            is_error?: boolean;
          };
          yield {
            kind: 'tool_result',
            tool_use_id: mcpRes.tool_use_id,
            name: '(mcp)',
            is_error: Boolean(mcpRes.is_error),
            elapsed_ms: 0,
            is_mcp: true,
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

      finalMsg = await stream.finalMessage();
      } catch (streamErr) {
        // Primary model unavailable on this account → fail over for the rest
        // of this turn and replay the current iteration on the fallback. The
        // 404 fires before any token, so nothing partial was yielded.
        if (
          !didModelFailover &&
          activeModel !== FALLBACK_MODEL &&
          isModelUnavailableError(streamErr)
        ) {
          unavailableModels.add(activeModel);
          didModelFailover = true;
          console.warn(
            `[agentLoop] model ${activeModel} unavailable; failing over to ${FALLBACK_MODEL}`,
          );
          yield { kind: 'model_failover', from: activeModel, to: FALLBACK_MODEL };
          iter -= 1;
          continue;
        }
        throw streamErr;
      }
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
        if (finalMsg.stop_reason === 'refusal') {
          refusal = extractRefusal(finalMsg);
          yield {
            kind: 'refusal',
            category: refusal.category,
            explanation: refusal.explanation,
          };
        }
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
          source_summary: result.source_summary,
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

      if (iter === maxIterations - 1) exhausted = true;
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
    if (mcpToolUses > 0) {
      auditWarnings.push(`mcp_tool_uses:${mcpToolUses}`);
    }
    await writeAuditRecord(
      buildAuditRecord({
        route: 'agent_loop_stream',
        sanitizedPrompt: opts.user_text,
        flowType: opts.privileged ? 'accuracy_client' : 'public_research',
        userId: opts.user_id ?? null,
        model: resolveModel(model),
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
        refusal,
        truncated: stopReason === 'max_tokens',
      },
    };
  } catch (err) {
    // Scrub before emit — an Anthropic SDK error may quote part of the
    // request body in the message; even though it should already be
    // tokenized, defense-in-depth scrub.
    const message = scrubMessage(err instanceof Error ? err.message : String(err));
    yield { kind: 'error', code: 'inference_error', message };
  }
}
