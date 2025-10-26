/**
=============================================================================
TEST SCRIPT: CourtListener API Key Validation
=============================================================================

DESCRIPTION:
This script tests the CourtListener API key by making a simple search request.

USAGE:
node test-courtlistener-api.js

NOTES:
- Requires COURTLISTENER_API_KEY environment variable
- Makes a test query to verify API connectivity
=============================================================================
*/

import 'dotenv/config';
const API_KEY = process.env.COURTLISTENER_API_KEY;

async function testCourtListenerAPI() {
    if (!API_KEY) {
        console.error('❌ COURTLISTENER_API_KEY environment variable is not set');
        process.exit(1);
    }

    console.log('🔍 Testing CourtListener API key...');

    // Simple test query
    const testQuery = 'People v. Anderson';
    const endpoint = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(testQuery)}&type=o&order_by=score%20desc&stat_Precedential=on`;

    try {
        console.log('📡 Making API request...');

        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Token ${API_KEY}`,
                'User-Agent': 'California-Law-Chatbot-Test/1.0'
            },
        });

        console.log(`📊 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API request failed:');
            console.error(`   Status: ${response.status} ${response.statusText}`);
            console.error(`   Response: ${errorText}`);

            if (response.status === 401) {
                console.error('💡 This usually means the API key is invalid or expired');
            } else if (response.status === 403) {
                console.error('💡 This usually means the API key lacks proper permissions');
            }

            process.exit(1);
        }

        const data = await response.json();

        console.log('✅ API key is valid!');
        console.log(`📈 Found ${data.count || 0} total results`);
        console.log(`📄 Returned ${data.results?.length || 0} results in this response`);

        if (data.results && data.results.length > 0) {
            console.log('\n📋 Sample result:');
            const firstResult = data.results[0];
            console.log(`   Case: ${firstResult.caseName || firstResult.case_name || 'N/A'}`);
            console.log(`   Citation: ${firstResult.citation?.[0] || firstResult.citations?.[0] || 'N/A'}`);
            console.log(`   Date: ${firstResult.dateFiled || firstResult.date_filed || 'N/A'}`);
            console.log(`   Snippet: ${firstResult.snippet || 'No snippet available'}`);
            console.log(`   Available fields: ${Object.keys(firstResult).join(', ')}`);
        }

        console.log('\n🎉 CourtListener API key test completed successfully!');

    } catch (error) {
        console.error('❌ Network or unexpected error:');
        console.error(error.message);
        process.exit(1);
    }
}

// Run the test
testCourtListenerAPI();
