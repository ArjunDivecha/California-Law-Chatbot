/**
 * Session store for the V2 agent loop. Wraps Upstash Redis (REST) per
 * the schema documented in docs/upstash-kv-schema-v1.md (v1.0).
 *
 * Owners + key shapes:
 *   session:{id}:messages          List (RPUSH) of JSON-stringified Anthropic-shape messages
 *   session:{id}:meta              Hash   user_id, created_at, last_active_at, model, etc.
 *   session:{id}:toolresult:{id}   String (JSON) idempotency cache, 24h TTL
 *   session:{id}:lock              String (epoch ms) single-flight lock, 30s auto-expire
 *
 * The agent loop calls this module — it does not talk to Upstash
 * directly. Tests mock the underlying Redis client via setSessionRedis.
 */

import { Redis } from '@upstash/redis';
import type { MatterMode, ClientAiConsentStatus } from './compliance/policyEngine.js';

// ---------------------------------------------------------------------------
// Redis client — injectable for tests
// ---------------------------------------------------------------------------

export interface SessionRedis {
  // Subset of @upstash/redis methods we actually use.
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, end: number): Promise<string[]>;
  hset(key: string, value: Record<string, unknown>): Promise<number>;
  hgetall<T = Record<string, string>>(key: string): Promise<T | null>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  // Sorted-set methods for the per-user session index. @upstash/redis
  // signatures: zadd(key, {score, member}); zrange(key, min, max, opts).
  zadd(
    key: string,
    score_member: { score: number; member: string },
  ): Promise<number | null>;
  zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean },
  ): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
}

let injected: SessionRedis | null = null;
let cached: SessionRedis | null = null;

/** Test-only — inject a mock Redis. Pass null to restore env-driven default. */
export function setSessionRedis(redis: SessionRedis | null): void {
  injected = redis;
  cached = null;
}

function resolveRedis(): SessionRedis {
  if (injected) return injected;
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'sessionStore: UPSTASH_REDIS_REST_URL / TOKEN not configured',
    );
  }
  cached = new Redis({ url, token }) as unknown as SessionRedis;
  return cached;
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

function messagesKey(sessionId: string): string {
  return `session:${sessionId}:messages`;
}
function metaKey(sessionId: string): string {
  return `session:${sessionId}:meta`;
}
function toolResultKey(sessionId: string, toolUseId: string): string {
  return `session:${sessionId}:toolresult:${toolUseId}`;
}
function lockKey(sessionId: string): string {
  return `session:${sessionId}:lock`;
}
/**
 * Per-user index of sessions, sorted by last-active timestamp.
 * ZADD on every turn; ZREVRANGE on session-list reads.
 */
function userSessionsKey(userId: string): string {
  return `user:${userId}:sessions`;
}

const TOOL_RESULT_TTL_SECONDS = 60 * 60 * 24;
const LOCK_TTL_SECONDS = 30;

// ---------------------------------------------------------------------------
// Message log (append-only)
// ---------------------------------------------------------------------------

/**
 * Anthropic-shaped message. The agent loop appends one per role per
 * turn (so a multi-tool turn produces multiple entries).
 */
export interface SessionMessage {
  role: 'user' | 'assistant';
  /** Anthropic content-block array — text, tool_use, tool_result, etc. */
  content: unknown;
  /** App-generated stable id for this turn. Required for audit. */
  turn_id: string;
  /** Monotone-within-session sequence number. */
  sequence: number;
  /** ISO-8601 append timestamp. */
  appended_at: string;
  /** Sanitization attestation snapshot for this turn (input role only). */
  sanitization?: {
    privileged: boolean;
    compound_risk_buckets: number;
    redactions_count: number;
    by_category: Record<string, number>;
  };
  /** Workflow mode for this turn (V2 Phase 4 P2.5) — surfaced as a badge
   *  in the chat UI so attorneys can see which mode produced each turn. */
  workflow?: 'quick' | 'research';
}

export async function appendMessage(
  sessionId: string,
  msg: SessionMessage,
): Promise<void> {
  const redis = resolveRedis();
  await redis.rpush(messagesKey(sessionId), JSON.stringify(msg));
}

export async function readMessages(
  sessionId: string,
): Promise<SessionMessage[]> {
  const redis = resolveRedis();
  const raw = await redis.lrange(messagesKey(sessionId), 0, -1);
  // @upstash/redis auto-deserializes JSON-shaped values on read. Strings
  // that happen NOT to be JSON come back as strings — handle both.
  return raw.map((entry) => {
    if (typeof entry === 'string') {
      try {
        return JSON.parse(entry) as SessionMessage;
      } catch {
        return entry as unknown as SessionMessage;
      }
    }
    return entry as unknown as SessionMessage;
  });
}

// ---------------------------------------------------------------------------
// Session meta
// ---------------------------------------------------------------------------

export interface SessionMeta {
  user_id: string;
  created_at: string;
  last_active_at: string;
  schema_version: number;
  model: string;
  system_prompt_sha256?: string;
  agent_config_sha256?: string;
  title?: string;
  // ── Matter binding (P2 compliance) ──────────────────────────────────────
  // Matter mode drives confidentiality; detection may only ESCALATE it
  // (see api/_lib/compliance/policyEngine.ts). Absent on legacy sessions.
  matter_id?: string;
  /** Bound matter mode. Absent ⇒ consumers treat as 'public_research'. */
  matter_mode?: MatterMode;
  /** Client AI-use consent. Absent ⇒ consumers treat as 'not_obtained'. */
  client_ai_consent?: ClientAiConsentStatus;
  /** When true, protected_discovery is locked on and cannot be downgraded in-session. */
  protected_locked?: boolean;
  // ── Server-side attestations (P6 compliance) ────────────────────────────
  consent_version?: string;
  consent_signer?: string;
  consent_at?: string;
  policy_ack_version?: string;
  policy_ack_signer?: string;
  policy_ack_at?: string;
}

export async function readMeta(sessionId: string): Promise<SessionMeta | null> {
  const redis = resolveRedis();
  const hash = await redis.hgetall<Record<string, string>>(metaKey(sessionId));
  if (!hash || Object.keys(hash).length === 0) return null;
  return {
    user_id: hash.user_id,
    created_at: hash.created_at,
    last_active_at: hash.last_active_at,
    schema_version: Number(hash.schema_version ?? '1'),
    model: hash.model,
    system_prompt_sha256: hash.system_prompt_sha256,
    agent_config_sha256: hash.agent_config_sha256,
    title: hash.title,
    matter_id: hash.matter_id || undefined,
    matter_mode: (hash.matter_mode as MatterMode) || undefined,
    client_ai_consent: (hash.client_ai_consent as ClientAiConsentStatus) || undefined,
    protected_locked:
      hash.protected_locked === 'true'
        ? true
        : hash.protected_locked === 'false'
          ? false
          : undefined,
    consent_version: hash.consent_version || undefined,
    consent_signer: hash.consent_signer || undefined,
    consent_at: hash.consent_at || undefined,
    policy_ack_version: hash.policy_ack_version || undefined,
    policy_ack_signer: hash.policy_ack_signer || undefined,
    policy_ack_at: hash.policy_ack_at || undefined,
  };
}

export async function writeMeta(
  sessionId: string,
  meta: Partial<SessionMeta>,
): Promise<void> {
  const redis = resolveRedis();
  // Upstash hset accepts a flat object.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v == null) continue;
    fields[k] = String(v);
  }
  if (Object.keys(fields).length === 0) return;
  await redis.hset(metaKey(sessionId), fields);
}

export async function touchLastActive(sessionId: string): Promise<void> {
  await writeMeta(sessionId, { last_active_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Per-user session index (Phase 4.x)
// ---------------------------------------------------------------------------

/**
 * Register/refresh a session in the user's index. Called on every turn
 * via the agent loop so the score (last-active ms) stays current. The
 * sidebar lists `user:{userId}:sessions` via ZREVRANGE to get the
 * newest sessions first.
 *
 * Idempotent — ZADD updates the score for an existing member.
 */
export async function indexUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  if (!userId || !sessionId) return;
  const redis = resolveRedis();
  await redis.zadd(userSessionsKey(userId), {
    score: Date.now(),
    member: sessionId,
  });
}

export interface SessionSummary {
  session_id: string;
  title: string | null;
  last_active_at: string | null;
  created_at: string | null;
  message_count: number;
}

/**
 * List the most-recent sessions for a user, newest first. Default 50.
 * Reads from the per-user sorted-set index, then fetches each session's
 * meta + message count. N+1 calls — acceptable at 50 sessions; if the
 * cap grows, batch into a Pipeline.
 */
export async function listSessionsForUser(
  userId: string,
  limit: number = 50,
): Promise<SessionSummary[]> {
  if (!userId) return [];
  const redis = resolveRedis();
  // zrange(..., {rev: true}) is @upstash/redis's idiomatic ZREVRANGE.
  const ids = await redis.zrange(userSessionsKey(userId), 0, limit - 1, {
    rev: true,
  });
  if (!ids || ids.length === 0) return [];

  const results: SessionSummary[] = [];
  for (const id of ids) {
    const meta = await readMeta(id);
    const messages = await redis.lrange(messagesKey(id), 0, -1);
    results.push({
      session_id: id,
      title: meta?.title ?? null,
      last_active_at: meta?.last_active_at ?? null,
      created_at: meta?.created_at ?? null,
      message_count: messages?.length ?? 0,
    });
  }
  return results;
}

/**
 * Remove a session from the user's index (e.g., on delete). Does NOT
 * delete the underlying session data — call deleteSession for that.
 */
export async function unindexUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  if (!userId || !sessionId) return;
  const redis = resolveRedis();
  await redis.zrem(userSessionsKey(userId), sessionId);
}

// ---------------------------------------------------------------------------
// Tool-result idempotency cache (24h)
// ---------------------------------------------------------------------------

export interface CachedToolResult {
  tool_use_id: string;
  name: string;
  input: unknown;
  result: unknown;
  hash: string;
  written_at: string;
}

export async function readToolResult(
  sessionId: string,
  toolUseId: string,
): Promise<CachedToolResult | null> {
  const redis = resolveRedis();
  const raw = await redis.get(toolResultKey(sessionId, toolUseId));
  if (!raw) return null;
  return JSON.parse(raw) as CachedToolResult;
}

export async function writeToolResult(
  sessionId: string,
  rec: CachedToolResult,
): Promise<void> {
  const redis = resolveRedis();
  await redis.set(
    toolResultKey(sessionId, rec.tool_use_id),
    JSON.stringify(rec),
    { ex: TOOL_RESULT_TTL_SECONDS },
  );
}

// ---------------------------------------------------------------------------
// Single-flight lock
// ---------------------------------------------------------------------------

/**
 * Try to acquire a single-flight lock on a session. Returns true if
 * acquired, false if another turn is already in-flight. Auto-expires
 * after 30s so a crashed turn-handler can't permanently lock a session.
 */
export async function acquireLock(sessionId: string): Promise<boolean> {
  const redis = resolveRedis();
  const result = await redis.set(
    lockKey(sessionId),
    Date.now().toString(),
    { ex: LOCK_TTL_SECONDS, nx: true },
  );
  return result !== null;
}

export async function releaseLock(sessionId: string): Promise<void> {
  const redis = resolveRedis();
  await redis.del(lockKey(sessionId));
}

// ---------------------------------------------------------------------------
// Per-user rate limit (fixed window)
// ---------------------------------------------------------------------------

/**
 * Increment and return the request count for `userId` in the current
 * fixed window (default 60s). Returns null when the store is unavailable —
 * callers FAIL OPEN (per Arjun 2026-06-16: don't lock out the firm's
 * attorneys if Redis hiccups; the limiter exists to stop runaway client
 * loops, not to be a hard cost ceiling).
 */
export async function rateLimitHit(
  userId: string,
  windowSeconds = 60,
): Promise<number | null> {
  try {
    const redis = resolveRedis();
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `ratelimit:${userId}:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count;
  } catch {
    return null; // fail open
  }
}
