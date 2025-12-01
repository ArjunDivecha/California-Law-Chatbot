/**
 * Test Local Web App
 * Tests all API endpoints locally to verify everything is working
 */

const BASE_URL = 'http://localhost:3000';

const tests = [
  {
    name: 'Config Endpoint',
    method: 'GET',
    endpoint: '/api/config',
  },
  {
    name: 'Gemini Chat',
    method: 'POST',
    endpoint: '/api/gemini-chat',
    body: { message: 'Say hello if you can read this.' },
  },
  {
    name: 'Claude Chat',
    method: 'POST',
    endpoint: '/api/claude-chat',
    body: { message: 'Say hello if you can read this.' },
  },
  {
    name: 'CEB Search',
    method: 'POST',
    endpoint: '/api/ceb-search',
    body: { query: 'test', topK: 1 },
  },
];

async function testEndpoint(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`   ${test.method} ${test.endpoint}`);
  
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
    
    const response = await fetch(`${BASE_URL}${test.endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      if (test.name === 'Config Endpoint') {
        console.log(`   Response:`, JSON.stringify(data, null, 2));
      } else if (test.name === 'Gemini Chat' || test.name === 'Claude Chat') {
        const preview = data.text?.substring(0, 100) || JSON.stringify(data).substring(0, 100);
        console.log(`   Response preview: ${preview}...`);
      } else {
        console.log(`   Response:`, JSON.stringify(data).substring(0, 200));
      }
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    if (error.message.includes('ECONNREFUSED')) {
      console.log(`   💡 Make sure 'vercel dev' is running on port 3000`);
    }
  }
}

async function runTests() {
  console.log('🚀 Testing Local Web App');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  // First check if server is running
  try {
    const response = await fetch(`${BASE_URL}/api/config`);
    if (!response.ok) {
      console.log('⚠️  Server may not be fully started yet');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server');
    console.log('💡 Make sure to run: vercel dev');
    console.log('   This starts both Vite (port 5173) and API server (port 3000)');
    process.exit(1);
  }
  
  for (const test of tests) {
    await testEndpoint(test);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary Complete');
  console.log('\n💡 Frontend: http://localhost:5173');
  console.log('💡 API: http://localhost:3000');
}

runTests().catch(console.error);

