import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { player_id } = req.query;

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'Player ID is required' });
  }

  try {
    const client = await pool.connect();
    
    // Get player info
    const playerResult = await client.query(
      'SELECT name FROM players WHERE player_id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get all sessions with data
    const sessionsResult = await client.query(`
      SELECT data FROM sessions 
      WHERE player_id = $1 AND data IS NOT NULL
      ORDER BY created_at ASC
    `, [player_id]);

    client.release();

    if (sessionsResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No sessions found for player' });
    }

    // Process sessions to aggregate category data
    const stats = processSessionsForCareerStats(sessionsResult.rows, player.name);
    
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error fetching career stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch career stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function processSessionsForCareerStats(sessionRows, playerName) {
  const stats = {
    player_name: playerName,
    
    // Basic aggregated stats
    high_makes: 0,
    sum_makes: 0,
    high_best_streak: 0,
    low_fastest_21: null,
    high_most_in_60: 0,
    high_ppm: 0,
    avg_ppm: 0,
    high_mpm: 0,
    avg_mpm: 0,
    high_duration: 0,
    sum_duration: 0,
    
    // Category aggregations
    consecutive: {},
    makes_overview: {},
    makes_detailed: {},
    misses_overview: {},
    misses_detailed: {}
  };

  let totalSessions = sessionRows.length;
  let totalPpm = 0;
  let totalMpm = 0;
  let ppmCount = 0;
  let mpmCount = 0;

  sessionRows.forEach(row => {
    const data = row.data;
    
    // Basic stats aggregation
    if (data.total_makes) {
      const makes = parseInt(data.total_makes);
      stats.sum_makes += makes;
      if (makes > stats.high_makes) stats.high_makes = makes;
    }
    
    if (data.best_streak) {
      const streak = parseInt(data.best_streak);
      if (streak > stats.high_best_streak) stats.high_best_streak = streak;
    }
    
    if (data.fastest_21_makes_seconds) {
      const fastest = parseFloat(data.fastest_21_makes_seconds);
      if (fastest > 0 && (stats.low_fastest_21 === null || fastest < stats.low_fastest_21)) {
        stats.low_fastest_21 = fastest;
      }
    }
    
    if (data.most_in_60_seconds) {
      const most60 = parseInt(data.most_in_60_seconds);
      if (most60 > stats.high_most_in_60) stats.high_most_in_60 = most60;
    }
    
    if (data.putts_per_minute) {
      const ppm = parseFloat(data.putts_per_minute);
      if (ppm > stats.high_ppm) stats.high_ppm = ppm;
      totalPpm += ppm;
      ppmCount++;
    }
    
    if (data.makes_per_minute) {
      const mpm = parseFloat(data.makes_per_minute);
      if (mpm > stats.high_mpm) stats.high_mpm = mpm;
      totalMpm += mpm;
      mpmCount++;
    }
    
    if (data.session_duration) {
      const duration = parseInt(data.session_duration);
      if (duration > stats.high_duration) stats.high_duration = duration;
      stats.sum_duration += duration;
    }

    // Process category arrays if they exist
    processCategoryData(data, 'consecutive_makes', stats.consecutive);
    processCategoryData(data, 'makes_overview', stats.makes_overview);
    processCategoryData(data, 'makes_detailed', stats.makes_detailed);
    processCategoryData(data, 'misses_overview', stats.misses_overview);
    processCategoryData(data, 'misses_detailed', stats.misses_detailed);
  });

  // Calculate averages
  stats.avg_ppm = ppmCount > 0 ? totalPpm / ppmCount : 0;
  stats.avg_mpm = mpmCount > 0 ? totalMpm / mpmCount : 0;

  return stats;
}

function processCategoryData(sessionData, categoryKey, categoryStats) {
  if (!sessionData[categoryKey] || !Array.isArray(sessionData[categoryKey])) {
    return;
  }

  sessionData[categoryKey].forEach(item => {
    if (!item.category || typeof item.value !== 'number') return;
    
    const category = item.category;
    if (!categoryStats[category]) {
      categoryStats[category] = { high: 0, sum: 0 };
    }
    
    categoryStats[category].sum += item.value;
    if (item.value > categoryStats[category].high) {
      categoryStats[category].high = item.value;
    }
  });
}