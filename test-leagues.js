// Script to test leagues API
import fetch from 'node-fetch';

async function testLeagues() {
  try {
    console.log('🏟️ Testing leagues API...');
    
    // Test GET leagues endpoint
    const getUrl = 'https://app.proofofputt.com/api/leagues?player_id=1';
    
    const getResponse = await fetch(getUrl);
    console.log('📊 GET Response status:', getResponse.status);
    
    const getResponseData = await getResponse.json();
    console.log('📋 GET Response data:', JSON.stringify(getResponseData, null, 2));
    
    // Test POST leagues endpoint (should require auth)
    console.log('\n🏟️ Testing POST leagues endpoint...');
    const postUrl = 'https://app.proofofputt.com/api/leagues';
    
    const testLeagueData = {
      name: 'Test League',
      description: 'A test league for API testing',
      settings: {
        privacy: 'public',
        num_rounds: 4,
        round_duration_hours: 168,
        time_limit_minutes: 30
      }
    };
    
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testLeagueData)
    });
    
    console.log('📊 POST Response status:', postResponse.status);
    const postResponseData = await postResponse.text();
    console.log('📋 POST Response data:', postResponseData);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLeagues();