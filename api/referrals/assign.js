import { Pool } from 'pg';
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

  try {
    const {
      player_id,
      session_id,
      signup_email,
      signup_phone,
      signup_name,
      oauth_provider,
      consent_contact_info = true
    } = req.body;

    if (!player_id || !session_id) {
      return res.status(400).json({
        success: false,
        message: 'Player ID and session ID are required'
      });
    }

    // Call the database function to assign referral
    const result = await pool.query(
      `SELECT assign_referral($1, $2, $3, $4, $5, $6, $7) as result`,
      [
        player_id,
        session_id,
        signup_email || null,
        signup_phone || null,
        signup_name || null,
        oauth_provider || null,
        consent_contact_info
      ]
    );

    const assignmentResult = result.rows[0].result;

    if (!assignmentResult.success) {
      return res.status(400).json({
        success: false,
        message: assignmentResult.message || 'Failed to assign referral'
      });
    }

    console.log(`[Referral] Assigned referral for player ${player_id} via session ${session_id}`);

    return res.status(200).json({
      success: true,
      referrer_id: assignmentResult.referrer_id,
      referral_source: assignmentResult.referral_source,
      auto_added_to_contacts: assignmentResult.auto_added_to_contacts
    });

  } catch (error) {
    console.error('Assign referral error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign referral'
    });
  }
}