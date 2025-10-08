import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  console.warn('DATABASE_URL not configured - using mock data');
}

// Transform detailed makes categories into overview format
function transformMakesOverview(detailedMakes) {
  const overview = { TOP: 0, RIGHT: 0, LOW: 0, LEFT: 0 };
  
  Object.entries(detailedMakes).forEach(([key, value]) => {
    if (key.includes('TOP')) overview.TOP += value;
    if (key.includes('RIGHT')) overview.RIGHT += value;
    if (key.includes('LOW')) overview.LOW += value;
    if (key.includes('LEFT')) overview.LEFT += value;
  });
  
  return overview;
}

// Transform detailed misses categories into overview format
function transformMissesOverview(detailedMisses) {
  const overview = { RETURN: 0, CATCH: 0, TIMEOUT: 0, 'QUICK PUTT': 0 };
  
  Object.entries(detailedMisses).forEach(([key, value]) => {
    if (key.includes('RETURN')) overview.RETURN += value;
    if (key.includes('CATCH')) overview.CATCH += value;
    if (key.includes('TIMEOUT')) overview.TIMEOUT += value;
    if (key.includes('QUICK')) overview['QUICK PUTT'] += value;
  });
  
  return overview;
}

// Format duration from seconds to MM:SS format
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id: playerId, limit, sort, page } = req.query;

  if (req.method === 'GET') {
    try {
      let sessions = [];
      let totalSessions = 0;
      
      if (pool) {
        const dbClient = await pool.connect();
        try {
          // Get total count of sessions first
          const countResult = await dbClient.query(
            'SELECT COUNT(*) FROM sessions WHERE player_id = $1',
            [parseInt(playerId)]
          );
          totalSessions = parseInt(countResult.rows[0].count);
          
          // Build query with pagination support - include full competition context
          let query = `
            SELECT
              s.session_id,
              s.data,
              s.stats_summary,
              s.created_at,
              s.updated_at,
              -- Duel context
              COALESCE(d1.duel_id, d2.duel_id) as duel_id,
              COALESCE(d1.status, d2.status) as duel_status,
              CASE
                WHEN d1.duel_creator_id = s.player_id THEN d1.duel_invited_player_id
                WHEN d1.duel_invited_player_id = s.player_id THEN d1.duel_creator_id
                WHEN d2.duel_creator_id = s.player_id THEN d2.duel_invited_player_id
                WHEN d2.duel_invited_player_id = s.player_id THEN d2.duel_creator_id
                ELSE NULL
              END as duel_opponent_id,
              CASE
                WHEN d1.duel_creator_id = s.player_id THEN invited_player1.name
                WHEN d1.duel_invited_player_id = s.player_id THEN creator1.name
                WHEN d2.duel_creator_id = s.player_id THEN invited_player2.name
                WHEN d2.duel_invited_player_id = s.player_id THEN creator2.name
                ELSE NULL
              END as duel_opponent_name,
              -- League context
              lrs.league_id,
              lrs.round_id as league_round_id,
              l.name as league_name,
              lr.round_number
            FROM sessions s
            LEFT JOIN duels d1 ON s.session_id = d1.duel_creator_session_id
            LEFT JOIN duels d2 ON s.session_id = d2.duel_invited_player_session_id
            LEFT JOIN players creator1 ON d1.duel_creator_id = creator1.player_id
            LEFT JOIN players invited_player1 ON d1.duel_invited_player_id = invited_player1.player_id
            LEFT JOIN players creator2 ON d2.duel_creator_id = creator2.player_id
            LEFT JOIN players invited_player2 ON d2.duel_invited_player_id = invited_player2.player_id
            -- LEFT JOIN for league sessions
            LEFT JOIN league_round_sessions lrs ON s.session_id = lrs.session_id
            LEFT JOIN leagues l ON lrs.league_id = l.league_id
            LEFT JOIN league_rounds lr ON lrs.round_id = lr.round_id
            WHERE s.player_id = $1
            ORDER BY COALESCE(s.updated_at, s.created_at, NOW()) DESC
          `;
          const params = [parseInt(playerId)];
          
          // Handle pagination (page parameter takes precedence over simple limit)
          if (page && !isNaN(parseInt(page))) {
            const pageNum = parseInt(page);
            const limitNum = (limit && !isNaN(parseInt(limit))) ? parseInt(limit) : 20; // Default 20 per page
            const offset = (pageNum - 1) * limitNum;
            
            query += ' LIMIT $2 OFFSET $3';
            params.push(limitNum, offset);
          } else if (limit && !isNaN(parseInt(limit))) {
            // Simple limit without pagination
            query += ' LIMIT $2';
            params.push(parseInt(limit));
          }
          
          const result = await dbClient.query(query, params);

          // Calculate daily session numbers for each session
          const calculateDailySessionNumbers = (rows) => {
            const dailyTotals = {};
            const dailyCounters = {};
            const sessionNumbers = {};

            // First pass: count total sessions per day
            rows.forEach((row) => {
              const timestamp = row.updated_at || row.created_at || new Date().toISOString();
              const date = new Date(timestamp);
              const dateKey = date.toDateString(); // "Thu Sep 26 2024"

              if (!dailyTotals[dateKey]) {
                dailyTotals[dateKey] = 0;
              }
              dailyTotals[dateKey] += 1;
            });

            // Second pass: assign numbers with newest = 1 (as requested by user)
            rows.forEach((row) => {
              const timestamp = row.updated_at || row.created_at || new Date().toISOString();
              const date = new Date(timestamp);
              const dateKey = date.toDateString(); // "Thu Sep 26 2024"

              // Initialize counter for this date if not exists
              if (!dailyCounters[dateKey]) {
                dailyCounters[dateKey] = 1; // Start from 1 for newest session
              }

              // Store session number for this session (increments so newest = 1)
              sessionNumbers[row.session_id] = dailyCounters[dateKey];
              dailyCounters[dateKey] += 1; // Increment for next (older) session
            });

            return sessionNumbers;
          };

          const dailySessionNumbers = calculateDailySessionNumbers(result.rows);

          sessions = result.rows.map((row, index) => {
            const data = row.data || {};
            const stats = row.stats_summary || {};
            const sessionInfo = data.session_info || {};
            const analyticStats = data.analytic_stats || {};
            const consecutiveStats = data.consecutive_stats || {};
            const timeStats = data.time_stats || {};
            
            const totalPutts = data.total_putts || analyticStats.total_putts || stats.total_putts || 0;
            const totalMakes = data.total_makes || analyticStats.total_makes || stats.total_makes || 0;
            const totalMisses = data.total_misses || analyticStats.total_misses || stats.total_misses || (totalPutts - totalMakes);
            const sessionDurationSeconds = data.session_duration_seconds || sessionInfo.session_duration_seconds || stats.session_duration || 0;

            // Prioritize updated_at over created_at for proper date display
            const sessionTimestamp = row.updated_at || row.created_at || new Date().toISOString();

            // Format session date as "Sep 26, Session 3" instead of timestamp
            const formatSessionDate = (timestamp, sessionNumber) => {
              const date = new Date(timestamp);
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

              const month = monthNames[date.getMonth()];
              const day = date.getDate();

              return `${month} ${day}, #${sessionNumber}`;
            };

            const sessionNumber = dailySessionNumbers[row.session_id] || 1;
            const formattedSessionDate = formatSessionDate(sessionTimestamp, sessionNumber);

            // Determine competition context
            let competitionContext = null;
            if (row.duel_id) {
              competitionContext = {
                type: 'duel',
                duel_id: row.duel_id,
                opponent_id: row.duel_opponent_id,
                opponent_name: row.duel_opponent_name,
                status: row.duel_status
              };
            } else if (row.league_id) {
              competitionContext = {
                type: 'league',
                league_id: row.league_id,
                league_round_id: row.league_round_id,
                league_name: row.league_name,
                round_number: row.round_number
              };
            }

            return {
              // Legacy format for compatibility
              id: index + 1,
              date: sessionTimestamp,
              duration: formatDuration(sessionDurationSeconds), // Use formatted MM:SS duration
              total_putts: totalPutts,
              makes: totalMakes,
              make_percentage: parseFloat((data.make_percentage || analyticStats.make_percentage || stats.make_percentage || 0).toFixed(1)),
              best_streak: data.best_streak || consecutiveStats.max_consecutive || stats.best_streak || 0,
              avg_distance: 0,
              session_type: "practice",
              
              // New format expected by SessionRow component
              session_id: row.session_id,
              start_time: sessionTimestamp,
              session_date: formattedSessionDate, // Use formatted date like "Sep 26, Session 3"
              created_at: sessionTimestamp,
              duel_id: row.duel_id || null,
              session_duration: sessionDurationSeconds,
              // Competition context
              competition: competitionContext,
              total_makes: totalMakes,
              total_misses: totalMisses,
              fastest_21_makes: data.fastest_21_makes_seconds || data.fastest_21_makes || timeStats.fastest_21_makes_seconds || null,
              putts_per_minute: data.putts_per_minute || timeStats.putts_per_minute || null,
              makes_per_minute: data.makes_per_minute || timeStats.makes_per_minute || null,
              most_makes_in_60_seconds: data.most_makes_in_60_seconds || timeStats.most_makes_in_60_seconds || null,
              
              // Additional fields for compatibility with player-sessions-latest format
              misses: totalMisses,
              ppm: data.putts_per_minute || timeStats.putts_per_minute || 0,
              mpm: data.makes_per_minute || timeStats.makes_per_minute || 0,
              most_in_60s: data.most_makes_in_60_seconds || timeStats.most_makes_in_60_seconds || 0,
              fastest_21: data.fastest_21_makes_seconds || data.fastest_21_makes || timeStats.fastest_21_makes_seconds || null,
              
              // Detailed category data for expanded view
              makes_by_category: data.makes_by_category || analyticStats.makes_by_category || {},
              misses_by_category: data.misses_by_category || analyticStats.misses_by_category || {},
              
              // Transform detailed data into overview format expected by SessionRow
              makes_overview: transformMakesOverview(data.makes_by_category || analyticStats.makes_by_category || {}),
              misses_overview: transformMissesOverview(data.misses_by_category || analyticStats.misses_by_category || {}),
              
              consecutive_by_category: (() => {
                // First try to get the new consecutive_by_category format from SessionReporter
                const newFormat = data.consecutive_by_category || {};
                const consecutiveStats = data.consecutive_stats || {};
                
                // If we have the new format, use it; otherwise fall back to individual fields
                if (newFormat && Object.keys(newFormat).length > 0 && Object.values(newFormat).some(v => v > 0)) {
                  // Convert numeric keys to strings for consistency
                  const result = {};
                  [3, 7, 10, 15, 21, 50, 100].forEach(threshold => {
                    result[threshold.toString()] = newFormat[threshold] || newFormat[threshold.toString()] || 0;
                  });
                  return result;
                } else {
                  // Legacy format fallback
                  return {
                    "3": data.streaks_over_3 || consecutiveStats.streaks_over_3 || 0,
                    "7": data.streaks_over_7 || 0,
                    "10": data.streaks_over_10 || consecutiveStats.streaks_over_10 || 0,
                    "15": data.streaks_over_15 || consecutiveStats.streaks_over_15 || 0,
                    "21": data.streaks_over_21 || consecutiveStats.streaks_over_21 || 0,
                    "50": data.streaks_over_50 || 0,
                    "100": data.streaks_over_100 || 0
                  };
                }
              })()
            };
          });
        } finally {
          dbClient.release();
        }
      }
      
      // No fallback mock data - return empty sessions array for clean testing

      // Calculate pagination metadata
      const currentPage = page ? parseInt(page) : 1;
      const itemsPerPage = (limit && !isNaN(parseInt(limit))) ? parseInt(limit) : (page ? 20 : sessions.length);
      const totalPages = page ? Math.ceil(totalSessions / itemsPerPage) : 1;

      return res.status(200).json({
        sessions,
        player_id: parseInt(playerId),
        pagination: {
          totalSessions,
          currentPage,
          totalPages,
          perPage: itemsPerPage
        }
      });
      
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}