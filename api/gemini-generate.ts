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

    const { message, systemPrompt, conversationHistory, stream = false } = req.body;
    
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
    
    // Add conversation history (last 10 messages for context)
    // Note: systemPrompt goes in config.systemInstruction, not in contents
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

    console.log(`Calling Gemini API with model: gemini-2.5-pro (${contents.length} messages in context)`);
    console.log('🔍 Enabling Google Search grounding for real-time California law updates...');

    const config = {
      model: 'gemini-2.5-pro',
      contents: contents,
      config: {
        tools: [{googleSearch: {}}],
        generationConfig: {
          temperature: 0.2, // Keep low for legal accuracy
        }
      },
      // systemInstruction goes at top level, NOT in config
      systemInstruction: systemPrompt ? {
        role: 'system',
        parts: [{
          text: systemPrompt
        }]
      } : undefined
    };

    // Handle streaming mode
    if (stream) {
      console.log('📡 Using streaming mode for real-time response...');

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const streamResponse = await ai.models.generateContentStream(config);

        let fullText = '';
        let groundingMetadata: any = null;

        // Stream each chunk to the client
        // streamResponse is the async iterable directly, not an object with .stream property
        for await (const chunk of streamResponse) {
          const chunkText = chunk.text || '';
          fullText += chunkText;

          // Send chunk as SSE (Server-Sent Event)
          if (chunkText) {
            res.write(`data: ${JSON.stringify({ type: 'content', text: chunkText })}\n\n`);
          }

          // Capture grounding metadata if present
          if (chunk.candidates?.[0]?.groundingMetadata) {
            groundingMetadata = chunk.candidates[0].groundingMetadata;
          }
        }

        // Log grounding metadata
        if (groundingMetadata) {
          const webSearchQueries = groundingMetadata.webSearchQueries || [];
          const groundingChunks = groundingMetadata.groundingChunks || [];
          console.log(`✅ Google Search grounding was used!`);
          console.log(`   - Search queries: ${webSearchQueries.join(', ')}`);
          console.log(`   - ${groundingChunks.length} source URLs found`);
        }

        // Send metadata at the end
        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          groundingMetadata,
          hasGrounding: !!groundingMetadata
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

      return; // Exit after streaming
    }

    // Non-streaming mode (original behavior)
    const response = await ai.models.generateContent(config);

    const text = response.text;

    console.log('Gemini generator API response received successfully');

    // Extract grounding metadata from response.candidates[0].groundingMetadata
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const hasGroundingData = !!groundingMetadata;

    if (hasGroundingData) {
      const webSearchQueries = groundingMetadata.webSearchQueries || [];
      const groundingChunks = groundingMetadata.groundingChunks || [];
      console.log(`✅ Google Search grounding was used!`);
      console.log(`   - Search queries: ${webSearchQueries.join(', ')}`);
      console.log(`   - ${groundingChunks.length} source URLs found`);

      // Log the source URLs
      groundingChunks.forEach((chunk: any, idx: number) => {
        const uri = chunk?.web?.uri;
        if (uri) {
          console.log(`   - [${idx+1}] ${uri}`);
        }
      });
    } else {
      console.log('ℹ️ No grounding metadata found - Google Search was not used for this query');
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

