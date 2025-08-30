export default function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { email, password } = req.body;
    
    if (email === 'pop@proofofputt.com' && password === 'passwordpop123') {
      return res.status(200).json({
        success: true,
        player_id: 1,
        name: 'Pop',
        email: email,
        token: 'mock-jwt-token'
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}