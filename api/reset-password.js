import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  // Validate password strength (at least 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Find user with valid reset token
    const users = await sql`
      SELECT player_id, email, username
      FROM players 
      WHERE reset_token = ${token}
      AND reset_token_expiry > NOW()
    `;

    if (users.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }

    const user = users[0];

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await sql`
      UPDATE players 
      SET 
        password = ${hashedPassword},
        reset_token = NULL,
        reset_token_expiry = NULL,
        updated_at = NOW()
      WHERE player_id = ${user.player_id}
    `;

    return res.status(200).json({ 
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ 
      error: 'Failed to reset password. Please try again later.' 
    });
  }
}