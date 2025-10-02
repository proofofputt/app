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
      console.error('LinkedIn OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      console.error('Missing authorization code or state parameter');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=missing_parameters`);
    }

    // Verify state parameter against stored session
    const sessionResult = await pool.query(
      'SELECT * FROM oauth_sessions WHERE state = $1 AND provider = $2 AND expires_at > NOW()',
      [state, 'linkedin']
    );

    if (sessionResult.rows.length === 0) {
      console.error('Invalid or expired LinkedIn OAuth session');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=invalid_session`);
    }

    // Clean up the session
    await pool.query('DELETE FROM oauth_sessions WHERE state = $1', [state]);

    // Exchange authorization code for access token
    const redirectUri = `${req.headers.origin || 'https://app.proofofputt.com'}/api/auth/linkedin/callback`;
    
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange LinkedIn authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user profile information
    const [profileResponse, emailResponse] = await Promise.all([
      fetch('https://api.linkedin.com/v2/people/~:(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }),
      fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
    ]);

    if (!profileResponse.ok || !emailResponse.ok) {
      throw new Error('Failed to get LinkedIn user profile information');
    }

    const profileData = await profileResponse.json();
    const emailData = await emailResponse.json();

    const linkedinId = profileData.id;
    const firstName = profileData.localizedFirstName;
    const lastName = profileData.localizedLastName;
    const name = `${firstName} ${lastName}`.trim();
    const email = emailData.elements?.[0]?.['handle~']?.emailAddress;
    const picture = profileData.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier;

    if (!email) {
      throw new Error('Email address not available from LinkedIn');
    }

    console.log(`[OAuth] LinkedIn user authenticated: ${email} (${linkedinId})`);

    // Check if user already exists with this LinkedIn ID
    let playerResult = await pool.query(
      'SELECT * FROM players WHERE linkedin_id = $1',
      [linkedinId]
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
        // Link LinkedIn account to existing user
        await pool.query(
          `UPDATE players 
           SET linkedin_id = $1, 
               oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || '{"linkedin": true}'::jsonb,
               avatar_url = COALESCE(avatar_url, $2),
               oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $3::jsonb,
               updated_at = NOW()
           WHERE player_id = $4`,
          [linkedinId, picture, JSON.stringify({ linkedin: { name, picture, firstName, lastName } }), player.player_id]
        );
        
        console.log(`[OAuth] Linked LinkedIn account to existing player ${player.player_id}`);
      } else {
        // Create new user account
        const insertResult = await pool.query(
          `INSERT INTO players (email, display_name, linkedin_id, avatar_url, oauth_providers, oauth_profile, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
           RETURNING *`,
          [
            email, 
            name, 
            linkedinId, 
            picture,
            JSON.stringify({ linkedin: true }),
            JSON.stringify({ linkedin: { name, picture, firstName, lastName } })
          ]
        );
        
        player = insertResult.rows[0];
        console.log(`[OAuth] Created new player ${player.player_id} via LinkedIn OAuth`);
      }
    } else {
      // Update existing LinkedIn-linked user
      await pool.query(
        `UPDATE players 
         SET avatar_url = COALESCE($1, avatar_url),
             oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE player_id = $3`,
        [picture, JSON.stringify({ linkedin: { name, picture, firstName, lastName } }), player.player_id]
      );
      
      console.log(`[OAuth] Updated existing LinkedIn-linked player ${player.player_id}`);
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
          'linkedin',
          true // consent_contact_info - OAuth users consent to sharing profile info
        ]
      );
      
      const referralData = referralQuery.rows[0].result;
      if (referralData.success) {
        referralResult = referralData;
        console.log(`[OAuth] LinkedIn signup referral assigned: ${referralData.referrer_id} -> ${player.player_id}`);
      }
    } catch (referralError) {
      console.error('[OAuth] Referral assignment failed (non-blocking):', referralError);
      // Don't block OAuth flow if referral fails
    }

    // Store OAuth tokens
    await pool.query(
      `INSERT INTO oauth_tokens (player_id, provider, access_token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (player_id, provider) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [
        player.player_id,
        'linkedin',
        accessToken,
        tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null
      ]
    );

    // Generate application JWT token
    const appToken = jwt.sign(
      { 
        playerId: player.player_id, 
        email: player.email,
        provider: 'linkedin'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Redirect to frontend with success
    const redirectUrl = new URL(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login`);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('token', appToken);
    redirectUrl.searchParams.set('provider', 'linkedin');

    return res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/login?oauth_error=authentication_failed`);
  }
}