/**
 * Debug API Endpoint
 * 
 * Shows which environment variables are configured (not their values).
 * Helps diagnose deployment configuration issues.
 */

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const envStatus = {
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    UPSTASH_VECTOR_REST_URL: !!process.env.UPSTASH_VECTOR_REST_URL,
    UPSTASH_VECTOR_REST_TOKEN: !!process.env.UPSTASH_VECTOR_REST_TOKEN,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    COURTLISTENER_API_KEY: !!process.env.COURTLISTENER_API_KEY,
  };

  const missingKeys = Object.entries(envStatus)
    .filter(([_, isSet]) => !isSet)
    .map(([key]) => key);

  res.status(200).json({
    status: missingKeys.length === 0 ? 'all_configured' : 'missing_keys',
    envStatus,
    missingKeys,
    timestamp: new Date().toISOString(),
  });
}
