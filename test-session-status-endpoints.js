// Test script for session-status API endpoints
import fetch from 'node-fetch';

async function testSessionStatusEndpoints() {
  try {
    console.log('🧪 Testing session-status API endpoints...');
    
    // Test 1: General session-status endpoint
    console.log('\n📝 Test 1: General session-status endpoint...');
    const generalResponse = await fetch('https://app.proofofputt.com/api/session-status?player_id=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 General session-status Response Status: ${generalResponse.status}`);
    const generalText = await generalResponse.text();
    console.log(`📋 Response (first 200 chars): ${generalText.substring(0, 200)}...`);
    
    if (generalResponse.status === 200) {
      console.log('✅ General session-status endpoint working correctly');
    } else if (generalResponse.status === 500) {
      console.log('❌ 500 error in general session-status - needs investigation');
      try {
        const errorData = JSON.parse(generalText);
        console.log(`🔍 Error: ${errorData.error || errorData.message}`);
      } catch (e) {
        console.log('🔍 Could not parse error response');
      }
    }
    
    // Test 2: Specific duel session-status endpoint
    console.log('\n📝 Test 2: Specific duel session-status endpoint...');
    const specificResponse = await fetch('https://app.proofofputt.com/api/duels/10/session-status?player_id=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Specific duel session-status Response Status: ${specificResponse.status}`);
    const specificText = await specificResponse.text();
    console.log(`📋 Response (first 200 chars): ${specificText.substring(0, 200)}...`);
    
    if (specificResponse.status === 200) {
      console.log('✅ Specific duel session-status endpoint working correctly');
    } else if (specificResponse.status === 500) {
      console.log('❌ 500 error in specific duel session-status - needs investigation');
      try {
        const errorData = JSON.parse(specificText);
        console.log(`🔍 Error: ${errorData.error || errorData.message}`);
      } catch (e) {
        console.log('🔍 Could not parse error response');
      }
    } else if (specificResponse.status === 401) {
      console.log('ℹ️  401 - Authentication required (expected for authenticated endpoint)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSessionStatusEndpoints();