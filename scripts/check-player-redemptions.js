/**
 * Check if player 1009 redeemed any gift codes
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const playerId = 1009;

async function checkRedemptions() {
  console.log(`Checking gift code redemptions for player ${playerId}...\n`);

  try {
    // Check if they redeemed any codes
    const redemptions = await pool.query(`
      SELECT
        ugs.id,
        ugs.gift_code,
        ugs.owner_user_id,
        ugs.redeemed_at,
        ugs.created_at,
        p.name as gifter_name,
        p.email as gifter_email
      FROM user_gift_subscriptions ugs
      LEFT JOIN players p ON ugs.owner_user_id = p.player_id
      WHERE ugs.redeemed_by_user_id = $1
      ORDER BY ugs.redeemed_at DESC
    `, [playerId]);

    console.log(`Found ${redemptions.rows.length} redemption(s):\n`);

    if (redemptions.rows.length > 0) {
      redemptions.rows.forEach(r => {
        console.log(`Code: ${r.gift_code}`);
        console.log(`  From: ${r.gifter_name} (${r.gifter_email})`);
        console.log(`  Owner Player ID: ${r.owner_user_id}`);
        console.log(`  Redeemed: ${r.redeemed_at}`);
        console.log(`  Code Created: ${r.created_at}`);
        console.log();
      });
    } else {
      console.log('❌ No gift code redemptions found for this player');
    }

    // Check for "Early" access codes specifically
    const earlyAccessCodes = await pool.query(`
      SELECT
        gift_code,
        owner_user_id,
        is_redeemed,
        redeemed_by_user_id,
        redeemed_at,
        created_at
      FROM user_gift_subscriptions
      WHERE LOWER(gift_code) LIKE '%early%'
         OR owner_user_id = 1  -- Often system/admin codes are owned by player 1
      ORDER BY created_at DESC
    `);

    console.log(`\nFound ${earlyAccessCodes.rows.length} potential "Early" access codes:\n`);

    if (earlyAccessCodes.rows.length > 0) {
      earlyAccessCodes.rows.forEach(code => {
        console.log(`Code: ${code.gift_code}`);
        console.log(`  Owner: ${code.owner_user_id}`);
        console.log(`  Redeemed: ${code.is_redeemed ? 'Yes' : 'No'}`);
        if (code.is_redeemed) {
          console.log(`  Redeemed By: ${code.redeemed_by_user_id}`);
          console.log(`  Redeemed At: ${code.redeemed_at}`);
        }
        console.log(`  Created: ${code.created_at}`);
        console.log();
      });
    }

    // Check player's current subscription status
    const playerStatus = await pool.query(`
      SELECT
        subscription_status,
        subscription_tier,
        membership_tier,
        subscription_expires_at,
        subscription_current_period_end,
        is_subscribed
      FROM players
      WHERE player_id = $1
    `, [playerId]);

    console.log(`\nPlayer ${playerId} Current Status:`);
    console.log(`  subscription_status: ${playerStatus.rows[0].subscription_status}`);
    console.log(`  subscription_tier: ${playerStatus.rows[0].subscription_tier}`);
    console.log(`  membership_tier: ${playerStatus.rows[0].membership_tier}`);
    console.log(`  is_subscribed: ${playerStatus.rows[0].is_subscribed}`);
    console.log(`  expires_at: ${playerStatus.rows[0].subscription_expires_at}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRedemptions();
