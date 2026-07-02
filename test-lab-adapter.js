/**
 * LAB-style adapter eval for California Law Chatbot.
 *
 * Run:
 *   node test-lab-adapter.js
 *   TEST_URL=http://localhost:5173 node test-lab-adapter.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') { console.log(`${colors[color]}${message}${colors.reset}`); }
function logSection(title) { console.log('\n' + '='.repeat(78)); log(title, 'bright'); console.log('='.repeat(78)); }
function containsAny(haystack, needles) { const h = String(haystack || '').toLowerCase(); return needles.some((n) => h.includes(n.toLowerCase())); }
function normalize(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function callCebSearch(query, topK = 6) {
  const started = Date.now();
  const result = await postJson(`${BASE_URL}/api/ceb-search`, { query, topK });
  return { ...result, elapsedMs: Date.now() - started };
}

async function callCitationVerify(text) {
  const started = Date.now();
  const result = await postJson(`${BASE_URL}/api/verify-citations`, { text });
  return { ...result, elapsedMs: Date.now() - started };
}

function gradeTask(task, artifacts) {
  const checks = [];
  for (const criterion of task.rubric) {
    let pass = false;
    let evidence = '';

    if (criterion.kind === 'http_ok') {
      const a = artifacts[criterion.artifact];
      pass = !!(a && a.ok);
      evidence = `${criterion.artifact} status=${a?.status ?? 'n/a'}`;
    }
    if (criterion.kind === 'min_sources') {
      const a = artifacts[criterion.artifact];
      const count = Array.isArray(a?.data?.sources) ? a.data.sources.length : 0;
      pass = count >= criterion.min;
      evidence = `sources=${count}, min=${criterion.min}`;
    }
    if (criterion.kind === 'has_statutory_citations') {
      const a = artifacts[criterion.artifact];
      const count = Array.isArray(a?.data?.statutoryCitations) ? a.data.statutoryCitations.length : 0;
      pass = count > 0;
      evidence = `statutoryCitations=${count}`;
    }
    if (criterion.kind === 'contains_terms') {
      const a = artifacts[criterion.artifact];
      const text = normalize(criterion.from === 'context' ? a?.data?.context : JSON.stringify(a?.data || {}));
      pass = containsAny(text, criterion.terms);
      evidence = pass ? `matched one of: ${criterion.terms.join(', ')}` : `missing terms: ${criterion.terms.join(', ')}`;
    }
    if (criterion.kind === 'citation_verify_counts') {
      const a = artifacts[criterion.artifact];
      const verified = Number(a?.data?.verified || 0);
      const found = Number(a?.data?.totalFound || 0);
      pass = verified >= criterion.minVerified && found >= criterion.minFound;
      evidence = `found=${found}, verified=${verified}`;
    }

    checks.push({ id: criterion.id, title: criterion.title, pass, evidence });
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  return { checks, passed, total, allPass: passed === total, pct: Math.round((passed / total) * 100) };
}

function buildTask({ id, area, instruction, query, topK, terms, requireStatute, minSources, verifyText }) {
  const rubric = [
    { id: 'r1', title: 'Search endpoint returns HTTP success', kind: 'http_ok', artifact: 'search' },
    { id: 'r2', title: 'Retrieved enough sources for draft work product', kind: 'min_sources', artifact: 'search', min: minSources },
    { id: 'r3', title: 'Context contains expected legal concepts', kind: 'contains_terms', artifact: 'search', from: 'context', terms },
    { id: 'r4', title: 'Citation verification endpoint is reachable', kind: 'http_ok', artifact: 'verify' },
    { id: 'r5', title: 'Known citation verifies at least one result', kind: 'citation_verify_counts', artifact: 'verify', minFound: 1, minVerified: 1 },
  ];

  if (requireStatute) {
    rubric.splice(3, 0, { id: 'r3b', title: 'Statutory citations are explicitly extracted', kind: 'has_statutory_citations', artifact: 'search' });
  }

  return {
    id,
    practiceArea: area,
    instruction,
    matter: { clientName: 'Synthetic Client Matter', documents: ['Partner instruction', 'Client notes', 'Background extracts'] },
    rubric,
    run: async () => ({ search: await callCebSearch(query, topK), verify: await callCitationVerify(verifyText) }),
  };
}

const VERIFY_TEXT = 'As held in People v. Anderson (1972) 6 Cal.3d 628, courts require legally sufficient support for findings.';

const TASK_SPECS = [
  ['lab-cal-001','Family Law','Assess same-sex adoption and parentage filing risk memo.','California Family Code section 297 domestic partner parentage and same-sex adoption requirements',6,['family code','parentage','adoption','domestic partner'],true,3],
  ['lab-cal-002','Family Law','Draft support modification issue memo with statutory anchors.','California Family Code section 4055 child support guideline modification',5,['family code','support','guideline','modification'],true,3],
  ['lab-cal-003','Family Law','Prepare custody and visitation risk summary.','California custody visitation best interests factors family law',5,['custody','visitation','best interests','family'],false,3],
  ['lab-cal-004','Family Law','Analyze domestic violence restraining order workflow.','California DVRO family code emergency protective order process',5,['restraining','protective order','family code','violence'],false,3],

  ['lab-cal-005','Trusts & Estates','Create revocable trust amendment checklist.','California Probate Code section 15401 revocable trust amendment revocation',6,['probate code','trust','amendment','revocation'],true,3],
  ['lab-cal-006','Trusts & Estates','Draft trustee fiduciary duty issue spotter.','California trustee fiduciary duties prudent investor trust administration',5,['trustee','fiduciary','trust administration','duty'],false,3],
  ['lab-cal-007','Trusts & Estates','Prepare intestacy distribution quick-reference memo.','California Probate Code intestate succession surviving spouse distribution',5,['probate','intestate','succession','surviving spouse'],false,3],
  ['lab-cal-008','Trusts & Estates','Summarize no-contest clause enforceability risks.','California no contest clause probate enforcement exceptions',5,['no contest','probate','enforceability','exception'],false,2],

  ['lab-cal-009','Litigation Intake','Draft negligence case intake issue list.','California negligence elements causation damages pleading standards',5,['negligence','causation','damages','pleading'],false,2],
  ['lab-cal-010','Litigation Intake','Prepare anti-SLAPP motion triage notes.','California anti-SLAPP motion timeline protected activity',5,['anti-slapp','protected activity','motion','timeline'],false,2],
  ['lab-cal-011','Litigation Intake','Assess discovery sanctions risk summary.','California discovery sanctions misuse of discovery code of civil procedure',5,['discovery','sanctions','civil procedure','misuse'],false,2],
  ['lab-cal-012','Litigation Intake','Generate preliminary statute-of-limitations checklist.','California statute of limitations tolling civil claims',5,['statute of limitations','tolling','civil','claims'],false,2],

  ['lab-cal-013','Business Litigation','Analyze breach of contract damage framing.','California breach of contract damages foreseeability mitigation',5,['breach','contract','damages','mitigation'],false,2],
  ['lab-cal-014','Business Litigation','Prepare trade secret injunction issue memo.','California trade secret misappropriation injunction DTSA CUTSA',5,['trade secret','misappropriation','injunction','cutsa'],false,2],
  ['lab-cal-015','Business Litigation','Summarize arbitration enforceability risk points.','California arbitration agreement unconscionability enforceability',5,['arbitration','unconscionability','agreement','enforceability'],false,2],
  ['lab-cal-016','Business Litigation','Draft unfair competition claim intake bullets.','California UCL unfair competition standing restitution',5,['unfair competition','ucl','standing','restitution'],false,2],

  ['lab-cal-017','Drafting','Build demand-letter legal support package.','California demand letter breach notice cure period contract',5,['demand letter','notice','cure period','contract'],false,2],
  ['lab-cal-018','Drafting','Prepare cease-and-desist basis summary.','California cease and desist unfair competition trademark confusion',5,['cease and desist','unfair competition','trademark','confusion'],false,2],
  ['lab-cal-019','Drafting','Create board-ready change-of-control risk outline.','change of control consent assignment risk mitigation California transaction agreements',5,['change of control','consent','assignment','risk'],false,2],
  ['lab-cal-020','Drafting','Draft statutory compliance memo shell.','California Civil Code section 1942 habitability tenant remedies',6,['civil code','habitability','tenant','remedies'],true,3],
];

const TASKS = TASK_SPECS.map(([id, area, instruction, query, topK, terms, requireStatute, minSources]) =>
  buildTask({ id, area, instruction, query, topK, terms, requireStatute, minSources, verifyText: VERIFY_TEXT })
);

async function main() {
  logSection('LAB-STYLE ADAPTER EVAL (20 TASK PACK)');
  log(`Target URL: ${BASE_URL}`, 'cyan');

  const configCheck = await fetch(`${BASE_URL}/api/config`).catch(() => null);
  if (!configCheck || !configCheck.ok) {
    log('Server check failed. Start local dev server first (api + frontend).', 'red');
    process.exit(1);
  }

  const summary = [];
  const byArea = {};

  for (const task of TASKS) {
    const artifacts = await task.run();
    const grade = gradeTask(task, artifacts);
    summary.push({ id: task.id, area: task.practiceArea, ...grade });
    byArea[task.practiceArea] ||= { tasks: 0, allPass: 0 };
    byArea[task.practiceArea].tasks += 1;
    if (grade.allPass) byArea[task.practiceArea].allPass += 1;

    log(`${task.id} | ${task.practiceArea} => ${grade.allPass ? 'ALL-PASS' : 'PARTIAL'} (${grade.passed}/${grade.total})`, grade.allPass ? 'green' : 'yellow');
  }

  logSection('AREA SUMMARY');
  for (const [area, vals] of Object.entries(byArea)) {
    log(`${area}: ${vals.allPass}/${vals.tasks} all-pass`, vals.allPass === vals.tasks ? 'green' : 'yellow');
  }

  logSection('OVERALL SUMMARY');
  const allPassCount = summary.filter((s) => s.allPass).length;
  log(`Tasks: ${summary.length}`, 'cyan');
  log(`All-pass: ${allPassCount}/${summary.length}`, allPassCount === summary.length ? 'green' : 'yellow');
}

main().catch((err) => { console.error(err); process.exit(1); });
