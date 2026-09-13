import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import type {
  EvalArm,
  PriceTable,
  RunManifest,
} from './types.js';
import { atomicWriteFileSync } from './journal.js';
import { sha256, stableJson } from './providers/shared.js';
import { EvaluationError } from './providers/types.js';
import { classifyAttestationKind } from './integrity.js';

export interface ManifestInputs {
  reports_root: string;
  run_id: string;
  mode: RunManifest['mode'];
  dataset_path: string;
  dataset_hash: string;
  attestation_path: string | null;
  attestation_hash: string | null;
  attestation_reviewer_ids: string[];
  calibration_path: string;
  calibration_hash: string;
  calibration_set_kind: RunManifest['calibration_set_kind'];
  system_prompt: string;
  tool_definitions: unknown[];
  arms: EvalArm[];
  models: RunManifest['models'];
  router_classifier_model: string;
  router_pool: string[];
  router_tier_mapping: unknown;
  router_config: unknown;
  price_table: PriceTable;
  judge_id: RunManifest['judge_id'];
  judge_reasoning_effort: RunManifest['judge_reasoning_effort'];
  run_kind?: RunManifest['run_kind'];
  judge_bakeoff_ids?: RunManifest['judge_bakeoff_ids'];
  judge_config_hashes: RunManifest['judge_config_hashes'];
  calibration_binding?: RunManifest['calibration_binding'];
  conservative_cost_estimate_usd:
    RunManifest['conservative_cost_estimate_usd'];
  cost_estimate_method: RunManifest['cost_estimate_method'];
  cost_estimate_per_phase_usd:
    RunManifest['cost_estimate_per_phase_usd'];
  bootstrap_resamples: number;
  max_output_tokens: number;
  max_iterations: number;
}

function gitIdentity(): { git_sha: string; git_dirty: boolean } {
  try {
    const git_sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { git_sha, git_dirty: status.trim().length > 0 };
  } catch {
    throw new EvaluationError(
      'GIT_IDENTITY_UNAVAILABLE',
      'Run manifest requires the repository git SHA and dirty state',
    );
  }
}

function manifestPath(inputs: Pick<ManifestInputs, 'reports_root' | 'run_id'>) {
  return join(resolve(inputs.reports_root), inputs.run_id, 'manifest.json');
}

function pretty(value: unknown): string {
  return `${JSON.stringify(JSON.parse(stableJson(value)), null, 2)}\n`;
}

export function buildRunManifest(
  inputs: ManifestInputs,
  startedAt = new Date().toISOString(),
): RunManifest {
  const git = gitIdentity();
  return {
    schema_version: 1,
    run_id: inputs.run_id,
    mode: inputs.mode,
    run_kind: inputs.run_kind ?? 'candidate_comparison',
    started_at: startedAt,
    completed_at: null,
    ...git,
    dataset_path: resolve(inputs.dataset_path),
    dataset_hash: inputs.dataset_hash,
    attestation_path: inputs.attestation_path
      ? resolve(inputs.attestation_path)
      : null,
    attestation_hash: inputs.attestation_hash,
    attestation_kind: classifyAttestationKind(
      inputs.attestation_reviewer_ids,
    ),
    attestation_reviewer_ids: [...inputs.attestation_reviewer_ids].sort(),
    calibration_path: resolve(inputs.calibration_path),
    calibration_hash: inputs.calibration_hash,
    calibration_set_kind: inputs.calibration_set_kind,
    prompt_hash: sha256(inputs.system_prompt),
    tool_definitions_hash: sha256(inputs.tool_definitions),
    limits_hash: sha256({
      max_output_tokens: inputs.max_output_tokens,
      max_iterations: inputs.max_iterations,
    }),
    arms: [...inputs.arms],
    models: inputs.models,
    router_classifier_model: inputs.router_classifier_model,
    router_pool: [...inputs.router_pool],
    router_tier_mapping_hash: sha256(inputs.router_tier_mapping),
    router_config_hash: sha256(inputs.router_config),
    judge_id: inputs.judge_id,
    judge_model: inputs.judge_id,
    judge_reasoning_effort: inputs.judge_reasoning_effort,
    judge_bakeoff_ids: [...(inputs.judge_bakeoff_ids ?? [])],
    judge_config_hashes: { ...inputs.judge_config_hashes },
    judge_store: false,
    judge_tools: [],
    calibration_binding: inputs.calibration_binding
      ? structuredClone(inputs.calibration_binding)
      : null,
    conservative_cost_estimate_usd:
      inputs.conservative_cost_estimate_usd,
    cost_estimate_method: inputs.cost_estimate_method,
    cost_estimate_per_phase_usd:
      structuredClone(inputs.cost_estimate_per_phase_usd),
    price_table: inputs.price_table,
    price_table_hash: sha256(inputs.price_table),
    replicates: 2,
    bootstrap_seed: 5601,
    bootstrap_resamples: inputs.bootstrap_resamples,
    max_output_tokens: inputs.max_output_tokens,
    max_iterations: inputs.max_iterations,
  };
}

export function startRunManifest(
  inputs: ManifestInputs,
  options: { resume: boolean },
): { path: string; manifest: RunManifest } {
  const path = manifestPath(inputs);
  if (options.resume) {
    let existing: RunManifest;
    try {
      existing = JSON.parse(readFileSync(path, 'utf8')) as RunManifest;
    } catch (error) {
      throw new EvaluationError(
        'RESUME_MANIFEST_REQUIRED',
        `Resume requires a readable manifest: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const expected = buildRunManifest(inputs, existing.started_at);
    const comparable = (manifest: RunManifest) => ({
      ...manifest,
      completed_at: null,
      git_dirty: expected.git_dirty,
    });
    if (stableJson(comparable(existing)) !== stableJson(comparable(expected))) {
      throw new EvaluationError(
        'RESUME_MANIFEST_MISMATCH',
        'Resume configuration does not match the frozen run manifest',
      );
    }
    if (existing.completed_at !== null) {
      throw new EvaluationError(
        'RUN_ALREADY_COMPLETE',
        `Run ${inputs.run_id} is already finalized`,
      );
    }
    return { path, manifest: existing };
  }
  const manifest = buildRunManifest(inputs);
  atomicWriteFileSync(path, pretty(manifest), { mode: 0o600 });
  return { path, manifest };
}

export function finalizeRunManifest(
  path: string,
  manifest: RunManifest,
  completedAt = new Date().toISOString(),
): RunManifest {
  const finalManifest = { ...manifest, completed_at: completedAt };
  atomicWriteFileSync(path, pretty(finalManifest), { mode: 0o600 });
  return finalManifest;
}
