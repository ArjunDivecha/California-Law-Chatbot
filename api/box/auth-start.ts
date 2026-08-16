/**
 * api/box/auth-start.ts
 *
 * GET /api/box/auth-start
 *   Authorization: Bearer <Clerk JWT>
 *   → 200 { url } — the Box OAuth authorize URL for this user
 *
 * The client opens the returned URL in a new tab/window; Box redirects to
 * /api/box/callback with a single-use state nonce that maps back to this
 * user. Fetched (not navigated) so the Clerk bearer header is available.
 *
 * No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { boxConfigured, createAuthorizeUrl, redirectUriForOrigin } from '../_lib/box.js';
import { scrubMessage } from '../_lib/scrubError.js';

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
    res.status(503).json({ error: 'box_not_configured' });
    return;
  }
  // The OAuth redirect must land on the SAME origin the app is served from
  // (web: app.askpauli.com; desktop sidecar: 127.0.0.1:8477; dev: 5173).
  const origin = headerString(req.headers.origin) || `http://${headerString(req.headers.host) ?? ''}`;
  const redirectUri = redirectUriForOrigin(origin);
  if (!redirectUri) {
    res.status(400).json({ error: 'bad_origin' });
    return;
  }
  try {
    const url = await createAuthorizeUrl(userId, redirectUri);
    res.status(200).json({ url });
  } catch (err) {
    res.status(500).json({ error: scrubMessage(err instanceof Error ? err.message : String(err)) });
  }
}
