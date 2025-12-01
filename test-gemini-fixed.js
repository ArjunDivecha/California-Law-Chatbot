/**
 * Test Gemini API Key - Fixed version
 * Extracts the actual key if it includes the variable name
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

config();

let apiKey = process.env.GEMINI_API_KEY;

console.log('🔍 Testing Gemini API Key (Fixed)\n');
console.log('='.repeat(60));

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

// Fix: Remove variable name if it's included in the value
if (apiKey.startsWith('GEMINI_API_KEY=')) {
  console.log('⚠️  Found variable name prefix in key value');
  console.log('   Extracting actual key...');
  apiKey = apiKey.replace('GEMINI_API_KEY=', '');
}

const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
console.log(`✅ Using key: ${maskedKey}`);
console.log(`   Length: ${apiKey.length} characters`);
console.log(`   Starts with: ${apiKey.substring(0, 5)}`);

if (!apiKey.startsWith('AIza')) {
  console.warn('\n⚠️  WARNING: Gemini API keys typically start with "AIza"');
  console.warn('   Your key starts with:', apiKey.substring(0, 10));
}

console.log('\n🧪 Testing API key with Gemini API...\n');

try {
  const ai = new GoogleGenAI({ apiKey });
  
  console.log('📡 Creating chat instance...');
  const chat = ai.chats.create({
    model: 'gemini-2.5-pro',
    config: {
      systemInstruction: "You are a helpful assistant. Respond briefly.",
    }
  });

  console.log('💬 Sending test message...');
  const response = await chat.sendMessage({ 
    message: "Say 'Hello, API key is working!' if you can read this." 
  });

  const responseText = response.text || '';
  
  console.log('\n✅ SUCCESS! API key is valid and working!\n');
  console.log('📝 Response from Gemini:');
  console.log('─'.repeat(60));
  console.log(responseText);
  console.log('─'.repeat(60));
  
  console.log('\n🎉 Gemini API key test completed successfully!');
  console.log('\n💡 IMPORTANT: Fix your .env file!');
  console.log('   Your .env file should have:');
  console.log(`   GEMINI_API_KEY=${apiKey}`);
  console.log('   NOT:');
  console.log(`   GEMINI_API_KEY=GEMINI_API_KEY=${apiKey}`);
  
} catch (error) {
  console.error('\n❌ FAILED! API key test failed\n');
  
  const errorMessage = error?.message || String(error);
  console.error('Error:', errorMessage);
  
  if (errorMessage.includes('API_KEY') || errorMessage.includes('401') || errorMessage.includes('403')) {
    console.error('\n⚠️  The API key is still invalid.');
    console.error('   Please check:');
    console.error('   1. Get a fresh key from: https://aistudio.google.com/apikey');
    console.error('   2. Make sure your .env file has: GEMINI_API_KEY=your_key_here');
    console.error('   3. Do NOT include quotes or the variable name in the value');
  }
  
  process.exit(1);
}

