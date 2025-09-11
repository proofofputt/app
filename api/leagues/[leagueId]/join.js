import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { leagueId } = req.query;
  const { player_id } = req.body;

  // Use authenticated user's ID if not provided
  const playerId = player_id || user.playerId;

  if (!leagueId || !playerId) {
    return res.status(400).json({ 
      success: false, 
      message: 'leagueId and player_id are required' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get the league details with current member count
    const leagueResult = await client.query(`
      SELECT 
        l.league_id,
        l.name,
        l.description,
        l.created_by,
        l.status,
        l.rules,
        creator.name as creator_name,
        (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id) as current_members
      FROM leagues l
      LEFT JOIN players creator ON l.created_by = creator.player_id
      WHERE l.league_id = $1
    `, [leagueId]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'League not found' 
      });
    }

    const league = leagueResult.rows[0];

    // Check if league allows direct joining (handle both privacy formats)
    const rules = league.rules || {};
    const privacy = rules.privacy || league.privacy_level || 'public';
    
    if (privacy === 'private' || rules.invitation_only) {
      return res.status(403).json({ 
        success: false, 
        message: 'This league requires an invitation to join',
        league_privacy: privacy
      });
    }

    // Check if league is accepting new members
    const allowedStatuses = ['setup', 'registering'];
    const allowLateJoiners = rules.allow_late_joiners !== false; // Default to true if undefined
    
    if (league.status === 'active' && !allowLateJoiners) {
      return res.status(400).json({ 
        success: false, 
        message: 'This league does not allow late joiners. Players must join before the league starts.',
        league_status: league.status,
        allow_late_joiners: allowLateJoiners
      });
    }
    
    if (league.status === 'active' && allowLateJoiners) {
      allowedStatuses.push('active');
    }
    
    if (!allowedStatuses.includes(league.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot join league with status: ${league.status}` 
      });
    }

    // Check member limit (use rules.max_members or default reasonable limit)
    const maxMembers = rules.max_members || 1000; // Default reasonable limit
    if (league.current_members >= maxMembers) {
      return res.status(400).json({ 
        success: false, 
        message: 'League has reached maximum member capacity',
        current_members: league.current_members,
        max_members: maxMembers
      });
    }

    // Check if player is already a member (handle is_active column if it exists)
    const membershipResult = await client.query(`
      SELECT * FROM league_memberships 
      WHERE league_id = $1 AND player_id = $2
    `, [leagueId, playerId]);

    if (membershipResult.rows.length > 0) {
      const membership = membershipResult.rows[0];
      
      // If there's an is_active column and the membership is active
      if (membership.is_active === true || membership.is_active === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Player is already a member of this league',
          membership_status: 'active'
        });
      } else if (membership.is_active === false) {
        // Reactivate previous membership (try with is_active column first, fallback if it doesn't exist)
        try {
          await client.query(
            'UPDATE league_memberships SET is_active = true, joined_at = NOW() WHERE league_id = $1 AND player_id = $2',
            [leagueId, playerId]
          );
        } catch (updateError) {
          // Fallback: just update joined_at if is_active column doesn't exist
          await client.query(
            'UPDATE league_memberships SET joined_at = NOW() WHERE league_id = $1 AND player_id = $2',
            [leagueId, playerId]
          );
        }
        
        console.log(`[join-league] Reactivated membership for player ${playerId} in league ${leagueId}`);
        
        // Continue to notification creation below
      }
    } else {
      // Create new membership with fallback for different table structures
      try {
        await client.query(`
          INSERT INTO league_memberships (league_id, player_id, joined_at, is_active)
          VALUES ($1, $2, NOW(), true)
        `, [leagueId, playerId]);
        
        console.log(`[join-league] Created new membership for player ${playerId} in league ${leagueId}`);
      } catch (membershipError) {
        // Try simpler structure if the first attempt fails
        console.log(`[join-league] Attempting alternative membership creation...`);
        await client.query(`
          INSERT INTO league_memberships (league_id, player_id, joined_at)
          VALUES ($1, $2, NOW())
        `, [leagueId, playerId]);
        
        console.log(`[join-league] Created membership with alternative structure for player ${playerId} in league ${leagueId}`);
      }
    }

    // Get player details for notifications
    const playerResult = await client.query(`
      SELECT player_id, name, email FROM players WHERE player_id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Player not found' 
      });
    }

    const player = playerResult.rows[0];
    const playerName = player.name || `Player ${playerId}`;

    // Create notification for league creator about new member
    try {
      await client.query(`
        INSERT INTO notifications (player_id, type, title, message, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        league.created_by,
        'league_member_joined',
        'New League Member',
        `${playerName} has joined ${league.name}`,
        JSON.stringify({
          league_id: leagueId,
          new_member_id: playerId,
          new_member_name: playerName,
          joined_via: 'public_join',
          league_name: league.name
        })
      ]);
    } catch (notificationError) {
      console.log(`[join-league] Failed to create admin notification: ${notificationError.message}`);
    }

    // Create welcome notification for the new member
    try {
      await client.query(`
        INSERT INTO notifications (player_id, type, title, message, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        playerId,
        'league_welcome',
        `Welcome to ${league.name}!`,
        `You've successfully joined ${league.name}. Check the league schedule and start competing!`,
        JSON.stringify({
          league_id: leagueId,
          league_name: league.name,
          creator_name: league.creator_name,
          member_count: league.current_members + 1,
          next_steps: [
            'View league schedule and current round',
            'Submit practice sessions to earn points',
            'Check leaderboard to track progress'
          ]
        })
      ]);
    } catch (notificationError) {
      console.log(`[join-league] Failed to create welcome notification: ${notificationError.message}`);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully joined ${league.name}!`,
      league: {
        league_id: league.league_id,
        name: league.name,
        description: league.description,
        status: league.status,
        creator_name: league.creator_name,
        member_count: league.current_members + 1,
        rules: league.rules
      },
      membership: {
        league_id: league.league_id,
        league_name: league.name,
        player_id: playerId,
        player_name: playerName,
        member_role: 'member',
        joined_at: new Date().toISOString()
      },
      next_steps: [
        'View the league dashboard to see current standings',
        'Check the schedule for upcoming rounds',
        'Submit practice sessions to start competing'
      ]
    });

  } catch (error) {
    console.error('[join-league] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join league',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}