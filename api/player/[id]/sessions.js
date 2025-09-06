import { Pool } from 'pg';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
          
          // Build query with pagination support
          let query = 'SELECT session_id, data, stats_summary, created_at FROM sessions WHERE player_id = $1 ORDER BY created_at DESC';
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
            
            return {
              // Legacy format for compatibility
              id: index + 1,
              date: row.created_at || new Date().toISOString(),
              duration: formatDuration(sessionDurationSeconds), // Use formatted MM:SS duration
              total_putts: totalPutts,
              makes: totalMakes,
              make_percentage: parseFloat((data.make_percentage || analyticStats.make_percentage || stats.make_percentage || 0).toFixed(1)),
              best_streak: data.best_streak || consecutiveStats.max_consecutive || stats.best_streak || 0,
              avg_distance: 0,
              session_type: "practice",
              
              // New format expected by SessionRow component
              session_id: row.session_id,
              start_time: row.created_at || new Date().toISOString(),
              session_date: row.created_at || new Date().toISOString(),
              session_duration: sessionDurationSeconds,
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
              
              consecutive_by_category: {
                "3": data.streaks_over_3 || consecutiveStats.streaks_over_3 || 0,
                "7": data.streaks_over_7 || 0, // Check flat data first
                "10": data.streaks_over_10 || consecutiveStats.streaks_over_10 || 0,
                "15": data.streaks_over_15 || consecutiveStats.streaks_over_15 || 0,
                "21": data.streaks_over_21 || consecutiveStats.streaks_over_21 || 0,
                "50": data.streaks_over_50 || 0,
                "100": data.streaks_over_100 || 0
              }
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
        total_sessions: totalSessions,
        current_page: currentPage,
        total_pages: totalPages,
        per_page: itemsPerPage
      });
      
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}