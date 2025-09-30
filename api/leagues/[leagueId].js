import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    console.log('League API: Database connected successfully');

    if (req.method === 'GET') {
      return await handleGetLeagueDetails(req, res, client);
    } else if (req.method === 'DELETE') {
      return await handleLeagueAction(req, res, client);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

  } catch (error) {
    console.error('League API error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}

async function handleGetLeagueDetails(req, res, client) {
  const { leagueId } = req.query;
  const leagueIdInt = parseInt(leagueId);

  if (!leagueIdInt) {
    return res.status(400).json({ success: false, message: 'Valid league ID is required' });
  }

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
      creator.name as creator_name,
      (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id) as member_count
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
      lm.member_role
    FROM league_memberships lm
    JOIN players p ON lm.player_id = p.player_id
    WHERE lm.league_id = $1
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
    allow_late_joiners: true, // Default to true for better participation - matches creation API
    allow_player_invites: false,
    allow_catch_up_submissions: true // Default to allowing catch-up for better continuity
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
    start_time: null,
    settings: settings,
    member_count: parseInt(league.member_count),
    members: membersResult.rows || [],
    rounds: rounds || []
  };

  return res.status(200).json(responseData);
}

async function handleLeagueAction(req, res, client) {
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { leagueId } = req.query;
  const { action } = req.body;
  const leagueIdInt = parseInt(leagueId);

  if (!leagueIdInt) {
    return res.status(400).json({ success: false, message: 'Valid league ID is required' });
  }

  if (!action) {
    return res.status(400).json({ success: false, message: 'Action is required' });
  }

  // Get league details and user's relationship
  const leagueResult = await client.query(`
    SELECT
      l.league_id,
      l.name,
      l.created_by,
      l.status,
      lm.player_id as is_member
    FROM leagues l
    LEFT JOIN league_memberships lm ON l.league_id = lm.league_id AND lm.player_id = $2
    WHERE l.league_id = $1
  `, [leagueIdInt, user.playerId]);

  if (leagueResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'League not found' });
  }

  const league = leagueResult.rows[0];
  const isCreator = league.created_by === user.playerId;
  const isMember = league.is_member !== null;

  if (action === 'leave') {
    // Handle leaving league
    if (!isMember) {
      return res.status(400).json({ success: false, message: 'You are not a member of this league' });
    }

    if (isCreator) {
      return res.status(400).json({
        success: false,
        message: 'League creators cannot leave their own league. Delete the league instead.'
      });
    }

    // Remove player from league
    await client.query(`
      DELETE FROM league_memberships
      WHERE league_id = $1 AND player_id = $2
    `, [leagueIdInt, user.playerId]);

    return res.status(200).json({
      success: true,
      message: `Successfully left league "${league.name}"`
    });

  } else if (action === 'delete') {
    // Handle deleting league
    if (!isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the league creator can delete the league'
      });
    }

    // Delete league and all related data (cascading should handle most of this)
    await client.query('BEGIN');

    try {
      // Delete round sessions
      await client.query(`
        DELETE FROM league_round_sessions
        WHERE round_id IN (
          SELECT round_id FROM league_rounds WHERE league_id = $1
        )
      `, [leagueIdInt]);

      // Delete league rounds
      await client.query(`
        DELETE FROM league_rounds WHERE league_id = $1
      `, [leagueIdInt]);

      // Delete league memberships
      await client.query(`
        DELETE FROM league_memberships WHERE league_id = $1
      `, [leagueIdInt]);

      // Delete the league itself
      await client.query(`
        DELETE FROM leagues WHERE league_id = $1
      `, [leagueIdInt]);

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `League "${league.name}" has been permanently deleted`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Supported actions: leave, delete'
    });
  }
}