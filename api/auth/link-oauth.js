import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { linkToken, provider } = req.body;

  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const authToken = authHeader.substring(7);
    let authPayload;

    try {
      authPayload = jwt.verify(authToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Verify link token
    let linkPayload;
    try {
      linkPayload = jwt.verify(linkToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired link token' });
    }

    if (linkPayload.action !== 'link_google' || linkPayload.email !== authPayload.email) {
      return res.status(400).json({ success: false, message: 'Invalid link request' });
    }

    // Link OAuth provider to user account
    const { googleId, name, picture, emailVerified } = linkPayload;

    await pool.query(
      `UPDATE players
       SET google_id = $1,
           oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || $2::jsonb,
           avatar_url = COALESCE(avatar_url, $3),
           oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $4::jsonb,
           updated_at = NOW()
       WHERE player_id = $5`,
      [
        googleId,
        JSON.stringify({ [provider]: true }),
        picture,
        JSON.stringify({ [provider]: { name, picture, verified: emailVerified } }),
        authPayload.playerId
      ]
    );

    console.log(`[Auth] Successfully linked ${provider} to player ${authPayload.playerId}`);

    return res.status(200).json({
      success: true,
      message: `${provider} account linked successfully`
    });

  } catch (error) {
    console.error('Link OAuth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link account'
    });
  }
}
