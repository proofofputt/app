export default function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;
  
  if (method === 'GET') {
    return res.status(200).json({
      leagues: [
        { id: 1, name: "Masters Champions", member_count: 24, is_member: true }
      ]
    });
  }
  
  if (method === 'POST') {
    return res.status(200).json({ success: true, league: { id: Date.now() } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}