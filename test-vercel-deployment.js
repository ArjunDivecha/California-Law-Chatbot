/**
 * Test Vercel Deployment API Endpoints
 * 
 * This script tests all API endpoints on the Vercel deployment
 * to identify which API keys are configured and working.
 */

const DEPLOYMENT_URL = 'https://california-law-chatbot-20n8hw5vp.vercel.app';

const tests = [
  {
    name: 'Config Endpoint',
    method: 'GET',
    endpoint: '/api/config',
    expected: 'Should return hasCourtListenerKey status'
  },
  {
    name: 'CEB Search (requires OPENAI_API_KEY + UPSTASH_*)',
    method: 'POST',
    endpoint: '/api/ceb-search',
    body: { query: 'test', topK: 1 },
    expected: 'Should search CEB database or return specific error'
  },
  {
    name: 'Gemini Chat (requires GEMINI_API_KEY)',
    method: 'POST',
    endpoint: '/api/gemini-chat',
    body: { message: 'Hello' },
    expected: 'Should return response or API key error'
  },
  {
    name: 'Claude Chat (requires ANTHROPIC_API_KEY)',
    method: 'POST',
    endpoint: '/api/claude-chat',
    body: { message: 'Hello' },
    expected: 'Should return response or API key error'
  }
];

async function testEndpoint(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`   Endpoint: ${test.method} ${test.endpoint}`);
  console.log(`   Expected: ${test.expected}`);
  
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(`${DEPLOYMENT_URL}${test.endpoint}`, options);
    const data = await response.json();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS`);
      if (test.name === 'Config Endpoint') {
        console.log(`   Response:`, JSON.stringify(data, null, 2));
      } else {
        console.log(`   Response preview:`, JSON.stringify(data).substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ FAILED`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
      
      // Check for specific API key errors
      const errorMsg = JSON.stringify(data).toLowerCase();
      if (errorMsg.includes('api_key') || errorMsg.includes('401') || errorMsg.includes('403')) {
        console.log(`   ⚠️  API KEY ISSUE DETECTED`);
      }
      if (errorMsg.includes('openai')) {
        console.log(`   🔑 OPENAI_API_KEY issue`);
      }
      if (errorMsg.includes('gemini')) {
        console.log(`   🔑 GEMINI_API_KEY issue`);
      }
      if (errorMsg.includes('anthropic') || errorMsg.includes('claude')) {
        console.log(`   🔑 ANTHROPIC_API_KEY issue`);
      }
      if (errorMsg.includes('upstash')) {
        console.log(`   🔑 UPSTASH credentials issue`);
      }
    }
  } catch (error) {
    console.log(`   ❌ NETWORK ERROR`);
    console.log(`   Error:`, error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing Vercel Deployment');
  console.log(`📍 URL: ${DEPLOYMENT_URL}`);
  console.log('='.repeat(60));
  
  for (const test of tests) {
    await testEndpoint(test);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('\n💡 Next Steps:');
  console.log('1. Check Vercel Dashboard → Settings → Environment Variables');
  console.log('2. Verify all required keys are set for Production environment');
  console.log('3. Redeploy if you just added keys (keys only apply to new deployments)');
  console.log('4. Check Vercel function logs for detailed error messages');
}

runTests().catch(console.error);

