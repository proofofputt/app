import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed. Use POST to refresh leaderboards.' 
    });
  }

  try {
    // Verify authentication (optional - you may want to make this admin-only)
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required to refresh leaderboards' 
      });
    }

    const client = await pool.connect();
    
    try {
      const { context_id } = req.body;

      // Check if we have the V2 leaderboard system installed
      const systemCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'leaderboard_cache'
        ) as has_v2_system
      `);

      if (!systemCheckResult.rows[0].has_v2_system) {
        client.release();
        return res.status(400).json({
          success: false,
          message: 'V2 leaderboard system not installed. Please run the leaderboard setup SQL scripts.',
          help: 'Run neondb_leaderboards_system.sql and neondb_leaderboard_calculations.sql in your NeonDB console'
        });
      }

      // Check if refresh function exists
      const functionCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc 
          WHERE proname = 'refresh_all_leaderboards'
        ) as has_refresh_function
      `);

      if (!functionCheckResult.rows[0].has_refresh_function) {
        client.release();
        return res.status(400).json({
          success: false,
          message: 'Leaderboard refresh function not found. Please run neondb_leaderboard_calculations.sql',
          help: 'The refresh_all_leaderboards stored procedure is required for cache management'
        });
      }

      // Perform the refresh
      let result;
      if (context_id) {
        // Refresh specific context
        result = await client.query(
          'SELECT refresh_all_leaderboards($1) as message',
          [context_id]
        );
      } else {
        // Refresh all contexts
        result = await client.query('SELECT refresh_all_leaderboards() as message');
      }

      const refreshMessage = result.rows[0]?.message || 'Leaderboards refreshed';

      // Get some stats about what was refreshed
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT context_id) as contexts_refreshed,
          COUNT(DISTINCT metric_id) as metrics_calculated,
          MAX(calculated_at) as last_refresh
        FROM leaderboard_cache 
        WHERE calculated_at >= NOW() - INTERVAL '5 minutes'
      `);

      const stats = statsResult.rows[0];

      client.release();

      return res.status(200).json({
        success: true,
        message: refreshMessage,
        stats: {
          total_cache_entries: parseInt(stats.total_entries),
          contexts_refreshed: parseInt(stats.contexts_refreshed),
          metrics_calculated: parseInt(stats.metrics_calculated),
          last_refresh: stats.last_refresh
        },
        timestamp: new Date().toISOString()
      });

    } catch (dbError) {
      client.release();
      console.error('Database error during leaderboard refresh:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error during refresh',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (error) {
    console.error('Leaderboard refresh API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during leaderboard refresh',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}