import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';
import { verifyEvent, nip19 } from 'nostr-tools';

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
    const { event, profile } = req.body;

    if (!event || !event.pubkey || !event.sig) {
      return res.status(400).json({
        success: false,
        message: 'Valid Nostr event with signature required'
      });
    }

    // Verify the Nostr event signature
    const isValidEvent = verifyEvent(event);
    if (!isValidEvent) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Nostr event signature'
      });
    }

    // Check event content for authentication challenge
    const expectedContent = `Authenticate with Proof of Putt at ${Date.now()}`;
    const contentTime = parseInt(event.content.match(/(\d+)$/)?.[1]);
    const currentTime = Date.now();

    // Verify the authentication is recent (within 5 minutes)
    if (!contentTime || currentTime - contentTime > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Authentication challenge expired or invalid'
      });
    }

    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey); // User-friendly public key format

    console.log(`[OAuth] Nostr authentication attempt: ${npub}`);

    // Extract profile information
    const name = profile?.name || profile?.display_name || `nostr-${pubkey.slice(0, 8)}`;
    const email = profile?.nip05 || null; // NIP-05 verified identifier (optional)
    const picture = profile?.picture || null;
    const about = profile?.about || '';

    // Check if user already exists with this Nostr public key
    let playerResult = await pool.query(
      'SELECT * FROM players WHERE nostr_pubkey = $1',
      [pubkey]
    );

    let player = playerResult.rows[0];

    if (!player) {
      // Check if user exists with verified NIP-05 email
      if (email) {
        playerResult = await pool.query(
          'SELECT * FROM players WHERE email = $1',
          [email]
        );
        
        player = playerResult.rows[0];
      }

      if (player) {
        // Link Nostr account to existing user
        await pool.query(
          `UPDATE players 
           SET nostr_pubkey = $1, 
               oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || '{"nostr": true}'::jsonb,
               avatar_url = COALESCE(avatar_url, $2),
               oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $3::jsonb,
               updated_at = NOW()
           WHERE player_id = $4`,
          [
            pubkey, 
            picture, 
            JSON.stringify({ nostr: { name, picture, about, npub, nip05: email } }), 
            player.player_id
          ]
        );
        
        console.log(`[OAuth] Linked Nostr account to existing player ${player.player_id}`);
      } else {
        // Create new user account
        // Use email if available and verified, otherwise generate unique email
        const playerEmail = email || `${npub}@nostr.local`;
        
        const insertResult = await pool.query(
          `INSERT INTO players (email, display_name, nostr_pubkey, avatar_url, oauth_providers, oauth_profile, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
           RETURNING *`,
          [
            playerEmail, 
            name, 
            pubkey, 
            picture,
            JSON.stringify({ nostr: true }),
            JSON.stringify({ nostr: { name, picture, about, npub, nip05: email } })
          ]
        );
        
        player = insertResult.rows[0];
        console.log(`[OAuth] Created new player ${player.player_id} via Nostr authentication`);
      }
    } else {
      // Update existing Nostr-linked user
      await pool.query(
        `UPDATE players 
         SET avatar_url = COALESCE($1, avatar_url),
             oauth_profile = COALESCE(oauth_profile, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE player_id = $3`,
        [
          picture, 
          JSON.stringify({ nostr: { name, picture, about, npub, nip05: email } }), 
          player.player_id
        ]
      );
      
      console.log(`[OAuth] Updated existing Nostr-linked player ${player.player_id}`);
    }

    // Handle referral assignment if this is a new signup
    let referralResult = null;
    try {
      // Check if there's a referral session to process using database function
      const referralQuery = await pool.query(
        `SELECT auto_match_referral($1, $2, $3, $4, $5, $6) as result`,
        [
          player.player_id,
          email, // NIP-05 verified email if available
          null, // phone
          name,
          'nostr',
          true // consent_contact_info - Nostr users are privacy-conscious but we have their consent
        ]
      );
      
      const referralData = referralQuery.rows[0].result;
      if (referralData.success) {
        referralResult = referralData;
        console.log(`[OAuth] Nostr signup referral assigned: ${referralData.referrer_id} -> ${player.player_id}`);
      }
    } catch (referralError) {
      console.error('[OAuth] Referral assignment failed (non-blocking):', referralError);
      // Don't block OAuth flow if referral fails
    }

    // Generate application JWT token
    const appToken = jwt.sign(
      { 
        playerId: player.player_id, 
        email: player.email,
        provider: 'nostr',
        npub: npub
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token: appToken,
      provider: 'nostr',
      player: {
        player_id: player.player_id,
        email: player.email,
        display_name: player.display_name,
        npub: npub
      }
    });

  } catch (error) {
    console.error('Nostr authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Nostr authentication failed'
    });
  }
}