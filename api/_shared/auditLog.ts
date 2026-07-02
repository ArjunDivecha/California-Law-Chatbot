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

import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
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

function manifestKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `manifest:${y}-${m}-${d}`;
}

/**
 * Write a per-turn compliance manifest (PRD §5.9). The manifest carries
 * hashes + metadata ONLY — never raw client text (enforced by
 * compliance/turnManifest.ts). Fails OPEN, like writeAuditRecord; the turn is
 * never gated on it. NB §5.9a: the retention/discoverability posture of this
 * store is a counsel decision; 90 days mirrors the audit log by default.
 */
export async function writeTurnManifest(manifest: unknown): Promise<void> {
  try {
    const key = manifestKey();
    const sink = resolveSink();
    await sink.lpush(key, JSON.stringify(manifest));
    await sink.expire(key, DAILY_TTL_SECONDS);
  } catch (err) {
    console.warn('[auditLog] manifest write failed:', (err as { message?: string })?.message ?? err);
  }
}

// ---------------------------------------------------------------------------
// Per-redaction envelope-encrypted audit record (D15, KV schema L129–147)
// ---------------------------------------------------------------------------

/**
 * Per-redaction audit envelope shape. Written to
 * `audit_record_envelope:{id}` in Upstash KV after AES-256-GCM
 * encryption. Per the 6th-addendum Option C ratification: NO plaintext
 * of privileged content, NO ciphertext of the actual prompt — only
 * metadata + HMACs of the sanitized form. 7-year retention.
 *
 * The KEK lives in 1Password (operator-controlled). The DEK is stored
 * in `audit_record_envelope:dek`, itself encrypted with the KEK.
 * Break-glass access requires the KEK holder; access is logged per
 * plan §U.
 *
 * For Phase D pre-deploy, this writer uses `AUDIT_ENVELOPE_DEK` env
 * var directly (a base64-encoded 32-byte key). The KEK-wrapped flow
 * is a follow-up — env-var DEK gives us the per-redaction trail today
 * without blocking on the 1Password KEK provisioning.
 */
export interface RedactionAuditEnvelope {
  id: string;                      // ULID
  session_id: string;
  attorney_id: string | null;
  input_sha256: string;            // HMAC of raw input length+structure (browser-side)
  sanitized_sha256: string;        // HMAC of sanitized prompt (server sees this)
  redaction_decisions_count: number;
  by_category_counts: Record<string, number>;
  confidence: number;
  privileged_bool: boolean;
  compound_risk_buckets: number;
  timestamp: string;               // ISO-8601
  schema_version: 1;
}

const ENVELOPE_TTL_SECONDS = 60 * 60 * 24 * 365 * 7; // 7 years

function nextUlid(): string {
  // Minimal ULID-ish: timestamp ms + 8 random hex. Sufficient for
  // monotonic ordering + collision resistance at our write rate.
  const ms = Date.now().toString(36);
  const rand = (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  ).slice(0, 12);
  return `ar_${ms}_${rand}`;
}

/**
 * AES-256-GCM encrypt + base64-encode. Returns `{ciphertext, iv, tag}`
 * concatenated as base64 strings for compact KV storage.
 */
function encryptEnvelope(plaintext: string): { payload: string; iv: string; tag: string } | null {
  const dekB64 = process.env.AUDIT_ENVELOPE_DEK;
  if (!dekB64) return null;
  let dek: Buffer;
  try {
    dek = Buffer.from(dekB64, 'base64');
    if (dek.length !== 32) {
      console.warn('[auditLog] AUDIT_ENVELOPE_DEK is not 32 bytes; skipping envelope encryption');
      return null;
    }
  } catch {
    console.warn('[auditLog] AUDIT_ENVELOPE_DEK is not valid base64; skipping envelope encryption');
    return null;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    payload: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Public sink for the envelope record. Extends AuditSink with a
 * generic SET because envelope records aren't list-pushed.
 */
export interface EnvelopeSink {
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
}

let envelopeSink: EnvelopeSink | null = null;
function resolveEnvelopeSink(): EnvelopeSink | null {
  if (envelopeSink) return envelopeSink;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const client = new Redis({ url, token });
  envelopeSink = {
    set: (key, value, opts) => client.set(key, value, opts),
  };
  return envelopeSink;
}

/**
 * Write an envelope-encrypted audit record per Option C / KV schema.
 * Fire-and-forget; never throws. Skipped (with warning) if
 * AUDIT_ENVELOPE_DEK or Upstash creds are missing — the daily HMAC log
 * remains the operational fallback.
 *
 * Returns the assigned record id, or null if envelope wasn't written.
 */
export async function writeRedactionEnvelope(
  data: Omit<RedactionAuditEnvelope, 'id' | 'timestamp' | 'schema_version'>,
): Promise<string | null> {
  try {
    const sink = resolveEnvelopeSink();
    if (!sink) return null;
    const id = nextUlid();
    const record: RedactionAuditEnvelope = {
      ...data,
      id,
      timestamp: new Date().toISOString(),
      schema_version: 1,
    };
    const plaintext = JSON.stringify(record);
    const enc = encryptEnvelope(plaintext);
    if (!enc) return null;
    const stored = JSON.stringify({
      v: 1,
      alg: 'aes-256-gcm',
      iv: enc.iv,
      tag: enc.tag,
      payload: enc.payload,
    });
    await sink.set(`audit_record_envelope:${id}`, stored, { ex: ENVELOPE_TTL_SECONDS });
    return id;
  } catch (err) {
    console.warn(
      '[auditLog] envelope write failed:',
      (err as { message?: string })?.message ?? err,
    );
    return null;
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
