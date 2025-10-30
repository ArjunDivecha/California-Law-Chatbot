/**
 * MODEL SPEED BENCHMARK TEST
 * 
 * Tests multiple AI models for speed and response quality
 * Reads API keys from .env file
 * 
 * Models tested:
 * - OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo, o1, o1-mini
 * - Anthropic: Claude Sonnet 4, Claude Haiku 4.5, Claude Opus 4.1
 * - Google: Gemini 2.5 Pro, Gemini 2.5 Flash
 */

import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const TEST_PROMPT = `Tell me about prenuptial agreements in California. Include relevant Family Code sections and key requirements.`;

const SYSTEM_PROMPT = `You are an expert legal research assistant specializing in California law. Provide comprehensive, accurate information with relevant code sections.`;

// Test configuration - LATEST MODELS AS OF 2025
const MODELS = {
    openai: [
        'gpt-5',              // Latest GPT-5 (2025)
        'gpt-5-pro',          // GPT-5 Pro 
        'gpt-5-codex',        // GPT-5 Codex (coding optimized)
        'gpt-5-mini',         // GPT-5 Mini (faster, cheaper)
        'gpt-5-nano',         // GPT-5 Nano (fastest)
        'gpt-4.5',            // GPT-4.5 (Feb 2025)
        'gpt-4.1',            // GPT-4.1
        'gpt-4.1-mini',       // GPT-4.1 Mini
        'o3-mini'             // Latest reasoning model (Jan 2025)
    ],
    anthropic: [
        'claude-sonnet-4-5-20250929',    // Claude Sonnet 4.5 (Sept 2025) - LATEST
        'claude-opus-4-1-20250827',      // Claude Opus 4.1 (August 2025) - Most powerful
        'claude-haiku-4-5-20251001',     // Claude Haiku 4.5 (Oct 2025) - Fastest
        'claude-opus-4-20250514',        // Claude Opus 4 (May 2025)
        'claude-sonnet-4-20250514',      // Claude Sonnet 4 (May 2025)
        'claude-3-7-sonnet-20250219'     // Claude 3.7 Sonnet (Feb 2025)
    ],
    google: [
        'gemini-2.5-pro',         // Gemini 2.5 Pro (Mar 2025)
        'gemini-2.5-flash',       // Gemini 2.5 Flash (Mar 2025)
        'gemini-2.5-flash-lite',  // Gemini 2.5 Flash-Lite (Oct 2025)
        'gemini-2.0-flash'        // Gemini 2.0 Flash
    ]
};

// Results storage
const results = [];

/**
 * Test OpenAI model
 */
async function testOpenAI(model) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { error: 'OPENAI_API_KEY not found in .env' };
    }

    const startTime = Date.now();
    try {
        const openai = new OpenAI({ apiKey });
        
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: TEST_PROMPT }
            ],
            max_tokens: 1000
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        const text = response.choices?.[0]?.message?.content || '';
        const tokens = response.usage?.total_tokens || 0;

        return {
            duration,
            tokens,
            responseLength: text.length,
            responsePreview: text.substring(0, 200) + '...'
        };
    } catch (err) {
        return { error: err.message, duration: Date.now() - startTime };
    }
}

/**
 * Test Anthropic model
 */
async function testAnthropic(model) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { error: 'ANTHROPIC_API_KEY not found in .env' };
    }

    const startTime = Date.now();
    try {
        const anthropic = new Anthropic({ apiKey });
        
        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: TEST_PROMPT }
            ]
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        const text = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        return {
            duration,
            tokens: response.usage?.input_tokens + response.usage?.output_tokens || 0,
            responseLength: text.length,
            responsePreview: text.substring(0, 200) + '...'
        };
    } catch (err) {
        return { error: err.message, duration: Date.now() - startTime };
    }
}

/**
 * Test Google Gemini model
 */
async function testGoogle(model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { error: 'GEMINI_API_KEY not found in .env' };
    }

    const startTime = Date.now();
    try {
        const genAI = new GoogleGenAI({ apiKey });
        const chat = genAI.chats.create({
            model: model,
            config: {
                systemInstruction: SYSTEM_PROMPT
            }
        });

        const result = await chat.sendMessage({ message: TEST_PROMPT });
        const endTime = Date.now();
        const duration = endTime - startTime;

        const text = result.text || '';

        return {
            duration,
            tokens: result.usageMetadata?.totalTokenCount || 0,
            responseLength: text.length,
            responsePreview: text.substring(0, 200) + '...'
        };
    } catch (err) {
        return { error: err.message, duration: Date.now() - startTime };
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 MODEL SPEED BENCHMARK TEST\n');
    console.log('Test Prompt:', TEST_PROMPT);
    console.log('\n' + '='.repeat(80) + '\n');

    // Test OpenAI models
    console.log('📊 Testing OpenAI Models...\n');
    for (const model of MODELS.openai) {
        console.log(`Testing: ${model}...`);
        const result = await testOpenAI(model);
        results.push({ provider: 'OpenAI', model, ...result });
        
        if (result.error) {
            console.log(`  ❌ Error: ${result.error}`);
        } else {
            console.log(`  ✅ Duration: ${result.duration}ms | Tokens: ${result.tokens} | Length: ${result.responseLength} chars`);
        }
        console.log('');
    }

    // Test Anthropic models
    console.log('📊 Testing Anthropic Models...\n');
    for (const model of MODELS.anthropic) {
        console.log(`Testing: ${model}...`);
        const result = await testAnthropic(model);
        results.push({ provider: 'Anthropic', model, ...result });
        
        if (result.error) {
            console.log(`  ❌ Error: ${result.error}`);
        } else {
            console.log(`  ✅ Duration: ${result.duration}ms | Tokens: ${result.tokens} | Length: ${result.responseLength} chars`);
        }
        console.log('');
    }

    // Test Google models
    console.log('📊 Testing Google Gemini Models...\n');
    for (const model of MODELS.google) {
        console.log(`Testing: ${model}...`);
        const result = await testGoogle(model);
        results.push({ provider: 'Google', model, ...result });
        
        if (result.error) {
            console.log(`  ❌ Error: ${result.error}`);
        } else {
            console.log(`  ✅ Duration: ${result.duration}ms | Tokens: ${result.tokens} | Length: ${result.responseLength} chars`);
        }
        console.log('');
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 RESULTS SUMMARY (sorted by speed)\n');
    
    const successfulResults = results.filter(r => !r.error);
    successfulResults.sort((a, b) => a.duration - b.duration);
    
    console.log('Rank | Provider   | Model                        | Time (ms) | Tokens | Length');
    console.log('-'.repeat(80));
    
    successfulResults.forEach((result, index) => {
        const rank = (index + 1).toString().padStart(4);
        const provider = result.provider.padEnd(10);
        const model = result.model.padEnd(28);
        const duration = result.duration.toString().padStart(9);
        const tokens = result.tokens.toString().padStart(6);
        const length = result.responseLength.toString().padStart(6);
        
        console.log(`${rank} | ${provider} | ${model} | ${duration} | ${tokens} | ${length}`);
    });

    // Show failed tests
    const failedResults = results.filter(r => r.error);
    if (failedResults.length > 0) {
        console.log('\n❌ FAILED TESTS:\n');
        failedResults.forEach(result => {
            console.log(`${result.provider} - ${result.model}: ${result.error}`);
        });
    }

    // Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS:\n');
    
    if (successfulResults.length > 0) {
        const fastest = successfulResults[0];
        console.log(`🏆 FASTEST: ${fastest.provider} ${fastest.model} (${fastest.duration}ms)`);
        
        const fastModels = successfulResults.filter(r => r.duration < 3000);
        if (fastModels.length > 1) {
            console.log('\n⚡ FAST MODELS (< 3 seconds):');
            fastModels.forEach(r => {
                console.log(`   - ${r.provider} ${r.model}: ${r.duration}ms`);
            });
        }
        
        console.log('\n📝 For production, consider:');
        console.log('   1. Speed: Choose from the fastest models above');
        console.log('   2. Cost: Check pricing at each provider\'s website');
        console.log('   3. Quality: Review the response previews above');
        console.log('   4. Availability: Ensure consistent uptime');
    }
}

// Run the tests
runAllTests().catch(console.error);

