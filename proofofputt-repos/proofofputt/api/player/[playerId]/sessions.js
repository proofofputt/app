export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { playerId } = req.query;
    const { page = 1, limit = 25 } = req.query;
    
    return res.status(200).json({
      sessions: [
        {
          id: 1,
          date: "2024-08-29T14:30:00Z",
          putts: 45,
          makes: 33,
          misses: 12,
          make_percentage: 73.3,
          duration_minutes: 38,
          best_streak: 7,
          session_type: "practice"
        },
        {
          id: 2,
          date: "2024-08-28T16:15:00Z", 
          putts: 52,
          makes: 39,
          misses: 13,
          make_percentage: 75.0,
          duration_minutes: 42,
          best_streak: 9,
          session_type: "practice"
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 2,
        hasMore: false
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}