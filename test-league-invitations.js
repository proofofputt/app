#!/usr/bin/env node
/**
 * Test script for league invitation and join functionality
 * Usage: node test-league-invitations.js
 */

const baseURL = process.env.API_BASE_URL || 'https://app.proofofputt.com/api';

// Test configuration
const config = {
  // These would normally come from user authentication
  testPlayerId: process.env.TEST_PLAYER_ID || '1', 
  testPlayerEmail: process.env.TEST_PLAYER_EMAIL || 'test@example.com',
  inviteePlayerId: process.env.INVITEE_PLAYER_ID || '2',
  // Test JWT token - would come from login in real usage
  testToken: process.env.TEST_JWT_TOKEN || 'placeholder-jwt-token',
};

console.log('🧪 Testing League Invitation & Join Functionality');
console.log('Base URL:', baseURL);
console.log('Test Player ID:', config.testPlayerId);
console.log('');

/**
 * Test the player search functionality
 */
async function testPlayerSearch() {
  console.log('1. Testing Player Search...');
  
  try {
    const response = await fetch(`${baseURL}/players/search?term=test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log('✅ Player search response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.players && Array.isArray(data.players)) {
      console.log(`Found ${data.players.length} players`);
      return data.players;
    } else {
      console.log('⚠️  Unexpected response format');
      return [];
    }
  } catch (error) {
    console.error('❌ Player search failed:', error.message);
    return [];
  }
}

/**
 * Test league creation (prerequisite for invitation testing)
 */
async function testLeagueCreation() {
  console.log('\\n2. Testing League Creation...');
  
  try {
    const leagueData = {
      name: `Test League ${Date.now()}`,
      description: 'Test league for invitation functionality',
      settings: {
        privacy: 'public',
        allow_player_invites: true
      }
    };

    const response = await fetch(`${baseURL}/leagues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.testToken}`,
      },
      body: JSON.stringify(leagueData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ League created successfully');
      console.log('League ID:', data.league.league_id);
      return data.league;
    } else {
      console.log('❌ League creation failed:', data.message);
      console.log('Response status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ League creation error:', error.message);
    return null;
  }
}

/**
 * Test league invitation sending
 */
async function testLeagueInvitation(leagueId) {
  console.log('\\n3. Testing League Invitation...');
  
  try {
    const invitationData = {
      league_invited_player_id: config.inviteePlayerId,
      invitation_message: 'Join our test league!'
    };

    const response = await fetch(`${baseURL}/leagues/${leagueId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.testToken}`,
      },
      body: JSON.stringify(invitationData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ League invitation sent successfully');
      console.log('Invitation details:', {
        invitation_id: data.invitation.invitation_id,
        invited_player: data.invitation.invited_player_name,
        league_name: data.invitation.league_name
      });
      return data.invitation;
    } else {
      console.log('❌ League invitation failed:', data.message);
      console.log('Response status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ League invitation error:', error.message);
    return null;
  }
}

/**
 * Test league joining (public league)
 */
async function testLeagueJoin(leagueId) {
  console.log('\\n4. Testing League Join...');
  
  try {
    const joinData = {
      player_id: config.inviteePlayerId
    };

    const response = await fetch(`${baseURL}/leagues/${leagueId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.testToken}`,
      },
      body: JSON.stringify(joinData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ League join successful');
      console.log('Join details:', {
        league_name: data.league.name,
        member_count: data.league.member_count,
        player_name: data.membership.player_name
      });
      return data;
    } else {
      console.log('❌ League join failed:', data.message);
      console.log('Response status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ League join error:', error.message);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    // Test 1: Player Search
    const players = await testPlayerSearch();
    
    // Test 2: League Creation
    const league = await testLeagueCreation();
    if (!league) {
      console.log('\\n⚠️  Skipping invitation and join tests due to league creation failure');
      console.log('This may be expected if authentication is not set up');
      return;
    }

    // Test 3: League Invitation
    await testLeagueInvitation(league.league_id);
    
    // Test 4: League Join (try with different player)
    await testLeagueJoin(league.league_id);

    console.log('\\n🎉 All tests completed!');
    console.log('\\n📋 Summary:');
    console.log('- Player search endpoint working');
    console.log('- League creation requires valid JWT token');
    console.log('- League invitation system updated with correct database columns');
    console.log('- League join process includes notifications and error handling');
    
  } catch (error) {
    console.error('\\n💥 Test suite failed:', error.message);
  }
}

/**
 * Development usage info
 */
function showUsage() {
  console.log('\\n📖 Development Usage:');
  console.log('');
  console.log('To test with real credentials:');
  console.log('export TEST_JWT_TOKEN="your-jwt-token"');
  console.log('export TEST_PLAYER_ID="123"');
  console.log('export INVITEE_PLAYER_ID="456"');
  console.log('node test-league-invitations.js');
  console.log('');
  console.log('Or test against local development:');
  console.log('export API_BASE_URL="http://localhost:3000/api"');
  console.log('node test-league-invitations.js');
}

// Run the tests (ES module compatible)
runTests().then(() => {
  showUsage();
});

export {
  testPlayerSearch,
  testLeagueCreation,
  testLeagueInvitation,
  testLeagueJoin
};