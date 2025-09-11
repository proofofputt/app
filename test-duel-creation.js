// Script to test duel creation API
import fetch from 'node-fetch';

async function testDuelCreation() {
  try {
    console.log('🧪 Testing duel creation API...');
    
    // First, let's test with a mock JWT token to see if the API accepts the request structure
    const testDuelData = {
      creator_id: 1,  // Pop
      invited_player_id: 2,  // Demo User
      settings: {
        session_duration_limit_minutes: 5,
        invitation_expiry_minutes: 4320,
        scoring: 'total_makes'
      },
      rules: {
        number_of_attempts: 50
      }
    };
    
    console.log('📝 Duel data to send:', testDuelData);
    
    // Test against the correct API URL (web app runs on different port than API)
    const apiUrl = 'https://app.proofofputt.com/api/duels';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testDuelData)
    });
    
    console.log('📊 Response status:', response.status);
    const responseData = await response.text();
    console.log('📋 Response data:', responseData);
    
    // Now test the GET endpoint to see if it can read our existing duel
    console.log('\n🔍 Testing GET duels endpoint...');
    const getResponse = await fetch(`${apiUrl}?player_id=1`);
    console.log('📊 GET Response status:', getResponse.status);
    const getDuels = await getResponse.text();
    console.log('📋 GET Response data:', getDuels);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDuelCreation();