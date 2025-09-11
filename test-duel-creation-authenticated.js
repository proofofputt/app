// Test duel creation with a simulated authenticated request
import fetch from 'node-fetch';

async function testAuthenticatedDuelCreation() {
  try {
    console.log('🧪 Testing authenticated duel creation scenarios...');
    
    // Test 1: Try different types of duel creation requests
    const testCases = [
      {
        name: 'Regular Duel Creation',
        body: {
          creator_id: 1,
          invited_player_id: 2,
          settings: {
            session_duration_limit_minutes: 5,
            scoring: 'total_makes'
          }
        }
      },
      {
        name: 'Email Invitation Duel',
        body: {
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
        }
      },
      {
        name: 'Phone Invitation Duel',
        body: {
          creator_id: 1,
          invite_new_player: true,
          new_player_contact: {
            type: 'phone',
            value: '+1234567890'
          },
          settings: {
            session_duration_limit_minutes: 5,
            scoring: 'total_makes'
          }
        }
      },
      {
        name: 'Malformed Request',
        body: {
          creator_id: 1,
          // Missing required fields to test validation
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📝 Testing: ${testCase.name}`);
      
      const response = await fetch('https://app.proofofputt.com/api/duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.body)
      });
      
      console.log(`📊 Response Status: ${response.status}`);
      const responseText = await response.text();
      
      if (response.status === 500) {
        console.log('❌ 500 ERROR DETECTED!');
        console.log(`📋 Response: ${responseText}`);
        try {
          const errorData = JSON.parse(responseText);
          console.log(`🔍 Error Details: ${errorData.error || errorData.message}`);
        } catch (e) {
          console.log('🔍 Could not parse error response');
        }
        return; // Stop on first 500 error to investigate
      } else if (response.status === 401) {
        console.log('✅ Expected 401 - Authentication required');
      } else if (response.status === 400) {
        console.log('✅ Expected 400 - Validation error for malformed request');
      } else {
        console.log(`ℹ️  Status ${response.status}: ${responseText.substring(0, 100)}...`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuthenticatedDuelCreation();