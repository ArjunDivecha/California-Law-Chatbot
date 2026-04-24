import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildMessagesFromConversation,
  generateTextStream,
  getErrorDetails,
  hasBedrockProviderCredentials,
} from '../utils/anthropicBedrock';
import { buildWebSearchContext, shouldUseWebSearch } from '../utils/webSearchContext';
import { enforceFlow, rejectFlow, SPEED_ALLOWED } from '../utils/flowPolicy';
import {
  BedrockConfigError,
  assertNoPromptCacheMetadata,
  resolveBedrockModel,
} from '../utils/bedrockModels';

const SYSTEM_PROMPT = `You are a California law research assistant for femme & femme LLP. \
Answer questions about California statutes, case law, regulations, and legal procedures. \
Answer from the information available in the conversation, your model knowledge, and any provided web context. \
If the answer may depend on current law or jurisdiction-specific facts, say so clearly. \
When web context is provided, use it carefully and cite source URLs inline when you rely on them. \
This Speed endpoint is a non-client passthrough path; do not represent it as safe for confidential client facts. \
Do not provide legal advice — provide legal information and research only.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  // Speed route only accepts the non-client passthrough flow. Reject any
  // request that tries to use this endpoint for client-safe Accuracy work.
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
      message:
        'AWS Bedrock credentials are not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION, or provide an AWS profile/role available to the server.',
    });
    return;
  }

  let speedModel;
  try {
    speedModel = resolveBedrockModel('speed');
  } catch (err) {
    if (err instanceof BedrockConfigError) {
      console.error('Bedrock config error:', err.message);
      res.status(500).json({
        error: 'bedrock_config_error',
        message: err.message,
      });
      return;
    }
    throw err;
  }

  const webSearchRequested = shouldUseWebSearch(message);
  const { webContext, meta: webSearchMeta } = await buildWebSearchContext(message, webSearchRequested);
  const groundedMessage = webContext
    ? `${message}\n\nUse the current web context below when it is relevant to answering accurately.\n${webContext}`
    : message;
  const messages = buildMessagesFromConversation(conversationHistory, groundedMessage);

  // SSE headers — stream tokens to the client as they arrive
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    console.log(
      `📡 Streaming Anthropic Bedrock response with model: ${speedModel.id} (web_search=${webSearchMeta.enabled ? `${webSearchMeta.provider}:${webSearchMeta.resultsCount}` : webSearchMeta.reason || 'off'})`
    );
    const requestPayload = {
      model: speedModel.id,
      messages,
      systemInstruction: SYSTEM_PROMPT,
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
    // If headers not yet sent, send a JSON error; otherwise close the stream
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: message || 'Stream failed.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: message || 'Stream failed.' })}\n\n`);
      res.end();
    }
  }
}
