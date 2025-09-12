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
    if (!process.env.LINKEDIN_CLIENT_ID) {
      console.error('LINKEDIN_CLIENT_ID environment variable is not set');
      return res.status(500).json({ 
        success: false, 
        message: 'OAuth configuration error' 
      });
    }

    // Generate state parameter for CSRF protection
    const state = uuidv4();
    const sessionId = uuidv4();

    // Store OAuth session in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await pool.query(
      `INSERT INTO oauth_sessions (session_id, provider, state, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [sessionId, 'linkedin', state, expiresAt]
    );

    // LinkedIn OAuth 2.0 authorization URL
    const redirectUri = `${req.headers.origin || 'https://app.proofofputt.com'}/api/auth/linkedin/callback`;
    const scopes = ['r_liteprofile', 'r_emailaddress']; // LinkedIn v2 API scopes

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes.join(' '));

    console.log(`[OAuth] LinkedIn auth URL generated for session ${sessionId}`);

    return res.status(200).json({
      success: true,
      authUrl: authUrl.toString(),
      sessionId: sessionId,
      state: state
    });

  } catch (error) {
    console.error('LinkedIn OAuth init error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize LinkedIn OAuth'
    });
  }
}