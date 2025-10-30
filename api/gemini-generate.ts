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

    const { message, systemPrompt, conversationHistory } = req.body;
    
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

    // Build conversation contents from history
    const contents: any[] = [];
    
    // Add system instruction as first user message
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will act as an expert legal research assistant specializing in California law.' }]
      });
    }
    
    // Add conversation history (last 10 messages for context)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role && msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        }
      }
    }
    
    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    console.log(`Calling Gemini API with model: gemini-2.5-flash (${contents.length} messages in context)`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      tools: [{
        googleSearchRetrieval: {
          // Enable Google Search grounding for real-time, up-to-date information
          // This allows Gemini to search Google for recent California law updates
        }
      }]
    });

    const text = response.text;

    console.log('Gemini generator API response received successfully');

    // Extract grounding metadata if available
    const groundingMetadata = response.groundingMetadata;
    const hasGroundingData = !!groundingMetadata;
    
    if (hasGroundingData) {
      console.log(`✅ Google Search grounding was used - ${groundingMetadata?.searchEntryPoint?.renderedContent ? 'results found' : 'no results'}`);
    }

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
      groundingMetadata: groundingMetadata, // Return grounding data to client
      hasGrounding: hasGroundingData
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

