import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { message, systemPrompt } = req.body;
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Missing or invalid message parameter' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
      return;
    }

    // Initialize Anthropic (server-side only - API key never exposed to client)
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4.5',
      max_tokens: 4096,
      system: systemPrompt || `You are an expert legal research assistant specializing in California law.`,
      messages: [
        {
          role: 'user',
          content: message.trim()
        }
      ]
    });

    // Extract text from Claude's response
    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    res.status(200).json({
      text: text,
    });

  } catch (err: any) {
    console.error('Claude Chat API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err) 
    });
  }
}
