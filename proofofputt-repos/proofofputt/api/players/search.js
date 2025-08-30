export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { term } = req.query;
    
    return res.status(200).json({
      players: [
        {
          id: 1,
          name: "Pop",
          email: "pop@proofofputt.com",
          avatar: null,
          make_percentage: 74.4,
          total_sessions: 847
        },
        {
          id: 2,
          name: "Tiger",
          email: "tiger@example.com", 
          avatar: null,
          make_percentage: 71.2,
          total_sessions: 623
        },
        {
          id: 3,
          name: "Jordan",
          email: "jordan@example.com",
          avatar: null,
          make_percentage: 68.9,
          total_sessions: 445
        }
      ].filter(p => p.name.toLowerCase().includes((term || '').toLowerCase()))
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}