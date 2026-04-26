/**
 * Claude Chat API Endpoint via OpenRouter
 * 
 * POST /api/claude-chat - Generate content with Claude via OpenRouter
 * 
 * Uses OpenRouter for unified API access to Anthropic Claude models
 * MODEL: Claude Sonnet 4.6 (anthropic/claude-sonnet-4-6)
 */

const CLAUDE_TIMEOUT_MS = 25000;

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

export default async function handler(req: any, res: any) {
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

    const { message, systemPrompt, conversationHistory } = req.body;
    
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

    console.log(`📡 Calling OpenRouter Claude API with model: anthropic/claude-sonnet-4-6 (${messages.length} messages in context)`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

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
          model: 'anthropic/claude-sonnet-4-6',
          messages: [
            {
              role: 'system',
              content: systemPrompt || 'You are an expert legal research assistant specializing in California law.'
            },
            ...messages
          ],
          temperature: 0.2,
          max_tokens: 8192
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      const text = normalizeOpenRouterContent(data.choices?.[0]?.message?.content);

      if (!text) {
        console.error('No text content found in OpenRouter Claude response');
        res.status(500).json({
          error: 'No text content in response',
          message: 'Claude returned no text output'
        });
        return;
      }

      console.log(`✅ OpenRouter Claude response received (${text.length} chars)`);

      res.status(200).json({
        text: text
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${CLAUDE_TIMEOUT_MS}ms`);
      }
      throw fetchError;
    }

  } catch (err: any) {
    console.error('OpenRouter Claude API error:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      status: err?.status,
      code: err?.code
    });
    
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
