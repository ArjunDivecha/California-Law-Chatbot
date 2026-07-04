/**
 * HTTP guard for the V2 agent surface — authentication, CORS allow-listing,
 * and session-ownership checks shared by every `/api/agent/*` write route.
 *
 * Closes the two CRITICAL findings from the 2026-06-16 review:
 *   1. The inference/write endpoints performed NO authentication and trusted
 *      a body-supplied `user_id` (plan §A.1 required Clerk JWT verification).
 *   2. CORS was `Access-Control-Allow-Origin: *` (plan §A.1: production-domain
 *      allow-list, no wildcards).
 *
 * Usage in a route handler (do auth BEFORE flushing any SSE headers):
 *
 *     if (handlePreflight(req, res)) return;            // OPTIONS short-circuit
 *     applyCors(req, res);
 *     if (req.method !== 'POST') { res.status(405)...; return; }
 *     const userId = await requireUser(req, res);       // sends 401 on failure
 *     if (!userId) return;
 *     const access = await assertSessionAccess(sessionId, userId);
 *     if (!access.ok) { res.status(access.status).json({ error: access.message }); return; }
 *
 * AUTH ENFORCEMENT BOUNDARY (deliberate, documented):
 *   Auth is enforced on Vercel (production + preview — `process.env.VERCEL`
 *   is set there automatically). On a purely local dev server (`tsx
 *   dev-server.js`, no VERCEL env) a missing/!invalid token falls back to a
 *   synthetic `dev-user` and logs a LOUD warning — this preserves the
 *   existing App.tsx `import.meta.env.DEV` sign-in bypass for local UI work.
 *   It is impossible to be "not on Vercel" in production, so this cannot
 *   weaken the deployed surface. A valid token is always honoured, even
 *   locally. There is no env flag that can disable auth in production.
 *
 * INPUT FILES:  none (reads request headers + Upstash session meta)
 * OUTPUT FILES: none
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, AuthError } from '../../utils/auth.js';
import { readMeta, rateLimitHit } from './sessionStore.js';

// ---------------------------------------------------------------------------
// CORS allow-list
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_ORIGINS = [
  'https://california-law-chatbot.vercel.app',
  'https://california-law-chatbot-v2.vercel.app',
  'https://chat.femmeandfemmelaw.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

// NOTE (2026-07-03, CORS consolidation): the former wildcard preview regex
// (`^https://california-law-chatbot(-v2)?(-<anything>)?\.vercel\.app$`) was
// REMOVED. `*.vercel.app` project names are first-come / attacker-registrable,
// and applyCors sets Access-Control-Allow-Credentials:true — a guessable
// wildcard was a credentialed-CORS hole. The project's own preview URLs use a
// non-guessable team scope we can't pin from `.vercel/project.json` (only the
// opaque orgId is stored there), so a safe exact allow-list beats a wildcard.
// To authorise a preview deploy, add its exact origin to the V2_ALLOWED_ORIGINS
// (or APP_ORIGIN) env var. This is the ONE source of truth for allowed origins,
// shared by api/_shared/routeSecurity.ts via resolveAllowedOrigin().

/**
 * The single canonical allow-list, merging the built-in defaults with the
 * V2_ALLOWED_ORIGINS and APP_ORIGIN env vars (both comma-separated). Both env
 * vars are honoured so the two historical CORS implementations converge on one
 * list rather than drifting apart (split-brain: turns passing while session
 * reads fail on the same preview deploy).
 */
export function allowedOrigins(): string[] {
  const fromEnv = [
    ...(process.env.V2_ALLOWED_ORIGINS ?? '').split(','),
    ...(process.env.APP_ORIGIN ?? '').split(','),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}

/**
 * Single source of truth for origin resolution: returns the request origin
 * only if it is explicitly allow-listed, otherwise null. No wildcard, no
 * reflection of arbitrary origins. A missing Origin (same-origin / non-CORS
 * request) ⇒ null (no ACAO header needed).
 */
export function resolveAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  return allowedOrigins().includes(origin) ? origin : null;
}

function resolveOrigin(req: VercelRequest): string {
  const origin = (req.headers.origin as string | undefined) ?? '';
  // Reflect an allow-listed origin; otherwise return the canonical prod origin
  // so the browser's ACAO check fails for the actual caller (no wildcard,
  // no reflection).
  return resolveAllowedOrigin(origin) ?? DEFAULT_ALLOWED_ORIGINS[0];
}

/** Set CORS headers. Call before writing any response/SSE headers. */
export function applyCors(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', resolveOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/** Handle an OPTIONS preflight. Returns true if it short-circuited. */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false;
  applyCors(req, res);
  res.status(204).end();
  return true;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function authEnforced(): boolean {
  // Enforced on Vercel (prod + preview) and any explicit production build.
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
}

/**
 * Verify the Clerk JWT and return the authenticated user id. On failure,
 * writes the appropriate status (401/500) and returns null — the caller
 * must `return` immediately.
 *
 * Never reads `user_id` from the request body; the id is derived from the
 * verified token only.
 */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<string | null> {
  try {
    return await getUserId(req);
  } catch (err) {
    const status = err instanceof AuthError ? err.statusCode : 401;
    // Local-dev bypass (never on Vercel / production — see file header).
    if (status === 401 && !authEnforced()) {
      console.warn(
        '[httpGuard] No valid Clerk token and not running on Vercel — ' +
          'using synthetic dev-user. This bypass is impossible in production.',
      );
      return 'dev-user';
    }
    res.status(status).json({
      error: status === 401 ? 'unauthorized' : 'auth_error',
      message:
        status === 401
          ? 'Sign-in required or session expired.'
          : (err as Error).message,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session ownership
// ---------------------------------------------------------------------------

export interface AccessResult {
  ok: boolean;
  status: number;
  message?: string;
}

/**
 * A user may act on a session only if (a) it has no recorded owner yet —
 * first turn, the loop will claim it — or (b) the recorded owner matches.
 * Cross-user access → 403.
 */
export async function assertSessionAccess(
  sessionId: string,
  userId: string,
): Promise<AccessResult> {
  if (!sessionId) return { ok: false, status: 400, message: 'session_id is required' };
  try {
    const meta = await readMeta(sessionId);
    if (meta?.user_id && meta.user_id !== userId) {
      return { ok: false, status: 403, message: 'Session belongs to a different user.' };
    }
    return { ok: true, status: 200 };
  } catch {
    // If meta can't be read (KV blip), don't hard-fail the turn on an
    // ownership *lookup* error — the loop still writes under this user.
    return { ok: true, status: 200 };
  }
}

/** `^[\w-]{1,128}$` — reject malformed client-minted session ids before they hit Redis keys. */
export function isValidSessionId(id: string): boolean {
  return /^[\w-]{1,128}$/.test(id);
}

// ---------------------------------------------------------------------------
// Per-user rate limit
// ---------------------------------------------------------------------------

/** Per-user requests allowed per minute. Override via V2_RATE_LIMIT_PER_MIN. */
const DEFAULT_RATE_LIMIT_PER_MIN = 30;

/**
 * Fixed-window per-user rate limit. FAILS OPEN: if the store is
 * unavailable, or the limit is disabled (<= 0), the request is allowed —
 * the limiter stops runaway client loops, it is not a hard cost ceiling,
 * and it must never lock the firm's attorneys out on a Redis blip
 * (decision: Arjun, 2026-06-16). Returns 429 only on a real over-limit hit.
 */
export async function checkRateLimit(userId: string): Promise<AccessResult> {
  const limit = Number(process.env.V2_RATE_LIMIT_PER_MIN ?? DEFAULT_RATE_LIMIT_PER_MIN);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true, status: 200 };
  const count = await rateLimitHit(userId, 60);
  if (count === null) return { ok: true, status: 200 }; // store down → fail open
  if (count > limit) {
    return {
      ok: false,
      status: 429,
      message: 'Rate limit exceeded — please wait a minute and try again.',
    };
  }
  return { ok: true, status: 200 };
}
