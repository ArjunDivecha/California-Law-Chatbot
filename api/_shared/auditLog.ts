/**
 * Audit Log — HMAC-only records of gated requests.
 *
 * Every /api/* route that accepts attorney prompt text calls
 * writeAuditRecord() once per invocation. Each record contains metadata
 * (route, flow, model, providers, latency, warning flags) and a
 * KMS-keyed HMAC of the sanitized prompt — never the prompt itself and
 * never the token map.
 *
 * The store is Upstash Redis: records LPUSHed onto a daily list
 * `audit:YYYY-MM-DD` with a 90-day EXPIRE on first write of the day.
 * Phase 7 will migrate this to S3 Object Lock in F&F's AWS account.
 *
 * Fails **open**. If AUDIT_HMAC_KEY is missing, Redis is unreachable, or
 * anything else goes wrong, we log a console warning and let the request
 * complete. The audit is important but not worth taking the app down for.
 */

import { createHmac } from 'node:crypto';
import { Redis } from '@upstash/redis';

export interface AuditRecord {
  timestamp: string;              // ISO-8601
  route: string;                  // e.g. 'gemini-chat'
  flowType?: string;              // 'accuracy_client' | 'public_research' | 'speed_passthrough'
  userId?: string | null;         // Clerk user id when available
  model?: string;                 // resolved Bedrock profile ID (generation routes)
  sourceProviders?: string[];     // retrieval providers touched this request
  sanitizedPromptHmac?: string;   // HMAC-SHA-256 hex of the sanitized prompt
  promptLength?: number;          // length in chars of the sanitized prompt
  backstopTriggered?: boolean;
  backstopCategories?: string[];  // categories that triggered the backstop
  latencyMs?: number;
  warningFlags?: string[];        // e.g. ['ungrounded-citation']
  statusCode?: number;
}

// ---------------------------------------------------------------------------
// HMAC
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA-256 (hex) of the sanitized prompt using AUDIT_HMAC_KEY.
 * Returns undefined if the key is not configured — caller still writes the
 * record, just without a prompt HMAC.
 */
export function computeHmac(text: string): string | undefined {
  const key = process.env.AUDIT_HMAC_KEY;
  if (!key) return undefined;
  if (typeof text !== 'string' || text.length === 0) return undefined;
  return createHmac('sha256', key).update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// Redis sink — pluggable for tests
// ---------------------------------------------------------------------------

export interface AuditSink {
  lpush(key: string, value: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
}

const NOOP_SINK: AuditSink = {
  async lpush() { /* no-op */ },
  async expire() { /* no-op */ },
};

let injectedSink: AuditSink | null = null;
let cachedSink: AuditSink | null = null;

/** Tests call setAuditSink(mock). Pass null to restore the env-driven default. */
export function setAuditSink(sink: AuditSink | null): void {
  injectedSink = sink;
  cachedSink = null;
}

function resolveSink(): AuditSink {
  if (injectedSink) return injectedSink;
  if (cachedSink) return cachedSink;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedSink = NOOP_SINK;
    return cachedSink;
  }
  const client = new Redis({ url, token });
  cachedSink = {
    lpush: (key, value) => client.lpush(key, value),
    expire: (key, seconds) => client.expire(key, seconds),
  };
  return cachedSink;
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

const DAILY_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

function todayKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `audit:${y}-${m}-${d}`;
}

/**
 * Write a single audit record. Fire-and-forget from the caller's POV —
 * it returns a Promise you can await if you want to block on it, but it
 * will never throw (errors are caught and logged). The route should not
 * gate the response on this.
 */
export async function writeAuditRecord(record: AuditRecord): Promise<void> {
  try {
    const key = todayKey();
    const value = JSON.stringify(record);
    const sink = resolveSink();
    await sink.lpush(key, value);
    // Refresh the expire on every push; cheap and keeps the key from
    // outliving the retention window if writes continue past 90 days.
    await sink.expire(key, DAILY_TTL_SECONDS);
  } catch (err) {
    console.warn('[auditLog] write failed:', (err as { message?: string })?.message ?? err);
  }
}

/**
 * Convenience builder — constructs a record from the common fields and
 * the sanitized prompt (HMACed here, never stored raw).
 */
export function buildAuditRecord(args: {
  route: string;
  sanitizedPrompt?: string | null;
  flowType?: string;
  userId?: string | null;
  model?: string;
  sourceProviders?: string[];
  backstopTriggered?: boolean;
  backstopCategories?: string[];
  latencyMs?: number;
  warningFlags?: string[];
  statusCode?: number;
}): AuditRecord {
  const {
    route,
    sanitizedPrompt,
    flowType,
    userId,
    model,
    sourceProviders,
    backstopTriggered,
    backstopCategories,
    latencyMs,
    warningFlags,
    statusCode,
  } = args;
  return {
    timestamp: new Date().toISOString(),
    route,
    flowType,
    userId: userId ?? null,
    model,
    sourceProviders,
    sanitizedPromptHmac: sanitizedPrompt ? computeHmac(sanitizedPrompt) : undefined,
    promptLength: typeof sanitizedPrompt === 'string' ? sanitizedPrompt.length : undefined,
    backstopTriggered: backstopTriggered ?? false,
    backstopCategories,
    latencyMs,
    warningFlags,
    statusCode,
  };
}
