/**
 * Test Gemini API Key with direct HTTP call
 * This bypasses the SDK to test the key directly
 */

import { config } from 'dotenv';

config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found');
  process.exit(1);
}

console.log('🧪 Testing Gemini API Key with direct HTTP call\n');
console.log('Key preview:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
console.log('');

// Test with direct API call
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

const requestBody = {
  contents: [{
    parts: [{
      text: "Say 'Hello' if you can read this."
    }]
  }]
};

try {
  console.log('📡 Making direct API call to Gemini...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (response.ok) {
    console.log('\n✅ SUCCESS! API key is valid!\n');
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No text in response';
    console.log('Response:', text);
  } else {
    console.log('\n❌ FAILED\n');
    console.log('Status:', response.status, response.statusText);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.log('\nError Details:');
      console.log('  Code:', data.error.code);
      console.log('  Message:', data.error.message);
      console.log('  Status:', data.error.status);
      
      if (data.error.details) {
        console.log('\nDetails:', JSON.stringify(data.error.details, null, 2));
      }
    }
  }
} catch (error) {
  console.error('\n❌ Network Error:', error.message);
}

