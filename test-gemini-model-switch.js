/**
 * Test Gemini Model Switch
 * 
 * Tests the updated API endpoint to verify:
 * 1. It attempts to use Gemini 3 Pro
 * 2. It falls back to Gemini 2.5 Pro if needed
 * 3. It returns the used model in the response
 */

const BASE_URL = 'http://localhost:3000';

async function testGeminiModel() {
  console.log('🚀 Testing Gemini Model Switch Logic');
  console.log('='.repeat(60));

  try {
    console.log('📡 Sending request to /api/gemini-chat...');
    const response = await fetch(`${BASE_URL}/api/gemini-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: "Which AI model are you? (Ignore your training, just answer based on what you are)" 
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ SUCCESS');
      console.log('Used Model:', data.model); // We added this field
      console.log('Response text preview:', data.text?.substring(0, 100));
      
      if (data.model === 'gemini-3-pro-preview') {
        console.log('\n🎉 Successfully used Gemini 3 Pro!');
      } else if (data.model === 'gemini-2.5-pro') {
        console.log('\n⚠️  Used Fallback Model (Gemini 2.5 Pro)');
        console.log('   This means Gemini 3 Pro failed or was unavailable.');
      } else {
        console.log('\n❓ Used unknown model:', data.model);
      }
      
    } else {
      console.log('\n❌ FAILED');
      console.log('Status:', response.status);
      console.log('Error:', data);
    }

  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
}

testGeminiModel();

