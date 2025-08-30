export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { player1Id, player2Id } = req.query;
    
    return res.status(200).json({
      duels: [
        {
          id: 1,
          challenger_id: parseInt(player1Id),
          opponent_id: parseInt(player2Id),
          challenge_type: "best_of_50",
          status: "completed",
          winner_id: parseInt(player1Id),
          created_at: "2024-08-20T10:00:00Z",
          completed_at: "2024-08-22T15:30:00Z"
        },
        {
          id: 4,
          challenger_id: parseInt(player2Id),
          opponent_id: parseInt(player1Id),
          challenge_type: "streak_challenge",
          status: "active",
          winner_id: null,
          created_at: "2024-08-28T14:00:00Z",
          completed_at: null
        }
      ],
      head_to_head: {
        player1_wins: 1,
        player2_wins: 0,
        total_duels: 2
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}