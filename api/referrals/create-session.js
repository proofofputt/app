import { Pool } from 'pg';
import { verifyToken } from '../login.js';
import { setCORSHeaders } from '../../utils/cors.js';
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
    // Verify authentication
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const {
      invited_email,
      invited_phone,
      invited_name,
      referral_source = 'direct_link', // 'duel_invitation', 'league_invitation', 'direct_link'
      referral_context = {}, // Additional context like duel_id, league_id
      expires_hours = 168 // Default 7 days
    } = req.body;

    // Validate that at least one contact method is provided
    if (!invited_email && !invited_phone && !invited_name) {
      return res.status(400).json({
        success: false,
        message: 'At least one of email, phone, or name must be provided'
      });
    }

    // Generate unique session ID
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + (expires_hours * 60 * 60 * 1000));

    // Create referral session
    const result = await pool.query(
      `INSERT INTO referral_sessions (
        session_id, referrer_id, invited_email, invited_phone, invited_name,
        referral_source, referral_context, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING session_id, expires_at`,
      [
        sessionId, 
        user.playerId, 
        invited_email || null, 
        invited_phone || null, 
        invited_name || null,
        referral_source,
        JSON.stringify(referral_context),
        expiresAt
      ]
    );

    console.log(`[Referral] Created referral session ${sessionId} by player ${user.playerId} for ${invited_email || invited_phone || invited_name}`);

    // Generate referral URL
    const referralUrl = `${req.headers.origin || 'https://app.proofofputt.com'}/register?ref=${sessionId}`;

    return res.status(200).json({
      success: true,
      session_id: sessionId,
      referral_url: referralUrl,
      expires_at: expiresAt,
      invited_contact: {
        email: invited_email || null,
        phone: invited_phone || null, 
        name: invited_name || null
      }
    });

  } catch (error) {
    console.error('Create referral session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create referral session'
    });
  }
}