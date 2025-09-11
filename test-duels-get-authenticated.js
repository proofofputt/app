// Test script to debug duels GET endpoint with authentication simulation
import fetch from 'node-fetch';

async function testDuelsGet() {
  try {
    console.log('🧪 Testing duels GET endpoint...');
    
    // Test GET request to duels API with player_id (simulating frontend request)
    const response = await fetch('https://app.proofofputt.com/api/duels?player_id=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    const responseText = await response.text();
    console.log(`📋 Response: ${responseText}`);
    
    if (response.status === 500) {
      console.log('❌ 500 error detected - duels GET endpoint has issues');
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          console.log(`🔍 Error details: ${errorData.error}`);
        }
      } catch (parseError) {
        console.log('🔍 Could not parse error response');
      }
    } else if (response.status === 200) {
      console.log('✅ Duels GET endpoint working correctly');
      
      // Parse and show summary of response
      try {
        const data = JSON.parse(responseText);
        if (data.duels) {
          console.log(`📊 Found ${data.duels.length} duels`);
        }
      } catch (parseError) {
        console.log('🔍 Could not parse success response');
      }
    } else {
      console.log(`ℹ️  Got status ${response.status} - investigating...`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDuelsGet();