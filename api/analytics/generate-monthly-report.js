import pg from 'pg';
import fs from 'fs';
import path from 'path';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Monthly Analytics Report Generator
 * Generates comprehensive traffic and business analysis report for the previous month
 */

// Format number with commas
function formatNumber(num) {
  return num ? num.toLocaleString('en-US') : '0';
}

// Format percentage
function formatPercent(num) {
  return num ? `${parseFloat(num).toFixed(2)}%` : '0.00%';
}

// Format currency
function formatCurrency(num) {
  return num ? `$${parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
}

// Format duration (seconds to readable format)
function formatDuration(seconds) {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// Generate text table
function generateTable(headers, rows) {
  const columnWidths = headers.map((header, i) => {
    const cellWidths = rows.map(row => String(row[i] || '').length);
    return Math.max(header.length, ...cellWidths);
  });

  const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow = '| ' + headers.map((h, i) => h.padEnd(columnWidths[i])).join(' | ') + ' |';
  const dataRows = rows.map(row =>
    '| ' + row.map((cell, i) => String(cell || '').padEnd(columnWidths[i])).join(' | ') + ' |'
  );

  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

// Get previous month date range
function getPreviousMonthRange() {
  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayPrevMonth = new Date(firstDayThisMonth - 1);
  const firstDayPrevMonth = new Date(lastDayPrevMonth.getFullYear(), lastDayPrevMonth.getMonth(), 1);

  return {
    startDate: firstDayPrevMonth.toISOString(),
    endDate: new Date(lastDayPrevMonth.getFullYear(), lastDayPrevMonth.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
    monthName: firstDayPrevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  };
}

// Executive Summary
async function getExecutiveSummary(startDate, endDate) {
  const query = `
    WITH current_metrics AS (
      SELECT
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
        COUNT(*) FILTER (WHERE event_type = 'download') as total_downloads,
        COUNT(*) FILTER (WHERE event_type = 'click') as total_clicks,
        COUNT(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL) as authenticated_users,
        AVG(EXTRACT(EPOCH FROM (
          SELECT MAX(timestamp) - MIN(timestamp)
          FROM analytics_events e2
          WHERE e2.session_id = e1.session_id
        ))) as avg_session_seconds
      FROM analytics_events e1
      WHERE timestamp BETWEEN $1 AND $2
    ),
    prev_metrics AS (
      SELECT
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) FILTER (WHERE event_type = 'download') as total_downloads
      FROM analytics_events
      WHERE timestamp BETWEEN ($1::timestamp - INTERVAL '1 month') AND ($2::timestamp - INTERVAL '1 month')
    ),
    conversions AS (
      SELECT
        COUNT(*) as total_conversions,
        COUNT(*) FILTER (WHERE conversion_type = 'signup') as signups,
        COUNT(*) FILTER (WHERE conversion_type = 'download') as download_conversions,
        SUM(conversion_value) as total_revenue
      FROM analytics_conversions
      WHERE timestamp BETWEEN $1 AND $2
    )
    SELECT
      cm.*,
      pm.unique_visitors as prev_visitors,
      pm.total_sessions as prev_sessions,
      pm.total_downloads as prev_downloads,
      c.*,
      ROUND((cm.total_sessions::NUMERIC / NULLIF(cm.unique_visitors, 0)), 2) as sessions_per_visitor,
      ROUND((cm.page_views::NUMERIC / NULLIF(cm.total_sessions, 0)), 2) as pages_per_session,
      ROUND((c.total_conversions::NUMERIC / NULLIF(cm.total_sessions, 0)) * 100, 2) as conversion_rate,
      ROUND(((cm.unique_visitors - pm.unique_visitors)::NUMERIC / NULLIF(pm.unique_visitors, 0)) * 100, 2) as visitor_growth,
      ROUND(((cm.total_sessions - pm.total_sessions)::NUMERIC / NULLIF(pm.total_sessions, 0)) * 100, 2) as session_growth,
      ROUND(((cm.total_downloads - pm.total_downloads)::NUMERIC / NULLIF(pm.total_downloads, 0)) * 100, 2) as download_growth
    FROM current_metrics cm, prev_metrics pm, conversions c
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows[0];
}

// Traffic Sources
async function getTrafficSources(startDate, endDate) {
  const query = `
    SELECT
      COALESCE(referrer_source, 'Direct') as source,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
      COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
      ROUND(AVG(EXTRACT(EPOCH FROM (
        SELECT MAX(timestamp) - MIN(timestamp)
        FROM analytics_events e2
        WHERE e2.session_id = e1.session_id
      ))), 0) as avg_session_seconds,
      COUNT(DISTINCT c.conversion_id) as conversions,
      ROUND((COUNT(DISTINCT c.conversion_id)::NUMERIC / COUNT(DISTINCT session_id)) * 100, 2) as conversion_rate
    FROM analytics_events e1
    LEFT JOIN analytics_conversions c ON e1.session_id = c.session_id
    WHERE e1.timestamp BETWEEN $1 AND $2
    GROUP BY referrer_source
    ORDER BY sessions DESC
    LIMIT 10
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Top Pages
async function getTopPages(startDate, endDate) {
  const query = `
    SELECT
      page_path,
      COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
      COUNT(*) FILTER (WHERE event_type = 'click') as clicks
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
      AND event_type IN ('page_view', 'download', 'click')
    GROUP BY page_path
    ORDER BY page_views DESC
    LIMIT 10
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Top Events
async function getTopEvents(startDate, endDate) {
  const query = `
    SELECT
      event_name,
      event_type,
      COUNT(*) as event_count,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT visitor_id) as unique_visitors
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
      AND event_type != 'page_view'
    GROUP BY event_name, event_type
    ORDER BY event_count DESC
    LIMIT 15
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Device Breakdown
async function getDeviceBreakdown(startDate, endDate) {
  const query = `
    SELECT
      device_type,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
      ROUND(AVG(EXTRACT(EPOCH FROM (
        SELECT MAX(timestamp) - MIN(timestamp)
        FROM analytics_events e2
        WHERE e2.session_id = e1.session_id
      ))), 0) as avg_session_seconds,
      COUNT(DISTINCT c.conversion_id) as conversions
    FROM analytics_events e1
    LEFT JOIN analytics_conversions c ON e1.session_id = c.session_id
    WHERE e1.timestamp BETWEEN $1 AND $2
      AND device_type IS NOT NULL
    GROUP BY device_type
    ORDER BY sessions DESC
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Browser Breakdown
async function getBrowserBreakdown(startDate, endDate) {
  const query = `
    SELECT
      browser,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
      AND browser IS NOT NULL
    GROUP BY browser
    ORDER BY sessions DESC
    LIMIT 10
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Geographic Distribution
async function getGeographicDistribution(startDate, endDate) {
  const query = `
    SELECT
      COALESCE(country_name, 'Unknown') as country,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
    GROUP BY country_name
    ORDER BY sessions DESC
    LIMIT 15
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Daily Traffic Trend
async function getDailyTrend(startDate, endDate) {
  const query = `
    SELECT
      DATE(timestamp) as date,
      COUNT(DISTINCT visitor_id) as visitors,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// UTM Campaign Performance
async function getCampaignPerformance(startDate, endDate) {
  const query = `
    SELECT
      COALESCE(utm_campaign, 'No Campaign') as campaign,
      COALESCE(utm_source, 'No Source') as source,
      COALESCE(utm_medium, 'No Medium') as medium,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT visitor_id) as visitors,
      COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
      COUNT(DISTINCT c.conversion_id) as conversions
    FROM analytics_events e
    LEFT JOIN analytics_conversions c ON e.session_id = c.session_id
    WHERE e.timestamp BETWEEN $1 AND $2
      AND (utm_campaign IS NOT NULL OR utm_source IS NOT NULL OR utm_medium IS NOT NULL)
    GROUP BY utm_campaign, utm_source, utm_medium
    ORDER BY sessions DESC
    LIMIT 10
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

// Conversion Funnel
async function getConversionFunnel(startDate, endDate) {
  const query = `
    SELECT
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'page_view') as step_1_visited,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'click') as step_2_engaged,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'download') as step_3_downloaded,
      COUNT(DISTINCT visitor_id) FILTER (WHERE player_id IS NOT NULL) as step_4_signed_up
    FROM analytics_events
    WHERE timestamp BETWEEN $1 AND $2
  `;

  const result = await pool.query(query, [startDate, endDate]);
  return result.rows[0];
}

// Generate the report
async function generateMonthlyReport(dateRange = null) {
  console.log('Starting monthly analytics report generation...');

  const { startDate, endDate, monthName } = dateRange || getPreviousMonthRange();

  console.log(`Generating report for: ${monthName}`);
  console.log(`Date range: ${startDate} to ${endDate}`);

  // Gather all data
  const [
    summary,
    trafficSources,
    topPages,
    topEvents,
    deviceBreakdown,
    browserBreakdown,
    geoDistribution,
    dailyTrend,
    campaignPerformance,
    funnel
  ] = await Promise.all([
    getExecutiveSummary(startDate, endDate),
    getTrafficSources(startDate, endDate),
    getTopPages(startDate, endDate),
    getTopEvents(startDate, endDate),
    getDeviceBreakdown(startDate, endDate),
    getBrowserBreakdown(startDate, endDate),
    getGeographicDistribution(startDate, endDate),
    getDailyTrend(startDate, endDate),
    getCampaignPerformance(startDate, endDate),
    getConversionFunnel(startDate, endDate)
  ]);

  // Build report
  let report = '';

  report += '═══════════════════════════════════════════════════════════════════════════\n';
  report += `           PROOF OF PUTT - MONTHLY ANALYTICS REPORT\n`;
  report += `                        ${monthName}\n`;
  report += '═══════════════════════════════════════════════════════════════════════════\n\n';
  report += `Report Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST\n`;
  report += `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}\n\n`;

  // Executive Summary
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '1. EXECUTIVE SUMMARY\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  report += `Unique Visitors:          ${formatNumber(summary.unique_visitors)}`;
  if (summary.visitor_growth) {
    report += ` (${summary.visitor_growth > 0 ? '+' : ''}${formatPercent(summary.visitor_growth)} MoM)\n`;
  } else {
    report += '\n';
  }

  report += `Total Sessions:           ${formatNumber(summary.total_sessions)}`;
  if (summary.session_growth) {
    report += ` (${summary.session_growth > 0 ? '+' : ''}${formatPercent(summary.session_growth)} MoM)\n`;
  } else {
    report += '\n';
  }

  report += `Page Views:               ${formatNumber(summary.page_views)}\n`;
  report += `Total Downloads:          ${formatNumber(summary.total_downloads)}`;
  if (summary.download_growth) {
    report += ` (${summary.download_growth > 0 ? '+' : ''}${formatPercent(summary.download_growth)} MoM)\n`;
  } else {
    report += '\n';
  }

  report += `Total Conversions:        ${formatNumber(summary.total_conversions)}\n`;
  report += `New Signups:              ${formatNumber(summary.signups)}\n`;
  if (summary.total_revenue > 0) {
    report += `Total Revenue:            ${formatCurrency(summary.total_revenue)}\n`;
  }
  report += `\n`;
  report += `Sessions per Visitor:     ${summary.sessions_per_visitor}\n`;
  report += `Pages per Session:        ${summary.pages_per_session}\n`;
  report += `Avg Session Duration:     ${formatDuration(summary.avg_session_seconds)}\n`;
  report += `Conversion Rate:          ${formatPercent(summary.conversion_rate)}\n\n`;

  // Conversion Funnel
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '2. CONVERSION FUNNEL\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  const funnelSteps = [
    { name: 'Visited Site', count: funnel.step_1_visited },
    { name: 'Engaged (Clicked)', count: funnel.step_2_engaged },
    { name: 'Downloaded App', count: funnel.step_3_downloaded },
    { name: 'Signed Up', count: funnel.step_4_signed_up }
  ];

  funnelSteps.forEach((step, i) => {
    const prevCount = i > 0 ? funnelSteps[i - 1].count : step.count;
    const conversionRate = prevCount > 0 ? (step.count / prevCount) * 100 : 0;
    const dropoff = prevCount > 0 ? ((prevCount - step.count) / prevCount) * 100 : 0;

    report += `${i + 1}. ${step.name.padEnd(20)} ${formatNumber(step.count).padStart(10)}`;
    if (i > 0) {
      report += ` (${formatPercent(conversionRate)} conversion, ${formatPercent(dropoff)} drop-off)`;
    }
    report += '\n';
  });
  report += '\n';

  // Traffic Sources
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '3. TRAFFIC SOURCES\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  report += generateTable(
    ['Source', 'Sessions', 'Visitors', 'Downloads', 'Conv Rate', 'Avg Duration'],
    trafficSources.map(s => [
      s.source,
      formatNumber(s.sessions),
      formatNumber(s.unique_visitors),
      formatNumber(s.downloads),
      formatPercent(s.conversion_rate),
      formatDuration(s.avg_session_seconds)
    ])
  );
  report += '\n\n';

  // Top Pages
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '4. TOP PAGES\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  report += generateTable(
    ['Page', 'Views', 'Sessions', 'Visitors', 'Downloads', 'Clicks'],
    topPages.map(p => [
      p.page_path,
      formatNumber(p.page_views),
      formatNumber(p.unique_sessions),
      formatNumber(p.unique_visitors),
      formatNumber(p.downloads),
      formatNumber(p.clicks)
    ])
  );
  report += '\n\n';

  // Top Events
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '5. TOP EVENTS\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  report += generateTable(
    ['Event Name', 'Type', 'Count', 'Sessions', 'Visitors'],
    topEvents.map(e => [
      e.event_name,
      e.event_type,
      formatNumber(e.event_count),
      formatNumber(e.unique_sessions),
      formatNumber(e.unique_visitors)
    ])
  );
  report += '\n\n';

  // Device Breakdown
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '6. DEVICE & BROWSER BREAKDOWN\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  report += 'Device Types:\n';
  report += generateTable(
    ['Device', 'Sessions', 'Downloads', 'Conversions', 'Avg Duration'],
    deviceBreakdown.map(d => [
      d.device_type,
      formatNumber(d.sessions),
      formatNumber(d.downloads),
      formatNumber(d.conversions),
      formatDuration(d.avg_session_seconds)
    ])
  );
  report += '\n\n';

  report += 'Browsers:\n';
  report += generateTable(
    ['Browser', 'Sessions', 'Downloads'],
    browserBreakdown.map(b => [
      b.browser,
      formatNumber(b.sessions),
      formatNumber(b.downloads)
    ])
  );
  report += '\n\n';

  // Geographic Distribution
  if (geoDistribution.length > 0 && geoDistribution[0].country !== 'Unknown') {
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '7. GEOGRAPHIC DISTRIBUTION\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    report += generateTable(
      ['Country', 'Sessions', 'Visitors', 'Downloads'],
      geoDistribution.map(g => [
        g.country,
        formatNumber(g.sessions),
        formatNumber(g.unique_visitors),
        formatNumber(g.downloads)
      ])
    );
    report += '\n\n';
  }

  // Campaign Performance
  if (campaignPerformance.length > 0) {
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '8. UTM CAMPAIGN PERFORMANCE\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    report += generateTable(
      ['Campaign', 'Source', 'Medium', 'Sessions', 'Visitors', 'Downloads', 'Conversions'],
      campaignPerformance.map(c => [
        c.campaign,
        c.source,
        c.medium,
        formatNumber(c.sessions),
        formatNumber(c.visitors),
        formatNumber(c.downloads),
        formatNumber(c.conversions)
      ])
    );
    report += '\n\n';
  }

  // Daily Trend Summary
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '9. DAILY TRAFFIC SUMMARY\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  const avgDailyVisitors = dailyTrend.reduce((sum, d) => sum + parseInt(d.visitors), 0) / dailyTrend.length;
  const avgDailySessions = dailyTrend.reduce((sum, d) => sum + parseInt(d.sessions), 0) / dailyTrend.length;
  const avgDailyDownloads = dailyTrend.reduce((sum, d) => sum + parseInt(d.downloads), 0) / dailyTrend.length;

  const peakDay = dailyTrend.reduce((max, d) => parseInt(d.sessions) > parseInt(max.sessions) ? d : max, dailyTrend[0]);
  const slowestDay = dailyTrend.reduce((min, d) => parseInt(d.sessions) < parseInt(min.sessions) ? d : min, dailyTrend[0]);

  report += `Average Daily Visitors:   ${formatNumber(Math.round(avgDailyVisitors))}\n`;
  report += `Average Daily Sessions:   ${formatNumber(Math.round(avgDailySessions))}\n`;
  report += `Average Daily Downloads:  ${formatNumber(Math.round(avgDailyDownloads))}\n`;
  report += `\n`;
  report += `Peak Traffic Day:         ${new Date(peakDay.date).toLocaleDateString()} (${formatNumber(peakDay.sessions)} sessions)\n`;
  report += `Slowest Traffic Day:      ${new Date(slowestDay.date).toLocaleDateString()} (${formatNumber(slowestDay.sessions)} sessions)\n`;
  report += '\n\n';

  // Footer
  report += '═══════════════════════════════════════════════════════════════════════════\n';
  report += '                           END OF REPORT\n';
  report += '═══════════════════════════════════════════════════════════════════════════\n';

  return {
    report,
    monthName,
    summary,
    startDate,
    endDate
  };
}

// Save report to file
async function saveReport(reportData) {
  const { report, monthName } = reportData;

  // Create reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Generate filename
  const filename = `analytics-report-${monthName.toLowerCase().replace(' ', '-')}.txt`;
  const filepath = path.join(reportsDir, filename);

  // Write to file
  fs.writeFileSync(filepath, report, 'utf8');

  console.log(`Report saved to: ${filepath}`);
  return filepath;
}

// Send report via email (optional - requires SendGrid)
async function emailReport(reportData) {
  // Check if SendGrid is configured
  if (!process.env.SENDGRID_API_KEY || !process.env.REPORT_EMAIL_TO) {
    console.log('Email sending skipped - SENDGRID_API_KEY or REPORT_EMAIL_TO not configured');
    return null;
  }

  const sgMail = await import('@sendgrid/mail');
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

  const { report, monthName, summary } = reportData;

  const msg = {
    to: process.env.REPORT_EMAIL_TO,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `Proof of Putt Monthly Analytics Report - ${monthName}`,
    text: report,
    html: `
      <div style="font-family: 'Courier New', monospace; white-space: pre; background: #f5f5f5; padding: 20px;">
        ${report.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')}
      </div>
    `,
    attachments: [
      {
        content: Buffer.from(report).toString('base64'),
        filename: `analytics-report-${monthName.toLowerCase().replace(' ', '-')}.txt`,
        type: 'text/plain',
        disposition: 'attachment'
      }
    ]
  };

  try {
    await sgMail.default.send(msg);
    console.log(`Report emailed to ${process.env.REPORT_EMAIL_TO}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Main execution
export default async function handler(req, res) {
  try {
    console.log('Monthly analytics report generation started');

    // Generate report
    const reportData = await generateMonthlyReport();

    // Save to file
    const filepath = await saveReport(reportData);

    // Optionally send via email
    await emailReport(reportData);

    // Return response
    res.status(200).json({
      success: true,
      message: 'Monthly report generated successfully',
      monthName: reportData.monthName,
      filepath,
      summary: {
        unique_visitors: reportData.summary.unique_visitors,
        total_sessions: reportData.summary.total_sessions,
        total_downloads: reportData.summary.total_downloads,
        conversion_rate: reportData.summary.conversion_rate
      }
    });

  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({
      error: 'Failed to generate monthly report',
      message: error.message
    });
  }
}

// CLI execution (for cron jobs)
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMonthlyReport()
    .then(async (reportData) => {
      console.log('\n' + reportData.report);
      await saveReport(reportData);
      await emailReport(reportData);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
