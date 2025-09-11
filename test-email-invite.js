// Script to test email invitation functionality
import fetch from 'node-fetch';

async function testEmailInvite() {
  try {
    console.log('📧 Testing email invitation functionality...');
    
    // Test creating a duel with email invitation
    const testDuelData = {
      creator_id: 1,  // Pop
      invite_new_player: true,
      new_player_contact: {
        type: 'email',
        value: 'test@example.com'
      },
      settings: {
        session_duration_limit_minutes: 5,
        invitation_expiry_minutes: 4320,
        scoring: 'total_makes'
      },
      rules: {
        number_of_attempts: 50
      }
    };
    
    console.log('📝 Email invite data to send:', testDuelData);
    
    // Test without auth first to see if the structure is correct
    const response = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testDuelData)
    });
    
    console.log('📊 Response status:', response.status);
    const responseData = await response.text();
    console.log('📋 Response data:', responseData);
    
    if (response.status === 401) {
      console.log('✅ Expected 401 - authentication is working correctly');
      console.log('💡 When a logged-in user tries this, it should work without the 500 error');
    } else if (response.status === 500) {
      console.log('❌ Still getting 500 error - there may be another issue');
    } else {
      console.log('🎉 Unexpected response - invitation might be working!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmailInvite();