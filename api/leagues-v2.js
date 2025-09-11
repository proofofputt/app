import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

/**
 * Calculate league standings based on member sessions
 */
async function calculateLeagueStandings(client, leagueId, rules) {
  const scoringMethod = rules.scoring_method || 'cumulative';
  const minSessions = rules.min_sessions_per_round || 1;
  
  // Get league members and their recent sessions
  const query = `
    SELECT 
      lm.player_id,
      u.display_name as player_name,
      COUNT(s.session_id) as session_count,
      AVG((s.data->>'make_percentage')::decimal) as avg_percentage,
      SUM((s.data->>'total_makes')::integer) as total_makes,
      MAX((s.data->>'best_streak')::integer) as best_streak,
      MIN((s.data->>'fastest_21_makes')::decimal) as fastest_21
    FROM league_memberships lm
    LEFT JOIN users u ON lm.player_id = u.id
    LEFT JOIN sessions s ON lm.player_id = s.player_id 
      AND s.created_at >= (SELECT start_date FROM leagues WHERE league_id = $1)
      AND s.created_at <= COALESCE((SELECT end_date FROM leagues WHERE league_id = $1), NOW())
    WHERE lm.league_id = $1 AND lm.is_active = true
    GROUP BY lm.player_id, u.display_name
    HAVING COUNT(s.session_id) >= $2
    ORDER BY 
      CASE 
        WHEN $3 = 'cumulative' THEN SUM((s.data->>'total_makes')::integer)
        WHEN $3 = 'average' THEN AVG((s.data->>'make_percentage')::decimal)
        WHEN $3 = 'best_session' THEN MAX((s.data->>'total_makes')::integer)
        ELSE SUM((s.data->>'total_makes')::integer)
      END DESC
  `;
  
  const result = await client.query(query, [leagueId, minSessions, scoringMethod]);
  
  return result.rows.map((row, index) => ({
    rank: index + 1,
    player_id: row.player_id,
    player_name: row.player_name || `Player ${row.player_id}`,
    session_count: parseInt(row.session_count || 0),
    total_makes: parseInt(row.total_makes || 0),
    avg_percentage: parseFloat(row.avg_percentage || 0),
    best_streak: parseInt(row.best_streak || 0),
    fastest_21: parseFloat(row.fastest_21 || 999999),
    score: calculateLeagueScore(row, scoringMethod)
  }));
}

function calculateLeagueScore(playerStats, method) {
  switch(method) {
    case 'cumulative':
      return playerStats.total_makes || 0;
    case 'average':
      return Math.round((playerStats.avg_percentage || 0) * 100) / 100;
    case 'best_session':
      return playerStats.best_streak || 0;
    default:
      return playerStats.total_makes || 0;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      const { league_id, include_standings = 'false', status = 'active' } = req.query;
      
      if (league_id) {
        // Get specific league details
        const leagueResult = await client.query(`
          SELECT l.*, u.display_name as creator_name,
                 (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = l.league_id AND lm.is_active = true) as member_count
          FROM leagues l
          LEFT JOIN users u ON l.created_by = u.id
          WHERE l.league_id = $1
        `, [league_id]);
        
        if (leagueResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'League not found' });
        }
        
        const league = leagueResult.rows[0];
        
        // Get members
        const membersResult = await client.query(`
          SELECT lm.player_id, u.display_name as player_name, lm.joined_at
          FROM league_memberships lm
          LEFT JOIN users u ON lm.player_id = u.id
          WHERE lm.league_id = $1 AND lm.is_active = true
          ORDER BY lm.joined_at
        `, [league_id]);
        
        const response = {
          success: true,
          league: {
            league_id: league.league_id,
            name: league.name,
            description: league.description,
            league_type: league.league_type,
            status: league.status,
            rules: league.rules,
            max_members: league.max_members,
            member_count: parseInt(league.member_count),
            creator_name: league.creator_name || `Player ${league.created_by}`,
            start_date: league.start_date,
            end_date: league.end_date,
            created_at: league.created_at
          },
          members: membersResult.rows.map(row => ({
            player_id: row.player_id,
            player_name: row.player_name || `Player ${row.player_id}`,
            joined_at: row.joined_at
          }))
        };
        
        // Include standings if requested
        if (include_standings === 'true') {
          const standings = await calculateLeagueStandings(client, league_id, league.rules || {});
          response.standings = standings;
        }
        
        return res.status(200).json(response);
      } else {
        // List leagues
        const user = await verifyToken(req);
        let query = `
          SELECT l.*, u.display_name as creator_name,
                 (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = l.league_id AND lm.is_active = true) as member_count
          FROM leagues l
          LEFT JOIN users u ON l.created_by = u.id
          WHERE l.status = $1
        `;
        let queryParams = [status];
        
        // If authenticated, show user's leagues first
        if (user) {
          query += ` ORDER BY (CASE WHEN l.created_by = $2 THEN 0 ELSE 1 END), l.created_at DESC`;
          queryParams.push(parseInt(user.playerId));
        } else {
          query += ` ORDER BY l.created_at DESC`;
        }
        
        query += ` LIMIT 50`;
        
        const result = await client.query(query, queryParams);
        
        const leagues = result.rows.map(row => ({
          league_id: row.league_id,
          name: row.name,
          description: row.description,
          league_type: row.league_type,
          status: row.status,
          max_members: row.max_members,
          member_count: parseInt(row.member_count),
          creator_name: row.creator_name || `Player ${row.created_by}`,
          start_date: row.start_date,
          end_date: row.end_date,
          created_at: row.created_at,
          is_full: parseInt(row.member_count) >= row.max_members
        }));
        
        return res.status(200).json({
          success: true,
          leagues,
          total: leagues.length
        });
      }
    }

    if (req.method === 'POST') {
      // Authentication required for creating leagues
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      
      const { action, league_id } = req.body;
      
      if (action === 'join' && league_id) {
        // Join existing league
        const playerId = parseInt(user.playerId);
        
        // Check if league exists and has space
        const leagueResult = await client.query(`
          SELECT l.*, 
                 (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = l.league_id AND lm.is_active = true) as member_count
          FROM leagues l WHERE l.league_id = $1 AND l.status = 'active'
        `, [league_id]);
        
        if (leagueResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'League not found or not active' });
        }
        
        const league = leagueResult.rows[0];
        const memberCount = parseInt(league.member_count);
        
        if (memberCount >= league.max_members) {
          return res.status(400).json({ success: false, message: 'League is full' });
        }
        
        // Check if already a member
        const existingMember = await client.query(
          'SELECT * FROM league_memberships WHERE league_id = $1 AND player_id = $2',
          [league_id, playerId]
        );
        
        if (existingMember.rows.length > 0) {
          if (existingMember.rows[0].is_active) {
            return res.status(400).json({ success: false, message: 'Already a member of this league' });
          } else {
            // Reactivate membership
            await client.query(
              'UPDATE league_memberships SET is_active = true, joined_at = NOW() WHERE league_id = $1 AND player_id = $2',
              [league_id, playerId]
            );
          }
        } else {
          // Create new membership
          await client.query(
            'INSERT INTO league_memberships (league_id, player_id, joined_at, is_active) VALUES ($1, $2, NOW(), true)',
            [league_id, playerId]
          );
        }
        
        return res.status(200).json({
          success: true,
          message: 'Successfully joined league',
          league_id: league_id
        });
      } else {
        // Create new league
        const { name, description, league_type = 'weekly', rules = {} } = req.body;
        
        if (!name) {
          return res.status(400).json({ success: false, message: 'League name is required' });
        }
        
        const playerId = parseInt(user.playerId);
        
        // Set default rules
        const defaultRules = {
          round_duration_days: league_type === 'weekly' ? 7 : league_type === 'monthly' ? 30 : 90,
          min_sessions_per_round: 3,
          max_sessions_per_round: 10,
          scoring_method: 'cumulative',
          handicap_system: 'none',
          ...rules
        };
        
        const maxMembers = rules.max_members || 50;
        const startDate = rules.start_date ? new Date(rules.start_date) : new Date();
        const endDate = rules.end_date ? new Date(rules.end_date) : 
          new Date(startDate.getTime() + (defaultRules.round_duration_days * 24 * 60 * 60 * 1000));
        
        // Create league
        const insertResult = await client.query(`
          INSERT INTO leagues (name, description, league_type, status, rules, max_members, 
                             start_date, end_date, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING league_id, created_at
        `, [name, description, league_type, 'active', JSON.stringify(defaultRules), 
            maxMembers, startDate, endDate, playerId]);
        
        const leagueId = insertResult.rows[0].league_id;
        
        // Add creator as first member
        await client.query(
          'INSERT INTO league_memberships (league_id, player_id, joined_at, is_active) VALUES ($1, $2, NOW(), true)',
          [leagueId, playerId]
        );
        
        return res.status(201).json({
          success: true,
          message: 'League created successfully',
          league: {
            league_id: leagueId,
            name: name,
            description: description,
            league_type: league_type,
            status: 'active',
            rules: defaultRules,
            max_members: maxMembers,
            member_count: 1,
            start_date: startDate,
            end_date: endDate,
            created_at: insertResult.rows[0].created_at
          }
        });
      }
    }

    if (req.method === 'DELETE') {
      // Leave league
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      
      const { league_id } = req.query;
      if (!league_id) {
        return res.status(400).json({ success: false, message: 'league_id is required' });
      }
      
      const playerId = parseInt(user.playerId);
      
      // Check if member
      const memberResult = await client.query(
        'SELECT * FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND is_active = true',
        [league_id, playerId]
      );
      
      if (memberResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not a member of this league' });
      }
      
      // Deactivate membership
      await client.query(
        'UPDATE league_memberships SET is_active = false WHERE league_id = $1 AND player_id = $2',
        [league_id, playerId]
      );
      
      return res.status(200).json({
        success: true,
        message: 'Successfully left league'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
    
  } catch (error) {
    console.error('[leagues-v2] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}