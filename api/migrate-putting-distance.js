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

  const client = await pool.connect();
  
  try {
    console.log('🏗️  Starting putting distance migration...');
    
    // 1. Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      AND column_name = 'putting_distance_feet'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ putting_distance_feet column already exists');
    } else {
      console.log('📊 Adding putting_distance_feet column to sessions table...');
      await client.query(`
        ALTER TABLE sessions 
        ADD COLUMN putting_distance_feet DECIMAL(3,1) DEFAULT 7.0
      `);
      console.log('✅ Column added successfully');
    }
    
    // 2. Update existing sessions to have default 7.0 foot distance
    console.log('🔄 Updating existing sessions with default 7.0 foot distance...');
    const updateResult = await client.query(`
      UPDATE sessions 
      SET putting_distance_feet = 7.0 
      WHERE putting_distance_feet IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} sessions with default distance`);
    
    // 3. Create index for performance (if it doesn't exist)
    try {
      console.log('📈 Creating performance index...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_putting_distance 
        ON sessions(putting_distance_feet)
      `);
      console.log('✅ Index created successfully');
    } catch (indexError) {
      console.log('ℹ️  Index may already exist:', indexError.message);
    }
    
    // 4. Add constraint to ensure valid putting distance range
    try {
      console.log('🔒 Adding distance range constraint...');
      await client.query(`
        ALTER TABLE sessions 
        ADD CONSTRAINT check_putting_distance_range 
        CHECK (putting_distance_feet >= 3.0 AND putting_distance_feet <= 10.0)
      `);
      console.log('✅ Constraint added successfully');
    } catch (constraintError) {
      console.log('ℹ️  Constraint may already exist:', constraintError.message);
    }
    
    // 5. Verification queries
    const sessionCount = await client.query(`
      SELECT COUNT(*) as total_sessions
      FROM sessions 
      WHERE putting_distance_feet IS NOT NULL
    `);
    
    const distanceDistribution = await client.query(`
      SELECT putting_distance_feet, COUNT(*) as session_count 
      FROM sessions 
      GROUP BY putting_distance_feet 
      ORDER BY putting_distance_feet
    `);
    
    console.log('✅ Migration completed successfully!');
    
    return res.status(200).json({
      success: true,
      message: 'Putting distance migration completed successfully',
      results: {
        sessions_updated: updateResult.rowCount,
        total_sessions_with_distance: parseInt(sessionCount.rows[0].total_sessions),
        distance_distribution: distanceDistribution.rows
      }
    });
    
  } catch (error) {
    console.error('💥 Migration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    client.release();
  }
}