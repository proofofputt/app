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

  try {
    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      console.error('Missing authorization code or state parameter');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=missing_parameters`);
    }

    // Verify state parameter against stored session
    const sessionResult = await pool.query(
      'SELECT * FROM oauth_sessions WHERE state = $1 AND provider = $2 AND expires_at > NOW()',
      [state, 'google']
    );

    if (sessionResult.rows.length === 0) {
      console.error('Invalid or expired OAuth session');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=invalid_session`);
    }

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
        // Link Google account to existing user
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
      } else {
        // Create new user account
        const insertResult = await pool.query(
          `INSERT INTO players (email, display_name, google_id, avatar_url, oauth_providers, oauth_profile, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
           RETURNING *`,
          [
            email, 
            name, 
            googleId, 
            picture,
            JSON.stringify({ google: true }),
            JSON.stringify({ google: { name, picture, verified: emailVerified } })
          ]
        );
        
        player = insertResult.rows[0];
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

    // Redirect to frontend with success
    const redirectUrl = new URL(process.env.FRONTEND_URL || 'https://app.proofofputt.com');
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('token', appToken);
    redirectUrl.searchParams.set('provider', 'google');

    return res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=authentication_failed`);
  }
}