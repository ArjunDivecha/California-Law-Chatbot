/**
 * Test Gemini API Key from .env file
 * 
 * This script loads the .env file and tests the GEMINI_API_KEY
 * by making a direct API call to Google Gemini.
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

// Load environment variables from .env file
config();

const apiKey = process.env.GEMINI_API_KEY;

console.log('🔍 Testing Gemini API Key from .env file\n');
console.log('='.repeat(60));

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  console.log('\n💡 Make sure you have a .env file with:');
  console.log('   GEMINI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Show masked key for verification
const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
console.log(`✅ Found GEMINI_API_KEY: ${maskedKey}`);
console.log(`   Length: ${apiKey.length} characters\n`);

console.log('🧪 Testing API key with Gemini API...\n');

try {
  // Initialize Gemini AI
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
  
  // Check for grounding metadata
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  if (groundingChunks.length > 0) {
    console.log(`\n🔍 Found ${groundingChunks.length} grounding chunks`);
  }
  
  console.log('\n🎉 Gemini API key test completed successfully!');
  console.log('\n💡 This key can be used in Vercel deployment.');
  
} catch (error) {
  console.error('\n❌ FAILED! API key test failed\n');
  console.error('Error details:');
  console.error('─'.repeat(60));
  
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status || 'UNKNOWN';
  
  console.error(`Error Code: ${errorCode}`);
  console.error(`Error Message: ${errorMessage}`);
  
  if (error?.response) {
    console.error('\nFull Error Response:');
    console.error(JSON.stringify(error.response, null, 2));
  }
  
  console.error('─'.repeat(60));
  
  // Provide helpful error messages
  if (errorMessage.includes('API_KEY') || errorMessage.includes('401') || errorMessage.includes('403')) {
    console.error('\n⚠️  API KEY ISSUE:');
    console.error('   - The API key may be invalid or expired');
    console.error('   - Check that the key is correct in your .env file');
    console.error('   - Get a new key from: https://aistudio.google.com/apikey');
  } else if (errorMessage.includes('model') || errorMessage.includes('404')) {
    console.error('\n⚠️  MODEL ISSUE:');
    console.error('   - The model name may be incorrect');
    console.error('   - Check available models in Gemini API documentation');
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    console.error('\n⚠️  NETWORK ISSUE:');
    console.error('   - Check your internet connection');
    console.error('   - Verify you can reach api.google.com');
  }
  
  process.exit(1);
}

