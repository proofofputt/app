// Script to test league creation with email invitations
import fetch from 'node-fetch';

async function testLeagueEmailInvites() {
  try {
    console.log('🔐 First, logging in to get auth token...');
    
    // Login to get auth token (using test credentials)
    const loginResponse = await fetch('https://app.proofofputt.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com', // Replace with valid test credentials
        password: 'testpassword'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status);
      const loginError = await loginResponse.text();
      console.log('Login error:', loginError);
      
      // Test without auth to see validation
      console.log('📧 Testing league creation without auth...');
      
      const testLeagueData = {
        name: 'Test Email League',
        description: 'Testing email invitations for leagues',
        invite_new_players: true,
        new_player_contacts: [
          {
            type: 'email',
            value: 'test1@example.com'
          },
          {
            type: 'email', 
            value: 'test2@example.com'
          },
          {
            type: 'phone',
            value: '+1234567890'
          }
        ],
        settings: {
          privacy: 'private',
          num_rounds: 3,
          time_limit_minutes: 15,
          scoring_type: 'total_makes'
        }
      };
      
      console.log('📝 League data with email invites:', JSON.stringify(testLeagueData, null, 2));
      
      const leagueResponse = await fetch('https://app.proofofputt.com/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testLeagueData)
      });
      
      console.log('📊 League creation response status:', leagueResponse.status);
      const leagueResponseData = await leagueResponse.text();
      console.log('📋 Response data:', leagueResponseData);
      
      if (leagueResponse.status === 401) {
        console.log('✅ Expected 401 - authentication is working correctly');
        console.log('💡 When a logged-in user tries this, it should create the league and invitations');
      } else if (leagueResponse.status === 500) {
        console.log('❌ Still getting 500 error - there may be another issue');
      } else {
        console.log('🎉 Unexpected response - league might be working!');
      }
      
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful, player ID:', loginData.player.player_id);
    
    const authToken = loginData.token;
    
    // Test creating a league with email invitations
    console.log('📧 Testing league creation with email invitations...');
    
    const testLeagueData = {
      name: 'Test Email League',
      description: 'Testing email invitations for leagues',
      invite_new_players: true,
      new_player_contacts: [
        {
          type: 'email',
          value: 'test1@example.com'
        },
        {
          type: 'email', 
          value: 'test2@example.com'
        },
        {
          type: 'phone',
          value: '+1234567890'
        }
      ],
      settings: {
        privacy: 'private',
        num_rounds: 3,
        time_limit_minutes: 15,
        scoring_type: 'total_makes'
      }
    };
    
    console.log('📝 Creating league with email invites:', JSON.stringify(testLeagueData, null, 2));
    
    const leagueResponse = await fetch('https://app.proofofputt.com/api/leagues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(testLeagueData)
    });
    
    console.log('📊 League creation response status:', leagueResponse.status);
    const leagueResponseData = await leagueResponse.text();
    console.log('📋 Response data:', leagueResponseData);
    
    if (leagueResponse.status === 201) {
      console.log('🎉 League with email invitations created successfully!');
      
      const responseJson = JSON.parse(leagueResponseData);
      if (responseJson.league.new_player_invitations) {
        console.log(`✅ Created ${responseJson.league.new_player_invitations.length} email/phone invitations`);
        responseJson.league.new_player_invitations.forEach((invite, index) => {
          console.log(`   ${index + 1}. ${invite.contact_type}: ${invite.contact_value} (${invite.status})`);
        });
      }
    } else {
      console.log('❌ League creation failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLeagueEmailInvites();