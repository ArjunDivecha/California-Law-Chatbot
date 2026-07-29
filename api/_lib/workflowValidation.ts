/**
 * Strict parser and validator for the California legal agent bundle.
 *
 * Workflow files are trusted application configuration, not user input. A
 * malformed file should therefore fail the build (and a malformed deployed
 * bundle should fail loudly) instead of being silently ignored.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { parseDocument } from 'yaml';

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  max_tokens: number;
  max_iterations: number;
  core_skill: string;
  intent_skills: Record<string, string>;
  drafting_skills?: Record<string, string>;
  schema_version: number;
  schema_note?: string;
}

export interface SkillMetadata {
  name: string;
  description: string;
  user_invocable: boolean;
  argument_hint?: string;
  /** Optional portable-workflow metadata accepted for future workflow packs. */
  workflow_id?: string;
  version?: string;
  jurisdiction?: string | string[];
  practice?: string | string[];
  author?: string;
  license?: string;
  assets?: string[];
  table_columns?: string;
}

export interface ParsedSkill extends SkillMetadata {
  body: string;
}

export interface ValidatedWorkflowBundle {
  config: AgentConfig;
  skills: Array<{
    relative_name: string;
    path: string;
    skill: ParsedSkill;
  }>;
  referenced_skills: string[];
}

export class WorkflowValidationError extends Error {
  readonly source: string;

  constructor(source: string, message: string) {
    super(`${source}: ${message}`);
    this.name = 'WorkflowValidationError';
    this.source = source;
  }
}

function fail(source: string, message: string): never {
  throw new WorkflowValidationError(source, message);
}

function asRecord(value: unknown, source: string, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(source, `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  source: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(source, `"${key}" must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  source: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(source, `"${key}" must be a non-empty string when present`);
  }
  return value.trim();
}

function stringOrStringArray(
  record: Record<string, unknown>,
  key: string,
  source: string,
): string | string[] | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    return value.map((item) => (item as string).trim());
  }
  fail(source, `"${key}" must be a non-empty string or list of non-empty strings`);
}

function stringArray(
  record: Record<string, unknown>,
  key: string,
  source: string,
): string[] | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    fail(source, `"${key}" must be a non-empty list of non-empty strings`);
  }
  return value.map((item) => (item as string).trim());
}

function stringMap(
  record: Record<string, unknown>,
  key: string,
  source: string,
  optional = false,
): Record<string, string> | undefined {
  const value = record[key];
  if (value === undefined && optional) return undefined;
  const map = asRecord(value, source, `"${key}"`);
  const result: Record<string, string> = {};
  for (const [mapKey, mapValue] of Object.entries(map)) {
    if (!mapKey.trim() || typeof mapValue !== 'string' || !mapValue.trim()) {
      fail(source, `"${key}" entries must map non-empty strings to non-empty strings`);
    }
    result[mapKey.trim()] = mapValue.trim();
  }
  return result;
}

function positiveInteger(
  record: Record<string, unknown>,
  key: string,
  source: string,
): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) <= 0) {
    fail(source, `"${key}" must be a positive integer`);
  }
  return value as number;
}

/**
 * Parse YAML frontmatter and validate the portable skill metadata schema.
 */
export function parseSkillMarkdown(
  text: string,
  source = '<skill>',
): ParsedSkill {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) {
    fail(source, 'missing YAML frontmatter delimited by ---');
  }

  const document = parseDocument(match[1], {
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    fail(
      source,
      `invalid YAML frontmatter: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  const fields = asRecord(document.toJS(), source, 'frontmatter');
  if (typeof fields['user-invocable'] !== 'boolean') {
    fail(source, '"user-invocable" must be a YAML boolean');
  }

  const workflowId = optionalString(fields, 'workflow-id', source);
  if (workflowId && !/^[a-z0-9][a-z0-9._/-]*$/u.test(workflowId)) {
    fail(
      source,
      '"workflow-id" must use lowercase letters, digits, dot, underscore, slash, or hyphen',
    );
  }

  const versionValue = fields.version;
  let version: string | undefined;
  if (versionValue !== undefined && versionValue !== null) {
    if (
      (typeof versionValue !== 'string' && typeof versionValue !== 'number') ||
      String(versionValue).trim().length === 0
    ) {
      fail(source, '"version" must be a non-empty string or number');
    }
    version = String(versionValue).trim();
  }

  const body = match[2].trim();
  if (!body) fail(source, 'skill body must not be empty');

  return {
    name: requiredString(fields, 'name', source),
    description: requiredString(fields, 'description', source),
    user_invocable: fields['user-invocable'],
    argument_hint: optionalString(fields, 'argument-hint', source),
    workflow_id: workflowId,
    version,
    jurisdiction: stringOrStringArray(fields, 'jurisdiction', source),
    practice: stringOrStringArray(fields, 'practice', source),
    author: optionalString(fields, 'author', source),
    license: optionalString(fields, 'license', source),
    assets: stringArray(fields, 'assets', source),
    table_columns: optionalString(fields, 'table-columns', source),
    body,
  };
}

/**
 * Validate the agent.json schema. The runtime still accepts only schema v1;
 * future schema changes must be deliberate rather than silently tolerated.
 */
export function validateAgentConfig(
  value: unknown,
  source = '<agent-config>',
): AgentConfig {
  const record = asRecord(value, source, 'agent config');
  const schemaVersion = positiveInteger(record, 'schema_version', source);
  if (schemaVersion !== 1) {
    fail(source, `unsupported "schema_version" ${schemaVersion}; expected 1`);
  }
  return {
    name: requiredString(record, 'name', source),
    description: requiredString(record, 'description', source),
    model: requiredString(record, 'model', source),
    max_tokens: positiveInteger(record, 'max_tokens', source),
    max_iterations: positiveInteger(record, 'max_iterations', source),
    core_skill: requiredString(record, 'core_skill', source),
    intent_skills: stringMap(record, 'intent_skills', source) ?? {},
    drafting_skills: stringMap(record, 'drafting_skills', source, true),
    schema_version: schemaVersion,
    schema_note: optionalString(record, 'schema_note', source),
  };
}

export function assertSafeSkillReference(name: string, source: string): void {
  if (
    !name ||
    isAbsolute(name) ||
    name.includes('\\') ||
    name.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail(source, `unsafe skill reference "${name}"`);
  }
}

function markdownFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = resolve(directory, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile() && extname(entry).toLowerCase() === '.md') files.push(path);
    }
  };
  visit(root);
  return files;
}

function assertBundleRelativePath(
  bundleRoot: string,
  candidate: string,
  source: string,
): string {
  if (!candidate || isAbsolute(candidate) || candidate.includes('\\')) {
    fail(source, `asset path must be relative: "${candidate}"`);
  }
  const resolved = resolve(dirname(source), candidate);
  const rel = relative(bundleRoot, resolved);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    fail(source, `asset path escapes the workflow bundle: "${candidate}"`);
  }
  if (!existsSync(resolved)) fail(source, `referenced asset does not exist: "${candidate}"`);
  return resolved;
}

/**
 * Validate agent.json, every skill Markdown file, every config reference,
 * unique skill/workflow IDs, and any declared asset paths.
 */
export function validateWorkflowBundle(
  agentConfigPath: string,
  skillsDirectory: string,
): ValidatedWorkflowBundle {
  if (!existsSync(agentConfigPath)) fail(agentConfigPath, 'file does not exist');
  if (!existsSync(skillsDirectory)) fail(skillsDirectory, 'directory does not exist');

  let configJson: unknown;
  try {
    configJson = JSON.parse(readFileSync(agentConfigPath, 'utf8'));
  } catch (error) {
    fail(
      agentConfigPath,
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const config = validateAgentConfig(configJson, agentConfigPath);

  const skills = markdownFiles(skillsDirectory).map((path) => {
    const relativeName = relative(skillsDirectory, path)
      .replace(/\\/g, '/')
      .replace(/\.md$/iu, '');
    return {
      relative_name: relativeName,
      path,
      skill: parseSkillMarkdown(readFileSync(path, 'utf8'), path),
    };
  });
  if (skills.length === 0) fail(skillsDirectory, 'no skill Markdown files found');

  const byReference = new Map(skills.map((entry) => [entry.relative_name, entry]));
  const names = new Map<string, string>();
  const workflowIds = new Map<string, string>();
  for (const entry of skills) {
    const previousName = names.get(entry.skill.name);
    if (previousName) {
      fail(entry.path, `duplicate skill name "${entry.skill.name}" also used by ${previousName}`);
    }
    names.set(entry.skill.name, entry.path);

    if (entry.skill.workflow_id) {
      const previousId = workflowIds.get(entry.skill.workflow_id);
      if (previousId) {
        fail(
          entry.path,
          `duplicate workflow-id "${entry.skill.workflow_id}" also used by ${previousId}`,
        );
      }
      workflowIds.set(entry.skill.workflow_id, entry.path);
    }

    for (const asset of entry.skill.assets ?? []) {
      assertBundleRelativePath(skillsDirectory, asset, entry.path);
    }
    if (entry.skill.table_columns) {
      assertBundleRelativePath(skillsDirectory, entry.skill.table_columns, entry.path);
    }
  }

  const referencedSkills = Array.from(
    new Set([
      config.core_skill,
      ...Object.values(config.intent_skills),
      ...Object.values(config.drafting_skills ?? {}),
    ]),
  );
  for (const reference of referencedSkills) {
    assertSafeSkillReference(reference, agentConfigPath);
    if (!byReference.has(reference)) {
      fail(agentConfigPath, `referenced skill "${reference}" does not exist`);
    }
  }

  return {
    config,
    skills,
    referenced_skills: referencedSkills,
  };
}
