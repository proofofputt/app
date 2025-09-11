import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGetFundraisers(req, res);
  } else if (req.method === 'POST') {
    return handleCreateFundraiser(req, res);
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}

async function handleGetFundraisers(req, res) {
  let client;
  try {
    client = await pool.connect();
    console.log('Fundraisers API: Database connected successfully');

    // For now, return empty fundraisers array since we don't have a fundraisers table yet
    // This prevents the frontend from crashing
    return res.status(200).json({
      success: true,
      fundraisers: [],
      message: 'Fundraisers feature coming soon'
    });

  } catch (error) {
    console.error('Fundraisers API error:', error);
    
    // Always return expected structure for GET requests
    return res.status(200).json({
      success: false,
      message: 'Failed to load fundraisers',
      fundraisers: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}

async function handleCreateFundraiser(req, res) {
  // Verify authentication for fundraiser creation
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // For now, return a not implemented message
  return res.status(501).json({
    success: false,
    message: 'Fundraiser creation not yet implemented'
  });
}