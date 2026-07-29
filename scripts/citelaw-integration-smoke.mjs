/**
 * Live AskPauli citation identity-gate smoke test.
 *
 * Sends two public case citations in one CiteLaw batch (1 credit total):
 * one canonical real case and one fabricated caption attached to a real
 * reporter slot. No client facts or documents are transmitted.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const close = value.indexOf(quote, 1);
      value = close > 0 ? value.slice(1, close) : value.slice(1);
    } else {
      const cut = value.search(/\s|#/u);
      if (cut >= 0) value = value.slice(0, cut);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile(join(repoRoot, '.env.local'));
loadEnvFile(join(repoRoot, '.env'));
loadEnvFile('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');

if (!process.env.CITELAW_API_KEY) {
  throw new Error('CITELAW_API_KEY is not configured');
}

const {
  citationVerify,
  clearCiteLawVerificationCache,
} = await import('../api/_lib/tools/citationVerify.ts');

clearCiteLawVerificationCache();
const result = await citationVerify({
  citations: [
    'Navellier v. Sletten (2002) 29 Cal.4th 82',
    'Bell v. Bayside Restaurant Group (2017) 11 Cal.5th 332',
  ],
});

const publicSummary = {
  privacy: 'public case captions, years, and reporter citations only',
  citelaw: result.citelaw,
  citations: result.citations.map((citation) => ({
    input: citation.text,
    status: citation.status,
    courtlistener_status: citation.courtlistener_status,
    citelaw_status: citation.citelaw?.status,
    verification_source: citation.verification_source,
    reason: citation.citelaw?.reason,
  })),
};
console.log(JSON.stringify(publicSummary, null, 2));

const [realCase, fabricatedCaption] = result.citations;
const passed =
  result.citelaw.status === 'completed' &&
  result.citelaw.billing?.citations_verified === 2 &&
  result.citelaw.billing?.credits_charged === 1 &&
  realCase?.status === 'verified' &&
  realCase?.citelaw?.status === 'confirmed' &&
  fabricatedCaption?.status !== 'verified' &&
  fabricatedCaption?.citelaw?.status !== 'confirmed';

if (!passed) {
  console.error('CiteLaw integration smoke failed');
  process.exit(1);
}
console.log('CITELAW_INTEGRATION_SMOKE_OK');

if (process.argv.includes('--subagent')) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured for --subagent');
  }
  const { verifyCitationViaSubAgent } = await import(
    '../api/_lib/verifierSubAgent.ts'
  );
  const verdict = await verifyCitationViaSubAgent(
    'Bell v. Bayside Restaurant Group (2017) 11 Cal.5th 332',
  );
  console.log(
    JSON.stringify(
      {
        subagent: {
          status: verdict.status,
          citation_type: verdict.citation_type,
          case_name: verdict.case_name,
          confidence: verdict.confidence,
          reasoning: verdict.reasoning,
          tool_rounds: verdict.tool_rounds,
        },
      },
      null,
      2,
    ),
  );
  if (verdict.status !== 'fake') {
    console.error('CiteLaw sub-agent identity-conflict smoke failed');
    process.exit(1);
  }
  console.log('CITELAW_SUBAGENT_SMOKE_OK');
}
