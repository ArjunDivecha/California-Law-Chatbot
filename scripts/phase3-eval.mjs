/**
 * Phase 3 verifier evaluation harness. Per plan §Phase 3:
 *   - Load tests/citation-eval-set.json (30 entries; 20 real + 10 fake)
 *   - For each entry, call the verifier function under test
 *   - Compute confusion matrix (TP / TN / FP / FN) using `real` as the
 *     positive class
 *   - Report precision, recall, F1, and per-entry detail
 *
 * Plan's go/no-go criteria:
 *   - Fabricated citations flagged: ≥ 95% (TN rate)
 *   - F1 across the eval set: ≥ 0.90 (suggested threshold for the
 *     MCP-replacement decision)
 *
 * USAGE:
 *   npx tsx scripts/phase3-eval.mjs <verifier-name>
 *
 * Where <verifier-name> is one of:
 *   current      — wraps existing api/_lib/tools/citationVerify.ts
 *   sub-agent    — wraps the Phase 3 hand-rolled verifier sub-agent
 *
 * Each verifier driver is a small adapter that takes a citation text
 * string and returns { status: 'real' | 'fake', case_name?, match_url? }.
 * "real" means "the verifier confirmed this citation exists in case-law
 * databases" — anything else (not_found / unverified / error) maps to
 * "fake" since the verifier can't confirm.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
mkdirSync(join(repoRoot, 'reports'), { recursive: true });

// Load env from .env.local + the gitignored .env.txt fallback (the same
// fallback path dev-server.js uses). Mirrors the dev-server's env loader.
// Required for ANTHROPIC_API_KEY, COURTLISTENER_API_KEY, UPSTASH_*, etc.
function loadEnvFromFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip inline comments (everything after first " #")
    const commentIdx = val.indexOf(' #');
    if (commentIdx > 0) val = val.slice(0, commentIdx).trim();
    // First assignment wins (don't overwrite already-set vars).
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFromFile(join(repoRoot, '.env.local'));
loadEnvFromFile('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');

const evalSet = JSON.parse(
  readFileSync(join(repoRoot, 'tests/citation-eval-set.json'), 'utf8'),
);

// ---------------------------------------------------------------------------
// Verifier drivers
// ---------------------------------------------------------------------------

/**
 * Current production verifier — wraps citationVerify(). Maps the tool's
 * 'verified' status to 'real'; 'not_found'/'unverified' map to 'fake'.
 */
async function verifyWithCurrentTool(citationText) {
  const { citationVerify } = await import(
    '../api/_lib/tools/citationVerify.ts'
  );
  const result = await citationVerify({ citations: [citationText] });
  const c = result.citations[0];
  if (!c) return { status: 'fake' };
  return {
    status: c.status === 'verified' ? 'real' : 'fake',
    case_name: c.courtlistener_match?.case_name,
    match_url: c.courtlistener_match?.url,
  };
}

/**
 * Hand-rolled verifier sub-agent — separate agent-loop invocation with a
 * verification-specific system prompt. The model uses citation_verify,
 * courtlistener_search, and ceb_search to confirm or deny each
 * citation, returning a structured JSON verdict.
 */
async function verifyWithSubAgent(citationText) {
  const { verifyCitationViaSubAgent } = await import(
    '../api/_lib/verifierSubAgent.ts'
  );
  return await verifyCitationViaSubAgent(citationText);
}

const VERIFIERS = {
  current: verifyWithCurrentTool,
  'sub-agent': verifyWithSubAgent,
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  const verifierName = process.argv[2] || 'current';
  const verify = VERIFIERS[verifierName];
  if (!verify) {
    console.error(
      `Unknown verifier "${verifierName}". Options: ${Object.keys(VERIFIERS).join(', ')}`,
    );
    process.exit(2);
  }

  console.log(
    `Phase 3 eval: ${evalSet.entries.length} citations, verifier="${verifierName}"`,
  );
  console.log('─'.repeat(70));
  const t0 = performance.now();
  const results = [];
  for (let i = 0; i < evalSet.entries.length; i += 1) {
    const e = evalSet.entries[i];
    const ts = performance.now();
    let v;
    try {
      v = await verify(e.text);
    } catch (err) {
      v = { status: 'error', error: err.message };
    }
    const elapsed = performance.now() - ts;
    const verdict = v.status === 'real' ? 'real' : 'fake';
    const correct = verdict === e.truth;
    const tag = correct ? '✓' : '✗';
    console.log(
      `${tag} [${i + 1}/${evalSet.entries.length}] ${e.id.padEnd(8)} truth=${e.truth.padEnd(4)}  predicted=${verdict.padEnd(4)}  ${Math.round(elapsed)}ms  ${e.text.slice(0, 50)}`,
    );
    if (v.case_name && !correct) {
      console.log(`       verifier said: ${v.case_name}`);
    }
    results.push({
      id: e.id,
      text: e.text,
      truth: e.truth,
      predicted: verdict,
      correct,
      verifier_output: v,
      elapsed_ms: Math.round(elapsed),
    });
  }
  const elapsed = performance.now() - t0;

  // Confusion matrix — "real" is the positive class.
  const TP = results.filter((r) => r.truth === 'real' && r.predicted === 'real').length;
  const TN = results.filter((r) => r.truth === 'fake' && r.predicted === 'fake').length;
  const FP = results.filter((r) => r.truth === 'fake' && r.predicted === 'real').length;
  const FN = results.filter((r) => r.truth === 'real' && r.predicted === 'fake').length;
  const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
  const recall = TP + FN > 0 ? TP / (TP + FN) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const tnRate = TN + FP > 0 ? TN / (TN + FP) : 0; // = "how many fakes caught"

  const summary = {
    date: '2026-05-13',
    verifier_name: verifierName,
    eval_set_version: evalSet.version,
    entry_count: evalSet.entries.length,
    elapsed_ms: Math.round(elapsed),
    confusion_matrix: { TP, TN, FP, FN },
    precision,
    recall,
    f1,
    fake_caught_rate: tnRate,
    gate_pass_fake_caught_95: tnRate >= 0.95,
    gate_pass_f1_90: f1 >= 0.9,
    results,
  };

  console.log('\n========= PHASE 3 EVAL RESULT =========');
  console.log(`Verifier:        ${verifierName}`);
  console.log(`Confusion:       TP=${TP}  TN=${TN}  FP=${FP}  FN=${FN}`);
  console.log(`Precision:       ${precision.toFixed(3)}`);
  console.log(`Recall:          ${recall.toFixed(3)}`);
  console.log(`F1:              ${f1.toFixed(3)} ${f1 >= 0.9 ? '✅ ≥ 0.90' : '❌ < 0.90'}`);
  console.log(
    `Fake-caught rate: ${tnRate.toFixed(3)} ${tnRate >= 0.95 ? '✅ ≥ 0.95' : '❌ < 0.95'}`,
  );
  console.log(`Elapsed:         ${Math.round(elapsed / 1000)}s`);

  const outPath = join(
    repoRoot,
    `reports/phase3-eval-${verifierName}-2026-05-13.json`,
  );
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`Report: ${outPath}`);

  process.exit(summary.gate_pass_fake_caught_95 && summary.gate_pass_f1_90 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
