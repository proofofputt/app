#!/usr/bin/env node

/**
 * DATABASE STRUCTURE INVESTIGATION SCRIPT
 * 
 * This script will help us understand:
 * 1. What tables exist in the database
 * 2. Table structures and column names
 * 3. Where session data might actually be stored
 * 4. Data counts per table
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 DATABASE STRUCTURE INVESTIGATION');
    console.log('=====================================\n');
    
    // ====================================================================
    // 1. LIST ALL TABLES
    // ====================================================================
    console.log('📋 ALL TABLES IN DATABASE:');
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`Found ${tablesResult.rows.length} tables:\n`);
    tablesResult.rows.forEach(table => {
      console.log(`   📁 ${table.table_name} (${table.table_type})`);
    });
    
    // ====================================================================
    // 2. ANALYZE EACH TABLE
    // ====================================================================
    console.log('\n🔍 TABLE ANALYSIS:');
    console.log('==================\n');
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`📊 TABLE: ${tableName.toUpperCase()}`);
      console.log(`${'='.repeat(tableName.length + 8)}`);
      
      try {
        // Get table structure
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [tableName]);
        
        console.log('   Columns:');
        columnsResult.rows.forEach(col => {
          console.log(`     • ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''})`);
        });
        
        // Get row count
        const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
        const rowCount = countResult.rows[0].count;
        console.log(`   Row count: ${rowCount}`);
        
        // If it has player_id, show breakdown
        const hasPlayerId = columnsResult.rows.some(col => col.column_name === 'player_id');
        if (hasPlayerId && parseInt(rowCount) > 0) {
          const playerBreakdown = await client.query(`
            SELECT player_id, COUNT(*) as count 
            FROM "${tableName}" 
            GROUP BY player_id 
            ORDER BY player_id
          `);
          console.log('   Player breakdown:');
          playerBreakdown.rows.forEach(row => {
            console.log(`     Player ${row.player_id}: ${row.count} records`);
          });
        }
        
        // If this is a sessions-like table, show sample data
        if (tableName.toLowerCase().includes('session') && parseInt(rowCount) > 0) {
          console.log('   📄 Sample records:');
          const sampleResult = await client.query(`
            SELECT * FROM "${tableName}" 
            ORDER BY created_at DESC NULLS LAST
            LIMIT 3
          `);
          sampleResult.rows.forEach((row, index) => {
            console.log(`     Record ${index + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              if (value !== null) {
                const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 100) + '...' : String(value).slice(0, 50);
                console.log(`       ${key}: ${displayValue}`);
              }
            });
            console.log('');
          });
        }
        
        console.log('');
      } catch (error) {
        console.log(`   ❌ Error analyzing table: ${error.message}`);
        console.log('');
      }
    }
    
    // ====================================================================
    // 3. SEARCH FOR SESSION DATA SPECIFICALLY
    // ====================================================================
    console.log('🎯 SESSION DATA SEARCH:');
    console.log('=======================\n');
    
    // Look for any table that might contain session data for player 3
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      try {
        // Check if table has columns that suggest it contains session data
        const columnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        
        const columns = columnsResult.rows.map(row => row.column_name);
        const hasSessionId = columns.includes('session_id');
        const hasPlayerId = columns.includes('player_id');
        const hasData = columns.includes('data');
        const hasMakes = columns.includes('makes') || columns.includes('total_makes');
        
        if ((hasSessionId || hasMakes || hasData) && hasPlayerId) {
          console.log(`🎯 Found potential session table: ${tableName}`);
          
          // Check for player 3 data
          const player3Result = await client.query(`
            SELECT COUNT(*) FROM "${tableName}" WHERE player_id = 3
          `);
          const player3Count = player3Result.rows[0].count;
          
          if (parseInt(player3Count) > 0) {
            console.log(`   ✅ Contains ${player3Count} records for player 3`);
            
            // Show recent records for player 3
            const recentResult = await client.query(`
              SELECT * FROM "${tableName}" 
              WHERE player_id = 3 
              ORDER BY created_at DESC NULLS LAST
              LIMIT 2
            `);
            
            console.log('   Recent records:');
            recentResult.rows.forEach((row, index) => {
              console.log(`     Record ${index + 1}:`);
              Object.entries(row).slice(0, 8).forEach(([key, value]) => {
                if (value !== null) {
                  const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 60) + '...' : String(value).slice(0, 40);
                  console.log(`       ${key}: ${displayValue}`);
                }
              });
            });
          } else {
            console.log(`   ⭕ No records for player 3`);
          }
          console.log('');
        }
      } catch (error) {
        // Skip tables we can't query
      }
    }
    
    // ====================================================================
    // 4. ENVIRONMENT INFO
    // ====================================================================
    console.log('🌐 ENVIRONMENT INFO:');
    console.log('====================');
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      // Extract database name from URL (safely)
      const urlParts = dbUrl.split('/');
      const dbName = urlParts[urlParts.length - 1]?.split('?')[0];
      console.log(`Database: ${dbName || 'unknown'}`);
      console.log(`Host: ${dbUrl.includes('neon.tech') ? 'NeonDB' : 'Other'}`);
    } else {
      console.log('❌ DATABASE_URL not found');
    }
    
    console.log('\n✅ Investigation complete!');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await investigateDatabase();
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