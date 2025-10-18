/**
 * Check player subscription data
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const playerId = 1009;

async function checkPlayer() {
  console.log(`Checking subscription data for player ${playerId}...\n`);

  try {
    const result = await pool.query(`
      SELECT
        player_id,
        name,
        email,
        membership_tier,
        subscription_status,
        subscription_tier,
        subscription_billing_cycle,
        subscription_started_at,
        subscription_current_period_start,
        subscription_current_period_end,
        subscription_expires_at,
        subscription_cancel_at_period_end,
        is_subscribed,
        zaprite_customer_id,
        zaprite_subscription_id,
        created_at
      FROM players
      WHERE player_id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      console.log('❌ Player not found');
      return;
    }

    const player = result.rows[0];

    console.log('Player Information:');
    console.log('='.repeat(60));
    console.log(`Name: ${player.name}`);
    console.log(`Email: ${player.email}`);
    console.log(`\nSubscription Status:`);
    console.log(`  membership_tier: ${player.membership_tier}`);
    console.log(`  subscription_status: ${player.subscription_status}`);
    console.log(`  subscription_tier: ${player.subscription_tier}`);
    console.log(`  subscription_billing_cycle: ${player.subscription_billing_cycle}`);
    console.log(`  is_subscribed: ${player.is_subscribed}`);
    console.log(`\nDates:`);
    console.log(`  subscription_started_at: ${player.subscription_started_at}`);
    console.log(`  subscription_current_period_start: ${player.subscription_current_period_start}`);
    console.log(`  subscription_current_period_end: ${player.subscription_current_period_end}`);
    console.log(`  subscription_expires_at: ${player.subscription_expires_at}`);
    console.log(`  subscription_cancel_at_period_end: ${player.subscription_cancel_at_period_end}`);
    console.log(`\nZaprite Integration:`);
    console.log(`  zaprite_customer_id: ${player.zaprite_customer_id}`);
    console.log(`  zaprite_subscription_id: ${player.zaprite_subscription_id}`);

    // Check for gift codes owned
    const giftCodesOwned = await pool.query(`
      SELECT id, gift_code, is_redeemed, created_at
      FROM user_gift_subscriptions
      WHERE owner_user_id = $1
      ORDER BY created_at DESC
    `, [playerId]);

    console.log(`\n\nGift Codes Owned: ${giftCodesOwned.rows.length}`);
    if (giftCodesOwned.rows.length > 0) {
      giftCodesOwned.rows.forEach(gc => {
        console.log(`  - ${gc.gift_code} (redeemed: ${gc.is_redeemed}, created: ${gc.created_at})`);
      });
    }

    // Check for gift codes redeemed
    const giftCodesRedeemed = await pool.query(`
      SELECT id, gift_code, owner_user_id, redeemed_at
      FROM user_gift_subscriptions
      WHERE redeemed_by_user_id = $1
      ORDER BY redeemed_at DESC
    `, [playerId]);

    console.log(`\nGift Codes Redeemed by Player: ${giftCodesRedeemed.rows.length}`);
    if (giftCodesRedeemed.rows.length > 0) {
      giftCodesRedeemed.rows.forEach(gc => {
        console.log(`  - ${gc.gift_code} (from player ${gc.owner_user_id}, redeemed: ${gc.redeemed_at})`);
      });
    }

    // Check Zaprite orders
    const orders = await pool.query(`
      SELECT event_id, event_type, payment_amount, processed, created_at
      FROM zaprite_events
      WHERE player_id = $1
      ORDER BY created_at DESC
    `, [playerId]);

    console.log(`\nZaprite Orders: ${orders.rows.length}`);
    if (orders.rows.length > 0) {
      orders.rows.forEach(order => {
        console.log(`  - ${order.event_type}: $${order.payment_amount} (processed: ${order.processed}, ${order.created_at})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPlayer();
