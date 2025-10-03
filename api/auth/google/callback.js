import { OAuth2Client } from 'google-auth-library';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

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

  const { code, state, error } = req.query;
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://app.proofofputt.com';

  try {
    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error);
      res.writeHead(302, { 'Location': `${frontendBaseUrl}/login?oauth_error=${encodeURIComponent(error)}` });
      return res.end();
    }

    if (!code || !state) {
      console.error('Missing authorization code or state parameter');
      res.writeHead(302, { 'Location': `${frontendBaseUrl}/login?oauth_error=missing_parameters` });
      return res.end();
    }

    // Verify state parameter against stored session
    const sessionResult = await pool.query(
      'SELECT * FROM oauth_sessions WHERE state = $1 AND provider = $2 AND expires_at > NOW()',
      [state, 'google']
    );

    if (sessionResult.rows.length === 0) {
      console.error('Invalid or expired OAuth session');
      res.writeHead(302, { 'Location': `${frontendBaseUrl}/login?oauth_error=invalid_session` });
      return res.end();
    }

    const oauthSession = sessionResult.rows[0];
    const intentMode = oauthSession.mode || 'login'; // 'login' or 'signup'

    // Clean up the session
    await pool.query('DELETE FROM oauth_sessions WHERE state = $1', [state]);

    // Exchange authorization code for tokens
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${req.headers.origin || 'https://app.proofofputt.com'}/api/auth/google/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile information
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;
    const emailVerified = payload.email_verified;

    console.log(`[OAuth] Google user authenticated: ${email} (${googleId})`);

    // Check if user already exists with this Google ID
    let playerResult = await pool.query(
      'SELECT * FROM players WHERE google_id = $1',
      [googleId]
    );

    let player = playerResult.rows[0];

    if (!player) {
      // Check if user exists with this email
      playerResult = await pool.query(
        'SELECT * FROM players WHERE email = $1',
        [email]
      );

      player = playerResult.rows[0];

      if (player) {
        // Existing account found with matching email
        if (intentMode === 'signup') {
          // User tried to sign up, but account exists - redirect to account linking
          console.log(`[OAuth] Account exists for ${email}, redirecting to link account`);
          const linkToken = jwt.sign(
            {
              email,
              googleId,
              name,
              picture,
              emailVerified,
              action: 'link_google'
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
          );
          res.writeHead(302, { 'Location': `${frontendBaseUrl}/link-account?token=${linkToken}&provider=google` });
          return res.end();
        } else {
          // Login mode - link Google account to existing user
          await pool.query(
            `UPDATE players
             SET google_id = $1,
                 oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || '{"google": true}'::jsonb,
                 avatar_url = COALESCE(avatar_url, $2),
                 oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $3::jsonb,
                 updated_at = NOW()
             WHERE player_id = $4`,
            [googleId, picture, JSON.stringify({ google: { name, picture, verified: emailVerified } }), player.player_id]
          );

          console.log(`[OAuth] Linked Google account to existing player ${player.player_id}`);
        }
      } else {
        // No existing account - create new user (both login and signup mode)
        console.log(`[OAuth] Creating new account for ${email}`);

        // Get next player ID starting from 1000 (matching verify endpoint)
        const maxIdQuery = await pool.query('SELECT COALESCE(MAX(player_id), 999) as max_id FROM players');
        const nextPlayerId = Math.max(maxIdQuery.rows[0].max_id + 1, 1000);

        // OAuth users don't have passwords, but password_hash has NOT NULL constraint
        const placeholderPasswordHash = '$2a$10$OAUTH_USER_NO_PASSWORD_PLACEHOLDER_HASH_CANNOT_LOGIN';

        const insertResult = await pool.query(
          `INSERT INTO players (
            player_id,
            email,
            name,
            display_name,
            password_hash,
            google_id,
            avatar_url,
            oauth_providers,
            oauth_profile,
            membership_tier,
            subscription_status,
            timezone,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'basic', 'active', 'America/New_York', NOW(), NOW())
          RETURNING *`,
          [
            nextPlayerId,
            email,
            name,
            name, // display_name
            placeholderPasswordHash,
            googleId,
            picture,
            JSON.stringify({ google: true }),
            JSON.stringify({ google: { name, picture, verified: emailVerified } })
          ]
        );

        player = insertResult.rows[0];

        // Initialize player stats (matching verify endpoint)
        await pool.query(
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
          [nextPlayerId]
        );

        console.log(`[OAuth] Created new player ${player.player_id} via Google OAuth`);
      }
    } else {
      // Update existing Google-linked user
      await pool.query(
        `UPDATE players 
         SET avatar_url = COALESCE($1, avatar_url),
             oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE player_id = $3`,
        [picture, JSON.stringify({ google: { name, picture, verified: emailVerified } }), player.player_id]
      );
      
      console.log(`[OAuth] Updated existing Google-linked player ${player.player_id}`);
    }

    // Handle referral assignment if this is a new signup
    let referralResult = null;
    try {
      // Check if there's a referral session to process using database function
      const referralQuery = await pool.query(
        `SELECT auto_match_referral($1, $2, $3, $4, $5, $6) as result`,
        [
          player.player_id,
          email,
          null, // phone
          name,
          'google',
          true // consent_contact_info - OAuth users consent to sharing profile info
        ]
      );
      
      const referralData = referralQuery.rows[0].result;
      if (referralData.success) {
        referralResult = referralData;
        console.log(`[OAuth] Google signup referral assigned: ${referralData.referrer_id} -> ${player.player_id}`);
      }
    } catch (referralError) {
      console.error('[OAuth] Referral assignment failed (non-blocking):', referralError);
      // Don't block OAuth flow if referral fails
    }

    // Store OAuth tokens
    await pool.query(
      `INSERT INTO oauth_tokens (player_id, provider, access_token, refresh_token, expires_at, scope, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (player_id, provider) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [
        player.player_id,
        'google',
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        tokens.scope
      ]
    );

    // Generate application JWT token
    const appToken = jwt.sign(
      { 
        playerId: player.player_id, 
        email: player.email,
        provider: 'google'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Redirect to frontend with success (use absolute URL to avoid Vercel path issues)
    const redirectUrl = `${frontendBaseUrl}/login?oauth_success=true&token=${encodeURIComponent(appToken)}&provider=google`;
    res.writeHead(302, { 'Location': redirectUrl });
    return res.end();

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.writeHead(302, { 'Location': `${frontendBaseUrl}/login?oauth_error=authentication_failed` });
    return res.end();
  }
}