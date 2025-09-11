// Comprehensive test script for leagues API
import fetch from 'node-fetch';

async function testLeaguesAPI() {
  try {
    console.log('🧪 Testing leagues API comprehensively...');
    
    // Test 1: Leagues GET endpoint
    console.log('\n📝 Test 1: Leagues GET endpoint...');
    const getResponse = await fetch('https://app.proofofputt.com/api/leagues?player_id=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Leagues GET Response Status: ${getResponse.status}`);
    const getText = await getResponse.text();
    console.log(`📋 GET Response (first 300 chars): ${getText.substring(0, 300)}...`);
    
    if (getResponse.status === 200) {
      console.log('✅ Leagues GET endpoint working correctly');
      try {
        const data = JSON.parse(getText);
        console.log(`📊 Found ${data.member_leagues?.length || 0} member leagues, ${data.public_leagues?.length || 0} public leagues`);
      } catch (e) {
        console.log('🔍 Could not parse leagues response');
      }
    } else if (getResponse.status === 500) {
      console.log('❌ 500 error in leagues GET - needs investigation');
      try {
        const errorData = JSON.parse(getText);
        console.log(`🔍 Error: ${errorData.error || errorData.message}`);
      } catch (e) {
        console.log('🔍 Could not parse error response');
      }
    }
    
    // Test 2: Leagues POST endpoint (without auth)
    console.log('\n📝 Test 2: Leagues POST endpoint validation...');
    const postResponse = await fetch('https://app.proofofputt.com/api/leagues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test League',
        description: 'Testing league creation',
        settings: {
          privacy: 'public',
          time_limit_minutes: 10
        }
      })
    });
    
    console.log(`📊 Leagues POST Response Status: ${postResponse.status}`);
    const postText = await postResponse.text();
    console.log(`📋 POST Response: ${postText}`);
    
    if (postResponse.status === 401) {
      console.log('✅ Leagues POST correctly requires authentication');
    } else if (postResponse.status === 500) {
      console.log('❌ 500 error in leagues POST - needs investigation');
    }
    
    // Test 3: Email invitation format test
    console.log('\n📝 Test 3: Email invitation format validation...');
    const emailResponse = await fetch('https://app.proofofputt.com/api/leagues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Email League',
        created_by: 1,
        invite_new_players: true,
        new_player_contacts: [
          {type: 'email', value: 'test1@example.com'},
          {type: 'phone', value: '+1234567890'}
        ],
        settings: {
          privacy: 'public',
          time_limit_minutes: 10
        }
      })
    });
    
    console.log(`📊 Email Invite Response Status: ${emailResponse.status}`);
    const emailText = await emailResponse.text();
    console.log(`📋 Email Response: ${emailText}`);
    
    if (emailResponse.status === 401) {
      console.log('✅ Email invitation correctly requires authentication');
    } else if (emailResponse.status === 500) {
      console.log('❌ 500 error in email invitation - needs investigation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLeaguesAPI();