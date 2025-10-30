import { GoogleGenAI } from "@google/genai";

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
    const chat = ai.chats.create({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction: systemPrompt || "You are an expert legal research assistant specializing in California law.",
      }
    });

    // Send message to Gemini
    const response = await chat.sendMessage({ message: message.trim() });

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
    });

  } catch (err: any) {
    console.error('Gemini Chat API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err) 
    });
  }
}
