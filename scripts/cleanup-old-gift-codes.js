/**
 * Clean up old gift codes with "GIFT-" prefix format
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupOldGiftCodes() {
  console.log('Checking for old format gift codes...\n');

  try {
    // Find all gift codes with old "GIFT-" prefix format
    const oldCodesResult = await pool.query(`
      SELECT id, gift_code, owner_user_id, is_redeemed, created_at
      FROM user_gift_subscriptions
      WHERE gift_code LIKE 'GIFT-%'
      ORDER BY created_at DESC;
    `);

    if (oldCodesResult.rows.length === 0) {
      console.log('✅ No old format gift codes found!');
      return;
    }

    console.log(`Found ${oldCodesResult.rows.length} old format gift codes:\n`);

    const unredeemed = oldCodesResult.rows.filter(c => !c.is_redeemed);
    const redeemed = oldCodesResult.rows.filter(c => c.is_redeemed);

    console.log(`📊 Summary:`);
    console.log(`  - Unredeemed: ${unredeemed.length}`);
    console.log(`  - Redeemed: ${redeemed.length}\n`);

    console.log(`Unredeemed codes (will be deleted):`);
    unredeemed.forEach(code => {
      console.log(`  - ${code.gift_code} (owner: ${code.owner_user_id}, created: ${code.created_at})`);
    });

    if (redeemed.length > 0) {
      console.log(`\nRedeemed codes (will be kept for history):`);
      redeemed.forEach(code => {
        console.log(`  - ${code.gift_code} (redeemed)`);
      });
    }

    // Delete ONLY unredeemed codes (keep redeemed for history/audit)
    if (unredeemed.length > 0) {
      console.log(`\n🗑️  Deleting ${unredeemed.length} unredeemed old format codes...`);

      const deleteResult = await pool.query(`
        DELETE FROM user_gift_subscriptions
        WHERE gift_code LIKE 'GIFT-%'
        AND is_redeemed = FALSE
        RETURNING gift_code;
      `);

      console.log(`✅ Deleted ${deleteResult.rows.length} codes:`);
      deleteResult.rows.forEach(row => {
        console.log(`  - ${row.gift_code}`);
      });
    }

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

cleanupOldGiftCodes();
