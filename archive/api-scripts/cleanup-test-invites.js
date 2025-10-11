import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  
  try {
    console.log('🧹 Cleaning up test invite data...');

    // Get temporary/test players (those created from new player invites)
    const tempPlayersResult = await client.query(`
      SELECT player_id, name, email 
      FROM players 
      WHERE (
        email LIKE '%@temp.local' OR 
        email LIKE '%temp_%@%' OR
        password_hash = 'temp_password_hash_for_invited_player'
      )
      ORDER BY created_at DESC
    `);

    const tempPlayers = tempPlayersResult.rows;
    console.log(`Found ${tempPlayers.length} temporary players to clean up:`);
    tempPlayers.forEach(p => console.log(`  - ${p.name} (${p.email}) - ID: ${p.player_id}`));

    let cleanupStats = {
      temp_players_removed: 0,
      duels_cleaned: 0,
      referrals_cleaned: 0,
      friends_cleaned: 0,
      stats_cleaned: 0
    };

    if (tempPlayers.length > 0) {
      const tempPlayerIds = tempPlayers.map(p => p.player_id);

      // Clean up related data first (to avoid foreign key constraints)
      
      // 1. Clean up referrals
      const referralsResult = await client.query(`
        DELETE FROM player_referrals 
        WHERE referrer_id = ANY($1) OR referred_player_id = ANY($1)
        RETURNING referral_id
      `, [tempPlayerIds]);
      cleanupStats.referrals_cleaned = referralsResult.rowCount || 0;

      // 2. Clean up friendships
      const friendsResult = await client.query(`
        DELETE FROM player_friends 
        WHERE player_id = ANY($1) OR friend_player_id = ANY($1)
        RETURNING player_id
      `, [tempPlayerIds]);
      cleanupStats.friends_cleaned = friendsResult.rowCount || 0;

      // 3. Clean up duels (both as creator and invited player)
      const duelsResult = await client.query(`
        DELETE FROM duels 
        WHERE duel_creator_id = ANY($1) OR duel_invited_player_id = ANY($1)
        RETURNING duel_id
      `, [tempPlayerIds]);
      cleanupStats.duels_cleaned = duelsResult.rowCount || 0;

      // 4. Clean up player stats
      const statsResult = await client.query(`
        DELETE FROM player_stats 
        WHERE player_id = ANY($1)
        RETURNING player_id
      `, [tempPlayerIds]);
      cleanupStats.stats_cleaned = statsResult.rowCount || 0;

      // 5. Finally, remove the temporary players
      const playersResult = await client.query(`
        DELETE FROM players 
        WHERE player_id = ANY($1)
        RETURNING player_id
      `, [tempPlayerIds]);
      cleanupStats.temp_players_removed = playersResult.rowCount || 0;
    }

    // Also clean up any orphaned duels with status 'pending_new_player' that are old
    const orphanedDuelsResult = await client.query(`
      DELETE FROM duels 
      WHERE status = 'pending_new_player' 
      AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING duel_id
    `);
    cleanupStats.duels_cleaned += (orphanedDuelsResult.rowCount || 0);

    // Reset invitation counters for all remaining players to allow fresh testing
    const resetCountersResult = await client.query(`
      UPDATE players 
      SET daily_invites_sent = 0, last_invite_date = NULL
      WHERE daily_invites_sent > 0 OR last_invite_date IS NOT NULL
      RETURNING player_id
    `);

    console.log('✅ Cleanup completed successfully');
    console.log('Cleanup stats:', cleanupStats);
    console.log(`Reset invitation counters for ${resetCountersResult.rowCount || 0} players`);

    return res.status(200).json({
      success: true,
      message: 'Test invite cleanup completed successfully',
      cleanup_stats: cleanupStats,
      invitation_counters_reset: resetCountersResult.rowCount || 0,
      temp_players_found: tempPlayers.length,
      details: tempPlayers.map(p => ({
        id: p.player_id,
        name: p.name,
        email: p.email
      }))
    });

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    });
  } finally {
    client.release();
  }
}