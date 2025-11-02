/**
 * Test endpoint to verify Upstash credentials are configured
 */

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL;
    const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN;
    const openaiKey = process.env.OPENAI_API_KEY;

    const status = {
      upstashUrl: upstashUrl ? '✅ Set' : '❌ Missing',
      upstashToken: upstashToken ? '✅ Set' : '❌ Missing',
      openaiKey: openaiKey ? '✅ Set' : '❌ Missing',
      upstashUrlValue: upstashUrl ? upstashUrl.substring(0, 30) + '...' : 'Not set',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

