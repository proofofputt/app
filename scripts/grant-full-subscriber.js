/**
 * Grant Full Subscriber status to a player
 * Useful for manual grants, promotional access, etc.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const playerId = 1009;
const durationYears = 1; // Grant for 1 year

async function grantFullSubscriber() {
  console.log(`Granting Full Subscriber status to player ${playerId}...\n`);

  try {
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + durationYears);

    // Update player subscription
    const result = await pool.query(`
      UPDATE players
      SET
        membership_tier = 'premium',
        subscription_status = 'active',
        subscription_tier = 'full_subscriber',
        subscription_billing_cycle = 'manual',
        subscription_started_at = COALESCE(subscription_started_at, NOW()),
        subscription_current_period_start = NOW(),
        subscription_current_period_end = $1,
        subscription_expires_at = $1,
        subscription_cancel_at_period_end = FALSE,
        is_subscribed = TRUE,
        updated_at = NOW()
      WHERE player_id = $2
      RETURNING player_id, name, email, membership_tier, subscription_status, subscription_expires_at
    `, [expirationDate, playerId]);

    if (result.rows.length === 0) {
      console.log('❌ Player not found');
      return;
    }

    const player = result.rows[0];

    console.log('✅ Full Subscriber status granted!');
    console.log('='.repeat(60));
    console.log(`Player: ${player.name} (${player.email})`);
    console.log(`Tier: ${player.membership_tier}`);
    console.log(`Status: ${player.subscription_status}`);
    console.log(`Expires: ${player.subscription_expires_at}`);
    console.log(`Duration: ${durationYears} year(s)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

grantFullSubscriber();
