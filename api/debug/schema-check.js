import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get players table schema
    const playersSchema = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'players'
      ORDER BY ordinal_position
    `);

    // Get leagues table schema
    const leaguesSchema = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leagues'
      ORDER BY ordinal_position
    `);

    // Get foreign key constraints on leagues table
    const foreignKeys = await client.query(`
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
    `);

    return res.status(200).json({
      success: true,
      players_table: playersSchema.rows,
      leagues_table: leaguesSchema.rows,
      foreign_keys: foreignKeys.rows
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
