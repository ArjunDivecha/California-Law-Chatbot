/**
 * api/box/callback.ts
 *
 * GET /api/box/callback?code=…&state=…   (top-level browser navigation
 * FROM Box — no Clerk header available; the user is identified by the
 * single-use state nonce stashed by auth-start.)
 *
 * Exchanges the code for tokens, persists them for the user, and renders a
 * tiny page that closes itself / bounces back to the Draft page.
 *
 * No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consumeState, exchangeCode } from '../_lib/box.js';

function page(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>AskPauli × Box</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#1a1a1a;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{max-width:420px;text-align:center;padding:2rem;border:1px solid #e5e7eb;border-radius:12px}
</style></head><body><div class="card">${body}</div>
<script>try{if(window.opener){window.opener.postMessage('askpauli-box-connected','*');}}catch(e){}
setTimeout(function(){ window.close(); if(!window.closed){ location.href='/v2/draft'; } }, 1200);</script>
</body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!code || !state) {
    res.status(400).send(page('<h3>Box connection failed</h3><p>Missing code or state. Close this window and try again.</p>'));
    return;
  }
  const rec = await consumeState(state);
  if (!rec) {
    console.error('[box/callback] state lookup failed (expired, reused, or store mismatch)');
    res.status(400).send(page('<h3>Box connection failed</h3><p>This sign-in link expired or was already used. Close this window and try again.</p>'));
    return;
  }
  try {
    await exchangeCode(rec.user_id, code, rec.redirect_uri);
    res.status(200).send(page('<h3>Box connected ✓</h3><p>You can close this window and return to AskPauli.</p>'));
  } catch (err) {
    // Server log only — never render Box's raw error (may echo the code).
    console.error('[box/callback] token exchange failed:', err instanceof Error ? err.message : String(err));
    res
      .status(502)
      .send(page('<h3>Box connection failed</h3><p>Box rejected the sign-in. Close this window and try again.</p>'));
  }
}
