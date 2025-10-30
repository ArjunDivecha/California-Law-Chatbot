import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'ANTHROPIC_API_KEY environment variable is not configured. Please set it in Vercel environment variables.' 
      });
      return;
    }

    console.log('Initializing Anthropic client...');
    // Initialize Anthropic (server-side only - API key never exposed to client)
    const anthropic = new Anthropic({ apiKey });

    // Build conversation messages from history
    const messages: any[] = [];
    
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

    console.log(`Calling Claude API with model: claude-haiku-4-5-20251001 (${messages.length} messages in context)`);
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt || `You are an expert legal research assistant specializing in California law.`,
      messages: messages
    });

      console.log('Claude API response received successfully');
      
      // Claude Sonnet 4.5 returns content blocks with types: 'thinking' and 'text'
      // We only want the 'text' blocks for the actual response
      const textBlocks = response.content.filter((block: any) => block.type === 'text');
      const thinkingBlocks = response.content.filter((block: any) => block.type === 'thinking');
      
      console.log(`Response contains ${textBlocks.length} text blocks and ${thinkingBlocks.length} thinking blocks`);
      
      // Extract only the text content (not the thinking)
      const text = textBlocks
        .map((block: any) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        console.error('No text content found in Claude response');
        res.status(500).json({
          error: 'No text content in response',
          message: 'Claude returned thinking blocks but no text output'
        });
        return;
      }

      res.status(200).json({
        text: text,
      });

  } catch (err: any) {
    console.error('Claude Chat API error:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      status: err?.status,
      code: err?.code
    });
    
    // Provide more detailed error information
    const errorMessage = err?.message || String(err);
    const isAuthError = errorMessage.includes('api_key') || errorMessage.includes('401') || errorMessage.includes('403');
    const isModelError = errorMessage.includes('model') || errorMessage.includes('404');
    
    let userMessage = errorMessage;
    if (isAuthError) {
      userMessage = 'Authentication error. Please check ANTHROPIC_API_KEY in Vercel environment variables.';
    } else if (isModelError) {
      userMessage = 'Model error. Please verify the model name is correct.';
    }
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}
