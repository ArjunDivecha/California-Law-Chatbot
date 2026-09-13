import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  CalibrationBinding,
  CalibrationRates,
  JudgeId,
} from '../types.js';
import { calibrationThresholdFailures } from './calibration.js';

const MAX_BINDING_AGE_MS = 24 * 60 * 60 * 1_000;
const METRIC_KEYS: Array<keyof CalibrationRates> = [
  'winner_accuracy',
  'hard_failure_recall',
  'legal_trap_false_clear_rate',
  'position_inconsistency_rate',
  'injection_resistance',
  'schema_validity',
];

interface BoundJudgeResult {
  judge_id?: unknown;
  judge_config_hash?: unknown;
  calibration_set_content_hash?: unknown;
  run_started_at?: unknown;
  calibration_pass?: unknown;
  rates?: unknown;
  failed_thresholds?: unknown;
}

interface BoundBakeoffReport {
  run_id?: unknown;
  fixture_non_live?: unknown;
  judges?: unknown;
}

interface BoundBakeoffManifest {
  run_id?: unknown;
  mode?: unknown;
  run_kind?: unknown;
  started_at?: unknown;
  calibration_hash?: unknown;
  judge_config_hashes?: unknown;
}

export interface CalibrationBindingVerification {
  binding: CalibrationBinding | null;
  mismatch: string | null;
}

function freshBakeoffRequired(detail: string): CalibrationBindingVerification {
  return {
    binding: null,
    mismatch:
      `CALIBRATION_BINDING_METADATA_MISSING: ${detail}. ` +
      'Run a fresh standalone --judge-bakeoff; older bake-off artifacts cannot be bound.',
  };
}

function mismatch(detail: string): CalibrationBindingVerification {
  return {
    binding: null,
    mismatch: `CALIBRATION_BINDING_MISMATCH: ${detail}`,
  };
}

function readArtifact<T>(
  runDirectory: string,
  name: 'judge-bakeoff.json' | 'manifest.json',
): T | CalibrationBindingVerification {
  try {
    return JSON.parse(
      readFileSync(join(resolve(runDirectory), name), 'utf8'),
    ) as T;
  } catch (error) {
    return freshBakeoffRequired(
      `${name} is missing or unreadable (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}

function isVerification(
  value: unknown,
): value is CalibrationBindingVerification {
  return (
    value !== null &&
    typeof value === 'object' &&
    'binding' in value &&
    'mismatch' in value
  );
}

function fullRates(value: unknown): CalibrationRates | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== METRIC_KEYS.length ||
    METRIC_KEYS.some(
      (key) =>
        typeof record[key] !== 'number' ||
        !Number.isFinite(record[key]),
    )
  ) {
    return null;
  }
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [key, record[key]]),
  ) as unknown as CalibrationRates;
}

function stringRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function verifyCalibrationBinding(options: {
  run_directory: string;
  judge_id: JudgeId;
  current_judge_config_hash: string;
  current_calibration_set_content_hash: string;
  now_ms?: number;
}): CalibrationBindingVerification {
  const report = readArtifact<BoundBakeoffReport>(
    options.run_directory,
    'judge-bakeoff.json',
  );
  if (isVerification(report)) return report;
  const manifest = readArtifact<BoundBakeoffManifest>(
    options.run_directory,
    'manifest.json',
  );
  if (isVerification(manifest)) return manifest;

  if (
    typeof report.run_id !== 'string' ||
    typeof manifest.run_id !== 'string'
  ) {
    return freshBakeoffRequired(
      'judge-bakeoff.json and manifest.json must both record run_id',
    );
  }
  if (report.run_id !== manifest.run_id) {
    return mismatch(
      `run id differs between artifacts (${report.run_id} != ${manifest.run_id})`,
    );
  }
  if (manifest.run_kind !== 'judge_bakeoff' || manifest.mode !== 'live') {
    return mismatch(
      'bound run is not a standalone live judge bake-off',
    );
  }
  if (report.fixture_non_live !== false) {
    return mismatch('bound bake-off is marked fixture/non-live');
  }
  if (!Array.isArray(report.judges)) {
    return freshBakeoffRequired(
      'judge-bakeoff.json does not contain per-judge results',
    );
  }
  const boundJudge = (report.judges as BoundJudgeResult[]).find(
    (judge) => judge.judge_id === options.judge_id,
  );
  if (!boundJudge) {
    return mismatch(
      `judge id ${options.judge_id} was not measured in bound run ${report.run_id}`,
    );
  }

  if (
    typeof boundJudge.judge_config_hash !== 'string' ||
    typeof boundJudge.calibration_set_content_hash !== 'string' ||
    typeof boundJudge.run_started_at !== 'string'
  ) {
    return freshBakeoffRequired(
      `per-judge binding metadata is incomplete for ${options.judge_id}`,
    );
  }
  const manifestHashes = stringRecord(manifest.judge_config_hashes);
  if (
    !manifestHashes ||
    typeof manifestHashes[options.judge_id] !== 'string'
  ) {
    return freshBakeoffRequired(
      `manifest.json lacks the judge-config hash for ${options.judge_id}`,
    );
  }
  if (
    typeof manifest.calibration_hash !== 'string' ||
    typeof manifest.started_at !== 'string'
  ) {
    return freshBakeoffRequired(
      'manifest.json lacks calibration_hash or started_at',
    );
  }

  if (
    boundJudge.judge_config_hash !== manifestHashes[options.judge_id]
  ) {
    return mismatch(
      `judge-config hash differs between bake-off report and manifest for ${options.judge_id}`,
    );
  }
  if (
    boundJudge.calibration_set_content_hash !== manifest.calibration_hash
  ) {
    return mismatch(
      'calibration-set content hash differs between bake-off report and manifest',
    );
  }
  if (boundJudge.run_started_at !== manifest.started_at) {
    return mismatch(
      'run start timestamp differs between bake-off report and manifest',
    );
  }
  if (
    boundJudge.judge_config_hash !== options.current_judge_config_hash
  ) {
    return mismatch(
      `judge-config hash changed for ${options.judge_id} ` +
      `(${boundJudge.judge_config_hash} != ${options.current_judge_config_hash})`,
    );
  }
  if (
    boundJudge.calibration_set_content_hash !==
      options.current_calibration_set_content_hash
  ) {
    return mismatch(
      'calibration-set content hash changed ' +
      `(${boundJudge.calibration_set_content_hash} != ` +
      `${options.current_calibration_set_content_hash})`,
    );
  }

  const startedAtMs = Date.parse(boundJudge.run_started_at);
  if (!Number.isFinite(startedAtMs)) {
    return freshBakeoffRequired(
      `run start timestamp is invalid for ${options.judge_id}`,
    );
  }
  const ageMs = (options.now_ms ?? Date.now()) - startedAtMs;
  if (ageMs < 0 || ageMs > MAX_BINDING_AGE_MS) {
    return mismatch(
      `bound run is outside the 24-hour window (age_ms=${ageMs})`,
    );
  }

  const rates = fullRates(boundJudge.rates);
  if (!rates) {
    return freshBakeoffRequired(
      `full calibration metric rates are missing for ${options.judge_id}`,
    );
  }
  const recordedFailures = Array.isArray(boundJudge.failed_thresholds)
    ? boundJudge.failed_thresholds
    : null;
  const computedFailures = calibrationThresholdFailures(rates);
  if (
    boundJudge.calibration_pass !== true ||
    recordedFailures === null ||
    recordedFailures.length > 0 ||
    computedFailures.length > 0
  ) {
    return mismatch(
      `bound judge failed calibration thresholds ` +
      `(${computedFailures.join(', ') || recordedFailures?.join(', ') || 'calibration_pass=false'})`,
    );
  }

  return {
    binding: {
      bound_run_id: report.run_id,
      bound_judge_id: options.judge_id,
      bound_run_started_at: boundJudge.run_started_at,
      bound_metrics: rates,
      matched_hashes: {
        judge_config_hash: boundJudge.judge_config_hash,
        calibration_set_content_hash:
          boundJudge.calibration_set_content_hash,
      },
      binding_verified: true,
    },
    mismatch: null,
  };
}
