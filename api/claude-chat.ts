/**
 * Verification chat endpoint backed by Anthropic on AWS Bedrock.
 *
 * POST /api/claude-chat - Generate verification-oriented content.
 *
 * The route name is preserved for compatibility with the existing verifier flow.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildMessagesFromConversation,
  generateText,
  getErrorDetails,
  hasBedrockProviderCredentials,
} from '../utils/anthropicBedrock';
import { ACCURACY_ALLOWED, enforceFlow, rejectFlow } from '../utils/flowPolicy';
import {
  BedrockConfigError,
  assertNoPromptCacheMetadata,
  resolveBedrockModel,
} from '../utils/bedrockModels';

const VERIFIER_TIMEOUT_MS = Number(process.env.BEDROCK_VERIFIER_TIMEOUT_MS || 60000);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Verifier serves Accuracy flows only.
    const flowResult = enforceFlow(req.body, ACCURACY_ALLOWED);
    if (rejectFlow(res, flowResult)) return;

    const { message, systemPrompt, conversationHistory } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Missing or invalid message parameter' });
      return;
    }

    if (!hasBedrockProviderCredentials()) {
      console.error('Anthropic Bedrock credentials are not set in environment variables');
      res.status(500).json({
        error: 'Server configuration error',
        message:
          'Set AWS Bedrock credentials (for example AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION) or configure an AWS profile/role available to the server.',
      });
      return;
    }

    let verifierModel;
    try {
      verifierModel = resolveBedrockModel('verifier');
    } catch (err) {
      if (err instanceof BedrockConfigError) {
        console.error('Bedrock config error:', err.message);
        res.status(500).json({ error: 'bedrock_config_error', message: err.message });
        return;
      }
      throw err;
    }

    const messages = buildMessagesFromConversation(conversationHistory, message);
    console.log(`📡 Calling Anthropic Bedrock verifier model: ${verifierModel.id} (${messages.length} messages in context)`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERIFIER_TIMEOUT_MS);

    try {
      const requestPayload = {
        model: verifierModel.id,
        messages,
        systemInstruction:
          systemPrompt || 'You are an expert legal research assistant specializing in California law.',
        temperature: 0.2,
        maxOutputTokens: Number(process.env.BEDROCK_VERIFIER_MAX_TOKENS || 4096),
        abortSignal: controller.signal,
      };
      assertNoPromptCacheMetadata(requestPayload, 'claude-chat');
      const response = await generateText(requestPayload);

      res.status(200).json({
        text: response.text,
        model: verifierModel.id,
        provider: response.providerMode,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('Anthropic Bedrock verification API error:', err);
    const { message, status } = getErrorDetails(err);
    const lowerMessage = message.toLowerCase();

    let statusCode = status || 500;
    let userMessage = message;

    if (status === 401 || status === 403) {
      userMessage = 'Anthropic Bedrock authentication failed on the server.';
    } else if (status === 429) {
      userMessage = 'Anthropic Bedrock rate limit reached. Please retry in a moment.';
    } else if (lowerMessage.includes('timeout') || lowerMessage.includes('abort')) {
      statusCode = 504;
      userMessage = 'Anthropic Bedrock request timed out. Please try again.';
    }

    if (!status || statusCode < 400 || statusCode >= 600) {
      statusCode = 500;
    }

    res.status(statusCode).json({
      error: 'Internal Server Error',
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    });
  }
}
