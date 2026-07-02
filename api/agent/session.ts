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
import { verifyToken } from '@clerk/backend';
import { readMessages, readMeta } from '../_lib/sessionStore.js';

import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';

async function getUserId(req: VercelRequest): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw Object.assign(new Error('CLERK_SECRET_KEY not set'), { status: 500 });

  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else {
    const cookie = req.headers.cookie ?? '';
    const m = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    token = m ? decodeURIComponent(m[1]) : undefined;
  }
  if (!token) throw Object.assign(new Error('No session token'), { status: 401 });

  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload.sub) throw new Error('No userId in token');
    return payload.sub;
  } catch (err) {
    throw Object.assign(new Error('Authentication failed'), { status: 401 });
  }
}

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

  let userId: string;
  try {
    userId = await getUserId(req);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: status === 401 ? 'unauthorized' : 'internal_error',
      message: (err as Error).message,
    });
    return;
  }

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
    res.status(500).json({ error: 'internal_error', message: (err as Error).message });
  }
}
