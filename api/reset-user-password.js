import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, newPassword, confirmReset } = req.body;

  // Security check - require confirmation
  if (!confirmReset || confirmReset !== 'YES_I_CONFIRM_RESET') {
    return res.status(400).json({ error: 'Reset confirmation required' });
  }

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  const client = await pool.connect();
  
  try {
    // First check if user exists
    const userCheck = await client.query(
      'SELECT player_id, name, email FROM players WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: `User not found: ${email}` });
    }
    
    const user = userCheck.rows[0];
    console.log(`Found user: ${user.name} (ID: ${user.player_id})`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the password
    const updateResult = await client.query(
      `UPDATE players 
       SET password_hash = $1, updated_at = NOW()
       WHERE player_id = $2
       RETURNING player_id, email, name`,
      [hashedPassword, user.player_id]
    );
    
    if (updateResult.rows.length > 0) {
      console.log(`Password successfully reset for ${email}`);
      return res.status(200).json({
        success: true,
        message: `Password successfully reset for ${email}`,
        user: {
          player_id: user.player_id,
          email: user.email,
          name: user.name
        }
      });
    } else {
      return res.status(500).json({ error: `Failed to update password for ${email}` });
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ 
      error: 'Failed to reset password. Please try again later.' 
    });
  } finally {
    client.release();
  }
}