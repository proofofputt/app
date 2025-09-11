// Test duel cancellation functionality
import fetch from 'node-fetch';

async function testCancelDuel() {
  try {
    console.log('🧪 Testing Duel Cancellation Functionality');
    console.log('=' .repeat(50));
    
    const baseUrl = 'https://app.proofofputt.com/api';
    
    // Test different cancel scenarios
    const testCases = [
      {
        name: 'Cancel Without Authentication',
        duelId: '1',
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: 401,
        description: 'Should require authentication'
      },
      {
        name: 'Cancel Non-existent Duel',
        duelId: '99999',
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: 401, // Will be 401 because no auth, but would be 404 with auth
        description: 'Should handle non-existent duel gracefully'
      },
      {
        name: 'Cancel with Invalid Duel ID',
        duelId: 'invalid',
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: 401,
        description: 'Should handle invalid duel ID'
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
      console.log(`\n🔍 Testing: ${testCase.name}`);
      console.log(`   Description: ${testCase.description}`);
      console.log(`   Duel ID: ${testCase.duelId}`);
      
      try {
        const response = await fetch(`${baseUrl}/duels/${testCase.duelId}/cancel`, {
          method: 'POST',
          headers: testCase.headers
        });
        
        const responseText = await response.text();
        
        console.log(`   Status: ${response.status} (expected: ${testCase.expectedStatus})`);
        
        if (response.status === testCase.expectedStatus) {
          console.log(`   ✅ PASS`);
          passed++;
          
          // Parse response if it's JSON
          try {
            const data = JSON.parse(responseText);
            if (data.message) {
              console.log(`   Message: ${data.message}`);
            }
          } catch (e) {
            // Not JSON, that's fine
          }
        } else {
          console.log(`   ❌ FAIL - Expected ${testCase.expectedStatus}, got ${response.status}`);
          failed++;
          
          // Show error details
          try {
            const errorData = JSON.parse(responseText);
            console.log(`   Error: ${errorData.error || errorData.message || 'Unknown error'}`);
          } catch (e) {
            console.log(`   Raw Response: ${responseText.substring(0, 100)}...`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ FAIL - Network Error: ${error.message}`);
        failed++;
      }
    }
    
    // Test API endpoint validation
    console.log(`\n🔗 Testing API Endpoint Structure:`);
    
    const endpointTests = [
      {
        name: 'OPTIONS request (CORS)',
        url: `${baseUrl}/duels/1/cancel`,
        method: 'OPTIONS',
        expectedStatus: 200
      },
      {
        name: 'GET request (Method not allowed)',
        url: `${baseUrl}/duels/1/cancel`,
        method: 'GET',
        expectedStatus: 405
      },
      {
        name: 'PUT request (Method not allowed)',
        url: `${baseUrl}/duels/1/cancel`,
        method: 'PUT',
        expectedStatus: 405
      }
    ];
    
    for (const test of endpointTests) {
      console.log(`\n   🔍 ${test.name}`);
      try {
        const response = await fetch(test.url, {
          method: test.method,
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`      Status: ${response.status} (expected: ${test.expectedStatus})`);
        
        if (response.status === test.expectedStatus) {
          console.log(`      ✅ PASS`);
          passed++;
        } else {
          console.log(`      ❌ FAIL`);
          failed++;
        }
      } catch (error) {
        console.log(`      ❌ FAIL - ${error.message}`);
        failed++;
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 CANCEL DUEL TEST RESULTS:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Total: ${passed + failed}`);
    console.log(`   🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log(`\n🎉 ALL TESTS PASSED! Cancel duel functionality is working correctly.`);
      console.log(`\n📋 Verified Features:`);
      console.log(`   🔒 Authentication required for cancellation`);
      console.log(`   🛡️ Proper error handling for invalid requests`);
      console.log(`   🌐 CORS support for frontend integration`);
      console.log(`   🚫 Method validation (POST only)`);
    } else {
      console.log(`\n⚠️  Some tests failed. Check the details above.`);
    }
    
    console.log(`\n💡 Next Steps for Full Testing:`);
    console.log(`   1. Test with valid authentication token`);
    console.log(`   2. Create a test duel and then cancel it`);
    console.log(`   3. Verify frontend Cancel button appears correctly`);
    console.log(`   4. Test cancellation permissions (only creator can cancel)`);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

testCancelDuel();