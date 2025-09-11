// Comprehensive test of all main API endpoints
import fetch from 'node-fetch';

async function testAllEndpoints() {
  console.log('🧪 COMPREHENSIVE API TESTING - ALL ENDPOINTS');
  console.log('=' .repeat(60));
  
  const baseUrl = 'https://app.proofofputt.com/api';
  const testPlayerId = 1;
  
  const endpoints = [
    {
      name: 'Duels GET',
      url: `${baseUrl}/duels?player_id=${testPlayerId}`,
      method: 'GET',
      expectedStatus: 200,
      description: 'Retrieve user duels'
    },
    {
      name: 'Duels POST (no auth)',
      url: `${baseUrl}/duels`,
      method: 'POST',
      body: {
        creator_id: 1,
        invited_player_id: 2,
        settings: { time_limit_minutes: 5 }
      },
      expectedStatus: 401,
      description: 'Create duel (should require auth)'
    },
    {
      name: 'Active Competitions',
      url: `${baseUrl}/active-competitions?player_id=${testPlayerId}`,
      method: 'GET',
      expectedStatus: 200,
      description: 'Get active competitions'
    },
    {
      name: 'Leagues GET',
      url: `${baseUrl}/leagues?player_id=${testPlayerId}`,
      method: 'GET',
      expectedStatus: 200,
      description: 'Retrieve user leagues'
    },
    {
      name: 'Leagues POST (no auth)',
      url: `${baseUrl}/leagues`,
      method: 'POST',
      body: {
        name: 'Test League',
        settings: { privacy: 'public' }
      },
      expectedStatus: 401,
      description: 'Create league (should require auth)'
    },
    {
      name: 'Session Status (no auth)',
      url: `${baseUrl}/session-status?player_id=${testPlayerId}`,
      method: 'GET',
      expectedStatus: 401,
      description: 'Get session status (should require auth)'
    },
    {
      name: 'Player Data',
      url: `${baseUrl}/player/${testPlayerId}/data`,
      method: 'GET',
      expectedStatus: [200, 404], // May not exist
      description: 'Get player data'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testing: ${endpoint.name}`);
      console.log(`   ${endpoint.method} ${endpoint.url}`);
      console.log(`   Expected: ${Array.isArray(endpoint.expectedStatus) ? endpoint.expectedStatus.join(' or ') : endpoint.expectedStatus}`);
      
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await fetch(endpoint.url, options);
      const responseText = await response.text();
      
      console.log(`   Actual: ${response.status}`);
      
      const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];
      
      if (expectedStatuses.includes(response.status)) {
        console.log(`   ✅ PASS - ${endpoint.description}`);
        passed++;
        
        // Show sample data for successful responses
        if (response.status === 200 && responseText) {
          try {
            const data = JSON.parse(responseText);
            if (data.duels) {
              console.log(`      📊 Data: Found ${data.duels.length} duels`);
            } else if (data.data && data.data.duels) {
              console.log(`      📊 Data: Found ${data.data.duels.length} active duels`);
            } else if (data.my_leagues !== undefined) {
              console.log(`      📊 Data: Found ${data.my_leagues.length} member leagues, ${data.public_leagues.length} public leagues`);
            } else {
              console.log(`      📊 Data: Valid response structure`);
            }
          } catch (e) {
            console.log(`      📊 Data: Response received (${responseText.length} chars)`);
          }
        }
        
      } else {
        console.log(`   ❌ FAIL - Expected ${expectedStatuses.join(' or ')}, got ${response.status}`);
        failed++;
        
        // Show error details for failures
        if (response.status >= 400) {
          try {
            const errorData = JSON.parse(responseText);
            console.log(`      🔍 Error: ${errorData.error || errorData.message || 'Unknown error'}`);
          } catch (e) {
            console.log(`      🔍 Error: ${responseText.substring(0, 100)}...`);
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ FAIL - Network/Request Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 COMPREHENSIVE TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total: ${passed + failed}`);
  console.log(`   🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log(`\n🎉 ALL TESTS PASSED! The API is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the details above for issues.`);
  }
}

testAllEndpoints();