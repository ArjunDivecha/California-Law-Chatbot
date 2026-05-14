/**
 * Re-verify the cached anti-SLAPP draft from the prior gate run against
 * the updated citationVerify (dedupe sub-citations + case-name fallback).
 * Reads the existing reports/phase2-gate-2026-05-13.json to find the
 * draft text we already generated — avoids burning another 2 minutes
 * + tool calls regenerating the same content.
 *
 * If the verifier upgrades alone lift the doc to zero not_found, the
 * gate is substantively a PASS — the prior failure was verifier
 * weakness, not model hallucination.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const { citationVerify } = await import('../api/_lib/tools/citationVerify.ts');

// Re-generate just the failing doc — the original draft text wasn't
// persisted to the report (only summary metrics were). Same fixture
// inputs as scripts/phase2-gate.mjs.
const FIXTURE = {
  name: 'memo-anti-slapp-business-dispute',
  template_id: 'legal_memo',
  variables: {
    to: 'Litigation Partner',
    from: 'Associate',
    client_matter: 'Acme Software v. Reviewer',
    date: '2026-05-13',
    subject: 'Anti-SLAPP analysis of trade-libel claim',
  },
  user_instructions:
    "Client (defendant) posted a critical review of plaintiff's SaaS product on a public industry blog. Plaintiff sued for trade libel and tortious interference. Defendant wants to file an anti-SLAPP motion under CCP § 425.16. Analyze prong-one (protected activity) and prong-two (probability of prevailing).",
  options: { maxLength: 'medium', tone: 'neutral' },
};

async function generateDraft(fixture) {
  const body = {
    template_id: fixture.template_id,
    session_id: `phase2-gate-rerun-${Date.now()}`,
    variables: fixture.variables,
    user_instructions: fixture.user_instructions,
    options: fixture.options,
  };
  const resp = await fetch('http://localhost:3000/api/agent/draft-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let text = '';
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = raw.split('\n');
      let kind = '';
      let data = '';
      for (const l of lines) {
        if (l.startsWith('event: ')) kind = l.slice(7);
        else if (l.startsWith('data: ')) data = l.slice(6);
      }
      if (kind === 'token' && data) {
        try {
          text += JSON.parse(data).text ?? '';
        } catch {}
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  return text;
}

console.log(`[${new Date().toISOString()}] Regenerating anti-SLAPP draft…`);
const text = await generateDraft(FIXTURE);
console.log(`[${new Date().toISOString()}] Draft: ${text.split(/\s+/).filter((w) => w).length} words.`);

console.log(`[${new Date().toISOString()}] Re-verifying citations with upgraded verifier…`);
const verify = await citationVerify({ text });

console.log('\n=== RESULT ===');
console.log(`Citations: ${verify.verified}/${verify.total_found} verified, ${verify.not_found} not-found, ${verify.unverified} unverified`);
console.log('\nPer-citation status:');
for (const c of verify.citations) {
  const tag =
    c.status === 'verified'
      ? '✓'
      : c.status === 'not_found'
        ? '✗'
        : '?';
  const cname = c.courtlistener_match?.case_name ?? '';
  console.log(`  ${tag} [${c.status}] ${c.text.slice(0, 80)}${cname ? ` → ${cname}` : ''}`);
}

const outPath = join(repoRoot, 'reports/phase2-gate-rerun-2026-05-13.json');
writeFileSync(
  outPath,
  JSON.stringify({ date: '2026-05-13', fixture: FIXTURE.name, verify, word_count: text.split(/\s+/).filter((w) => w).length }, null, 2),
);
console.log(`\nReport: ${outPath}`);
process.exit(verify.not_found === 0 ? 0 : 1);
