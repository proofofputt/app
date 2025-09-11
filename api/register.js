import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendWelcomeEmail } from '../utils/emailService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, referrer_id } = req.body;

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

    // Check if email already exists
    const existingEmail = await client.query(
      'SELECT player_id FROM players WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get the next player ID starting from 1000
    const maxIdQuery = await client.query('SELECT COALESCE(MAX(player_id), 999) as max_id FROM players');
    const nextPlayerId = Math.max(maxIdQuery.rows[0].max_id + 1, 1000);

    // Create the new player with explicit player_id starting at 1000
    const result = await client.query(
      `INSERT INTO players (
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
      RETURNING player_id, name, email, membership_tier, subscription_status, timezone`,
      [nextPlayerId, name, email, hashedPassword]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const player = result.rows[0];

    // Initialize player stats (using player_stats table like login.js expects)
    await client.query(
      `INSERT INTO player_stats (
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
      ON CONFLICT (player_id) DO NOTHING`,
      [player.player_id]
    );

    // Handle referral if provided
    let referrerInfo = null;
    if (referrer_id && !isNaN(referrer_id)) {
      try {
        // Verify referrer exists
        const referrerResult = await client.query(
          'SELECT player_id, name, email FROM players WHERE player_id = $1',
          [parseInt(referrer_id)]
        );
        
        if (referrerResult.rows.length > 0) {
          const referrer = referrerResult.rows[0];
          referrerInfo = referrer;
          
          // Create referral record
          await client.query(
            `INSERT INTO player_referrals (
              referrer_id, 
              referred_player_id, 
              referral_source,
              created_at
            ) VALUES ($1, $2, 'duel_invitation', NOW())`,
            [referrer.player_id, player.player_id]
          );
          
          // Add to referrer's contacts automatically
          await client.query(
            `INSERT INTO player_friends (
              player_id, 
              friend_player_id, 
              status, 
              created_at
            ) VALUES ($1, $2, 'accepted', NOW())
            ON CONFLICT (player_id, friend_player_id) DO NOTHING`,
            [referrer.player_id, player.player_id]
          );
          
          // Add referrer to new player's contacts as well (bidirectional)
          await client.query(
            `INSERT INTO player_friends (
              player_id, 
              friend_player_id, 
              status, 
              created_at
            ) VALUES ($1, $2, 'accepted', NOW())
            ON CONFLICT (player_id, friend_player_id) DO NOTHING`,
            [player.player_id, referrer.player_id]
          );
          
          console.log(`✅ Referral recorded: ${referrer.name} (${referrer.player_id}) referred ${player.name} (${player.player_id})`);
        }
      } catch (referralError) {
        console.error('Failed to process referral:', referralError);
        // Don't fail registration if referral processing fails
      }
    }

    // Generate JWT token (matching login.js format)
    const token = jwt.sign(
      { 
        playerId: player.player_id,
        email: player.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Generate username from email like login.js does
    const username = player.email.split('@')[0];

    // Send welcome email (don't block registration if email fails)
    try {
      await sendWelcomeEmail(player.email, player.name);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with registration even if email fails
    }

    return res.status(201).json({
      success: true,
      token,
      player: {
        player_id: player.player_id,
        email: player.email,
        name: player.name,
        username: username, // Derived from email
        membership_tier: player.membership_tier,
        subscription_status: player.subscription_status,
        timezone: player.timezone
      },
      referral: referrerInfo ? {
        referred_by: referrerInfo.name,
        referrer_id: referrerInfo.player_id,
        auto_added_to_contacts: true
      } : null
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Failed to register. Please try again later.' 
    });
  } finally {
    client.release();
  }
}