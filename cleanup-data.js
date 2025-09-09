#!/usr/bin/env node

/**
 * COMPREHENSIVE DATA CLEANUP SCRIPT FOR TROUBLESHOOTING
 * 
 * WARNING: This script will DELETE ALL session history, duels, and leagues
 * Use only for troubleshooting and testing purposes
 * 
 * Usage:
 *   node cleanup-data.js
 * 
 * Created: September 9, 2025
 * Purpose: Clean slate testing for data integrity issues
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupAllData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting comprehensive data cleanup...\n');
    
    // Start transaction for safety
    await client.query('BEGIN');
    
    // ====================================================================
    // 1. CLEAN UP DUEL-RELATED DATA
    // ====================================================================
    console.log('🥊 Cleaning up duel-related data...');
    
    // Delete duel session submissions
    const duelSessionsResult = await client.query('DELETE FROM duel_sessions');
    console.log(`   ✓ Deleted ${duelSessionsResult.rowCount} duel session submissions`);
    
    // Delete all duels
    const duelsResult = await client.query('DELETE FROM duels');
    console.log(`   ✓ Deleted ${duelsResult.rowCount} duels\n`);
    
    // ====================================================================
    // 2. CLEAN UP LEAGUE-RELATED DATA
    // ====================================================================
    console.log('🏆 Cleaning up league-related data...');
    
    // Delete league round sessions
    const leagueRoundSessionsResult = await client.query('DELETE FROM league_round_sessions');
    console.log(`   ✓ Deleted ${leagueRoundSessionsResult.rowCount} league round sessions`);
    
    // Delete league rounds
    const leagueRoundsResult = await client.query('DELETE FROM league_rounds');
    console.log(`   ✓ Deleted ${leagueRoundsResult.rowCount} league rounds`);
    
    // Delete league memberships
    const membershipsResult = await client.query('DELETE FROM league_memberships');
    console.log(`   ✓ Deleted ${membershipsResult.rowCount} league memberships`);
    
    // Delete all leagues
    const leaguesResult = await client.query('DELETE FROM leagues');
    console.log(`   ✓ Deleted ${leaguesResult.rowCount} leagues\n`);
    
    // ====================================================================
    // 3. CLEAN UP SESSION HISTORY
    // ====================================================================
    console.log('📊 Cleaning up session history...');
    
    // Delete all sessions
    const sessionsResult = await client.query('DELETE FROM sessions');
    console.log(`   ✓ Deleted ${sessionsResult.rowCount} sessions\n`);
    
    // ====================================================================
    // 4. CLEAN UP NOTIFICATIONS
    // ====================================================================
    console.log('🔔 Cleaning up notifications...');
    
    // Delete competition/session related notifications
    const notificationsResult = await client.query(`
      DELETE FROM notifications 
      WHERE type IN ('duel_invitation', 'duel_completed', 'league_invitation', 'league_round_started', 'session_uploaded')
    `);
    console.log(`   ✓ Deleted ${notificationsResult.rowCount} notifications\n`);
    
    // ====================================================================
    // 5. RESET PLAYER STATS
    // ====================================================================
    console.log('👤 Resetting player statistics...');
    
    // Reset player stats to zero (but keep player accounts)
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
    console.log(`   ✓ Reset stats for ${playersResult.rowCount} players\n`);
    
    // ====================================================================
    // 6. VERIFICATION QUERIES
    // ====================================================================
    console.log('🔍 Verification - Checking remaining data counts...');
    
    const verificationQueries = [
      { name: 'Sessions', query: 'SELECT COUNT(*) FROM sessions' },
      { name: 'Duels', query: 'SELECT COUNT(*) FROM duels' },
      { name: 'Leagues', query: 'SELECT COUNT(*) FROM leagues' },
      { name: 'League rounds', query: 'SELECT COUNT(*) FROM league_rounds' },
      { name: 'League memberships', query: 'SELECT COUNT(*) FROM league_memberships' },
      { name: 'Duel sessions', query: 'SELECT COUNT(*) FROM duel_sessions' },
      { name: 'League round sessions', query: 'SELECT COUNT(*) FROM league_round_sessions' },
      { name: 'Active players', query: 'SELECT COUNT(*) FROM players WHERE player_id IS NOT NULL' },
    ];
    
    for (const { name, query } of verificationQueries) {
      const result = await client.query(query);
      const count = result.rows[0].count;
      console.log(`   ${name}: ${count}`);
    }
    
    // Commit all changes
    await client.query('COMMIT');
    console.log('\n✅ All data cleanup completed successfully!');
    
    console.log('\n📋 POST-CLEANUP INSTRUCTIONS:');
    console.log('1. Career Stats should show 0 for all metrics');
    console.log('2. Session History should be completely empty'); 
    console.log('3. Duels Page should show "No duels in this category"');
    console.log('4. Leagues Page should show no active leagues');
    console.log('5. Dashboard should show fresh/clean state');
    console.log('\n🧪 TEST VERIFICATION:');
    console.log('- Create a new practice session via desktop app');
    console.log('- Career stats should show only that session\'s data');
    console.log('- All-time Stats should match Session History sum exactly');
    console.log('\nIf you see ANY discrepancies after cleanup, there\'s a data integrity bug!');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    console.log('🔄 All changes have been rolled back - no data was deleted');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await cleanupAllData();
    console.log('\n🎉 Cleanup completed successfully!');
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