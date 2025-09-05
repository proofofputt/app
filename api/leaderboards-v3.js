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

/**
 * Generate real leaderboard data from database
 */
async function generateLeaderboard(client, options) {
  const { context_type = 'global', context_id, metric = 'total_makes', limit = 10, player_id, include_player_rank = false } = options;

  // Map metric names to database columns and sort order
  const metricConfig = {
    'total_makes': { column: 'ps.total_makes', sort: 'DESC', display: 'Total Makes', unit: 'putts' },
    'best_streak': { column: 'ps.best_streak', sort: 'DESC', display: 'Best Streak', unit: 'consecutive' },
    'make_percentage': { column: 'ps.make_percentage', sort: 'DESC', display: 'Make Percentage', unit: '%' },
    'total_sessions': { column: 'ps.total_sessions', sort: 'DESC', display: 'Total Sessions', unit: 'sessions' },
    'makes_per_minute': { 
      column: `CASE 
        WHEN session_duration.total_duration > 0 
        THEN ROUND((ps.total_makes::decimal / session_duration.total_duration) * 60, 2) 
        ELSE 0 
      END`, 
      sort: 'DESC', 
      display: 'Makes Per Minute', 
      unit: 'per min',
      join: `LEFT JOIN (
        SELECT 
          player_id, 
          SUM((data->>'session_duration')::decimal) as total_duration
        FROM sessions 
        WHERE data->>'session_duration' IS NOT NULL 
        GROUP BY player_id
      ) session_duration ON ps.player_id = session_duration.player_id`
    },
    'fastest_21': {
      column: `COALESCE(fastest.fastest_21_makes, 999999)`,
      sort: 'ASC',
      display: 'Fastest 21 Makes',
      unit: 'seconds',
      join: `LEFT JOIN (
        SELECT 
          player_id,
          MIN((data->>'fastest_21_makes')::decimal) as fastest_21_makes
        FROM sessions 
        WHERE data->>'fastest_21_makes' IS NOT NULL 
          AND (data->>'fastest_21_makes')::decimal < 999999
        GROUP BY player_id
      ) fastest ON ps.player_id = fastest.player_id`
    }
  };

  const config = metricConfig[metric];
  if (!config) {
    throw new Error(`Invalid metric: ${metric}. Supported metrics: ${Object.keys(metricConfig).join(', ')}`);
  }
  
  try {
    // Base query with joins
    let joins = config.join || '';
    let whereClause = 'WHERE ps.total_putts > 0';
    
    // Add context filtering
    if (context_type === 'friends' && player_id) {
      joins += ` INNER JOIN friendships f ON (f.user_id = ${parseInt(player_id)} AND f.friend_id = ps.player_id AND f.status = 'accepted')`;
    } else if (context_type === 'league' && context_id) {
      joins += ` INNER JOIN league_memberships lm ON (lm.league_id = ${parseInt(context_id)} AND lm.player_id = ps.player_id AND lm.is_active = true)`;
    } else if (context_type === 'custom' && context_id) {
      joins += ` INNER JOIN context_memberships cm ON (cm.context_id = ${parseInt(context_id)} AND cm.player_id = ps.player_id)`;
    }

    const query = `
      SELECT 
        ps.player_id,
        COALESCE(u.display_name, u.username, 'Player ' || ps.player_id) as player_name,
        ${config.column} as value,
        ps.total_sessions as sessions_count,
        ROW_NUMBER() OVER (ORDER BY ${config.column} ${config.sort}, ps.player_id ASC) as rank
      FROM player_stats ps
      LEFT JOIN users u ON ps.player_id = u.id
      ${joins}
      ${whereClause}
      ORDER BY ${config.column} ${config.sort}, ps.player_id ASC 
      LIMIT $1
    `;

    console.log('[leaderboards-v3] Executing query:', query);
    const result = await client.query(query, [limit]);
    
    // Get player's specific rank if requested
    let playerRank = null;
    if (include_player_rank && player_id) {
      const playerRankQuery = `
        WITH ranked_players AS (
          SELECT 
            ps.player_id,
            ${config.column} as value,
            ps.total_sessions as sessions_count,
            ROW_NUMBER() OVER (ORDER BY ${config.column} ${config.sort}, ps.player_id ASC) as rank
          FROM player_stats ps
          LEFT JOIN users u ON ps.player_id = u.id
          ${joins}
          ${whereClause}
        )
        SELECT rank, value, sessions_count
        FROM ranked_players
        WHERE player_id = $1
      `;
      
      const playerRankResult = await client.query(playerRankQuery, [player_id]);
      if (playerRankResult.rows.length > 0) {
        playerRank = {
          rank: parseInt(playerRankResult.rows[0].rank),
          value: parseFloat(playerRankResult.rows[0].value || 0),
          sessions_count: parseInt(playerRankResult.rows[0].sessions_count)
        };
      }
    }

    const leaderboard = result.rows.map(row => ({
      player_id: parseInt(row.player_id),
      player_name: row.player_name,
      value: parseFloat(row.value || 0),
      sessions_count: parseInt(row.sessions_count || 0),
      rank: parseInt(row.rank)
    }));

    const response = {
      success: true,
      leaderboard,
      context: {
        context_id: context_id || 1,
        context_name: context_type === 'global' ? 'All Players' : 
                     context_type === 'friends' ? 'Friends Network' : 
                     context_type === 'league' ? 'League Members' : 'Custom Group',
        context_type: context_type,
        description: `${context_type === 'global' ? 'Global' : context_type === 'friends' ? 'Friends' : context_type === 'league' ? 'League' : 'Custom'} leaderboard for ${config.display.toLowerCase()}`
      },
      metric: {
        name: metric,
        display_name: config.display,
        unit: config.unit,
        sort_order: config.sort.toLowerCase()
      },
      total_results: leaderboard.length,
      generated_at: new Date().toISOString()
    };

    if (playerRank) {
      response.player_rank = playerRank;
    }

    return response;

  } catch (error) {
    console.error('[leaderboards-v3] Error generating leaderboard:', error);
    throw new Error(`Failed to generate leaderboard: ${error.message}`);
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      console.log('[leaderboards-v3] Request received:', req.query);
      
      const { 
        context_type = 'global', 
        context_id,
        player_id,
        metric = 'total_makes',
        limit = 10,
        include_player_rank = 'false'
      } = req.query;

      const leaderboardData = await generateLeaderboard(client, {
        context_type,
        context_id,
        metric,
        limit: parseInt(limit),
        player_id: player_id ? parseInt(player_id) : null,
        include_player_rank: include_player_rank === 'true'
      });

      console.log('[leaderboards-v3] Generated leaderboard with', leaderboardData.leaderboard.length, 'players');
      return res.status(200).json(leaderboardData);
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('[leaderboards-v3] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}