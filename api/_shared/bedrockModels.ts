/**
 * Bedrock Model Resolution
 *
 * Single source of truth for Bedrock inference profile IDs used by
 * client-related generative routes. Fails closed if a configured value is
 * missing or looks like a legacy Gemini / OpenRouter alias.
 *
 * GEMINI_* fallbacks have been removed from production paths. Set the
 * BEDROCK_* environment variables only.
 */

export type BedrockRole =
  | 'speed'      // Speed passthrough generator (anthropic-chat)
  | 'primary'    // Accuracy primary generator (gemini-chat)
  | 'fallback'   // Accuracy fallback generator (gemini-chat)
  | 'verifier'   // Verifier (claude-chat)
  | 'research'   // Research-agent summary
  | 'drafter';   // Document drafter agent

const ENV_KEYS: Record<BedrockRole, string> = {
  speed:    'BEDROCK_SPEED_MODEL',
  primary:  'BEDROCK_PRIMARY_MODEL',
  fallback: 'BEDROCK_FALLBACK_MODEL',
  verifier: 'BEDROCK_VERIFIER_MODEL',
  research: 'BEDROCK_RESEARCH_MODEL',
  drafter:  'BEDROCK_DRAFTER_MODEL',
};

/**
 * Sanity-check shape:
 *   - must look like an AWS Bedrock inference profile / model ID
 *   - must reference Anthropic
 *   - must NOT match any legacy Gemini / OpenRouter alias
 */
const ANTHROPIC_HINT = /anthropic|claude/i;
const FORBIDDEN_PATTERNS: RegExp[] = [
  /^google\//i,        // OpenRouter google/* aliases
  /^openai\//i,
  /^anthropic\/.*-via.*/i,
  /gemini/i,           // any gemini-* model
  /^or-/i,             // OpenRouter prefix some users use
];

export interface ResolvedBedrockModel {
  id: string;
  role: BedrockRole;
  envVar: string;
}

export class BedrockConfigError extends Error {
  readonly role: BedrockRole;
  readonly envVar: string;
  constructor(role: BedrockRole, envVar: string, message: string) {
    super(message);
    this.name = 'BedrockConfigError';
    this.role = role;
    this.envVar = envVar;
  }
}

/**
 * Validate a candidate Bedrock model ID. Throws on failure with the env var
 * name in the message so misconfigurations are obvious in logs.
 */
export function validateBedrockModelId(
  role: BedrockRole,
  envVar: string,
  rawValue: string | undefined
): string {
  const value = (rawValue || '').trim();
  if (!value) {
    throw new BedrockConfigError(
      role,
      envVar,
      `Missing required Bedrock model ID. Set ${envVar} to a verified AWS Bedrock inference profile (e.g. us.anthropic.claude-sonnet-4-6).`
    );
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      throw new BedrockConfigError(
        role,
        envVar,
        `${envVar}="${value}" looks like a legacy Gemini/OpenRouter alias. Replace with a verified AWS Bedrock inference profile ID.`
      );
    }
  }

  if (!ANTHROPIC_HINT.test(value)) {
    throw new BedrockConfigError(
      role,
      envVar,
      `${envVar}="${value}" does not look like an Anthropic Bedrock model. Expected an ID containing "anthropic" or "claude".`
    );
  }

  return value;
}

/**
 * Resolve the Bedrock model ID for a given role from process.env.
 * Throws BedrockConfigError if missing or invalid.
 */
export function resolveBedrockModel(role: BedrockRole): ResolvedBedrockModel {
  const envVar = ENV_KEYS[role];
  const id = validateBedrockModelId(role, envVar, process.env[envVar]);
  return { id, role, envVar };
}

/**
 * Static guard: confirm a request payload going to Bedrock does not include
 * any prompt-cache control metadata. Client-confidential prompts must never
 * be cached.
 */
export function assertNoPromptCacheMetadata(payload: unknown, context: string): void {
  if (!payload || typeof payload !== 'object') return;
  const seen = new Set<unknown>();
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'cache_control' || key === 'cacheControl') {
        throw new Error(
          `Bedrock request from ${context} contains prompt-cache metadata ("${key}"). Client-confidential prompts must not be cached.`
        );
      }
      if (value && typeof value === 'object') stack.push(value);
    }
  }
}
