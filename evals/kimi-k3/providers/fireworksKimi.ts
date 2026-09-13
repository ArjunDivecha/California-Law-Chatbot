import type {
  CandidateResult,
  CandidateRunConfig,
  EvalTask,
} from '../types.js';
import type { CandidateProvider } from './types.js';
import { EvaluationError } from './types.js';
import { runNormalizedCandidate } from './shared.js';

export const FIREWORKS_KIMI_MODEL =
  'accounts/fireworks/routers/kimi-k3-us' as const;

export class FireworksKimiProvider implements CandidateProvider {
  async run(
    task: EvalTask,
    config: CandidateRunConfig,
  ): Promise<CandidateResult> {
    if (config.arm !== 'fireworks_kimi') {
      throw new EvaluationError(
        'PROVIDER_ARM_MISMATCH',
        `FireworksKimiProvider requires fireworks_kimi, received ${config.arm}`,
      );
    }
    if (config.model !== FIREWORKS_KIMI_MODEL) {
      throw new EvaluationError(
        'KIMI_MODEL_MISMATCH',
        `Fireworks Kimi is pinned to ${FIREWORKS_KIMI_MODEL}`,
      );
    }
    return runNormalizedCandidate('fireworks', task, config);
  }
}

export function createFireworksKimiProvider(): CandidateProvider {
  return new FireworksKimiProvider();
}
