# Monthly Analytics Report System

## Overview

Automated monthly business intelligence reports generated on the 1st of each month at midnight UTC. Provides comprehensive traffic analysis, conversion metrics, and business insights.

## Features

- **Automated Generation**: Runs via Vercel Cron on the 1st of each month at 00:00 UTC
- **Comprehensive Metrics**: Traffic, conversions, devices, geography, campaigns
- **Multiple Delivery Methods**: API endpoint, file storage, email (optional)
- **Beautiful ASCII Tables**: Professional formatting for easy reading
- **Historical Comparison**: Month-over-month growth percentages

## Report Sections

### 1. Executive Summary
- Unique visitors and sessions with MoM growth
- Page views and downloads
- Conversion metrics
- Key engagement metrics (sessions per visitor, pages per session, avg duration)

### 2. Conversion Funnel
- 4-step funnel analysis:
  1. Site visitors
  2. Engaged users (clicked something)
  3. Downloaded app
  4. Signed up
- Drop-off rates at each stage
- Conversion percentages

### 3. Traffic Sources
- Sessions, visitors, and downloads by source
- Sources: Google, Direct, Facebook, Twitter, LinkedIn, etc.
- Conversion rate and average session duration per source

### 4. Top Pages
- Most visited pages
- Sessions, visitors, downloads, and clicks per page
- Identifies highest-performing content

### 5. Top Events
- Most triggered events (downloads, clicks, form submits)
- Event counts and unique users
- Helps identify popular features

### 6. Device & Browser Breakdown
- Desktop vs Mobile vs Tablet performance
- Browser usage (Chrome, Safari, Firefox, Edge)
- Conversions and downloads by device

### 7. Geographic Distribution
- Traffic by country
- Sessions, visitors, and downloads per country
- Identifies market opportunities

### 8. UTM Campaign Performance
- Campaign tracking metrics
- Sessions, visitors, downloads, and conversions by campaign
- ROI analysis for marketing efforts

### 9. Daily Traffic Summary
- Average daily metrics
- Peak and slowest traffic days
- Trend analysis

## Setup Instructions

### 1. Automatic Cron Job (Recommended)

The system is already configured to run automatically via Vercel Cron.

**Schedule:** 1st of each month at 00:00 UTC (midnight)
**Configuration:** `app/vercel.json` - `"schedule": "0 0 1 * *"`

No additional setup required - it will run automatically once deployed to Vercel.

### 2. Email Delivery (Optional)

To receive reports via email:

Add to `app/.env`:
```bash
# Already configured from existing setup
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=reports@proofofputt.com

# Add this new variable
REPORT_EMAIL_TO=your-email@domain.com
```

Reports will be sent as both email body (formatted HTML) and attached as `.txt` file.

### 3. File Storage

Reports are automatically saved to `app/reports/` directory:
- Filename format: `analytics-report-{month-year}.txt`
- Example: `analytics-report-september-2025.txt`

The `/reports/` directory is created automatically if it doesn't exist.

## Usage

### Automatic Execution (Cron)

Once deployed, the report generates automatically on the 1st of each month.

**Check cron logs in Vercel:**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on "Cron Jobs" tab
3. View execution history and logs

### Manual Execution

#### Option 1: API Endpoint
```bash
# Generate report for previous month
curl https://app.proofofputt.com/api/analytics/generate-monthly-report

# Response includes summary and file path
{
  "success": true,
  "message": "Monthly report generated successfully",
  "monthName": "September 2025",
  "filepath": "/app/reports/analytics-report-september-2025.txt",
  "summary": {
    "unique_visitors": 1234,
    "total_sessions": 2345,
    "total_downloads": 456,
    "conversion_rate": 12.5
  }
}
```

#### Option 2: Command Line (Local Development)
```bash
cd app
node api/analytics/generate-monthly-report.js
```

This will:
1. Generate report for previous month
2. Print to console
3. Save to `reports/` directory
4. Send email (if configured)

### Custom Date Range

To generate a report for a specific month, modify the script:

```javascript
// Edit api/analytics/generate-monthly-report.js
const customRange = {
  startDate: '2025-09-01T00:00:00.000Z',
  endDate: '2025-09-30T23:59:59.999Z',
  monthName: 'September 2025'
};

const reportData = await generateMonthlyReport(customRange);
```

## Sample Report Output

```
═══════════════════════════════════════════════════════════════════════════
           PROOF OF PUTT - MONTHLY ANALYTICS REPORT
                        September 2025
═══════════════════════════════════════════════════════════════════════════

Report Generated: 10/1/2025, 12:00:00 AM PST
Period: 9/1/2025 - 9/30/2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Unique Visitors:          1,234 (+23.45% MoM)
Total Sessions:           2,345 (+18.92% MoM)
Page Views:               12,456
Total Downloads:          456 (+34.21% MoM)
Total Conversions:        123
New Signups:              98

Sessions per Visitor:     1.9
Pages per Session:        5.3
Avg Session Duration:     4m 32s
Conversion Rate:          5.24%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CONVERSION FUNNEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Visited Site              1,234
2. Engaged (Clicked)           856 (69.36% conversion, 30.64% drop-off)
3. Downloaded App              456 (53.27% conversion, 46.73% drop-off)
4. Signed Up                    98 (21.49% conversion, 78.51% drop-off)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. TRAFFIC SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

+----------+----------+----------+-----------+----------+--------------+
| Source   | Sessions | Visitors | Downloads | Conv Rate| Avg Duration |
+----------+----------+----------+-----------+----------+--------------+
| google   | 856      | 623      | 234       | 6.78%    | 5m 12s       |
| Direct   | 542      | 398      | 123       | 4.56%    | 3m 45s       |
| twitter  | 234      | 187      | 45        | 7.23%    | 4m 23s       |
| linkedin | 189      | 145      | 34        | 5.91%    | 4m 56s       |
+----------+----------+----------+-----------+----------+--------------+
```

## Business Intelligence Insights

### Key Metrics to Monitor

1. **Month-over-Month Growth**
   - Track visitor, session, and download growth
   - Identify trends (positive/negative)
   - Set growth targets

2. **Conversion Funnel Drop-offs**
   - Identify where users leave
   - Optimize high drop-off stages
   - A/B test improvements

3. **Traffic Source ROI**
   - Which sources drive highest conversions?
   - Allocate marketing budget accordingly
   - Double down on high-performers

4. **Device Performance**
   - Mobile vs Desktop conversion rates
   - Optimize for primary device types
   - Fix device-specific issues

5. **Geographic Opportunities**
   - Which countries show strong engagement?
   - Consider localization for top markets
   - Time marketing efforts by timezone

### Action Items Based on Reports

**High Download Drop-off?**
- Improve download page UX
- Add social proof (testimonials)
- Simplify download process

**Low Engagement (Few Clicks)?**
- Improve CTAs on landing page
- Test different messaging
- Add interactive elements

**Poor Mobile Performance?**
- Audit mobile experience
- Fix responsive design issues
- Test on various devices

**Specific Traffic Source Underperforming?**
- Review ad creative/messaging
- Check landing page relevance
- Adjust targeting

## Cron Schedule Reference

```
"0 0 1 * *"  - At 00:00 on day-of-month 1
│ │ │ │ │
│ │ │ │ └─ Day of week (0-6, Sunday=0)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Current Schedule:** Midnight UTC on the 1st of each month

To change the schedule, edit `app/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-analytics-report",
      "schedule": "0 0 1 * *"  // Modify this
    }
  ]
}
```

## Troubleshooting

### Report Not Generating

1. **Check Vercel Cron Logs:**
   - Vercel Dashboard → Cron Jobs → View Logs
   - Look for errors in execution

2. **Verify Database Connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM analytics_events;"
   ```

3. **Test Manually:**
   ```bash
   curl https://app.proofofputt.com/api/analytics/generate-monthly-report
   ```

### No Email Received

1. **Check Environment Variables:**
   - `SENDGRID_API_KEY` is set
   - `REPORT_EMAIL_TO` is set
   - `SENDGRID_FROM_EMAIL` is verified in SendGrid

2. **Check SendGrid Logs:**
   - SendGrid Dashboard → Activity
   - Look for sent/delivered status

3. **Check Spam Folder:**
   - Automated reports may be flagged as spam
   - Add sender to contacts

### Report Shows No Data

1. **Check Date Range:**
   - Ensure analytics data exists for previous month
   - Verify events are being tracked

2. **Run Test Query:**
   ```sql
   SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
   FROM analytics_events
   WHERE timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
     AND timestamp < DATE_TRUNC('month', NOW());
   ```

### File Not Saved

1. **Check File Permissions:**
   - Ensure `reports/` directory is writable
   - May not work in serverless environments (use email instead)

2. **Vercel Limitations:**
   - Vercel serverless functions have ephemeral filesystem
   - Files are NOT persisted between invocations
   - **Recommendation:** Use email delivery instead

## Future Enhancements

1. **Multi-Channel Delivery:**
   - Slack notifications
   - Discord webhooks
   - SMS alerts for critical metrics

2. **Interactive Dashboards:**
   - Web-based report viewer
   - Drill-down capabilities
   - Export to PDF/CSV

3. **Advanced Analytics:**
   - Cohort retention analysis
   - User lifetime value (LTV)
   - Predictive forecasting

4. **Custom Report Scheduling:**
   - Weekly summaries
   - Quarterly business reviews
   - On-demand custom date ranges

5. **Alerting:**
   - Email alerts for anomalies
   - Drop in traffic/conversions
   - Spike in errors

---

**Version**: 1.0.0
**Last Updated**: October 2025
**Maintainer**: Proof of Putt Development Team
