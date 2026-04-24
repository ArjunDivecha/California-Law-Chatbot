/**
 * Debug API Endpoint
 * 
 * Shows which environment variables are configured (not their values).
 * Helps diagnose deployment configuration issues.
 */

import { existsSync } from 'fs';
import { homedir } from 'os';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const hasSharedAwsFiles =
    existsSync(process.env.AWS_SHARED_CREDENTIALS_FILE || `${homedir()}/.aws/credentials`) ||
    existsSync(process.env.AWS_CONFIG_FILE || `${homedir()}/.aws/config`);

  const hasStaticAwsKeys = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasAwsProfileHints =
    !!process.env.AWS_PROFILE ||
    !!process.env.AWS_ROLE_ARN ||
    !!process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;

  const envStatus = {
    BEDROCK_AWS_REGION: !!process.env.BEDROCK_AWS_REGION,
    AWS_REGION: !!process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: !!process.env.AWS_SESSION_TOKEN,
    AWS_BEARER_TOKEN_BEDROCK: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
    BEDROCK_API_KEY: !!process.env.BEDROCK_API_KEY,
    AWS_PROFILE: !!process.env.AWS_PROFILE,
    AWS_SHARED_FILES: hasSharedAwsFiles,
    UPSTASH_VECTOR_REST_URL: !!process.env.UPSTASH_VECTOR_REST_URL,
    UPSTASH_VECTOR_REST_TOKEN: !!process.env.UPSTASH_VECTOR_REST_TOKEN,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    COURTLISTENER_API_KEY: !!process.env.COURTLISTENER_API_KEY,
    EXA_API_KEY: !!process.env.EXA_API_KEY,
    SERPER_API_KEY: !!process.env.SERPER_API_KEY,
  };

  const missingKeys: string[] = [];

  if (!envStatus.OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');
  if (!envStatus.COURTLISTENER_API_KEY) missingKeys.push('COURTLISTENER_API_KEY');
  if (!envStatus.UPSTASH_VECTOR_REST_URL) missingKeys.push('UPSTASH_VECTOR_REST_URL');
  if (!envStatus.UPSTASH_VECTOR_REST_TOKEN) missingKeys.push('UPSTASH_VECTOR_REST_TOKEN');

  if (
    !hasStaticAwsKeys &&
    !envStatus.AWS_BEARER_TOKEN_BEDROCK &&
    !envStatus.BEDROCK_API_KEY &&
    !hasAwsProfileHints &&
    !hasSharedAwsFiles
  ) {
    missingKeys.push('AWS_BEDROCK_CREDENTIALS');
  }

  // Probe Bedrock client init to surface the actual runtime error.
  // Region values are safe to echo (not secrets).
  let bedrockProbe: {
    awsRegionValue?: string;
    bedrockAwsRegionValue?: string;
    clientInit: 'ok' | 'failed';
    speedCallError?: string;
  } = { clientInit: 'ok' };

  try {
    const { getAnthropicBedrockClient, resolveBedrockProviderConfig } = await import('../utils/anthropicBedrock.ts');
    const cfg = resolveBedrockProviderConfig();
    bedrockProbe.awsRegionValue = process.env.AWS_REGION || '';
    bedrockProbe.bedrockAwsRegionValue = cfg.awsRegion;
    const client = getAnthropicBedrockClient();
    // Fire-and-forget a tiny probe so we capture a real AWS error if signing fails.
    try {
      const { resolveBedrockModel } = await import('../utils/bedrockModels.ts');
      const model = resolveBedrockModel('speed').id;
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
    } catch (probeErr: any) {
      bedrockProbe.speedCallError = probeErr?.message || String(probeErr);
    }
  } catch (err: any) {
    bedrockProbe.clientInit = 'failed';
    bedrockProbe.speedCallError = err?.message || String(err);
  }

  res.status(200).json({
    status: missingKeys.length === 0 ? 'all_configured' : 'missing_keys',
    envStatus,
    missingKeys,
    bedrockProbe,
    timestamp: new Date().toISOString(),
  });
}
