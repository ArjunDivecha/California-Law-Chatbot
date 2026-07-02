/**
 * Phase 1 streaming smoke — runs runAgentProxyStream end-to-end against
 * real Anthropic + Upstash + CourtListener. Captures TTFB (time-to-first-
 * event) and TTFT (time-to-first-token) per scenario so we can verify the
 * streaming path actually delivers partial output rather than buffering.
 *
 * Three scenarios mirror agent-loop-smoke.mjs:
 *   1. public_research (privileged=false expected)
 *   2. compound_risk  (privileged=true expected)
 *   3. direct_pii     (privileged=true expected)
 *
 * Run: yarn agent:smoke-stream
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '..');

function loadEnvFallback() {
  const required = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'UPSTASH_VECTOR_REST_URL',
    'UPSTASH_VECTOR_REST_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'COURTLISTENER_API_KEY',
  ];
  if (required.every((k) => process.env[k])) return;
  const text = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
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
  const still = required.filter((k) => !process.env[k]);
  if (still.length > 0) throw new Error(`Missing env vars: ${still.join(', ')}`);
}

loadEnvFallback();

const { runAgentProxyStream } = await import(joinPath(repoRoot, 'api/_lib/agentProxy.ts'));

const SCENARIOS = [
  {
    label: 'public_research (privileged=false expected)',
    user_text:
      'What does California Rule of Court 2.550 require for a motion to seal court records? Cite the rule text.',
    expect_privileged: false,
  },
  {
    label: 'compound_risk (privileged=true expected, no direct PII)',
    user_text:
      "Cantonese-speaking widower in Sunset District whose only son is a third-year radiology resident at UCSF. What probate forms do we need to begin?",
    expect_privileged: true,
  },
  {
    label: 'direct_pii (privileged=true expected, explicit name+phone)',
    user_text:
      "Client María González can be reached at 415-555-0148. What's the standard for a noticed motion to compel further responses in CA state court?",
    expect_privileged: true,
  },
];

function nowStamp() {
  return new Date().toISOString();
}

function fmt(n) {
  return n == null ? '   —' : Math.round(n).toString().padStart(5);
}

console.log('────────────────────────────────────────────────────────────');
console.log(`Phase 1 streaming smoke  (${nowStamp()})`);
console.log('────────────────────────────────────────────────────────────');

const startedAt = nowStamp();
const reports = [];

for (const scenario of SCENARIOS) {
  console.log(`\n→ ${scenario.label}`);
  console.log(`  prompt: "${scenario.user_text.slice(0, 80)}…"`);

  const sessionId = `stream_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const t0 = performance.now();
  let ttfb_ms = null;
  let ttft_ms = null;
  let sanitizationEvent = null;
  let doneEvent = null;
  let errorEvent = null;
  const tokens = [];
  const tool_events = [];
  let iteration_count = 0;

  try {
    for await (const event of runAgentProxyStream({
      session_id: sessionId,
      user_text: scenario.user_text,
      user_id: 'stream_smoke_user',
    })) {
      const t = performance.now() - t0;
      if (ttfb_ms === null) ttfb_ms = t;
      switch (event.kind) {
        case 'sanitization':
          sanitizationEvent = event;
          console.log(
            `  [${fmt(t)}ms] sanitization: privileged=${event.privileged}  compound=${event.compound_risk_buckets}  redactions=${event.redactions_count}`,
          );
          break;
        case 'iteration':
          iteration_count = event.round;
          console.log(`  [${fmt(t)}ms] iteration ${event.round}`);
          break;
        case 'tool_use_start':
          tool_events.push({ kind: 'start', name: event.name, t_ms: t });
          console.log(`  [${fmt(t)}ms] tool_use_start: ${event.name}`);
          break;
        case 'tool_use_input':
          // suppressed in console output (verbose); captured for report
          tool_events.push({ kind: 'input', tool_use_id: event.tool_use_id, input: event.input, t_ms: t });
          break;
        case 'tool_result':
          tool_events.push({
            kind: 'result',
            name: event.name,
            is_error: event.is_error,
            elapsed_ms: event.elapsed_ms,
            t_ms: t,
            output_redactions_count: event.output_redactions_count,
            output_compound_risk_buckets: event.output_compound_risk_buckets,
          });
          {
            const redact = event.output_redactions_count;
            const buckets = event.output_compound_risk_buckets;
            const tag =
              redact > 0 || buckets >= 3
                ? `  ⚠ output_redactions=${redact ?? 0} buckets=${buckets ?? 0}`
                : '';
            console.log(
              `  [${fmt(t)}ms] tool_result: ${event.name}  ${fmt(event.elapsed_ms)}ms  is_error=${event.is_error}${tag}`,
            );
          }
          break;
        case 'token':
          if (ttft_ms === null) {
            ttft_ms = t;
            console.log(`  [${fmt(t)}ms] *** FIRST TOKEN ***`);
          }
          tokens.push(event.text);
          break;
        case 'done':
          doneEvent = event;
          console.log(
            `  [${fmt(t)}ms] done: rounds=${event.result.tool_rounds}  tokens=${event.result.total_tokens}  stop=${event.result.stop_reason}`,
          );
          break;
        case 'error':
        case 'proxy_error':
          errorEvent = event;
          console.log(`  [${fmt(t)}ms] ${event.kind}: ${event.code} — ${event.message}`);
          break;
        default:
          break;
      }
    }
  } catch (err) {
    console.log(`  ✗ THREW: ${err.message}`);
    reports.push({ scenario: scenario.label, ok: false, error: err.message });
    continue;
  }

  if (errorEvent) {
    reports.push({
      scenario: scenario.label,
      ok: false,
      error: errorEvent,
      ttfb_ms,
      ttft_ms,
    });
    continue;
  }

  if (!doneEvent) {
    reports.push({
      scenario: scenario.label,
      ok: false,
      error: 'no done event',
      ttfb_ms,
      ttft_ms,
    });
    continue;
  }

  const privMatch = sanitizationEvent?.privileged === scenario.expect_privileged;
  const fullText = tokens.join('');
  console.log(`  ✓ ok   tokens-rcvd=${tokens.length}  ttfb=${fmt(ttfb_ms)}ms  ttft=${fmt(ttft_ms)}ms  e2e=${fmt(doneEvent.result.elapsed_ms)}ms`);
  console.log(`  --- final_text (first 400 chars) ---`);
  console.log('  ' + fullText.slice(0, 400).replace(/\n/g, '\n  '));

  reports.push({
    scenario: scenario.label,
    session_id: sessionId,
    ok: true,
    privileged_expected: scenario.expect_privileged,
    privileged_actual: sanitizationEvent?.privileged,
    privilege_match: privMatch,
    compound_risk_buckets: sanitizationEvent?.compound_risk_buckets,
    ttfb_ms,
    ttft_ms,
    e2e_ms: doneEvent.result.elapsed_ms,
    iteration_count,
    tool_events,
    final_text_preview: fullText.slice(0, 400),
    final_text_length: fullText.length,
    tool_rounds: doneEvent.result.tool_rounds,
    total_tokens: doneEvent.result.total_tokens,
    stop_reason: doneEvent.result.stop_reason,
  });
}

const passes = reports.filter((r) => r.ok && r.privilege_match !== false).length;
console.log('\n────────────────────────────────────────────────────────────');
console.log(`Summary: ${passes}/${reports.length} scenarios passed`);
console.log('Streaming TTFB/TTFT (lower is better — measures user perceived latency)');
for (const r of reports.filter((r) => r.ok)) {
  console.log(`  ${r.scenario.padEnd(60)} ttfb=${fmt(r.ttfb_ms)}ms  ttft=${fmt(r.ttft_ms)}ms  e2e=${fmt(r.e2e_ms)}ms`);
}
console.log('────────────────────────────────────────────────────────────');

const today = startedAt.slice(0, 10);
const reportsDir = joinPath(repoRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });
const reportPath = joinPath(reportsDir, `agent-loop-stream-smoke-${today}.json`);
writeFileSync(reportPath, JSON.stringify({ ran_at: startedAt, results: reports }, null, 2));
console.log(`Report: ${reportPath}`);
console.log(`        file://${encodeURI(reportPath)}`);

process.exit(passes === reports.length ? 0 : 1);
