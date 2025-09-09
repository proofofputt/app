#!/usr/bin/env node

/**
 * PLAYER AUTHENTICATION DEBUG SCRIPT
 * 
 * This script helps debug authentication and player identification issues
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugPlayerAuth() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 PLAYER AUTHENTICATION DEBUG');
    console.log('==============================\n');
    
    // ====================================================================
    // 1. LIST ALL PLAYERS
    // ====================================================================
    console.log('👥 ALL PLAYERS IN DATABASE:');
    const playersResult = await client.query(`
      SELECT player_id, name, email, membership_tier, created_at
      FROM players 
      ORDER BY player_id
    `);
    
    console.log(`Found ${playersResult.rows.length} players:\n`);
    playersResult.rows.forEach(player => {
      console.log(`   👤 Player ${player.player_id}: ${player.name} (${player.email})`);
      console.log(`      Tier: ${player.membership_tier || 'none'}`);
      console.log(`      Created: ${player.created_at}`);
      console.log('');
    });
    
    // ====================================================================
    // 2. CHECK PLAYER STATS
    // ====================================================================
    console.log('📊 PLAYER STATS:');
    const statsResult = await client.query(`
      SELECT player_id, total_sessions, total_makes, make_percentage, best_streak
      FROM player_stats 
      ORDER BY player_id
    `);
    
    if (statsResult.rows.length > 0) {
      statsResult.rows.forEach(stats => {
        console.log(`   📈 Player ${stats.player_id}:`);
        console.log(`      Sessions: ${stats.total_sessions || 0}`);
        console.log(`      Makes: ${stats.total_makes || 0}`);
        console.log(`      Best Streak: ${stats.best_streak || 0}`);
        console.log(`      Make %: ${stats.make_percentage || 0}%`);
        console.log('');
      });
    } else {
      console.log('   ⭕ No player stats found\n');
    }
    
    // ====================================================================
    // 3. TEST API CALLS FOR EACH PLAYER
    // ====================================================================
    console.log('🌐 API RESPONSE TEST:');
    console.log('=====================\n');
    
    // Test each existing player
    for (const player of playersResult.rows) {
      console.log(`🔍 Testing API calls for Player ${player.player_id} (${player.name}):`);
      
      try {
        // Test career stats API
        const { execSync } = await import('child_process');
        const careerStatsResponse = execSync(
          `curl -s "https://app.proofofputt.com/api/career-stats?player_id=${player.player_id}"`,
          { encoding: 'utf8', timeout: 10000 }
        );
        
        const careerStats = JSON.parse(careerStatsResponse);
        console.log(`   📈 Career Stats: ${careerStats.sum_makes || 0} total makes`);
        
        // Test sessions API
        const sessionsResponse = execSync(
          `curl -s "https://app.proofofputt.com/api/player/${player.player_id}/sessions"`,
          { encoding: 'utf8', timeout: 10000 }
        );
        
        const sessionsData = JSON.parse(sessionsResponse);
        console.log(`   📋 Sessions: ${sessionsData.total_sessions || 0} total sessions`);
        
      } catch (error) {
        console.log(`   ❌ API test failed: ${error.message.slice(0, 50)}...`);
      }
      console.log('');
    }
    
    // ====================================================================
    // 4. TEST NONEXISTENT PLAYER (PLAYER 3)
    // ====================================================================
    console.log('👻 TESTING NONEXISTENT PLAYER 3:');
    console.log('=================================\n');
    
    try {
      const { execSync } = await import('child_process');
      
      // Test career stats for player 3
      console.log('🔍 Career Stats API for Player 3:');
      const careerStats3Response = execSync(
        `curl -s "https://app.proofofputt.com/api/career-stats?player_id=3"`,
        { encoding: 'utf8', timeout: 10000 }
      );
      
      try {
        const careerStats3 = JSON.parse(careerStats3Response);
        if (careerStats3.sum_makes) {
          console.log(`   🚨 WARNING: API returned ${careerStats3.sum_makes} makes for nonexistent player!`);
          console.log(`   🐛 This suggests the API has a bug or fallback data`);
        } else {
          console.log(`   ✅ API correctly returned no data for nonexistent player`);
        }
      } catch (parseError) {
        console.log(`   📄 Raw response: ${careerStats3Response.slice(0, 200)}...`);
      }
      
      // Test sessions API for player 3
      console.log('\n🔍 Sessions API for Player 3:');
      const sessions3Response = execSync(
        `curl -s "https://app.proofofputt.com/api/player/3/sessions"`,
        { encoding: 'utf8', timeout: 10000 }
      );
      
      try {
        const sessions3 = JSON.parse(sessions3Response);
        if (sessions3.total_sessions > 0) {
          console.log(`   🚨 WARNING: API returned ${sessions3.total_sessions} sessions for nonexistent player!`);
          console.log(`   🐛 This confirms there's either fallback data or a caching issue`);
        } else {
          console.log(`   ✅ API correctly returned no sessions for nonexistent player`);
        }
      } catch (parseError) {
        console.log(`   📄 Raw response: ${sessions3Response.slice(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Player 3 API test failed: ${error.message}`);
    }
    
    console.log('\n✅ Authentication debug complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await debugPlayerAuth();
    process.exit(0);
  } catch (error) {
    console.error('💥 Failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}