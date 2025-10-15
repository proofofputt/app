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
    console.log('Fixing sessions table structure...');
    
    // Add missing columns if they don't exist
    const fixSQL = `
      -- First, change session_id to VARCHAR if it's INTEGER
      ALTER TABLE sessions 
      ALTER COLUMN session_id TYPE VARCHAR(255);
      
      -- Add data column if it doesn't exist
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
      
      -- Add stats_summary column if it doesn't exist  
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS stats_summary JSONB;
    `;

    await pool.query(fixSQL);
    
    // Verify the fix
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);

    console.log('✅ Sessions table fixed! Columns:', verifyResult.rows);

    res.status(200).json({ 
      success: true, 
      message: 'Sessions table structure fixed successfully',
      columns: verifyResult.rows
    });

  } catch (error) {
    console.error('Fix sessions table error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fix sessions table',
      error: error.message 
    });
  }
}