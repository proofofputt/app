#!/usr/bin/env node
/**
 * Debug script to examine what's stored in the sessions table
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://proofofputt_owner:REDACTED@ep-wispy-morning-a5f1lw2k.us-east-2.aws.neon.tech/proofofputt?sslmode=require',
});

async function debugSessionData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Examining recent session data in database...');
    
    const result = await client.query(`
      SELECT 
        session_id,
        player_id,
        created_at,
        data->>'total_putts' as total_putts,
        data->>'total_makes' as total_makes,
        data->>'best_streak' as best_streak,
        data->'consecutive_by_category' as consecutive_raw,
        data->>'consecutive_by_category' as consecutive_string,
        data::jsonb as full_data
      FROM sessions 
      WHERE player_id = 1 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log(`Found ${result.rows.length} recent sessions:`);
    console.log('=' .repeat(80));
    
    result.rows.forEach((row, i) => {
      console.log(`\n📊 Session ${i + 1}:`);
      console.log(`  ID: ${row.session_id}`);
      console.log(`  Total Putts: ${row.total_putts}`);
      console.log(`  Total Makes: ${row.total_makes}`);
      console.log(`  Best Streak: ${row.best_streak}`);
      console.log(`  Consecutive Raw (JSONB): ${JSON.stringify(row.consecutive_raw)}`);
      console.log(`  Consecutive String: ${row.consecutive_string}`);
      
      // Check if consecutive data exists in different locations
      const fullData = row.full_data;
      console.log(`  \nFull data keys: ${Object.keys(fullData).join(', ')}`);
      
      if (fullData.consecutive_by_category) {
        console.log(`  ✅ Has consecutive_by_category: ${JSON.stringify(fullData.consecutive_by_category)}`);
      } else {
        console.log(`  ❌ No consecutive_by_category found`);
      }
      
      // Check for legacy format fields
      const legacyFields = ['streaks_over_3', 'streaks_over_7', 'streaks_over_10'];
      legacyFields.forEach(field => {
        if (fullData[field] !== undefined) {
          console.log(`  Legacy field ${field}: ${fullData[field]}`);
        }
      });
    });
    
  } finally {
    client.release();
  }
}

debugSessionData().catch(console.error).finally(() => process.exit());