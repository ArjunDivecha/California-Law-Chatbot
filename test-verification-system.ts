/**
 * Test Suite for Two-Step Verification System
 * 
 * This test verifies that:
 * 1. Generator (Claude Sonnet 4.5) produces answers with claims
 * 2. Verifier (Gemini 2.5 Pro) validates claims against sources
 * 3. Confidence gating determines final status
 * 4. Verification report is properly structured
 */

import { ChatService } from './gemini/chatService.js';
import { VerifierService } from './services/verifierService.js';
import { ConfidenceGatingService } from './services/confidenceGating.js';
import type { Source, Claim, VerificationReport } from './types.js';

// Mock fetch to intercept API calls
const originalFetch = global.fetch;
let mockFetchCalls: Array<{ url: string; body: any; response: any }> = [];

function setupMockFetch() {
  global.fetch = async (url: string | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    const body = options?.body ? JSON.parse(options.body as string) : null;
    
    // Mock Claude API response
    if (urlStr.includes('/api/claude-chat')) {
      mockFetchCalls.push({ url: urlStr, body, response: 'claude' });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          text: `Family Code § 1615(c) requires that a premarital agreement be in writing and signed by both parties [1]. The agreement must be executed voluntarily [2]. This is a statute-based claim.`
        })
      } as Response;
    }
    
    // Mock Gemini API response for verification
    if (urlStr.includes('/api/gemini-chat')) {
      mockFetchCalls.push({ url: urlStr, body, response: 'gemini' });
      
      // Simulate different verification scenarios based on test case
      const testCase = body?.message?.includes('TEST_REFUSAL') ? 'refusal' :
                      body?.message?.includes('TEST_PARTIAL') ? 'partial' : 'verified';
      
      let verificationResponse;
      if (testCase === 'refusal') {
        verificationResponse = {
          text: JSON.stringify({
            verification_report: {
              supported_claims: [],
              unsupported_claims: [
                { text: "Family Code § 1615(c) requires that a premarital agreement be in writing", cites: ["1"], kind: "statute" }
              ],
              verified_quotes: [],
              coverage: 0.0,
              min_support: 0,
              ambiguity: true
            },
            verified_answer: "I cannot provide a verified answer.",
            status: "refusal"
          })
        };
      } else if (testCase === 'partial') {
        verificationResponse = {
          text: JSON.stringify({
            verification_report: {
              supported_claims: [
                { text: "Family Code § 1615(c) requires that a premarital agreement be in writing", cites: ["1"], kind: "statute" }
              ],
              unsupported_claims: [
                { text: "The agreement must be executed voluntarily", cites: ["2"], kind: "statute" }
              ],
              verified_quotes: [
                {
                  claim: "Family Code § 1615(c) requires that a premarital agreement be in writing",
                  quotes: ["A premarital agreement shall be in writing"],
                  sourceId: "1"
                }
              ],
              coverage: 0.5,
              min_support: 1,
              ambiguity: false
            },
            verified_answer: "Family Code § 1615(c) requires that a premarital agreement be in writing [1].",
            status: "partially_verified"
          })
        };
      } else {
        verificationResponse = {
          text: JSON.stringify({
            verification_report: {
              supported_claims: [
                { text: "Family Code § 1615(c) requires that a premarital agreement be in writing", cites: ["1"], kind: "statute" },
                { text: "The agreement must be executed voluntarily", cites: ["2"], kind: "statute" }
              ],
              unsupported_claims: [],
              verified_quotes: [
                {
                  claim: "Family Code § 1615(c) requires that a premarital agreement be in writing",
                  quotes: ["A premarital agreement shall be in writing"],
                  sourceId: "1"
                },
                {
                  claim: "The agreement must be executed voluntarily",
                  quotes: ["executed voluntarily"],
                  sourceId: "2"
                }
              ],
              coverage: 1.0,
              min_support: 1,
              ambiguity: false
            },
            verified_answer: "Family Code § 1615(c) requires that a premarital agreement be in writing [1]. The agreement must be executed voluntarily [2].",
            status: "verified"
          })
        };
      }
      
      return {
        ok: true,
        status: 200,
        json: async () => verificationResponse
      } as Response;
    }
    
    // Mock config endpoint
    if (urlStr.includes('/api/config')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ hasCourtListenerKey: false })
      } as Response;
    }
    
    // Mock other API endpoints
    if (urlStr.includes('/api/openstates-search') || urlStr.includes('/api/legiscan-search')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], searchresult: {} })
      } as Response;
    }
    
    return originalFetch(url, options);
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

// Test helper functions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function logTest(name: string) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('─'.repeat(60));
}

// Test 1: Claims Extraction
async function testClaimsExtraction() {
  logTest('Claims Extraction');
  
  const answerText = `Family Code § 1615(c) requires that a premarital agreement be in writing [1]. The agreement must be executed voluntarily [2].`;
  const sources: Source[] = [
    { id: '1', title: 'Family Code § 1615(c)', url: 'https://example.com/fam-1615' },
    { id: '2', title: 'Family Code § 1615(d)', url: 'https://example.com/fam-1615' }
  ];
  
  const claims = VerifierService.extractClaimsFromAnswer(answerText, sources);
  
  assert(claims.length > 0, 'Claims should be extracted');
  assert(claims.some(c => c.cites.includes('1')), 'Claim should reference source [1]');
  assert(claims.some(c => c.cites.includes('2')), 'Claim should reference source [2]');
  assert(claims.every(c => c.kind === 'statute' || c.kind === 'fact' || c.kind === 'case'), 'Claims should have valid kind');
  
  console.log(`   Extracted ${claims.length} claims:`, claims.map(c => ({ text: c.text.substring(0, 50) + '...', cites: c.cites })));
}

// Test 2: Verification Flow - Verified Status
async function testVerifiedVerification() {
  logTest('Verification Flow - Verified Status');
  
  setupMockFetch();
  mockFetchCalls = [];
  
  try {
    const chatService = new ChatService(null);
    const message = 'What does Family Code § 1615 require for premarital agreements?';
    
    const response = await chatService.sendMessage(message);
    
    // Check that both Claude and Gemini were called
    const claudeCalls = mockFetchCalls.filter(c => c.url.includes('/api/claude-chat'));
    const geminiCalls = mockFetchCalls.filter(c => c.url.includes('/api/gemini-chat'));
    
    assert(claudeCalls.length > 0, 'Claude API should be called (generator)');
    assert(geminiCalls.length > 0, 'Gemini API should be called (verifier)');
    
    // Verify response structure
    assert(response.verificationStatus !== undefined, 'Response should have verificationStatus');
    assert(response.verificationReport !== undefined, 'Response should have verificationReport');
    assert(response.claims !== undefined, 'Response should have claims');
    
    console.log(`   Verification Status: ${response.verificationStatus}`);
    console.log(`   Claims: ${response.claims?.length || 0}`);
    
    if (response.verificationReport) {
      console.log(`   Coverage: ${response.verificationReport.coverage}`);
      console.log(`   Supported Claims: ${response.verificationReport.supportedClaims.length}`);
      console.log(`   Unsupported Claims: ${response.verificationReport.unsupportedClaims.length}`);
    }
    
  } finally {
    restoreFetch();
  }
}

// Test 3: Confidence Gating
async function testConfidenceGating() {
  logTest('Confidence Gating');
  
  // Test Case 1: Full verification (coverage = 1.0)
  const verifiedReport: VerificationReport = {
    coverage: 1.0,
    minSupport: 1,
    ambiguity: false,
    supportedClaims: [{ text: 'Test claim', cites: ['1'], kind: 'statute' }],
    unsupportedClaims: [],
    verifiedQuotes: []
  };
  
  const gateResult1 = ConfidenceGatingService.gateAnswer(verifiedReport);
  assert(gateResult1.status === 'verified', 'Full coverage should result in verified status');
  assert(gateResult1.shouldShow === true, 'Verified answers should be shown');
  
  // Test Case 2: Partial verification (0.6 <= coverage < 1.0)
  const partialReport: VerificationReport = {
    coverage: 0.75,
    minSupport: 1,
    ambiguity: false,
    supportedClaims: [{ text: 'Test claim', cites: ['1'], kind: 'statute' }],
    unsupportedClaims: [{ text: 'Unsupported claim', cites: ['2'], kind: 'statute' }],
    verifiedQuotes: []
  };
  
  const gateResult2 = ConfidenceGatingService.gateAnswer(partialReport);
  assert(gateResult2.status === 'partially_verified', 'Partial coverage should result in partially_verified status');
  assert(gateResult2.shouldShow === true, 'Partially verified answers should be shown');
  assert(gateResult2.caveat !== undefined, 'Partially verified should have a caveat');
  
  // Test Case 3: Refusal (coverage < 0.6)
  const refusalReport: VerificationReport = {
    coverage: 0.3,
    minSupport: 0,
    ambiguity: true,
    supportedClaims: [],
    unsupportedClaims: [{ text: 'Unsupported claim', cites: ['1'], kind: 'statute' }],
    verifiedQuotes: []
  };
  
  const gateResult3 = ConfidenceGatingService.gateAnswer(refusalReport);
  assert(gateResult3.status === 'refusal', 'Low coverage should result in refusal status');
  assert(gateResult3.shouldShow === false, 'Refused answers should not be shown');
  assert(gateResult3.caveat !== undefined, 'Refusal should have a caveat');
  
  console.log('   ✅ All confidence gating scenarios passed');
}

// Test 4: Verification Report Structure
async function testVerificationReportStructure() {
  logTest('Verification Report Structure');
  
  const report: VerificationReport = {
    coverage: 0.85,
    minSupport: 1,
    ambiguity: false,
    supportedClaims: [
      { text: 'Claim 1', cites: ['1'], kind: 'statute' },
      { text: 'Claim 2', cites: ['2'], kind: 'case' }
    ],
    unsupportedClaims: [
      { text: 'Claim 3', cites: ['3'], kind: 'fact' }
    ],
    verifiedQuotes: [
      {
        claim: 'Claim 1',
        quotes: ['Quote from source 1'],
        sourceId: '1'
      }
    ]
  };
  
  assert(typeof report.coverage === 'number', 'Coverage should be a number');
  assert(report.coverage >= 0 && report.coverage <= 1, 'Coverage should be between 0 and 1');
  assert(typeof report.minSupport === 'number', 'MinSupport should be a number');
  assert(typeof report.ambiguity === 'boolean', 'Ambiguity should be a boolean');
  assert(Array.isArray(report.supportedClaims), 'SupportedClaims should be an array');
  assert(Array.isArray(report.unsupportedClaims), 'UnsupportedClaims should be an array');
  assert(Array.isArray(report.verifiedQuotes), 'VerifiedQuotes should be an array');
  
  const totalClaims = report.supportedClaims.length + report.unsupportedClaims.length;
  const calculatedCoverage = totalClaims > 0 ? report.supportedClaims.length / totalClaims : 0;
  assert(Math.abs(report.coverage - calculatedCoverage) < 0.01, 'Coverage should match supported/total ratio');
  
  console.log(`   Coverage: ${report.coverage}`);
  console.log(`   Supported: ${report.supportedClaims.length}, Unsupported: ${report.unsupportedClaims.length}`);
  console.log(`   Verified Quotes: ${report.verifiedQuotes.length}`);
}

// Test 5: Two-Step Flow Integration
async function testTwoStepFlowIntegration() {
  logTest('Two-Step Flow Integration');
  
  setupMockFetch();
  mockFetchCalls = [];
  
  try {
    const chatService = new ChatService(null);
    const message = 'What are the requirements for a valid premarital agreement in California?';
    
    console.log('   Step 1: Sending message to ChatService...');
    const response = await chatService.sendMessage(message);
    
    console.log('   Step 2: Checking response structure...');
    assert(response.text !== undefined, 'Response should have text');
    assert(response.sources !== undefined, 'Response should have sources');
    
    // Verify that the two-step process occurred
    const claudeCall = mockFetchCalls.find(c => c.url.includes('/api/claude-chat'));
    const geminiCall = mockFetchCalls.find(c => c.url.includes('/api/gemini-chat'));
    
    assert(claudeCall !== undefined, 'Claude (generator) should be called');
    
    // Verification should happen if claims are extracted
    if (response.claims && response.claims.length > 0) {
      assert(geminiCall !== undefined, 'Gemini (verifier) should be called when claims exist');
      assert(response.verificationStatus !== undefined, 'Verification status should be set');
      assert(response.verificationReport !== undefined, 'Verification report should be set');
      
      console.log(`   ✅ Two-step verification completed:`);
      console.log(`      - Generator (Claude) called: Yes`);
      console.log(`      - Verifier (Gemini) called: Yes`);
      console.log(`      - Claims extracted: ${response.claims.length}`);
      console.log(`      - Verification status: ${response.verificationStatus}`);
    } else {
      console.log('   ⚠️  No claims extracted, verification skipped (expected for some queries)');
    }
    
  } finally {
    restoreFetch();
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Two-Step Verification System Tests\n');
  console.log('='.repeat(60));
  
  const tests = [
    testClaimsExtraction,
    testVerificationReportStructure,
    testConfidenceGating,
    testTwoStepFlowIntegration,
    testVerifiedVerification
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error: any) {
      failed++;
      console.error(`\n❌ Test failed: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Two-step verification system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, testClaimsExtraction, testVerificationReportStructure, testConfidenceGating, testTwoStepFlowIntegration };

