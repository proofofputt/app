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
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const client = await pool.connect();
    
    console.log('📊 Setting up sessions table for session uploads...');

    // Check current sessions table schema
    const schemaCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Current sessions table schema:', schemaCheck.rows);

    // Create/update sessions table with required columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
          session_id SERIAL PRIMARY KEY,
          player_id INTEGER NOT NULL,
          total_putts INTEGER DEFAULT 0,
          makes INTEGER DEFAULT 0,
          misses INTEGER DEFAULT 0,
          make_percentage DECIMAL(5,2) DEFAULT 0.00,
          best_streak INTEGER DEFAULT 0,
          session_duration DECIMAL(10,2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add missing columns if they don't exist
    const columnsToAdd = [
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_putts INTEGER DEFAULT 0;',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS makes INTEGER DEFAULT 0;',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS misses INTEGER DEFAULT 0;',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS make_percentage DECIMAL(5,2) DEFAULT 0.00;',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0;',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_duration DECIMAL(10,2) DEFAULT 0.00;'
    ];

    for (const sql of columnsToAdd) {
      try {
        await client.query(sql);
      } catch (e) {
        console.log('Column already exists or cannot be added:', e.message);
      }
    }

    // Verify the updated schema
    const updatedSchema = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position;
    `);
    
    client.release();

    console.log('✅ Sessions table setup completed');
    return res.status(200).json({ 
      success: true, 
      message: 'Sessions table setup completed successfully',
      schema: updatedSchema.rows
    });

  } catch (error) {
    console.error('❌ Error setting up sessions table:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred' 
    });
  }
}