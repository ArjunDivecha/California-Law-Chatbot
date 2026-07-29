/**
 * Compare three citation-existence providers on the repository's locked
 * 30-citation California fixture:
 *
 *   1. current       — pre-CiteLaw CourtListener-only citationVerify() baseline
 *   2. courtlistener — CourtListener's purpose-built citation-lookup endpoint
 *   3. citelaw       — CiteLaw's structured citation verification endpoint
 *
 * The fixture contains public case names and reporter citations only. No client
 * facts or confidential documents are sent to any provider.
 *
 * Usage:
 *   yarn benchmark:citations
 *   yarn benchmark:citations --require-all
 *   yarn benchmark:citations --providers=current,courtlistener
 *
 * Results are written as timestamped JSON/Markdown plus latest.json/latest.md
 * under benchmarks/citation-provider/results/.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const fixturePath = join(repoRoot, 'tests', 'citation-eval-set.json');
const outputDir = join(repoRoot, 'benchmarks', 'citation-provider', 'results');

// Run the batched endpoints before the production verifier's 30 individual
// CourtListener searches consume the account's per-minute request budget.
const ALL_PROVIDERS = ['courtlistener', 'citelaw', 'current'];
const requestedProviders = readProvidersArg(process.argv);
const requireAll = process.argv.includes('--require-all');

loadEnvFile(join(repoRoot, '.env.local'));
loadEnvFile(join(repoRoot, '.env'));
loadEnvFile('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const entries = fixture.entries.map((entry) => {
  const parsed = parseCitationIdentity(entry.text);
  return {
    ...entry,
    expected_case_name: entry.expected_case_name ?? parsed.title,
    expected_reporter: entry.expected_reporter ?? parsed.reporter,
    year: parsed.year,
  };
});

validateFixture(entries);

function readProvidersArg(argv) {
  const prefix = '--providers=';
  const raw = argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return ALL_PROVIDERS;
  const providers = raw
    .slice(prefix.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const unknown = providers.filter((provider) => !ALL_PROVIDERS.includes(provider));
  if (unknown.length > 0) {
    throw new Error(`Unknown providers: ${unknown.join(', ')}`);
  }
  if (providers.length === 0) {
    throw new Error('--providers must name at least one provider');
  }
  return providers;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    const inlineComment = value.indexOf(' #');
    if (inlineComment > 0) value = value.slice(0, inlineComment).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseCitationIdentity(text) {
  const match = /^(.*?)\s+\((\d{4})\)\s+(.+)$/.exec(text.trim());
  if (!match) {
    return { title: undefined, year: undefined, reporter: undefined };
  }
  return {
    title: match[1].trim(),
    year: Number(match[2]),
    reporter: match[3].trim(),
  };
}

function validateFixture(items) {
  if (items.length !== 30) {
    throw new Error(`Expected 30 fixture entries; found ${items.length}`);
  }
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate or missing id: ${item.id}`);
    ids.add(item.id);
    if (!['real', 'fake'].includes(item.truth)) {
      throw new Error(`Invalid truth for ${item.id}: ${item.truth}`);
    }
    if (!item.expected_reporter) {
      throw new Error(`Missing expected_reporter for ${item.id}`);
    }
  }
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function scoreResults(results) {
  const realTotal = results.filter((result) => result.truth === 'real').length;
  const fakeTotal = results.filter((result) => result.truth === 'fake').length;
  const TP = results.filter(
    (result) => result.truth === 'real' && result.verdict === 'real',
  ).length;
  const TN = results.filter(
    (result) => result.truth === 'fake' && result.verdict === 'fake',
  ).length;
  const FP = results.filter(
    (result) => result.truth === 'fake' && result.verdict === 'real',
  ).length;
  const FN = results.filter(
    (result) => result.truth === 'real' && result.verdict === 'fake',
  ).length;
  const abstain = results.filter((result) => result.verdict === 'abstain').length;
  const error = results.filter((result) => result.verdict === 'error').length;
  const resolved = TP + TN + FP + FN;
  const precision = ratio(TP, TP + FP);
  const recall = ratio(TP, realTotal);
  const f1 =
    precision + recall > 0 ? round((2 * precision * recall) / (precision + recall)) : 0;

  return {
    entry_count: results.length,
    truth_counts: { real: realTotal, fake: fakeTotal },
    confusion_matrix: { TP, TN, FP, FN },
    abstain,
    error,
    coverage: ratio(resolved, results.length),
    strict_accuracy: ratio(TP + TN, results.length),
    resolved_accuracy: ratio(TP + TN, resolved),
    precision,
    real_recall: recall,
    f1,
    fake_caught_rate: ratio(TN, fakeTotal),
    false_positive_rate: ratio(FP, fakeTotal),
  };
}

function normalizeReporter(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.\s]/g, '');
}

function compactMatch(match) {
  if (!match || typeof match !== 'object') return undefined;
  return {
    id: match.id ?? match.cluster_id,
    title: match.title ?? match.case_name,
    citations: compactCitations(match.citation ?? match.citations),
    court: match.court,
    year: match.year,
    decision_date: match.decision_date ?? match.date_filed,
    precedential_status: match.precedential_status,
    url: match.url ?? match.citelaw_url ?? match.absolute_url,
  };
}

function compactCitations(value) {
  if (value == null) return undefined;
  const citations = Array.isArray(value) ? value : [value];
  return citations.slice(0, 8).map((citation) => {
    if (typeof citation === 'string') return citation;
    if (!citation || typeof citation !== 'object') return String(citation);
    const parts = [citation.volume, citation.reporter, citation.page].filter(
      (part) => part != null && String(part).trim() !== '',
    );
    return parts.length > 0 ? parts.join(' ') : undefined;
  }).filter(Boolean);
}

async function fetchJson(url, options, providerName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const started = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const detail =
        body && typeof body === 'object'
          ? body.error ?? body.message ?? body.detail
          : undefined;
      throw new Error(
        `${providerName} HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 160)}` : ''}`,
      );
    }
    return {
      body,
      elapsed_ms: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function providerResult(name, started, results, extra = {}) {
  return {
    provider: name,
    status: 'completed',
    elapsed_ms: Math.round(performance.now() - started),
    summary: scoreResults(results),
    ...extra,
    results,
  };
}

function skippedProvider(name, reason) {
  return {
    provider: name,
    status: 'skipped',
    reason,
  };
}

function failedProvider(name, error) {
  return {
    provider: name,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  };
}

function verdictForCurrent(status) {
  if (status === 'verified') return 'real';
  if (status === 'not_found' || status === 'unverified') return 'fake';
  if (status === 'unconfirmed' || status === 'unavailable') return 'abstain';
  return 'error';
}

async function runCurrentProvider() {
  const started = performance.now();
  const { citationVerify } = await import('../api/_lib/tools/citationVerify.ts');
  const response = await citationVerify({
    citations: entries.map((entry) => entry.text),
  }, { citelawApiKey: null });
  const results = entries.map((entry, index) => {
    const raw = response.citations[index];
    return {
      id: entry.id,
      truth: entry.truth,
      input: entry.text,
      expected_reporter: entry.expected_reporter,
      verdict: raw ? verdictForCurrent(raw.status) : 'error',
      provider_status: raw?.status ?? 'missing_result',
      match: compactMatch(raw?.courtlistener_match),
      possible_match: compactMatch(raw?.possible_match),
    };
  });
  return providerResult('current', started, results, {
    endpoint: 'https://www.courtlistener.com/api/rest/v4/search/',
    mode: 'production citationVerify() batch',
    provider_elapsed_ms: Math.round(response.elapsed_ms),
  });
}

function verdictForCourtListener(status) {
  if (status === 200) return 'real';
  if (status === 400 || status === 404) return 'fake';
  if (status === 300) return 'abstain';
  return 'error';
}

async function runCourtListenerProvider() {
  const apiKey = process.env.COURTLISTENER_API_KEY;
  if (!apiKey) {
    return skippedProvider('courtlistener', 'COURTLISTENER_API_KEY is not configured');
  }
  const started = performance.now();
  const text = entries.map((entry) => `${entry.id}: ${entry.text}`).join('\n');
  const response = await fetchJson(
    'https://www.courtlistener.com/api/rest/v4/citation-lookup/',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'California Law Chatbot citation-provider benchmark/1.0',
      },
      body: new URLSearchParams({ text }).toString(),
    },
    'CourtListener Citation Lookup',
  );
  if (!Array.isArray(response.body)) {
    throw new Error('CourtListener Citation Lookup returned a non-array response');
  }

  const byReporter = new Map();
  for (const raw of response.body) {
    const normalized = normalizeReporter(raw?.citation);
    if (!byReporter.has(normalized)) byReporter.set(normalized, []);
    byReporter.get(normalized).push(raw);
  }
  const results = entries.map((entry) => {
    const normalized = normalizeReporter(entry.expected_reporter);
    const candidates = byReporter.get(normalized) ?? [];
    const raw = candidates.shift();
    return {
      id: entry.id,
      truth: entry.truth,
      input: entry.text,
      expected_reporter: entry.expected_reporter,
      verdict: raw ? verdictForCourtListener(raw.status) : 'error',
      provider_status: raw?.status ?? 'missing_result',
      normalized_citations: raw?.normalized_citations,
      error_message: raw?.error_message || undefined,
      matches: Array.isArray(raw?.clusters)
        ? raw.clusters.slice(0, 3).map(compactMatch)
        : [],
    };
  });
  return providerResult('courtlistener', started, results, {
    endpoint: 'https://www.courtlistener.com/api/rest/v4/citation-lookup/',
    mode: 'single batched text request',
    provider_elapsed_ms: response.elapsed_ms,
    citations_returned: response.body.length,
  });
}

function verdictForCiteLaw(status) {
  if (status === 'confirmed') return 'real';
  if (status === 'no_match') return 'fake';
  if (status === 'possible_match') return 'abstain';
  return 'error';
}

async function runCiteLawProvider() {
  const apiKey = process.env.CITELAW_API_KEY;
  if (!apiKey) {
    return skippedProvider('citelaw', 'CITELAW_API_KEY is not configured');
  }
  const started = performance.now();
  const response = await fetchJson(
    'https://citelaw.org/api/v1/citations/verify',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'California Law Chatbot citation-provider benchmark/1.0',
      },
      body: JSON.stringify({
        citations: entries.map((entry) => ({
          citation: entry.expected_reporter,
          title: entry.expected_case_name,
          year: entry.year,
          category: 'case',
        })),
      }),
    },
    'CiteLaw',
  );
  const rawResults = response.body?.results;
  if (!Array.isArray(rawResults)) {
    throw new Error('CiteLaw returned a response without a results array');
  }
  const results = entries.map((entry, index) => {
    const raw = rawResults[index];
    return {
      id: entry.id,
      truth: entry.truth,
      input: entry.text,
      expected_reporter: entry.expected_reporter,
      verdict: raw ? verdictForCiteLaw(raw.status) : 'error',
      provider_status: raw?.status ?? 'missing_result',
      detected_source: raw?.detected_source,
      confidence: raw?.confidence,
      reason: raw?.reason,
      field_matches: raw?.field_matches,
      match: compactMatch(raw?.match),
      candidates: Array.isArray(raw?.candidates)
        ? raw.candidates.slice(0, 3).map(compactMatch)
        : [],
    };
  });
  return providerResult('citelaw', started, results, {
    endpoint: 'https://citelaw.org/api/v1/citations/verify',
    mode: 'single structured batch request',
    provider_elapsed_ms: response.elapsed_ms,
    billing: response.body?.billing,
    provider_summary: response.body?.summary,
  });
}

const RUNNERS = {
  current: runCurrentProvider,
  courtlistener: runCourtListenerProvider,
  citelaw: runCiteLawProvider,
};

function renderMarkdown(report) {
  const rows = requestedProviders.map((name) => {
    const provider = report.providers[name];
    if (provider.status !== 'completed') {
      return `| ${name} | ${provider.status} | — | — | — | — | — | ${provider.reason ?? provider.error ?? ''} |`;
    }
    const summary = provider.summary;
    return `| ${name} | completed | ${(summary.strict_accuracy * 100).toFixed(1)}% | ${(summary.coverage * 100).toFixed(1)}% | ${(summary.real_recall * 100).toFixed(1)}% | ${(summary.fake_caught_rate * 100).toFixed(1)}% | ${summary.confusion_matrix.FP} | ${provider.elapsed_ms} ms |`;
  });

  const failureDetails = requestedProviders
    .map((name) => report.providers[name])
    .filter((provider) => provider.status === 'completed')
    .flatMap((provider) =>
      provider.results
        .filter((result) => result.verdict !== result.truth)
        .map(
          (result) =>
            `- **${provider.provider} / ${result.id}:** truth=${result.truth}, verdict=${result.verdict}, provider_status=${result.provider_status} — ${result.input}`,
        ),
    );

  return `# Citation Provider Benchmark

- Run: \`${report.run_id}\`
- Started: ${report.started_at}
- Fixture: \`${report.fixture.path}\` (${report.fixture.entry_count} entries)
- Privacy scope: ${report.privacy.payload}

| Provider | Status | Strict accuracy | Coverage | Real recall | Fake caught | False positives | Wall time |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

## Non-correct outcomes

${failureDetails.length > 0 ? failureDetails.join('\n') : '- None.'}

## Interpretation boundary

This benchmark measures citation identity/existence only. It does not measure proposition
support, quote or pincite accuracy, treatment, California citability, or current good-law
status. An authority marked real still requires those additional checks.
`;
}

async function main() {
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');
  const providers = {};

  console.log(
    `Citation provider benchmark: ${entries.length} entries (${entries.filter((entry) => entry.truth === 'real').length} real, ${entries.filter((entry) => entry.truth === 'fake').length} fake)`,
  );
  console.log(`Providers: ${requestedProviders.join(', ')}`);
  console.log('Payload: public case names and reporter citations only');

  for (const name of requestedProviders) {
    process.stdout.write(`\n[${name}] `);
    try {
      providers[name] = await RUNNERS[name]();
    } catch (error) {
      providers[name] = failedProvider(name, error);
    }
    const provider = providers[name];
    if (provider.status === 'completed') {
      const summary = provider.summary;
      console.log(
        `accuracy=${(summary.strict_accuracy * 100).toFixed(1)}% coverage=${(summary.coverage * 100).toFixed(1)}% ` +
          `real_recall=${(summary.real_recall * 100).toFixed(1)}% fake_caught=${(summary.fake_caught_rate * 100).toFixed(1)}% ` +
          `FP=${summary.confusion_matrix.FP} elapsed=${provider.elapsed_ms}ms`,
      );
    } else {
      console.log(`${provider.status}: ${provider.reason ?? provider.error}`);
    }
  }

  const completedAt = new Date().toISOString();
  const report = {
    schema_version: 1,
    suite: 'citation-provider-shadow-v1',
    run_id: runId,
    started_at: startedAt,
    completed_at: completedAt,
    fixture: {
      path: relative(repoRoot, fixturePath),
      version: fixture.version,
      entry_count: entries.length,
      truth_counts: {
        real: entries.filter((entry) => entry.truth === 'real').length,
        fake: entries.filter((entry) => entry.truth === 'fake').length,
      },
    },
    privacy: {
      payload: 'Public case names and reporter citations only; no client facts or documents.',
    },
    providers,
  };

  mkdirSync(outputDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  const timestampedJson = join(outputDir, `${runId}.json`);
  const timestampedMarkdown = join(outputDir, `${runId}.md`);
  const latestJson = join(outputDir, 'latest.json');
  const latestMarkdown = join(outputDir, 'latest.md');
  writeFileSync(timestampedJson, json);
  writeFileSync(timestampedMarkdown, markdown);
  writeFileSync(latestJson, json);
  writeFileSync(latestMarkdown, markdown);

  console.log('\nArtifacts:');
  console.log(relative(repoRoot, timestampedJson));
  console.log(relative(repoRoot, timestampedMarkdown));
  console.log(relative(repoRoot, latestJson));
  console.log(relative(repoRoot, latestMarkdown));

  const incomplete = requestedProviders.filter(
    (name) => providers[name].status !== 'completed',
  );
  if (requireAll && incomplete.length > 0) {
    console.error(`\nRequired providers incomplete: ${incomplete.join(', ')}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
