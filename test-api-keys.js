/**
 * Test API Keys Configuration
 * 
 * This script checks which API keys are configured in the environment
 * and tests basic connectivity to the API endpoints.
 */

const requiredKeys = {
  'GEMINI_API_KEY': 'Google Gemini 2.5 Pro (Generator)',
  'ANTHROPIC_API_KEY': 'Claude Sonnet 4.5 (Verifier)',
  'OPENAI_API_KEY': 'OpenAI Embeddings (CEB RAG)',
  'UPSTASH_VECTOR_REST_URL': 'Upstash Vector Database URL',
  'UPSTASH_VECTOR_REST_TOKEN': 'Upstash Vector Database Token',
};

const optionalKeys = {
  'COURTLISTENER_API_KEY': 'CourtListener API (Case Law)',
  'SERPER_API_KEY': 'Serper API (Google Search)',
  'OPENSTATES_API_KEY': 'OpenStates API (Legislation)',
  'LEGISCAN_API_KEY': 'LegiScan API (Bill Text)',
};

console.log('🔍 Checking API Key Configuration...\n');

// Check required keys
console.log('📋 REQUIRED API KEYS:');
let missingRequired = [];
for (const [key, description] of Object.entries(requiredKeys)) {
  const value = process.env[key];
  if (value) {
    const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    console.log(`  ✅ ${key}: ${masked} (${description})`);
  } else {
    console.log(`  ❌ ${key}: MISSING (${description})`);
    missingRequired.push(key);
  }
}

console.log('\n📋 OPTIONAL API KEYS:');
let missingOptional = [];
for (const [key, description] of Object.entries(optionalKeys)) {
  const value = process.env[key];
  if (value) {
    const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    console.log(`  ✅ ${key}: ${masked} (${description})`);
  } else {
    console.log(`  ⚠️  ${key}: Not configured (${description})`);
    missingOptional.push(key);
  }
}

console.log('\n' + '='.repeat(60));

if (missingRequired.length > 0) {
  console.log('\n❌ CRITICAL: Missing required API keys:');
  missingRequired.forEach(key => {
    console.log(`   - ${key}`);
  });
  console.log('\n💡 To fix:');
  console.log('   1. Create a .env file in the project root');
  console.log('   2. Add the missing keys:');
  missingRequired.forEach(key => {
    console.log(`      ${key}=your_api_key_here`);
  });
  console.log('   3. Restart the dev server');
  process.exit(1);
} else {
  console.log('\n✅ All required API keys are configured!');
  
  if (missingOptional.length > 0) {
    console.log('\n⚠️  Note: Some optional features may not be available:');
    missingOptional.forEach(key => {
      console.log(`   - ${optionalKeys[key]}`);
    });
  }
  
  console.log('\n🧪 Testing API endpoints...\n');
  
  // Test endpoints
  testEndpoint('http://localhost:5173/api/config', 'Config endpoint');
}

async function testEndpoint(url, name) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(`✅ ${name}: OK`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`❌ ${name}: FAILED`);
    console.log(`   Error: ${error.message}`);
  }
}

