import { OAuth2Client } from 'google-auth-library';
import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import { v4 as uuidv4 } from 'uuid';

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

  try {
    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID environment variable is not set');
      return res.status(500).json({ 
        success: false, 
        message: 'OAuth configuration error' 
      });
    }

    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${req.headers.origin || 'https://app.proofofputt.com'}/api/auth/google/callback`
    );

    // Generate state parameter for CSRF protection
    const state = uuidv4();
    const sessionId = uuidv4();

    // Store OAuth session in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await pool.query(
      `INSERT INTO oauth_sessions (session_id, provider, state, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [sessionId, 'google', state, expiresAt]
    );

    // Generate authorization URL
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'select_account', // Force account selection
      include_granted_scopes: true
    });

    console.log(`[OAuth] Google auth URL generated for session ${sessionId}`);

    return res.status(200).json({
      success: true,
      authUrl: authUrl,
      sessionId: sessionId,
      state: state
    });

  } catch (error) {
    console.error('Google OAuth init error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize Google OAuth'
    });
  }
}