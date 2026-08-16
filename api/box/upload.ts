/**
 * api/box/upload.ts
 *
 * POST /api/box/upload
 *   body (JSON): { name, content_base64, folder_id? , file_id? }
 *     - file_id set   → upload as a NEW VERSION of that Box file
 *     - else folder_id → upload as a new file into that folder
 *   → 200 { id, name, version? }
 *
 * The bytes come FROM the browser (the DOCX is generated client-side with
 * real values — Box is the firm's own store, not model egress). Base64 in
 * JSON keeps one code path across Vercel/dev/desktop body parsing; drafting
 * documents are small enough that the 33% inflation is irrelevant.
 *
 * Auth: Clerk bearer. No file I/O (memory passthrough only).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { BOX_UPLOAD_BASE, boxFetch } from '../_lib/box.js';
import { scrubMessage } from '../_lib/scrubError.js';

const MAX_BYTES = 50 * 1024 * 1024;

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

  const body = (req.body ?? {}) as {
    name?: string;
    content_base64?: string;
    folder_id?: string;
    file_id?: string;
  };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || !body.content_base64) {
    res.status(400).json({ error: 'name and content_base64 are required' });
    return;
  }
  const fileId = body.file_id && /^\d+$/.test(body.file_id) ? body.file_id : null;
  const folderId = body.folder_id && /^\d+$/.test(body.folder_id) ? body.folder_id : '0';
  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.content_base64, 'base64');
  } catch {
    res.status(400).json({ error: 'bad_base64' });
    return;
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    res.status(413).json({ error: 'bad_size' });
    return;
  }

  const url = fileId
    ? `${BOX_UPLOAD_BASE}/files/${fileId}/content`
    : `${BOX_UPLOAD_BASE}/files/content`;
  const form = new FormData();
  form.append(
    'attributes',
    JSON.stringify(fileId ? { name } : { name, parent: { id: folderId } }),
  );
  form.append('file', new Blob([new Uint8Array(bytes)]), name);

  try {
    const resp = await boxFetch(userId, url, { method: 'POST', body: form });
    if (resp.status === 409) {
      // Name collision on new-file upload: surface so the client can retry
      // as a new version of the conflicting file.
      const detail = (await resp.json().catch(() => null)) as {
        context_info?: { conflicts?: { id?: string } };
      } | null;
      res.status(409).json({
        error: 'name_conflict',
        conflicting_file_id: detail?.context_info?.conflicts?.id ?? null,
      });
      return;
    }
    if (!resp.ok) {
      res.status(resp.status === 401 ? 401 : 502).json({ error: `box_${resp.status}` });
      return;
    }
    const data = (await resp.json()) as {
      entries?: Array<{ id: string; name: string; file_version?: { id: string } }>;
    };
    const entry = data.entries?.[0];
    res.status(200).json({
      id: entry?.id ?? fileId,
      name: entry?.name ?? name,
      version: entry?.file_version?.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'not_connected') {
      res.status(401).json({ error: 'not_connected' });
      return;
    }
    res.status(500).json({ error: scrubMessage(msg) });
  }
}
