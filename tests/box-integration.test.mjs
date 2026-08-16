/**
 * tests/box-integration.test.mjs
 *
 * Unit tests for api/_lib/box.ts (Box integration, 2026-08-08): OAuth state
 * lifecycle, token refresh policy, redirect-URI validation, and authorize-URL
 * shape — all against an injected in-memory SessionRedis (no network, no
 * real Box).
 *
 * Input files:  none (pure unit tests; BOX_CLIENT_ID/SECRET set to dummies)
 * Output files: none (exit code + stdout only)
 * Usage:        ./node_modules/.bin/tsx tests/box-integration.test.mjs
 */

process.env.BOX_CLIENT_ID = 'test-client-id';
process.env.BOX_CLIENT_SECRET = 'test-client-secret';

import { setSessionRedis } from '../api/_lib/sessionStore.js';
import {
  createAuthorizeUrl,
  consumeState,
  needsRefresh,
  redirectUriForOrigin,
  readTokens,
  deleteTokens,
  boxConfigured,
} from '../api/_lib/box.js';

// Minimal in-memory SessionRedis. Mimics Upstash's auto-deserialization:
// get() returns parsed JSON objects, not raw strings — this exact behavior
// difference (vs the SQLite store's raw strings) caused the live OAuth
// state-lookup failure on 2026-08-08, so the mock must reproduce it.
const mem = new Map();
setSessionRedis({
  async get(k) {
    if (!mem.has(k)) return null;
    const v = mem.get(k);
    try { return JSON.parse(v); } catch { return v; }
  },
  async set(k, v, _o) { mem.set(k, v); return 'OK'; },
  async del(k) { const had = mem.delete(k); return had ? 1 : 0; },
  async expire() { return 1; },
  async incr(k) { const v = (Number(mem.get(k)) || 0) + 1; mem.set(k, String(v)); return v; },
  async hset() { return 1; },
  async hgetall() { return {}; },
  async rpush() { return 1; },
  async lrange() { return []; },
  async zadd() { return 1; },
  async zrange() { return []; },
  async zrem() { return 1; },
  async zcard() { return 0; },
});

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log(`✅ ${name}`); }
  else { failed += 1; console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

check('boxConfigured true with env set', boxConfigured() === true);

// ---------- authorize URL ----------
const url = await createAuthorizeUrl('user_123', 'https://app.askpauli.com/api/box/callback');
const u = new URL(url);
check('authorize URL host', u.origin + u.pathname === 'https://account.box.com/api/oauth2/authorize');
check('authorize URL client_id', u.searchParams.get('client_id') === 'test-client-id');
check('authorize URL redirect_uri', u.searchParams.get('redirect_uri') === 'https://app.askpauli.com/api/box/callback');
const nonce = u.searchParams.get('state');
check('authorize URL has state nonce ≥32 chars', typeof nonce === 'string' && nonce.length >= 32);

// ---------- state lifecycle ----------
const rec = await consumeState(nonce);
check('state resolves to user + redirect', rec?.user_id === 'user_123' && rec?.redirect_uri.endsWith('/api/box/callback'));
check('state is single-use', (await consumeState(nonce)) === null);
check('unknown state → null', (await consumeState('deadbeef')) === null);

// ---------- refresh policy ----------
const now = Date.now();
check('fresh token (30 min left) → no refresh', needsRefresh({ expires_at: now + 30 * 60_000 }, now) === false);
check('4 min left → refresh', needsRefresh({ expires_at: now + 4 * 60_000 }, now) === true);
check('expired → refresh', needsRefresh({ expires_at: now - 1000 }, now) === true);

// ---------- redirect URI validation ----------
check('https origin ok', redirectUriForOrigin('https://app.askpauli.com') === 'https://app.askpauli.com/api/box/callback');
check('localhost http ok (desktop sidecar)', redirectUriForOrigin('http://127.0.0.1:8477') === 'http://127.0.0.1:8477/api/box/callback');
check('dev localhost ok', redirectUriForOrigin('http://localhost:5173') === 'http://localhost:5173/api/box/callback');
check('plain http non-local rejected', redirectUriForOrigin('http://evil.example.com') === null);
check('garbage origin rejected', redirectUriForOrigin('not a url') === null);

// ---------- token storage round-trip ----------
mem.set('box:user_9:tokens', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: now + 3600_000, box_login: 'me@x.com' }));
const t = await readTokens('user_9');
check('readTokens round-trip', t?.access_token === 'a' && t?.box_login === 'me@x.com');
await deleteTokens('user_9');
check('deleteTokens clears', (await readTokens('user_9')) === null);
check('readTokens on corrupt JSON → null', await (async () => { mem.set('box:u2:tokens', '{nope'); return (await readTokens('u2')) === null; })());

console.log(`\nBox integration: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
