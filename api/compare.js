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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { player1_id, player2_id } = req.query;

  if (!player1_id || !player2_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Both player1_id and player2_id are required' 
    });
  }

  const client = await pool.connect();

  try {
    // Get both players' basic info
    const playersResult = await client.query(
      `SELECT player_id, name, email FROM players 
       WHERE player_id IN ($1, $2)`,
      [parseInt(player1_id), parseInt(player2_id)]
    );

    if (playersResult.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        message: 'One or both players not found'
      });
    }

    const players = playersResult.rows;
    const player1 = players.find(p => p.player_id === parseInt(player1_id));
    const player2 = players.find(p => p.player_id === parseInt(player2_id));

    // Get aggregate stats for both players
    const statsResult = await client.query(`
      SELECT 
        player_id,
        COUNT(session_id) as total_sessions,
        COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as sum_makes,
        COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as sum_misses,
        COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as high_best_streak,
        COALESCE(AVG(CAST(data->>'putts_per_minute' AS DECIMAL)), 0) as avg_ppm,
        COALESCE(AVG(
          CASE 
            WHEN (CAST(data->>'total_makes' AS INTEGER) + CAST(data->>'total_misses' AS INTEGER)) > 0
            THEN (CAST(data->>'total_makes' AS DECIMAL) / (CAST(data->>'total_makes' AS INTEGER) + CAST(data->>'total_misses' AS INTEGER))) * 100
            ELSE 0
          END
        ), 0) as avg_accuracy
      FROM sessions 
      WHERE player_id IN ($1, $2)
      AND data IS NOT NULL
      GROUP BY player_id
    `, [parseInt(player1_id), parseInt(player2_id)]);

    // Get head-to-head duel results
    const duelsResult = await client.query(`
      SELECT 
        creator_id,
        invited_player_id,
        creator_score,
        invited_player_score,
        status,
        winner_id
      FROM duels 
      WHERE (creator_id = $1 AND invited_player_id = $2)
         OR (creator_id = $2 AND invited_player_id = $1)
      AND status = 'completed'
    `, [parseInt(player1_id), parseInt(player2_id)]);

    // Process stats for both players
    const getPlayerStats = (playerId, playerName) => {
      const stats = statsResult.rows.find(s => s.player_id === playerId);
      return {
        player_name: playerName,
        player_id: playerId,
        sum_makes: stats?.sum_makes || 0,
        sum_misses: stats?.sum_misses || 0,
        high_best_streak: stats?.high_best_streak || 0,
        avg_ppm: parseFloat(stats?.avg_ppm || 0),
        avg_accuracy: parseFloat(stats?.avg_accuracy || 0),
        total_sessions: stats?.total_sessions || 0
      };
    };

    // Calculate head-to-head record
    let player1_wins = 0;
    let player2_wins = 0;

    duelsResult.rows.forEach(duel => {
      if (duel.winner_id === parseInt(player1_id)) {
        player1_wins++;
      } else if (duel.winner_id === parseInt(player2_id)) {
        player2_wins++;
      }
    });

    // Get recent duels for history table
    const duelHistoryResult = await client.query(`
      SELECT 
        duel_id,
        creator_id,
        invited_player_id,
        creator_score,
        invited_player_score,
        status,
        winner_id,
        created_at,
        completed_at,
        settings
      FROM duels 
      WHERE (creator_id = $1 AND invited_player_id = $2)
         OR (creator_id = $2 AND invited_player_id = $1)
      ORDER BY created_at DESC
      LIMIT 10
    `, [parseInt(player1_id), parseInt(player2_id)]);

    const comparisonData = {
      player1_stats: getPlayerStats(parseInt(player1_id), player1.name),
      player2_stats: getPlayerStats(parseInt(player2_id), player2.name),
      h2h: {
        player1_wins,
        player2_wins,
        total_completed_duels: duelsResult.rows.length,
        total_duels: duelHistoryResult.rows.length
      },
      duel_history: duelHistoryResult.rows.map(duel => ({
        duel_id: duel.duel_id,
        creator_id: duel.creator_id,
        invited_player_id: duel.invited_player_id,
        creator_score: duel.creator_score,
        invited_player_score: duel.invited_player_score,
        status: duel.status,
        winner_id: duel.winner_id,
        created_at: duel.created_at,
        completed_at: duel.completed_at,
        settings: duel.settings
      }))
    };

    return res.status(200).json({
      success: true,
      ...comparisonData
    });

  } catch (error) {
    console.error('[compare] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}