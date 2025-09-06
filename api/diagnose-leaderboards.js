import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed. Use GET to diagnose leaderboard system.' 
    });
  }

  try {
    const client = await pool.connect();
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      system_status: {},
      session_data: {},
      leaderboard_data: {},
      recommendations: []
    };

    try {
      // Check if V2 system tables exist
      const tablesResult = await client.query(`
        SELECT 
          table_name,
          CASE WHEN table_name IS NOT NULL THEN true ELSE false END as exists
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('leaderboard_contexts', 'leaderboard_metrics', 'leaderboard_cache', 'session_contexts')
        ORDER BY table_name
      `);

      diagnostics.system_status.v2_tables = tablesResult.rows.reduce((acc, row) => {
        acc[row.table_name] = row.exists;
        return acc;
      }, {});

      // Check if stored procedures exist
      const functionsResult = await client.query(`
        SELECT proname, prosrc IS NOT NULL as exists
        FROM pg_proc 
        WHERE proname IN ('calculate_leaderboard', 'refresh_all_leaderboards', 'get_context_players')
      `);

      diagnostics.system_status.stored_procedures = functionsResult.rows.reduce((acc, row) => {
        acc[row.proname] = row.exists;
        return acc;
      }, {});

      // Check session data for specific user
      const { player_email = 'pop@proofofputt.com' } = req.query;
      
      const playerResult = await client.query(
        'SELECT player_id, name FROM players WHERE email = $1',
        [player_email]
      );

      if (playerResult.rows.length > 0) {
        const playerId = playerResult.rows[0].player_id;
        const playerName = playerResult.rows[0].name;

        diagnostics.session_data.player_info = { 
          player_id: playerId, 
          name: playerName, 
          email: player_email 
        };

        // Check sessions for this player
        const sessionsResult = await client.query(`
          SELECT 
            session_id,
            created_at,
            data->>'total_makes' as total_makes,
            data->>'total_misses' as total_misses,
            data->>'best_streak' as best_streak,
            data->>'makes_per_minute' as makes_per_minute,
            data ? 'total_makes' as has_makes_data,
            data ? 'best_streak' as has_streak_data
          FROM sessions 
          WHERE player_id = $1 
          ORDER BY created_at DESC 
          LIMIT 5
        `, [playerId]);

        diagnostics.session_data.recent_sessions = sessionsResult.rows;
        diagnostics.session_data.session_count = sessionsResult.rows.length;

        // Check if player stats exist
        const statsResult = await client.query(
          'SELECT * FROM player_stats WHERE player_id = $1',
          [playerId]
        );

        diagnostics.session_data.player_stats = statsResult.rows[0] || null;

      } else {
        diagnostics.session_data.player_info = { error: `Player with email ${player_email} not found` };
      }

      // Check leaderboard system if it exists
      const hasV2System = Object.values(diagnostics.system_status.v2_tables).every(exists => exists);
      
      if (hasV2System) {
        // Check contexts
        const contextsResult = await client.query(`
          SELECT context_id, context_type, context_name, is_active
          FROM leaderboard_contexts 
          ORDER BY context_id
        `);
        diagnostics.leaderboard_data.contexts = contextsResult.rows;

        // Check metrics
        const metricsResult = await client.query(`
          SELECT metric_id, metric_name, display_name, is_active
          FROM leaderboard_metrics 
          ORDER BY metric_id
        `);
        diagnostics.leaderboard_data.metrics = metricsResult.rows;

        // Check cache status
        const cacheResult = await client.query(`
          SELECT 
            COUNT(*) as total_entries,
            COUNT(DISTINCT context_id) as contexts_with_cache,
            COUNT(DISTINCT metric_id) as metrics_with_cache,
            COUNT(DISTINCT player_id) as players_with_cache,
            MAX(calculated_at) as last_calculation,
            COUNT(CASE WHEN is_stale = true THEN 1 END) as stale_entries
          FROM leaderboard_cache
        `);
        
        diagnostics.leaderboard_data.cache_status = cacheResult.rows[0];

        // Check specific player's cache entries
        if (diagnostics.session_data.player_info.player_id) {
          const playerCacheResult = await client.query(`
            SELECT 
              lc.context_id,
              ctx.context_name,
              lc.metric_id,
              m.display_name as metric_name,
              lc.metric_value,
              lc.player_rank,
              lc.sessions_count,
              lc.calculated_at,
              lc.is_stale
            FROM leaderboard_cache lc
            JOIN leaderboard_contexts ctx ON lc.context_id = ctx.context_id
            JOIN leaderboard_metrics m ON lc.metric_id = m.metric_id
            WHERE lc.player_id = $1
            ORDER BY lc.context_id, lc.metric_id
          `, [diagnostics.session_data.player_info.player_id]);

          diagnostics.leaderboard_data.player_cache_entries = playerCacheResult.rows;
        }

      } else {
        diagnostics.leaderboard_data.error = 'V2 leaderboard system not fully installed';
      }

      // Generate recommendations
      if (!hasV2System) {
        diagnostics.recommendations.push({
          priority: 'HIGH',
          issue: 'V2 leaderboard system not installed',
          action: 'Run deploy-leaderboard-system-complete.sql in your NeonDB console',
          description: 'The V2 leaderboard system tables and functions are missing'
        });
      } else if (diagnostics.leaderboard_data.cache_status?.total_entries == 0) {
        diagnostics.recommendations.push({
          priority: 'HIGH',
          issue: 'Leaderboard cache is empty',
          action: 'Call POST /api/refresh-leaderboards to populate cache',
          description: 'No calculated leaderboard data found in cache'
        });
      } else if (diagnostics.leaderboard_data.cache_status?.stale_entries > 0) {
        diagnostics.recommendations.push({
          priority: 'MEDIUM',
          issue: 'Some cache entries are stale',
          action: 'Call POST /api/refresh-leaderboards to update cache',
          description: `${diagnostics.leaderboard_data.cache_status.stale_entries} stale cache entries found`
        });
      }

      if (diagnostics.session_data.session_count > 0 && 
          diagnostics.leaderboard_data.player_cache_entries?.length === 0) {
        diagnostics.recommendations.push({
          priority: 'HIGH',
          issue: 'Player has sessions but no leaderboard entries',
          action: 'Call POST /api/refresh-leaderboards to recalculate',
          description: 'Session data exists but player is not in leaderboard cache'
        });
      }

      if (!Object.values(diagnostics.system_status.stored_procedures || {}).every(exists => exists)) {
        diagnostics.recommendations.push({
          priority: 'HIGH',
          issue: 'Missing stored procedures',
          action: 'Run deploy-leaderboard-system-complete.sql to install calculation functions',
          description: 'Leaderboard calculation functions are not installed'
        });
      }

    } finally {
      client.release();
    }

    return res.status(200).json({
      success: true,
      diagnostics
    });

  } catch (error) {
    console.error('Leaderboard diagnosis error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during leaderboard diagnosis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}