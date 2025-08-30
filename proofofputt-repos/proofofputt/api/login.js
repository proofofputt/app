export default function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { email, password } = req.body;
    
    if (email === 'pop@proofofputt.com' && password === 'passwordpop123') {
      return res.status(200).json({
        player_id: 1,
        name: 'Pop', 
        email: email,
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
        timezone: 'America/New_York',
        subscription_status: 'active',
        is_new_user: false
      });
    } else {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}