import { GoogleGenAI } from '@google/genai';

/**
 * Gemini Model Configuration
 * 
 * PRIMARY_MODEL: Gemini 3 Pro Preview - Latest model with advanced capabilities
 * FALLBACK_MODEL: Gemini 2.5 Pro - Reliable fallback for capacity issues
 * 
 * The system automatically falls back to Gemini 2.5 Pro if:
 * - Capacity errors (429, 503, quota exceeded)
 * - Model not found (404)
 * - Temporary server errors (500, 502)
 */
const PRIMARY_MODEL = 'gemini-3-pro-preview';
const FALLBACK_MODEL = 'gemini-2.5-pro';

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

    const createConfig = (model: string) => ({
      model: model,
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
    });

    const executeRequest = async (model: string, timeoutMs: number = 30000) => {
      console.log(`Calling Gemini API with model: ${model} (${contents.length} messages in context)`);
      const config = createConfig(model);
      
      // Wrap API call with timeout to fail fast
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      const apiCall = async () => {
        if (stream) {
          console.log('📡 Using streaming mode for real-time response...');
          return await ai.models.generateContentStream(config);
        } else {
          return await ai.models.generateContent(config);
        }
      };
      
      // Race between API call and timeout
      return Promise.race([apiCall(), timeoutPromise]) as Promise<any>;
    };

    // Handling headers for streaming is tricky with retry logic if we fail mid-stream.
    // But usually connection errors happen at start.
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    let usedModel = PRIMARY_MODEL;
    let response;

    try {
      // Use shorter timeout for primary model (15 seconds) to fail fast
      response = await executeRequest(PRIMARY_MODEL, 15000);
    } catch (error: any) {
      console.warn(`⚠️  Failed with ${PRIMARY_MODEL}:`, error.message);
      
      // Check if we should fallback
      const errorMessage = String(error.message || error || '').toLowerCase();
      const errorStatus = error.status || error.code || error.statusCode;
      
      // Check for capacity-related errors
      const isCapacityError = 
        errorStatus === 429 || 
        errorStatus === 503 || 
        errorMessage.includes('429') || 
        errorMessage.includes('503') || 
        errorMessage.includes('overloaded') || 
        errorMessage.includes('capacity') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('service unavailable');
      
      // Check for model not found errors
      const isModelError = 
        errorStatus === 404 || 
        errorMessage.includes('404') || 
        errorMessage.includes('not found') ||
        errorMessage.includes('invalid model') ||
        errorMessage.includes('model does not exist');
      
      // Check for temporary server errors that might indicate capacity issues
      const isTemporaryError = 
        errorStatus === 500 || 
        errorStatus === 502 ||
        errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('internal server error') ||
        errorMessage.includes('bad gateway');
      
      if (isCapacityError || isModelError || isTemporaryError || errorMessage.includes('timeout')) {
        const errorType = errorMessage.includes('timeout') ? 'timeout' : isCapacityError ? 'capacity' : isModelError ? 'model' : 'temporary';
        console.log(`🔄 Falling back to ${FALLBACK_MODEL} due to ${errorType} error...`);
        try {
          usedModel = FALLBACK_MODEL;
          // Use longer timeout for fallback (30 seconds) since it's more reliable
          response = await executeRequest(FALLBACK_MODEL, 30000);
          console.log(`✅ Success with fallback model ${FALLBACK_MODEL}`);
        } catch (fallbackError: any) {
          console.error(`❌ Fallback model also failed:`, fallbackError.message);
          throw error; // Throw original error, not fallback error
        }
      } else {
        // Don't fallback on auth errors, invalid requests, etc.
        throw error;
      }
    }

    if (stream) {
      try {
        // streamResponse is the async iterable
        const streamResponse = response; 
        
        let fullText = '';
        let groundingMetadata: any = null;

        // Stream each chunk to the client
        for await (const chunk of streamResponse) {
          const chunkText = chunk.text || '';
          fullText += chunkText;

          if (chunkText) {
            res.write(`data: ${JSON.stringify({ type: 'content', text: chunkText })}\n\n`);
          }

          if (chunk.candidates?.[0]?.groundingMetadata) {
            groundingMetadata = chunk.candidates[0].groundingMetadata;
          }
        }

        if (groundingMetadata) {
          const webSearchQueries = groundingMetadata.webSearchQueries || [];
          const groundingChunks = groundingMetadata.groundingChunks || [];
          console.log(`✅ Google Search grounding was used!`);
          console.log(`   - Search queries: ${webSearchQueries.join(', ')}`);
          console.log(`   - ${groundingChunks.length} source URLs found`);
        }

        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          groundingMetadata,
          hasGrounding: !!groundingMetadata,
          model: usedModel // Send used model info
        })}\n\n`);

        res.write('data: [DONE]\n\n');
        res.end();
        console.log('✅ Streaming completed successfully');

      } catch (streamError: any) {
        console.error('Streaming error:', streamError);
        // If headers are already sent, we can only send data event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: streamError.message || 'Streaming failed'
        })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming response handling
    const text = response.text;
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const hasGroundingData = !!groundingMetadata;

    if (hasGroundingData) {
      const webSearchQueries = groundingMetadata.webSearchQueries || [];
      const groundingChunks = groundingMetadata.groundingChunks || [];
      console.log(`✅ Google Search grounding was used!`);
      console.log(`   - Search queries: ${webSearchQueries.join(', ')}`);
      console.log(`   - ${groundingChunks.length} source URLs found`);
      groundingChunks.forEach((chunk: any, idx: number) => {
        const uri = chunk?.web?.uri;
        if (uri) console.log(`   - [${idx+1}] ${uri}`);
      });
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
      groundingMetadata: groundingMetadata,
      hasGrounding: hasGroundingData,
      model: usedModel
    });

  } catch (err: any) {
    console.error('Gemini Generate API error:', err);
    
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
