/**
 * V2 session list endpoint.
 *
 * GET /api/agent/sessions
 *   Authorization: Bearer <Clerk JWT>
 *   → 200 { sessions: SessionSummary[] }
 *
 * Returns the authenticated user's most-recent V2 sessions (newest first,
 * default 50). Driven by the `user:{userId}:sessions` sorted-set index
 * that the agent loop maintains on every turn.
 *
 * Auth: Clerk JWT via Authorization header. Returns 401 if missing or
 * invalid. Mirrors the api/chats.ts auth shape.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listSessionsForUser } from '../_lib/sessionStore.js';
import { requireUser } from '../_lib/httpGuard.js';
import { scrubMessage } from '../_lib/scrubError.js';

import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyResponseSecurity(res, headerString(req.headers.origin), { methods: 'GET, OPTIONS' });
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Shared guard (same as the turn endpoints). Critical for local dev:
  // the turn path falls back to the synthetic `dev-user` when the token
  // can't be verified off-Vercel, so the list endpoint must resolve the
  // SAME user id or the sidebar 401s while turns keep landing — sessions
  // written but never listed. requireUser writes the 401 itself.
  const userId = await requireUser(req, res);
  if (!userId) return;

  // NaN-safe: req.query.limit can be an array (?limit=1&limit=2), and
  // Number(['1','2']) → NaN would poison the zrange range. Parse the first
  // value and fall back to the 50 default when it isn't a finite number.
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = Number(rawLimit ?? 50);
  const limit = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 50));
  try {
    const sessions = await listSessionsForUser(userId, limit);
    res.status(200).json({ sessions });
  } catch (err) {
    // Don't leak Redis/config internals to the client; log the real error.
    console.error('[agent/sessions] internal error:', scrubMessage(err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  }
}
