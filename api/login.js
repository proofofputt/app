module.exports = async function handler(req, res) {
  try {
    console.log('Login API called:', req.method);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      console.log('OPTIONS request handled');
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      console.log('Non-POST request:', req.method);
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    console.log('Request body:', req.body);
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Simple authentication without external dependencies
    if (email === 'pop@proofofputt.com' && password === 'testpassword') {
      console.log('Authentication successful');
      return res.status(200).json({
        success: true,
        token: 'simple-test-token-' + Date.now(),
        player: {
          id: 1,
          name: 'Test Player',
          email: email
        }
      });
    } else {
      console.log('Invalid credentials provided');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};