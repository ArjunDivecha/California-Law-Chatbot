import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrimarySourceRecord } from '../types.js';
import { atomicWriteFileSync } from '../journal.js';
import { sha256 } from '../providers/shared.js';
import { EvaluationError } from '../providers/types.js';

const AUTHORITY_KINDS = new Set([
  'statute',
  'case',
  'rule',
  'constitution',
]);
const SOURCE_FIELDS = new Set([
  'source_id',
  'canonical_url',
  'locator',
  'jurisdiction',
  'authority_kind',
  'publication_or_precedential_status',
  'effective_date',
  'retrieved_at',
  'excerpt',
  'sha256',
  'discovery_notes',
]);

export type SourceCandidate = Omit<PrimarySourceRecord, 'sha256'> & {
  sha256?: string;
};

function requiredString(
  record: Record<string, unknown>,
  field: keyof PrimarySourceRecord,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `${String(field)} must be a non-empty string`,
    );
  }
  return value;
}

export function sourceDuplicateKey(
  record: Pick<PrimarySourceRecord, 'canonical_url' | 'locator'>,
): string {
  return `${record.canonical_url}\u0000${record.locator}`;
}

export function computeExcerptSha256(excerpt: string): string {
  return sha256(excerpt);
}

export function validateSourceCandidate(
  candidate: unknown,
): PrimarySourceRecord {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      'Each source candidate must be an object',
    );
  }
  const input = candidate as Record<string, unknown>;
  const unknownFields = Object.keys(input).filter(
    (field) => !SOURCE_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `Unknown source fields: ${unknownFields.join(', ')}`,
    );
  }
  const source_id = requiredString(input, 'source_id');
  const canonical_url = requiredString(input, 'canonical_url');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(canonical_url);
  } catch {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `canonical_url is invalid for ${source_id}`,
    );
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `canonical_url must use https for ${source_id}`,
    );
  }
  const authority_kind = requiredString(input, 'authority_kind');
  if (!AUTHORITY_KINDS.has(authority_kind)) {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `authority_kind is invalid for ${source_id}`,
    );
  }
  const excerpt = requiredString(input, 'excerpt');
  const computedHash = computeExcerptSha256(excerpt);
  if (
    input.sha256 !== undefined &&
    input.sha256 !== computedHash
  ) {
    throw new EvaluationError(
      'SOURCE_HASH_MISMATCH',
      `Supplied sha256 does not match excerpt bytes for ${source_id}`,
    );
  }
  const retrieved_at = requiredString(input, 'retrieved_at');
  if (Number.isNaN(Date.parse(retrieved_at))) {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `retrieved_at is invalid for ${source_id}`,
    );
  }
  if (typeof input.discovery_notes !== 'string') {
    throw new EvaluationError(
      'INVALID_SOURCE_RECORD',
      `discovery_notes must be a string for ${source_id}`,
    );
  }
  return {
    source_id,
    canonical_url,
    locator: requiredString(input, 'locator'),
    jurisdiction: requiredString(input, 'jurisdiction'),
    authority_kind:
      authority_kind as PrimarySourceRecord['authority_kind'],
    publication_or_precedential_status: requiredString(
      input,
      'publication_or_precedential_status',
    ),
    effective_date: requiredString(input, 'effective_date'),
    retrieved_at,
    excerpt,
    sha256: computedHash,
    discovery_notes: input.discovery_notes,
  };
}

export function loadSourceRegistry(path: string): PrimarySourceRecord[] {
  const resolved = resolve(path);
  if (!existsSync(resolved)) return [];
  const records = readFileSync(resolved, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return validateSourceCandidate(JSON.parse(line));
      } catch (error) {
        if (error instanceof EvaluationError) throw error;
        throw new EvaluationError(
          'INVALID_SOURCE_REGISTRY',
          `Malformed source registry line ${index + 1}`,
        );
      }
    });
  const sourceIds = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const record of records) {
    if (sourceIds.has(record.source_id)) {
      throw new EvaluationError(
        'DUPLICATE_SOURCE_ID',
        `Duplicate source_id in registry: ${record.source_id}`,
      );
    }
    const key = sourceDuplicateKey(record);
    if (duplicateKeys.has(key)) {
      throw new EvaluationError(
        'DUPLICATE_SOURCE',
        `Duplicate canonical_url+locator in registry: ${record.canonical_url} ${record.locator}`,
      );
    }
    sourceIds.add(record.source_id);
    duplicateKeys.add(key);
  }
  return records;
}

export function appendSourcesAtomically(
  path: string,
  candidates: unknown[],
): PrimarySourceRecord[] {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new EvaluationError(
      'INVALID_SOURCE_INPUT',
      'Input must contain at least one source candidate',
    );
  }
  const existing = loadSourceRegistry(path);
  const additions = candidates.map(validateSourceCandidate);
  const sourceIds = new Set(existing.map((record) => record.source_id));
  const duplicateKeys = new Set(existing.map(sourceDuplicateKey));
  for (const record of additions) {
    if (sourceIds.has(record.source_id)) {
      throw new EvaluationError(
        'DUPLICATE_SOURCE_ID',
        `Duplicate source_id: ${record.source_id}`,
      );
    }
    const key = sourceDuplicateKey(record);
    if (duplicateKeys.has(key)) {
      throw new EvaluationError(
        'DUPLICATE_SOURCE',
        `Duplicate canonical_url+locator: ${record.canonical_url} ${record.locator}`,
      );
    }
    sourceIds.add(record.source_id);
    duplicateKeys.add(key);
  }
  const existingBytes = existsSync(resolve(path))
    ? readFileSync(resolve(path), 'utf8')
    : '';
  const preservedPrefix =
    existingBytes.length === 0 || existingBytes.endsWith('\n')
      ? existingBytes
      : `${existingBytes}\n`;
  atomicWriteFileSync(
    path,
    `${preservedPrefix}${
      additions.map((record) => JSON.stringify(record)).join('\n')
    }\n`,
    { mode: 0o644 },
  );
  return additions;
}
