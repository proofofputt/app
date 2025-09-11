import { setCORSHeaders } from '../utils/cors.js';

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      console.log('Debug: Received duel creation request');
      console.log('Body:', req.body);
      console.log('Headers:', req.headers);
      
      return res.status(200).json({
        success: true,
        message: 'Debug endpoint working',
        receivedData: req.body,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}