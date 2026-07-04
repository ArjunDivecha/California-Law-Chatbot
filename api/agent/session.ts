/**
 * V2 session detail endpoint.
 *
 * GET /api/agent/session?id=<session_id>
 *   Authorization: Bearer <Clerk JWT>
 *   → 200 { session_id, meta, messages }
 *
 * Returns the meta + full message history for a single session. The
 * authenticated user must own the session (meta.user_id matches the
 * JWT's sub claim); otherwise 403.
 *
 * Path uses ?id= rather than a path parameter to keep the Vercel/dev-
 * server bundling simple (Vercel's serverless function file layout
 * doesn't do nested dynamic segments without extra config).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readMessages, readMeta } from '../_lib/sessionStore.js';
import { requireUser, isValidSessionId } from '../_lib/httpGuard.js';
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

  const sessionId = (req.query.id as string | undefined)?.trim();
  if (!sessionId) {
    res.status(400).json({ error: 'invalid_input', message: 'id query param required' });
    return;
  }
  // Reject malformed client-minted ids before they interpolate into Redis keys.
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'invalid_input', message: 'invalid session id' });
    return;
  }

  // Shared guard (same as the turn endpoints) — resolves the synthetic
  // `dev-user` off-Vercel so locally-written sessions can be hydrated.
  // requireUser writes the 401 itself.
  const userId = await requireUser(req, res);
  if (!userId) return;

  try {
    const meta = await readMeta(sessionId);
    if (!meta) {
      res.status(404).json({ error: 'not_found', message: 'Session not found' });
      return;
    }
    // Ownership check: a user may only fetch their own sessions. Older
    // sessions written before the meta.user_id field was populated will
    // have user_id="" — for those, deny access (they predate this UI).
    if (meta.user_id !== userId) {
      res.status(403).json({ error: 'forbidden', message: 'Session belongs to a different user' });
      return;
    }
    const messages = await readMessages(sessionId);
    res.status(200).json({ session_id: sessionId, meta, messages });
  } catch (err) {
    // Don't leak Redis/config internals to the client; log the real error.
    console.error('[agent/session] internal error:', scrubMessage(err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  }
}
