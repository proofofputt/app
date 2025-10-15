import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import { requireAdmin } from '../../utils/adminAuth.js';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get counts by status
    const statusStats = await client.query(`
      SELECT status, COUNT(*) as count
      FROM feedback_threads
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'open' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'resolved' THEN 3
          WHEN 'closed' THEN 4
        END
    `);

    // Get counts by priority
    const priorityStats = await client.query(`
      SELECT priority, COUNT(*) as count
      FROM feedback_threads
      GROUP BY priority
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    // Get counts by category
    const categoryStats = await client.query(`
      SELECT category, COUNT(*) as count
      FROM feedback_threads
      GROUP BY category
      ORDER BY count DESC
    `);

    // Get average response time (time from thread creation to first admin response)
    const responseTimeStats = await client.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (first_admin_response.created_at - ft.created_at)) / 3600) as avg_response_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_admin_response.created_at - ft.created_at)) / 3600) as median_response_hours
      FROM feedback_threads ft
      JOIN LATERAL (
        SELECT created_at
        FROM feedback_messages
        WHERE thread_id = ft.thread_id AND is_admin_response = true
        ORDER BY created_at ASC
        LIMIT 1
      ) first_admin_response ON true
      WHERE ft.status != 'open'
    `);

    // Get recent activity (last 7 days)
    const recentActivity = await client.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN thread_id END) as threads_24h,
        COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN thread_id END) as threads_7d,
        COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN thread_id END) as threads_30d
      FROM feedback_threads
    `);

    // Get threads needing attention (open, no admin response)
    const needsAttention = await client.query(`
      SELECT COUNT(*)
      FROM feedback_threads ft
      WHERE ft.status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM feedback_messages fm
        WHERE fm.thread_id = ft.thread_id AND fm.is_admin_response = true
      )
    `);

    // Get high priority open threads
    const highPriorityOpen = await client.query(`
      SELECT COUNT(*)
      FROM feedback_threads
      WHERE (priority = 'high' OR priority = 'critical')
      AND status = 'open'
    `);

    // Get total threads and total messages
    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM feedback_threads) as total_threads,
        (SELECT COUNT(*) FROM feedback_messages) as total_messages,
        (SELECT COUNT(*) FROM feedback_messages WHERE is_admin_response = true) as total_admin_messages
    `);

    // Get most active users (by feedback submissions)
    const topUsers = await client.query(`
      SELECT
        p.player_id,
        p.name,
        p.email,
        COUNT(*) as thread_count
      FROM feedback_threads ft
      JOIN players p ON ft.player_id = p.player_id
      GROUP BY p.player_id, p.name, p.email
      ORDER BY thread_count DESC
      LIMIT 10
    `);

    // Get common issues (most frequent subjects/words)
    const commonIssues = await client.query(`
      SELECT
        category,
        page_location,
        feature_area,
        COUNT(*) as occurrence_count
      FROM feedback_threads
      WHERE page_location IS NOT NULL OR feature_area IS NOT NULL
      GROUP BY category, page_location, feature_area
      ORDER BY occurrence_count DESC
      LIMIT 20
    `);

    return res.status(200).json({
      success: true,
      stats: {
        by_status: statusStats.rows,
        by_priority: priorityStats.rows,
        by_category: categoryStats.rows,
        response_time: {
          average_hours: parseFloat(responseTimeStats.rows[0]?.avg_response_hours || 0),
          median_hours: parseFloat(responseTimeStats.rows[0]?.median_response_hours || 0)
        },
        recent_activity: recentActivity.rows[0],
        needs_attention: parseInt(needsAttention.rows[0].count),
        high_priority_open: parseInt(highPriorityOpen.rows[0].count),
        totals: totals.rows[0],
        top_users: topUsers.rows,
        common_issues: commonIssues.rows
      }
    });
  } catch (error) {
    console.error('Admin feedback stats error:', error);
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
