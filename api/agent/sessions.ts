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
import { verifyToken } from '@clerk/backend';
import { listSessionsForUser } from '../_lib/sessionStore.js';

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

  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  try {
    const sessions = await listSessionsForUser(userId, limit);
    res.status(200).json({ sessions });
  } catch (err) {
    res.status(500).json({
      error: 'internal_error',
      message: (err as Error).message,
    });
  }
}
