export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { duelId } = req.query;
    const { player_id, response } = req.body; // response: "accept" or "decline"
    
    return res.status(200).json({
      success: true,
      duel_id: parseInt(duelId),
      response,
      status: response === "accept" ? "active" : "declined",
      message: `Duel ${response}ed successfully`
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}