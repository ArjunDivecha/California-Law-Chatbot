/**
=============================================================================
TEST SCRIPT: Google Gemini API Key Validation
=============================================================================

DESCRIPTION:
This script tests the Google Gemini API key by making a simple chat request.

USAGE:
node test-gemini-api.js

NOTES:
- Requires GEMINI_API_KEY environment variable
- Makes a test request to verify API connectivity
=============================================================================
*/

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;

async function testGeminiAPI() {
    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY environment variable is not set');
        process.exit(1);
    }

    console.log('🤖 Testing Google Gemini API key...');

    try {
        console.log('📡 Initializing GoogleGenAI client...');

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        console.log('💬 Creating chat session...');

        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are a test assistant. Respond with 'Hello! Gemini API is working correctly.'",
            }
        });

        console.log('📤 Sending test message...');

        const response = await chat.sendMessage({ message: "Hello" });

        console.log('📥 Received response:', response.text);

        if (response.text && response.text.includes('working correctly')) {
            console.log('✅ Gemini API key is valid and working!');
        } else {
            console.log('⚠️  API responded but with unexpected message');
        }

        console.log('🎉 Google Gemini API test completed successfully!');

    } catch (error) {
        console.error('❌ Gemini API test failed:');
        console.error('Error:', error.message);

        if (error.message.includes('API_KEY')) {
            console.error('💡 This usually means the API key is invalid or expired');
        } else if (error.message.includes('quota')) {
            console.error('💡 This usually means you\'ve exceeded your API quota');
        }

        process.exit(1);
    }
}

// Run the test
testGeminiAPI();
