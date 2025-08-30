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
      unread_count: 2,
      player_id: parseInt(playerId)
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}