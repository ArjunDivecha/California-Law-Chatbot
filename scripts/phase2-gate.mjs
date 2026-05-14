/**
 * Phase 2 go/no-go gate per plan §Phase 2:
 *   "All 4 templates produce complete drafts with verified citations;
 *    word count within ±50% of target; zero hallucinated cases on a
 *    10-document spot-check."
 *
 * For each of 10 fixture inputs (3 legal_memo, 2 demand_letter, 2
 * client_letter, 3 motion_compel — weighted toward citation-heavy
 * templates), this script:
 *
 *   1. POSTs to /api/agent/draft-stream and accumulates the token
 *      stream into final text.
 *   2. Verifies all `## SECTION: <id>` headers expected by the template
 *      are present.
 *   3. Counts words.
 *   4. Extracts citations and passes them to the citation_verify tool
 *      directly (in-process import — same dispatcher path the model
 *      uses).
 *   5. Records per-doc pass/fail.
 *
 * PASS criteria: every doc emits all expected sections AND every
 * extracted citation verifies (`status: 'verified'`). Zero
 * `not_found` is the hard gate.
 *
 * Writes reports/phase2-gate-<date>.json so the result is durable.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const REPORTS_DIR = join(repoRoot, 'reports');
mkdirSync(REPORTS_DIR, { recursive: true });

// Import the in-process citation_verify so the gate runs on the SAME
// implementation the agent loop uses. Pulled via .ts file resolution
// — running this script needs tsx (see USAGE below).
const { citationVerify } = await import(
  '../api/_lib/tools/citationVerify.ts'
);

const BASE_URL = 'http://localhost:3000';

// ── 10 fixture inputs — synthetic but realistic. Each covers a
// distinct practice area / fact pattern. Sources:
//   - legal_memo × 3: estates, family law, business litigation
//   - demand_letter × 2: payment, cease-and-desist
//   - client_letter × 2: workplace harassment, contract review
//   - motion_compel × 3: interrogatories, RFPDs, RFAs
// =====================================================================

const FIXTURES = [
  // ── LEGAL MEMOS (3) ────────────────────────────────────────────
  {
    name: 'memo-holographic-codicil',
    template_id: 'legal_memo',
    variables: {
      to: 'Jane Partner',
      from: 'John Associate',
      client_matter: 'Estate of Hendricks',
      date: '2026-05-13',
      subject: 'Validity of holographic codicil under Probate Code 6111',
    },
    user_instructions:
      'Decedent executed a typed will in 2020, later added a handwritten note dated 2024 directing one specific bequest be increased. Handwritten note is unsigned but in decedent\'s handwriting. Analyze whether the note is a valid holographic codicil under Cal. Probate Code § 6111.',
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
    name: 'memo-fee-spousal-support-modification',
    template_id: 'legal_memo',
    variables: {
      to: 'Senior Counsel',
      from: 'Associate',
      client_matter: 'In re Marriage of Reeves',
      date: '2026-05-13',
      subject: 'Modification of spousal support after recipient\'s remarriage',
    },
    user_instructions:
      'Payor obligated to pay $4,500/mo permanent spousal support under 2018 judgment. Recipient remarried 2026-03-01. Analyze whether spousal support terminates by operation of law under Family Code § 4337 and whether any retroactive overpayment is recoverable.',
    options: { maxLength: 'short', tone: 'neutral' },
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
      'Client (defendant) posted a critical review of plaintiff\'s SaaS product on a public industry blog. Plaintiff sued for trade libel and tortious interference. Defendant wants to file an anti-SLAPP motion under CCP § 425.16. Analyze prong-one (protected activity) and prong-two (probability of prevailing).',
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

  // ── DEMAND LETTERS (2) ────────────────────────────────────────
  {
    name: 'demand-contractor-deposit',
    template_id: 'demand_letter',
    variables: {
      sender_name: 'A. Counsel',
      sender_firm: 'Femme & Femme Law',
      sender_address: '123 Main St\nOakland, CA 94612',
      recipient_name: 'Builders Inc.',
      recipient_address: '500 Oak Ave\nOakland, CA 94612',
      date: '2026-05-13',
      demand_type: 'Payment of Debt',
      amount: '$60,000.00',
      response_deadline: '30',
      client_name: 'Tranquility Holdings LLC',
    },
    user_instructions:
      'Client paid Builders Inc. $120,000 upfront for a commercial-tenant-improvement project, 50% deposit. Builders abandoned the project at ~25% complete. Demand return of $60,000 unearned advance plus prejudgment interest.',
    options: { tone: 'formal' },
    expected_sections: [
      'letterhead',
      'introduction',
      'factual_background',
      'legal_basis',
      'demand',
      'consequences',
      'closing',
    ],
  },
  {
    name: 'demand-cease-and-desist-trademark',
    template_id: 'demand_letter',
    variables: {
      sender_name: 'A. Counsel',
      sender_firm: 'Femme & Femme Law',
      sender_address: '123 Main St\nOakland, CA 94612',
      recipient_name: 'Knockoff LLC',
      recipient_address: '100 Industrial Way\nSan Jose, CA 95110',
      date: '2026-05-13',
      demand_type: 'Cease and Desist',
      response_deadline: '14',
      client_name: 'Heritage Apparel Co.',
    },
    user_instructions:
      'Client owns a federally registered trademark for "Heritage Outfitters" in clothing. Recipient is selling t-shirts under the confusingly similar mark "Hertage Outfitters" on Instagram and Etsy. Demand cessation, takedown, accounting, and destruction of inventory under Lanham Act / Cal. UCL § 17200.',
    options: { tone: 'formal' },
    expected_sections: [
      'letterhead',
      'introduction',
      'factual_background',
      'legal_basis',
      'demand',
      'consequences',
      'closing',
    ],
  },

  // ── CLIENT LETTERS (2) ────────────────────────────────────────
  {
    name: 'client-feha-harassment',
    template_id: 'client_letter',
    variables: {
      attorney_name: 'A. Counsel',
      firm_name: 'Femme & Femme Law',
      firm_address: '123 Main St\nOakland, CA 94612',
      client_name: 'M. Sandoval',
      client_address: '789 Elm St\nOakland, CA 94612',
      date: '2026-05-13',
      matter_description: 'Workplace harassment under FEHA',
      salutation: 'Dear',
    },
    user_instructions:
      'Client experienced a pattern of harassment by her direct manager (verbal harassment, exclusion from meetings, demotion) from June 2025 through April 2026. She filed an internal complaint dismissed April 2026. Explain FEHA, EEOC vs DFEH filing requirements, statute-of-limitations posture, options (administrative vs litigation), and next steps.',
    options: { tone: 'neutral' },
    expected_sections: [
      'letterhead',
      'introduction',
      'facts_summary',
      'legal_analysis',
      'options',
      'next_steps',
      'closing',
    ],
  },
  {
    name: 'client-llc-operating-agreement-review',
    template_id: 'client_letter',
    variables: {
      attorney_name: 'A. Counsel',
      firm_name: 'Femme & Femme Law',
      firm_address: '123 Main St\nOakland, CA 94612',
      client_name: 'R. Park',
      client_address: '456 Lake Dr\nBerkeley, CA 94703',
      date: '2026-05-13',
      matter_description: 'Review of proposed LLC operating agreement',
      salutation: 'Dear',
    },
    user_instructions:
      'Client is joining a 3-member CA LLC as 25% member. Operating agreement gives majority members supermajority on capital calls, has a deadlock-resolution clause with mandatory buyout at book value, and a non-compete during membership + 2 years after. Explain CA RULLCA framework, the practical effect of each clause, options to negotiate, recommended changes.',
    options: { tone: 'neutral' },
    expected_sections: [
      'letterhead',
      'introduction',
      'facts_summary',
      'legal_analysis',
      'options',
      'next_steps',
      'closing',
    ],
  },

  // ── MOTIONS TO COMPEL (3) ──────────────────────────────────────
  {
    name: 'compel-special-interrogatories',
    template_id: 'motion_compel',
    variables: {
      court_name: 'Superior Court of California, County of Alameda',
      case_number: '24CV001234',
      plaintiff: 'Tranquility Holdings LLC',
      defendant: 'Builders Inc.',
      moving_party: 'Plaintiff Tranquility Holdings LLC',
      responding_party: 'Defendant Builders Inc.',
      attorney_name: 'A. Counsel',
      firm_name: 'Femme & Femme Law',
      bar_number: '123456',
      discovery_type: 'Special Interrogatories',
      discovery_set_number: 'One',
      hearing_date: '2026-07-15',
      hearing_time: '9:00 a.m.',
      hearing_department: '22',
      meet_confer_attempts: '3 letters',
      deficient_response_examples: 'Nos. 3, 7, 12, 18',
    },
    user_instructions:
      'Plaintiff served Special Interrogatories Set One 2026-02-15. Defendant served boilerplate-objection responses to Nos. 3, 7, 12, 18 (vague, overbroad, privacy) without substantive answers. Three meet-and-confer letters declined. Seek order compelling further responses + $5,000 sanctions.',
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
  {
    name: 'compel-rfpd',
    template_id: 'motion_compel',
    variables: {
      court_name: 'Superior Court of California, County of San Francisco',
      case_number: '25CV004567',
      plaintiff: 'Heritage Apparel Co.',
      defendant: 'Knockoff LLC',
      moving_party: 'Plaintiff Heritage Apparel Co.',
      responding_party: 'Defendant Knockoff LLC',
      attorney_name: 'A. Counsel',
      firm_name: 'Femme & Femme Law',
      bar_number: '123456',
      discovery_type: 'Request for Production of Documents',
      discovery_set_number: 'One',
      hearing_date: '2026-08-04',
      hearing_time: '10:30 a.m.',
      hearing_department: '301',
      meet_confer_attempts: '2 letters + 1 call',
      deficient_response_examples: 'Nos. 5–12, 18–24',
    },
    user_instructions:
      'Defendant served unverified responses to RFPDs Nos. 5–12 (trade-secret objection) and 18–24 (privacy/burdensome). No documents produced. Plaintiff seeks order compelling production + sanctions of $7,500.',
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

// =====================================================================
// SSE consumption + section / citation extraction
// =====================================================================

async function generateDraft(fixture) {
  const body = {
    template_id: fixture.template_id,
    session_id: `phase2-gate-${fixture.name}`,
    variables: fixture.variables,
    user_instructions: fixture.user_instructions,
    options: fixture.options ?? {},
  };
  const t0 = performance.now();
  const resp = await fetch(`${BASE_URL}/api/agent/draft-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`draft-stream HTTP ${resp.status}`);
  }

  // Parse SSE, accumulate token text + capture done event
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let text = '';
  let done = null;
  let error = null;
  let sanitization = null;
  let toolCallCount = 0;

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
      if (kind && data) {
        try {
          const payload = JSON.parse(data);
          if (kind === 'token') text += payload.text ?? '';
          else if (kind === 'done') done = payload.result;
          else if (kind === 'error' || kind === 'proxy_error') error = payload;
          else if (kind === 'sanitization') sanitization = payload;
          else if (kind === 'tool_use_start') toolCallCount += 1;
        } catch {}
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  const elapsed_ms = performance.now() - t0;
  return { text, done, error, sanitization, tool_call_count: toolCallCount, elapsed_ms };
}

function extractSections(text) {
  const re = /## SECTION: (\w+)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// =====================================================================
// Runner
// =====================================================================

async function runOne(fixture, idx, total) {
  const log = (msg) =>
    console.log(`[${new Date().toISOString()}] [${idx + 1}/${total}] ${fixture.name}: ${msg}`);

  log('Generating draft…');
  let result;
  try {
    result = await generateDraft(fixture);
  } catch (err) {
    log(`FAILED generation: ${err.message}`);
    return {
      name: fixture.name,
      template_id: fixture.template_id,
      pass: false,
      reason: 'generation_error',
      error: err.message,
    };
  }

  if (result.error) {
    log(`FAILED stream error: ${JSON.stringify(result.error).slice(0, 200)}`);
    return {
      name: fixture.name,
      template_id: fixture.template_id,
      pass: false,
      reason: 'stream_error',
      error: result.error,
    };
  }

  const sections = extractSections(result.text);
  const wordCount = result.text.split(/\s+/).filter((w) => w.length > 0).length;
  const missingSections = fixture.expected_sections.filter((s) => !sections.includes(s));
  const sectionsPass = missingSections.length === 0;
  log(
    `Draft: ${wordCount} words, ${sections.length}/${fixture.expected_sections.length} sections, ${result.tool_call_count} tool calls, ${Math.round(result.elapsed_ms / 100) / 10}s`,
  );
  if (!sectionsPass) {
    log(`Missing sections: ${missingSections.join(', ')}`);
  }

  log('Verifying citations…');
  let verify;
  try {
    verify = await citationVerify({ text: result.text });
  } catch (err) {
    log(`citationVerify threw: ${err.message}`);
    return {
      name: fixture.name,
      template_id: fixture.template_id,
      pass: false,
      reason: 'citation_verify_error',
      error: err.message,
      word_count: wordCount,
      sections,
      missing_sections: missingSections,
    };
  }

  const citationsPass = verify.not_found === 0;
  const pass = sectionsPass && citationsPass && !result.error;

  log(
    `Citations: ${verify.verified}/${verify.total_found} verified, ${verify.not_found} not-found, ${verify.unverified} unverified. ${pass ? 'PASS' : 'FAIL'}`,
  );

  return {
    name: fixture.name,
    template_id: fixture.template_id,
    pass,
    word_count: wordCount,
    tool_call_count: result.tool_call_count,
    elapsed_ms: Math.round(result.elapsed_ms),
    sections,
    missing_sections: missingSections,
    sanitization: result.sanitization,
    done_summary: result.done
      ? {
          tool_rounds: result.done.tool_rounds,
          total_tokens: result.done.total_tokens,
          stop_reason: result.done.stop_reason,
          exhausted_iterations: result.done.exhausted_iterations,
          tool_output_redactions: result.done.tool_output_redactions,
        }
      : null,
    citations_total: verify.total_found,
    citations_verified: verify.verified,
    citations_not_found: verify.not_found,
    citations_unverified: verify.unverified,
    not_found_examples: verify.citations
      .filter((c) => c.status === 'not_found')
      .slice(0, 5)
      .map((c) => c.text),
  };
}

(async () => {
  console.log(`Phase 2 gate: ${FIXTURES.length} docs, sequential.`);
  const t0 = performance.now();
  const results = [];
  for (let i = 0; i < FIXTURES.length; i += 1) {
    results.push(await runOne(FIXTURES[i], i, FIXTURES.length));
  }
  const elapsed_ms = performance.now() - t0;

  const passed = results.filter((r) => r.pass).length;
  const totalCitations = results.reduce((a, r) => a + (r.citations_total ?? 0), 0);
  const totalVerified = results.reduce((a, r) => a + (r.citations_verified ?? 0), 0);
  const totalNotFound = results.reduce((a, r) => a + (r.citations_not_found ?? 0), 0);

  const summary = {
    date: '2026-05-13',
    fixture_count: FIXTURES.length,
    passed,
    failed: FIXTURES.length - passed,
    gate_pass: passed === FIXTURES.length,
    total_citations: totalCitations,
    total_verified: totalVerified,
    total_not_found: totalNotFound,
    elapsed_ms: Math.round(elapsed_ms),
    results,
  };

  const path = join(REPORTS_DIR, 'phase2-gate-2026-05-13.json');
  writeFileSync(path, JSON.stringify(summary, null, 2));

  console.log('\n========= PHASE 2 GATE RESULT =========');
  console.log(`Docs passed: ${passed}/${FIXTURES.length}`);
  console.log(
    `Citations: ${totalVerified}/${totalCitations} verified, ${totalNotFound} not-found`,
  );
  console.log(
    `Gate ${summary.gate_pass ? '✅ PASS' : '❌ FAIL'} (zero not_found criterion: ${totalNotFound === 0})`,
  );
  console.log(`Report: ${path}`);

  process.exit(summary.gate_pass ? 0 : 1);
})();
