#!/usr/bin/env node

import notificationService from './api/services/notification.js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testNotificationSystem() {
  console.log('🧪 Testing Notification System...\n');

  try {
    // First, ensure we have a test player
    const client = await pool.connect();

    // Get the first available player for testing
    let testPlayerId;
    try {
      const anyPlayer = await client.query('SELECT player_id FROM players LIMIT 1');
      if (anyPlayer.rows.length > 0) {
        testPlayerId = anyPlayer.rows[0].player_id;
        console.log(`✅ Using existing player with ID: ${testPlayerId} for testing`);
      } else {
        console.log('❌ No players found in database. Please create a player account first.');
        await pool.end();
        return;
      }
    } finally {
      client.release();
    }

    // Test 1: Create a basic notification
    console.log('\n1️⃣ Testing basic notification creation...');
    const basicNotification = await notificationService.createNotification({
      playerId: testPlayerId,
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test notification from the notification system',
      linkPath: '/dashboard'
    });
    console.log('Result:', basicNotification.success ? '✅ SUCCESS' : '❌ FAILED', basicNotification);

    // Test 2: Create duel challenge notification
    console.log('\n2️⃣ Testing duel challenge notification...');
    const duelNotification = await notificationService.createDuelChallengeNotification({
      playerId: testPlayerId,
      challengerName: 'Tiger Woods',
      duelId: 123
    });
    console.log('Result:', duelNotification.success ? '✅ SUCCESS' : '❌ FAILED', duelNotification);

    // Test 3: Create league invitation notification
    console.log('\n3️⃣ Testing league invitation notification...');
    const leagueNotification = await notificationService.createLeagueInvitationNotification({
      playerId: testPlayerId,
      inviterName: 'Phil Mickelson',
      leagueName: 'Masters Champions',
      leagueId: 456
    });
    console.log('Result:', leagueNotification.success ? '✅ SUCCESS' : '❌ FAILED', leagueNotification);

    // Test 4: Create achievement notification
    console.log('\n4️⃣ Testing achievement notification...');
    const achievementNotification = await notificationService.createAchievementNotification({
      playerId: testPlayerId,
      achievementName: 'Perfect Putt',
      description: 'Made 10 putts in a row!'
    });
    console.log('Result:', achievementNotification.success ? '✅ SUCCESS' : '❌ FAILED', achievementNotification);

    // Test 5: Get notification stats
    console.log('\n5️⃣ Testing notification stats...');
    const stats = await notificationService.getNotificationStats(testPlayerId);
    console.log('Result:', stats.success ? '✅ SUCCESS' : '❌ FAILED', stats);

    console.log('\n🎉 Notification system testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testNotificationSystem().catch(console.error);