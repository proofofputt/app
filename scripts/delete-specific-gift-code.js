/**
 * Delete a specific gift code
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const codeToDelete = 'GIFT-B12F7403AA0B8CC9';

async function deleteCode() {
  try {
    // Check if it exists first
    const checkResult = await pool.query(
      'SELECT id, gift_code, owner_user_id, is_redeemed FROM user_gift_subscriptions WHERE gift_code = $1',
      [codeToDelete]
    );

    if (checkResult.rows.length === 0) {
      console.log(`❌ Code ${codeToDelete} not found in database`);
      return;
    }

    const code = checkResult.rows[0];
    console.log(`Found code: ${code.gift_code}`);
    console.log(`  Owner: ${code.owner_user_id}`);
    console.log(`  Redeemed: ${code.is_redeemed}`);

    // Delete it
    const deleteResult = await pool.query(
      'DELETE FROM user_gift_subscriptions WHERE gift_code = $1 RETURNING gift_code',
      [codeToDelete]
    );

    console.log(`\n✅ Deleted: ${deleteResult.rows[0].gift_code}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

deleteCode();
