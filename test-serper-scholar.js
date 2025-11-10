/**
 * Test Serper Google Scholar API
 */

const SERPER_API_KEY = '60a73f2f2705ebb5279cbf35320de647d91d0432';

async function testGoogleScholar(query) {
    console.log(`\n🔍 Testing Google Scholar search for: "${query}"\n`);
    
    try {
        const response = await fetch('https://google.serper.dev/scholar', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: 'us',
                hl: 'en',
                num: 20
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ API Response received!\n');
        console.log('📊 Results Summary:');
        console.log(`   - Total results: ${data.organic?.length || 0}`);
        console.log(`   - Search time: ${data.searchParameters?.time || 'N/A'}ms\n`);
        
        if (data.organic && data.organic.length > 0) {
            console.log('📚 Top 10 Cases Found:\n');
            data.organic.slice(0, 10).forEach((result, index) => {
                console.log(`${index + 1}. ${result.title}`);
                console.log(`   Citation: ${result.snippet || 'N/A'}`);
                console.log(`   Link: ${result.link}`);
                console.log('');
            });
            
            return {
                success: true,
                count: data.organic.length,
                results: data.organic
            };
        } else {
            console.log('⚠️  No results found');
            return { success: false, count: 0, results: [] };
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 SERPER GOOGLE SCHOLAR API TEST');
    console.log('═══════════════════════════════════════════════════════');
    
    const test1 = await testGoogleScholar('trust modification California 2024');
    
    console.log('\n───────────────────────────────────────────────────────\n');
    const test2 = await testGoogleScholar('Haggerty v. Thornton California Supreme Court');
    
    console.log('\n───────────────────────────────────────────────────────\n');
    const test3 = await testGoogleScholar('California Probate Code 15402');
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Test 1 (Trust modification): ${test1.success ? '✅ PASSED' : '❌ FAILED'} - ${test1.count || 0} results`);
    console.log(`Test 2 (Specific case): ${test2.success ? '✅ PASSED' : '❌ FAILED'} - ${test2.count || 0} results`);
    console.log(`Test 3 (Code section): ${test3.success ? '✅ PASSED' : '❌ FAILED'} - ${test3.count || 0} results`);
    
    if (test1.success && test2.success && test3.success) {
        console.log('\n✅ ALL TESTS PASSED! Ready to integrate.');
    }
    console.log('\n═══════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
