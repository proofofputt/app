import { Pool } from 'pg';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../utils/emailService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const client = await pool.connect();
  
  try {

    // Check if user exists
    const users = await client.query(
      'SELECT player_id, username FROM players WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (users.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ 
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.' 
      });
    }

    const user = users.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await client.query(
      `UPDATE players 
       SET reset_token = $1, reset_token_expiry = $2, updated_at = NOW()
       WHERE player_id = $3`,
      [resetToken, resetTokenExpiry, user.player_id]
    );

    // Send password reset email using SendGrid
    const username = user.username || user.name || email.split('@')[0];
    const emailResult = await sendPasswordResetEmail(email, username, resetToken);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Continue anyway - don't block the reset process if email fails
    }
    
    // For development, also log the reset link
    if (process.env.NODE_ENV === 'development') {
      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.proofofputt.com'}/reset-password?token=${resetToken}`;
      console.log('Password reset link for', email, ':', resetLink);
    }

    return res.status(200).json({ 
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.',
      // In development, include the reset link
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ 
      error: 'Failed to process password reset request. Please try again later.' 
    });
  } finally {
    client.release();
  }
}