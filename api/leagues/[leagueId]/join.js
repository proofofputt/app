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
    
    // Get the league details
    const leagueResult = await client.query(`
      SELECT 
        league_id,
        name,
        league_creator_id,
        status,
        rules,
        privacy_level,
        max_members,
        current_members
      FROM leagues 
      WHERE league_id = $1
    `, [leagueId]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'League not found' 
      });
    }

    const league = leagueResult.rows[0];

    // Check if league allows direct joining
    if (league.privacy_level === 'private' || league.rules?.invitation_only) {
      return res.status(403).json({ 
        success: false, 
        message: 'This league requires an invitation to join' 
      });
    }

    // Check if league is accepting new members
    if (!['setup', 'registering', 'active'].includes(league.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot join league with status: ${league.status}` 
      });
    }

    // Check member limit
    if (league.max_members && league.current_members >= league.max_members) {
      return res.status(400).json({ 
        success: false, 
        message: 'League has reached maximum member capacity' 
      });
    }

    // Check if player is already a member
    const membershipResult = await client.query(`
      SELECT membership_id FROM league_memberships 
      WHERE league_id = $1 AND player_id = $2
    `, [leagueId, playerId]);

    if (membershipResult.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Player is already a member of this league' 
      });
    }

    // Get player details
    const playerResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Player not found' 
      });
    }

    const player = playerResult.rows[0];

    // Add player to league
    await client.query(`
      INSERT INTO league_memberships (
        league_id, 
        player_id,
        league_member_id,
        league_inviter_id,
        member_role,
        is_active,
        joined_at
      )
      VALUES ($1, $2, $2, NULL, 'member', true, NOW())
    `, [leagueId, playerId]);

    return res.status(200).json({
      success: true,
      message: `Successfully joined ${league.name}`,
      membership: {
        league_id: league.league_id,
        league_name: league.name,
        player_id: playerId,
        player_name: player.name,
        member_role: 'member',
        joined_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('League join error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join league',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}