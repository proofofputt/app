import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { invitation_id, action } = req.body;

  if (!invitation_id || !action) {
    return res.status(400).json({ error: 'invitation_id and action are required' });
  }

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action must be "accept" or "decline"' });
  }

  const client = await pool.connect();
  
  try {
    // Get the invitation details
    const invitationResult = await client.query(`
      SELECT 
        i.*,
        inviter.name as inviter_name,
        target.name as target_name,
        target.is_hidden
      FROM invitations i
      JOIN players inviter ON i.inviter_id = inviter.player_id
      JOIN players target ON i.hidden_player_id = target.player_id
      WHERE i.invitation_id = $1 AND i.status = 'pending'
    `, [invitation_id]);

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already responded to' });
    }

    const invitation = invitationResult.rows[0];

    // Check if current user is authorized to respond to this invitation
    // They can respond if they are the target player or if they can claim the hidden profile
    let canRespond = false;
    
    if (invitation.hidden_player_id === user.playerId) {
      // User is the direct target
      canRespond = true;
    } else if (invitation.is_hidden) {
      // Check if user can claim this hidden profile by identifier match
      const userResult = await client.query(`
        SELECT email, name FROM players WHERE player_id = $1
      `, [user.playerId]);
      
      if (userResult.rows.length > 0) {
        const currentUser = userResult.rows[0];
        
        if (invitation.identifier_type === 'email' && 
            currentUser.email.toLowerCase() === invitation.identifier.toLowerCase()) {
          canRespond = true;
        } else if (invitation.identifier_type === 'username' && 
                   currentUser.name.toLowerCase() === invitation.identifier.toLowerCase()) {
          canRespond = true;
        }
      }
    }

    if (!canRespond) {
      return res.status(403).json({ error: 'You are not authorized to respond to this invitation' });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await client.query(`
        UPDATE invitations 
        SET status = 'expired', updated_at = NOW() 
        WHERE invitation_id = $1
      `, [invitation_id]);
      
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // Update invitation status
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await client.query(`
      UPDATE invitations 
      SET status = $1, updated_at = NOW() 
      WHERE invitation_id = $2
    `, [newStatus, invitation_id]);

    let responseData = {
      success: true,
      invitation_id,
      action,
      status: newStatus,
      invitation_type: invitation.invitation_type
    };

    // If accepted, process the specific invitation type
    if (action === 'accept') {
      const invitationData = invitation.invitation_data;
      
      try {
        switch (invitation.invitation_type) {
          case 'friend':
            // Add friend relationship (bidirectional)
            await client.query(`
              INSERT INTO player_friends (player_id, friend_id, created_at)
              VALUES ($1, $2, NOW()), ($2, $1, NOW())
              ON CONFLICT (player_id, friend_id) DO NOTHING
            `, [user.playerId, invitation.inviter_id]);
            
            responseData.result = 'Friend relationship created';
            break;

          case 'duel':
            if (invitationData.duel_id) {
              // Update duel to accepted status
              await client.query(`
                UPDATE duels 
                SET status = 'active', accepted_at = NOW(), updated_at = NOW()
                WHERE duel_id = $1
              `, [invitationData.duel_id]);
              
              responseData.result = `Duel ${invitationData.duel_id} accepted`;
              responseData.duel_id = invitationData.duel_id;
            }
            break;

          case 'league':
            if (invitationData.league_id) {
              // Add player to league
              await client.query(`
                INSERT INTO league_members (league_id, player_id, joined_at, created_at)
                VALUES ($1, $2, NOW(), NOW())
                ON CONFLICT (league_id, player_id) DO NOTHING
              `, [invitationData.league_id, user.playerId]);
              
              responseData.result = `Joined league ${invitationData.league_id}`;
              responseData.league_id = invitationData.league_id;
            }
            break;

          default:
            responseData.result = 'Invitation accepted';
        }

        // If this was a hidden profile and the user is claiming it, merge the profiles
        if (invitation.is_hidden && invitation.hidden_player_id !== user.playerId) {
          console.log(`Claiming hidden profile ${invitation.hidden_player_id} for user ${user.playerId}`);
          
          // Update the hidden profile to mark it as claimed
          await client.query(`
            UPDATE players 
            SET claimed_at = NOW()
            WHERE player_id = $1
          `, [invitation.hidden_player_id]);
          
          // Update all invitations pointing to the hidden profile to point to the real user
          await client.query(`
            UPDATE invitations 
            SET hidden_player_id = $1, updated_at = NOW()
            WHERE hidden_player_id = $2
          `, [user.playerId, invitation.hidden_player_id]);

          responseData.profile_claimed = true;
          responseData.claimed_profile_id = invitation.hidden_player_id;
        }

      } catch (processingError) {
        console.error('Error processing accepted invitation:', processingError);
        responseData.warning = 'Invitation accepted but processing failed';
        responseData.processing_error = processingError.message;
      }
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Respond invitation error:', error);
    return res.status(500).json({ 
      error: 'Failed to respond to invitation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}