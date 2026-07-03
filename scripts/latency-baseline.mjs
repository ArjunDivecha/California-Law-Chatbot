/**
 * Phase 1 prerequisite — V2 stack latency baseline.
 *
 * Measures the underlying primitives the new agent loop will call as tools.
 * Old Gemini-side path is intentionally NOT measured — it's slated for
 * deletion in Phase 5 and its numbers are not comparable to the V2 stack.
 *
 * Endpoints measured (in series, 5 queries each):
 *   1. anthropic.messages.create (no tools)        — pure inference round-trip
 *   2. anthropic.messages.stream (no tools)        — streaming TTFB/TTFT/E2E
 *   3. anthropic.messages.stream + web_search      — Gemini-grounding replacement
 *   4. courtlistener_search                        — REST v4 /search/ over HTTPS
 *
 * (ceb_search primitive removed 2026-07-03 — ceb_search was retired the
 * same day; CEB's Terms & Conditions prohibit ingesting their content into
 * any database/AI application.)
 *
 * Captures:
 *   - e2e_ms: total wall-clock for the call to complete
 *   - ttfb_ms (streaming only): first event from the server
 *   - ttft_ms (streaming only): first text_delta event
 *   - token counts when available
 *
 * Output:
 *   - reports/latency-baseline-{YYYY-MM-DD}.json
 *   - human summary to stdout with per-endpoint p50/p95/avg/min/max
 *
 * Run:  yarn latency:baseline
 *
 * Env required: ANTHROPIC_API_KEY, COURTLISTENER_API_KEY.
 * Falls back to /Users/arjundivecha/Dropbox/AAA Backup/.env.txt if any
 * are missing from the current environment.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '..');

// ---------------------------------------------------------------------------
// Env loading (with fallback to ~/Dropbox/AAA Backup/.env.txt per CLAUDE.md)
// ---------------------------------------------------------------------------

function loadEnvFallback() {
  const required = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'UPSTASH_VECTOR_REST_URL',
    'UPSTASH_VECTOR_REST_TOKEN',
    'COURTLISTENER_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  const fallback = '/Users/arjundivecha/Dropbox/AAA Backup/.env.txt';
  let text;
  try {
    text = readFileSync(fallback, 'utf8');
  } catch (err) {
    throw new Error(
      `Missing env: ${missing.join(', ')}. Fallback not readable: ${err.message}`,
    );
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw.trim();
    // Handle "value" #trailing-comment OR value #comment OR plain "value".
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
  const stillMissing = required.filter((k) => !process.env[k]);
  if (stillMissing.length > 0) {
    throw new Error(`Missing required env vars: ${stillMissing.join(', ')}`);
  }
}

loadEnvFallback();

// ---------------------------------------------------------------------------
// Test queries — representative public-research prompts, no client PII
// ---------------------------------------------------------------------------

const QUERIES = [
  "What's the leading California case law on condo-association lien priority?",
  'Explain CRC 3.1320 — motion to seal requirements.',
  'Recent California Court of Appeal opinions on premises liability for slip-and-fall at grocery stores.',
  'California Probate Code section 15610 — conservator standard.',
  'What are the elements of a wrongful eviction claim in California?',
];

// Tracks DEFAULT_MODEL in api/_lib/agentLoop.ts. Bumped to Opus 4.7 per
// the 2026-05-12 fifth addendum (Anthropic's flagship legal-reasoning
// model).
const MODEL = 'claude-opus-4-7';

// ---------------------------------------------------------------------------
// Endpoint measurement primitives
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function measureAnthropicCreate(query) {
  const start = performance.now();
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: query }],
    });
    return {
      ok: true,
      e2e_ms: performance.now() - start,
      input_tokens: resp.usage?.input_tokens,
      output_tokens: resp.usage?.output_tokens,
    };
  } catch (err) {
    return { ok: false, e2e_ms: performance.now() - start, error: err.message };
  }
}

async function measureAnthropicStream(query) {
  const start = performance.now();
  let ttfb_ms = null;
  let ttft_ms = null;
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: query }],
    });
    for await (const event of stream) {
      if (ttfb_ms === null) ttfb_ms = performance.now() - start;
      if (
        ttft_ms === null &&
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        ttft_ms = performance.now() - start;
      }
    }
    const finalMsg = await stream.finalMessage();
    return {
      ok: true,
      e2e_ms: performance.now() - start,
      ttfb_ms,
      ttft_ms,
      input_tokens: finalMsg.usage?.input_tokens,
      output_tokens: finalMsg.usage?.output_tokens,
    };
  } catch (err) {
    return {
      ok: false,
      e2e_ms: performance.now() - start,
      ttfb_ms,
      ttft_ms,
      error: err.message,
    };
  }
}

async function measureAnthropicWebSearch(query) {
  const start = performance.now();
  let ttfb_ms = null;
  let ttft_ms = null;
  let toolUses = 0;
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: query }],
      tools: [
        // Anthropic-native web search — the Gemini-grounding replacement
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
      ],
    });
    for await (const event of stream) {
      if (ttfb_ms === null) ttfb_ms = performance.now() - start;
      if (
        ttft_ms === null &&
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        ttft_ms = performance.now() - start;
      }
      if (
        event.type === 'content_block_start' &&
        event.content_block?.type === 'server_tool_use'
      ) {
        toolUses += 1;
      }
    }
    const finalMsg = await stream.finalMessage();
    return {
      ok: true,
      e2e_ms: performance.now() - start,
      ttfb_ms,
      ttft_ms,
      tool_uses: toolUses,
      input_tokens: finalMsg.usage?.input_tokens,
      output_tokens: finalMsg.usage?.output_tokens,
    };
  } catch (err) {
    return {
      ok: false,
      e2e_ms: performance.now() - start,
      ttfb_ms,
      ttft_ms,
      error: err.message,
    };
  }
}

// NOTE (2026-07-03): measureCebSearch (OpenAI embed + Upstash Vector query
// across 5 CEB namespaces) was removed here — ceb_search was retired the
// same day (CEB's Terms & Conditions prohibit ingesting their content into
// any database/AI application). Neither OpenAI embeddings nor Upstash
// Vector is called anywhere else in the codebase.

async function measureCourtListener(query) {
  const start = performance.now();
  try {
    const url = new URL('https://www.courtlistener.com/api/rest/v4/search/');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'o'); // case-law opinions
    const resp = await fetch(url, {
      headers: { Authorization: `Token ${process.env.COURTLISTENER_API_KEY}` },
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        e2e_ms: performance.now() - start,
        error: `${resp.status}: ${JSON.stringify(body).slice(0, 200)}`,
      };
    }
    return {
      ok: true,
      e2e_ms: performance.now() - start,
      result_count: body.results?.length ?? 0,
      total_count: body.count ?? 0,
    };
  } catch (err) {
    return { ok: false, e2e_ms: performance.now() - start, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Run + stats
// ---------------------------------------------------------------------------

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(values) {
  const arr = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (arr.length === 0) return null;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg,
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
  };
}

const ENDPOINTS = [
  ['anthropic.messages.create', measureAnthropicCreate],
  ['anthropic.messages.stream', measureAnthropicStream],
  ['anthropic.messages.stream + web_search', measureAnthropicWebSearch],
  ['courtlistener_search', measureCourtListener],
];

console.log('────────────────────────────────────────────────────────────');
console.log(`V2 latency baseline  (${new Date().toISOString()})`);
console.log(`Model: ${MODEL}    Queries per endpoint: ${QUERIES.length}`);
console.log('────────────────────────────────────────────────────────────');

const startedAt = new Date().toISOString();
const runs = {};

for (const [name, fn] of ENDPOINTS) {
  console.log(`\n→ ${name}`);
  runs[name] = [];
  for (const q of QUERIES) {
    const r = await fn(q);
    const tag = r.ok ? '✓' : '✗';
    const ms = r.e2e_ms?.toFixed(0) ?? '—';
    const extra = r.error ? `  ERROR: ${r.error.slice(0, 80)}` : '';
    console.log(`  ${tag} ${String(ms).padStart(5)}ms  "${q.slice(0, 60)}…"${extra}`);
    runs[name].push({ query: q, ...r });
    // 250ms jitter between calls to avoid burst-hitting rate limits.
    await new Promise((r) => setTimeout(r, 250));
  }
}

const summary = {};
for (const [name, results] of Object.entries(runs)) {
  const okOnly = results.filter((r) => r.ok);
  summary[name] = {
    success_rate: `${okOnly.length}/${results.length}`,
    e2e_ms: stats(results.map((r) => r.e2e_ms)),
    ttfb_ms: stats(results.map((r) => r.ttfb_ms ?? null)),
    ttft_ms: stats(results.map((r) => r.ttft_ms ?? null)),
    embed_ms: stats(results.map((r) => r.embed_ms ?? null)),
    vector_ms: stats(results.map((r) => r.vector_ms ?? null)),
    errors: results.filter((r) => !r.ok).map((r) => r.error),
  };
}

const today = startedAt.slice(0, 10);
const reportsDir = joinPath(repoRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });
const reportPath = joinPath(reportsDir, `latency-baseline-${today}.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      ran_at: startedAt,
      model: MODEL,
      queries: QUERIES,
      runs,
      summary,
    },
    null,
    2,
  ),
);

// Human summary
const fmt = (n) => (n == null ? '   —' : Math.round(n).toString().padStart(5));
console.log('\n────────────────────────────────────────────────────────────');
console.log('Summary  (ms)');
console.log('────────────────────────────────────────────────────────────');
console.log(`${'endpoint'.padEnd(45)} ${'ok'.padStart(5)} ${'e2e p50'.padStart(9)} ${'e2e p95'.padStart(9)} ${'ttfb p50'.padStart(9)} ${'ttft p50'.padStart(9)}`);
for (const [name, s] of Object.entries(summary)) {
  const e2e = s.e2e_ms ?? {};
  const ttfb = s.ttfb_ms ?? {};
  const ttft = s.ttft_ms ?? {};
  console.log(
    `${name.padEnd(45)} ${s.success_rate.padStart(5)} ${fmt(e2e.p50)}     ${fmt(e2e.p95)}     ${fmt(ttfb.p50)}     ${fmt(ttft.p50)}`,
  );
}
console.log('────────────────────────────────────────────────────────────');
console.log(`Report: ${reportPath}`);
console.log(`        file://${encodeURI(reportPath)}`);
console.log('────────────────────────────────────────────────────────────');
