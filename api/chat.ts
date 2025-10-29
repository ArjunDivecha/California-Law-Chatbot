import { GoogleGenAI, Chat } from "@google/genai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Missing or invalid message parameter' });
      return;
    }

    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing API_KEY or GEMINI_API_KEY' });
      return;
    }

    // Initialize Gemini AI (server-side only - API key never exposed to client)
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are an expert legal research assistant specializing in California law. I have access to CourtListener database for specific case law searches. For general legal questions, I use web search capabilities. I provide accurate, well-researched answers with proper citations.",
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
    console.error('Chat API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err) 
    });
  }
}
