import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import { requireAdmin } from '../../utils/adminAuth.js';
import { sendFeedbackResponseEmail } from '../../utils/emailService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { thread_id, message_text, auto_in_progress } = req.body;

  if (!thread_id || !message_text) {
    return res.status(400).json({
      success: false,
      message: 'thread_id and message_text are required'
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify thread exists and get full details for email
    const threadCheck = await client.query(`
      SELECT
        ft.thread_id,
        ft.player_id,
        ft.subject,
        ft.category,
        ft.status,
        p.name as player_name,
        p.email as player_email
      FROM feedback_threads ft
      JOIN players p ON ft.player_id = p.player_id
      WHERE ft.thread_id = $1
    `, [thread_id]);

    if (threadCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const thread = threadCheck.rows[0];

    // Add admin response message
    // Note: player_id is set to NULL for admin responses since they're not from the user
    const messageResult = await client.query(`
      INSERT INTO feedback_messages (
        thread_id,
        player_id,
        is_admin_response,
        message_text
      )
      VALUES ($1, NULL, true, $2)
      RETURNING message_id, message_text, created_at, is_admin_response
    `, [thread_id, message_text]);

    // Optionally auto-update status to 'in_progress' if currently 'open'
    if (auto_in_progress !== false && thread.status === 'open') {
      await client.query(`
        UPDATE feedback_threads
        SET status = 'in_progress', updated_at = NOW()
        WHERE thread_id = $1
      `, [thread_id]);
    }

    await client.query('COMMIT');

    // Send email notification to user about admin response
    try {
      const categoryLabels = {
        'general_feedback': 'General Feedback',
        'feature_request': 'Feature Request',
        'bug_report': 'Bug Report',
        'page_issue': 'Page Issue',
        'ui_ux': 'UI/UX Feedback',
        'performance': 'Performance Issue',
        'support': 'Support Request',
        'other': 'Other'
      };

      // Truncate response preview to 150 characters
      const responsePreview = message_text.length > 150
        ? message_text.substring(0, 150) + '...'
        : message_text;

      await sendFeedbackResponseEmail(
        thread.player_email,
        thread.player_name,
        {
          subject: thread.subject,
          category_label: categoryLabels[thread.category] || 'Feedback',
          thread_id: thread.thread_id
        },
        responsePreview
      );
    } catch (emailError) {
      console.error('Failed to send admin response email:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Admin response added successfully',
      admin_message: messageResult.rows[0],
      thread_updated: auto_in_progress !== false && thread.status === 'open'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin response error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default requireAdmin(handler);
