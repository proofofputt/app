import { Pool } from 'pg';
import crypto from 'crypto';

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

    // TODO: Send email with reset link
    // For now, we'll just log the reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.proofofputt.com'}/reset-password?token=${resetToken}`;
    
    console.log('Password reset link for', email, ':', resetLink);
    
    // In production, you would send an email here using SendGrid or similar
    // Example:
    // await sendEmail({
    //   to: email,
    //   subject: 'Reset your Proof of Putt password',
    //   html: `
    //     <p>Hi ${user.username},</p>
    //     <p>You requested to reset your password. Click the link below to reset it:</p>
    //     <a href="${resetLink}">Reset Password</a>
    //     <p>This link will expire in 1 hour.</p>
    //     <p>If you didn't request this, please ignore this email.</p>
    //   `
    // });

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