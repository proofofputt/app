export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { playerId } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    return res.status(200).json({
      notifications: [
        {
          id: 1,
          type: "duel_challenge",
          title: "New Duel Challenge",
          message: "Jordan challenged you to a streak challenge",
          read: false,
          created_at: "2024-08-29T12:00:00Z",
          data: { duel_id: 2, challenger_name: "Jordan" }
        },
        {
          id: 2,
          type: "league_invitation",
          title: "League Invitation",
          message: "You've been invited to join 'Weekend Warriors'",
          read: false,
          created_at: "2024-08-28T18:30:00Z",
          data: { league_id: 2, league_name: "Weekend Warriors" }
        },
        {
          id: 3,
          type: "achievement",
          title: "New Achievement",
          message: "You unlocked 'Streak Master' for 20+ consecutive makes",
          read: true,
          created_at: "2024-08-27T09:15:00Z",
          data: { achievement_id: "streak_master" }
        }
      ],
      total: 3,
      unread_count: 2
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}