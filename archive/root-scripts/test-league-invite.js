#!/usr/bin/env node
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testInvite() {
  let client;
  try {
    client = await pool.connect();

    const leagueId = 26;
    const inviterId = 1009;
    const inviteeId = 1; // Try inviting player 1

    console.log('Testing league invitation...');
    console.log('League ID:', leagueId);
    console.log('Inviter ID:', inviterId);
    console.log('Invitee ID:', inviteeId);

    // Check if invitee exists
    const inviteeResult = await client.query(`
      SELECT player_id, name, email FROM players WHERE player_id = $1
    `, [inviteeId]);

    console.log('\nInvitee check:', inviteeResult.rows[0]);

    // Check if already a member
    const membershipResult = await client.query(`
      SELECT league_id, player_id FROM league_memberships
      WHERE league_id = $1 AND player_id = $2
    `, [leagueId, inviteeId]);

    console.log('Already a member?:', membershipResult.rows.length > 0);

    // Check for existing pending invitation
    const existingInviteResult = await client.query(`
      SELECT invitation_id FROM league_invitations
      WHERE league_id = $1 AND invited_user_id = $2 AND status = 'pending'
    `, [leagueId, inviteeId]);

    console.log('Has pending invite?:', existingInviteResult.rows.length > 0);

    // Try to insert
    console.log('\nAttempting to insert invitation...');
    const invitationResult = await client.query(`
      INSERT INTO league_invitations (
        league_id,
        inviting_user_id,
        invited_user_id,
        status,
        message,
        invitation_method,
        expires_at,
        created_at
      )
      VALUES ($1, $2, $3, 'pending', $4, 'username', NOW() + INTERVAL '7 days', NOW())
      RETURNING *
    `, [leagueId, inviterId, inviteeId, 'Test invitation']);

    console.log('✅ Invitation created successfully!');
    console.log(invitationResult.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
    console.error('Code:', error.code);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testInvite();
