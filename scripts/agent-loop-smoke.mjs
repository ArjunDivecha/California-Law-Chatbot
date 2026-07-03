/**
 * Phase 1 smoke test — runs runAgentProxy end-to-end against real
 * Anthropic + Upstash KV + (when invoked by the model)
 * courtlistener_search / legiscan_search / openstates_search. Bypasses the
 * Vercel route handler — calls the proxy directly. Consumes API credits.
 *
 * Three scenarios:
 *   1. Public-research query (privileged: false) — web_search should be
 *      in the tools array.
 *   2. Compound-risk query (privileged: true) — web_search must be
 *      OMITTED from the tools array; agent must rely on
 *      courtlistener_search / legiscan_search / openstates_search only.
 *   3. Direct PII query (privileged: true) — same as #2 plus the input
 *      has explicit-PII spans that go through redaction.
 *
 * For each: prints final_text, tool_rounds, total_tokens, latency.
 * Confirms session state was written to Upstash KV. Writes a smoke
 * report to reports/agent-loop-smoke-{date}.json.
 *
 * Env required: ANTHROPIC_API_KEY, OPENAI_API_KEY, UPSTASH_VECTOR_*,
 * UPSTASH_REDIS_*, COURTLISTENER_API_KEY. Falls back to
 * /Users/arjundivecha/Dropbox/AAA Backup/.env.txt.
 *
 * Run: yarn agent:smoke
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '..');

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

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
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  const text = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
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
  const still = required.filter((k) => !process.env[k]);
  if (still.length > 0) throw new Error(`Missing env vars: ${still.join(', ')}`);
}

loadEnvFallback();

// ---------------------------------------------------------------------------
// Load the agent proxy + session-store (TS via tsx)
// ---------------------------------------------------------------------------

const { runAgentProxy } = await import(joinPath(repoRoot, 'api/_lib/agentProxy.ts'));
const { readMessages } = await import(joinPath(repoRoot, 'api/_lib/sessionStore.ts'));

// ---------------------------------------------------------------------------
// Three smoke scenarios
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    label: 'public_research (privileged=false expected)',
    user_text:
      'What does California CRC 3.1320 require for a motion to seal court records? Cite the rule text.',
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
console.log(`Phase 1 agent-loop smoke  (${nowStamp()})`);
console.log('────────────────────────────────────────────────────────────');

const startedAt = nowStamp();
const reports = [];

for (const scenario of SCENARIOS) {
  console.log(`\n→ ${scenario.label}`);
  console.log(`  prompt: "${scenario.user_text.slice(0, 80)}…"`);

  const sessionId = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const t0 = performance.now();
  let resp;
  try {
    resp = await runAgentProxy({
      session_id: sessionId,
      user_text: scenario.user_text,
      user_id: 'smoke_test_user',
    });
  } catch (err) {
    console.log(`  ✗ THREW: ${err.message}`);
    reports.push({ scenario: scenario.label, ok: false, error: err.message });
    continue;
  }
  const elapsed = performance.now() - t0;

  if (!resp.ok) {
    console.log(`  ✗ FAIL  status=${resp.status_code}  code=${resp.error.code}  msg=${resp.error.message}`);
    reports.push({ scenario: scenario.label, ok: false, response: resp });
    continue;
  }

  const privMatch = resp.privileged === scenario.expect_privileged;
  console.log(
    `  ✓ ok   privileged=${resp.privileged}${privMatch ? '' : ' ⚠️ MISMATCH'}  compound=${resp.compound_risk_buckets}  rounds=${resp.result.tool_rounds}  tokens=${resp.result.total_tokens}  ${fmt(resp.result.elapsed_ms)}ms`,
  );
  console.log(`  stop_reason=${resp.result.stop_reason}`);
  console.log(`  --- final_text (first 400 chars) ---`);
  console.log('  ' + resp.result.final_text.slice(0, 400).replace(/\n/g, '\n  '));

  // Verify session state was persisted.
  let persisted = null;
  try {
    const msgs = await readMessages(sessionId);
    persisted = msgs.length;
    console.log(`  KV persisted: ${persisted} message(s)`);
  } catch (err) {
    console.log(`  KV read error: ${err.message}`);
  }

  reports.push({
    scenario: scenario.label,
    session_id: sessionId,
    ok: true,
    privileged_expected: scenario.expect_privileged,
    privileged_actual: resp.privileged,
    privilege_match: privMatch,
    compound_risk_buckets: resp.compound_risk_buckets,
    tool_rounds: resp.result.tool_rounds,
    total_tokens: resp.result.total_tokens,
    elapsed_ms: resp.result.elapsed_ms,
    stop_reason: resp.result.stop_reason,
    exhausted_iterations: resp.result.exhausted_iterations,
    persisted_messages: persisted,
    final_text_preview: resp.result.final_text.slice(0, 400),
  });
}

// ---------------------------------------------------------------------------
// Summary + report
// ---------------------------------------------------------------------------

const passes = reports.filter((r) => r.ok && r.privilege_match !== false).length;
console.log('\n────────────────────────────────────────────────────────────');
console.log(`Summary: ${passes}/${reports.length} scenarios passed`);
console.log('────────────────────────────────────────────────────────────');

const today = startedAt.slice(0, 10);
const reportsDir = joinPath(repoRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });
const reportPath = joinPath(reportsDir, `agent-loop-smoke-${today}.json`);
writeFileSync(
  reportPath,
  JSON.stringify({ ran_at: startedAt, results: reports }, null, 2),
);
console.log(`Report: ${reportPath}`);
console.log(`        file://${encodeURI(reportPath)}`);

process.exit(passes === reports.length ? 0 : 1);
