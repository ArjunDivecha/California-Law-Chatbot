import { GoogleGenAI } from '@google/genai';

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

    const { message, systemPrompt } = req.body;
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Missing or invalid message parameter' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'GEMINI_API_KEY environment variable is not configured. Please set it in Vercel environment variables.' 
      });
      return;
    }

    console.log('Initializing Google GenAI client for generation...');
    const ai = new GoogleGenAI({ apiKey });

    console.log('Calling Gemini API with model: gemini-2.5-flash');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt || `You are an expert legal research assistant specializing in California law.` },
            { text: message.trim() }
          ]
        }
      ]
    });

    const text = response.text;

    console.log('Gemini generator API response received successfully');

    if (!text) {
      console.error('No text content found in Gemini response');
      res.status(500).json({
        error: 'No text content in response',
        message: 'Gemini returned no text output'
      });
      return;
    }

    res.status(200).json({
      text: text,
    });

  } catch (err: any) {
    console.error('Gemini Generate API error:', err);
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
      userMessage = 'Authentication error. Please check GEMINI_API_KEY in Vercel environment variables.';
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

