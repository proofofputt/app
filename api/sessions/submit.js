import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  console.warn('DATABASE_URL not configured - cannot store session data');
}

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests (e.g., from desktop app)
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  if (!pool) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database not configured' 
    });
  }

  const { session_data, verification, source, version } = req.body || {};

  // Validate required fields
  if (!session_data || !session_data.metadata) {
    return res.status(400).json({
      success: false,
      message: 'Session data and metadata are required',
    });
  }

  const { metadata, putt_log_entries, session_summary } = session_data;
  const { player_id, session_id, start_time, end_time, session_type } = metadata;

  if (!player_id || !session_id) {
    return res.status(400).json({
      success: false,
      message: 'Player ID and session ID are required',
    });
  }

  try {
    const dbClient = await pool.connect();
    
    try {
      await dbClient.query('BEGIN');

      // Transform session data to match database schema expectations
      const sessionDataForDB = {
        session_info: {
          session_id,
          player_id,
          session_type: session_type || 'practice',
          start_time,
          end_time,
          session_duration_seconds: session_summary?.session_duration_seconds || 0,
          source,
          version
        },
        analytic_stats: {
          total_putts: session_summary?.total_putts || 0,
          total_makes: session_summary?.total_makes || 0,
          total_misses: session_summary?.total_misses || 0,
          make_percentage: session_summary?.total_putts > 0 
            ? ((session_summary.total_makes / session_summary.total_putts) * 100).toFixed(2)
            : 0,
          makes_by_category: extractMakesByCategory(putt_log_entries || []),
          misses_by_category: extractMissesByCategory(putt_log_entries || [])
        },
        consecutive_stats: {
          max_consecutive: session_summary?.max_consecutive_makes || 0,
          streaks_over_3: calculateStreaksOverThreshold(putt_log_entries || [], 3),
          streaks_over_10: calculateStreaksOverThreshold(putt_log_entries || [], 10),
          streaks_over_15: calculateStreaksOverThreshold(putt_log_entries || [], 15),
          streaks_over_21: calculateStreaksOverThreshold(putt_log_entries || [], 21)
        },
        time_stats: {
          session_duration_seconds: session_summary?.session_duration_seconds || 0,
          putts_per_minute: calculatePuttsPerMinute(putt_log_entries || [], session_summary?.session_duration_seconds || 0),
          makes_per_minute: calculateMakesPerMinute(putt_log_entries || [], session_summary?.session_duration_seconds || 0),
          fastest_21_makes_seconds: calculateFastest21Makes(putt_log_entries || []),
          most_makes_in_60_seconds: calculateMostMakesIn60Seconds(putt_log_entries || [])
        },
        putt_log_entries: putt_log_entries || [],
        verification: verification || {},
        raw_metadata: metadata
      };

      const statsSum = {
        total_putts: session_summary?.total_putts || 0,
        total_makes: session_summary?.total_makes || 0,
        total_misses: session_summary?.total_misses || 0,
        make_percentage: session_summary?.total_putts > 0 
          ? ((session_summary.total_makes / session_summary.total_putts) * 100)
          : 0,
        max_consecutive_makes: session_summary?.max_consecutive_makes || 0,
        session_duration_seconds: session_summary?.session_duration_seconds || 0
      };

      // Insert session data
      const sessionResult = await dbClient.query(`
        INSERT INTO sessions (session_id, player_id, data, stats_summary, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          data = EXCLUDED.data,
          stats_summary = EXCLUDED.stats_summary,
          updated_at = NOW()
        RETURNING session_id
      `, [
        session_id, 
        player_id, 
        JSON.stringify(sessionDataForDB), 
        JSON.stringify(statsSum)
      ]);

      // Update player_stats aggregation table if it exists
      try {
        await dbClient.query(`
          INSERT INTO player_stats (
            player_id, total_sessions, total_putts, total_makes, total_misses, 
            make_percentage, best_streak, last_session_at, updated_at
          )
          VALUES ($1, 1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (player_id) 
          DO UPDATE SET 
            total_sessions = player_stats.total_sessions + 1,
            total_putts = player_stats.total_putts + $2,
            total_makes = player_stats.total_makes + $3,
            total_misses = player_stats.total_misses + $4,
            make_percentage = CASE 
              WHEN (player_stats.total_putts + $2) > 0 
              THEN ((player_stats.total_makes + $3)::DECIMAL / (player_stats.total_putts + $2)) * 100
              ELSE 0 
            END,
            best_streak = GREATEST(player_stats.best_streak, $6),
            last_session_at = NOW(),
            updated_at = NOW()
        `, [
          player_id,
          statsSum.total_putts,
          statsSum.total_makes, 
          statsSum.total_misses,
          statsSum.make_percentage,
          statsSum.max_consecutive_makes
        ]);
      } catch (statsError) {
        console.warn('Failed to update player_stats table:', statsError.message);
        // Continue - this is not critical
      }

      await dbClient.query('COMMIT');

      console.log(`Session ${session_id} successfully stored for player ${player_id}`);
      
      return res.status(200).json({
        success: true,
        session_id,
        message: 'Session data uploaded successfully',
        stats: statsSum
      });

    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }

  } catch (error) {
    console.error('Error storing session data:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to store session data',
      error: error.message 
    });
  }
}

// Helper functions for data transformation
function extractMakesByCategory(puttLogEntries) {
  const makes = {};
  puttLogEntries
    .filter(entry => entry.classification === 'MAKE')
    .forEach(entry => {
      const category = entry.detailed_classification || 'UNKNOWN';
      makes[category] = (makes[category] || 0) + 1;
    });
  return makes;
}

function extractMissesByCategory(puttLogEntries) {
  const misses = {};
  puttLogEntries
    .filter(entry => entry.classification === 'MISS')
    .forEach(entry => {
      const category = entry.detailed_classification || 'UNKNOWN';
      misses[category] = (misses[category] || 0) + 1;
    });
  return misses;
}

function calculateStreaksOverThreshold(puttLogEntries, threshold) {
  let streaks = 0;
  let currentStreak = 0;
  
  puttLogEntries
    .filter(entry => entry.classification === 'MAKE' || entry.classification === 'MISS')
    .forEach(entry => {
      if (entry.classification === 'MAKE') {
        currentStreak++;
      } else {
        if (currentStreak >= threshold) {
          streaks++;
        }
        currentStreak = 0;
      }
    });
  
  // Check final streak
  if (currentStreak >= threshold) {
    streaks++;
  }
  
  return streaks;
}

function calculatePuttsPerMinute(puttLogEntries, sessionDurationSeconds) {
  if (sessionDurationSeconds <= 0) return 0;
  const totalPutts = puttLogEntries.filter(entry => 
    entry.classification === 'MAKE' || entry.classification === 'MISS'
  ).length;
  return parseFloat((totalPutts / (sessionDurationSeconds / 60)).toFixed(2));
}

function calculateMakesPerMinute(puttLogEntries, sessionDurationSeconds) {
  if (sessionDurationSeconds <= 0) return 0;
  const totalMakes = puttLogEntries.filter(entry => entry.classification === 'MAKE').length;
  return parseFloat((totalMakes / (sessionDurationSeconds / 60)).toFixed(2));
}

function calculateFastest21Makes(puttLogEntries) {
  const makes = puttLogEntries
    .filter(entry => entry.classification === 'MAKE')
    .map(entry => entry.current_frame_time)
    .sort((a, b) => a - b);
    
  if (makes.length < 21) return null;
  
  let fastest = Infinity;
  for (let i = 0; i <= makes.length - 21; i++) {
    const timeSpan = makes[i + 20] - makes[i];
    if (timeSpan < fastest) {
      fastest = timeSpan;
    }
  }
  
  return fastest === Infinity ? null : parseFloat(fastest.toFixed(2));
}

function calculateMostMakesIn60Seconds(puttLogEntries) {
  const makes = puttLogEntries
    .filter(entry => entry.classification === 'MAKE')
    .map(entry => entry.current_frame_time)
    .sort((a, b) => a - b);
    
  if (makes.length === 0) return 0;
  
  let maxMakes = 0;
  for (let i = 0; i < makes.length; i++) {
    let count = 1; // Count the current make
    for (let j = i + 1; j < makes.length; j++) {
      if (makes[j] - makes[i] <= 60) {
        count++;
      } else {
        break;
      }
    }
    maxMakes = Math.max(maxMakes, count);
  }
  
  return maxMakes;
}