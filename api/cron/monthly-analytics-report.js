/**
 * Vercel Cron Job Handler for Monthly Analytics Report
 *
 * This endpoint is triggered by Vercel Cron on the 1st of each month at midnight (UTC)
 * Configured in vercel.json
 */

import handler from '../analytics/generate-monthly-report.js';

export default handler;

export const config = {
  // Vercel cron job configuration
  maxDuration: 60 // Max 60 seconds for cron jobs
};
