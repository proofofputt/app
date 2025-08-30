export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { leagueId } = req.query;
    
    return res.status(200).json({
      leaderboard: [
        {
          player_id: 1,
          name: "Pop",
          sessions: 12,
          total_putts: 540,
          make_percentage: 74.4,
          points: 89,
          rank: 1
        },
        {
          player_id: 2,
          name: "Tiger",
          sessions: 10,
          total_putts: 450,
          make_percentage: 71.2,
          points: 82,
          rank: 2
        },
        {
          player_id: 3,
          name: "Jordan",
          sessions: 8,
          total_putts: 360,
          make_percentage: 68.9,
          points: 76,
          rank: 3
        }
      ],
      season: {
        name: "Season 1",
        start_date: "2024-08-01T00:00:00Z",
        end_date: "2024-10-31T23:59:59Z"
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}