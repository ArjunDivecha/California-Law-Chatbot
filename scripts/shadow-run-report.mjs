/**
 * Phase 4.5 shadow-run aggregator. Pulls shadow:* records from Upstash
 * KV over a date range and emits a comparison report.
 *
 * Usage:
 *   npx tsx scripts/shadow-run-report.mjs [--days=7] [--user=USER_ID]
 *
 * Output: reports/shadow-run-{date}.json with totals, latency, response-
 * length deltas, sanitization stats, and a manual-review queue for any
 * V1/V2 pairs where the response-length delta is > 50% (suggesting
 * meaningfully different answers).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
mkdirSync(join(repoRoot, 'reports'), { recursive: true });

// Load env from .env.local + fallback
function loadEnv(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      // Strip surrounding quotes (matches dev-server.js loader).
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
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnv(join(repoRoot, '.env.local'));
loadEnv('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');

const { Redis } = await import('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const days = Number(args.days ?? 7);
const userFilter = typeof args.user === 'string' ? args.user : null;

// Generate the list of YYYY-MM-DD strings to look up
const today = new Date();
const dateStrs = [];
for (let d = 0; d < days; d += 1) {
  const dt = new Date(today.getTime() - d * 24 * 60 * 60 * 1000);
  dateStrs.push(dt.toISOString().slice(0, 10));
}

console.log(`Aggregating shadow:* over ${days} days, user=${userFilter ?? 'all'}`);

// Find all index keys, then pull each record
const recordKeys = new Set();
for (const day of dateStrs) {
  const pattern = userFilter
    ? `shadow_index:${userFilter}:${day}`
    : `shadow_index:*:${day}`;
  // SCAN for matching index keys
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = result[0];
    for (const idxKey of result[1] ?? []) {
      const members = await redis.zrange(idxKey, 0, -1);
      for (const m of members ?? []) recordKeys.add(m);
    }
  } while (cursor !== '0');
}

console.log(`Found ${recordKeys.size} shadow records`);

const records = [];
for (const k of recordKeys) {
  try {
    const raw = await redis.get(k);
    if (!raw) continue;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    records.push(parsed);
  } catch {}
}

// Aggregates
const totals = {
  shadow_runs: records.length,
  v2_errors: records.filter((r) => r.v2.stop_reason.startsWith('error:')).length,
  privileged: records.filter((r) => r.v2.sanitization.privileged).length,
  exhausted_iterations: records.filter((r) => r.v2.exhausted_iterations).length,
};

const latencyMs = records.map((r) => r.v2.elapsed_ms).filter(Boolean).sort((a, b) => a - b);
const pct = (p) => latencyMs.length ? latencyMs[Math.floor(latencyMs.length * p)] : null;
const latency = {
  count: latencyMs.length,
  p50: pct(0.5),
  p95: pct(0.95),
  max: latencyMs[latencyMs.length - 1] ?? null,
};

const responseLens = records.map((r) => r.v2.response_len);
const responseStats = {
  v2_mean_len: responseLens.length
    ? Math.round(responseLens.reduce((a, b) => a + b, 0) / responseLens.length)
    : null,
};

const sanitizationStats = {
  total_redactions: records.reduce((a, r) => a + (r.v2.tool_output_redactions ?? 0), 0),
  max_redactions_single_turn: records.reduce((m, r) => Math.max(m, r.v2.tool_output_redactions ?? 0), 0),
};

// Manual-review queue: V1 vs V2 response length diverges by > 50% OR V1
// has sources but V2 returned empty (suggests V2 failed to retrieve).
const reviewQueue = records.filter((r) => {
  if (r.v2.stop_reason.startsWith('error:')) return true;
  if (r.v1.response_len != null && r.v1.response_len > 100) {
    const ratio = r.v2.response_len / Math.max(1, r.v1.response_len);
    if (ratio < 0.5 || ratio > 2.0) return true;
  }
  return false;
});

const report = {
  generated_at: new Date().toISOString(),
  date_range_days: days,
  user_filter: userFilter,
  totals,
  latency,
  response: responseStats,
  sanitization: sanitizationStats,
  review_queue_size: reviewQueue.length,
  review_queue_sample: reviewQueue.slice(0, 10).map((r) => ({
    v1_session: r.v1_session_id,
    v1_turn: r.v1_turn_id,
    user_text_hmac: r.user_text_hmac,
    user_text_len: r.user_text_len,
    v1_response_len: r.v1.response_len,
    v2_response_len: r.v2.response_len,
    v2_stop_reason: r.v2.stop_reason,
    v2_elapsed_ms: r.v2.elapsed_ms,
  })),
};

const outPath = join(repoRoot, `reports/shadow-run-${today.toISOString().slice(0, 10)}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('\n=== Shadow run report ===');
console.log(JSON.stringify({
  totals: report.totals,
  latency: report.latency,
  response: report.response,
  sanitization: report.sanitization,
  review_queue_size: report.review_queue_size,
}, null, 2));
console.log(`\nReport: ${outPath}`);
