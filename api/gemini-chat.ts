/**
 * Unified Gemini API Endpoint via OpenRouter
 * 
 * POST /api/gemini-chat - Generate content with Gemini via OpenRouter
 * 
 * Uses OpenRouter for faster, more reliable access to Gemini models
 * PRIMARY: Gemini 3 Pro (google/gemini-3-pro-preview) - Deeper reasoning
 * FALLBACK: Gemini 2.5 Pro (google/gemini-2.5-pro) - Reliable backup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// OpenRouter model names
const PRIMARY_MODEL = 'google/gemini-3-pro-preview';
const FALLBACK_MODEL = 'google/gemini-2.5-pro';
const PRIMARY_TIMEOUT_MS = 25000;
const FALLBACK_TIMEOUT_MS = 25000;

function normalizeOpenRouterContent(content: any): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && typeof part.content === 'string') return part.content;
        return '';
      })
      .join('');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }

  return '';
}

export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'OPENROUTER_API_KEY environment variable is not configured.' 
      });
      return;
    }

    // Build messages array from conversation history
    const messages: Array<{role: string, content: string}> = [];
    
    // Add conversation history (last 10 messages for context)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role && msg.text) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
          });
        }
      }
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: message.trim()
    });

    const executeRequest = async (model: string, timeoutMs: number = PRIMARY_TIMEOUT_MS) => {
      console.log(`📡 Calling OpenRouter with model: ${model} (${messages.length} messages in context)`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
            'X-Title': 'California Law Chatbot'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: systemPrompt || 'You are an expert legal research assistant specializing in California law.'
              },
              ...messages
            ],
            temperature: 0.2,
            max_tokens: 8192, // High value needed for Gemini Pro models (they use reasoning tokens internally)
            stream: stream
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
        }

        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
    };

    // Set up streaming headers if needed
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    let usedModel = PRIMARY_MODEL;
    let response;

    try {
      response = await executeRequest(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS);
    } catch (error: any) {
      console.warn(`⚠️  Failed with ${PRIMARY_MODEL}:`, error.message);
      
      const errorMessage = String(error.message || error || '').toLowerCase();
      
      // Check for errors that warrant fallback
      const shouldFallback = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('429') ||
        errorMessage.includes('503') ||
        errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('capacity') ||
        errorMessage.includes('rate limit');
      
      if (shouldFallback) {
        console.log(`🔄 Falling back to ${FALLBACK_MODEL}...`);
        try {
          usedModel = FALLBACK_MODEL;
          response = await executeRequest(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS);
          console.log(`✅ Success with fallback model ${FALLBACK_MODEL}`);
        } catch (fallbackError: any) {
          console.error(`❌ Fallback model also failed:`, fallbackError.message);
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (stream) {
      // Handle streaming response
      try {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body for streaming');
        }

        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n');
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = normalizeOpenRouterContent(parsed.choices?.[0]?.delta?.content);
                if (content) {
                  fullText += content;
                  res.write(`data: ${JSON.stringify({ type: 'content', text: content })}\n\n`);
                }
              } catch (e) {
                // Skip unparseable chunks
              }
            }
          }
        }

        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          hasGrounding: false,
          model: usedModel
        })}\n\n`);

        res.write('data: [DONE]\n\n');
        res.end();
        console.log('✅ Streaming completed successfully');

      } catch (streamError: any) {
        console.error('Streaming error:', streamError);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: streamError.message || 'Streaming failed'
        })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming response
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    let text = normalizeOpenRouterContent(data.choices?.[0]?.message?.content);

    // If primary model returns empty, try fallback
    if (!text && usedModel === PRIMARY_MODEL) {
      console.warn(`⚠️ ${PRIMARY_MODEL} returned empty response, trying fallback...`);
      try {
        const fallbackResponse = await executeRequest(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS);
        const fallbackData = await fallbackResponse.json();
        text = normalizeOpenRouterContent(fallbackData.choices?.[0]?.message?.content);
        if (text) {
          usedModel = FALLBACK_MODEL;
          console.log(`✅ Fallback model ${FALLBACK_MODEL} succeeded`);
        }
      } catch (fallbackError: any) {
        console.error('Fallback also failed:', fallbackError.message);
      }
    }

    if (!text) {
      console.error('No text content found in OpenRouter response from either model');
      // Return a user-friendly message instead of 500 error
      text = "I apologize, but I'm having difficulty generating a response right now. This may be due to high demand. Please try again in a moment, or try simplifying your question.";
    }

    console.log(`✅ OpenRouter response received (${text.length} chars) via ${usedModel}`);

    res.status(200).json({
      text: text,
      hasGrounding: false, // OpenRouter doesn't pass through grounding metadata
      model: usedModel
    });

  } catch (err: any) {
    console.error('OpenRouter Gemini API error:', err);
    
    const errorMessage = err?.message || String(err);
    const statusMatch = errorMessage.match(/OpenRouter error (\d{3})/i);
    const upstreamStatus = statusMatch ? Number(statusMatch[1]) : null;

    let statusCode = upstreamStatus || 500;
    let userMessage = errorMessage;

    if (upstreamStatus === 401) {
      userMessage = 'AI provider authentication failed on the server.';
    } else if (upstreamStatus === 403) {
      userMessage = 'AI provider rejected this request (access or policy restriction).';
    } else if (upstreamStatus === 429) {
      userMessage = 'AI provider rate limit reached. Please retry in a moment.';
    } else if (errorMessage.toLowerCase().includes('timeout')) {
      statusCode = 504;
      userMessage = 'AI provider request timed out. Please try again.';
    }

    if (!upstreamStatus && statusCode < 500 && statusCode >= 400) {
      statusCode = 500;
    }

    res.status(statusCode).json({ 
      error: 'Internal Server Error', 
      message: userMessage,
      upstreamStatus,
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}
