import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  WorkflowValidationError,
  parseSkillMarkdown,
  validateAgentConfig,
  validateWorkflowBundle,
} from '../api/_lib/workflowValidation.js';

let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const validSkill = `---
name: example
description: "Description with: real YAML"
user-invocable: false
argument-hint: "[matter]"
workflow-id: california.example
version: 1.2.0
jurisdiction:
  - California
practice: litigation
---

Do the workflow carefully.
`;

const validConfig = {
  name: 'california-legal',
  description: 'test',
  model: 'test-model',
  max_tokens: 1000,
  max_iterations: 4,
  core_skill: 'example',
  intent_skills: {},
  drafting_skills: {},
  schema_version: 1,
};

await test('parses real YAML frontmatter and optional workflow metadata', () => {
  const parsed = parseSkillMarkdown(validSkill, 'valid.md');
  assert.equal(parsed.name, 'example');
  assert.equal(parsed.description, 'Description with: real YAML');
  assert.equal(parsed.user_invocable, false);
  assert.equal(parsed.workflow_id, 'california.example');
  assert.deepEqual(parsed.jurisdiction, ['California']);
});

await test('rejects quoted booleans instead of coercing them', () => {
  assert.throws(
    () =>
      parseSkillMarkdown(
        validSkill.replace('user-invocable: false', 'user-invocable: "false"'),
        'quoted-boolean.md',
      ),
    (error) =>
      error instanceof WorkflowValidationError &&
      error.message.includes('must be a YAML boolean'),
  );
});

await test('rejects malformed or missing frontmatter', () => {
  assert.throws(
    () => parseSkillMarkdown('# No frontmatter', 'missing.md'),
    (error) =>
      error instanceof WorkflowValidationError &&
      error.message.includes('missing YAML frontmatter'),
  );
});

await test('validates the supported agent config schema', () => {
  const validated = validateAgentConfig(validConfig, 'agent.json');
  assert.equal(validated.name, validConfig.name);
  assert.equal(validated.schema_version, validConfig.schema_version);
  assert.deepEqual(validated.intent_skills, validConfig.intent_skills);
  assert.throws(
    () => validateAgentConfig({ ...validConfig, schema_version: 2 }, 'agent.json'),
    (error) =>
      error instanceof WorkflowValidationError &&
      error.message.includes('unsupported "schema_version"'),
  );
});

await test('validates every configured skill reference in a bundle', () => {
  const root = mkdtempSync(join(tmpdir(), 'cal-law-workflows-'));
  const skills = join(root, 'skills');
  mkdirSync(skills);
  writeFileSync(join(root, 'agent.json'), JSON.stringify(validConfig));
  writeFileSync(join(skills, 'example.md'), validSkill);

  const result = validateWorkflowBundle(join(root, 'agent.json'), skills);
  assert.equal(result.skills.length, 1);
  assert.deepEqual(result.referenced_skills, ['example']);

  writeFileSync(
    join(root, 'agent.json'),
    JSON.stringify({ ...validConfig, core_skill: '../escape' }),
  );
  assert.throws(
    () => validateWorkflowBundle(join(root, 'agent.json'), skills),
    (error) =>
      error instanceof WorkflowValidationError &&
      error.message.includes('unsafe skill reference'),
  );
});

await test('rejects duplicate immutable workflow IDs', () => {
  const root = mkdtempSync(join(tmpdir(), 'cal-law-workflows-'));
  const skills = join(root, 'skills');
  mkdirSync(skills);
  writeFileSync(join(root, 'agent.json'), JSON.stringify(validConfig));
  writeFileSync(join(skills, 'example.md'), validSkill);
  writeFileSync(
    join(skills, 'second.md'),
    validSkill.replace('name: example', 'name: second'),
  );
  assert.throws(
    () => validateWorkflowBundle(join(root, 'agent.json'), skills),
    (error) =>
      error instanceof WorkflowValidationError &&
      error.message.includes('duplicate workflow-id'),
  );
});

console.log(`\n${passed} workflow validation tests passed.`);
