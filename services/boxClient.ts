/**
 * services/boxClient.ts
 *
 * Browser-side client for the /api/box/* routes (Box integration,
 * 2026-08-08). All calls attach the Clerk bearer token, mirroring
 * utils/chatStoreV2.ts. File CONTENT downloaded here lands in the browser
 * and flows into the same extractTextFromFile → PII tokenization funnel as
 * paste/upload — never call any model path from this module.
 *
 * No file I/O (network only).
 */

export interface BoxItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified_at?: string;
}

export interface BoxListing {
  folder: { id: string; name: string };
  items: BoxItem[];
}

export interface BoxStatus {
  configured: boolean;
  connected: boolean;
  login?: string;
}

type GetToken = () => Promise<string | null>;

async function authed(getToken: GetToken, path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken().catch(() => null);
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function boxStatus(getToken: GetToken): Promise<BoxStatus> {
  const r = await authed(getToken, '/api/box/status');
  if (!r.ok) return { configured: false, connected: false };
  return (await r.json()) as BoxStatus;
}

/** Begin the OAuth flow: opens Box sign-in in a new window. Resolves true
 *  once the callback page posts 'askpauli-box-connected' (or the user's
 *  connection shows up on a status poll), false on timeout/cancel. */
export async function connectBox(getToken: GetToken, timeoutMs = 120_000): Promise<boolean> {
  const r = await authed(getToken, '/api/box/auth-start');
  if (!r.ok) return false;
  const { url } = (await r.json()) as { url?: string };
  if (!url) return false;
  const w = window.open(url, 'askpauli-box-oauth', 'width=560,height=720');
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      window.clearInterval(poll);
      window.clearTimeout(deadline);
      resolve(ok);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data === 'askpauli-box-connected') finish(true);
    };
    window.addEventListener('message', onMsg);
    // Belt-and-braces: poll status in case postMessage is blocked.
    const poll = window.setInterval(() => {
      void boxStatus(getToken).then((s) => {
        if (s.connected) finish(true);
      });
      if (w && w.closed) {
        // Window closed — one last status check settles it.
        void boxStatus(getToken).then((s) => finish(s.connected));
      }
    }, 2000);
    const deadline = window.setTimeout(() => finish(false), timeoutMs);
  });
}

export async function disconnectBox(getToken: GetToken): Promise<void> {
  await authed(getToken, '/api/box/disconnect', { method: 'POST' });
}

export async function listBoxFolder(getToken: GetToken, folderId = '0'): Promise<BoxListing> {
  const r = await authed(getToken, `/api/box/list?folder_id=${encodeURIComponent(folderId)}`);
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `list failed (${r.status})`);
  }
  return (await r.json()) as BoxListing;
}

/** Download a Box file as a File object, ready for extractTextFromFile. */
export async function downloadBoxFile(getToken: GetToken, item: BoxItem): Promise<File> {
  const r = await authed(getToken, `/api/box/download?file_id=${encodeURIComponent(item.id)}`);
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `download failed (${r.status})`);
  }
  const blob = await r.blob();
  return new File([blob], item.name, { type: blob.type });
}

export interface BoxUploadResult {
  id: string;
  name: string;
  version?: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Upload a blob to Box: as a new version when fileId is given, else as a
 *  new file in folderId. On a 409 name conflict the server returns the
 *  conflicting file id and we retry as a new version of that file. */
export async function uploadToBox(
  getToken: GetToken,
  blob: Blob,
  name: string,
  opts: { folderId?: string; fileId?: string },
): Promise<BoxUploadResult> {
  const content_base64 = await blobToBase64(blob);
  const post = (body: Record<string, unknown>) =>
    authed(getToken, '/api/box/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let r = await post({ name, content_base64, folder_id: opts.folderId, file_id: opts.fileId });
  if (r.status === 409) {
    const e = (await r.json().catch(() => ({}))) as { conflicting_file_id?: string | null };
    if (e.conflicting_file_id) {
      r = await post({ name, content_base64, file_id: e.conflicting_file_id });
    }
  }
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `upload failed (${r.status})`);
  }
  return (await r.json()) as BoxUploadResult;
}
