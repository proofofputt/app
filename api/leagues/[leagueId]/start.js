import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { leagueId } = req.query;
  const leagueIdInt = parseInt(leagueId);

  if (!leagueIdInt) {
    return res.status(400).json({ success: false, message: 'Valid league ID is required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get league details
    const leagueResult = await client.query(`
      SELECT league_id, name, status, rules
      FROM leagues 
      WHERE league_id = $1
    `, [leagueIdInt]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    const league = leagueResult.rows[0];
    
    // Only allow starting leagues in setup status
    if (league.status !== 'setup') {
      return res.status(400).json({ success: false, message: 'League cannot be started from current status' });
    }

    const rules = league.rules || {};
    const numRounds = rules.num_rounds || 4;
    const roundDurationHours = rules.round_duration_hours || 168; // 7 days

    await client.query('BEGIN');

    // Update league status to active
    await client.query(`
      UPDATE leagues 
      SET status = 'active', started_at = NOW(), updated_at = NOW()
      WHERE league_id = $1
    `, [leagueIdInt]);

    // Create rounds
    for (let i = 1; i <= numRounds; i++) {
      const startTime = new Date(Date.now() + (i - 1) * roundDurationHours * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + roundDurationHours * 60 * 60 * 1000);
      const status = i === 1 ? 'active' : 'scheduled';

      await client.query(`
        INSERT INTO league_rounds (league_id, round_number, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [leagueIdInt, i, startTime, endTime, status]);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'League started successfully',
      league_id: leagueIdInt,
      rounds_created: numRounds
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Start league API error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to start league',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}