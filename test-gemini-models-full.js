/**
 * =============================================================================
 * SCRIPT NAME: test-gemini-models-full.js
 * =============================================================================
 * 
 * Tests all 4 Gemini models to determine best configuration:
 * 1. Gemini 3 Pro (gemini-3-pro-preview)
 * 2. Gemini 3 Flash (gemini-3-flash)
 * 3. Gemini 2.5 Pro (gemini-2.5-pro)
 * 4. Gemini 2.5 Flash (gemini-2.5-flash)
 * 
 * Tests: availability, speed, quality, and Google Search grounding
 * 
 * USAGE: node test-gemini-models-full.js
 * =============================================================================
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

// Models to test (in priority order)
const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
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
    name: 'Recent Legislation (Tests Google Search)',
    prompt: 'What AI-related bills did California pass in 2024 or 2025?',
    expectedKeywords: ['AI', 'bill', 'AB', 'SB']
  }
];

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testModel(model, prompt, timeout = 30000) {
  const startTime = Date.now();
  
  try {
    const config = {
      model: model.id,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024
        }
      },
      systemInstruction: {
        role: 'system',
        parts: [{ text: 'You are a California legal research assistant. Be concise but accurate.' }]
      }
    };

    // Wrap with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    });

    const response = await Promise.race([
      ai.models.generateContent(config),
      timeoutPromise
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const hasGrounding = !!groundingMetadata;
    const wordCount = text.split(/\s+/).length;

    return {
      success: true,
      duration,
      wordCount,
      hasGrounding,
      groundingQueries: groundingMetadata?.webSearchQueries || [],
      text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      error: null
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      success: false,
      duration,
      wordCount: 0,
      hasGrounding: false,
      groundingQueries: [],
      text: '',
      error: error.message || String(error)
    };
  }
}

async function runFullTest() {
  console.log('='.repeat(80));
  console.log('GEMINI MODEL COMPARISON TEST');
  console.log('='.repeat(80));
  console.log(`API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
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
      groundingCount: 0,
      avgDuration: 0,
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
        results[model.id].available = true;
        
        if (result.hasGrounding) {
          results[model.id].groundingCount++;
        }

        console.log(`     ✅ SUCCESS in ${result.duration}ms`);
        console.log(`     📊 Words: ${result.wordCount} | Grounding: ${result.hasGrounding ? 'YES' : 'NO'}`);
        if (result.groundingQueries.length > 0) {
          console.log(`     🔍 Search queries: ${result.groundingQueries.join(', ')}`);
        }
        console.log(`     📄 Response preview: "${result.text.substring(0, 150)}..."`);
      } else {
        console.log(`     ❌ FAILED: ${result.error}`);
        console.log(`     ⏱️  Duration before failure: ${result.duration}ms`);
      }

      // Small delay between tests to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
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
  console.log('📊 SUMMARY RESULTS');
  console.log('='.repeat(80));
  console.log('');
  console.log('Model                    | Available | Success | Avg Time | Grounding');
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
    const grounding = `${data.groundingCount}/${TEST_PROMPTS.length}`;
    
    console.log(
      `${data.name.padEnd(24)} | ${available.padEnd(9)} | ${success.padEnd(7)} | ${avgTime.padEnd(8)} | ${grounding}`
    );
  }

  // Recommendations
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🎯 RECOMMENDATIONS');
  console.log('='.repeat(80));

  const availableModels = sortedModels.filter(([_, data]) => data.available);
  
  if (availableModels.length === 0) {
    console.log('❌ No models are currently available. Check your API key and quotas.');
  } else {
    // Find best primary (most successful + has grounding)
    const bestPrimary = availableModels.find(([_, data]) => 
      data.successCount === TEST_PROMPTS.length && data.groundingCount > 0
    ) || availableModels[0];
    
    // Find best fallback (reliable, may be slower but stable)
    const bestFallback = availableModels.find(([id, data]) => 
      id !== bestPrimary[0] && data.successCount === TEST_PROMPTS.length
    ) || availableModels.find(([id]) => id !== bestPrimary[0]);

    console.log('');
    console.log(`🥇 PRIMARY MODEL: ${bestPrimary[1].name} (${bestPrimary[0]})`);
    console.log(`   - Success rate: ${bestPrimary[1].successCount}/${TEST_PROMPTS.length}`);
    console.log(`   - Average response time: ${bestPrimary[1].avgDuration}ms`);
    console.log(`   - Google Search grounding: ${bestPrimary[1].groundingCount}/${TEST_PROMPTS.length}`);
    
    if (bestFallback) {
      console.log('');
      console.log(`🥈 FALLBACK MODEL: ${bestFallback[1].name} (${bestFallback[0]})`);
      console.log(`   - Success rate: ${bestFallback[1].successCount}/${TEST_PROMPTS.length}`);
      console.log(`   - Average response time: ${bestFallback[1].avgDuration}ms`);
      console.log(`   - Google Search grounding: ${bestFallback[1].groundingCount}/${TEST_PROMPTS.length}`);
    }

    console.log('');
    console.log('📝 SUGGESTED CONFIGURATION:');
    console.log(`   PRIMARY_MODEL = '${bestPrimary[0]}'`);
    if (bestFallback) {
      console.log(`   FALLBACK_MODEL = '${bestFallback[0]}'`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// Run the test
runFullTest().catch(console.error);
