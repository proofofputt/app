/**
 * Structured Logger for Proof of Putt
 * Provides consistent, structured logging across all payment and subscription endpoints
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Core logging function that outputs structured JSON
 */
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    environment: process.env.NODE_ENV || 'development',
    ...context
  };

  // In production, we want clean JSON for log aggregation tools
  // In development, pretty print for readability
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (Object.keys(context).length > 0) {
      console.log('  Context:', JSON.stringify(context, null, 2));
    }
  }
}

/**
 * Log debug information (only in development)
 */
export function debug(message, context = {}) {
  if (process.env.NODE_ENV !== 'production') {
    log(LOG_LEVELS.DEBUG, message, context);
  }
}

/**
 * Log informational messages
 */
export function info(message, context = {}) {
  log(LOG_LEVELS.INFO, message, context);
}

/**
 * Log warnings that need attention but don't break functionality
 */
export function warn(message, context = {}) {
  log(LOG_LEVELS.WARN, message, context);
}

/**
 * Log errors that break functionality
 */
export function error(message, error, context = {}) {
  const errorContext = {
    ...context,
    error: {
      message: error?.message || 'Unknown error',
      stack: error?.stack || undefined,
      name: error?.name || undefined,
      code: error?.code || undefined
    }
  };
  log(LOG_LEVELS.ERROR, message, errorContext);
}

/**
 * Log critical errors that require immediate attention
 */
export function critical(message, error, context = {}) {
  const errorContext = {
    ...context,
    error: {
      message: error?.message || 'Unknown error',
      stack: error?.stack || undefined,
      name: error?.name || undefined,
      code: error?.code || undefined
    },
    severity: 'CRITICAL'
  };
  log(LOG_LEVELS.CRITICAL, message, errorContext);
}

/**
 * Specialized logger for API requests
 */
export function logApiRequest(endpoint, method, context = {}) {
  info(`API Request: ${method} ${endpoint}`, {
    type: 'api_request',
    endpoint,
    method,
    ...context
  });
}

/**
 * Specialized logger for API responses
 */
export function logApiResponse(endpoint, method, statusCode, context = {}) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  log(level, `API Response: ${method} ${endpoint} - ${statusCode}`, {
    type: 'api_response',
    endpoint,
    method,
    statusCode,
    ...context
  });
}

/**
 * Specialized logger for Zaprite API calls
 */
export function logZapriteApiCall(operation, context = {}) {
  info(`Zaprite API: ${operation}`, {
    type: 'zaprite_api',
    operation,
    ...context
  });
}

/**
 * Specialized logger for Zaprite API responses
 */
export function logZapriteApiResponse(operation, success, context = {}) {
  const level = success ? 'info' : 'error';
  log(level, `Zaprite API Response: ${operation} - ${success ? 'SUCCESS' : 'FAILED'}`, {
    type: 'zaprite_api_response',
    operation,
    success,
    ...context
  });
}

/**
 * Specialized logger for webhook events
 */
export function logWebhookEvent(eventType, eventId, context = {}) {
  info(`Webhook Event: ${eventType}`, {
    type: 'webhook_event',
    eventType,
    eventId,
    ...context
  });
}

/**
 * Specialized logger for database operations
 */
export function logDatabaseOperation(operation, context = {}) {
  debug(`Database: ${operation}`, {
    type: 'database_operation',
    operation,
    ...context
  });
}

/**
 * Specialized logger for authentication events
 */
export function logAuthEvent(event, context = {}) {
  info(`Auth Event: ${event}`, {
    type: 'auth_event',
    event,
    ...context
  });
}

/**
 * Specialized logger for payment events
 */
export function logPaymentEvent(event, context = {}) {
  info(`Payment Event: ${event}`, {
    type: 'payment_event',
    event,
    ...context
  });
}

/**
 * Specialized logger for subscription events
 */
export function logSubscriptionEvent(event, context = {}) {
  info(`Subscription Event: ${event}`, {
    type: 'subscription_event',
    event,
    ...context
  });
}

/**
 * Create a request-scoped logger with common context
 * Useful for tracking a single request through multiple function calls
 */
export function createRequestLogger(requestId, userId = null) {
  const baseContext = {
    requestId,
    userId
  };

  return {
    debug: (message, context = {}) => debug(message, { ...baseContext, ...context }),
    info: (message, context = {}) => info(message, { ...baseContext, ...context }),
    warn: (message, context = {}) => warn(message, { ...baseContext, ...context }),
    error: (message, err, context = {}) => error(message, err, { ...baseContext, ...context }),
    critical: (message, err, context = {}) => critical(message, err, { ...baseContext, ...context })
  };
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  constructor(operation) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  end(context = {}) {
    const duration = Date.now() - this.startTime;
    info(`Performance: ${this.operation}`, {
      type: 'performance',
      operation: this.operation,
      duration_ms: duration,
      ...context
    });
    return duration;
  }
}

export default {
  debug,
  info,
  warn,
  error,
  critical,
  logApiRequest,
  logApiResponse,
  logZapriteApiCall,
  logZapriteApiResponse,
  logWebhookEvent,
  logDatabaseOperation,
  logAuthEvent,
  logPaymentEvent,
  logSubscriptionEvent,
  createRequestLogger,
  PerformanceTimer
};
