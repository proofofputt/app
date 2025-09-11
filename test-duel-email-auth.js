// Script to test duel creation with email invitation with proper auth
import fetch from 'node-fetch';

async function testDuelWithAuth() {
  try {
    console.log('🔐 First, logging in to get auth token...');
    
    // Login to get auth token
    const loginResponse = await fetch('https://app.proofofputt.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'pop@proofofputt.com',
        password: 'proofofputt'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status);
      const loginError = await loginResponse.text();
      console.log('Login error:', loginError);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful, player ID:', loginData.player.player_id);
    
    const authToken = loginData.token;
    
    // Test creating a duel with email invitation
    console.log('📧 Testing duel creation with email invitation...');
    
    const testDuelData = {
      creator_id: loginData.player.player_id,
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
    
    console.log('📝 Creating duel with data:', testDuelData);
    
    const duelResponse = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(testDuelData)
    });
    
    console.log('📊 Duel creation response status:', duelResponse.status);
    const duelResponseData = await duelResponse.text();
    console.log('📋 Response data:', duelResponseData);
    
    if (duelResponse.status === 201) {
      console.log('🎉 Duel with email invitation created successfully!');
    } else {
      console.log('❌ Duel creation failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDuelWithAuth();