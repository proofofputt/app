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

  let client;
  try {
    client = await pool.connect();
    console.log('Leagues API: Database connected successfully');

    if (req.method === 'GET') {
      return await handleGetLeagues(req, res, client);
    } else if (req.method === 'POST') {
      return await handleCreateLeague(req, res, client);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

  } catch (error) {
    console.error('Leagues API error:', error);
    
    // Always ensure we return the expected structure for GET requests
    if (req.method === 'GET') {
      return res.status(200).json({
        success: false,
        message: 'Failed to load leagues',
        my_leagues: [],
        public_leagues: [],
        pending_invites: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function handleGetLeagues(req, res, client) {
  const { player_id } = req.query;

  if (!player_id) {
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
      l.created_by as creator_id,
      l.created_by,
      l.rules,
      l.privacy_level,
      creator.name as creator_name,
      lm.joined_at,
      (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id) as member_count,
      (
        SELECT lr.round_number 
        FROM league_rounds lr 
        WHERE lr.league_id = l.league_id 
        AND lr.status = 'active' 
        LIMIT 1
      ) as active_round_number
    FROM leagues l
    JOIN league_memberships lm ON l.league_id = lm.league_id
    JOIN players creator ON l.created_by = creator.player_id
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
      l.created_by as creator_id,
      l.created_by,
      l.rules,
      l.privacy_level,
      creator.name as creator_name,
      (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id) as member_count,
      (
        SELECT lr.round_number 
        FROM league_rounds lr 
        WHERE lr.league_id = l.league_id 
        AND lr.status = 'active' 
        LIMIT 1
      ) as active_round_number
    FROM leagues l
    JOIN players creator ON l.created_by = creator.player_id
    WHERE l.privacy_level = 'public'
    AND l.league_id NOT IN (
      SELECT league_id FROM league_memberships WHERE player_id = $1
    )
    AND l.status IN ('active', 'setup')
    ORDER BY l.created_at DESC
    LIMIT 20
  `, [player_id]);

  return res.status(200).json({
    success: true,
    my_leagues: memberLeaguesResult.rows,
    public_leagues: publicLeaguesResult.rows,
    pending_invites: [] // Populated by separate endpoint /players/[id]/league-invitations
  });
}

async function handleCreateLeague(req, res, client) {
  // Verify authentication for league creation
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { name, description, settings, invite_new_players, new_player_contacts } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'League name is required' });
  }

  // Validate new player contacts if provided
  if (invite_new_players && (!new_player_contacts || !Array.isArray(new_player_contacts) || new_player_contacts.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'new_player_contacts array is required when invite_new_players is true'
    });
  }

  if (invite_new_players) {
    for (const contact of new_player_contacts) {
      if (!contact.type || !contact.value || !['email', 'phone'].includes(contact.type)) {
        return res.status(400).json({
          success: false,
          message: 'Each new_player_contact must have type (email/phone) and value'
        });
      }
    }
  }

  // Validate playerId exists
  if (!user.playerId) {
    return res.status(400).json({ success: false, message: 'Invalid user token - missing playerId' });
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
    allow_catch_up_submissions: true, // Default to allowing catch-up for better continuity
    ...settings
  };

  const isIRL = defaultSettings.is_irl || false;

  // First verify the user exists in the players table
  const playerCheck = await client.query(`
    SELECT player_id FROM players WHERE player_id = $1
  `, [user.playerId]);

  if (playerCheck.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Player not found' });
  }

  let temporaryPlayerIds = [];
  
  // Create temporary players for IRL mode
  if (isIRL) {
    const numPlayers = defaultSettings.num_players || 4;
    const playerNames = defaultSettings.player_names || {};
    
    for (let i = 1; i <= numPlayers; i++) {
      const playerName = playerNames[i] || `Player ${i}`;
      const tempEmail = `temp_player_${Date.now()}_${i}@irl.local`;
      
      const tempPlayerResult = await client.query(`
        INSERT INTO players (name, email, is_temporary, created_at)
        VALUES ($1, $2, true, NOW())
        RETURNING player_id, name
      `, [playerName, tempEmail]);
      
      temporaryPlayerIds.push(tempPlayerResult.rows[0].player_id);
    }
    
    console.log(`[DEBUG] Created ${temporaryPlayerIds.length} temporary players for IRL league:`, temporaryPlayerIds);
  }

  // Try to create league with minimal required fields first
  const leagueResult = await client.query(`
    INSERT INTO leagues (name, description, created_by, rules, privacy_level, status, created_at)
    VALUES ($1, $2, $3, $4, $5, 'setup', NOW())
    RETURNING league_id, name, description, rules, privacy_level, created_by
  `, [name, description, user.playerId, JSON.stringify(defaultSettings), defaultSettings.privacy || 'public']);

  const league = leagueResult.rows[0];

  // Add creator as first member
  try {
    await client.query(`
      INSERT INTO league_memberships (league_id, player_id, joined_at)
      VALUES ($1, $2, NOW())
    `, [league.league_id, user.playerId]);
    console.log(`[DEBUG] League membership created for player ${user.playerId} in league ${league.league_id}`);
  } catch (membershipError) {
    console.error(`[ERROR] Failed to create league membership:`, membershipError.message);
    console.error(`[ERROR] League: ${league.league_id}, Player: ${user.playerId}`);
    throw membershipError; // Re-throw to fail the league creation if membership fails
  }

  // Add temporary players as members for IRL mode
  if (isIRL && temporaryPlayerIds.length > 0) {
    try {
      for (const tempPlayerId of temporaryPlayerIds) {
        await client.query(`
          INSERT INTO league_memberships (league_id, player_id, joined_at)
          VALUES ($1, $2, NOW())
        `, [league.league_id, tempPlayerId]);
      }
      console.log(`[DEBUG] Added ${temporaryPlayerIds.length} temporary players to league ${league.league_id}`);
    } catch (membershipError) {
      console.error(`[ERROR] Failed to create temporary player memberships:`, membershipError.message);
      throw membershipError; // Re-throw to fail the league creation if membership fails
    }
  }

  // Create league rounds automatically
  try {
    const numRounds = defaultSettings.num_rounds || 4;
    const roundDurationHours = defaultSettings.round_duration_hours || 168; // 1 week default
    
    for (let roundNum = 1; roundNum <= numRounds; roundNum++) {
      const roundStart = new Date(Date.now() + ((roundNum - 1) * roundDurationHours * 60 * 60 * 1000));
      const roundEnd = new Date(roundStart.getTime() + (roundDurationHours * 60 * 60 * 1000));
      
      await client.query(`
        INSERT INTO league_rounds (league_id, round_number, start_time, end_time, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        league.league_id, 
        roundNum, 
        roundStart, 
        roundEnd, 
        roundNum === 1 ? 'active' : 'scheduled'
      ]);
    }
    
    // Update league status to active
    await client.query(`
      UPDATE leagues 
      SET status = 'active', updated_at = NOW()
      WHERE league_id = $1
    `, [league.league_id]);
    
    console.log(`[DEBUG] Created ${numRounds} rounds for league ${league.league_id}`);
  } catch (roundsError) {
    console.error(`[ERROR] Failed to create league rounds:`, roundsError.message);
    // Don't fail the league creation if rounds fail - can be created later
  }

  // Get temporary player info if IRL mode
  let temporaryPlayers = null;
  if (isIRL && temporaryPlayerIds.length > 0) {
    const tempPlayersResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id = ANY($1)
    `, [temporaryPlayerIds]);
    
    temporaryPlayers = tempPlayersResult.rows;
  }

  // Create email/phone invitations for new players
  let newPlayerInvitations = [];
  
  if (invite_new_players && new_player_contacts && new_player_contacts.length > 0) {
    console.log(`[DEBUG] Creating ${new_player_contacts.length} new player invitations for league ${league.league_id}`);
    
    for (const contact of new_player_contacts) {
      try {
        // Create player_invitations record for email/phone tracking
        const playerInvitationResult = await client.query(`
          INSERT INTO player_invitations (
            inviter_id, 
            contact_type, 
            contact_value, 
            invitation_type, 
            league_id,
            created_at, 
            expires_at,
            status
          ) VALUES ($1, $2, $3, 'league', $4, NOW(), NOW() + INTERVAL '7 days', 'pending')
          RETURNING invitation_id, contact_type, contact_value, status, created_at, expires_at
        `, [user.playerId, contact.type, contact.value, league.league_id]);
        
        const playerInvitation = playerInvitationResult.rows[0];
        newPlayerInvitations.push(playerInvitation);
        
        // Note: league_invitations table requires league_invited_player_id to be NOT NULL
        // For email invitations, we don't create league_invitations records since there's no player_id yet
        // Instead, the player_invitations record handles the email invitation tracking
        // When the email recipient creates an account and accepts, then a league_invitations record is created
        
        console.log(`[DEBUG] Created league invitation for ${contact.type}: ${contact.value}`);
      } catch (inviteError) {
        console.error(`[ERROR] Failed to create invitation for ${contact.type}: ${contact.value}`, inviteError.message);
        // Continue with other invitations even if one fails
      }
    }
  }

  // Prepare success message based on features used
  let successMessage = 'League created successfully';
  if (isIRL) {
    successMessage = 'IRL League created successfully';
  } else if (newPlayerInvitations.length > 0) {
    successMessage = `League created successfully with ${newPlayerInvitations.length} invitation(s) sent`;
  }

  return res.status(201).json({
    success: true,
    message: successMessage,
    league: {
      league_id: league.league_id,
      name: league.name,
      description: league.description,
      rules: league.rules,
      status: 'setup',
      creator_id: league.created_by,
      is_irl: isIRL,
      temporary_players: temporaryPlayers,
      new_player_invitations: newPlayerInvitations.length > 0 ? newPlayerInvitations : undefined
    }
  });
}