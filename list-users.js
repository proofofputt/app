#!/usr/bin/env node

/**
 * List all users from the database
 * Usage: node list-users.js [--limit N]
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Parse command line args
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 50;

(async () => {
  try {
    // Get all users with basic info
    const result = await pool.query(`
      SELECT
        player_id,
        email,
        name,
        membership_tier,
        is_subscribed,
        subscription_expires_at,
        created_at
      FROM players
      ORDER BY player_id
      LIMIT $1
    `, [limit]);

    console.log(`\nFound ${result.rows.length} users:\n`);
    console.log('ID    | Email                    | Name                 | Tier      | Subscribed | Expires    | Created');
    console.log('-'.repeat(120));

    result.rows.forEach(user => {
      const id = String(user.player_id).padEnd(6);
      const email = (user.email || 'N/A').substring(0, 24).padEnd(24);
      const name = (user.name || 'N/A').substring(0, 20).padEnd(20);
      const tier = (user.membership_tier || 'free').padEnd(10);
      const subscribed = user.is_subscribed ? 'Yes' : 'No ';
      const expires = user.subscription_expires_at
        ? new Date(user.subscription_expires_at).toISOString().split('T')[0]
        : 'N/A       ';
      const created = user.created_at
        ? new Date(user.created_at).toISOString().split('T')[0]
        : 'N/A';

      console.log(`${id} | ${email} | ${name} | ${tier} | ${subscribed}        | ${expires} | ${created}`);
    });

    // Get summary stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_subscribed THEN 1 END) as subscribed_users,
        COUNT(CASE WHEN membership_tier = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN membership_tier = 'regular' THEN 1 END) as regular_users,
        COUNT(CASE WHEN membership_tier = 'basic' THEN 1 END) as basic_users,
        COUNT(CASE WHEN membership_tier = 'free' OR membership_tier IS NULL THEN 1 END) as free_users
      FROM players
    `);

    console.log('\n' + '-'.repeat(120));
    console.log('\nUser Statistics:');
    console.log(`  Total Users: ${stats.rows[0].total_users}`);
    console.log(`  Subscribed: ${stats.rows[0].subscribed_users}`);
    console.log(`  Premium Tier: ${stats.rows[0].premium_users}`);
    console.log(`  Regular Tier: ${stats.rows[0].regular_users}`);
    console.log(`  Basic Tier: ${stats.rows[0].basic_users}`);
    console.log(`  Free Tier: ${stats.rows[0].free_users}`);

    console.log('\n');

  } catch (error) {
    console.error('Error querying database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
