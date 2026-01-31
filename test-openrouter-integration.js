/**
 * =============================================================================
 * SCRIPT NAME: test-openrouter-integration.js
 * =============================================================================
 * 
 * Quick test to verify all OpenRouter integrations work:
 * - Gemini 3 Pro (primary)
 * - Gemini 2.5 Pro (fallback)
 * - Claude Sonnet 4.5 (verification)
 * - OpenAI text-embedding-3-small (embeddings)
 * 
 * USAGE: node test-openrouter-integration.js
 * =============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in environment');
  process.exit(1);
}

async function testModel(modelId, modelName, prompt) {
  console.log(`\n🧪 Testing ${modelName} (${modelId})...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
        'X-Title': 'California Law Chatbot Test'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Be brief.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 100
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ FAILED: HTTP ${response.status} - ${errorText.substring(0, 100)}`);
      return false;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log(`   ✅ SUCCESS in ${duration}ms`);
    console.log(`   📄 Response: "${text.substring(0, 80)}..."`);
    return true;
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function testEmbedding() {
  console.log(`\n🧪 Testing OpenAI Embeddings (openai/text-embedding-3-small)...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
        'X-Title': 'California Law Chatbot Test'
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: 'California law research test'
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ FAILED: HTTP ${response.status} - ${errorText.substring(0, 100)}`);
      return false;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    const dimensions = embedding?.length || 0;
    console.log(`   ✅ SUCCESS in ${duration}ms`);
    console.log(`   📊 Embedding dimensions: ${dimensions}`);
    return dimensions === 1536;
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('OPENROUTER INTEGRATION TEST');
  console.log('='.repeat(60));
  console.log(`API Key: ${API_KEY.substring(0, 15)}...`);
  
  const results = {
    gemini3Pro: await testModel('google/gemini-3-pro-preview', 'Gemini 3 Pro', 'Say hello in 5 words'),
    gemini25Pro: await testModel('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'Say hello in 5 words'),
    claudeSonnet: await testModel('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 'Say hello in 5 words'),
    claudeHaiku: await testModel('anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'Say hello in 5 words'),
    embeddings: await testEmbedding()
  };

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const allPassed = Object.values(results).every(r => r);
  
  console.log(`Gemini 3 Pro:      ${results.gemini3Pro ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Gemini 2.5 Pro:    ${results.gemini25Pro ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Claude Sonnet 4.5: ${results.claudeSonnet ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Claude Haiku 4.5:  ${results.claudeHaiku ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Embeddings:        ${results.embeddings ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'));
  console.log('='.repeat(60));
}

runTests().catch(console.error);
