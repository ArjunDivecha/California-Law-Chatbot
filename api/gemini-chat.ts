/**
 * Unified generator endpoint backed by Anthropic on AWS Bedrock.
 *
 * POST /api/gemini-chat - Generate content for the main chat flow.
 *
 * The route name is preserved for compatibility with the existing frontend.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildMessagesFromConversation,
  generateText,
  generateTextStream,
  getErrorDetails,
  hasBedrockProviderCredentials,
  isRetryableProviderError,
} from '../utils/anthropicBedrock.ts';

const PRIMARY_MODEL =
  process.env.BEDROCK_PRIMARY_MODEL ||
  process.env.GEMINI_PRIMARY_MODEL ||
  'us.anthropic.claude-sonnet-4-6';
const FALLBACK_MODEL =
  process.env.BEDROCK_FALLBACK_MODEL ||
  process.env.GEMINI_FALLBACK_MODEL ||
  'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const PRIMARY_TIMEOUT_MS = Number(process.env.BEDROCK_PRIMARY_TIMEOUT_MS || 60000);
const FALLBACK_TIMEOUT_MS = Number(process.env.BEDROCK_FALLBACK_TIMEOUT_MS || 45000);

export const config = {
  maxDuration: 60,
};

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

    const { message, systemPrompt, conversationHistory, stream = false } = req.body;

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

    const messages = buildMessagesFromConversation(conversationHistory, message);

    const executeTextRequest = async (model: string, timeoutMs: number) => {
      console.log(`📡 Calling Anthropic Bedrock with model: ${model} (${messages.length} messages in context)`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await generateText({
          model,
          messages,
          systemInstruction:
            systemPrompt || 'You are an expert legal research assistant specializing in California law.',
          temperature: 0.2,
          maxOutputTokens: 8192,
          abortSignal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const executeStreamRequest = async (model: string, timeoutMs: number) => {
      console.log(`📡 Streaming Anthropic Bedrock response with model: ${model} (${messages.length} messages in context)`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await generateTextStream({
          model,
          messages,
          systemInstruction:
            systemPrompt || 'You are an expert legal research assistant specializing in California law.',
          temperature: 0.2,
          maxOutputTokens: 8192,
          abortSignal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    let usedModel = PRIMARY_MODEL;

    if (stream) {
      let streamResponse;

      try {
        streamResponse = await executeStreamRequest(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS);
      } catch (error) {
        const { message: errorMessage } = getErrorDetails(error);
        console.warn(`⚠️ Failed with ${PRIMARY_MODEL}:`, errorMessage);

        if (!isRetryableProviderError(error)) {
          throw error;
        }

        console.log(`🔄 Falling back to ${FALLBACK_MODEL}...`);
        usedModel = FALLBACK_MODEL;
        streamResponse = await executeStreamRequest(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS);
      }

      try {
        for await (const chunk of streamResponse.stream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ type: 'content', text: chunk.text })}\n\n`);
          }
        }

        res.write(
          `data: ${JSON.stringify({
            type: 'metadata',
            hasGrounding: false,
            model: usedModel,
            provider: streamResponse.providerMode,
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (streamError: any) {
        console.error('Streaming error:', streamError);
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            error: streamError?.message || 'Streaming failed',
          })}\n\n`
        );
        res.end();
      }

      return;
    }

    let textResponse;
    try {
      textResponse = await executeTextRequest(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS);
    } catch (error) {
      const { message: errorMessage } = getErrorDetails(error);
      console.warn(`⚠️ Failed with ${PRIMARY_MODEL}:`, errorMessage);

      if (!isRetryableProviderError(error)) {
        throw error;
      }

      console.log(`🔄 Falling back to ${FALLBACK_MODEL}...`);
      usedModel = FALLBACK_MODEL;
      textResponse = await executeTextRequest(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS);
    }

    res.status(200).json({
      text: textResponse.text,
      model: usedModel,
      provider: textResponse.providerMode,
    });
  } catch (err: any) {
    console.error('Anthropic Bedrock chat API error:', err);
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
