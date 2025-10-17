/**
 * Check if gift code migrations have been applied
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkMigrations() {
  console.log('Checking gift code table migrations...\n');

  try {
    // Check if user_gift_subscriptions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user_gift_subscriptions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ MISSING: user_gift_subscriptions table');
      console.log('   Run: database/add_subscription_gifting_tables.sql\n');
      return false;
    }

    console.log('✅ user_gift_subscriptions table exists');

    // Check for admin tracking columns
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user_gift_subscriptions'
      AND column_name IN ('granted_by_admin_id', 'grant_reason', 'granted_at');
    `);

    const foundColumns = columnsCheck.rows.map(r => r.column_name);
    const requiredColumns = ['granted_by_admin_id', 'grant_reason', 'granted_at'];
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('❌ MISSING COLUMNS:', missingColumns.join(', '));
      console.log('   Run: database/add_gift_subscription_admin_tracking.sql\n');
      return false;
    }

    console.log('✅ Admin tracking columns present');

    // Check if admin_action_logs table exists
    const adminLogsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'admin_action_logs'
      );
    `);

    if (!adminLogsCheck.rows[0].exists) {
      console.log('⚠️  WARNING: admin_action_logs table missing');
      console.log('   This is optional but recommended for audit trail');
      console.log('   Run: database/add_admin_role.sql\n');
    } else {
      console.log('✅ admin_action_logs table exists');
    }

    console.log('\n✅ All required migrations applied!');
    console.log('The manual gift code generation should work now.\n');
    return true;

  } catch (error) {
    console.error('Error checking migrations:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

checkMigrations();
