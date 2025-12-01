/**
 * Test Gemini 2.5 Pro (Fallback)
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

config();

const apiKey = process.env.GEMINI_API_KEY;
let cleanKey = apiKey;
if (apiKey && apiKey.startsWith('GEMINI_API_KEY=')) {
  cleanKey = apiKey.replace('GEMINI_API_KEY=', '');
}

console.log('🔍 Testing Fallback Model (Gemini 2.5 Pro)...\n');

async function testGeminiFallback() {
  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    const modelName = 'gemini-2.5-pro';
    console.log(`🤖 Initializing model: ${modelName}`);
    
    const chat = ai.chats.create({
      model: modelName,
      config: { systemInstruction: "You are a helpful AI." }
    });

    console.log('💬 Sending message...');
    const response = await chat.sendMessage({ message: "Hello" });
    console.log('\n✅ SUCCESS!', response.text);
  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
  }
}

testGeminiFallback();

