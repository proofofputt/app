import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { sendSingleInvitation } from '../utils/invitationService.js';
import { checkInvitationLimits, recordInvitationsSent } from '../utils/invitationLimiter.js';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set secure CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // TEMPORARY DEBUG MODE - SKIP AUTHENTICATION
  console.log('🔧 DEBUG MODE: Skipping authentication for debugging');
  
  const { creator_id, invited_player_id, settings, rules, invite_new_player, new_player_contact } = req.body;

  console.log('📥 Received duel creation request:');
  console.log('- creator_id:', creator_id);
  console.log('- invited_player_id:', invited_player_id);
  console.log('- settings:', settings);
  console.log('- rules:', rules);
  console.log('- invite_new_player:', invite_new_player);
  console.log('- new_player_contact:', new_player_contact);

  // Use settings or rules for the duel configuration
  const duelRules = settings || rules || {};
  
  if (!creator_id || (!invited_player_id && !invite_new_player)) {
    console.log('❌ Validation failed: Missing creator_id or invited_player_id');
    return res.status(400).json({ 
      success: false, 
      message: 'creator_id and either invited_player_id or new_player_contact are required' 
    });
  }

  // Validate new player contact information if provided
  if (invite_new_player && (!new_player_contact || !new_player_contact.type || !new_player_contact.value)) {
    console.log('❌ Validation failed: Invalid new_player_contact');
    return res.status(400).json({
      success: false,
      message: 'new_player_contact with type and value are required for new player invites'
    });
  }

  let client;
  try {
    console.log('🔗 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');

    let duelResult;
    let newPlayerInviteId = null;

    if (invite_new_player && new_player_contact) {
      console.log('👤 Creating temporary player for new invite...');
      // Create a temporary player for the invited contact
      const tempPlayerResult = await client.query(`
        INSERT INTO players (name, email, created_at)
        VALUES ($1, $2, NOW())
        RETURNING player_id
      `, [
        `Invited ${new_player_contact.type === 'email' ? 'Email' : 'Phone'} (${new_player_contact.value})`,
        new_player_contact.type === 'email' ? new_player_contact.value : `temp_${Date.now()}@phone.local`
      ]);
      
      const tempPlayerId = tempPlayerResult.rows[0].player_id;
      console.log('✅ Created temporary player with ID:', tempPlayerId);

      // Calculate expires_at for new player duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      console.log('⏰ Setting expiry to', expiryMinutes, 'minutes');
      
      // Create duel with temporary player reference
      console.log('🎯 Creating duel with temporary player...');
      duelResult = await client.query(`
        INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, created_at, expires_at)
        VALUES ($1, $2, 'pending_new_player', $3, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, duel_creator_id, duel_invited_player_id, status, rules, created_at, expires_at
      `, [creator_id, tempPlayerId, duelRules]);

    } else {
      console.log('🎯 Creating regular duel with existing player...');
      // Calculate expires_at for regular duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      console.log('⏰ Setting expiry to', expiryMinutes, 'minutes');
      
      // Regular duel with existing player
      duelResult = await client.query(`
        INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, created_at, expires_at)
        VALUES ($1, $2, 'pending', $3, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, duel_creator_id, duel_invited_player_id, status, rules, created_at, expires_at
      `, [creator_id, invited_player_id, duelRules]);
    }

    console.log('✅ Duel created successfully:', duelResult.rows[0]);
    const duel = duelResult.rows[0];

    // Get player names for response
    const playerIds = [creator_id];
    if (duel.duel_invited_player_id) {
      playerIds.push(duel.duel_invited_player_id);
    }
    
    console.log('👥 Fetching player names for IDs:', playerIds);
    const playersResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id = ANY($1)
    `, [playerIds]);

    const players = {};
    playersResult.rows.forEach(p => {
      players[p.player_id] = p.name;
    });
    console.log('✅ Found players:', players);

    const responseData = {
      success: true,
      duel: {
        ...duel,
        creator_id: duel.duel_creator_id,
        invited_player_id: duel.duel_invited_player_id,
        creator_name: players[creator_id],
        invited_player_name: duel.duel_invited_player_id ? players[duel.duel_invited_player_id] : null
      },
      debug_mode: true
    };

    console.log('🎉 Duel creation completed successfully!');
    return res.status(201).json(responseData);

  } catch (error) {
    console.error('💥 CREATE DUEL ERROR:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create duel',
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorDetail: error.detail,
      errorHint: error.hint,
      stack: error.stack,
      debug_mode: true
    });
  } finally {
    if (client) {
      console.log('🔗 Releasing database connection');
      client.release();
    }
  }
}