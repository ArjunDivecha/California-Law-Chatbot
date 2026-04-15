import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_TIMEOUT_MS = 60000; // 60s — web search adds latency

const SYSTEM_PROMPT = `You are a California law research assistant for femme & femme LLP. \
Answer questions about California statutes, case law, regulations, and legal procedures. \
Use web search to find current, accurate legal information. \
Always cite your sources. Clarify when information may vary by jurisdiction or circumstance. \
Do not provide legal advice — provide legal information and research only.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { message, conversationHistory } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Missing or invalid message parameter' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Server configuration error', message: 'ANTHROPIC_API_KEY is not set.' });
    return;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  // Build message list: prior history + current user message
  const history: Array<{ role: string; text: string }> = Array.isArray(conversationHistory)
    ? conversationHistory
    : [];

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history
      .filter(m => m.text?.trim())
      .map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      })),
    { role: 'user', content: message },
  ];

  try {
    const response = await anthropic.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          } as any,
        ],
      },
      { signal: controller.signal }
    );

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.Messages.TextBlock).text)
      .join('');

    const webSearches = (response.usage as any)?.server_tool_use?.web_search_requests ?? 0;

    res.status(200).json({
      text,
      model: ANTHROPIC_MODEL,
      provider: 'anthropic',
      webSearches,
    });
  } catch (err: any) {
    console.error('Anthropic direct API error:', err);
    const status = typeof err?.status === 'number' ? err.status : 500;
    const messageText = controller.signal.aborted
      ? 'Request timed out. Please try again.'
      : err?.message || 'Anthropic request failed.';
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Internal Server Error',
      message: messageText,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
