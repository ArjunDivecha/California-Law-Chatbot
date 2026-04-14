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

dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // loads .env.local (overrides .env)

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
