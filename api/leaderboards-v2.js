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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const client = await pool.connect();
    
    if (req.method === 'GET') {
      await handleGetLeaderboard(req, res, client);
    } else if (req.method === 'POST') {
      await handleCreateContext(req, res, client);
    } else {
      client.release();
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
    
    client.release();
  } catch (error) {
    console.error('Leaderboards V2 API error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An internal server error occurred.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleGetLeaderboard(req, res, client) {
  const { 
    context_type = 'global', 
    context_id,
    player_id,
    metric = 'total_makes',
    limit = 10,
    include_player_rank = 'true'
  } = req.query;

  let resolvedContextId = context_id;

  // If no context_id provided, try to resolve from context_type
  if (!context_id) {
    if (context_type === 'global') {
      // Get the default global context
      const contextResult = await client.query(
        `SELECT context_id FROM leaderboard_contexts 
         WHERE context_type = 'global' AND context_name = 'All Players' 
         LIMIT 1`
      );
      resolvedContextId = contextResult.rows[0]?.context_id;
    } else if (context_type === 'friends' && player_id) {
      // Create or get friends context for this player
      const contextResult = await client.query(
        `SELECT context_id FROM leaderboard_contexts 
         WHERE context_type = 'friends' 
         AND context_config->>'player_id' = $1 
         LIMIT 1`,
        [player_id]
      );
      
      if (contextResult.rows.length === 0) {
        // Create friends context
        const createResult = await client.query(
          'SELECT create_friends_context($1) as context_id',
          [player_id]
        );
        resolvedContextId = createResult.rows[0].context_id;
      } else {
        resolvedContextId = contextResult.rows[0].context_id;
      }
    }
  }

  if (!resolvedContextId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Could not resolve leaderboard context' 
    });
  }

  // Get metric_id
  const metricResult = await client.query(
    'SELECT metric_id, display_name, unit, sort_order FROM leaderboard_metrics WHERE metric_name = $1',
    [metric]
  );
  
  if (metricResult.rows.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid metric: ${metric}` 
    });
  }

  const metricInfo = metricResult.rows[0];

  // Calculate leaderboard - try stored procedure first, fallback to direct query
  let leaderboardResult;
  try {
    leaderboardResult = await client.query(
      'SELECT * FROM calculate_leaderboard($1, $2) LIMIT $3',
      [resolvedContextId, metricInfo.metric_id, limit]
    );
  } catch (err) {
    // Fallback to direct query if stored procedure doesn't exist
    console.log('Stored procedure not found, using direct query');
    
    // Build the appropriate query based on metric
    let query;
    if (metric === 'total_makes') {
      query = `
        SELECT 
          s.player_id,
          p.name as player_name,
          SUM(CAST(s.data->>'total_makes' AS INTEGER)) as metric_value,
          COUNT(s.session_id) as sessions_count,
          ROW_NUMBER() OVER (ORDER BY SUM(CAST(s.data->>'total_makes' AS INTEGER)) DESC) as player_rank
        FROM sessions s
        JOIN players p ON s.player_id = p.player_id
        WHERE s.data->>'total_makes' IS NOT NULL
        GROUP BY s.player_id, p.name
        HAVING SUM(CAST(s.data->>'total_makes' AS INTEGER)) > 0
        ORDER BY metric_value DESC
        LIMIT $1
      `;
      leaderboardResult = await client.query(query, [limit]);
    } else if (metric === 'best_streak') {
      query = `
        SELECT 
          s.player_id,
          p.name as player_name,
          MAX(CAST(s.data->>'best_streak' AS INTEGER)) as metric_value,
          COUNT(s.session_id) as sessions_count,
          ROW_NUMBER() OVER (ORDER BY MAX(CAST(s.data->>'best_streak' AS INTEGER)) DESC) as player_rank
        FROM sessions s
        JOIN players p ON s.player_id = p.player_id
        WHERE s.data->>'best_streak' IS NOT NULL
        GROUP BY s.player_id, p.name
        HAVING MAX(CAST(s.data->>'best_streak' AS INTEGER)) > 0
        ORDER BY metric_value DESC
        LIMIT $1
      `;
      leaderboardResult = await client.query(query, [limit]);
    } else if (metric === 'makes_per_minute') {
      query = `
        SELECT 
          s.player_id,
          p.name as player_name,
          MAX(CAST(s.data->>'makes_per_minute' AS DECIMAL)) as metric_value,
          COUNT(s.session_id) as sessions_count,
          ROW_NUMBER() OVER (ORDER BY MAX(CAST(s.data->>'makes_per_minute' AS DECIMAL)) DESC) as player_rank
        FROM sessions s
        JOIN players p ON s.player_id = p.player_id
        WHERE s.data->>'makes_per_minute' IS NOT NULL
        GROUP BY s.player_id, p.name
        HAVING MAX(CAST(s.data->>'makes_per_minute' AS DECIMAL)) > 0
        ORDER BY metric_value DESC
        LIMIT $1
      `;
      leaderboardResult = await client.query(query, [limit]);
    } else if (metric === 'fastest_21_makes_seconds' || metric === 'fastest_21') {
      query = `
        SELECT 
          s.player_id,
          p.name as player_name,
          MIN(CAST(s.data->>'fastest_21_makes_seconds' AS DECIMAL)) as metric_value,
          COUNT(s.session_id) as sessions_count,
          ROW_NUMBER() OVER (ORDER BY MIN(CAST(s.data->>'fastest_21_makes_seconds' AS DECIMAL)) ASC) as player_rank
        FROM sessions s
        JOIN players p ON s.player_id = p.player_id
        WHERE s.data->>'fastest_21_makes_seconds' IS NOT NULL 
        AND CAST(s.data->>'fastest_21_makes_seconds' AS DECIMAL) > 0
        GROUP BY s.player_id, p.name
        ORDER BY metric_value ASC
        LIMIT $1
      `;
      leaderboardResult = await client.query(query, [limit]);
    } else {
      // Default fallback for unknown metrics
      leaderboardResult = { rows: [] };
    }
  }

  const leaderboard = leaderboardResult.rows.map(row => ({
    player_id: row.player_id,
    player_name: row.player_name,
    value: parseFloat(row.metric_value),
    sessions_count: row.sessions_count,
    rank: row.player_rank
  }));

  // Get player's rank if requested
  let playerRank = null;
  if (include_player_rank === 'true' && player_id) {
    const playerRankResult = await client.query(
      `SELECT player_rank, metric_value, sessions_count 
       FROM leaderboard_cache 
       WHERE context_id = $1 AND metric_id = $2 AND player_id = $3`,
      [resolvedContextId, metricInfo.metric_id, player_id]
    );
    
    if (playerRankResult.rows.length > 0) {
      const playerData = playerRankResult.rows[0];
      playerRank = {
        rank: playerData.player_rank,
        value: parseFloat(playerData.metric_value),
        sessions_count: playerData.sessions_count
      };
    }
  }

  // Get context info
  const contextResult = await client.query(
    'SELECT context_name, context_type, description FROM leaderboard_contexts WHERE context_id = $1',
    [resolvedContextId]
  );

  return res.status(200).json({
    success: true,
    leaderboard,
    context: {
      context_id: resolvedContextId,
      ...contextResult.rows[0]
    },
    metric: {
      name: metric,
      display_name: metricInfo.display_name,
      unit: metricInfo.unit,
      sort_order: metricInfo.sort_order
    },
    player_rank: playerRank,
    total_results: leaderboard.length
  });
}

async function handleCreateContext(req, res, client) {
  // Verify authentication for context creation
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { context_type, name, description, config } = req.body;

  if (!context_type || !name) {
    return res.status(400).json({ 
      success: false, 
      message: 'context_type and name are required' 
    });
  }

  // Insert new context
  const result = await client.query(
    `INSERT INTO leaderboard_contexts 
     (context_type, context_name, description, created_by_player_id, context_config)
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING context_id, context_name`,
    [context_type, name, description || null, user.playerId, config || '{}']
  );

  const newContext = result.rows[0];

  // Trigger initial calculation for all metrics
  await client.query('SELECT refresh_all_leaderboards($1)', [newContext.context_id]);

  return res.status(201).json({
    success: true,
    message: 'Leaderboard context created successfully',
    context: newContext
  });
}