export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { leagueId } = req.query;

  if (req.method === 'GET') {
    return res.status(200).json({
      id: parseInt(leagueId),
      name: "Masters Champions",
      description: "Elite putting league for serious competitors",
      creator_id: 1,
      member_count: 24,
      created_at: "2024-08-01T10:00:00Z",
      status: "active",
      settings: {
        min_sessions_per_week: 3,
        season_length: 12
      },
      members: [
        { id: 1, name: "Pop", role: "admin", joined_at: "2024-08-01T10:00:00Z" },
        { id: 2, name: "Tiger", role: "member", joined_at: "2024-08-02T14:30:00Z" }
      ]
    });
  }

  if (req.method === 'DELETE') {
    return res.status(200).json({
      success: true,
      message: "League deleted successfully"
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}