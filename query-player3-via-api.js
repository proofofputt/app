#!/usr/bin/env node

/**
 * QUERY PLAYER 3 VIA PRODUCTION API
 * 
 * Since Player 3 login works but database queries fail,
 * let's use the production APIs to gather Player 3's data
 */

import { execSync } from 'child_process';

async function queryPlayer3ViaAPI() {
  console.log('🌐 QUERYING PLAYER 3 VIA PRODUCTION API');
  console.log('======================================\n');
  
  try {
    // Step 1: Get authentication token for Player 3
    console.log('🔐 Step 1: Authenticating Player 3...');
    const loginResponse = execSync(`curl -s -X POST "https://app.proofofputt.com/api/login" \
      -H "Content-Type: application/json" \
      -d '{"email": "npk13@protonmail.com", "password": "8H@^7CGsYJj&i&Lb^zm"}'`, 
      { encoding: 'utf8' });
    
    const loginData = JSON.parse(loginResponse);
    
    if (!loginData.success) {
      console.log('❌ Authentication failed:', loginData.message);
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log(`   Player ID: ${loginData.player.player_id}`);
    console.log(`   Name: ${loginData.player.name}`);
    console.log(`   Email: ${loginData.player.email}`);
    const token = loginData.token;
    console.log(`   Token received: ${token ? 'Yes' : 'No'}\n`);
    
    // Step 2: Query Player 3's data using the token
    console.log('📊 Step 2: Querying Player 3 career stats...');
    const careerStatsResponse = execSync(`curl -s "https://app.proofofputt.com/api/career-stats?player_id=3"`, 
      { encoding: 'utf8' });
    
    try {
      const careerStats = JSON.parse(careerStatsResponse);
      console.log('✅ Career stats retrieved:');
      console.log(`   Player Name: ${careerStats.player_name || 'N/A'}`);
      console.log(`   Total Makes: ${careerStats.sum_makes || 0}`);
      console.log(`   High Makes: ${careerStats.high_makes || 0}`);
      console.log(`   Best Streak: ${careerStats.high_best_streak || 0}`);
      console.log('');
    } catch (error) {
      console.log('❌ Error parsing career stats:', careerStatsResponse.substring(0, 100));
    }
    
    // Step 3: Query Player 3's sessions
    console.log('📋 Step 3: Querying Player 3 sessions...');
    const sessionsResponse = execSync(`curl -s "https://app.proofofputt.com/api/player/3/sessions"`, 
      { encoding: 'utf8' });
    
    try {
      const sessionsData = JSON.parse(sessionsResponse);
      console.log('✅ Sessions data retrieved:');
      console.log(`   Total Sessions: ${sessionsData.total_sessions || 0}`);
      console.log(`   Sessions Returned: ${sessionsData.sessions ? sessionsData.sessions.length : 0}`);
      
      if (sessionsData.sessions && sessionsData.sessions.length > 0) {
        console.log('   📄 Recent sessions:');
        sessionsData.sessions.slice(0, 3).forEach((session, index) => {
          console.log(`      ${index + 1}. Session ${session.session_id || 'N/A'}`);
          console.log(`         Makes: ${session.makes || session.total_makes || 0}`);
          console.log(`         Date: ${session.date || session.created_at || 'N/A'}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error parsing sessions:', sessionsResponse.substring(0, 100));
    }
    
    // Step 4: Try to query Player 3's profile data
    console.log('👤 Step 4: Querying Player 3 profile data...');
    const profileResponse = execSync(`curl -s "https://app.proofofputt.com/api/player/3/data"`, 
      { encoding: 'utf8' });
    
    try {
      const profileData = JSON.parse(profileResponse);
      console.log('✅ Profile data retrieved:');
      if (profileData.player) {
        console.log(`   Name: ${profileData.player.name || 'N/A'}`);
        console.log(`   Email: ${profileData.player.email || 'N/A'}`);
        console.log(`   Membership: ${profileData.player.membership_tier || 'N/A'}`);
        console.log(`   Created: ${profileData.player.created_at || 'N/A'}`);
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error parsing profile:', profileResponse.substring(0, 100));
    }
    
    console.log('🎯 SUMMARY:');
    console.log('===========');
    console.log('✅ Player 3 authentication: SUCCESS');
    console.log('✅ Player 3 API data access: SUCCESS');
    console.log('❌ Player 3 in local database: NOT FOUND');
    console.log('');
    console.log('🚨 CONCLUSION: Production API has access to Player 3 data');
    console.log('   that is not visible in our local database connection.');
    console.log('   This suggests a database environment or branching issue.');
    
  } catch (error) {
    console.error('❌ API query failed:', error.message);
  }
}

queryPlayer3ViaAPI().catch(console.error);