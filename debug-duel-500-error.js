// Script to debug the 500 error in duels API
import fetch from 'node-fetch';

async function debugDuelError() {
  try {
    console.log('🔍 Testing duels API without auth (should get 401)...');
    
    const testData = {
      creator_id: 1,
      invited_player_id: 2,
      settings: {
        session_duration_limit_minutes: 5,
        scoring: 'total_makes'
      }
    };
    
    const response = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 Response status:', response.status);
    const responseText = await response.text();
    console.log('📋 Response:', responseText);
    
    if (response.status === 401) {
      console.log('✅ Expected 401 - API is working correctly');
    } else if (response.status === 500) {
      console.log('❌ 500 error detected - there may be a server-side issue');
      
      // Try with email invitation to see if that's the issue
      console.log('\n🔍 Testing with email invitation...');
      
      const emailTestData = {
        creator_id: 1,
        invite_new_player: true,
        new_player_contact: {
          type: 'email',
          value: 'test@example.com'
        },
        settings: {
          session_duration_limit_minutes: 5,
          scoring: 'total_makes'
        }
      };
      
      const emailResponse = await fetch('https://app.proofofputt.com/api/duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailTestData)
      });
      
      console.log('📊 Email invitation response status:', emailResponse.status);
      const emailResponseText = await emailResponse.text();
      console.log('📋 Email invitation response:', emailResponseText);
      
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

debugDuelError();