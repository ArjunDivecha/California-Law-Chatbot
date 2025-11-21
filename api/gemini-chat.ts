import { GoogleGenAI } from "@google/genai";

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
      res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
      return;
    }

    // Initialize Gemini AI (server-side only - API key never exposed to client)
    const ai = new GoogleGenAI({ apiKey });

    const generateWithModel = async (modelName: string) => {
      console.log(`🤖 Initializing chat with model: ${modelName}`);
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: systemPrompt || "You are an expert legal research assistant specializing in California law.",
        }
      });
      
      console.log(`📤 Sending message to ${modelName}...`);
      return await chat.sendMessage({ message: message.trim() });
    };

    let response;
    let usedModel = PRIMARY_MODEL;

    try {
      // Try primary model
      response = await generateWithModel(PRIMARY_MODEL);
      console.log(`✅ Success with ${PRIMARY_MODEL}`);
    } catch (error: any) {
      console.warn(`⚠️  Failed with ${PRIMARY_MODEL}:`, error.message);
      
      // Check if we should fallback
      // Fallback on: 429 (Too Many Requests), 503 (Service Unavailable), 500 (Internal Error), or 404 (Model not found)
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
      
      if (isCapacityError || isModelError || isTemporaryError) {
        console.log(`🔄 Falling back to ${FALLBACK_MODEL} due to ${isCapacityError ? 'capacity' : isModelError ? 'model' : 'temporary'} error...`);
        try {
          usedModel = FALLBACK_MODEL;
          response = await generateWithModel(FALLBACK_MODEL);
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

    // Extract response text
    const responseText = response.text || '';

    // Extract grounding sources if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => {
        if (chunk.web) {
          return { title: chunk.web.title || 'Untitled Source', url: chunk.web.uri };
        }
        return null;
      })
      .filter((source): source is { title: string; url: string } => source !== null);

    res.status(200).json({
      text: responseText,
      sources: sources,
      model: usedModel // Return which model was used for debugging/UI
    });

  } catch (err: any) {
    console.error('Gemini Chat API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err) 
    });
  }
}
