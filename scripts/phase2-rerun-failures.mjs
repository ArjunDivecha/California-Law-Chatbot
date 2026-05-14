/**
 * Re-run just the two fixtures that failed the prior gate run after
 * hardening (Skill section-id tightening + quality_warning event):
 *   - memo-anti-slapp-business-dispute (emitted `brief` instead of `brief_answer`)
 *   - compel-rfa (205 words / 0 sections; stochastic short generation)
 *
 * Asserts both produce all expected sections AND zero not_found citations.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
mkdirSync(join(repoRoot, 'reports'), { recursive: true });

const { citationVerify } = await import('../api/_lib/tools/citationVerify.ts');

const FIXTURES = [
  {
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
    expected_sections: [
      'header',
      'question_presented',
      'brief_answer',
      'facts',
      'analysis',
      'conclusion',
    ],
  },
  {
    name: 'compel-rfa',
    template_id: 'motion_compel',
    variables: {
      court_name: 'Superior Court of California, County of Los Angeles',
      case_number: '25STCV012345',
      plaintiff: 'M. Sandoval',
      defendant: 'Acme Software Inc.',
      moving_party: 'Plaintiff M. Sandoval',
      responding_party: 'Defendant Acme Software Inc.',
      attorney_name: 'A. Counsel',
      firm_name: 'Femme & Femme Law',
      bar_number: '123456',
      discovery_type: 'Request for Admissions',
      discovery_set_number: 'Two',
      hearing_date: '2026-09-12',
      hearing_time: '8:30 a.m.',
      hearing_department: '53',
      meet_confer_attempts: '2 letters',
      deficient_response_examples: 'Nos. 1–6',
    },
    user_instructions:
      'Defendant served evasive denials and improper qualifications to RFAs Nos. 1–6 on basic factual matters already established in deposition testimony. Seeking order compelling further responses or alternatively deeming the matters admitted under Code Civ. Proc. § 2033.290.',
    options: { tone: 'formal' },
    expected_sections: [
      'caption',
      'notice_of_motion',
      'mpa_introduction',
      'mpa_facts',
      'mpa_argument',
      'mpa_prayer',
      'declaration',
      'separate_statement',
      'pos_reference',
      'signature',
    ],
  },
];

async function generateDraft(fixture) {
  const resp = await fetch('http://localhost:3000/api/agent/draft-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: fixture.template_id,
      session_id: `rerun-${fixture.name}-${Date.now()}`,
      variables: fixture.variables,
      user_instructions: fixture.user_instructions,
      options: fixture.options,
    }),
  });
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let text = '';
  let qualityWarning = null;
  let done = null;
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
      if (data) {
        try {
          const payload = JSON.parse(data);
          if (kind === 'token') text += payload.text ?? '';
          else if (kind === 'quality_warning') qualityWarning = payload;
          else if (kind === 'done') done = payload.result;
        } catch {}
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  return { text, qualityWarning, done };
}

const results = [];
for (const fx of FIXTURES) {
  console.log(`\n[${new Date().toISOString()}] ${fx.name}: generating…`);
  const t0 = performance.now();
  const { text, qualityWarning, done } = await generateDraft(fx);
  const elapsed = performance.now() - t0;
  const wordCount = text.split(/\s+/).filter((w) => w).length;
  const sections = [...text.matchAll(/## SECTION: (\w+)/g)].map((m) => m[1]);
  const missing = fx.expected_sections.filter((s) => !sections.includes(s));
  console.log(
    `  ${wordCount}w, ${sections.length}/${fx.expected_sections.length} sections, ${Math.round(elapsed / 100) / 10}s`,
  );
  if (qualityWarning) {
    console.log(`  ⚠️ quality_warning: ${JSON.stringify(qualityWarning.issues)}`);
  }
  if (missing.length > 0) {
    console.log(`  missing: ${missing.join(', ')}`);
  }
  const verify = await citationVerify({ text });
  console.log(
    `  citations: ${verify.verified}/${verify.total_found} verified, ${verify.not_found} not-found`,
  );
  const pass = missing.length === 0 && verify.not_found === 0;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}`);
  results.push({
    name: fx.name,
    pass,
    word_count: wordCount,
    sections,
    missing_sections: missing,
    quality_warning: qualityWarning,
    citations_total: verify.total_found,
    citations_verified: verify.verified,
    citations_not_found: verify.not_found,
    done_summary: done
      ? {
          tool_rounds: done.tool_rounds,
          total_tokens: done.total_tokens,
          stop_reason: done.stop_reason,
          exhausted_iterations: done.exhausted_iterations,
        }
      : null,
  });
}

const allPass = results.every((r) => r.pass);
writeFileSync(
  join(repoRoot, 'reports/phase2-rerun-failures-2026-05-13.json'),
  JSON.stringify({ date: '2026-05-13', all_pass: allPass, results }, null, 2),
);

console.log(`\n========= RERUN RESULT =========`);
console.log(`Pass: ${results.filter((r) => r.pass).length}/${results.length}`);
console.log(`All pass: ${allPass ? '✅' : '❌'}`);
process.exit(allPass ? 0 : 1);
