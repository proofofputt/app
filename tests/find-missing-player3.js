#!/usr/bin/env node

/**
 * FIND MISSING PLAYER 3 - COMPREHENSIVE SEARCH
 * 
 * Player 3 login is successful but database queries don't find them.
 * This script will exhaustively search for any trace of Player 3.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment!');
  process.exit(1);
}

console.log('🔍 Database URL configured:', process.env.DATABASE_URL.substring(0, 30) + '...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function exhaustivePlayerSearch() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Database connection successful\n');
    
    console.log('🔍 EXHAUSTIVE PLAYER 3 SEARCH');
    console.log('==============================\n');
    
    // ====================================================================
    // 1. SEARCH ALL POSSIBLE PLAYER ID VALUES
    // ====================================================================
    console.log('🔢 SEARCHING ALL PLAYER IDS:');
    const allPlayersResult = await client.query(`
      SELECT player_id, name, email, created_at, updated_at
      FROM players 
      ORDER BY player_id
    `);
    
    console.log(`Found ${allPlayersResult.rows.length} players total:\n`);
    allPlayersResult.rows.forEach(player => {
      console.log(`   👤 Player ${player.player_id}: ${player.name} (${player.email})`);
    });
    console.log('');
    
    // ====================================================================
    // 2. SEARCH BY EMAIL VARIATIONS
    // ====================================================================
    console.log('📧 SEARCHING EMAIL VARIATIONS:');
    const emailVariations = [
      'npk13@protonmail.com',
      'NPK13@protonmail.com',
      'npk13@PROTONMAIL.COM',
      '%npk13%',
      '%protonmail%'
    ];
    
    for (const emailPattern of emailVariations) {
      const result = await client.query(`
        SELECT player_id, name, email FROM players WHERE email ILIKE $1
      `, [emailPattern]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Found with pattern "${emailPattern}":`);
        result.rows.forEach(player => {
          console.log(`      Player ${player.player_id}: ${player.name} (${player.email})`);
        });
      } else {
        console.log(`   ⭕ No match for pattern: ${emailPattern}`);
      }
    }
    console.log('');
    
    // ====================================================================
    // 3. SEARCH ALL TABLES FOR PLAYER_ID = 3
    // ====================================================================
    console.log('🔍 SEARCHING ALL TABLES FOR PLAYER_ID = 3:');
    
    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      try {
        // Check if table has player_id column
        const columnsResult = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'player_id'
        `, [tableName]);
        
        if (columnsResult.rows.length > 0) {
          // Table has player_id, search for player 3
          const searchResult = await client.query(`
            SELECT COUNT(*) as count FROM "${tableName}" WHERE player_id = 3
          `);
          
          const count = parseInt(searchResult.rows[0].count);
          if (count > 0) {
            console.log(`   ✅ Table "${tableName}" has ${count} records for player_id = 3`);
            
            // Show sample data
            const sampleResult = await client.query(`
              SELECT * FROM "${tableName}" WHERE player_id = 3 LIMIT 2
            `);
            sampleResult.rows.forEach((row, index) => {
              console.log(`      Sample record ${index + 1}:`);
              Object.entries(row).slice(0, 5).forEach(([key, value]) => {
                const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 50) + '...' : String(value).slice(0, 50);
                console.log(`        ${key}: ${displayValue}`);
              });
            });
          } else {
            console.log(`   ⭕ Table "${tableName}" has no records for player_id = 3`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error searching table "${tableName}": ${error.message}`);
      }
    }
    
    console.log('');
    
    // ====================================================================
    // 4. DIRECT API COMPARISON
    // ====================================================================
    console.log('🌐 COMPARING WITH API RESPONSE:');
    console.log('API says Player 3 exists with:');
    console.log('   Player ID: 3');
    console.log('   Email: npk13@protonmail.com');
    console.log('   Name: npk13');
    console.log('');
    console.log('Database search results:');
    
    const directSearchResult = await client.query(`
      SELECT * FROM players WHERE player_id = 3 OR email = 'npk13@protonmail.com'
    `);
    
    if (directSearchResult.rows.length > 0) {
      console.log('   ✅ FOUND in database:');
      directSearchResult.rows.forEach(player => {
        console.log('   📋 Player details:');
        Object.entries(player).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
      });
    } else {
      console.log('   ❌ NOT FOUND in database');
      console.log('   🚨 This confirms a database synchronization issue!');
    }
    
    console.log('\n✅ Exhaustive search complete!');
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  } finally {
    if (client) client.release();
  }
}

async function main() {
  try {
    await exhaustivePlayerSearch();
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