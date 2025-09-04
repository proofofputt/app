import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { player_id } = req.query;

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'Player ID is required' });
  }

  try {
    const client = await pool.connect();

    if (req.method === 'GET') {
      try {
        // Get calibration data for player
        const result = await client.query(
          'SELECT * FROM calibration_data WHERE player_id = $1 ORDER BY created_at DESC LIMIT 1',
          [player_id]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'No calibration data found for this player' });
        }

        return res.status(200).json({
          success: true,
          calibration: result.rows[0]
        });
      } finally {
        client.release();
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const { roi_data, camera_index = 0 } = req.body;

        if (!roi_data) {
          return res.status(400).json({ success: false, message: 'ROI data is required' });
        }

        // Parse ROI data if it's a string
        let parsedRoiData;
        try {
          parsedRoiData = typeof roi_data === 'string' ? JSON.parse(roi_data) : roi_data;
        } catch (parseError) {
          return res.status(400).json({ success: false, message: 'Invalid ROI data format' });
        }

        // Insert or update calibration data
        const result = await client.query(`
          INSERT INTO calibration_data (player_id, roi_data, camera_index, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (player_id) 
          DO UPDATE SET 
            roi_data = EXCLUDED.roi_data,
            camera_index = EXCLUDED.camera_index,
            updated_at = NOW()
          RETURNING *
        `, [player_id, JSON.stringify(parsedRoiData), camera_index]);

        return res.status(200).json({
          success: true,
          message: 'Calibration data saved successfully',
          calibration: result.rows[0]
        });
      } finally {
        client.release();
      }
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Calibration API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}