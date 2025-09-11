import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    
    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Check if we have any sessions data
    const sessionCount = await client.query('SELECT COUNT(*) FROM sessions');
    
    // Check if we have any players
    const playerCount = await client.query('SELECT COUNT(*) FROM players');
    
    // CLEANUP TEST INVITES: Remove temporary players and reset rate limits
    let cleanupResult = 'not_run';
    if (req.method === 'POST' && req.body && req.body.cleanup_test_invites === true) {
      try {
        // Find and remove temporary players
        const tempPlayersResult = await client.query(`
          SELECT player_id, name, email 
          FROM players 
          WHERE (
            email LIKE '%@temp.local' OR 
            email LIKE '%temp_%@%' OR
            password_hash = 'temp_password_hash_for_invited_player'
          )
        `);
        
        const tempPlayers = tempPlayersResult.rows;
        if (tempPlayers.length > 0) {
          const tempPlayerIds = tempPlayers.map(p => p.player_id);
          
          // Clean up related data
          await client.query(`DELETE FROM player_referrals WHERE referrer_id = ANY($1) OR referred_player_id = ANY($1)`, [tempPlayerIds]);
          await client.query(`DELETE FROM player_friends WHERE player_id = ANY($1) OR friend_player_id = ANY($1)`, [tempPlayerIds]);
          await client.query(`DELETE FROM duels WHERE duel_creator_id = ANY($1) OR duel_invited_player_id = ANY($1)`, [tempPlayerIds]);
          await client.query(`DELETE FROM player_stats WHERE player_id = ANY($1)`, [tempPlayerIds]);
          await client.query(`DELETE FROM players WHERE player_id = ANY($1)`, [tempPlayerIds]);
        }
        
        // Reset invitation counters
        await client.query(`UPDATE players SET daily_invites_sent = 0, last_invite_date = NULL WHERE daily_invites_sent > 0`);
        
        cleanupResult = `success_removed_${tempPlayers.length}_temp_players`;
      } catch (error) {
        cleanupResult = `failed_${error.message}`;
      }
    }

    // EMERGENCY MIGRATION: Add missing rate limiting columns
    let migrationResult = 'not_run';
    if (req.method === 'POST' && req.body && req.body.run_migration === true) {
      try {
        // Add missing columns
        await client.query(`
          ALTER TABLE players 
          ADD COLUMN IF NOT EXISTS daily_invites_sent INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_invite_date DATE
        `);
        
        // Update existing players
        const updateResult = await client.query(`
          UPDATE players 
          SET daily_invites_sent = 0 
          WHERE daily_invites_sent IS NULL
        `);
        
        migrationResult = `success_updated_${updateResult.rowCount}_players`;
      } catch (error) {
        migrationResult = `failed_${error.message}`;
      }
    }
    
    // Check if rate limiting columns exist
    const rateColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
      ORDER BY column_name
    `);
    
    return res.status(200).json({
      success: true,
      tables: tables,
      session_count: sessionCount.rows[0].count,
      player_count: playerCount.rows[0].count,
      database_url_set: !!process.env.DATABASE_URL,
      cleanup_result: cleanupResult,
      migration_result: migrationResult,
      rate_limiting_columns: rateColumns.rows
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      database_url_set: !!process.env.DATABASE_URL
    });
  } finally {
    if (client) client.release();
  }
}