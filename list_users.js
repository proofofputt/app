import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    // Get all users with basic info
    const result = await pool.query(`
      SELECT 
        player_id,
        email,
        display_name,
        name,
        membership_tier,
        is_subscribed,
        subscription_expires_at,
        created_at
      FROM players
      ORDER BY player_id
      LIMIT 50
    `);

    console.log(`\nFound ${result.rows.length} users:\n`);
    console.log('ID  | Email                    | Display Name         | Tier      | Subscribed | Expires');
    console.log('-'.repeat(100));
    
    result.rows.forEach(user => {
      const id = String(user.player_id).padEnd(4);
      const email = (user.email || 'N/A').substring(0, 24).padEnd(24);
      const displayName = (user.display_name || user.name || 'N/A').substring(0, 20).padEnd(20);
      const tier = (user.membership_tier || 'free').padEnd(10);
      const subscribed = user.is_subscribed ? 'Yes' : 'No ';
      const expires = user.subscription_expires_at 
        ? new Date(user.subscription_expires_at).toISOString().split('T')[0]
        : 'N/A';
      
      console.log(`${id} | ${email} | ${displayName} | ${tier} | ${subscribed}        | ${expires}`);
    });

    // Get summary stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_subscribed THEN 1 END) as subscribed_users,
        COUNT(CASE WHEN membership_tier = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN membership_tier = 'free' THEN 1 END) as free_users
      FROM players
    `);

    console.log('\n' + '-'.repeat(100));
    console.log('\nUser Statistics:');
    console.log(`  Total Users: ${stats.rows[0].total_users}`);
    console.log(`  Subscribed: ${stats.rows[0].subscribed_users}`);
    console.log(`  Premium: ${stats.rows[0].premium_users}`);
    console.log(`  Free: ${stats.rows[0].free_users}`);

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
})();
