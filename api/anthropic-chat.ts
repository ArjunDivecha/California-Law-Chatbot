import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_DIRECT_MODEL || 'claude-sonnet-4-5-20250929';
const ANTHROPIC_TIMEOUT_MS = 30000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { message } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Missing or invalid message parameter' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'ANTHROPIC_API_KEY is not set.',
    });
    return;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const response = await anthropic.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      },
      {
        signal: controller.signal,
      }
    );

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    res.status(200).json({
      text,
      model: ANTHROPIC_MODEL,
      provider: 'anthropic',
    });
  } catch (err: any) {
    console.error('Anthropic direct API error:', err);
    const status = typeof err?.status === 'number' ? err.status : 500;
    const messageText =
      controller.signal.aborted
        ? 'Anthropic request timed out. Please try again.'
        : err?.message || 'Anthropic request failed.';

    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Internal Server Error',
      message: messageText,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
