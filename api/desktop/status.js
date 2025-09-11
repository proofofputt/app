import { setCORSHeaders } from '../utils/cors.js';

export default async function handler(req, res) {
  setCORSHeaders(req, res);

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