import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const getTopPlayers = async (client, query, valueField) => {
  const result = await client.query(query);
  return result.rows.map(row => ({
    player_id: row.player_id,
    player_name: row.name,
    value: row[valueField],
  }));
};

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const client = await pool.connect();

    const queries = {
      top_makes: getTopPlayers(client, `
        SELECT p.player_id, p.name, SUM(s.total_makes) as total_makes
        FROM sessions s JOIN players p ON s.player_id = p.player_id
        GROUP BY p.player_id, p.name ORDER BY total_makes DESC NULLS LAST LIMIT 3
      `, 'total_makes'),

      top_streaks: getTopPlayers(client, `
        SELECT p.player_id, p.name, MAX(s.best_streak) as best_streak
        FROM sessions s JOIN players p ON s.player_id = p.player_id
        GROUP BY p.player_id, p.name ORDER BY best_streak DESC NULLS LAST LIMIT 3
      `, 'best_streak'),

      top_makes_per_minute: getTopPlayers(client, `
        SELECT p.player_id, p.name, MAX(s.makes_per_minute) as max_mpm
        FROM sessions s JOIN players p ON s.player_id = p.player_id
        GROUP BY p.player_id, p.name ORDER BY max_mpm DESC NULLS LAST LIMIT 3
      `, 'max_mpm'),

      fastest_21: getTopPlayers(client, `
        SELECT p.player_id, p.name, MIN(s.fastest_21_makes_seconds) as fastest_21
        FROM sessions s JOIN players p ON s.player_id = p.player_id
        WHERE s.fastest_21_makes_seconds IS NOT NULL
        GROUP BY p.player_id, p.name ORDER BY fastest_21 ASC LIMIT 3
      `, 'fastest_21'),
    };

    const [top_makes, top_streaks, top_makes_per_minute, fastest_21] = await Promise.all(Object.values(queries));
    
    client.release();

    return res.status(200).json({
      top_makes,
      top_streaks,
      top_makes_per_minute,
      fastest_21,
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
}