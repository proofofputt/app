import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-desktop-automation');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'PUT') {
    return handleExpireInvitation(req, res);
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}

async function handleExpireInvitation(req, res) {
  const { action, invitation_token } = req.body;

  if (action !== 'expire') {
    return res.status(400).json({ success: false, message: 'Only expire action is supported' });
  }

  if (!invitation_token) {
    return res.status(400).json({ success: false, message: 'invitation_token is required' });
  }

  try {
    const client = await pool.connect();
    
    // Check if it's a league invitation
    const leagueInviteResult = await client.query(`
      SELECT invitation_id, league_id, status 
      FROM league_invitations 
      WHERE invitation_token = $1
    `, [invitation_token]);

    if (leagueInviteResult.rows.length > 0) {
      const invitation = leagueInviteResult.rows[0];
      
      if (invitation.status === 'expired' || invitation.status === 'accepted') {
        client.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Invitation is already expired or accepted' 
        });
      }

      await client.query(`
        UPDATE league_invitations 
        SET status = 'expired', expired_at = NOW(), updated_at = NOW()
        WHERE invitation_token = $1
      `, [invitation_token]);

      client.release();
      return res.status(200).json({
        success: true,
        message: 'League invitation marked as expired',
        invitation_type: 'league'
      });
    }

    // TODO: Add support for other invitation types (duel invitations, etc.)
    
    client.release();
    return res.status(404).json({ 
      success: false, 
      message: 'Invitation not found' 
    });

  } catch (error) {
    console.error('Error expiring invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to expire invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}