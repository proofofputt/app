export default function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { playerId } = req.query;

  if (req.method === 'GET') {
    return res.status(200).json({
      player_id: parseInt(playerId),
      name: 'Pop',
      email: 'pop@proofofputt.com',
      membership_tier: 'premium',
      early_access_code: 'early',
      stats: {
        total_makes: 0,
        total_misses: 0,
        best_streak: 0,
        make_percentage: 0,
        total_putts: 0,
        avg_distance: 0,
        sessions_played: 0
      },
      sessions: [],
      calibration_data: {
        is_calibrated: false,
        last_calibration: null
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}