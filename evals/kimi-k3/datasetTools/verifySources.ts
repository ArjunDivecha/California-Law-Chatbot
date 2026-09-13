import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvaluationError } from '../providers/types.js';
import { normalizeWhitespace } from './authorTasks.js';
import {
  computeExcerptSha256,
  loadSourceRegistry,
} from './sourceRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCES = join(
  HERE,
  '..',
  'datasets',
  'california-law-v1',
  'sources.jsonl',
);

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new EvaluationError('INVALID_ARGUMENT', `${name} requires a value`);
  }
  return value;
}

function pageText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>');
}

export async function verifySources(options: {
  sources: string;
  live?: boolean;
  fetch_impl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const records = loadSourceRegistry(options.sources);
  const results = [];
  for (const record of records) {
    const hash_matches =
      computeExcerptSha256(record.excerpt) === record.sha256;
    let live_excerpt_found: boolean | null = null;
    let live_error: string | null = null;
    if (options.live) {
      try {
        const response = await (options.fetch_impl ?? fetch)(
          record.canonical_url,
          { method: 'GET' },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = pageText(await response.text());
        live_excerpt_found = normalizeWhitespace(text).includes(
          normalizeWhitespace(record.excerpt),
        );
      } catch (error) {
        live_error = error instanceof Error ? error.message : String(error);
        live_excerpt_found = false;
      }
    }
    results.push({
      source_id: record.source_id,
      canonical_url: record.canonical_url,
      hash_matches,
      live_excerpt_found,
      live_error,
      drift:
        !hash_matches ||
        (options.live === true && live_excerpt_found !== true),
    });
  }
  const drift = results.filter((result) => result.drift);
  return {
    mode: options.live ? 'live' : 'offline',
    network_calls: options.live ? records.length : 0,
    source_count: records.length,
    verified: records.length - drift.length,
    drift_count: drift.length,
    drift_source_ids: drift.map((result) => result.source_id),
    results,
  };
}

export async function runVerifySources(
  args: string[],
): Promise<Record<string, unknown>> {
  const unknown = args.filter(
    (value, index) =>
      value.startsWith('--') &&
      !['--live', '--offline', '--sources'].includes(value) &&
      args[index - 1] !== '--sources',
  );
  if (unknown.length > 0 || (args.includes('--live') && args.includes('--offline'))) {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      `Invalid verifySources arguments: ${unknown.join(', ')}`,
    );
  }
  return verifySources({
    sources: resolve(option(args, '--sources') ?? DEFAULT_SOURCES),
    live: args.includes('--live'),
  });
}

async function main(): Promise<void> {
  try {
    const report = await runVerifySources(process.argv.slice(2));
    console.log(JSON.stringify(report));
    if (report.drift_count !== 0) process.exitCode = 2;
  } catch (error) {
    const known = error instanceof EvaluationError;
    console.log(JSON.stringify({
      exit: known ? error.exit_code : 1,
      error_code: known ? error.error_code : 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = known ? error.exit_code : 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}
