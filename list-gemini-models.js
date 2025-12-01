/**
 * List Available Gemini Models
 * 
 * Uses the API key to list available models and find the correct name for Gemini 3.
 */

import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";

config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

// Handle the prefix issue if present
let cleanKey = apiKey;
if (apiKey.startsWith('GEMINI_API_KEY=')) {
  cleanKey = apiKey.replace('GEMINI_API_KEY=', '');
}

console.log('🔍 Listing available Gemini models...\n');

async function listModels() {
  try {
    // Direct REST API call to list models since SDK might not expose listModels easily or strictly
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || response.statusText);
    }
    
    const models = data.models || [];
    console.log(`✅ Found ${models.length} models:\n`);
    
    // Filter for Pro models and sort
    const proModels = models.filter(m => m.name.includes('pro') || m.name.includes('gemini'));
    
    proModels.forEach(model => {
      console.log(`- ${model.name}`);
      console.log(`  Display: ${model.displayName}`);
      console.log(`  Desc: ${model.description?.substring(0, 60)}...`);
      console.log('');
    });

    // Check specifically for "3"
    const gemini3 = models.find(m => m.name.includes('gemini-3') || m.name.includes('gemini-3.0'));
    if (gemini3) {
      console.log('🎉 FOUND GEMINI 3:', gemini3.name);
    } else {
      console.log('⚠️  Gemini 3 specific model name not found in list (might be preview/exp)');
      console.log('   Checking for "exp" or "preview" models:');
      models.filter(m => m.name.includes('exp') || m.name.includes('preview')).forEach(m => {
        console.log(`   - ${m.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to list models:', error.message);
  }
}

listModels();

