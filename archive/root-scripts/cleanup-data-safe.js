#!/usr/bin/env node

/**
 * COMPREHENSIVE DATA CLEANUP SCRIPT FOR TROUBLESHOOTING - SAFE VERSION
 * 
 * WARNING: This script will DELETE ALL session history, duels, and leagues
 * Use only for troubleshooting and testing purposes
 * 
 * This version safely handles missing tables and only cleans up what exists
 * 
 * Usage:
 *   node cleanup-data-safe.js
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

// Helper function to safely delete from a table
async function safeDelete(client, tableName, description) {
  try {
    const result = await client.query(`DELETE FROM ${tableName}`);
    console.log(`   ✓ Deleted ${result.rowCount} ${description}`);
    return result.rowCount;
  } catch (error) {
    if (error.code === '42P01') {
      console.log(`   ⚠️  ${tableName} table does not exist - skipping`);
      return 0;
    } else {
      throw error;
    }
  }
}

// Helper function to safely count from a table
async function safeCount(client, tableName, description) {
  try {
    const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
    const count = result.rows[0].count;
    console.log(`   ${description}: ${count}`);
    return count;
  } catch (error) {
    if (error.code === '42P01') {
      console.log(`   ${description}: table does not exist`);
      return 0;
    } else {
      throw error;
    }
  }
}

async function cleanupAllData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting comprehensive data cleanup (safe mode)...\n');
    
    // Start transaction for safety
    await client.query('BEGIN');
    
    const results = {
      duels: 0,
      duel_sessions: 0,
      leagues: 0,
      league_rounds: 0,
      league_memberships: 0,
      league_round_sessions: 0,
      sessions: 0,
      notifications: 0,
      players_reset: 0
    };
    
    // ====================================================================
    // 1. CLEAN UP DUEL-RELATED DATA
    // ====================================================================
    console.log('🥊 Cleaning up duel-related data...');
    
    results.duel_sessions = await safeDelete(client, 'duel_sessions', 'duel session submissions');
    results.duels = await safeDelete(client, 'duels', 'duels');
    console.log();
    
    // ====================================================================
    // 2. CLEAN UP LEAGUE-RELATED DATA
    // ====================================================================
    console.log('🏆 Cleaning up league-related data...');
    
    results.league_round_sessions = await safeDelete(client, 'league_round_sessions', 'league round sessions');
    results.league_rounds = await safeDelete(client, 'league_rounds', 'league rounds');
    results.league_memberships = await safeDelete(client, 'league_memberships', 'league memberships');
    results.leagues = await safeDelete(client, 'leagues', 'leagues');
    console.log();
    
    // ====================================================================
    // 3. CLEAN UP SESSION HISTORY (CRITICAL FOR TROUBLESHOOTING)
    // ====================================================================
    console.log('📊 Cleaning up session history...');
    
    results.sessions = await safeDelete(client, 'sessions', 'sessions');
    console.log();
    
    // ====================================================================
    // 4. CLEAN UP NOTIFICATIONS
    // ====================================================================
    console.log('🔔 Cleaning up notifications...');
    
    try {
      const notificationsResult = await client.query(`
        DELETE FROM notifications 
        WHERE type IN ('duel_invitation', 'duel_completed', 'league_invitation', 'league_round_started', 'session_uploaded')
      `);
      results.notifications = notificationsResult.rowCount;
      console.log(`   ✓ Deleted ${results.notifications} notifications`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  notifications table does not exist - skipping');
      } else {
        throw error;
      }
    }
    console.log();
    
    // ====================================================================
    // 5. RESET PLAYER STATS (CRITICAL FOR ALL-TIME STATS TROUBLESHOOTING)
    // ====================================================================
    console.log('👤 Resetting player statistics...');
    
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
      results.players_reset = playersResult.rowCount;
      console.log(`   ✓ Reset stats for ${results.players_reset} players`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  players table does not exist - skipping');
      } else {
        throw error;
      }
    }
    console.log();
    
    // ====================================================================
    // 6. VERIFICATION QUERIES
    // ====================================================================
    console.log('🔍 Verification - Checking remaining data counts...');
    
    await safeCount(client, 'sessions', 'Sessions remaining');
    await safeCount(client, 'duels', 'Duels remaining');
    await safeCount(client, 'leagues', 'Leagues remaining');
    await safeCount(client, 'league_rounds', 'League rounds remaining');
    await safeCount(client, 'league_memberships', 'League memberships remaining');
    await safeCount(client, 'duel_sessions', 'Duel sessions remaining');
    await safeCount(client, 'league_round_sessions', 'League round sessions remaining');
    
    try {
      const result = await client.query('SELECT COUNT(*) FROM players WHERE player_id IS NOT NULL');
      console.log(`   Active players: ${result.rows[0].count}`);
    } catch (error) {
      console.log('   Active players: players table does not exist');
    }
    
    // Commit all changes
    await client.query('COMMIT');
    console.log('\n✅ All data cleanup completed successfully!');
    
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   Sessions deleted: ${results.sessions}`);
    console.log(`   Duels deleted: ${results.duels}`);
    console.log(`   Leagues deleted: ${results.leagues}`);
    console.log(`   Player stats reset: ${results.players_reset}`);
    
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
    console.log('\n🎯 TROUBLESHOOTING GOAL:');
    console.log('If All-time Stats still don\'t match Session History after this cleanup,');
    console.log('then there\'s definitely a bug in the career stats calculation!');
    
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