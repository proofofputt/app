import { Pool } from 'pg';
import { verifyToken } from '../login.js';
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
    // Verify authentication
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const { provider } = req.body;

    if (!provider || !['google', 'linkedin', 'nostr'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Valid provider required (google, linkedin, or nostr)'
      });
    }

    // Check if user has a password - prevent unlinking if it's their only auth method
    const playerResult = await pool.query(
      'SELECT password_hash, oauth_providers FROM players WHERE player_id = $1',
      [user.playerId]
    );

    const player = playerResult.rows[0];
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const oauthProviders = player.oauth_providers || {};
    const hasPassword = !!player.password_hash;
    const activeProviders = Object.values(oauthProviders).filter(Boolean).length;

    // Prevent unlinking if it's the only authentication method
    if (!hasPassword && activeProviders <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink the only authentication method. Please set a password first.'
      });
    }

    // Remove OAuth provider data
    const updates = {
      oauth_providers: { ...oauthProviders, [provider]: false }
    };

    let setClause = 'oauth_providers = $2, updated_at = NOW()';
    let params = [user.playerId, JSON.stringify(updates.oauth_providers)];

    // Clear provider-specific fields
    if (provider === 'google') {
      setClause += ', google_id = NULL';
    } else if (provider === 'linkedin') {
      setClause += ', linkedin_id = NULL';
    } else if (provider === 'nostr') {
      setClause += ', nostr_pubkey = NULL';
    }

    // Update player record
    await pool.query(
      `UPDATE players SET ${setClause} WHERE player_id = $1`,
      params
    );

    // Remove stored tokens
    await pool.query(
      'DELETE FROM oauth_tokens WHERE player_id = $1 AND provider = $2',
      [user.playerId, provider]
    );

    console.log(`[OAuth] Unlinked ${provider} from player ${user.playerId}`);

    return res.status(200).json({
      success: true,
      message: `${provider} account unlinked successfully`,
      provider: provider
    });

  } catch (error) {
    console.error('OAuth unlink error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlink OAuth provider'
    });
  }
}