/**
 * Check coupon system status
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCoupons() {
  try {
    // Check if coupons table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'coupons'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Coupons table does not exist');
      return;
    }

    console.log('✅ Coupons table exists\n');

    // Get all coupons
    const coupons = await pool.query(`
      SELECT * FROM coupons
      ORDER BY created_at DESC
    `);

    console.log(`Found ${coupons.rows.length} coupon(s):\n`);
    coupons.rows.forEach(c => {
      console.log(`Code: ${c.code}`);
      console.log(`  Description: ${c.description}`);
      console.log(`  Times Redeemed: ${c.times_redeemed}`);
      console.log(`  Redemption Limit: ${c.redemption_limit || 'Unlimited'}`);
      console.log(`  Active: ${c.is_active}`);
      console.log(`  Created: ${c.created_at}`);
      console.log();
    });

    // Check if there's a coupon_redemptions tracking table
    const redemptionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'coupon_redemptions'
      );
    `);

    if (redemptionsTableCheck.rows[0].exists) {
      console.log('✅ Coupon redemptions tracking table exists\n');

      const redemptions = await pool.query(`
        SELECT * FROM coupon_redemptions
        ORDER BY redeemed_at DESC
        LIMIT 10
      `);

      console.log(`Recent redemptions: ${redemptions.rows.length}\n`);
      redemptions.rows.forEach(r => {
        console.log(`Player ${r.player_id} redeemed "${r.coupon_code}" at ${r.redeemed_at}`);
      });
    } else {
      console.log('⚠️  No coupon_redemptions tracking table found');
      console.log('   Redemptions are not being tracked individually\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCoupons();
