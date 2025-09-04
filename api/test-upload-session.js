import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log('🧪 Test upload session endpoint called');
    
    const { player_id, session_data, csv_data } = req.body;

    if (!player_id || !session_data) {
      return res.status(400).json({ success: false, message: 'Player ID and session data are required.' });
    }

    // Validate SessionReporter data structure
    const requiredFields = ['total_putts', 'total_makes'];
    const missingCritical = requiredFields.filter(field => session_data[field] === undefined);
    
    if (missingCritical.length > 0) {
      console.error('Missing critical SessionReporter fields:', missingCritical);
      return res.status(400).json({ 
        success: false, 
        message: `SessionReporter data incomplete. Missing critical fields: ${missingCritical.join(', ')}`
      });
    }

    console.log(`📊 Received session: ${session_data.total_putts} putts, ${session_data.total_makes} makes`);
    console.log(`📊 Best streak: ${session_data.best_streak}, Make %: ${session_data.make_percentage}%`);

    const client = await pool.connect();
    
    try {
      // Insert session data
      const sessionInsertQuery = `
        INSERT INTO sessions (player_id, total_putts, makes, misses, make_percentage, best_streak, session_duration, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING session_id
      `;
      
      const sessionValues = [
        parseInt(player_id),
        session_data.total_putts || 0,
        session_data.total_makes || 0,
        session_data.total_misses || 0,
        session_data.make_percentage || 0,
        session_data.best_streak || 0,
        session_data.session_duration || 0
      ];
      
      const result = await client.query(sessionInsertQuery, sessionValues);
      const insertedSessionId = result.rows[0].session_id;
      
      console.log(`✅ Session inserted with ID: ${insertedSessionId}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Test session upload successful!',
        session_id: insertedSessionId,
        data_received: {
          total_putts: session_data.total_putts,
          total_makes: session_data.total_makes,
          best_streak: session_data.best_streak,
          make_percentage: session_data.make_percentage
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Test session upload error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred' 
    });
  }
}