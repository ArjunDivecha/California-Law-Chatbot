/**
 * api/box/download.ts
 *
 * GET /api/box/download?file_id=… → raw file bytes.
 *
 * ⚠️ TRUST-BOUNDARY CRITICAL: this route is a BYTE PASSTHROUGH. Box content
 * goes straight back to the browser, where the existing on-device
 * extractTextFromFile → PII tokenization funnel runs before anything
 * reaches a model. This handler must never parse, log, cache, or forward
 * the content anywhere else. See the /btw design note in llmchat context:
 * a careless implementation here is the one place the sanitizer guarantee
 * could be bypassed.
 *
 * Auth: Clerk bearer. No file I/O (memory passthrough only).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { BOX_API_BASE, boxFetch } from '../_lib/box.js';
import { scrubMessage } from '../_lib/scrubError.js';

/** Refuse absurd downloads: drafting sources are documents, not media. */
const MAX_BYTES = 50 * 1024 * 1024;

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
  const raw = Array.isArray(req.query.file_id) ? req.query.file_id[0] : req.query.file_id;
  if (!raw || !/^\d+$/.test(raw)) {
    res.status(400).json({ error: 'bad_file_id' });
    return;
  }
  try {
    const resp = await boxFetch(userId, `${BOX_API_BASE}/files/${raw}/content`, { redirect: 'follow' });
    if (!resp.ok) {
      res.status(resp.status === 401 ? 401 : 502).json({ error: `box_${resp.status}` });
      return;
    }
    const len = Number(resp.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) {
      res.status(413).json({ error: 'file_too_large' });
      return;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'file_too_large' });
      return;
    }
    res.setHeader('Content-Type', resp.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'not_connected') {
      res.status(401).json({ error: 'not_connected' });
      return;
    }
    res.status(500).json({ error: scrubMessage(msg) });
  }
}
