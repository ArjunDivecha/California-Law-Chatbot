import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildMessagesFromConversation,
  generateTextStream,
  getErrorDetails,
  hasBedrockProviderCredentials,
} from './_shared/anthropicBedrock.js';
import {
  BedrockConfigError,
  assertNoPromptCacheMetadata,
  resolveBedrockModel,
} from './_shared/bedrockModels.js';
import { SPEED_ALLOWED, enforceFlow, rejectFlow } from './_shared/flowPolicy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  // Speed mode is deliberately non-client passthrough. Reject direct POSTs that
  // try to route confidential/client-safe flows through this endpoint.
  const flowResult = enforceFlow(req.body, SPEED_ALLOWED);
  if (rejectFlow(res, flowResult)) return;

  const { message, conversationHistory } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Missing or invalid message parameter' });
    return;
  }

  if (!hasBedrockProviderCredentials()) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'AWS Bedrock credentials are not configured.',
    });
    return;
  }

  let speedModel;
  try {
    speedModel = resolveBedrockModel('speed');
  } catch (err) {
    if (err instanceof BedrockConfigError) {
      console.error('Bedrock config error:', err.message);
      res.status(500).json({ error: 'bedrock_config_error', message: err.message });
      return;
    }
    throw err;
  }

  const messages = buildMessagesFromConversation(conversationHistory, message);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    console.log(`📡 Speed mode streaming with model: ${speedModel.id}`);
    const requestPayload = {
      model: speedModel.id,
      messages,
      temperature: 0.2,
      maxOutputTokens: 4096,
    };
    assertNoPromptCacheMetadata(requestPayload, 'anthropic-chat');
    const streamResponse = await generateTextStream(requestPayload);

    for await (const event of streamResponse.stream) {
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
    console.error('Anthropic Bedrock stream error:', err);
    const { message } = getErrorDetails(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: message || 'Stream failed.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: message || 'Stream failed.' })}\n\n`);
      res.end();
    }
  }
}
