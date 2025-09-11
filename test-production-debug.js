// Debug the actual production 500 error by testing with a real authenticated request
import fetch from 'node-fetch';

async function debugProductionError() {
  try {
    console.log('🔍 Debugging production 500 error...');
    
    // Test with a minimal email invitation request to see the exact error
    console.log('\n📝 Testing minimal email invitation request...');
    
    const testPayload = {
      creator_id: 1,
      invite_new_player: true,
      new_player_contact: {
        type: 'email',
        value: 'debug@example.com'
      },
      settings: {
        session_duration_limit_minutes: 5
      }
    };
    
    console.log('📋 Request payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch('https://app.proofofputt.com/api/duels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: No authorization header to trigger the 500 error faster
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`📋 Raw Response: ${responseText}`);
    
    if (response.status === 500) {
      console.log('\n❌ 500 ERROR CONFIRMED in production');
      try {
        const errorData = JSON.parse(responseText);
        console.log(`🔍 Parsed Error: ${JSON.stringify(errorData, null, 2)}`);
        
        if (errorData.error) {
          console.log('\n🎯 SPECIFIC ERROR MESSAGE:');
          console.log(errorData.error);
          
          // Check for common database field issues
          if (errorData.error.includes('column') && errorData.error.includes('does not exist')) {
            console.log('\n💡 LIKELY ISSUE: Missing database column in production');
            console.log('The production database likely doesn\'t have the is_temporary or contact_info fields');
          } else if (errorData.error.includes('player_invitations')) {
            console.log('\n💡 LIKELY ISSUE: Code still references player_invitations table');
            console.log('The deployed code might not be the latest version');
          }
        }
      } catch (parseError) {
        console.log('🔍 Could not parse error response - might be HTML error page');
        console.log('First 200 characters:', responseText.substring(0, 200));
      }
    } else if (response.status === 401) {
      console.log('\n✅ Getting 401 as expected - 500 error might be fixed');
    } else {
      console.log(`\n❓ Unexpected status: ${response.status}`);
    }
    
    // Also test the GET endpoint to make sure basic functionality works
    console.log('\n📝 Testing basic GET endpoint for comparison...');
    const getResponse = await fetch('https://app.proofofputt.com/api/duels?player_id=1');
    console.log(`📊 GET Response Status: ${getResponse.status}`);
    if (getResponse.status === 200) {
      console.log('✅ GET endpoint works fine - issue is specifically with POST');
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

debugProductionError();