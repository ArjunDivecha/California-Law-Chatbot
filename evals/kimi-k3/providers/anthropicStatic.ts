import type {
  CandidateResult,
  CandidateRunConfig,
  EvalTask,
} from '../types.js';
import type { CandidateProvider } from './types.js';
import { EvaluationError } from './types.js';
import { runNormalizedCandidate } from './shared.js';

export class AnthropicStaticProvider implements CandidateProvider {
  async run(
    task: EvalTask,
    config: CandidateRunConfig,
  ): Promise<CandidateResult> {
    if (config.arm !== 'static_anthropic') {
      throw new EvaluationError(
        'PROVIDER_ARM_MISMATCH',
        `AnthropicStaticProvider requires static_anthropic, received ${config.arm}`,
      );
    }
    return runNormalizedCandidate('anthropic', task, config);
  }
}

export function createAnthropicStaticProvider(): CandidateProvider {
  return new AnthropicStaticProvider();
}
