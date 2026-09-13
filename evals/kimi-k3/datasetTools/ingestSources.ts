import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvaluationError } from '../providers/types.js';
import { appendSourcesAtomically } from './sourceRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = join(
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

export function readSourceCandidates(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { sources?: unknown }).sources)
  ) {
    return (parsed as { sources: unknown[] }).sources;
  }
  throw new EvaluationError(
    'INVALID_SOURCE_INPUT',
    'Input JSON must be an array or an object with a sources array',
  );
}

export function runIngestSources(args: string[]): Record<string, unknown> {
  const unknown = args.filter(
    (value, index) =>
      value.startsWith('--') &&
      !['--input', '--output'].includes(value) &&
      !['--input', '--output'].includes(args[index - 1]),
  );
  if (unknown.length > 0) {
    throw new EvaluationError(
      'INVALID_ARGUMENT',
      `Unknown arguments: ${unknown.join(', ')}`,
    );
  }
  const input = option(args, '--input');
  if (!input) {
    throw new EvaluationError('INVALID_ARGUMENT', '--input is required');
  }
  const output = resolve(option(args, '--output') ?? DEFAULT_OUTPUT);
  const appended = appendSourcesAtomically(
    output,
    readSourceCandidates(input),
  );
  return {
    output,
    appended: appended.length,
    source_ids: appended.map((record) => record.source_id),
  };
}

async function main(): Promise<void> {
  try {
    console.log(JSON.stringify(runIngestSources(process.argv.slice(2))));
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
