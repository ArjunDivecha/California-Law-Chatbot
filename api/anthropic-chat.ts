import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';


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

  // SSE headers — stream tokens to the client as they arrive
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = await anthropic.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        } as any,
      ],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta' &&
        event.delta.text
      ) {
        res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Anthropic stream error:', err);
    // If headers not yet sent, send a JSON error; otherwise close the stream
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: err?.message || 'Stream failed.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Stream failed.' })}\n\n`);
      res.end();
    }
  }
}
