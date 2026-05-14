/**
 * Local Development API Server
 * 
 * Runs the Vercel API functions locally for development.
 * Start with: node dev-server.js
 * Then run: npm run dev (in another terminal)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // loads .env.local (overrides .env)

// Fallback: load any still-missing keys from ~/Dropbox/AAA Backup/.env.txt
// per the global CLAUDE.md convention. Matches the env-loader the test
// scripts use (latency-baseline.mjs, agent-loop-smoke.mjs). Local dev-only
// — Vercel production loads env vars through the platform.
(function loadFallbackEnv() {
  const required = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'UPSTASH_VECTOR_REST_URL',
    'UPSTASH_VECTOR_REST_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'COURTLISTENER_API_KEY',
    // V2 session endpoints + V1 chats endpoint verify Clerk JWTs server-
    // side. Without CLERK_SECRET_KEY the sidebar fetches 401.
    'CLERK_SECRET_KEY',
    'LEGISCAN_API_KEY',
    'OPENSTATES_API_KEY',
  ];
  if (required.every((k) => process.env[k])) return;
  let text;
  try {
    text = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
  } catch {
    return; // file not readable — leave keys missing, caller will report
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

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Import API handlers dynamically
const loadHandler = async (path) => {
  const module = await import(path);
  return module.default;
};

// API Routes
app.all('/api/gemini-chat', async (req, res) => {
  const handler = await loadHandler('./api/gemini-chat.ts');
  await handler(req, res);
});

app.all('/api/claude-chat', async (req, res) => {
  const handler = await loadHandler('./api/claude-chat.ts');
  await handler(req, res);
});

app.all('/api/anthropic-chat', async (req, res) => {
  const handler = await loadHandler('./api/anthropic-chat.ts');
  await handler(req, res);
});

app.all('/api/ceb-search', async (req, res) => {
  const handler = await loadHandler('./api/ceb-search.ts');
  await handler(req, res);
});

app.all('/api/config', async (req, res) => {
  const handler = await loadHandler('./api/config.ts');
  await handler(req, res);
});

app.all('/api/courtlistener-search', async (req, res) => {
  const handler = await loadHandler('./api/courtlistener-search.ts');
  await handler(req, res);
});

app.all('/api/legislative-search', async (req, res) => {
  const handler = await loadHandler('./api/legislative-search.ts');
  await handler(req, res);
});

app.all('/api/legislative-billtext', async (req, res) => {
  const handler = await loadHandler('./api/legislative-billtext.ts');
  await handler(req, res);
});

app.all('/api/verify-citations', async (req, res) => {
  const handler = await loadHandler('./api/verify-citations.ts');
  await handler(req, res);
});

app.all('/api/templates', async (req, res) => {
  const handler = await loadHandler('./api/templates.ts');
  await handler(req, res);
});

app.all('/api/orchestrate-document', async (req, res) => {
  const handler = await loadHandler('./api/orchestrate-document.ts');
  await handler(req, res);
});

app.all('/api/export-document', async (req, res) => {
  const handler = await loadHandler('./api/export-document.ts');
  await handler(req, res);
});

app.all('/api/serper-scholar', async (req, res) => {
  const handler = await loadHandler('./api/serper-scholar.ts');
  await handler(req, res);
});

// Chat history routes (single flat file, uses ?id= query param)
app.all('/api/chats', async (req, res) => {
  const handler = await loadHandler('./api/chats.ts');
  await handler(req, res);
});

// V2 agent loop — non-streaming + streaming endpoints
app.all('/api/agent/turn', async (req, res) => {
  const handler = await loadHandler('./api/agent/turn.ts');
  await handler(req, res);
});

app.all('/api/agent/turn-stream', async (req, res) => {
  const handler = await loadHandler('./api/agent/turn-stream.ts');
  await handler(req, res);
});

app.all('/api/agent/draft-stream', async (req, res) => {
  const handler = await loadHandler('./api/agent/draft-stream.ts');
  await handler(req, res);
});

app.all('/api/agent/revise-section', async (req, res) => {
  const handler = await loadHandler('./api/agent/revise-section.ts');
  await handler(req, res);
});

app.all('/api/agent/drafting-magic', async (req, res) => {
  const handler = await loadHandler('./api/agent/drafting-magic.ts');
  await handler(req, res);
});

app.all('/api/agent/shadow', async (req, res) => {
  const handler = await loadHandler('./api/agent/shadow.ts');
  await handler(req, res);
});

app.all('/api/agent/verify-stream', async (req, res) => {
  const handler = await loadHandler('./api/agent/verify-stream.ts');
  await handler(req, res);
});

app.all('/api/agent/sessions', async (req, res) => {
  const handler = await loadHandler('./api/agent/sessions.ts');
  await handler(req, res);
});

app.all('/api/agent/session', async (req, res) => {
  const handler = await loadHandler('./api/agent/session.ts');
  await handler(req, res);
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('🚀 Local API Server running on http://localhost:' + PORT);
  console.log('='.repeat(60));
  console.log('');
  console.log('Environment variables loaded:');
  console.log('  GOOGLE_GENAI_USE_VERTEXAI:', process.env.GOOGLE_GENAI_USE_VERTEXAI ? '✅ Set' : 'ℹ️ Not set');
  console.log('  VERTEX_API_KEY:', process.env.VERTEX_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : 'ℹ️ Not set');
  console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : 'ℹ️ Not set');
  console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  UPSTASH_VECTOR_REST_URL:', process.env.UPSTASH_VECTOR_REST_URL ? '✅ Set' : '❌ Missing');
  console.log('  COURTLISTENER_API_KEY:', process.env.COURTLISTENER_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');
  console.log('Now run "npm run dev" in another terminal.');
  console.log('='.repeat(60));
});
