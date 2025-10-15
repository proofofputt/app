import pg from 'pg';
import { verifyZapriteConnection, validateZapriteConfig } from '../../utils/zaprite-client.js';
import { getEnvironmentSummary } from '../../utils/validate-env.js';
import { info, error as logError } from '../../utils/logger.js';

const { Pool } = pg;

/**
 * Zaprite Health Check Endpoint
 * Verifies all Zaprite integration components are functioning correctly
 *
 * Checks:
 * - Environment variables configured
 * - Database connectivity
 * - Zaprite API connectivity
 * - Webhook configuration
 */
export default async function handler(req, res) {
  info('Zaprite health check requested');

  const healthStatus = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: {}
  };

  // 1. Check environment variables
  try {
    const configValidation = validateZapriteConfig();
    const envSummary = getEnvironmentSummary();

    healthStatus.checks.environment = {
      status: configValidation.valid ? 'healthy' : 'unhealthy',
      hasZapriteApiKey: !!process.env.ZAPRITE_API_KEY,
      hasZapriteOrgId: !!process.env.ZAPRITE_ORG_ID,
      hasZapriteWebhookSecret: !!process.env.ZAPRITE_WEBHOOK_SECRET,
      hasZapriteBaseUrl: !!process.env.ZAPRITE_BASE_URL,
      hasDatabaseUrl: envSummary.hasDatabase,
      errors: configValidation.errors
    };

    if (!configValidation.valid) {
      healthStatus.overall = 'degraded';
    }
  } catch (error) {
    logError('Environment check failed', error);
    healthStatus.checks.environment = {
      status: 'unhealthy',
      error: error.message
    };
    healthStatus.overall = 'unhealthy';
  }

  // 2. Check database connectivity
  let pool;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test query
    const result = await pool.query('SELECT NOW() as current_time');

    // Check if zaprite_events table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'zaprite_events'
      ) as exists
    `);

    // Check if zaprite fields exist in players table
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'players'
        AND column_name IN ('zaprite_customer_id', 'zaprite_subscription_id', 'subscription_status')
    `);

    healthStatus.checks.database = {
      status: 'healthy',
      connected: true,
      currentTime: result.rows[0].current_time,
      zapriteEventsTableExists: tableCheck.rows[0].exists,
      zapriteColumnsFound: columnsCheck.rows.length
    };

    // If zaprite_events table doesn't exist, that's a problem
    if (!tableCheck.rows[0].exists) {
      healthStatus.checks.database.status = 'degraded';
      healthStatus.checks.database.warning = 'zaprite_events table not found - run migration';
      healthStatus.overall = 'degraded';
    }

  } catch (error) {
    logError('Database check failed', error);
    healthStatus.checks.database = {
      status: 'unhealthy',
      connected: false,
      error: error.message
    };
    healthStatus.overall = 'unhealthy';
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  // 3. Check Zaprite API connectivity
  try {
    const zapriteCheck = await verifyZapriteConnection();

    healthStatus.checks.zapriteApi = {
      status: zapriteCheck.connected ? 'healthy' : 'unhealthy',
      connected: zapriteCheck.connected,
      error: zapriteCheck.error || null,
      statusCode: zapriteCheck.statusCode || null
    };

    if (!zapriteCheck.connected) {
      healthStatus.overall = healthStatus.overall === 'healthy' ? 'degraded' : 'unhealthy';
    }
  } catch (error) {
    logError('Zaprite API check failed', error);
    healthStatus.checks.zapriteApi = {
      status: 'unhealthy',
      connected: false,
      error: error.message
    };
    healthStatus.overall = 'unhealthy';
  }

  // 4. Webhook configuration check
  try {
    healthStatus.checks.webhook = {
      status: 'healthy',
      secretConfigured: !!process.env.ZAPRITE_WEBHOOK_SECRET,
      endpointUrl: `${process.env.FRONTEND_URL || 'https://app.proofofputt.com'}/api/webhooks/zaprite`
    };

    if (!process.env.ZAPRITE_WEBHOOK_SECRET) {
      healthStatus.checks.webhook.status = 'degraded';
      healthStatus.checks.webhook.warning = 'ZAPRITE_WEBHOOK_SECRET not configured - webhooks are insecure';
      if (process.env.NODE_ENV === 'production') {
        healthStatus.overall = 'degraded';
      }
    }
  } catch (error) {
    logError('Webhook check failed', error);
    healthStatus.checks.webhook = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // Determine HTTP status code based on overall health
  let statusCode = 200;
  if (healthStatus.overall === 'degraded') {
    statusCode = 200; // Still operational but with warnings
  } else if (healthStatus.overall === 'unhealthy') {
    statusCode = 503; // Service unavailable
  }

  info('Zaprite health check completed', {
    overall: healthStatus.overall,
    statusCode
  });

  res.status(statusCode).json(healthStatus);
}
