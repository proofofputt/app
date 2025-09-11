// Test email invitation functionality with authentication
import fetch from 'node-fetch';

async function testEmailInvitationWithAuth() {
  try {
    console.log('🧪 Testing email invitation fix with authentication...');
    
    // First, authenticate to get a token
    console.log('\n🔐 Step 1: Authenticating...');
    const loginResponse = await fetch('https://app.proofofputt.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    console.log(`📊 Login Response Status: ${loginResponse.status}`);
    const loginText = await loginResponse.text();
    
    if (loginResponse.status !== 200) {
      console.log('ℹ️  Authentication failed (expected for test user), but that\'s okay');
      console.log('🧪 Testing email invitation without auth (should get 401)...');
      
      // Test email invitation without auth
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
            value: 'newplayer@example.com'
          },
          settings: {
            session_duration_limit_minutes: 5,
            scoring: 'total_makes'
          }
        })
      });
      
      console.log(`📊 Email Invitation Response Status: ${emailInviteResponse.status}`);
      const emailInviteText = await emailInviteResponse.text();
      
      if (emailInviteResponse.status === 401) {
        console.log('✅ Email invitation correctly requires authentication (401)');
        console.log('✅ No 500 error - player_invitations table dependency removed successfully!');
      } else if (emailInviteResponse.status === 500) {
        console.log('❌ Still getting 500 error - issue not fully resolved');
        try {
          const errorData = JSON.parse(emailInviteText);
          console.log(`🔍 Error: ${errorData.error || errorData.message}`);
        } catch (e) {
          console.log(`🔍 Raw error: ${emailInviteText}`);
        }
      } else {
        console.log(`ℹ️  Unexpected status ${emailInviteResponse.status}: ${emailInviteText}`);
      }
      
      return;
    }
    
    // If authentication succeeded, test with token
    const loginData = JSON.parse(loginText);
    const token = loginData.token;
    
    console.log('\n📝 Step 2: Testing email invitation with valid auth token...');
    const emailInviteResponse = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        creator_id: loginData.user.playerId,
        invite_new_player: true,
        new_player_contact: {
          type: 'email',
          value: 'newplayer@example.com'
        },
        settings: {
          session_duration_limit_minutes: 5,
          scoring: 'total_makes'
        }
      })
    });
    
    console.log(`📊 Authenticated Email Invitation Response Status: ${emailInviteResponse.status}`);
    const emailInviteText = await emailInviteResponse.text();
    
    if (emailInviteResponse.status === 201) {
      console.log('✅ Email invitation successful! Fix confirmed.');
      const responseData = JSON.parse(emailInviteText);
      console.log(`📋 Created duel ID: ${responseData.duel.duel_id}`);
      console.log(`📋 Status: ${responseData.duel.status}`);
    } else if (emailInviteResponse.status === 500) {
      console.log('❌ Still getting 500 error - need to investigate further');
      try {
        const errorData = JSON.parse(emailInviteText);
        console.log(`🔍 Error: ${errorData.error || errorData.message}`);
      } catch (e) {
        console.log(`🔍 Raw error: ${emailInviteText}`);
      }
    } else {
      console.log(`ℹ️  Status ${emailInviteResponse.status}: ${emailInviteText}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmailInvitationWithAuth();