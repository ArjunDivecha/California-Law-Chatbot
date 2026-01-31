/**
 * =============================================================================
 * SCRIPT NAME: test-comprehensive.js
 * =============================================================================
 * 
 * Comprehensive end-to-end test of the California Law Chatbot
 * Tests all major features via OpenRouter:
 * 
 * 1. Research Mode (Gemini 3 Pro via OpenRouter)
 * 2. CEB Vector Search (OpenAI embeddings via OpenRouter)
 * 3. Claude Verification (Claude Sonnet 4.5 via OpenRouter)
 * 4. Full hybrid query flow
 * 
 * USAGE: node test-comprehensive.js
 * =============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const UPSTASH_URL = process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

console.log('='.repeat(70));
console.log('COMPREHENSIVE CALIFORNIA LAW CHATBOT TEST');
console.log('='.repeat(70));
console.log('');
console.log('Environment Check:');
console.log(`  OPENROUTER_API_KEY: ${OPENROUTER_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`  UPSTASH_VECTOR_REST_URL: ${UPSTASH_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`  UPSTASH_VECTOR_REST_TOKEN: ${UPSTASH_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log('');

if (!OPENROUTER_KEY) {
  console.error('❌ OPENROUTER_API_KEY is required');
  process.exit(1);
}

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

async function runTest(name, testFn) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 TEST: ${name}`);
  console.log('─'.repeat(70));
  
  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`\n   ✅ PASSED in ${duration}ms`);
      if (result.details) console.log(`   📊 ${result.details}`);
      results.passed++;
      results.tests.push({ name, status: 'passed', duration, details: result.details });
    } else {
      console.log(`\n   ❌ FAILED: ${result.error}`);
      results.failed++;
      results.tests.push({ name, status: 'failed', duration, error: result.error });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n   ❌ ERROR: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'error', duration, error: error.message });
  }
}

// =============================================================================
// TEST 1: Gemini 3 Pro - Simple Legal Question
// =============================================================================
async function testGemini3ProSimple() {
  console.log('   Sending simple legal question to Gemini 3 Pro...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'system', content: 'You are a California legal research assistant. Be concise.' },
        { role: 'user', content: 'What is the statute of limitations for breach of written contract in California? Answer in 2 sentences.' }
      ],
      temperature: 0.2,
      max_tokens: 4000 // Pro models need high max_tokens for reasoning
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  // Check for key terms
  const hasRelevantContent = text.toLowerCase().includes('4 year') || 
                             text.toLowerCase().includes('four year') ||
                             text.toLowerCase().includes('337');
  
  console.log(`   Response: "${text.substring(0, 150)}..."`);
  
  return { 
    success: hasRelevantContent, 
    details: `${text.split(' ').length} words, mentions statute of limitations`,
    error: hasRelevantContent ? null : 'Response missing key legal information'
  };
}

// =============================================================================
// TEST 2: Gemini 3 Pro - Complex Legal Research
// =============================================================================
async function testGemini3ProComplex() {
  console.log('   Sending complex legal research question...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'system', content: 'You are a California legal research assistant specializing in estate planning.' },
        { role: 'user', content: 'What are the requirements for a valid holographic will in California? Include the relevant Probate Code section.' }
      ],
      temperature: 0.2,
      max_tokens: 4000 // Pro models need high max_tokens for reasoning
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  // Check for key terms
  const mentionsHandwritten = text.toLowerCase().includes('handwrit') || text.toLowerCase().includes('hand-writ');
  const mentionsProbateCode = text.toLowerCase().includes('probate code') || text.toLowerCase().includes('6111');
  
  console.log(`   Response: "${text.substring(0, 200)}..."`);
  
  return { 
    success: mentionsHandwritten && mentionsProbateCode, 
    details: `${text.split(' ').length} words, mentions handwriting: ${mentionsHandwritten}, Probate Code: ${mentionsProbateCode}`,
    error: (mentionsHandwritten && mentionsProbateCode) ? null : 'Missing key holographic will requirements'
  };
}

// =============================================================================
// TEST 3: Gemini 2.5 Pro Fallback
// =============================================================================
async function testGemini25ProFallback() {
  console.log('   Testing Gemini 2.5 Pro (fallback model)...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: 'You are a California legal research assistant.' },
        { role: 'user', content: 'What is the California Family Code section for prenuptial agreements? Just give the number.' }
      ],
      temperature: 0.2,
      max_tokens: 2000 // Pro models need high max_tokens for reasoning
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  const mentions1600 = text.includes('1600') || text.includes('1610') || text.includes('1615');
  
  console.log(`   Response: "${text.substring(0, 100)}..."`);
  
  return { 
    success: mentions1600, 
    details: `Correctly identified Family Code sections 1600-1617`,
    error: mentions1600 ? null : 'Did not identify correct Family Code section'
  };
}

// =============================================================================
// TEST 4: Claude Sonnet 4.5 - Verification
// =============================================================================
async function testClaudeSonnetVerification() {
  console.log('   Testing Claude Sonnet 4.5 for verification...');
  
  const documentToVerify = `
## Legal Memorandum

This memorandum addresses the enforceability of a prenuptial agreement under California law.

Under California Family Code Section 1615, a prenuptial agreement is enforceable only if:
1. It was executed voluntarily by both parties
2. Both parties had independent legal counsel, or expressly waived counsel in writing
3. There was full disclosure of assets and liabilities

The landmark case Estate of Bonds (2001) established that the party seeking to enforce must prove these elements.
`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      messages: [
        { role: 'system', content: 'You are a legal document verifier. Verify the accuracy of legal claims.' },
        { role: 'user', content: `Verify this document for legal accuracy:\n\n${documentToVerify}\n\nProvide a brief assessment (2-3 sentences).` }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  console.log(`   Response: "${text.substring(0, 200)}..."`);
  
  return { 
    success: text.length > 50, 
    details: `${text.split(' ').length} words verification response`,
    error: text.length > 50 ? null : 'Verification response too short'
  };
}

// =============================================================================
// TEST 5: OpenAI Embeddings via OpenRouter
// =============================================================================
async function testOpenAIEmbeddings() {
  console.log('   Testing OpenAI embeddings for CEB search...');
  
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: 'California revocable living trust requirements and formalities'
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  const dimensions = embedding?.length || 0;
  
  console.log(`   Embedding dimensions: ${dimensions}`);
  
  return { 
    success: dimensions === 1536, 
    details: `Generated ${dimensions}-dimensional embedding vector`,
    error: dimensions === 1536 ? null : `Expected 1536 dimensions, got ${dimensions}`
  };
}

// =============================================================================
// TEST 6: CEB Vector Search (if Upstash configured)
// =============================================================================
async function testCEBVectorSearch() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.log('   ⚠️ Skipping - Upstash not configured');
    return { success: true, details: 'Skipped - Upstash not configured' };
  }

  console.log('   Testing CEB vector search...');
  
  // First generate embedding
  const embeddingResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: 'revocable living trust'
    })
  });

  if (!embeddingResponse.ok) {
    return { success: false, error: 'Failed to generate embedding' };
  }

  const embeddingData = await embeddingResponse.json();
  const embedding = embeddingData.data?.[0]?.embedding;

  // Query Upstash Vector
  const vectorResponse = await fetch(`${UPSTASH_URL}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vector: embedding,
      topK: 3,
      includeMetadata: true
    })
  });

  if (!vectorResponse.ok) {
    return { success: false, error: `Upstash error: ${vectorResponse.status}` };
  }

  const vectorData = await vectorResponse.json();
  const resultCount = vectorData.result?.length || 0;
  
  console.log(`   Found ${resultCount} CEB results`);
  if (resultCount > 0) {
    console.log(`   Top result: ${vectorData.result[0]?.metadata?.title || 'Unknown'}`);
  }
  
  return { 
    success: resultCount > 0, 
    details: `Found ${resultCount} relevant CEB sources`,
    error: resultCount > 0 ? null : 'No CEB results found'
  };
}

// =============================================================================
// TEST 7: Claude Haiku (Research Agent)
// =============================================================================
async function testClaudeHaikuResearch() {
  console.log('   Testing Claude Haiku 4.5 for research agent...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: 'You are a legal research assistant. Identify key legal issues.' },
        { role: 'user', content: 'Identify the 3 main legal issues in a California child custody dispute. Be brief.' }
      ],
      temperature: 0.2,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  const mentionsBestInterest = text.toLowerCase().includes('best interest');
  
  console.log(`   Response: "${text.substring(0, 150)}..."`);
  
  return { 
    success: text.length > 50, 
    details: `${text.split(' ').length} words, mentions "best interest": ${mentionsBestInterest}`,
    error: text.length > 50 ? null : 'Response too short'
  };
}

// =============================================================================
// TEST 8: End-to-End Hybrid Query Simulation
// =============================================================================
async function testHybridQueryFlow() {
  console.log('   Simulating full hybrid query flow...');
  
  // Step 1: Generate embedding for query
  console.log('   Step 1: Generating query embedding...');
  const embeddingResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: 'How do I contest a will in California probate court?'
    })
  });

  if (!embeddingResponse.ok) {
    return { success: false, error: 'Embedding generation failed' };
  }
  console.log('   ✓ Embedding generated');

  // Step 2: Generate response with Gemini 3 Pro
  console.log('   Step 2: Generating response with Gemini 3 Pro...');
  const geminiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'system', content: 'You are a California legal research assistant.' },
        { role: 'user', content: 'Briefly explain how to contest a will in California. Include the key steps and time limits.' }
      ],
      temperature: 0.2,
      max_tokens: 400
    })
  });

  if (!geminiResponse.ok) {
    return { success: false, error: 'Gemini response failed' };
  }
  
  const geminiData = await geminiResponse.json();
  const geminiText = geminiData.choices?.[0]?.message?.content || '';
  console.log('   ✓ Gemini response generated');

  // Step 3: Verify with Claude
  console.log('   Step 3: Verifying with Claude Sonnet...');
  const claudeResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://california-law-chatbot.vercel.app',
      'X-Title': 'California Law Chatbot Test'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      messages: [
        { role: 'system', content: 'You are a legal accuracy verifier. Rate accuracy 1-10.' },
        { role: 'user', content: `Rate the accuracy of this legal information (1-10) and explain briefly:\n\n${geminiText}` }
      ],
      temperature: 0.2,
      max_tokens: 150
    })
  });

  if (!claudeResponse.ok) {
    return { success: false, error: 'Claude verification failed' };
  }
  
  const claudeData = await claudeResponse.json();
  const claudeText = claudeData.choices?.[0]?.message?.content || '';
  console.log('   ✓ Claude verification complete');
  
  console.log(`   Gemini response: "${geminiText.substring(0, 100)}..."`);
  console.log(`   Claude verification: "${claudeText.substring(0, 100)}..."`);
  
  return { 
    success: true, 
    details: 'Full hybrid flow completed: Embedding → Gemini → Claude verification'
  };
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================
async function runAllTests() {
  await runTest('Gemini 3 Pro - Simple Legal Question', testGemini3ProSimple);
  await runTest('Gemini 3 Pro - Complex Legal Research', testGemini3ProComplex);
  await runTest('Gemini 2.5 Pro - Fallback Model', testGemini25ProFallback);
  await runTest('Claude Sonnet 4.5 - Verification', testClaudeSonnetVerification);
  await runTest('OpenAI Embeddings via OpenRouter', testOpenAIEmbeddings);
  await runTest('CEB Vector Search', testCEBVectorSearch);
  await runTest('Claude Haiku 4.5 - Research Agent', testClaudeHaikuResearch);
  await runTest('End-to-End Hybrid Query Flow', testHybridQueryFlow);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  
  for (const test of results.tests) {
    const icon = test.status === 'passed' ? '✅' : '❌';
    const duration = `${test.duration}ms`.padEnd(8);
    console.log(`${icon} ${test.name.padEnd(45)} ${duration} ${test.status.toUpperCase()}`);
  }
  
  console.log('');
  console.log('─'.repeat(70));
  console.log(`Total: ${results.passed + results.failed} tests | ✅ Passed: ${results.passed} | ❌ Failed: ${results.failed}`);
  console.log('='.repeat(70));
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! OpenRouter integration is working correctly.\n');
  } else {
    console.log('\n⚠️ Some tests failed. Review the errors above.\n');
  }
}

runAllTests().catch(console.error);
