import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    console.log('[Migration] Starting leagues foreign key fix...');

    // Drop the incorrect foreign key constraint
    await client.query(`
      ALTER TABLE leagues
      DROP CONSTRAINT IF EXISTS leagues_created_by_fkey
    `);
    console.log('[Migration] Dropped old constraint');

    // Add the correct foreign key constraint pointing to players.player_id
    await client.query(`
      ALTER TABLE leagues
      ADD CONSTRAINT leagues_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES players(player_id) ON DELETE SET NULL
    `);
    console.log('[Migration] Added new constraint');

    // Verify the fix
    const verification = await client.query(`
      SELECT
        tc.constraint_name,
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
        AND tc.table_name = 'leagues'
        AND kcu.column_name = 'created_by'
    `);

    console.log('[Migration] Verification:', verification.rows);

    return res.status(200).json({
      success: true,
      message: 'Leagues foreign key constraint fixed successfully',
      old_constraint: 'created_by -> users.id',
      new_constraint: 'created_by -> players.player_id',
      verification: verification.rows[0]
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
