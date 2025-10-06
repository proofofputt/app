import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Analytics Dashboard API
 * Provides aggregated metrics for business intelligence reporting
 */
export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      startDate,
      endDate,
      metric = 'overview', // 'overview', 'traffic', 'conversions', 'events', 'sessions'
      groupBy = 'day' // 'day', 'week', 'month'
    } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    let data = {};

    switch (metric) {
      case 'overview':
        data = await getOverviewMetrics(start, end);
        break;
      case 'traffic':
        data = await getTrafficMetrics(start, end, groupBy);
        break;
      case 'conversions':
        data = await getConversionMetrics(start, end, groupBy);
        break;
      case 'events':
        data = await getTopEvents(start, end);
        break;
      case 'sessions':
        data = await getSessionMetrics(start, end);
        break;
      case 'funnel':
        data = await getConversionFunnel(start, end);
        break;
      default:
        return res.status(400).json({ error: 'Invalid metric type' });
    }

    res.status(200).json({
      success: true,
      metric,
      startDate: start,
      endDate: end,
      data
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics data',
      message: error.message
    });
  }
}

// Get high-level overview metrics
async function getOverviewMetrics(startDate, endDate) {
  const query = `
    WITH metrics AS (
      SELECT
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
        COUNT(*) FILTER (WHERE event_type = 'click') as total_clicks,
        COUNT(*) FILTER (WHERE event_type = 'download') as total_downloads,
        COUNT(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL) as authenticated_users,
        AVG(EXTRACT(EPOCH FROM (
          SELECT MAX(timestamp) - MIN(timestamp)
          FROM analytics_events e2
          WHERE e2.session_id = e1.session_id
        ))) / 60 as avg_session_minutes
      FROM analytics_events e1
      WHERE timestamp BETWEEN $1 AND $2
    ),
    conversions AS (
      SELECT COUNT(*) as total_conversions
      FROM analytics_conversions
      WHERE timestamp BETWEEN $1 AND $2
    )
    SELECT
      m.*,
      c.total_conversions,
      ROUND((c.total_conversions::NUMERIC / NULLIF(m.total_sessions, 0)) * 100, 2) as conversion_rate
    FROM metrics m, conversions c
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows[0];
}

// Get traffic metrics over time
async function getTrafficMetrics(startDate, endDate, groupBy) {
  const dateGroup = groupBy === 'week' ? 'week' :
                    groupBy === 'month' ? 'month' : 'day';

  const query = `
    SELECT
      DATE_TRUNC($3, timestamp) as period,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
      COUNT(DISTINCT referrer_source) as traffic_sources,
      COUNT(*) FILTER (WHERE referrer_source = 'direct') as direct_traffic,
      COUNT(*) FILTER (WHERE referrer_source IN ('google', 'bing', 'yahoo', 'duckduckgo')) as organic_traffic,
      COUNT(*) FILTER (WHERE referrer_source IN ('facebook', 'twitter', 'linkedin', 'instagram', 'reddit')) as social_traffic,
      COUNT(*) FILTER (WHERE referrer_source = 'referral') as referral_traffic
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
    GROUP BY period
    ORDER BY period ASC
  `;

  const result = await pool.query(query, [startDate, endDate, dateGroup]);
  return result.rows;
}

// Get conversion metrics
async function getConversionMetrics(startDate, endDate, groupBy) {
  const dateGroup = groupBy === 'week' ? 'week' :
                    groupBy === 'month' ? 'month' : 'day';

  const query = `
    SELECT
      DATE_TRUNC($3, timestamp) as period,
      COUNT(*) as conversions,
      COUNT(*) FILTER (WHERE conversion_type = 'signup') as signups,
      COUNT(*) FILTER (WHERE conversion_type = 'download') as downloads,
      COUNT(*) FILTER (WHERE conversion_type = 'subscription') as subscriptions,
      SUM(conversion_value) as total_value,
      AVG(time_to_convert) / 60 as avg_time_to_convert_minutes,
      AVG(touchpoints_count) as avg_touchpoints
    FROM analytics_conversions
    WHERE timestamp BETWEEN $1 AND $2
    GROUP BY period
    ORDER BY period ASC
  `;

  const result = await pool.query(query, [startDate, endDate, dateGroup]);
  return result.rows;
}

// Get top events
async function getTopEvents(startDate, endDate) {
  const query = `
    SELECT
      event_type,
      event_name,
      event_category,
      COUNT(*) as event_count,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      jsonb_object_agg(
        COALESCE(referrer_source, 'unknown'),
        count
      ) FILTER (WHERE referrer_source IS NOT NULL) as source_breakdown
    FROM (
      SELECT
        event_type,
        event_name,
        event_category,
        session_id,
        visitor_id,
        referrer_source,
        COUNT(*) as count
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY event_type, event_name, event_category, session_id, visitor_id, referrer_source
    ) sub
    GROUP BY event_type, event_name, event_category
    ORDER BY event_count DESC
    LIMIT 50
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Get session metrics
async function getSessionMetrics(startDate, endDate) {
  const query = `
    WITH session_stats AS (
      SELECT
        session_id,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
        EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as duration_seconds,
        MAX(device_type) as device_type,
        MAX(browser) as browser,
        MAX(country_name) as country,
        MAX(referrer_source) as source
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY session_id
    )
    SELECT
      device_type,
      COUNT(*) as sessions,
      AVG(page_views) as avg_pages_per_session,
      AVG(duration_seconds) / 60 as avg_duration_minutes,
      COUNT(*) FILTER (WHERE page_views = 1) * 100.0 / COUNT(*) as bounce_rate
    FROM session_stats
    WHERE device_type IS NOT NULL
    GROUP BY device_type

    UNION ALL

    SELECT
      'Overall' as device_type,
      COUNT(*) as sessions,
      AVG(page_views) as avg_pages_per_session,
      AVG(duration_seconds) / 60 as avg_duration_minutes,
      COUNT(*) FILTER (WHERE page_views = 1) * 100.0 / COUNT(*) as bounce_rate
    FROM session_stats

    ORDER BY device_type
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Get conversion funnel
async function getConversionFunnel(startDate, endDate) {
  const query = `
    WITH funnel_steps AS (
      SELECT
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'page_loaded') as step_1_visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name LIKE 'click_%') as step_2_engaged,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'download') as step_3_downloaded,
        COUNT(DISTINCT visitor_id) FILTER (WHERE player_id IS NOT NULL) as step_4_signed_up
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
    )
    SELECT
      jsonb_build_object(
        'step_1', jsonb_build_object('name', 'Page Visit', 'visitors', step_1_visitors, 'conversion_rate', 100),
        'step_2', jsonb_build_object('name', 'Engaged', 'visitors', step_2_engaged, 'conversion_rate', ROUND((step_2_engaged::NUMERIC / NULLIF(step_1_visitors, 0)) * 100, 2)),
        'step_3', jsonb_build_object('name', 'Downloaded', 'visitors', step_3_downloaded, 'conversion_rate', ROUND((step_3_downloaded::NUMERIC / NULLIF(step_2_engaged, 0)) * 100, 2)),
        'step_4', jsonb_build_object('name', 'Signed Up', 'visitors', step_4_signed_up, 'conversion_rate', ROUND((step_4_signed_up::NUMERIC / NULLIF(step_3_downloaded, 0)) * 100, 2))
      ) as funnel
    FROM funnel_steps
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows[0]?.funnel || {};
}
