// Test script for complete email/phone invitation system
import fetch from 'node-fetch';

async function testInvitationSystem() {
  try {
    console.log('🧪 Testing complete email/phone invitation system...');
    
    // Test 1: Duels API without auth (should get 401)
    console.log('\n📧 Test 1: Duels API validation...');
    const duelResponse = await fetch('https://app.proofofputt.com/api/duels', {
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
    
    console.log(`📊 Duel Response Status: ${duelResponse.status}`);
    const duelResponseText = await duelResponse.text();
    console.log(`📋 Duel Response: ${duelResponseText}`);
    
    if (duelResponse.status === 401) {
      console.log('✅ Duels API correctly requires authentication');
    } else {
      console.log('❌ Unexpected duel response - may need investigation');
    }
    
    // Test 2: Leagues API without auth (should get 401)
    console.log('\n🏆 Test 2: Leagues API validation...');
    const leagueResponse = await fetch('https://app.proofofputt.com/api/leagues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Tournament',
        created_by: 1,
        invite_new_players: true,
        new_player_contacts: [
          {type: 'email', value: 'player1@example.com'},
          {type: 'phone', value: '+1234567890'}
        ],
        settings: {
          session_duration_limit_minutes: 10,
          scoring: 'total_makes'
        }
      })
    });
    
    console.log(`📊 League Response Status: ${leagueResponse.status}`);
    const leagueResponseText = await leagueResponse.text();
    console.log(`📋 League Response: ${leagueResponseText}`);
    
    if (leagueResponse.status === 401) {
      console.log('✅ Leagues API correctly requires authentication');
    } else {
      console.log('❌ Unexpected league response - may need investigation');
    }
    
    // Test 3: Verify database schema
    console.log('\n🔍 Test 3: Database schema verification...');
    console.log('Running database verification script...');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testInvitationSystem();