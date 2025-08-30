export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { leagueId } = req.query;
    const { player_id } = req.body;
    
    return res.status(200).json({
      success: true,
      message: "Successfully joined league",
      league_id: parseInt(leagueId),
      player_id: parseInt(player_id),
      role: "member"
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}