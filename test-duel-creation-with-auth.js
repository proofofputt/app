// Test script to debug duel creation with proper authentication
import fetch from 'node-fetch';

async function testDuelCreation() {
  try {
    console.log('🧪 Testing duel creation endpoint...');
    
    // First, try to get a valid JWT token by testing login
    console.log('📝 Step 1: Testing authentication workflow...');
    
    // Test creating a duel without authentication (should get 401)
    console.log('📝 Step 2: Testing duel creation without auth...');
    const noAuthResponse = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creator_id: 1,
        invited_player_id: 2,
        settings: {
          session_duration_limit_minutes: 5,
          scoring: 'total_makes'
        }
      })
    });
    
    console.log(`📊 No Auth Response Status: ${noAuthResponse.status}`);
    const noAuthText = await noAuthResponse.text();
    console.log(`📋 No Auth Response: ${noAuthText}`);
    
    // Test creating a duel with email invitation (no auth)
    console.log('📝 Step 3: Testing email invitation duel creation...');
    const emailInviteResponse = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });
    
    console.log(`📊 Email Invite Response Status: ${emailInviteResponse.status}`);
    const emailInviteText = await emailInviteResponse.text();
    console.log(`📋 Email Invite Response: ${emailInviteText}`);
    
    if (emailInviteResponse.status === 500) {
      console.log('❌ Found the 500 error - it is in duel creation with email invitations!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDuelCreation();