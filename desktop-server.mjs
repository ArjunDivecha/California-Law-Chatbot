/**
 * =============================================================================
 * SCRIPT NAME: desktop-server.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Self-contained local API + static server for the desktop (Tauri) build of
 * California Law Chatbot. This is the "sidecar" the Tauri shell spawns on
 * launch (src-tauri/src/lib.rs). Differences from dev-server.js:
 *
 *   1. LOCAL-ONLY DATA: Upstash Redis credentials are DELETED from the
 *      environment before any API handler is imported, and a SQLite adapter
 *      (api/_lib/desktop/sqliteKv.ts) is injected into sessionStore and
 *      auditLog. Sessions, tool-result cache, locks, rate-limit counters and
 *      audit records never leave the machine. Vercel Blob credentials are
 *      also stripped (the V2 UI persists chats in IndexedDB; /api/chats is
 *      legacy and is NOT mounted here).
 *   2. SERVES THE FRONT END: statically serves the Vite build output (dist/)
 *      with an SPA fallback, so the Tauri webview loads everything from
 *      http://127.0.0.1:$DESKTOP_PORT — no Vite dev server needed.
 *   3. Binds 127.0.0.1 only (never exposed on the network).
 *
 * The Anthropic call path is unchanged: the same agent loop, policy engine,
 * PII backstop and tools as production, talking directly to the Anthropic
 * API under the commercial no-training terms + DPA.
 *
 * INPUT FILES:
 * - <repo>/.env and <repo>/.env.local — API keys (ANTHROPIC_API_KEY, etc.)
 * - /Users/arjundivecha/Dropbox/AAA Backup/.env.txt — fallback keys (per
 *   global CLAUDE.md convention; same loader as dev-server.js)
 * - <repo>/dist/ — built front end (run `yarn build` first)
 *
 * OUTPUT FILES:
 * - $DESKTOP_DATA_DIR/sessions.db (default: ~/Library/Application Support/
 *   California Law Chatbot/sessions.db) — SQLite store for sessions/audit.
 *
 * USAGE:
 *   yarn build && ./node_modules/.bin/tsx desktop-server.mjs
 *   (or let the Tauri app spawn it: yarn desktop)
 * =============================================================================
 */

import express from 'express';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Fallback: load any still-missing keys from ~/Dropbox/AAA Backup/.env.txt
// (same loader as dev-server.js — kept in sync manually).
(function loadFallbackEnv() {
  const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'COURTLISTENER_API_KEY'];
  if (required.every((k) => process.env[k])) return;
  let text;
  try {
    text = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw.trim();
    if (v.startsWith('"')) {
      const close = v.indexOf('"', 1);
      v = close > 0 ? v.slice(1, close) : v.slice(1);
    } else if (v.startsWith("'")) {
      const close = v.indexOf("'", 1);
      v = close > 0 ? v.slice(1, close) : v.slice(1);
    } else {
      const cut = v.search(/\s|#/);
      if (cut >= 0) v = v.slice(0, cut);
    }
    process.env[k] = v;
  }
})();

// ---------------------------------------------------------------------------
// DESKTOP MODE: sever every cloud data-store BEFORE importing API handlers.
// sessionStore/auditLog resolve clients lazily from these vars — deleting
// them guarantees that even a code path we miss fails closed (throws)
// instead of silently writing session data to Upstash.
// ---------------------------------------------------------------------------
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { SqliteKv } = await import('./api/_lib/desktop/sqliteKv.ts');
const { setSessionRedis } = await import('./api/_lib/sessionStore.ts');
const { setAuditSink } = await import('./api/_shared/auditLog.ts');

const kv = new SqliteKv();
setSessionRedis(kv);
setAuditSink(kv);

const app = express();
app.use(express.json({ limit: '10mb' }));

const loadHandler = async (path) => {
  const module = await import(path);
  return module.default;
};

// V2 agent-loop surface (same routes as dev-server.js, minus legacy /api/chats
// which the V2 UI no longer calls — chats persist in IndexedDB client-side).
const API_ROUTES = [
  '/api/export-document',
  '/api/matter-context',
  '/api/agent/turn',
  '/api/agent/turn-stream',
  '/api/agent/draft-stream',
  '/api/agent/revise-section',
  '/api/agent/drafting-magic',
  '/api/agent/verify-stream',
  '/api/agent/sessions',
  '/api/agent/session',
];
for (const route of API_ROUTES) {
  const file = './' + route.replace('/api/', 'api/') + '.ts';
  app.all(route, async (req, res) => {
    const handler = await loadHandler(file);
    await handler(req, res);
  });
}

app.get('/api/desktop/health', (_req, res) => {
  res.json({ ok: true, store: 'sqlite', db: kv.dbPath });
});

// Static front end (Vite build) + SPA fallback.
const DIST = resolve('dist');
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('❌ dist/index.html not found — run `yarn build` first.');
  process.exit(1);
}
app.use(express.static(DIST));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(join(DIST, 'index.html'));
  } else {
    next();
  }
});

const PORT = Number(process.env.DESKTOP_PORT || 8477);
app.listen(PORT, '127.0.0.1', () => {
  console.log('='.repeat(60));
  console.log(`🖥  Desktop server on http://127.0.0.1:${PORT}`);
  console.log(`   Session store: SQLite → ${kv.dbPath}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ missing'}`);
  console.log(`   Upstash/Blob env: stripped (local-only mode)`);
  console.log('='.repeat(60));
});
