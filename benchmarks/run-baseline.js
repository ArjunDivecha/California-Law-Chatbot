/**
 * Baseline benchmark runner for California Law Chatbot.
 * Tracks: all-pass accuracy, latency, and token estimates for stable comparison.
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve('benchmarks/results');

const VERIFY_TEXT = 'As held in People v. Anderson (1972) 6 Cal.3d 628, courts require legally sufficient support for findings.';

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

async function postJson(url, body) {
  const start = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data, elapsedMs: Date.now() - start };
}

function containsAny(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  return needles.some((n) => h.includes(String(n).toLowerCase()));
}

function makeTask(id, area, query, terms, requireStatute = false, minSources = 2) {
  return { id, area, query, terms, requireStatute, minSources };
}

const TASKS = [
  makeTask('lab-cal-001','Family Law','California Family Code section 297 domestic partner parentage and same-sex adoption requirements',['family code','parentage','adoption','domestic partner'],true,3),
  makeTask('lab-cal-002','Family Law','California Family Code section 4055 child support guideline modification',['family code','support','guideline','modification'],true,3),
  makeTask('lab-cal-003','Family Law','California custody visitation best interests factors family law',['custody','visitation','best interests','family'],false,3),
  makeTask('lab-cal-004','Family Law','California DVRO family code emergency protective order process',['restraining','protective order','family code','violence'],false,3),
  makeTask('lab-cal-005','Trusts & Estates','California Probate Code section 15401 revocable trust amendment revocation',['probate code','trust','amendment','revocation'],true,3),
  makeTask('lab-cal-006','Trusts & Estates','California trustee fiduciary duties prudent investor trust administration',['trustee','fiduciary','trust administration','duty'],false,3),
  makeTask('lab-cal-007','Trusts & Estates','California Probate Code intestate succession surviving spouse distribution',['probate','intestate','succession','surviving spouse'],false,3),
  makeTask('lab-cal-008','Trusts & Estates','California no contest clause probate enforcement exceptions',['no contest','probate','enforceability','exception'],false,2),
  makeTask('lab-cal-009','Litigation Intake','California negligence elements causation damages pleading standards',['negligence','causation','damages','pleading'],false,2),
  makeTask('lab-cal-010','Litigation Intake','California anti-SLAPP motion timeline protected activity',['anti-slapp','protected activity','motion','timeline'],false,2),
  makeTask('lab-cal-011','Litigation Intake','California discovery sanctions misuse of discovery code of civil procedure',['discovery','sanctions','civil procedure','misuse'],false,2),
  makeTask('lab-cal-012','Litigation Intake','California statute of limitations tolling civil claims',['statute of limitations','tolling','civil','claims'],false,2),
  makeTask('lab-cal-013','Business Litigation','California breach of contract damages foreseeability mitigation',['breach','contract','damages','mitigation'],false,2),
  makeTask('lab-cal-014','Business Litigation','California trade secret misappropriation injunction DTSA CUTSA',['trade secret','misappropriation','injunction','cutsa'],false,2),
  makeTask('lab-cal-015','Business Litigation','California arbitration agreement unconscionability enforceability',['arbitration','unconscionability','agreement','enforceability'],false,2),
  makeTask('lab-cal-016','Business Litigation','California UCL unfair competition standing restitution',['unfair competition','ucl','standing','restitution'],false,2),
  makeTask('lab-cal-017','Drafting','California demand letter breach notice cure period contract',['demand letter','notice','cure period','contract'],false,2),
  makeTask('lab-cal-018','Drafting','California cease and desist unfair competition trademark confusion',['cease and desist','unfair competition','trademark','confusion'],false,2),
  makeTask('lab-cal-019','Drafting','change of control consent assignment risk mitigation California transaction agreements',['change of control','consent','assignment','risk'],false,2),
  makeTask('lab-cal-020','Drafting','California Civil Code section 1942 habitability tenant remedies',['civil code','habitability','tenant','remedies'],true,3),
];

async function runTask(task) {
  const search = await postJson(`${BASE_URL}/api/ceb-search`, { query: task.query, topK: 6 });
  const verify = await postJson(`${BASE_URL}/api/verify-citations`, { text: VERIFY_TEXT });

  const sources = Array.isArray(search.data?.sources) ? search.data.sources : [];
  const context = String(search.data?.context || '');
  const statutes = Array.isArray(search.data?.statutoryCitations) ? search.data.statutoryCitations : [];
  const verified = Number(verify.data?.verified || 0);
  const found = Number(verify.data?.totalFound || 0);

  const checks = [
    search.ok,
    sources.length >= task.minSources,
    containsAny(context, task.terms),
    verify.ok,
    verified >= 1 && found >= 1,
  ];
  if (task.requireStatute) checks.splice(3, 0, statutes.length > 0);

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  const allPass = passed === total;

  const inputTokenEstimate = estimateTokens(task.query) + estimateTokens(VERIFY_TEXT);
  const retrievedTokenEstimate = estimateTokens(context);
  const citationPayloadTokenEstimate = estimateTokens(JSON.stringify(verify.data || {}));
  const totalTokenEstimate = inputTokenEstimate + retrievedTokenEstimate + citationPayloadTokenEstimate;

  return {
    id: task.id,
    area: task.area,
    allPass,
    passed,
    total,
    latencyMs: {
      search: search.elapsedMs,
      verify: verify.elapsedMs,
      total: search.elapsedMs + verify.elapsedMs,
    },
    counts: {
      sources: sources.length,
      statutoryCitations: statutes.length,
      verified,
      found,
    },
    tokenEstimate: {
      input: inputTokenEstimate,
      retrievedContext: retrievedTokenEstimate,
      verificationPayload: citationPayloadTokenEstimate,
      total: totalTokenEstimate,
    },
    usage: {
      modelUsageAvailable: false,
      note: 'True model usage tokens are not exposed by current endpoints; estimates used for trend comparison.',
    },
  };
}

function summarize(results) {
  const totalTasks = results.length;
  const allPassTasks = results.filter((r) => r.allPass).length;
  const byArea = {};

  for (const r of results) {
    byArea[r.area] ||= { tasks: 0, allPass: 0, latencyTotal: 0, tokenTotal: 0 };
    byArea[r.area].tasks += 1;
    if (r.allPass) byArea[r.area].allPass += 1;
    byArea[r.area].latencyTotal += r.latencyMs.total;
    byArea[r.area].tokenTotal += r.tokenEstimate.total;
  }

  const avgLatencyMs = Math.round(results.reduce((s, r) => s + r.latencyMs.total, 0) / Math.max(totalTasks, 1));
  const p95LatencyMs = (() => {
    const sorted = results.map((r) => r.latencyMs.total).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  })();
  const avgTokenEstimate = Math.round(results.reduce((s, r) => s + r.tokenEstimate.total, 0) / Math.max(totalTasks, 1));

  return {
    accuracy: {
      allPassTasks,
      totalTasks,
      allPassRate: Number((allPassTasks / Math.max(totalTasks, 1)).toFixed(4)),
    },
    speed: {
      avgLatencyMs,
      p95LatencyMs,
      minLatencyMs: Math.min(...results.map((r) => r.latencyMs.total)),
      maxLatencyMs: Math.max(...results.map((r) => r.latencyMs.total)),
    },
    tokens: {
      metric: 'estimated_tokens',
      avgPerTask: avgTokenEstimate,
      totalAcrossRun: results.reduce((s, r) => s + r.tokenEstimate.total, 0),
    },
    byArea,
  };
}

async function main() {
  const config = await fetch(`${BASE_URL}/api/config`).catch(() => null);
  if (!config || !config.ok) {
    console.error(`Server not reachable at ${BASE_URL}`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');
  const results = [];

  for (const task of TASKS) {
    const r = await runTask(task);
    results.push(r);
    console.log(`${r.id} ${r.allPass ? 'ALL-PASS' : 'PARTIAL'} latency=${r.latencyMs.total}ms tokens~${r.tokenEstimate.total}`);
  }

  const summary = summarize(results);

  const payload = {
    runId,
    startedAt,
    baseUrl: BASE_URL,
    suite: 'lab-adapter-20',
    summary,
    tasks: results,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n');

  const latestFile = path.join(OUT_DIR, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(payload, null, 2) + '\n');

  console.log('\nBaseline written:');
  console.log(outFile);
  console.log(latestFile);
  console.log(`All-pass: ${summary.accuracy.allPassTasks}/${summary.accuracy.totalTasks}`);
  console.log(`Avg latency: ${summary.speed.avgLatencyMs}ms | p95: ${summary.speed.p95LatencyMs}ms`);
  console.log(`Avg tokens (estimated): ${summary.tokens.avgPerTask}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
