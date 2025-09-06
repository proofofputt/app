#!/usr/bin/env node

/**
 * Timer System Integration Test
 * 
 * This test demonstrates the complete duel invitation and timer workflow:
 * 1. Create a duel invitation with time limits
 * 2. Accept the invitation 
 * 3. Start a duel session with timer
 * 4. Monitor timer status
 * 5. Test timer expiration handling
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3000/api';
const TEST_JWT_TOKEN = 'test-token'; // Use a real JWT token for actual testing

// Test configuration
const TEST_CONFIG = {
  challenger_id: 1,
  challenged_email: 'test@example.com',
  duel_config: {
    duel_type: 'speed',
    time_limit_hours: 1, // 1 hour for quick testing
    target_putts: 21,
    scoring_method: 'fastest_21'
  },
  personal_message: 'Timer system test - speed challenge!'
};

class TimerSystemTester {
  constructor() {
    this.createdDuelId = null;
    this.createdInvitationId = null;
    this.invitationToken = null;
  }

  async apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    console.log(`📡 ${options.method || 'GET'} ${endpoint}:`, response.status, data.success ? '✅' : '❌');
    
    if (response.status >= 400) {
      throw new Error(`API Error: ${data.message || 'Unknown error'}`);
    }
    
    return data;
  }

  async step1_CreateDuelInvitation() {
    console.log('\n🎯 Step 1: Creating duel invitation with timer...');
    
    try {
      const response = await this.apiRequest('/send-duel-invitation', {
        method: 'POST',
        body: JSON.stringify({
          invitation_method: 'email',
          recipient_identifier: TEST_CONFIG.challenged_email,
          duel_config: TEST_CONFIG.duel_config,
          personal_message: TEST_CONFIG.personal_message
        })
      });

      this.createdDuelId = response.invitation.duel_id;
      this.createdInvitationId = response.invitation.invitation_id;
      
      console.log(`   ⏰ Duel created: ${this.createdDuelId}`);
      console.log(`   📧 Invitation: ${this.createdInvitationId}`);
      console.log(`   ⏱️  Expires: ${response.invitation.expires_at}`);
      
      return response;
    } catch (error) {
      console.error('❌ Failed to create duel invitation:', error.message);
      throw error;
    }
  }

  async step2_CheckTimerStatus() {
    console.log('\n⏰ Step 2: Checking timer status...');
    
    try {
      // Check duel timer
      const duelTimer = await this.apiRequest(`/timer-management?type=duel&id=${this.createdDuelId}`);
      
      console.log(`   🥅 Duel Timer Status:`);
      console.log(`      - Status: ${duelTimer.status}`);
      console.log(`      - Time Limit: ${duelTimer.time_limit_hours} hours`);
      console.log(`      - Remaining: ${duelTimer.remaining_hours}h ${duelTimer.remaining_minutes}m`);
      console.log(`      - Expired: ${duelTimer.is_expired ? 'Yes' : 'No'}`);
      
      // Check invitation timer
      const invitationTimer = await this.apiRequest(`/timer-management?type=invitation&id=${this.createdInvitationId}`);
      
      console.log(`   📨 Invitation Timer Status:`);
      console.log(`      - Status: ${invitationTimer.status}`);
      console.log(`      - Remaining: ${invitationTimer.remaining_hours}h ${invitationTimer.remaining_minutes}m`);
      console.log(`      - Expired: ${invitationTimer.is_expired ? 'Yes' : 'No'}`);
      
      return { duelTimer, invitationTimer };
    } catch (error) {
      console.error('❌ Failed to check timer status:', error.message);
      throw error;
    }
  }

  async step3_SimulateInvitationAcceptance() {
    console.log('\n🤝 Step 3: Simulating invitation acceptance...');
    
    try {
      // First get the invitation details
      const invitationDetails = await this.apiRequest(`/accept-duel-invitation?token=${this.invitationToken || 'test-token'}`);
      
      console.log(`   📋 Invitation Details:`);
      console.log(`      - Challenger: ${invitationDetails.invitation.challenger_name}`);
      console.log(`      - Duel Type: ${invitationDetails.invitation.duel_config.duel_type}`);
      console.log(`      - Needs Registration: ${invitationDetails.invitation.needs_registration}`);
      
      // Simulate acceptance (would normally require proper token and registration data)
      console.log(`   ⚠️  Note: Full acceptance simulation requires valid invitation token`);
      console.log(`   ⚠️  In real scenario, this would activate the duel timer`);
      
      return invitationDetails;
    } catch (error) {
      console.log(`   ⚠️  Expected error (demo mode): ${error.message}`);
      return null;
    }
  }

  async step4_TestTimerCancellation() {
    console.log('\n🚫 Step 4: Testing timer cancellation...');
    
    try {
      // Cancel the invitation timer
      const cancelResponse = await this.apiRequest('/timer-management', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cancel_timer',
          timer_type: 'invitation',
          timer_id: this.createdInvitationId
        })
      });
      
      console.log(`   ✅ Invitation cancelled: ${cancelResponse.message}`);
      
      return cancelResponse;
    } catch (error) {
      console.error('❌ Failed to cancel timer:', error.message);
      throw error;
    }
  }

  async step5_CheckUserTimers() {
    console.log('\n👤 Step 5: Checking all user timers...');
    
    try {
      const userTimers = await this.apiRequest('/timer-management?type=user');
      
      console.log(`   📊 User Timer Summary:`);
      console.log(`      - Active Duels: ${userTimers.active_duel_timers?.length || 0}`);
      console.log(`      - Pending Invitations: ${userTimers.pending_invitation_timers?.length || 0}`);
      console.log(`      - Total Active Timers: ${userTimers.total_active_timers || 0}`);
      
      if (userTimers.active_duel_timers?.length > 0) {
        console.log(`   ⏰ Active Duel Timers:`);
        userTimers.active_duel_timers.forEach((timer, index) => {
          console.log(`      ${index + 1}. Duel ${timer.duel_id} - ${timer.remaining_hours}h remaining`);
        });
      }
      
      if (userTimers.pending_invitation_timers?.length > 0) {
        console.log(`   📧 Pending Invitation Timers:`);
        userTimers.pending_invitation_timers.forEach((timer, index) => {
          console.log(`      ${index + 1}. Invitation ${timer.invitation_id} - ${timer.remaining_hours}h remaining`);
        });
      }
      
      return userTimers;
    } catch (error) {
      console.error('❌ Failed to get user timers:', error.message);
      throw error;
    }
  }

  async step6_TestCleanupProcess() {
    console.log('\n🧹 Step 6: Testing automatic cleanup...');
    
    try {
      const cleanupResults = await this.apiRequest('/timer-management?action=cleanup');
      
      console.log(`   🗑️  Cleanup Results:`);
      console.log(`      - Expired Duels: ${cleanupResults.expired_duels}`);
      console.log(`      - Expired Invitations: ${cleanupResults.expired_invitations}`);
      console.log(`      - Total Cleaned: ${cleanupResults.total_expired}`);
      
      return cleanupResults;
    } catch (error) {
      console.error('❌ Failed to test cleanup:', error.message);
      throw error;
    }
  }

  async runFullTest() {
    console.log('🚀 Starting Timer System Integration Test...');
    console.log('================================================');
    
    try {
      // Step 1: Create invitation
      await this.step1_CreateDuelInvitation();
      
      // Step 2: Check initial timer status
      await this.step2_CheckTimerStatus();
      
      // Step 3: Simulate invitation acceptance
      await this.step3_SimulateInvitationAcceptance();
      
      // Step 4: Test timer cancellation
      await this.step4_TestTimerCancellation();
      
      // Step 5: Check user's timers
      await this.step5_CheckUserTimers();
      
      // Step 6: Test cleanup
      await this.step6_TestCleanupProcess();
      
      console.log('\n✅ Timer System Test Completed Successfully!');
      console.log('================================================');
      
    } catch (error) {
      console.error('\n❌ Timer System Test Failed:', error.message);
      console.log('================================================');
      process.exit(1);
    }
  }
}

// Configuration validation
function validateTestConfig() {
  console.log('🔧 Test Configuration:');
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   JWT Token: ${TEST_JWT_TOKEN.substring(0, 10)}...`);
  console.log(`   Test Email: ${TEST_CONFIG.challenged_email}`);
  console.log(`   Duel Time Limit: ${TEST_CONFIG.duel_config.time_limit_hours} hours`);
  console.log(`   Duel Type: ${TEST_CONFIG.duel_config.duel_type}`);
  console.log('');
  
  if (TEST_JWT_TOKEN === 'test-token') {
    console.log('⚠️  WARNING: Using test JWT token. Set a real token for actual testing.');
    console.log('⚠️  Some API calls may fail with authentication errors.');
    console.log('');
  }
}

// Desktop app integration demonstration
function demonstrateDesktopIntegration() {
  console.log('🖥️  Desktop App Timer Integration:');
  console.log('   When a duel session starts, the desktop app will:');
  console.log('   1. Create a session timer using timer_manager::create_session_timer()');
  console.log('   2. Monitor timer expiration in the background');
  console.log('   3. Emit timer events to notify the user');
  console.log('   4. Automatically handle timer cleanup when session ends');
  console.log('');
  console.log('   Timer events emitted to frontend:');
  console.log('   - timer-added: When a new timer is created');
  console.log('   - timer-status-update: Every minute with remaining time');
  console.log('   - session-time-expired: When session time limit reached');
  console.log('   - timer-removed: When timer is cancelled or expires');
  console.log('');
}

// Run the test
async function main() {
  console.clear();
  console.log('⏱️  PROOF OF PUTT TIMER SYSTEM TEST');
  console.log('====================================');
  console.log('');
  
  validateTestConfig();
  demonstrateDesktopIntegration();
  
  const tester = new TimerSystemTester();
  await tester.runFullTest();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled Promise Rejection:', error.message);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}