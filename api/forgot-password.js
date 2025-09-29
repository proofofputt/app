import { Pool } from 'pg';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../utils/emailService.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Apply rate limiting - 3 attempts per email per hour
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `forgot-password:${email.toLowerCase()}:${clientIP}`;
  const rateLimit = checkRateLimit(rateLimitKey, 3, 3600000); // 3 attempts per hour

  if (!rateLimit.allowed) {
    res.set({
      'X-RateLimit-Limit': '3',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      'Retry-After': rateLimit.retryAfter
    });
    return res.status(429).json({
      error: 'Too many password reset attempts. Please try again later.',
      retryAfter: rateLimit.retryAfter
    });
  }

  // Set rate limit headers for successful requests
  res.set({
    'X-RateLimit-Limit': '3',
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
  });

  const client = await pool.connect();
  
  try {

    // Check if user exists
    const users = await client.query(
      'SELECT player_id, name FROM players WHERE LOWER(email) = LOWER($1)',
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