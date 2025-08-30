export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { playerId } = req.query;
    
    return res.status(200).json({
      duels: [
        {
          id: 1,
          challenger_id: 1,
          challenger_name: "Pop",
          opponent_id: 2,
          opponent_name: "Tiger",
          challenge_type: "best_of_50",
          stakes: "bragging_rights",
          status: "active",
          created_at: "2024-08-29T10:00:00Z",
          expires_at: "2024-09-05T23:59:59Z"
        },
        {
          id: 2,
          challenger_id: 3,
          challenger_name: "Jordan",
          opponent_id: 1,
          opponent_name: "Pop",
          challenge_type: "streak_challenge",
          stakes: "10_points",
          status: "pending",
          created_at: "2024-08-28T15:30:00Z",
          expires_at: "2024-09-04T23:59:59Z"
        }
      ]
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}