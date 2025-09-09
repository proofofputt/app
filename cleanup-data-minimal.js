#!/usr/bin/env node

/**
 * MINIMAL DATA CLEANUP SCRIPT - No Transactions
 * 
 * This version focuses only on the core issue: cleaning sessions and player stats
 * to troubleshoot the All-time Stats vs Session History mismatch
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupCoreData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting minimal data cleanup for troubleshooting...\n');
    
    let sessionsDeleted = 0;
    let playersReset = 0;
    
    // ====================================================================
    // 1. CLEAN UP SESSION HISTORY (CORE ISSUE)
    // ====================================================================
    console.log('📊 Cleaning up session history...');
    
    try {
      const sessionsResult = await client.query('DELETE FROM sessions');
      sessionsDeleted = sessionsResult.rowCount;
      console.log(`   ✓ Deleted ${sessionsDeleted} sessions`);
    } catch (error) {
      console.log(`   ❌ Error deleting sessions: ${error.message}`);
    }
    
    // ====================================================================
    // 2. RESET PLAYER STATS (CRITICAL FOR ALL-TIME STATS)
    // ====================================================================
    console.log('\n👤 Resetting player statistics...');
    
    try {
      const playersResult = await client.query(`
        UPDATE players SET 
          total_sessions = 0,
          total_putts = 0, 
          total_makes = 0,
          best_streak = 0,
          make_percentage = 0.0,
          updated_at = CURRENT_TIMESTAMP
        WHERE player_id IS NOT NULL
      `);
      playersReset = playersResult.rowCount;
      console.log(`   ✓ Reset stats for ${playersReset} players`);
    } catch (error) {
      console.log(`   ❌ Error resetting player stats: ${error.message}`);
    }
    
    // ====================================================================
    // 3. VERIFICATION
    // ====================================================================
    console.log('\n🔍 Verification...');
    
    try {
      const sessionCount = await client.query('SELECT COUNT(*) FROM sessions');
      console.log(`   Sessions remaining: ${sessionCount.rows[0].count}`);
    } catch (error) {
      console.log('   Sessions: table may not exist or error occurred');
    }
    
    try {
      const playerCount = await client.query('SELECT COUNT(*) FROM players WHERE player_id IS NOT NULL');
      console.log(`   Active players: ${playerCount.rows[0].count}`);
    } catch (error) {
      console.log('   Players: table may not exist or error occurred');
    }
    
    console.log('\n✅ Core data cleanup completed!');
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   Sessions deleted: ${sessionsDeleted}`);
    console.log(`   Player stats reset: ${playersReset}`);
    
    console.log('\n🧪 NEXT STEPS:');
    console.log('1. Check All-time Stats - should show 0 for all metrics');
    console.log('2. Check Session History - should be completely empty');
    console.log('3. Create a new practice session via desktop app');
    console.log('4. Verify All-time Stats match the new session exactly');
    console.log('\n🎯 If stats still don\'t match after this, there\'s a bug in career-stats.js!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await cleanupCoreData();
    console.log('\n🎉 Minimal cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}