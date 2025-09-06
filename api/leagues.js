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
      const { player_id } = req.query;

      if (!player_id) {
        client.release();
        return res.status(400).json({ success: false, message: 'player_id is required' });
      }

      // Get leagues where player is a member
      const memberLeaguesResult = await client.query(`
        SELECT 
          l.league_id,
          l.name,
          l.description,
          l.status,
          l.created_at,
          l.created_by_player_id,
          l.settings,
          creator.name as creator_name,
          lm.joined_at,
          (SELECT COUNT(*) FROM league_members WHERE league_id = l.league_id) as member_count,
          (
            SELECT lr.round_number 
            FROM league_rounds lr 
            WHERE lr.league_id = l.league_id 
            AND lr.status = 'active' 
            LIMIT 1
          ) as active_round_number
        FROM leagues l
        JOIN league_members lm ON l.league_id = lm.league_id
        JOIN players creator ON l.created_by_player_id = creator.player_id
        WHERE lm.player_id = $1
        ORDER BY l.created_at DESC
      `, [player_id]);

      // Get public leagues player is not a member of
      const publicLeaguesResult = await client.query(`
        SELECT 
          l.league_id,
          l.name,
          l.description,
          l.status,
          l.created_at,
          l.created_by_player_id,
          l.settings,
          creator.name as creator_name,
          (SELECT COUNT(*) FROM league_members WHERE league_id = l.league_id) as member_count,
          (
            SELECT lr.round_number 
            FROM league_rounds lr 
            WHERE lr.league_id = l.league_id 
            AND lr.status = 'active' 
            LIMIT 1
          ) as active_round_number
        FROM leagues l
        JOIN players creator ON l.created_by_player_id = creator.player_id
        WHERE l.settings->>'privacy' = 'public'
        AND l.league_id NOT IN (
          SELECT league_id FROM league_members WHERE player_id = $1
        )
        AND l.status = 'active'
        ORDER BY l.created_at DESC
        LIMIT 20
      `, [player_id]);

      client.release();

      return res.status(200).json({
        success: true,
        my_leagues: memberLeaguesResult.rows,
        public_leagues: publicLeaguesResult.rows
      });

    } else if (req.method === 'POST') {
      // Verify authentication for league creation
      const user = await verifyToken(req);
      if (!user) {
        client.release();
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { name, description, settings } = req.body;

      if (!name) {
        client.release();
        return res.status(400).json({ success: false, message: 'League name is required' });
      }

      // Create league with default settings
      const defaultSettings = {
        privacy: 'public',
        num_rounds: 4,
        round_duration_hours: 168, // 1 week
        time_limit_minutes: 30,
        scoring_type: 'total_makes',
        allow_late_joiners: true,
        allow_player_invites: true,
        ...settings
      };

      const leagueResult = await client.query(`
        INSERT INTO leagues (name, description, created_by_player_id, settings, status, created_at)
        VALUES ($1, $2, $3, $4, 'setup', $5)
        RETURNING league_id, name, description, settings
      `, [name, description, user.playerId, JSON.stringify(defaultSettings), new Date()]);

      const league = leagueResult.rows[0];

      // Add creator as first member
      await client.query(`
        INSERT INTO league_members (league_id, player_id, joined_at)
        VALUES ($1, $2, $3)
      `, [league.league_id, user.playerId, new Date()]);

      client.release();

      return res.status(201).json({
        success: true,
        message: 'League created successfully',
        league: {
          league_id: league.league_id,
          name: league.name,
          description: league.description,
          settings: league.settings,
          status: 'setup'
        }
      });

    } else {
      client.release();
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

  } catch (error) {
    console.error('Leagues API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}