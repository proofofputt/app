import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { playerId } = req.query;

  if (!playerId || isNaN(parseInt(playerId))) {
    return res.status(400).json({ message: 'Valid player ID required' });
  }

  try {
    // Query to get all issued certificates for the player
    const result = await pool.query(`
      SELECT
        certificate_id,
        achievement_type,
        achievement_value,
        achievement_subtype,
        achieved_at,
        certificate_issued_at,
        achievement_data,
        data_hash,
        is_verified,
        bitcoin_block_height
      FROM achievement_certificates
      WHERE player_id = $1
        AND certificate_issued_at IS NOT NULL
      ORDER BY certificate_issued_at DESC, achievement_value DESC
    `, [playerId]);

    // Get player name for certificates
    const playerResult = await pool.query(
      'SELECT username, display_name FROM players WHERE player_id = $1',
      [playerId]
    );

    const playerData = playerResult.rows[0] || {};

    // Format certificates for frontend display
    const certificates = result.rows.map(cert => ({
      certificate_id: cert.certificate_id,
      achievement_type: cert.achievement_type,
      achievement_value: cert.achievement_value,
      achievement_subtype: cert.achievement_subtype,
      achieved_at: cert.achieved_at,
      certificate_issued_at: cert.certificate_issued_at,
      achievement_data: cert.achievement_data,
      data_hash: cert.data_hash,
      is_verified: cert.is_verified,
      bitcoin_block_height: cert.bitcoin_block_height,
      rarity_tier: cert.achievement_data?.rarity_tier || 'rare'
    }));

    res.status(200).json({
      player_id: parseInt(playerId),
      player_name: playerData.display_name || playerData.username,
      certificates,
      total_certificates: certificates.length
    });

  } catch (error) {
    console.error('Error fetching player certificates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}