# Proof of Putt Analytics & Click Tracking System

## Overview

A comprehensive, privacy-first analytics system for tracking user behavior, measuring conversions, and generating business intelligence reports.

## Architecture

### Components

1. **Database Layer** (`app/database/add_analytics_tracking.sql`)
   - PostgreSQL schema with 4 main tables
   - Automated aggregation functions
   - Multi-touch attribution tracking

2. **Backend API** (`app/api/analytics/`)
   - `track-event.js` - Event ingestion endpoint
   - `dashboard.js` - BI reporting endpoint

3. **Client Library** (`proofofputt-website/src/lib/analytics.ts`)
   - Lightweight (<2KB) JavaScript tracker
   - Session management
   - Visitor identification

4. **Frontend Integration**
   - Instrumented pages and components
   - Automatic page view tracking
   - Custom event tracking

## Database Schema

### Tables

#### `analytics_events`
Main event tracking table. Stores every user interaction with full context.

**Key Fields:**
- `event_type`: click, page_view, download, conversion, form_submit
- `event_name`: Specific action identifier
- `event_properties`: JSONB for flexible event metadata
- `session_id`: Groups events into sessions
- `visitor_id`: Persistent cross-session identifier
- `player_id`: Links to authenticated users
- UTM parameters for campaign tracking
- Device, browser, OS information
- Geographic data (IP-based)

#### `analytics_sessions`
Aggregated session-level metrics for faster querying.

**Key Metrics:**
- Session duration
- Page views per session
- Landing/exit pages
- Traffic source attribution
- Conversion status

#### `analytics_conversions`
Conversion tracking with multi-touch attribution.

**Features:**
- First-touch and last-touch attribution
- Time to convert
- Conversion value tracking
- UTM campaign attribution

#### `analytics_daily_metrics`
Pre-aggregated daily metrics for dashboard performance.

**Metrics:**
- Traffic (visitors, sessions, page views)
- Engagement (avg session duration, bounce rate)
- Conversions (rate, total, by type)
- Device breakdown

## Setup Instructions

### 1. Database Migration

Run the SQL migration to create tables:

```bash
cd app
psql $DATABASE_URL < database/add_analytics_tracking.sql
```

Or using the NeonDB console, paste the contents of `add_analytics_tracking.sql`.

### 2. Environment Configuration

Add to `app/.env`:

```bash
# Analytics API is already using DATABASE_URL
# No additional config needed unless using separate analytics DB
```

Add to `proofofputt-website/.env.local`:

```bash
NEXT_PUBLIC_ANALYTICS_API_URL=https://app.proofofputt.com/api/analytics/track-event
```

### 3. Verify API Deployment

The tracking API should be automatically deployed with your backend at:
- Production: `https://app.proofofputt.com/api/analytics/track-event`
- Local dev: `http://localhost:3000/api/analytics/track-event`

### 4. Test the System

Visit your website and check:

```bash
# Check if events are being recorded
psql $DATABASE_URL -c "SELECT COUNT(*) FROM analytics_events;"

# View recent events
psql $DATABASE_URL -c "SELECT event_type, event_name, page_url, timestamp FROM analytics_events ORDER BY timestamp DESC LIMIT 10;"
```

## Usage Guide

### Client-Side Tracking

The analytics library is automatically initialized on page load.

#### Track Page Views
```typescript
import { trackPageView } from '@/lib/analytics';

trackPageView('Custom Page Title');
```

#### Track Clicks
```typescript
import { trackClick } from '@/lib/analytics';

const handleButtonClick = () => {
  trackClick('download_button', {
    version: '0.1.1',
    platform: 'macOS'
  });
};
```

#### Track Downloads
```typescript
import { trackDownload } from '@/lib/analytics';

trackDownload('ProofOfPutt-0.1.1-aarch64.dmg', 'dmg');
```

#### Track Conversions
```typescript
import { trackConversion } from '@/lib/analytics';

// After user signs up
trackConversion('signup', 0, {
  method: 'google_oauth',
  referral_code: 'ABC123'
});

// After subscription
trackConversion('subscription', 29.99, {
  plan: 'premium_monthly'
});
```

#### Track Form Submissions
```typescript
import { trackFormSubmit } from '@/lib/analytics';

trackFormSubmit('newsletter_signup', {
  email_domain: user.email.split('@')[1]
});
```

### Server-Side Analytics Queries

#### Access Dashboard API

**Overview Metrics (Last 30 Days):**
```bash
curl "https://app.proofofputt.com/api/analytics/dashboard?metric=overview"
```

**Traffic Over Time:**
```bash
curl "https://app.proofofputt.com/api/analytics/dashboard?metric=traffic&groupBy=day&startDate=2025-10-01"
```

**Conversion Funnel:**
```bash
curl "https://app.proofofputt.com/api/analytics/dashboard?metric=funnel"
```

**Top Events:**
```bash
curl "https://app.proofofputt.com/api/analytics/dashboard?metric=events"
```

#### Direct SQL Queries

**Daily Active Users:**
```sql
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT visitor_id) as daily_active_users,
  COUNT(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL) as authenticated_users
FROM analytics_events
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

**Conversion Rate by Traffic Source:**
```sql
SELECT
  s.referrer_source,
  COUNT(DISTINCT s.session_id) as total_sessions,
  COUNT(DISTINCT c.session_id) as conversions,
  ROUND((COUNT(DISTINCT c.session_id)::NUMERIC / COUNT(DISTINCT s.session_id)) * 100, 2) as conversion_rate
FROM analytics_sessions s
LEFT JOIN analytics_conversions c ON s.session_id = c.session_id
WHERE s.first_seen_at >= NOW() - INTERVAL '30 days'
GROUP BY s.referrer_source
ORDER BY total_sessions DESC;
```

**Download Attribution (Which pages drive downloads):**
```sql
SELECT
  page_path,
  COUNT(*) as download_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM analytics_events
WHERE event_type = 'download'
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY page_path
ORDER BY download_events DESC;
```

**UTM Campaign Performance:**
```sql
SELECT
  utm_campaign,
  utm_source,
  utm_medium,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT visitor_id) as visitors,
  COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
  COUNT(DISTINCT c.conversion_id) as conversions
FROM analytics_events e
LEFT JOIN analytics_conversions c ON e.session_id = c.session_id
WHERE utm_campaign IS NOT NULL
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY utm_campaign, utm_source, utm_medium
ORDER BY sessions DESC;
```

**Device Breakdown:**
```sql
SELECT
  device_type,
  browser,
  os,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(*) FILTER (WHERE event_type = 'download') as downloads
FROM analytics_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY device_type, browser, os
ORDER BY sessions DESC;
```

## Business Intelligence Reports

### Key Metrics to Monitor

1. **Traffic Metrics**
   - Daily/Weekly/Monthly Active Users
   - Traffic sources (Organic, Direct, Referral, Social)
   - Geographic distribution
   - Device types

2. **Engagement Metrics**
   - Pages per session
   - Average session duration
   - Bounce rate
   - Top pages visited

3. **Conversion Metrics**
   - Download conversion rate
   - Signup conversion rate
   - Time to convert
   - Multi-touch attribution

4. **Content Performance**
   - Most clicked CTAs
   - Download page performance
   - Feature page engagement
   - Navigation patterns

### Recommended Dashboards

#### Executive Dashboard (Weekly Review)
```sql
-- Weekly Summary
WITH weekly_stats AS (
  SELECT
    DATE_TRUNC('week', timestamp) as week,
    COUNT(DISTINCT visitor_id) as visitors,
    COUNT(DISTINCT session_id) as sessions,
    COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
    COUNT(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL) as signups
  FROM analytics_events
  WHERE timestamp >= NOW() - INTERVAL '12 weeks'
  GROUP BY week
)
SELECT
  week,
  visitors,
  sessions,
  downloads,
  signups,
  ROUND((downloads::NUMERIC / sessions) * 100, 2) as download_rate,
  ROUND((signups::NUMERIC / sessions) * 100, 2) as signup_rate
FROM weekly_stats
ORDER BY week DESC;
```

#### Marketing Attribution Report
```sql
SELECT
  COALESCE(utm_campaign, 'No Campaign') as campaign,
  COALESCE(utm_source, referrer_source, 'Direct') as source,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
  COUNT(DISTINCT c.conversion_id) as conversions,
  ROUND((COUNT(DISTINCT c.conversion_id)::NUMERIC / COUNT(DISTINCT session_id)) * 100, 2) as conversion_rate
FROM analytics_events e
LEFT JOIN analytics_conversions c ON e.session_id = c.session_id
WHERE e.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY campaign, source
ORDER BY sessions DESC;
```

## Privacy & Compliance

### GDPR Compliance

1. **Cookie Consent**: The system uses a first-party cookie (`pop_visitor_id`) for visitor tracking
2. **Data Minimization**: Only necessary data is collected
3. **Right to Deletion**: User data can be removed via player_id
4. **Data Retention**: Events older than 13 months should be archived/deleted

### Delete User Data
```sql
-- Delete all analytics data for a user
DELETE FROM analytics_events WHERE player_id = <player_id>;
DELETE FROM analytics_sessions WHERE player_id = <player_id>;
DELETE FROM analytics_conversions WHERE player_id = <player_id>;
```

### Anonymize IP Addresses (Optional)
```sql
-- Truncate last octet of IPv4 addresses for additional privacy
UPDATE analytics_events
SET ip_address = HOST(ip_address)::INET & '255.255.255.0'::INET
WHERE ip_address IS NOT NULL;
```

## Performance Optimization

### Indexes
All necessary indexes are created by the migration script. Monitor query performance with:

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND tablename LIKE 'analytics_%'
ORDER BY idx_scan DESC;
```

### Partitioning (For High Volume)
If you exceed 10M+ events, consider partitioning by month:

```sql
-- Example monthly partitioning (future enhancement)
CREATE TABLE analytics_events_2025_10 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### Data Archival
```sql
-- Archive old events to cold storage
CREATE TABLE analytics_events_archive (LIKE analytics_events);

INSERT INTO analytics_events_archive
SELECT * FROM analytics_events
WHERE timestamp < NOW() - INTERVAL '13 months';

DELETE FROM analytics_events
WHERE timestamp < NOW() - INTERVAL '13 months';
```

## Troubleshooting

### Events Not Recording

1. Check API endpoint is accessible:
```bash
curl -X POST https://app.proofofputt.com/api/analytics/track-event \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test","eventName":"api_test","sessionId":"test-123","pageUrl":"https://test.com"}'
```

2. Check browser console for errors
3. Verify `NEXT_PUBLIC_ANALYTICS_API_URL` is set correctly

### High Database Load

1. Ensure indexes are present
2. Check slow queries: `SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;`
3. Consider enabling connection pooling
4. Pre-aggregate more data into `analytics_daily_metrics`

### Session Update Function Failing

```sql
-- Manually update session summaries
SELECT update_analytics_session(session_id)
FROM analytics_events
GROUP BY session_id;
```

## Future Enhancements

1. **Real-time Dashboard**: WebSocket-based live metrics
2. **A/B Testing Framework**: Built-in experiment tracking
3. **Cohort Analysis**: User retention tracking
4. **Predictive Analytics**: ML-based user behavior prediction
5. **Email Reports**: Automated weekly/monthly reports
6. **Heatmaps**: Click and scroll tracking visualization
7. **Session Replay**: Record user sessions (privacy-respecting)

## Support

For issues or questions about the analytics system:
1. Check this documentation first
2. Review the SQL schema in `add_analytics_tracking.sql`
3. Test with the dashboard API endpoints
4. Check database logs for errors

---

**Version**: 1.0.0
**Last Updated**: October 2025
**Maintainer**: Proof of Putt Development Team
