/**
 * api/box/list.ts
 *
 * GET /api/box/list?folder_id=0 → 200 { folder: {id,name}, items: [...] }
 *   items: { id, name, type: 'folder'|'file', size?, modified_at? }
 *
 * Folder listing for the in-app Box browser. Only names/ids/metadata flow
 * through here — never file content (that's download.ts, byte passthrough).
 *
 * Auth: Clerk bearer. No file I/O.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../_lib/httpGuard.js';
import { applyResponseSecurity, headerString } from '../_shared/routeSecurity.js';
import { BOX_API_BASE, boxFetch } from '../_lib/box.js';
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
  const raw = Array.isArray(req.query.folder_id) ? req.query.folder_id[0] : req.query.folder_id;
  const folderId = raw && /^\d+$/.test(raw) ? raw : '0';
  try {
    const resp = await boxFetch(
      userId,
      `${BOX_API_BASE}/folders/${folderId}/items?limit=500&fields=id,name,type,size,modified_at&usemarker=false`,
    );
    if (!resp.ok) {
      res.status(resp.status === 401 ? 401 : 502).json({ error: `box_${resp.status}` });
      return;
    }
    const data = (await resp.json()) as {
      entries?: Array<{ id: string; name: string; type: string; size?: number; modified_at?: string }>;
    };
    // Folder name for breadcrumbs (root has no fetchable name worth a call).
    let folderName = 'All files';
    if (folderId !== '0') {
      const f = await boxFetch(userId, `${BOX_API_BASE}/folders/${folderId}?fields=name`);
      if (f.ok) folderName = ((await f.json()) as { name?: string }).name ?? folderName;
    }
    res.status(200).json({
      folder: { id: folderId, name: folderName },
      items: (data.entries ?? [])
        .filter((e) => e.type === 'folder' || e.type === 'file')
        .map((e) => ({ id: e.id, name: e.name, type: e.type, size: e.size, modified_at: e.modified_at })),
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
