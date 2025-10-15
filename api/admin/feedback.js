import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import { requireAdmin } from '../../utils/adminAuth.js';
import { sendFeedbackStatusUpdateEmail } from '../../utils/emailService.js';

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

  let client;
  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      return await handleGetAllFeedback(req, res, client);
    } else if (req.method === 'PATCH') {
      return await handleUpdateThread(req, res, client);
    } else if (req.method === 'POST') {
      return await handleBulkUpdate(req, res, client);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Admin feedback API error:', error);
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

// GET: Retrieve all feedback threads with filters (admin only)
async function handleGetAllFeedback(req, res, client) {
  const { status, priority, category, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT
      ft.thread_id,
      ft.player_id,
      p.name as player_name,
      p.email as player_email,
      ft.subject,
      ft.category,
      ft.page_location,
      ft.feature_area,
      ft.status,
      ft.priority,
      ft.created_at,
      ft.updated_at,
      ft.closed_at,
      ft.admin_notes,
      COUNT(fm.message_id) as message_count,
      MAX(fm.created_at) as last_message_at,
      SUM(CASE WHEN fm.is_admin_response = true THEN 1 ELSE 0 END) as admin_response_count,
      SUM(CASE WHEN fm.is_admin_response = false THEN 1 ELSE 0 END) as user_message_count
    FROM feedback_threads ft
    JOIN players p ON ft.player_id = p.player_id
    LEFT JOIN feedback_messages fm ON ft.thread_id = fm.thread_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND ft.status = $${paramCount}`;
    params.push(status);
  }

  if (priority) {
    paramCount++;
    query += ` AND ft.priority = $${paramCount}`;
    params.push(priority);
  }

  if (category) {
    paramCount++;
    query += ` AND ft.category = $${paramCount}`;
    params.push(category);
  }

  query += `
    GROUP BY ft.thread_id, p.name, p.email
    ORDER BY
      CASE ft.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      ft.status = 'open' DESC,
      ft.updated_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

  params.push(limit, offset);

  const threadsResult = await client.query(query, params);

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) FROM feedback_threads ft WHERE 1=1`;
  const countParams = [];
  let countParamCount = 0;

  if (status) {
    countParamCount++;
    countQuery += ` AND ft.status = $${countParamCount}`;
    countParams.push(status);
  }

  if (priority) {
    countParamCount++;
    countQuery += ` AND ft.priority = $${countParamCount}`;
    countParams.push(priority);
  }

  if (category) {
    countParamCount++;
    countQuery += ` AND ft.category = $${countParamCount}`;
    countParams.push(category);
  }

  const countResult = await client.query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count);

  return res.status(200).json({
    success: true,
    threads: threadsResult.rows,
    pagination: {
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
    }
  });
}

// PATCH: Update thread status, priority, or admin notes
async function handleUpdateThread(req, res, client) {
  const { thread_id, status, priority, admin_notes } = req.body;

  if (!thread_id) {
    return res.status(400).json({
      success: false,
      message: 'thread_id is required'
    });
  }

  // Get current thread details for comparison and email
  const currentThread = await client.query(`
    SELECT
      ft.thread_id,
      ft.subject,
      ft.category,
      ft.status as old_status,
      ft.priority,
      ft.admin_notes,
      ft.player_id,
      p.name as player_name,
      p.email as player_email
    FROM feedback_threads ft
    JOIN players p ON ft.player_id = p.player_id
    WHERE ft.thread_id = $1
  `, [thread_id]);

  if (currentThread.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Thread not found'
    });
  }

  const oldThread = currentThread.rows[0];

  // Build dynamic update query
  const updates = [];
  const params = [thread_id];
  let paramCount = 1;

  if (status) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    params.push(status);

    // If marking as closed, set closed_at
    if (status === 'closed' || status === 'resolved') {
      updates.push(`closed_at = NOW()`);
    }
  }

  if (priority) {
    paramCount++;
    updates.push(`priority = $${paramCount}`);
    params.push(priority);
  }

  if (admin_notes !== undefined) {
    paramCount++;
    updates.push(`admin_notes = $${paramCount}`);
    params.push(admin_notes);
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = NOW()`);

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No updates provided'
    });
  }

  const query = `
    UPDATE feedback_threads
    SET ${updates.join(', ')}
    WHERE thread_id = $1
    RETURNING thread_id, status, priority, admin_notes, updated_at, closed_at
  `;

  const result = await client.query(query, params);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Thread not found'
    });
  }

  const updatedThread = result.rows[0];

  // Send email notification if status changed
  if (status && status !== oldThread.old_status) {
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

      await sendFeedbackStatusUpdateEmail(
        oldThread.player_email,
        oldThread.player_name,
        {
          subject: oldThread.subject,
          category_label: categoryLabels[oldThread.category] || 'Feedback',
          thread_id: oldThread.thread_id,
          admin_notes: updatedThread.admin_notes
        },
        oldThread.old_status,
        status
      );
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
      // Don't fail the request if email fails
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Thread updated successfully',
    thread: updatedThread
  });
}

// POST: Bulk update multiple threads
async function handleBulkUpdate(req, res, client) {
  const { thread_ids, status, priority } = req.body;

  if (!thread_ids || !Array.isArray(thread_ids) || thread_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'thread_ids array is required'
    });
  }

  if (!status && !priority) {
    return res.status(400).json({
      success: false,
      message: 'Either status or priority must be provided'
    });
  }

  await client.query('BEGIN');

  try {
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);

      if (status === 'closed' || status === 'resolved') {
        updates.push(`closed_at = NOW()`);
      }
    }

    if (priority) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
    }

    updates.push(`updated_at = NOW()`);

    // Add thread_ids as final parameter
    paramCount++;
    params.push(thread_ids);

    const query = `
      UPDATE feedback_threads
      SET ${updates.join(', ')}
      WHERE thread_id = ANY($${paramCount})
      RETURNING thread_id
    `;

    const result = await client.query(query, params);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${result.rows.length} threads`,
      updated_count: result.rows.length,
      updated_thread_ids: result.rows.map(r => r.thread_id)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Export with admin protection
export default requireAdmin(handler);
