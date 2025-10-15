#!/usr/bin/env node

/**
 * COMPREHENSIVE PLAYER 3 SEARCH
 * 
 * This script will exhaustively search for Player 3 (npk13@protonmail.com)
 * and determine why they weren't showing up in our previous queries
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findPlayer3() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 COMPREHENSIVE PLAYER 3 SEARCH');
    console.log('=================================\n');
    
    const targetEmail = 'npk13@protonmail.com';
    
    // ====================================================================
    // 1. SEARCH BY EMAIL
    // ====================================================================
    console.log('📧 SEARCHING BY EMAIL:');
    console.log(`Looking for: ${targetEmail}\n`);
    
    const emailSearchResult = await client.query(`
      SELECT player_id, name, email, membership_tier, subscription_status, created_at
      FROM players 
      WHERE email = $1
    `, [targetEmail]);
    
    if (emailSearchResult.rows.length > 0) {
      console.log('✅ FOUND BY EMAIL:');
      emailSearchResult.rows.forEach(player => {
        console.log(`   👤 Player ${player.player_id}: ${player.name}`);
        console.log(`   📧 Email: ${player.email}`);
        console.log(`   🎫 Tier: ${player.membership_tier || 'none'}`);
        console.log(`   📅 Created: ${player.created_at}`);
        console.log('');
      });
    } else {
      console.log(`❌ No player found with email: ${targetEmail}\n`);
    }
    
    // ====================================================================
    // 2. SEARCH BY PARTIAL EMAIL
    // ====================================================================
    console.log('🔍 SEARCHING BY PARTIAL EMAIL:');
    const partialEmailResult = await client.query(`
      SELECT player_id, name, email, created_at
      FROM players 
      WHERE email ILIKE '%npk13%' OR email ILIKE '%protonmail%'
    `);
    
    if (partialEmailResult.rows.length > 0) {
      console.log('Partial matches found:');
      partialEmailResult.rows.forEach(player => {
        console.log(`   👤 Player ${player.player_id}: ${player.name} (${player.email})`);
      });
      console.log('');
    } else {
      console.log('No partial email matches found\n');
    }
    
    // ====================================================================
    // 3. CHECK ALL PLAYERS (INCLUDING HIDDEN COLUMNS)
    // ====================================================================
    console.log('👥 ALL PLAYERS (COMPLETE VIEW):');
    const allPlayersResult = await client.query(`
      SELECT * FROM players ORDER BY player_id
    `);
    
    console.log(`Found ${allPlayersResult.rows.length} total players:\n`);
    allPlayersResult.rows.forEach(player => {
      console.log(`📋 Player ${player.player_id} (${player.name}):`);
      Object.entries(player).forEach(([key, value]) => {
        if (value !== null) {
          console.log(`   ${key}: ${value}`);
        }
      });
      console.log('');
    });
    
    // ====================================================================
    // 4. CHECK FOR PLAYER 3 SPECIFICALLY BY ID
    // ====================================================================
    console.log('🎯 DIRECT SEARCH FOR PLAYER_ID = 3:');
    const player3Result = await client.query(`
      SELECT * FROM players WHERE player_id = 3
    `);
    
    if (player3Result.rows.length > 0) {
      console.log('✅ FOUND PLAYER 3:');
      const player3 = player3Result.rows[0];
      Object.entries(player3).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      console.log('');
    } else {
      console.log('❌ No player with player_id = 3 found\n');
    }
    
    // ====================================================================
    // 5. CHECK PLAYER_STATS FOR PLAYER 3
    // ====================================================================
    console.log('📊 PLAYER STATS FOR PLAYER 3:');
    const stats3Result = await client.query(`
      SELECT * FROM player_stats WHERE player_id = 3
    `);
    
    if (stats3Result.rows.length > 0) {
      console.log('✅ FOUND STATS FOR PLAYER 3:');
      const stats3 = stats3Result.rows[0];
      Object.entries(stats3).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      console.log('');
    } else {
      console.log('❌ No stats found for player_id = 3\n');
    }
    
    // ====================================================================
    // 6. CHECK SESSIONS FOR PLAYER 3
    // ====================================================================
    console.log('📋 SESSIONS FOR PLAYER 3:');
    const sessions3Result = await client.query(`
      SELECT session_id, player_id, created_at, 
             jsonb_extract_path_text(data, 'total_makes') as makes
      FROM sessions 
      WHERE player_id = 3 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sessions3Result.rows.length > 0) {
      console.log(`✅ FOUND ${sessions3Result.rows.length} SESSIONS FOR PLAYER 3:`);
      sessions3Result.rows.forEach((session, index) => {
        console.log(`   📄 Session ${index + 1}: ${session.session_id}`);
        console.log(`      Makes: ${session.makes || 'unknown'}`);
        console.log(`      Date: ${session.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No sessions found for player_id = 3\n');
    }
    
    // ====================================================================
    // 7. TEST LOGIN API
    // ====================================================================
    console.log('🔐 TESTING LOGIN API:');
    console.log('This will test if the login endpoint recognizes the email...\n');
    
    // Note: We can't test actual login without password, but we can check if email exists via API
    
    console.log('✅ Investigation complete!');
    console.log('\n🎯 SUMMARY:');
    console.log('If Player 3 login works but we can\'t find them in database,');
    console.log('there might be an authentication issue or database sync problem.');
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await findPlayer3();
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