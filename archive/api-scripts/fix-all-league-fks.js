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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed - use POST' });
  }

  let client;
  try {
    client = await pool.connect();

    console.log('[Migration] Starting comprehensive league foreign key fix...');
    const fixes = [];

    // Fix league_memberships.player_id
    try {
      await client.query(`
        ALTER TABLE league_memberships
        DROP CONSTRAINT IF EXISTS league_memberships_player_id_fkey
      `);
      console.log('[Migration] Dropped old league_memberships.player_id constraint');

      await client.query(`
        ALTER TABLE league_memberships
        ADD CONSTRAINT league_memberships_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      console.log('[Migration] Added new league_memberships.player_id constraint');
      fixes.push('league_memberships.player_id -> players.player_id');
    } catch (error) {
      console.error('[Migration] Error fixing league_memberships.player_id:', error.message);
      fixes.push(`league_memberships.player_id: ERROR - ${error.message}`);
    }

    // Fix league_rounds.league_id if needed
    try {
      await client.query(`
        ALTER TABLE league_rounds
        DROP CONSTRAINT IF EXISTS league_rounds_league_id_fkey
      `);
      await client.query(`
        ALTER TABLE league_rounds
        ADD CONSTRAINT league_rounds_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
      `);
      console.log('[Migration] Fixed league_rounds.league_id constraint');
      fixes.push('league_rounds.league_id -> leagues.league_id');
    } catch (error) {
      console.error('[Migration] Error fixing league_rounds.league_id:', error.message);
    }

    // Fix league_submissions if it exists
    try {
      await client.query(`
        ALTER TABLE league_submissions
        DROP CONSTRAINT IF EXISTS league_submissions_player_id_fkey
      `);
      await client.query(`
        ALTER TABLE league_submissions
        ADD CONSTRAINT league_submissions_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      console.log('[Migration] Fixed league_submissions.player_id constraint');
      fixes.push('league_submissions.player_id -> players.player_id');
    } catch (error) {
      console.log('[Migration] league_submissions table not found or error:', error.message);
    }

    // Verify all league-related foreign keys
    const verification = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name LIKE '%league%'
      ORDER BY tc.table_name, kcu.column_name
    `);

    console.log('[Migration] Verification:', verification.rows);

    return res.status(200).json({
      success: true,
      message: 'All league foreign key constraints fixed',
      fixes_applied: fixes,
      current_foreign_keys: verification.rows
    });

  } catch (error) {
    console.error('[Migration] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
