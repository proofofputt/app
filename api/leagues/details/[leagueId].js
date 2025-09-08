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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { leagueId } = req.query;
  const leagueIdInt = parseInt(leagueId);

  if (!leagueIdInt) {
    return res.status(400).json({ success: false, message: 'Valid league ID is required' });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('League details API: Database connected successfully');

    // Get league details
    const leagueResult = await client.query(`
      SELECT 
        l.league_id,
        l.name,
        l.description,
        l.status,
        l.privacy_level,
        l.created_at,
        l.created_by,
        l.rules,
        l.started_at,
        creator.name as creator_name,
        (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id AND is_active = true) as member_count
      FROM leagues l
      JOIN players creator ON l.created_by = creator.player_id
      WHERE l.league_id = $1
    `, [leagueIdInt]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    const league = leagueResult.rows[0];

    // Get league members
    const membersResult = await client.query(`
      SELECT 
        p.player_id,
        p.name,
        lm.joined_at,
        lm.member_role,
        lm.is_active
      FROM league_memberships lm
      JOIN players p ON lm.player_id = p.player_id
      WHERE lm.league_id = $1 AND lm.is_active = true
      ORDER BY lm.joined_at ASC
    `, [leagueIdInt]);

    // Get league rounds if they exist
    const roundsResult = await client.query(`
      SELECT 
        round_id,
        round_number,
        start_time,
        end_time,
        status,
        scoring_completed
      FROM league_rounds
      WHERE league_id = $1
      ORDER BY round_number ASC
    `, [leagueIdInt]);

    // Get round submissions for each round
    const rounds = [];
    for (const round of roundsResult.rows) {
      const submissionsResult = await client.query(`
        SELECT 
          lrs.session_id,
          lrs.player_id as player_id,
          lrs.submitted_at,
          lrs.round_score as score,
          lrs.round_score as points_awarded,
          lrs.session_data
        FROM league_round_sessions lrs
        WHERE lrs.round_id = $1
        ORDER BY lrs.submitted_at ASC
      `, [round.round_id]);

      rounds.push({
        ...round,
        submissions: submissionsResult.rows || []
      });
    }

    // Parse rules JSON and rename to settings for frontend compatibility
    let settings = {
      time_limit_minutes: 60,
      num_rounds: 4,
      round_duration_hours: 168,
      allow_late_joiners: false,
      allow_player_invites: false
    };

    // Merge with actual rules if they exist
    if (league.rules && typeof league.rules === 'object') {
      settings = { ...settings, ...league.rules };
    } else if (league.rules && typeof league.rules === 'string') {
      try {
        const parsedRules = JSON.parse(league.rules);
        settings = { ...settings, ...parsedRules };
      } catch (e) {
        console.log('Failed to parse league rules JSON:', league.rules);
      }
    }

    // Structure the response to match what the frontend expects
    const responseData = {
      league_id: league.league_id,
      name: league.name,
      description: league.description,
      status: league.status,
      privacy_type: league.privacy_level || 'public',
      created_at: league.created_at,
      created_by: league.created_by,
      creator_id: league.created_by,
      creator_name: league.creator_name,
      start_time: league.started_at,
      settings: settings,
      member_count: parseInt(league.member_count),
      members: membersResult.rows || [],
      rounds: rounds || []
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('League details API error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to load league details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}