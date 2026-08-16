/**
 * api/_lib/box.ts
 *
 * Box integration core (2026-08-08): per-user OAuth 2.0 token management and
 * a thin authenticated fetch wrapper around the Box REST API. Used by every
 * api/box/* route in all three runtimes (Vercel prod, local dev-server,
 * Tauri desktop sidecar) — token storage goes through the injectable
 * SessionRedis interface (sessionStore.ts), so the web keeps tokens in
 * Upstash Redis and the desktop keeps them in local SQLite automatically.
 *
 * TRUST BOUNDARY NOTE: this module moves FILE BYTES and TOKENS only. File
 * content fetched from Box must stream back to the browser untouched — it is
 * sanitized on-device by the existing wire pipeline before any model call.
 * Nothing here may ever forward Box content to the model or any third party.
 *
 * ENV: BOX_CLIENT_ID, BOX_CLIENT_SECRET (personal dev app for now; swap
 * values for the Femme & Femme enterprise app at cutover — no code change).
 *
 * No file I/O.
 */

import { randomBytes } from 'node:crypto';
import { getRedis } from './sessionStore.js';

const BOX_AUTH_BASE = 'https://account.box.com/api/oauth2';
const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token';
export const BOX_API_BASE = 'https://api.box.com/2.0';
export const BOX_UPLOAD_BASE = 'https://upload.box.com/api/2.0';

/** OAuth state entries expire after 10 minutes. */
const STATE_TTL_S = 600;
/** Refresh the access token when less than this many ms remain. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface BoxTokens {
  access_token: string;
  refresh_token: string;
  /** Epoch ms when access_token expires. */
  expires_at: number;
  /** Box login (email) captured at connect time, for the status endpoint. */
  box_login?: string;
}

interface StateRecord {
  user_id: string;
  redirect_uri: string;
}

function tokensKey(userId: string): string {
  return `box:${userId}:tokens`;
}

function stateKey(nonce: string): string {
  return `box:oauthstate:${nonce}`;
}

export function boxClientId(): string {
  const id = process.env.BOX_CLIENT_ID;
  if (!id) throw new Error('BOX_CLIENT_ID is not configured');
  return id;
}

function boxClientSecret(): string {
  const s = process.env.BOX_CLIENT_SECRET;
  if (!s) throw new Error('BOX_CLIENT_SECRET is not configured');
  return s;
}

export function boxConfigured(): boolean {
  return Boolean(process.env.BOX_CLIENT_ID && process.env.BOX_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/** Create the Box authorize URL for this user; stashes the state nonce. */
export async function createAuthorizeUrl(userId: string, redirectUri: string): Promise<string> {
  const nonce = randomBytes(24).toString('hex');
  const record: StateRecord = { user_id: userId, redirect_uri: redirectUri };
  await getRedis().set(stateKey(nonce), JSON.stringify(record), { ex: STATE_TTL_S });
  const u = new URL(`${BOX_AUTH_BASE}/authorize`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', boxClientId());
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', nonce);
  return u.toString();
}

/** Resolve + consume an OAuth state nonce (single use). */
export async function consumeState(nonce: string): Promise<StateRecord | null> {
  const redis = getRedis();
  const raw = await redis.get(stateKey(nonce));
  if (!raw) return null;
  await redis.del(stateKey(nonce));
  try {
    // Upstash auto-deserializes JSON values on get (returns an object); the
    // SQLite desktop store returns the raw string. Accept both.
    const rec = (typeof raw === 'string' ? JSON.parse(raw) : raw) as StateRecord;
    if (rec && typeof rec.user_id === 'string' && typeof rec.redirect_uri === 'string') return rec;
  } catch {
    /* fall through */
  }
  return null;
}

async function tokenRequest(params: Record<string, string>): Promise<BoxTokens> {
  const resp = await fetch(BOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: boxClientId(),
      client_secret: boxClientSecret(),
      ...params,
    }).toString(),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Box token endpoint ${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/** Exchange an authorization code and persist tokens for the user. */
export async function exchangeCode(userId: string, code: string, redirectUri: string): Promise<BoxTokens> {
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  // Capture the Box login for the status endpoint (best effort).
  try {
    const me = await fetch(`${BOX_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (me.ok) {
      const info = (await me.json()) as { login?: string };
      if (info.login) tokens.box_login = info.login;
    }
  } catch {
    /* non-fatal */
  }
  await getRedis().set(tokensKey(userId), JSON.stringify(tokens));
  return tokens;
}

export async function readTokens(userId: string): Promise<BoxTokens | null> {
  const raw = await getRedis().get(tokensKey(userId));
  if (!raw) return null;
  try {
    const t = typeof raw === 'string' ? (JSON.parse(raw) as BoxTokens) : (raw as BoxTokens);
    if (t && typeof t.access_token === 'string' && typeof t.refresh_token === 'string') return t;
  } catch {
    /* fall through */
  }
  return null;
}

export async function deleteTokens(userId: string): Promise<void> {
  await getRedis().del(tokensKey(userId));
}

/** True when this access token needs a refresh before use. Pure — tested. */
export function needsRefresh(tokens: Pick<BoxTokens, 'expires_at'>, nowMs = Date.now()): boolean {
  return tokens.expires_at - nowMs < REFRESH_MARGIN_MS;
}

/**
 * Valid access token for the user, refreshing (and persisting the rotated
 * refresh token) when necessary. Throws 'not_connected' when the user has
 * no Box connection or the refresh token has been revoked/expired.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await readTokens(userId);
  if (!tokens) throw new Error('not_connected');
  if (!needsRefresh(tokens)) return tokens.access_token;
  let refreshed: BoxTokens;
  try {
    refreshed = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    });
  } catch (err) {
    // Refresh token rotated away or revoked: connection is dead. Clear it so
    // the UI cleanly shows "connect" again rather than looping on errors.
    await deleteTokens(userId);
    throw new Error('not_connected');
  }
  refreshed.box_login = tokens.box_login;
  await getRedis().set(tokensKey(userId), JSON.stringify(refreshed));
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Box API wrapper
// ---------------------------------------------------------------------------

/** Authenticated fetch against the Box API for this user. */
export async function boxFetch(userId: string, url: string, init?: RequestInit): Promise<Response> {
  const token = await getValidAccessToken(userId);
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

/** Compute this deployment's OAuth redirect URI from the request origin.
 *  Pure — tested. Only https origins and localhost are accepted. */
export function redirectUriForOrigin(origin: string): string | null {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return null;
  }
  const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !isLocal) return null;
  return `${u.origin}/api/box/callback`;
}
