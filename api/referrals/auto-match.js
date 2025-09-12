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
      signup_email,
      signup_phone,
      signup_name,
      oauth_provider,
      consent_contact_info = true
    } = req.body;

    if (!player_id) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    // Call the database function to auto-match referral
    const result = await pool.query(
      `SELECT auto_match_referral($1, $2, $3, $4, $5, $6) as result`,
      [
        player_id,
        signup_email || null,
        signup_phone || null,
        signup_name || null,
        oauth_provider || null,
        consent_contact_info
      ]
    );

    const matchResult = result.rows[0].result;

    if (!matchResult.success) {
      console.log(`[Referral] No match found for player ${player_id}: ${matchResult.message}`);
      return res.status(200).json({
        success: false,
        message: matchResult.message || 'No referral match found'
      });
    }

    console.log(`[Referral] Auto-matched referral for player ${player_id} with score ${matchResult.match_score} via ${matchResult.match_method}`);

    return res.status(200).json({
      success: true,
      referrer_id: matchResult.referrer_id,
      referral_source: matchResult.referral_source,
      auto_added_to_contacts: matchResult.auto_added_to_contacts,
      match_details: {
        score: matchResult.match_score,
        method: matchResult.match_method
      }
    });

  } catch (error) {
    console.error('Auto-match referral error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to auto-match referral'
    });
  }
}