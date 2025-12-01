/**
 * Test Gemini 3 Pro Preview
 * 
 * Verifies that the model 'gemini-3-pro-preview' works with the provided API key
 * by generating a simple response.
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

config();

const apiKey = process.env.GEMINI_API_KEY;
let cleanKey = apiKey;
if (apiKey && apiKey.startsWith('GEMINI_API_KEY=')) {
  cleanKey = apiKey.replace('GEMINI_API_KEY=', '');
}

if (!cleanKey) {
  console.error('❌ GEMINI_API_KEY not found');
  process.exit(1);
}

console.log('🔍 Testing Gemini 3 Pro Preview...\n');
console.log(`Using Key: ${cleanKey.substring(0, 10)}...`);

async function testGemini3() {
  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    
    const modelName = 'gemini-3-pro-preview';
    console.log(`🤖 Initializing model: ${modelName}`);
    
    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: "You are a helpful AI.",
      }
    });

    console.log('💬 Sending message...');
    const response = await chat.sendMessage({ 
      message: "Hello from the future! Are you Gemini 3?" 
    });

    console.log('\n✅ SUCCESS!');
    console.log('Response:', response.text);
    
  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('⚠️  Model might not be accessible yet or name is wrong.');
    }
    if (error.message.includes('429') || error.message.includes('503')) {
      console.log('⚠️  Capacity/Availability issue.');
    }
  }
}

testGemini3();

