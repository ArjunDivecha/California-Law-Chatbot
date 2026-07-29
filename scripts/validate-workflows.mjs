#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflowBundle } from '../api/_lib/workflowValidation.js';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const agentDirectory = resolve(repoRoot, 'agents', 'california-legal');
const result = validateWorkflowBundle(
  resolve(agentDirectory, 'agent.json'),
  resolve(agentDirectory, 'skills'),
);

console.log(
  `Workflow validation passed: ${result.skills.length} skills, ` +
    `${result.referenced_skills.length} configured references, schema v${result.config.schema_version}.`,
);
