/**
 * api/box/status.ts
 *
 * GET  /api/box/status      → 200 { configured, connected, login? }
 * POST /api/box/disconnect is separate (disconnect.ts).
 *
 * Auth: Clerk bearer. No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { boxConfigured, readTokens } from '../_lib/box.js';

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
  const userId = await requireUser(req, res);
  if (!userId) return;
  if (!boxConfigured()) {
    res.status(200).json({ configured: false, connected: false });
    return;
  }
  const tokens = await readTokens(userId);
  res.status(200).json({
    configured: true,
    connected: Boolean(tokens),
    login: tokens?.box_login,
  });
}
