import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication for fundraiser creation
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Check if user has required membership tier
    const membershipResult = await client.query(
      'SELECT membership_tier, name FROM players WHERE player_id = $1',
      [user.playerId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const { membership_tier: membershipTier, name: playerName } = membershipResult.rows[0];
    if (membershipTier !== 'premium' && membershipTier !== 'regular') {
      return res.status(403).json({ 
        success: false, 
        message: 'Premium or Regular membership required to create fundraisers' 
      });
    }

    // Validate request data
    const { title, description, goal_amount, end_date } = req.body;

    if (!title || !description || !goal_amount || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, goal amount, and end date are required'
      });
    }

    if (parseFloat(goal_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Goal amount must be greater than zero'
      });
    }

    if (new Date(end_date) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in the future'
      });
    }

    // Create the fundraiser
    const insertResult = await client.query(`
      INSERT INTO fundraisers (title, description, goal_amount, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING fundraiser_id, title, description, goal_amount, end_date, created_at
    `, [title, description, parseFloat(goal_amount), end_date, user.playerId]);

    const newFundraiser = insertResult.rows[0];

    console.log(`Fundraiser created successfully by ${playerName}:`, newFundraiser);

    return res.status(201).json({
      success: true,
      message: 'Fundraiser created successfully',
      fundraiser_id: newFundraiser.fundraiser_id,
      fundraiser: newFundraiser
    });

  } catch (error) {
    console.error('Create fundraiser error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create fundraiser',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}