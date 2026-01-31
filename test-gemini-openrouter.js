/**
 * =============================================================================
 * SCRIPT NAME: test-gemini-openrouter.js
 * =============================================================================
 * 
 * Tests all 4 Gemini models via OpenRouter API:
 * 1. Gemini 3 Pro (google/gemini-3-pro-preview)
 * 2. Gemini 3 Flash (google/gemini-3-flash-preview)
 * 3. Gemini 2.5 Pro (google/gemini-2.5-pro)
 * 4. Gemini 2.5 Flash (google/gemini-2.5-flash)
 * 
 * Tests: availability, speed, quality via OpenRouter
 * 
 * USAGE: node test-gemini-openrouter.js
 * =============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in environment');
  process.exit(1);
}

// Models to test (in priority order) - OpenRouter model names
const MODELS = [
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

// Test prompts
const TEST_PROMPTS = [
  {
    name: 'Simple Legal Question',
    prompt: 'What is the statute of limitations for breach of contract in California?',
    expectedKeywords: ['4 years', 'CCP', '337', 'written', 'oral']
  },
  {
    name: 'Complex Legal Research',
    prompt: 'Explain the requirements for a valid prenuptial agreement under California law, including recent case law.',
    expectedKeywords: ['Family Code', '1615', 'disclosure', 'voluntary', 'unconscionable']
  },
  {
    name: 'Recent Legislation',
    prompt: 'What AI-related bills did California pass in 2024 or 2025?',
    expectedKeywords: ['AI', 'bill', 'AB', 'SB']
  }
];

async function testModel(model, prompt, timeout = 60000) {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
        'X-Title': 'California Law Chatbot'
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          {
            role: 'system',
            content: 'You are a California legal research assistant. Be concise but accurate.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1024
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        duration,
        wordCount: 0,
        text: '',
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
      };
    }

    const data = await response.json();
    
    if (data.error) {
      return {
        success: false,
        duration,
        wordCount: 0,
        text: '',
        error: data.error.message || JSON.stringify(data.error)
      };
    }

    const text = data.choices?.[0]?.message?.content || '';
    const wordCount = text.split(/\s+/).length;
    const tokensUsed = data.usage?.total_tokens || 0;
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    return {
      success: true,
      duration,
      wordCount,
      tokensUsed,
      promptTokens,
      completionTokens,
      text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      error: null
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    let errorMsg = error.message || String(error);
    if (error.name === 'AbortError') {
      errorMsg = 'TIMEOUT';
    }
    
    return {
      success: false,
      duration,
      wordCount: 0,
      tokensUsed: 0,
      text: '',
      error: errorMsg
    };
  }
}

async function runFullTest() {
  console.log('='.repeat(80));
  console.log('GEMINI MODEL COMPARISON TEST (via OpenRouter)');
  console.log('='.repeat(80));
  console.log(`API Key: ${API_KEY.substring(0, 15)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`Testing ${MODELS.length} models with ${TEST_PROMPTS.length} prompts each`);
  console.log('='.repeat(80));
  console.log('');

  const results = {};

  for (const model of MODELS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🧪 TESTING: ${model.name} (${model.id})`);
    console.log('─'.repeat(80));

    results[model.id] = {
      name: model.name,
      tests: [],
      totalDuration: 0,
      successCount: 0,
      avgDuration: 0,
      totalTokens: 0,
      available: false
    };

    for (const testCase of TEST_PROMPTS) {
      console.log(`\n  📝 Test: ${testCase.name}`);
      console.log(`     Prompt: "${testCase.prompt.substring(0, 60)}..."`);
      
      const result = await testModel(model, testCase.prompt);
      results[model.id].tests.push({ ...testCase, result });

      if (result.success) {
        results[model.id].successCount++;
        results[model.id].totalDuration += result.duration;
        results[model.id].totalTokens += result.tokensUsed;
        results[model.id].available = true;

        console.log(`     ✅ SUCCESS in ${result.duration}ms`);
        console.log(`     📊 Words: ${result.wordCount} | Tokens: ${result.tokensUsed} (in: ${result.promptTokens}, out: ${result.completionTokens})`);
        console.log(`     📄 Response preview: "${result.text.substring(0, 150)}..."`);
      } else {
        console.log(`     ❌ FAILED: ${result.error}`);
        console.log(`     ⏱️  Duration before failure: ${result.duration}ms`);
      }

      // Small delay between tests to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    // Calculate averages
    if (results[model.id].successCount > 0) {
      results[model.id].avgDuration = Math.round(
        results[model.id].totalDuration / results[model.id].successCount
      );
    }
  }

  // Summary
  console.log('\n');
  console.log('='.repeat(80));
  console.log('📊 SUMMARY RESULTS (OpenRouter)');
  console.log('='.repeat(80));
  console.log('');
  console.log('Model                    | Available | Success | Avg Time  | Avg Tokens');
  console.log('─'.repeat(80));

  const sortedModels = Object.entries(results)
    .sort((a, b) => {
      // Sort by: available first, then by success rate, then by speed
      if (a[1].available !== b[1].available) return b[1].available ? 1 : -1;
      if (a[1].successCount !== b[1].successCount) return b[1].successCount - a[1].successCount;
      return a[1].avgDuration - b[1].avgDuration;
    });

  for (const [modelId, data] of sortedModels) {
    const available = data.available ? '✅ YES' : '❌ NO ';
    const success = `${data.successCount}/${TEST_PROMPTS.length}`;
    const avgTime = data.avgDuration > 0 ? `${data.avgDuration}ms` : 'N/A';
    const avgTokens = data.successCount > 0 ? Math.round(data.totalTokens / data.successCount) : 'N/A';
    
    console.log(
      `${data.name.padEnd(24)} | ${available.padEnd(9)} | ${success.padEnd(7)} | ${String(avgTime).padEnd(9)} | ${avgTokens}`
    );
  }

  // Recommendations
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🎯 RECOMMENDATIONS (OpenRouter)');
  console.log('='.repeat(80));

  const availableModels = sortedModels.filter(([_, data]) => data.available);
  
  if (availableModels.length === 0) {
    console.log('❌ No models are currently available. Check your API key and quotas.');
  } else {
    // Find best primary (most successful, fastest)
    const bestPrimary = availableModels.find(([_, data]) => 
      data.successCount === TEST_PROMPTS.length
    ) || availableModels[0];
    
    // Find best fallback (reliable, may be slower but stable)
    const bestFallback = availableModels.find(([id, data]) => 
      id !== bestPrimary[0] && data.successCount === TEST_PROMPTS.length
    ) || availableModels.find(([id]) => id !== bestPrimary[0]);

    console.log('');
    console.log(`🥇 PRIMARY MODEL: ${bestPrimary[1].name} (${bestPrimary[0]})`);
    console.log(`   - Success rate: ${bestPrimary[1].successCount}/${TEST_PROMPTS.length}`);
    console.log(`   - Average response time: ${bestPrimary[1].avgDuration}ms`);
    console.log(`   - Average tokens per request: ${Math.round(bestPrimary[1].totalTokens / bestPrimary[1].successCount)}`);
    
    if (bestFallback) {
      console.log('');
      console.log(`🥈 FALLBACK MODEL: ${bestFallback[1].name} (${bestFallback[0]})`);
      console.log(`   - Success rate: ${bestFallback[1].successCount}/${TEST_PROMPTS.length}`);
      console.log(`   - Average response time: ${bestFallback[1].avgDuration}ms`);
      if (bestFallback[1].successCount > 0) {
        console.log(`   - Average tokens per request: ${Math.round(bestFallback[1].totalTokens / bestFallback[1].successCount)}`);
      }
    }

    console.log('');
    console.log('📝 SUGGESTED OPENROUTER CONFIGURATION:');
    console.log(`   PRIMARY_MODEL = '${bestPrimary[0]}'`);
    if (bestFallback) {
      console.log(`   FALLBACK_MODEL = '${bestFallback[0]}'`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// Run the test
runFullTest().catch(console.error);
