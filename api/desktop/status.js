export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests (e.g., from desktop app)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Simple status check for desktop connectivity
  return res.status(200).json({ 
    success: true, 
    status: 'connected',
    timestamp: new Date().toISOString(),
    api_version: '1.0.0'
  });
}