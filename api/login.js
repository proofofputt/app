const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

module.exports = async function handler(req, res) {
  try {
    console.log('Login API called:', req.method, req.body);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    if (!pool) {
      // Fallback for development/testing
      console.log('Using fallback auth - no database configured');
      if (email === 'pop@proofofputt.com' && password === 'testpassword') {
        const token = jwt.sign(
          { playerId: 1, email: email },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );
        
        return res.status(200).json({
          success: true,
          token: token,
          player: {
            id: 1,
            name: 'Test Player',
            email: email,
            created_at: new Date().toISOString()
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }

    // Database authentication
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM players WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const player = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, player.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { playerId: player.id, email: player.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token: token,
      player: {
        id: player.id,
        name: player.name,
        email: player.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
  } catch (outerError) {
    console.error('Top-level API error:', outerError);
    return res.status(500).json({
      success: false,
      message: 'Server initialization error'
    });
  }
}