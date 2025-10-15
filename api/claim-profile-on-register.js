import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate password strength (at least 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate name (reasonable length)
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
  }

  const client = await pool.connect();
  
  try {
    // Check if email already exists for a non-hidden player
    const existingEmail = await client.query(
      'SELECT player_id, is_hidden FROM players WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingEmail.rows.length > 0 && !existingEmail.rows[0].is_hidden) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check for hidden profiles that can be claimed
    const hiddenProfileQuery = await client.query(`
      SELECT player_id, name as current_name, created_at
      FROM players 
      WHERE is_hidden = true 
      AND claimed_at IS NULL
      AND (
        (LOWER(email) = LOWER($1))
        OR (invitation_identifier = $1 AND identifier_type = 'email')
        OR (invitation_identifier = $2 AND identifier_type = 'username')
      )
      ORDER BY created_at ASC
      LIMIT 1
    `, [email, name]);

    let player;
    let profileClaimed = false;
    let claimedInvitations = [];

    if (hiddenProfileQuery.rows.length > 0) {
      // Claim existing hidden profile
      const hiddenProfile = hiddenProfileQuery.rows[0];
      console.log(`Claiming hidden profile ${hiddenProfile.player_id} for ${email}`);
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the hidden profile to become a full account
      const updateResult = await client.query(`
        UPDATE players 
        SET 
          name = $1,
          email = $2,
          password_hash = $3,
          is_hidden = false,
          claimed_at = NOW(),
          subscription_status = 'active',
          updated_at = NOW()
        WHERE player_id = $4
        RETURNING player_id, name, email, membership_tier, subscription_status, timezone
      `, [name, email, hashedPassword, hiddenProfile.player_id]);

      player = updateResult.rows[0];
      profileClaimed = true;

      // Get all pending invitations for this profile
      const invitationsResult = await client.query(`
        SELECT invitation_id, invitation_type, invitation_data, inviter_id
        FROM invitations 
        WHERE hidden_player_id = $1 AND status = 'pending'
      `, [player.player_id]);

      claimedInvitations = invitationsResult.rows;

      console.log(`Claimed ${claimedInvitations.length} pending invitations`);

    } else {
      // Create new player (standard registration)
      const nextPlayerId = await getNextPlayerId(client);
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await client.query(`
        INSERT INTO players (
          player_id,
          name,
          email, 
          password_hash, 
          membership_tier,
          subscription_status,
          timezone,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'basic', 'active', 'America/New_York', NOW(), NOW())
        RETURNING player_id, name, email, membership_tier, subscription_status, timezone
      `, [nextPlayerId, name, email, hashedPassword]);

      player = result.rows[0];
    }

    // Initialize player stats if not exists
    await client.query(`
      INSERT INTO player_stats (
        player_id,
        total_sessions,
        total_putts,
        total_makes,
        total_misses,
        make_percentage,
        best_streak,
        created_at,
        updated_at
      )
      VALUES ($1, 0, 0, 0, 0, 0.0, 0, NOW(), NOW())
      ON CONFLICT (player_id) DO NOTHING
    `, [player.player_id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        playerId: player.player_id,
        email: player.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Generate username from email
    const username = player.email.split('@')[0];

    return res.status(201).json({
      success: true,
      token,
      player: {
        player_id: player.player_id,
        email: player.email,
        name: player.name,
        username: username,
        membership_tier: player.membership_tier,
        subscription_status: player.subscription_status,
        timezone: player.timezone
      },
      profile_claimed: profileClaimed,
      claimed_invitations: claimedInvitations.map(inv => ({
        invitation_id: inv.invitation_id,
        type: inv.invitation_type,
        data: inv.invitation_data
      }))
    });

  } catch (error) {
    console.error('Registration/claim error:', error);
    return res.status(500).json({ 
      error: 'Failed to register. Please try again later.' 
    });
  } finally {
    client.release();
  }
}

async function getNextPlayerId(client) {
  const maxIdQuery = await client.query('SELECT COALESCE(MAX(player_id), 999) as max_id FROM players');
  return Math.max(maxIdQuery.rows[0].max_id + 1, 1000);
}