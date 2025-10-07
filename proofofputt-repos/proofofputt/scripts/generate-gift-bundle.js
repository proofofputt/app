#!/usr/bin/env node
/**
 * CLI Script to generate bundle subscription gift codes
 *
 * Usage:
 *   node scripts/generate-gift-bundle.js --user-id=123 --bundle-id=2 --label="BETA-CLUBXYZ" --reason="Partnership with Golf Club XYZ"
 *
 * Environment variables required:
 *   DATABASE_URL - PostgreSQL connection string
 *
 * Bundle IDs:
 *   1 = 3-Pack (10% discount)
 *   2 = 5-Pack (21% discount)
 *   3 = 10-Pack (42% discount)
 *   4 = 21-Pack (50% discount)
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  args.forEach(arg => {
    const match = arg.match(/--([^=]+)=(.+)/);
    if (match) {
      params[match[1]] = match[2];
    }
  });

  return params;
}

function generateCustomGiftCode(customLabel, index) {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${customLabel}-${randomPart}-${String(index).padStart(3, '0')}`;
}

async function generateGiftBundle() {
  const params = parseArgs();

  // Validate required parameters
  const required = ['user-id', 'bundle-id', 'label'];
  const missing = required.filter(r => !params[r]);

  if (missing.length > 0) {
    console.error('❌ Missing required parameters:', missing.join(', '));
    console.log('\nUsage:');
    console.log('  node scripts/generate-gift-bundle.js \\');
    console.log('    --user-id=123 \\');
    console.log('    --bundle-id=2 \\');
    console.log('    --label="BETA-CLUBXYZ" \\');
    console.log('    --reason="Partnership with Golf Club XYZ"');
    console.log('\nBundle IDs:');
    console.log('  1 = 3-Pack (10% discount)');
    console.log('  2 = 5-Pack (21% discount)');
    console.log('  3 = 10-Pack (42% discount)');
    console.log('  4 = 21-Pack (50% discount)');
    process.exit(1);
  }

  const userId = parseInt(params['user-id']);
  const bundleId = parseInt(params['bundle-id']);
  const customLabel = params['label'].toUpperCase().replace(/[^A-Z0-9-]/g, '-');
  const grantReason = params['reason'] || 'Manual grant via CLI';

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n🎁 Generating Gift Bundle Codes');
    console.log('================================\n');

    // 1. Verify user exists
    const userResult = await client.query(
      'SELECT player_id, username, email FROM players WHERE player_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = userResult.rows[0];
    console.log(`👤 User: ${user.username} (ID: ${user.player_id})`);
    console.log(`📧 Email: ${user.email || 'Not set'}`);

    // 2. Get bundle details
    const bundleResult = await client.query(
      'SELECT * FROM subscription_bundles WHERE id = $1',
      [bundleId]
    );

    if (bundleResult.rows.length === 0) {
      throw new Error(`Bundle with ID ${bundleId} not found`);
    }

    const bundle = bundleResult.rows[0];
    console.log(`📦 Bundle: ${bundle.name} (${bundle.quantity} subscriptions, ${bundle.discount_percentage}% discount)`);

    // 3. Check for duplicate label
    const existingLabel = await client.query(
      'SELECT COUNT(*) as count FROM user_gift_subscriptions WHERE custom_label = $1',
      [customLabel]
    );

    if (parseInt(existingLabel.rows[0].count) > 0) {
      throw new Error(`Custom label "${customLabel}" already exists. Please use a unique label.`);
    }

    console.log(`🏷️  Label: ${customLabel}`);
    console.log(`📝 Reason: ${grantReason}`);
    console.log('\n⏳ Generating codes...\n');

    // 4. Generate gift codes
    const generatedCodes = [];
    const now = new Date().toISOString();

    for (let i = 0; i < bundle.quantity; i++) {
      const giftCode = generateCustomGiftCode(customLabel, i + 1);

      await client.query(
        `INSERT INTO user_gift_subscriptions
         (owner_user_id, bundle_id, gift_code, custom_label, grant_reason, granted_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [userId, bundle.id, giftCode, customLabel, grantReason, now]
      );

      generatedCodes.push(giftCode);
      console.log(`  ✓ ${giftCode}`);
    }

    await client.query('COMMIT');

    console.log('\n✅ Success!');
    console.log(`\nGenerated ${bundle.quantity} gift codes for ${user.username}`);
    console.log('\n📋 Summary:');
    console.log(`   Owner: ${user.username} (ID: ${user.player_id})`);
    console.log(`   Bundle: ${bundle.name}`);
    console.log(`   Codes: ${generatedCodes.length}`);
    console.log(`   Label: ${customLabel}`);
    console.log('\n💡 The user can now view these codes in their Settings page under "Free Year Invites"');
    console.log('   and send them to partners/beta testers.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
generateGiftBundle();
