// Test script to verify active-competitions API fix
import fetch from 'node-fetch';

async function testActiveCompetitions() {
  try {
    console.log('🧪 Testing active-competitions API fix...');
    
    // Test without auth (should get 401)
    const response = await fetch('https://app.proofofputt.com/api/active-competitions?player_id=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    const responseText = await response.text();
    console.log(`📋 Response: ${responseText}`);
    
    if (response.status === 401) {
      console.log('✅ Active-competitions API correctly requires authentication');
    } else if (response.status === 500) {
      console.log('❌ Still getting 500 error - needs investigation');
    } else {
      console.log(`ℹ️  Got status ${response.status} - checking if this is expected`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testActiveCompetitions();