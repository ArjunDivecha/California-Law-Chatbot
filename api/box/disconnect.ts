/**
 * api/box/disconnect.ts
 *
 * POST /api/box/disconnect → 200 { ok: true } — deletes the user's stored
 * Box tokens. (Box-side app grant revocation is left to the user in Box's
 * own settings; deleting our copy is what stops AskPauli's access.)
 *
 * Auth: Clerk bearer. No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { deleteTokens } from '../_lib/box.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyResponseSecurity(res, headerString(req.headers.origin), { methods: 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const userId = await requireUser(req, res);
  if (!userId) return;
  await deleteTokens(userId);
  res.status(200).json({ ok: true });
}
