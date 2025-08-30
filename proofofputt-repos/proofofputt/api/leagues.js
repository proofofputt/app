export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { player_id } = req.query;
    
    return res.status(200).json({
      leagues: [
        {
          id: 1,
          name: "Masters Champions",
          description: "Elite putting league",
          member_count: 24,
          is_member: true,
          role: "member",
          status: "active"
        },
        {
          id: 2,
          name: "Weekend Warriors",
          description: "Casual weekend competition",
          member_count: 15,
          is_member: false,
          role: null,
          status: "active"
        }
      ]
    });
  }

  if (req.method === 'POST') {
    const { name, description, player_id } = req.body;
    
    return res.status(200).json({
      success: true,
      league: {
        id: Date.now(),
        name,
        description,
        creator_id: player_id,
        member_count: 1,
        status: "active"
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}