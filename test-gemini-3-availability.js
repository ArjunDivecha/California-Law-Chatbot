/**
 * Test Gemini 3 Pro Availability
 * 
 * Tests if Gemini 3 Pro is currently available and working.
 * Also tests fallback model for comparison.
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

const PRIMARY_MODEL = 'gemini-3-pro-preview';
const FALLBACK_MODEL = 'gemini-2.5-pro';

console.log('🧪 Testing Gemini Model Availability\n');
console.log('='.repeat(60));
console.log(`Primary Model: ${PRIMARY_MODEL}`);
console.log(`Fallback Model: ${FALLBACK_MODEL}`);
console.log('='.repeat(60));
console.log('');

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName, testMessage = "Say 'Hello, I am working!' if you can read this.") {
  console.log(`\n📡 Testing ${modelName}...`);
  const startTime = Date.now();
  
  try {
    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: "You are a helpful assistant. Respond briefly.",
      }
    });
    
    const response = await chat.sendMessage({ message: testMessage });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const responseText = response.text || '';
    
    console.log(`✅ SUCCESS - ${modelName}`);
    console.log(`   Response time: ${duration}s`);
    console.log(`   Response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
    
    return {
      success: true,
      model: modelName,
      duration: duration,
      response: responseText
    };
    
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const errorMessage = String(error.message || error || '').toLowerCase();
    const errorStatus = error.status || error.code || error.statusCode;
    
    console.log(`❌ FAILED - ${modelName}`);
    console.log(`   Response time: ${duration}s`);
    console.log(`   Status Code: ${errorStatus || 'N/A'}`);
    console.log(`   Error: ${error.message || String(error)}`);
    
    // Determine error type
    let errorType = 'unknown';
    if (errorStatus === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      errorType = 'capacity/quota';
    } else if (errorStatus === 500 || errorMessage.includes('500') || errorMessage.includes('internal')) {
      errorType = 'server error';
    } else if (errorStatus === 503 || errorMessage.includes('503') || errorMessage.includes('unavailable')) {
      errorType = 'service unavailable';
    } else if (errorStatus === 404 || errorMessage.includes('404') || errorMessage.includes('not found')) {
      errorType = 'model not found';
    }
    
    console.log(`   Error Type: ${errorType}`);
    
    return {
      success: false,
      model: modelName,
      duration: duration,
      error: error.message || String(error),
      errorType: errorType,
      statusCode: errorStatus
    };
  }
}

async function runTests() {
  console.log(`⏰ Test started at: ${new Date().toISOString()}\n`);
  
  // Test Primary Model (Gemini 3 Pro)
  const primaryResult = await testModel(PRIMARY_MODEL);
  
  // Wait a moment between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test Fallback Model (Gemini 2.5 Pro)
  const fallbackResult = await testModel(FALLBACK_MODEL);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n${PRIMARY_MODEL}:`);
  if (primaryResult.success) {
    console.log(`  ✅ Available and working`);
    console.log(`  ⏱️  Response time: ${primaryResult.duration}s`);
  } else {
    console.log(`  ❌ Not available or failed`);
    console.log(`  🔴 Error Type: ${primaryResult.errorType}`);
    console.log(`  ⏱️  Failed after: ${primaryResult.duration}s`);
  }
  
  console.log(`\n${FALLBACK_MODEL}:`);
  if (fallbackResult.success) {
    console.log(`  ✅ Available and working`);
    console.log(`  ⏱️  Response time: ${fallbackResult.duration}s`);
  } else {
    console.log(`  ❌ Not available or failed`);
    console.log(`  🔴 Error Type: ${fallbackResult.errorType}`);
    console.log(`  ⏱️  Failed after: ${fallbackResult.duration}s`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMENDATION');
  console.log('='.repeat(60));
  
  if (!primaryResult.success && fallbackResult.success) {
    console.log('\n⚠️  Gemini 3 Pro is currently unavailable.');
    console.log('✅ Fallback to Gemini 2.5 Pro is working correctly.');
    console.log('💡 Your application will automatically use the fallback.');
    console.log('🔄 Consider testing again later to see if Gemini 3 Pro becomes available.');
  } else if (primaryResult.success && fallbackResult.success) {
    console.log('\n✅ Both models are working!');
    console.log('💡 Your application will use Gemini 3 Pro by default.');
    console.log('🔄 Fallback is ready if needed.');
  } else if (primaryResult.success && !fallbackResult.success) {
    console.log('\n✅ Gemini 3 Pro is working!');
    console.log('⚠️  Fallback model failed (unusual - check API key permissions).');
  } else {
    console.log('\n❌ Both models failed.');
    console.log('🔍 Check your API key and network connection.');
  }
  
  console.log(`\n⏰ Test completed at: ${new Date().toISOString()}`);
}

runTests().catch(console.error);

