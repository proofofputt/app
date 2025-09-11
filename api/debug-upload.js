import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log('[debug-upload] Request received at:', new Date().toISOString());
    console.log('[debug-upload] Authorization header present:', !!req.headers.authorization);
    console.log('[debug-upload] JWT_SECRET present:', !!process.env.JWT_SECRET);
    
    // Test JWT verification
    const user = await verifyToken(req);
    console.log('[debug-upload] Token verification result:', user ? 'success' : 'failed');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    const { player_id, session_data } = req.body;
    console.log('[debug-upload] Player ID received:', player_id);
    console.log('[debug-upload] Session data received:', !!session_data);

    if (!player_id || !session_data) {
      return res.status(400).json({ success: false, message: 'Player ID and session data are required.' });
    }

    if (parseInt(user.playerId, 10) !== parseInt(player_id, 10)) {
      console.log('[debug-upload] Player ID mismatch:', user.playerId, 'vs', player_id);
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Return success without database operations to isolate the issue
    console.log('[debug-upload] All checks passed - returning success');
    return res.status(200).json({ 
      success: true, 
      message: 'Debug upload successful - no database operations performed',
      session_id: `debug_${Date.now()}`,
      user: user,
      received_data: {
        player_id,
        session_data_keys: Object.keys(session_data || {})
      }
    });

  } catch (error) {
    console.error('[debug-upload] Error:', error.message);
    console.error('[debug-upload] Stack:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: `Debug error: ${error.message}`,
      stack: error.stack
    });
  }
}