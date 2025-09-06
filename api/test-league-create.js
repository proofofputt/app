import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    
    // Test basic connection
    const testQuery = await client.query('SELECT NOW()');
    console.log('Database connected at:', testQuery.rows[0].now);
    
    // Check if leagues table exists and what columns it has
    const leagueColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'leagues'
      ORDER BY ordinal_position
    `);
    
    console.log('Leagues table columns:', leagueColumns.rows);
    
    // Check if league_memberships table exists and what columns it has
    const membershipColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'league_memberships'
      ORDER BY ordinal_position
    `);
    
    console.log('League_memberships table columns:', membershipColumns.rows);
    
    // Test creating a league if POST
    if (req.method === 'POST') {
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      
      console.log('Authenticated user:', user);
      
      const { name = 'Test League', description = 'Test Description' } = req.body;
      
      const defaultSettings = {
        privacy: 'public',
        num_rounds: 4,
        round_duration_hours: 168
      };
      
      console.log('Attempting to insert league...');
      
      try {
        const leagueResult = await client.query(`
          INSERT INTO leagues (name, description, created_by_player_id, settings, status, created_at)
          VALUES ($1, $2, $3, $4, 'setup', $5)
          RETURNING league_id, name, description, settings
        `, [name, description, user.playerId, JSON.stringify(defaultSettings), new Date()]);
        
        console.log('League created:', leagueResult.rows[0]);
        
        const league = leagueResult.rows[0];
        
        console.log('Attempting to add membership...');
        
        const membershipResult = await client.query(`
          INSERT INTO league_memberships (league_id, player_id, joined_at)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [league.league_id, user.playerId, new Date()]);
        
        console.log('Membership created:', membershipResult.rows[0]);
        
        return res.status(200).json({
          success: true,
          message: 'League created successfully',
          league: league,
          membership: membershipResult.rows[0]
        });
        
      } catch (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({
          success: false,
          error: insertError.message,
          code: insertError.code,
          detail: insertError.detail
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      leagues_columns: leagueColumns.rows,
      memberships_columns: membershipColumns.rows,
      database_time: testQuery.rows[0].now
    });
    
  } catch (error) {
    console.error('Test league create error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  } finally {
    if (client) client.release();
  }
}