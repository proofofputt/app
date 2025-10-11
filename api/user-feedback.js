import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';
import {
  sendFeedbackConfirmationEmail,
  sendFeedbackResponseEmail,
  sendNewFeedbackAlertEmail
} from '../utils/emailService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
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

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let client;
  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      return await handleGetFeedback(req, res, client, user);
    } else if (req.method === 'POST') {
      return await handleCreateFeedback(req, res, client, user);
    } else if (req.method === 'PUT') {
      return await handleAddMessage(req, res, client, user);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('User feedback API error:', error);
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

// GET: Retrieve user's feedback threads with message counts
async function handleGetFeedback(req, res, client, user) {
  const { thread_id, status } = req.query;

  if (thread_id) {
    // Get specific thread with all messages
    const threadResult = await client.query(`
      SELECT
        ft.thread_id,
        ft.player_id,
        p.name as player_name,
        ft.subject,
        ft.category,
        ft.page_location,
        ft.feature_area,
        ft.status,
        ft.priority,
        ft.created_at,
        ft.updated_at,
        ft.closed_at,
        ft.admin_notes
      FROM feedback_threads ft
      JOIN players p ON ft.player_id = p.player_id
      WHERE ft.thread_id = $1 AND ft.player_id = $2
    `, [thread_id, user.playerId]);

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    // Get all messages for this thread
    const messagesResult = await client.query(`
      SELECT
        fm.message_id,
        fm.thread_id,
        fm.player_id,
        p.name as author_name,
        fm.is_admin_response,
        fm.message_text,
        fm.created_at,
        fm.edited_at
      FROM feedback_messages fm
      LEFT JOIN players p ON fm.player_id = p.player_id
      WHERE fm.thread_id = $1
      ORDER BY fm.created_at ASC
    `, [thread_id]);

    return res.status(200).json({
      success: true,
      thread: threadResult.rows[0],
      messages: messagesResult.rows
    });
  } else {
    // Get all threads for user with message counts
    let query = `
      SELECT
        ft.thread_id,
        ft.subject,
        ft.category,
        ft.page_location,
        ft.feature_area,
        ft.status,
        ft.priority,
        ft.created_at,
        ft.updated_at,
        ft.closed_at,
        COUNT(fm.message_id) as message_count,
        MAX(fm.created_at) as last_message_at
      FROM feedback_threads ft
      LEFT JOIN feedback_messages fm ON ft.thread_id = fm.thread_id
      WHERE ft.player_id = $1
    `;

    const params = [user.playerId];

    if (status) {
      query += ` AND ft.status = $2`;
      params.push(status);
    }

    query += `
      GROUP BY ft.thread_id
      ORDER BY ft.updated_at DESC, ft.created_at DESC
    `;

    const threadsResult = await client.query(query, params);

    return res.status(200).json({
      success: true,
      threads: threadsResult.rows
    });
  }
}

// POST: Create new feedback thread
async function handleCreateFeedback(req, res, client, user) {
  const {
    subject,
    category,
    page_location,
    feature_area,
    initial_message
  } = req.body;

  if (!subject || !category || !initial_message) {
    return res.status(400).json({
      success: false,
      message: 'Subject, category, and initial message are required'
    });
  }

  // Validate category
  const validCategories = [
    'general_feedback',
    'feature_request',
    'bug_report',
    'page_issue',
    'ui_ux',
    'performance',
    'support',
    'other'
  ];

  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category'
    });
  }

  // Auto-priority assignment based on category
  const AUTO_PRIORITY_RULES = {
    'bug_report': 'high',
    'performance': 'high',
    'support': 'normal',
    'feature_request': 'low',
    'general_feedback': 'normal',
    'page_issue': 'normal',
    'ui_ux': 'normal',
    'other': 'normal'
  };

  const priority = AUTO_PRIORITY_RULES[category] || 'normal';

  // Category labels for emails
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

  // Start transaction
  await client.query('BEGIN');

  try {
    // Get player info for emails
    const playerResult = await client.query(
      'SELECT name, email FROM players WHERE player_id = $1',
      [user.playerId]
    );
    const player = playerResult.rows[0];

    // Create thread with auto-assigned priority
    const threadResult = await client.query(`
      INSERT INTO feedback_threads (
        player_id,
        subject,
        category,
        page_location,
        feature_area,
        status,
        priority
      )
      VALUES ($1, $2, $3, $4, $5, 'open', $6)
      RETURNING thread_id, subject, category, page_location, feature_area, status, priority, created_at
    `, [user.playerId, subject, category, page_location || null, feature_area || null, priority]);

    const thread = threadResult.rows[0];

    // Add initial message
    const messageResult = await client.query(`
      INSERT INTO feedback_messages (
        thread_id,
        player_id,
        is_admin_response,
        message_text
      )
      VALUES ($1, $2, false, $3)
      RETURNING message_id, message_text, created_at
    `, [thread.thread_id, user.playerId, initial_message]);

    await client.query('COMMIT');

    // Send confirmation email to user
    try {
      await sendFeedbackConfirmationEmail(player.email, player.name, {
        subject: thread.subject,
        category_label: categoryLabels[thread.category],
        thread_id: thread.thread_id
      });
    } catch (emailError) {
      console.error('Failed to send feedback confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send admin alert for high/critical priority
    if (thread.priority === 'high' || thread.priority === 'critical') {
      try {
        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];

        if (adminEmails.length > 0) {
          const emailPromises = adminEmails.map(adminEmail =>
            sendNewFeedbackAlertEmail(adminEmail, {
              subject: thread.subject,
              category_label: categoryLabels[thread.category],
              priority: thread.priority.toUpperCase(),
              page_location: thread.page_location || 'Not specified',
              feature_area: thread.feature_area || 'Not specified',
              thread_id: thread.thread_id,
              initial_message: initial_message
            }, {
              name: player.name,
              email: player.email,
              player_id: user.playerId
            })
          );

          await Promise.all(emailPromises);
        }
      } catch (emailError) {
        console.error('Failed to send admin alert email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you for helping us improve!',
      thread: {
        ...thread,
        initial_message: messageResult.rows[0]
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// PUT: Add message to existing thread
async function handleAddMessage(req, res, client, user) {
  const { thread_id, message_text } = req.body;

  if (!thread_id || !message_text) {
    return res.status(400).json({
      success: false,
      message: 'Thread ID and message text are required'
    });
  }

  // Verify thread belongs to user
  const threadResult = await client.query(`
    SELECT thread_id, status FROM feedback_threads
    WHERE thread_id = $1 AND player_id = $2
  `, [thread_id, user.playerId]);

  if (threadResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Add message
  const messageResult = await client.query(`
    INSERT INTO feedback_messages (
      thread_id,
      player_id,
      is_admin_response,
      message_text
    )
    VALUES ($1, $2, false, $3)
    RETURNING message_id, message_text, created_at
  `, [thread_id, user.playerId, message_text]);

  return res.status(201).json({
    success: true,
    message: 'Message added successfully',
    new_message: messageResult.rows[0]
  });
}
