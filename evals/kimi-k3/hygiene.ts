import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EvaluationError } from './providers/types.js';

const SECRET_PATTERNS = [
  { label: 'sk-prefix', regex: /\bsk-[a-z0-9_-]{8,}\b/giu },
  { label: 'key-assignment', regex: /\b(?:api[_-]?)?key\s*=\s*[^\s"',;]+/giu },
  { label: 'bearer', regex: /\bbearer\s+[a-z0-9._~+/-]{8,}/giu },
] as const;

const HIDDEN_REASONING_FIELD =
  /"(?:reasoning|thinking|hidden[_-]?reasoning|reasoning[_-]?content|chain[_-]?of[_-]?thought|internal[_-]?thinking|thinking[_-]?content)"\s*:/giu;

const ENV_SECRET_NAMES = [
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'FIREWORKS_API_KEY',
] as const;

function environmentSecrets(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  return ENV_SECRET_NAMES.flatMap((name) => {
    const value = environment[name];
    return value && value.length >= 4 ? [value] : [];
  });
}

function redactString(
  value: string,
  environment: NodeJS.ProcessEnv,
): string {
  let clean = value;
  for (const { regex } of SECRET_PATTERNS) {
    clean = clean.replace(regex, '[REDACTED]');
  }
  for (const secret of environmentSecrets(environment)) {
    clean = clean.split(secret).join('[REDACTED]');
  }
  return clean;
}

export function sanitizeArtifactValue(
  value: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeArtifactValue(item, environment));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) =>
          !(
            /^(?:reasoning|thinking)$/iu.test(key) ||
            /(api.?key|secret|token.?map|hidden.?reasoning|reasoning.?content|chain.?of.?thought|internal.?thinking|thinking.?content|password)/iu
              .test(key)
          )
        )
        .map(([key, item]) => [
          key,
          sanitizeArtifactValue(item, environment),
        ]),
    );
  }
  return typeof value === 'string'
    ? redactString(value, environment)
    : value;
}

function filesRecursively(root: string): string[] {
  if (!statSync(root).isDirectory()) return [root];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

export interface ArtifactHygieneReport {
  scanned_files: number;
  secret_matches_in_reports: number;
  hidden_reasoning_fields_in_reports: number;
  secret_match_files: string[];
  hidden_reasoning_files: string[];
}

export function scanArtifactHygiene(
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): ArtifactHygieneReport {
  const resolved = resolve(root);
  const files = filesRecursively(resolved);
  const secretFiles = new Set<string>();
  const hiddenFiles = new Set<string>();
  let secretMatches = 0;
  let hiddenMatches = 0;
  const exactSecrets = environmentSecrets(environment);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const { regex } of SECRET_PATTERNS) {
      regex.lastIndex = 0;
      const matches = content.match(regex) ?? [];
      secretMatches += matches.length;
      if (matches.length > 0) secretFiles.add(file);
    }
    for (const secret of exactSecrets) {
      let offset = 0;
      while ((offset = content.indexOf(secret, offset)) !== -1) {
        secretMatches += 1;
        secretFiles.add(file);
        offset += secret.length;
      }
    }
    HIDDEN_REASONING_FIELD.lastIndex = 0;
    const hidden = content.match(HIDDEN_REASONING_FIELD) ?? [];
    hiddenMatches += hidden.length;
    if (hidden.length > 0) hiddenFiles.add(file);
  }
  return {
    scanned_files: files.length,
    secret_matches_in_reports: secretMatches,
    hidden_reasoning_fields_in_reports: hiddenMatches,
    secret_match_files: [...secretFiles].sort(),
    hidden_reasoning_files: [...hiddenFiles].sort(),
  };
}

export function assertArtifactHygiene(
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): ArtifactHygieneReport {
  const report = scanArtifactHygiene(root, environment);
  if (
    report.secret_matches_in_reports > 0 ||
    report.hidden_reasoning_fields_in_reports > 0
  ) {
    throw new EvaluationError(
      'ARTIFACT_HYGIENE_FAILED',
      `Artifact scan found ${report.secret_matches_in_reports} secret match(es) and ${report.hidden_reasoning_fields_in_reports} hidden-reasoning field(s)`,
    );
  }
  return report;
}
