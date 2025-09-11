// Script to test active competitions API
import fetch from 'node-fetch';

async function testActiveCompetitions() {
  try {
    console.log('🎯 Testing active competitions API...');
    
    // Test the endpoint with player_id=1 (Pop)
    const apiUrl = 'https://app.proofofputt.com/api/active-competitions?player_id=1';
    
    const response = await fetch(apiUrl);
    console.log('📊 Response status:', response.status);
    
    const responseData = await response.json();
    console.log('📋 Response data:', JSON.stringify(responseData, null, 2));
    
    if (responseData.success && responseData.data) {
      console.log('\n🏆 Competition Summary:');
      console.log(`   Duels: ${responseData.data.duels?.length || 0}`);
      console.log(`   Leagues: ${responseData.data.leagues?.length || 0}`);
      console.log(`   Total Active: ${responseData.data.totalActive || 0}`);
      
      if (responseData.data.duels?.length > 0) {
        console.log('\n🥊 Active Duels:');
        responseData.data.duels.forEach((duel, index) => {
          console.log(`   ${index + 1}. vs ${duel.opponent}`);
          console.log(`      Time Limit: ${duel.timeLimit ? `${duel.timeLimit}s` : 'None'}`);
          console.log(`      Expires: ${duel.expiresAt || 'No date'}`);
          console.log(`      Role: ${duel.playerRole}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testActiveCompetitions();