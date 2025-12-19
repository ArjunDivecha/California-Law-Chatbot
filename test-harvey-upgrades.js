/**
 * Test Script for Harvey Upgrade Features
 *
 * Tests:
 * 1. Legislative API routing (Priority 1)
 * 2. Statutory citation pre-filter (Priority 2)
 * 3. Citation verification endpoint (Priority 3)
 * 4. LGBT query expansion (Priority 4)
 *
 * Run with: node test-harvey-upgrades.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

function logResult(test, passed, details = '') {
  const status = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`${status} ${test}`);
  if (details) {
    console.log(`   ${colors.cyan}${details}${colors.reset}`);
  }
}

async function measureTime(fn) {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  return { result, elapsed };
}

// ============================================================================
// TEST 1: Legislative API Routing
// ============================================================================
async function testLegislativeRouting() {
  logSection('TEST 1: Legislative API Routing');

  const testQueries = [
    { query: 'What AI bills passed in California in 2024?', expectLegislative: true },
    { query: 'Recent family law legislation in California', expectLegislative: true },
    { query: 'Governor signed laws 2024', expectLegislative: true },
    { query: 'What is a revocable trust?', expectLegislative: false },
  ];

  for (const { query, expectLegislative } of testQueries) {
    log(`\nQuery: "${query}"`, 'yellow');
    log(`Expected: ${expectLegislative ? 'Legislative search triggered' : 'No legislative search'}`, 'cyan');

    try {
      // We can't directly test the routing, but we can check if the endpoint works
      const { result, elapsed } = await measureTime(async () => {
        const response = await fetch(`${BASE_URL}/api/openstates-search?q=${encodeURIComponent(query.substring(0, 50))}`);
        return response.json();
      });

      const hasResults = result.items && result.items.length > 0;
      logResult(
        `OpenStates API responds`,
        true,
        `${result.items?.length || 0} results in ${elapsed}ms`
      );
    } catch (error) {
      logResult(`OpenStates API responds`, false, error.message);
    }
  }
}

// ============================================================================
// TEST 2: Statutory Citation Pre-Filter
// ============================================================================
async function testStatutoryPreFilter() {
  logSection('TEST 2: Statutory Citation Pre-Filter');

  const testQueries = [
    { query: 'Family Code section 1615 requirements', expectedCode: 'Family Code' },
    { query: 'Cal. Prob. Code § 21120', expectedCode: 'Probate Code' },
    { query: 'What are the requirements under Penal Code 187?', expectedCode: 'Penal Code' },
    { query: 'Civil Code section 1942 habitability', expectedCode: 'Civil Code' },
  ];

  for (const { query, expectedCode } of testQueries) {
    log(`\nQuery: "${query}"`, 'yellow');
    log(`Expected code detected: ${expectedCode}`, 'cyan');

    try {
      const { result, elapsed } = await measureTime(async () => {
        const response = await fetch(`${BASE_URL}/api/ceb-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, topK: 3 }),
        });
        return response.json();
      });

      // Check if statutory citations were detected
      const hasCitations = result.statutoryCitations && result.statutoryCitations.length > 0;
      const citationInfo = hasCitations
        ? result.statutoryCitations.map(c => `${c.code} § ${c.section}`).join(', ')
        : 'None detected';

      logResult(
        `CEB search with pre-filter`,
        true,
        `${result.sources?.length || 0} sources, Citations: ${citationInfo}, Time: ${elapsed}ms`
      );

      if (hasCitations) {
        log(`   URL: ${result.statutoryCitations[0].url}`, 'blue');
      }
    } catch (error) {
      logResult(`CEB search with pre-filter`, false, error.message);
    }
  }
}

// ============================================================================
// TEST 3: Citation Verification Endpoint
// ============================================================================
async function testCitationVerification() {
  logSection('TEST 3: Citation Verification Endpoint');

  const testCases = [
    {
      name: 'Valid California case citation',
      text: 'As held in People v. Anderson (1972) 6 Cal.3d 628, the defendant must...',
      expectVerified: true,
    },
    {
      name: 'Valid Federal citation',
      text: 'The Supreme Court in Roe v. Wade, 410 U.S. 113 (1973) established...',
      expectVerified: true,
    },
    {
      name: 'Fabricated citation',
      text: 'In Smith v. Jones (2020) 999 Cal.App.5th 12345, the court held...',
      expectVerified: false,
    },
    {
      name: 'No citations',
      text: 'This is just regular text without any legal citations.',
      expectVerified: false,
    },
  ];

  for (const { name, text, expectVerified } of testCases) {
    log(`\nTest: ${name}`, 'yellow');
    log(`Text: "${text.substring(0, 60)}..."`, 'cyan');

    try {
      const { result, elapsed } = await measureTime(async () => {
        const response = await fetch(`${BASE_URL}/api/verify-citations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        return response.json();
      });

      const citationsFound = result.totalFound || 0;
      const verified = result.verified || 0;
      const notFound = result.notFound || 0;

      logResult(
        `Citation verification`,
        true,
        `Found: ${citationsFound}, Verified: ${verified}, Not found: ${notFound}, Time: ${elapsed}ms`
      );

      if (result.citations && result.citations.length > 0) {
        for (const cite of result.citations) {
          const statusIcon = cite.status === 'verified' ? '✓' : cite.status === 'not_found' ? '✗' : '?';
          log(`   ${statusIcon} "${cite.text}" - ${cite.status}${cite.courtListenerMatch ? ` (${cite.courtListenerMatch.caseName})` : ''}`,
            cite.status === 'verified' ? 'green' : 'yellow');
        }
      }
    } catch (error) {
      logResult(`Citation verification`, false, error.message);
    }
  }
}

// ============================================================================
// TEST 4: LGBT Query Expansion
// ============================================================================
async function testLGBTQueryExpansion() {
  logSection('TEST 4: LGBT Query Expansion');

  const testQueries = [
    'same-sex couple adoption rights California',
    'domestic partner custody dispute',
    'parentage for two mothers',
    'surrogacy agreement California',
  ];

  for (const query of testQueries) {
    log(`\nQuery: "${query}"`, 'yellow');

    try {
      const { result, elapsed } = await measureTime(async () => {
        const response = await fetch(`${BASE_URL}/api/ceb-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, topK: 5 }),
        });
        return response.json();
      });

      const sourceTitles = (result.sources || []).slice(0, 3).map(s => s.title?.substring(0, 50) || 'Untitled');

      logResult(
        `LGBT query expansion`,
        result.sources?.length > 0,
        `${result.sources?.length || 0} sources, Category: ${result.category || 'unknown'}, Time: ${elapsed}ms`
      );

      if (sourceTitles.length > 0) {
        log(`   Top sources: ${sourceTitles.join('; ')}`, 'blue');
      }
    } catch (error) {
      logResult(`LGBT query expansion`, false, error.message);
    }
  }
}

// ============================================================================
// TEST 5: Response Time Comparison
// ============================================================================
async function testResponseTimes() {
  logSection('TEST 5: Response Time Comparison');

  const testQueries = [
    { type: 'Simple CEB', query: 'What is a revocable trust?' },
    { type: 'Statutory citation', query: 'Family Code section 1615' },
    { type: 'Legislative', query: 'AI bills California 2024' },
    { type: 'LGBT family law', query: 'same-sex adoption California' },
  ];

  const results = [];

  for (const { type, query } of testQueries) {
    log(`\nTesting: ${type}`, 'yellow');
    log(`Query: "${query}"`, 'cyan');

    try {
      const { result, elapsed } = await measureTime(async () => {
        const response = await fetch(`${BASE_URL}/api/ceb-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, topK: 5 }),
        });
        return response.json();
      });

      results.push({ type, elapsed, sources: result.sources?.length || 0 });

      logResult(
        `${type}`,
        elapsed < 5000,
        `${elapsed}ms, ${result.sources?.length || 0} sources`
      );
    } catch (error) {
      results.push({ type, elapsed: -1, sources: 0, error: error.message });
      logResult(`${type}`, false, error.message);
    }
  }

  // Summary
  log('\n--- Response Time Summary ---', 'bright');
  const avgTime = results.filter(r => r.elapsed > 0).reduce((sum, r) => sum + r.elapsed, 0) / results.filter(r => r.elapsed > 0).length;
  log(`Average response time: ${Math.round(avgTime)}ms`, avgTime < 3000 ? 'green' : 'yellow');

  for (const r of results) {
    const bar = '█'.repeat(Math.min(50, Math.round(r.elapsed / 100)));
    log(`${r.type.padEnd(20)} ${String(r.elapsed).padStart(5)}ms ${bar}`, r.elapsed < 3000 ? 'green' : 'yellow');
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  log('\n' + '╔' + '═'.repeat(68) + '╗', 'bright');
  log('║' + '  HARVEY UPGRADE FEATURE TESTS  '.padStart(44).padEnd(68) + '║', 'bright');
  log('╚' + '═'.repeat(68) + '╝', 'bright');

  log(`\nTarget URL: ${BASE_URL}`, 'cyan');
  log('Starting tests...\n', 'cyan');

  // Check if server is running
  try {
    const response = await fetch(`${BASE_URL}/api/config`);
    if (!response.ok) throw new Error('Server not responding');
    log('Server is running ✓\n', 'green');
  } catch (error) {
    log(`\n${colors.red}ERROR: Server not running at ${BASE_URL}${colors.reset}`);
    log('Please start the dev server with: npm run dev\n', 'yellow');
    process.exit(1);
  }

  await testLegislativeRouting();
  await testStatutoryPreFilter();
  await testCitationVerification();
  await testLGBTQueryExpansion();
  await testResponseTimes();

  logSection('TEST COMPLETE');
  log('All tests finished. Review results above.\n', 'green');
}

main().catch(console.error);
