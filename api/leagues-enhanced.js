import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
 * Generate secure invitation token for league invitations
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate comprehensive league standings with multiple metrics
 */
async function calculateEnhancedLeagueStandings(client, leagueId, options = {}) {
  const {
    roundId = null,
    sortBy = 'total_score',
    sortOrder = 'DESC',
    includeInactive = false,
    minSessions = 0
  } = options;

  let sessionFilter = '';
  let params = [leagueId];
  let paramIndex = 2;

  if (roundId) {
    sessionFilter = 'AND lrs.round_id = $' + paramIndex;
    params.push(roundId);
    paramIndex++;
  }

  if (minSessions > 0) {
    sessionFilter += ' HAVING COUNT(lrs.session_id) >= $' + paramIndex;
    params.push(minSessions);
    paramIndex++;
  }

  const query = `
    WITH session_stats AS (
      SELECT 
        lm.player_id,
        COUNT(lrs.session_id) as total_sessions,
        SUM((lrs.session_data->>'total_makes')::integer) as cumulative_makes,
        AVG((lrs.session_data->>'make_percentage')::decimal) as avg_percentage,
        MAX((lrs.session_data->>'best_streak')::integer) as best_streak,
        MIN((lrs.session_data->>'fastest_21_makes')::decimal) as fastest_21,
        STDDEV((lrs.session_data->>'make_percentage')::decimal) as consistency_score,
        SUM(lrs.round_score) as total_round_score,
        AVG(lrs.round_score) as avg_round_score,
        MAX(lrs.round_score) as best_round_score,
        MIN(lrs.submitted_at) as first_session_date,
        MAX(lrs.submitted_at) as last_session_date
      FROM league_memberships lm
      LEFT JOIN league_round_sessions lrs ON lm.league_id = lrs.league_id AND lm.player_id = lrs.player_id
      WHERE lm.league_id = $1 
        AND (lm.is_active = true ${includeInactive ? 'OR lm.is_active = false' : ''})
        ${sessionFilter}
      GROUP BY lm.player_id
      ${minSessions > 0 ? sessionFilter.split('HAVING')[1] : ''}
    )
    SELECT 
      lm.player_id,
      u.display_name as player_name,
      u.username,
      lm.member_role,
      lm.joined_at,
      lm.total_score as official_total_score,
      lm.current_rank as official_rank,
      lm.sessions_this_round,
      lm.last_activity,
      COALESCE(ss.total_sessions, 0) as session_count,
      COALESCE(ss.cumulative_makes, 0) as total_makes,
      COALESCE(ss.avg_percentage, 0) as avg_make_percentage,
      COALESCE(ss.best_streak, 0) as best_streak,
      COALESCE(ss.fastest_21, 999999) as fastest_21_seconds,
      COALESCE(ss.consistency_score, 0) as consistency_rating,
      COALESCE(ss.total_round_score, 0) as calculated_total_score,
      COALESCE(ss.avg_round_score, 0) as avg_round_score,
      COALESCE(ss.best_round_score, 0) as best_round_score,
      ss.first_session_date,
      ss.last_session_date,
      -- Performance ratings (0-100 scale)
      CASE 
        WHEN ss.avg_percentage IS NULL THEN 0
        ELSE ROUND(LEAST(ss.avg_percentage, 100)::numeric, 1)
      END as performance_rating,
      -- Activity rating based on session frequency
      CASE 
        WHEN ss.total_sessions IS NULL OR ss.total_sessions = 0 THEN 0
        WHEN EXTRACT(EPOCH FROM (NOW() - ss.first_session_date))/86400 <= 1 THEN 100
        ELSE ROUND(LEAST(100, (ss.total_sessions::decimal / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - ss.first_session_date))/86400)) * 10)::numeric, 1)
      END as activity_rating
    FROM league_memberships lm
    JOIN users u ON lm.player_id = u.id
    LEFT JOIN session_stats ss ON lm.player_id = ss.player_id
    WHERE lm.league_id = $1 
      AND (lm.is_active = true ${includeInactive ? 'OR lm.is_active = false' : ''})
    ORDER BY 
      CASE 
        WHEN '${sortBy}' = 'total_makes' THEN COALESCE(ss.cumulative_makes, 0)
        WHEN '${sortBy}' = 'avg_percentage' THEN COALESCE(ss.avg_percentage, 0)
        WHEN '${sortBy}' = 'best_streak' THEN COALESCE(ss.best_streak, 0)
        WHEN '${sortBy}' = 'fastest_21' AND '${sortOrder}' = 'DESC' THEN -COALESCE(ss.fastest_21, 999999)
        WHEN '${sortBy}' = 'fastest_21' THEN COALESCE(ss.fastest_21, 999999)
        WHEN '${sortBy}' = 'consistency' THEN COALESCE(1.0/NULLIF(ss.consistency_score, 0), 0)
        WHEN '${sortBy}' = 'activity_rating' THEN CASE 
          WHEN ss.total_sessions IS NULL OR ss.total_sessions = 0 THEN 0
          ELSE ROUND(LEAST(100, (ss.total_sessions::decimal / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - ss.first_session_date))/86400)) * 10)::numeric, 1)
        END
        WHEN '${sortBy}' = 'performance_rating' THEN COALESCE(ss.avg_percentage, 0)
        WHEN '${sortBy}' = 'joined_date' THEN EXTRACT(EPOCH FROM lm.joined_at)
        ELSE COALESCE(ss.total_round_score, lm.total_score, 0)
      END ${sortOrder},
      lm.joined_at ASC
  `;

  const result = await client.query(query, params);
  
  return result.rows.map((row, index) => ({
    rank: index + 1,
    player_id: row.player_id,
    player_name: row.player_name || `Player ${row.player_id}`,
    username: row.username,
    member_role: row.member_role,
    joined_at: row.joined_at,
    session_count: parseInt(row.session_count),
    sessions_this_round: parseInt(row.sessions_this_round || 0),
    last_activity: row.last_activity,
    
    // Scoring metrics
    total_makes: parseInt(row.total_makes || 0),
    avg_make_percentage: parseFloat(row.avg_make_percentage || 0),
    best_streak: parseInt(row.best_streak || 0),
    fastest_21_seconds: parseFloat(row.fastest_21_seconds || 999999),
    consistency_rating: parseFloat(row.consistency_rating || 0),
    
    // League scores
    official_total_score: parseFloat(row.official_total_score || 0),
    calculated_total_score: parseFloat(row.calculated_total_score || 0),
    avg_round_score: parseFloat(row.avg_round_score || 0),
    best_round_score: parseFloat(row.best_round_score || 0),
    official_rank: row.official_rank,
    
    // Ratings
    performance_rating: parseFloat(row.performance_rating || 0),
    activity_rating: parseFloat(row.activity_rating || 0),
    
    // Timestamps
    first_session_date: row.first_session_date,
    last_session_date: row.last_session_date,
    
    // Status indicators
    is_active: row.session_count > 0,
    is_regular: row.session_count >= 3,
    needs_sessions: (row.sessions_this_round || 0) === 0
  }));
}

/**
 * Get league rounds with session statistics
 */
async function getLeagueRounds(client, leagueId, includeStats = true) {
  const roundsQuery = `
    SELECT 
      lr.*,
      COUNT(lrs.session_id) as session_count,
      COUNT(DISTINCT lrs.player_id) as participating_players,
      MAX(lrs.round_score) as highest_round_score,
      AVG(lrs.round_score) as avg_round_score
    FROM league_rounds lr
    LEFT JOIN league_round_sessions lrs ON lr.round_id = lrs.round_id
    WHERE lr.league_id = $1
    GROUP BY lr.round_id, lr.league_id, lr.round_number, lr.start_time, 
             lr.end_time, lr.status, lr.scoring_completed, lr.round_config,
             lr.created_at, lr.updated_at
    ORDER BY lr.round_number
  `;

  const result = await client.query(roundsQuery, [leagueId]);
  
  return result.rows.map(round => ({
    round_id: round.round_id,
    round_number: round.round_number,
    start_time: round.start_time,
    end_time: round.end_time,
    status: round.status,
    scoring_completed: round.scoring_completed,
    round_config: round.round_config || {},
    session_count: parseInt(round.session_count || 0),
    participating_players: parseInt(round.participating_players || 0),
    highest_round_score: parseFloat(round.highest_round_score || 0),
    avg_round_score: parseFloat(round.avg_round_score || 0),
    is_active: round.status === 'active',
    is_expired: new Date() > new Date(round.end_time),
    time_remaining: round.status === 'active' ? 
      Math.max(0, Math.floor((new Date(round.end_time) - new Date()) / 1000)) : 0,
    created_at: round.created_at,
    updated_at: round.updated_at
  }));
}

/**
 * Submit a session to a league round (registered users only)
 */
async function submitSessionToLeague(client, sessionId, playerId, leagueId, roundId, sessionData) {
  // Verify the player is a league member
  const memberCheck = await client.query(
    'SELECT * FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND is_active = true',
    [leagueId, playerId]
  );

  if (memberCheck.rows.length === 0) {
    throw new Error('Player is not an active member of this league');
  }

  // Verify the round is active
  const roundCheck = await client.query(
    'SELECT * FROM league_rounds WHERE round_id = $1 AND league_id = $2 AND status = $3',
    [roundId, leagueId, 'active']
  );

  if (roundCheck.rows.length === 0) {
    throw new Error('League round is not currently active');
  }

  const round = roundCheck.rows[0];
  
  // Check if round has expired
  if (new Date() > new Date(round.end_time)) {
    throw new Error('League round has expired');
  }

  // Get league rules for scoring
  const leagueResult = await client.query('SELECT rules FROM leagues WHERE league_id = $1', [leagueId]);
  const leagueRules = leagueResult.rows[0]?.rules || {};
  
  // Calculate round score based on league rules
  const scoringMethod = leagueRules.scoring_method || 'cumulative';
  let roundScore = 0;

  switch (scoringMethod) {
    case 'cumulative':
      roundScore = sessionData.total_makes || 0;
      break;
    case 'average':
      roundScore = sessionData.make_percentage || 0;
      break;
    case 'best_session':
      roundScore = sessionData.best_streak || 0;
      break;
    case 'fastest_21':
      roundScore = sessionData.fastest_21_makes ? (3600 - sessionData.fastest_21_makes) : 0; // Invert for scoring
      break;
    default:
      roundScore = sessionData.total_makes || 0;
  }

  // Check session limits per round
  const maxSessions = leagueRules.max_sessions_per_round || 10;
  const currentSessionCount = await client.query(
    'SELECT COUNT(*) as count FROM league_round_sessions WHERE round_id = $1 AND player_id = $2',
    [roundId, playerId]
  );

  if (parseInt(currentSessionCount.rows[0].count) >= maxSessions) {
    throw new Error(`Maximum ${maxSessions} sessions per round limit reached`);
  }

  // Pre-calculate ranking metrics
  const rankingMetrics = {
    total_makes: sessionData.total_makes || 0,
    make_percentage: sessionData.make_percentage || 0,
    best_streak: sessionData.best_streak || 0,
    fastest_21_makes: sessionData.fastest_21_makes || 999999,
    session_duration: sessionData.session_duration_seconds || 0,
    putts_per_minute: sessionData.putts_per_minute || 0,
    consistency_factor: sessionData.make_percentage > 0 ? 1.0 / Math.max(0.01, Math.abs(50 - sessionData.make_percentage)) : 0
  };

  // Insert session record
  await client.query(`
    INSERT INTO league_round_sessions 
    (session_id, round_id, league_id, player_id, session_data, round_score, ranking_metrics, is_valid)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (session_id) DO UPDATE SET
    session_data = EXCLUDED.session_data,
    round_score = EXCLUDED.round_score,
    ranking_metrics = EXCLUDED.ranking_metrics,
    submitted_at = NOW()
  `, [sessionId, roundId, leagueId, playerId, JSON.stringify(sessionData), roundScore, JSON.stringify(rankingMetrics), true]);

  // Update league membership stats
  await client.query(`
    UPDATE league_memberships 
    SET 
      sessions_this_round = sessions_this_round + 1,
      last_activity = NOW()
    WHERE league_id = $1 AND player_id = $2
  `, [leagueId, playerId]);

  return {
    session_id: sessionId,
    round_score: roundScore,
    ranking_metrics: rankingMetrics,
    submitted_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      const { 
        league_id, 
        action, 
        round_id,
        sort_by = 'total_score', 
        sort_order = 'desc',
        min_sessions = 0,
        include_inactive = 'false'
      } = req.query;
      
      if (action === 'leaderboard' && league_id) {
        // Get enhanced leaderboard with sorting options
        const standings = await calculateEnhancedLeagueStandings(client, parseInt(league_id), {
          roundId: round_id ? parseInt(round_id) : null,
          sortBy: sort_by,
          sortOrder: sort_order.toUpperCase(),
          includeInactive: include_inactive === 'true',
          minSessions: parseInt(min_sessions)
        });

        // Get league info
        const leagueResult = await client.query(`
          SELECT l.*, u.display_name as creator_name
          FROM leagues l
          LEFT JOIN users u ON l.created_by = u.id
          WHERE l.league_id = $1
        `, [league_id]);

        if (leagueResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'League not found' });
        }

        const league = leagueResult.rows[0];

        return res.status(200).json({
          success: true,
          league: {
            league_id: league.league_id,
            name: league.name,
            league_type: league.league_type,
            status: league.status,
            current_round: league.current_round,
            total_rounds: league.total_rounds,
            scoring_method: league.rules?.scoring_method || 'cumulative',
            creator_name: league.creator_name
          },
          leaderboard: standings,
          sort_options: {
            current_sort: sort_by,
            current_order: sort_order,
            available_sorts: [
              { value: 'total_score', label: 'Total Score', numeric: true },
              { value: 'total_makes', label: 'Total Makes', numeric: true },
              { value: 'avg_percentage', label: 'Average %', numeric: true },
              { value: 'best_streak', label: 'Best Streak', numeric: true },
              { value: 'fastest_21', label: 'Fastest 21', numeric: true, reverse: true },
              { value: 'consistency', label: 'Consistency', numeric: true },
              { value: 'activity_rating', label: 'Activity', numeric: true },
              { value: 'performance_rating', label: 'Performance', numeric: true },
              { value: 'joined_date', label: 'Join Date', numeric: false }
            ]
          },
          total_players: standings.length,
          active_players: standings.filter(p => p.is_active).length
        });
      }

      if (action === 'rounds' && league_id) {
        // Get league rounds with statistics
        const rounds = await getLeagueRounds(client, parseInt(league_id), true);
        
        return res.status(200).json({
          success: true,
          league_id: parseInt(league_id),
          rounds,
          current_round: rounds.find(r => r.status === 'active'),
          completed_rounds: rounds.filter(r => r.status === 'completed').length,
          total_rounds: rounds.length
        });
      }

      if (action === 'schedule' && league_id) {
        // Get league schedule and upcoming events
        const leagueResult = await client.query(`
          SELECT l.*, 
                 (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = l.league_id AND lm.is_active = true) as member_count
          FROM leagues l WHERE l.league_id = $1
        `, [league_id]);

        if (leagueResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'League not found' });
        }

        const league = leagueResult.rows[0];
        const rounds = await getLeagueRounds(client, parseInt(league_id), true);
        const currentRound = rounds.find(r => r.status === 'active');
        const nextRound = rounds.find(r => r.status === 'scheduled');

        return res.status(200).json({
          success: true,
          league: {
            league_id: league.league_id,
            name: league.name,
            status: league.status,
            member_count: parseInt(league.member_count),
            total_rounds: league.total_rounds,
            round_duration_hours: league.round_duration_hours,
            auto_start_rounds: league.auto_start_rounds
          },
          schedule: {
            current_round: currentRound,
            next_round: nextRound,
            all_rounds: rounds,
            league_progress: rounds.filter(r => r.status === 'completed').length / rounds.length,
            estimated_completion: rounds.length > 0 ? rounds[rounds.length - 1].end_time : null
          }
        });
      }

      // Continue with existing league listing logic...
      return res.status(400).json({ success: false, message: 'Invalid action or missing league_id' });
    }

    if (req.method === 'POST') {
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { action } = req.body;

      if (action === 'invite') {
        // Send league invitation
        const { league_id, invitation_method, recipient_identifier, personal_message } = req.body;

        if (!league_id || !invitation_method || !recipient_identifier) {
          return res.status(400).json({
            success: false,
            message: 'league_id, invitation_method, and recipient_identifier are required'
          });
        }

        // Verify user has permission to invite
        const memberCheck = await client.query(
          'SELECT member_role FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND is_active = true',
          [league_id, parseInt(user.playerId)]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ success: false, message: 'Not a member of this league' });
        }

        const memberRole = memberCheck.rows[0].member_role;
        if (!['owner', 'admin'].includes(memberRole)) {
          // Check if member has invite permissions
          const permissionCheck = await client.query(
            'SELECT invite_permissions FROM league_memberships WHERE league_id = $1 AND player_id = $2',
            [league_id, parseInt(user.playerId)]
          );

          if (!permissionCheck.rows[0]?.invite_permissions) {
            return res.status(403).json({ success: false, message: 'No permission to send invitations' });
          }
        }

        // Check if league has space
        const leagueCheck = await client.query(`
          SELECT l.max_members, 
                 (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = l.league_id AND lm.is_active = true) as member_count
          FROM leagues l WHERE l.league_id = $1
        `, [league_id]);

        const league = leagueCheck.rows[0];
        if (parseInt(league.member_count) >= league.max_members) {
          return res.status(400).json({ success: false, message: 'League is full' });
        }

        // Check if recipient exists
        let existingUser = null;
        if (invitation_method === 'username') {
          const userResult = await client.query('SELECT * FROM users WHERE username = $1', [recipient_identifier]);
          existingUser = userResult.rows[0] || null;
        } else if (invitation_method === 'email') {
          const userResult = await client.query('SELECT * FROM users WHERE email = $1', [recipient_identifier.toLowerCase()]);
          existingUser = userResult.rows[0] || null;
        }

        // Check if already a member or has pending invitation
        if (existingUser) {
          const existingMember = await client.query(
            'SELECT * FROM league_memberships WHERE league_id = $1 AND player_id = $2',
            [league_id, existingUser.id]
          );

          if (existingMember.rows.length > 0 && existingMember.rows[0].is_active) {
            return res.status(400).json({ success: false, message: 'User is already a member' });
          }

          const pendingInvite = await client.query(
            'SELECT * FROM league_invitations WHERE league_id = $1 AND invited_user_id = $2 AND status = $3',
            [league_id, existingUser.id, 'pending']
          );

          if (pendingInvite.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'User already has a pending invitation' });
          }
        }

        // Create invitation
        const invitationToken = generateInvitationToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitationResult = await client.query(`
          INSERT INTO league_invitations 
          (league_id, inviting_user_id, invited_user_id, invitation_method, external_contact, 
           invitation_token, message, expires_at, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING invitation_id
        `, [
          league_id,
          parseInt(user.playerId),
          existingUser ? existingUser.id : null,
          invitation_method,
          existingUser ? null : recipient_identifier,
          invitationToken,
          personal_message || '',
          expiresAt,
          'pending'
        ]);

        // TODO: Send actual invitation via email/SMS
        console.log(`League invitation sent to ${recipient_identifier} for league ${league_id}`);

        return res.status(201).json({
          success: true,
          message: 'League invitation sent successfully',
          invitation: {
            invitation_id: invitationResult.rows[0].invitation_id,
            league_id,
            recipient_identifier,
            invitation_method,
            expires_at: expiresAt,
            invitation_url: existingUser 
              ? `/leagues/invitation/${invitationResult.rows[0].invitation_id}`
              : `https://app.proofofputt.com/league-invitation/${invitationToken}`
          }
        });
      }

      if (action === 'submit_session') {
        // Submit session to league round (registered users only)
        const { league_id, round_id, session_id, session_data } = req.body;

        if (!league_id || !session_id || !session_data) {
          return res.status(400).json({
            success: false,
            message: 'league_id, session_id, and session_data are required'
          });
        }

        try {
          const submissionResult = await submitSessionToLeague(
            client,
            session_id,
            parseInt(user.playerId),
            parseInt(league_id),
            parseInt(round_id),
            session_data
          );

          // Update league rankings after submission
          await client.query('SELECT update_league_rankings($1)', [league_id]);

          return res.status(201).json({
            success: true,
            message: 'Session submitted to league successfully',
            submission: submissionResult
          });

        } catch (submissionError) {
          return res.status(400).json({
            success: false,
            message: submissionError.message
          });
        }
      }

      if (action === 'update_rankings') {
        // Manually trigger ranking update (admin only)
        const { league_id } = req.body;

        if (!league_id) {
          return res.status(400).json({ success: false, message: 'league_id is required' });
        }

        // Check admin permissions
        const adminCheck = await client.query(
          'SELECT member_role FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND is_active = true',
          [league_id, parseInt(user.playerId)]
        );

        if (adminCheck.rows.length === 0 || !['owner', 'admin'].includes(adminCheck.rows[0].member_role)) {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        await client.query('SELECT update_league_rankings($1)', [league_id]);

        return res.status(200).json({
          success: true,
          message: 'League rankings updated successfully'
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[leagues-enhanced] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}