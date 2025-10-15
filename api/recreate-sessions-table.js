import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log('Recreating sessions table with correct structure...');
    
    // Drop and recreate the sessions table with VARCHAR session_id
    const recreateSQL = `
      -- Drop the existing sessions table
      DROP TABLE IF EXISTS sessions CASCADE;
      
      -- Create sessions table with correct structure
      CREATE TABLE sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          player_id INTEGER NOT NULL,
          data JSONB NOT NULL,
          stats_summary JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (player_id) REFERENCES players(player_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_sessions_player_id ON sessions(player_id);
      CREATE INDEX idx_sessions_created_at ON sessions(created_at);
    `;

    await pool.query(recreateSQL);
    
    // Verify the new structure
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);

    console.log('✅ Sessions table recreated! Columns:', verifyResult.rows);

    res.status(200).json({ 
      success: true, 
      message: 'Sessions table recreated successfully with correct structure',
      columns: verifyResult.rows
    });

  } catch (error) {
    console.error('Recreate sessions table error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to recreate sessions table',
      error: error.message 
    });
  }
}