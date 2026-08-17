/**
 * api/box/auth-start-open.ts
 *
 * POST /api/box/auth-start-open → 200 { opened: true }
 *
 * DESKTOP-ONLY route (registered in desktop-server.mjs and dev-server.js,
 * NOT deployed to Vercel — serverless can't open a browser, and the web app
 * uses the popup flow instead). Builds the Box authorize URL exactly like
 * auth-start, then opens it in the USER'S DEFAULT BROWSER via macOS `open`
 * (xdg-open on Linux). The Tauri webview cannot open popups and blocks
 * top-level navigation to external origins, so the system browser is the
 * only reliable OAuth surface on desktop. The callback still lands on the
 * sidecar (http://localhost:8477/api/box/callback); the app detects the
 * connection by polling /api/box/status.
 *
 * No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { spawn } from 'node:child_process';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { boxConfigured, createAuthorizeUrl, redirectUriForOrigin } from '../_lib/box.js';
import { scrubMessage } from '../_lib/scrubError.js';

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
  // Never available on Vercel — this route must not exist in the cloud.
  if (process.env.VERCEL) {
    res.status(404).json({ error: 'not_available' });
    return;
  }
  const userId = await requireUser(req, res);
  if (!userId) return;
  if (!boxConfigured()) {
    res.status(503).json({ error: 'box_not_configured' });
    return;
  }
  const origin = headerString(req.headers.origin) || `http://${headerString(req.headers.host) ?? ''}`;
  const redirectUri = redirectUriForOrigin(origin);
  if (!redirectUri) {
    res.status(400).json({ error: 'bad_origin' });
    return;
  }
  try {
    const url = await createAuthorizeUrl(userId, redirectUri);
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
    child.unref();
    res.status(200).json({ opened: true });
  } catch (err) {
    res.status(500).json({ error: scrubMessage(err instanceof Error ? err.message : String(err)) });
  }
}
