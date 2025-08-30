export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { challenger_id, opponent_id, challenge_type, stakes } = req.body;
    
    return res.status(200).json({
      success: true,
      duel: {
        id: Date.now(),
        challenger_id,
        opponent_id,
        challenge_type,
        stakes,
        status: "pending",
        created_at: new Date().toISOString()
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}