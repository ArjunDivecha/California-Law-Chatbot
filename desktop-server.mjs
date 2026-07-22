/**
 * =============================================================================
 * SCRIPT NAME: desktop-server.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Self-contained local API + static server for the desktop (Tauri) build of
 * AskPauli — the "sidecar" the Tauri shell runs. Serves the
 * built front end (dist/) and the full V2 agent-loop API on
 * http://127.0.0.1:$DESKTOP_PORT (default 8477), bound to loopback only.
 *
 * LOCAL-ONLY DATA: desktop-env.mjs (imported FIRST — order matters) loads
 * API keys and then deletes all Upstash/Blob credentials; this file injects
 * the SQLite adapter (api/_lib/desktop/sqliteKv.ts) into sessionStore and
 * auditLog. Sessions, tool-result cache, locks, rate-limit counters and
 * audit records live in ~/Library/Application Support/AskPauli/sessions.db
 * and never leave the machine. Legacy /api/chats
 * (Vercel Blob) is NOT mounted — the V2 UI persists chats in IndexedDB.
 *
 * All route handlers are STATIC imports so esbuild can bundle this file into
 * a single .cjs for the packaged .app (scripts/build-desktop-sidecar.mjs).
 * The Anthropic call path is unchanged from production: same agent loop,
 * policy engine, PII backstop and tools, direct to the Anthropic API.
 *
 * INPUT FILES:
 * - .env / .env.local / app-support .env / AAA fallback — see desktop-env.mjs
 * - $DESKTOP_DIST or <cwd>/dist — built front end (`yarn build`)
 * - <bundle>/../../agents/california-legal/** — agent config + skills,
 *   resolved by api/_lib/skills.ts relative to its module location
 *
 * OUTPUT FILES:
 * - $DESKTOP_DATA_DIR/sessions.db (default: ~/Library/Application Support/
 *   AskPauli/sessions.db) — SQLite store for sessions/audit
 *
 * USAGE:
 *   yarn build && yarn desktop:server          # from the repo root
 *   (or the packaged app runs the esbuild bundle: see src-tauri/src/lib.rs)
 * =============================================================================
 */

import './desktop-env.mjs'; // FIRST: env load + cloud-credential strip

import express from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SqliteKv } from './api/_lib/desktop/sqliteKv.ts';
import { setSessionRedis } from './api/_lib/sessionStore.ts';
import { setAuditSink } from './api/_shared/auditLog.ts';

// V2 agent-loop surface (same routes as dev-server.js, minus legacy /api/chats).
import exportDocument from './api/export-document.ts';
import matterContext from './api/matter-context.ts';
import agentTurn from './api/agent/turn.ts';
import agentTurnStream from './api/agent/turn-stream.ts';
import agentDraftStream from './api/agent/draft-stream.ts';
import agentReviseSection from './api/agent/revise-section.ts';
import agentDraftingMagic from './api/agent/drafting-magic.ts';
import agentVerifyStream from './api/agent/verify-stream.ts';
import agentSessions from './api/agent/sessions.ts';
import agentSession from './api/agent/session.ts';

const kv = new SqliteKv();
setSessionRedis(kv);
setAuditSink(kv);

const app = express();
app.use(express.json({ limit: '10mb' }));

const ROUTES = {
  '/api/export-document': exportDocument,
  '/api/matter-context': matterContext,
  '/api/agent/turn': agentTurn,
  '/api/agent/turn-stream': agentTurnStream,
  '/api/agent/draft-stream': agentDraftStream,
  '/api/agent/revise-section': agentReviseSection,
  '/api/agent/drafting-magic': agentDraftingMagic,
  '/api/agent/verify-stream': agentVerifyStream,
  '/api/agent/sessions': agentSessions,
  '/api/agent/session': agentSession,
};
for (const [route, handler] of Object.entries(ROUTES)) {
  app.all(route, (req, res) => handler(req, res));
}

app.get('/api/desktop/health', (_req, res) => {
  res.json({ ok: true, store: 'sqlite', db: kv.dbPath });
});

// Static front end (Vite build) + SPA fallback.
const DIST = process.env.DESKTOP_DIST
  ? resolve(process.env.DESKTOP_DIST)
  : resolve('dist');
if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`❌ ${DIST}/index.html not found — run \`yarn build\` first.`);
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
  console.log(`   Front end: ${DIST}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ missing'}`);
  console.log(`   Upstash/Blob env: stripped (local-only mode)`);
  console.log('='.repeat(60));
});
