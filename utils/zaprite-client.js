/**
 * Zaprite API Client with Retry Logic
 * Provides resilient API calls to Zaprite with exponential backoff
 */

import { logZapriteApiCall, logZapriteApiResponse, error as logError, PerformanceTimer } from './logger.js';

const ZAPRITE_BASE_URL = process.env.ZAPRITE_BASE_URL || 'https://api.zaprite.com';
const ZAPRITE_API_KEY = process.env.ZAPRITE_API_KEY;
const ZAPRITE_ORG_ID = process.env.ZAPRITE_ORG_ID;

// Configuration
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay for exponential backoff

/**
 * Custom error class for Zaprite API errors
 */
export class ZapriteApiError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'ZapriteApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
  return BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
}

/**
 * Check if error is retryable
 */
function isRetryableError(statusCode) {
  // Retry on 5xx server errors and 429 rate limit
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Make Zaprite API call with retry logic
 */
async function zapriteApiCall(endpoint, options = {}, retries = DEFAULT_RETRIES) {
  const url = `${ZAPRITE_BASE_URL}${endpoint}`;
  const timer = new PerformanceTimer(`Zaprite API: ${options.method || 'GET'} ${endpoint}`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ZAPRITE_API_KEY}`,
    ...options.headers
  };

  const fetchOptions = {
    ...options,
    headers
  };

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logZapriteApiCall(`${options.method || 'GET'} ${endpoint}`, {
        attempt: attempt + 1,
        maxRetries: retries + 1
      });

      const response = await fetchWithTimeout(url, fetchOptions, options.timeout || DEFAULT_TIMEOUT);
      const statusCode = response.status;

      // Parse response body
      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          responseData = { raw: responseText };
        }
      } else {
        responseData = { raw: await response.text() };
      }

      // Success case
      if (response.ok) {
        const duration = timer.end({ statusCode });
        logZapriteApiResponse(`${options.method || 'GET'} ${endpoint}`, true, {
          statusCode,
          duration_ms: duration,
          attempt: attempt + 1
        });
        return responseData;
      }

      // Error case
      const error = new ZapriteApiError(
        responseData.message || `Zaprite API error: ${statusCode}`,
        statusCode,
        responseData
      );

      // Check if we should retry
      if (attempt < retries && isRetryableError(statusCode)) {
        const delay = getRetryDelay(attempt);
        logError(`Zaprite API call failed, retrying in ${delay}ms`, error, {
          endpoint,
          attempt: attempt + 1,
          statusCode,
          willRetry: true
        });
        await sleep(delay);
        continue;
      }

      // No more retries or non-retryable error
      timer.end({ statusCode, error: true });
      logZapriteApiResponse(`${options.method || 'GET'} ${endpoint}`, false, {
        statusCode,
        error: error.message,
        attempt: attempt + 1
      });
      throw error;

    } catch (err) {
      lastError = err;

      // If it's already a ZapriteApiError and not retryable, throw immediately
      if (err instanceof ZapriteApiError && !isRetryableError(err.statusCode)) {
        throw err;
      }

      // For network errors, retry if we have attempts left
      if (attempt < retries) {
        const delay = getRetryDelay(attempt);
        logError(`Zaprite API call failed, retrying in ${delay}ms`, err, {
          endpoint,
          attempt: attempt + 1,
          willRetry: true
        });
        await sleep(delay);
        continue;
      }

      // No more retries
      timer.end({ error: true });
      throw err;
    }
  }

  // Should never reach here, but throw last error just in case
  throw lastError;
}

/**
 * Create a Zaprite order (one-time payment or subscription setup)
 * For monthly subscriptions with auto-pay, include customCheckoutId
 */
export async function createZapriteOrder(orderPayload, options = {}) {
  const payload = {
    organizationId: ZAPRITE_ORG_ID,
    ...orderPayload
  };

  return zapriteApiCall('/v1/order', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options
  });
}

/**
 * Charge a saved payment profile (for recurring payments)
 * Used for monthly subscription auto-pay with saved Square payment method
 *
 * @param {Object} chargePayload - The charge details
 * @param {string} chargePayload.orderId - The order ID to charge
 * @param {string} chargePayload.paymentProfileId - The saved payment profile ID
 * @param {Object} options - Additional request options
 * @returns {Promise} The charge response
 */
export async function createZapriteOrderCharge(chargePayload, options = {}) {
  const { orderId, paymentProfileId, ...additionalData } = chargePayload;

  if (!orderId || !paymentProfileId) {
    throw new Error('orderId and paymentProfileId are required for order charge');
  }

  const payload = {
    paymentProfileId,
    ...additionalData
  };

  return zapriteApiCall(`/v1/order/${orderId}/charge`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options
  });
}

/**
 * Create a Zaprite recurring invoice (for subscriptions)
 * Used for monthly recurring payments
 */
export async function createZapriteRecurringInvoice(invoicePayload, options = {}) {
  const payload = {
    organizationId: ZAPRITE_ORG_ID,
    ...invoicePayload
  };

  // Note: The exact endpoint may vary - common patterns are:
  // - /v1/invoice/recurring
  // - /v1/recurring-invoice
  // - /v1/subscription
  // This will need to be verified with Zaprite's API documentation
  return zapriteApiCall('/v1/invoice/recurring', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options
  });
}

/**
 * Cancel a Zaprite recurring invoice
 */
export async function cancelZapriteRecurringInvoice(invoiceId, options = {}) {
  return zapriteApiCall(`/v1/invoice/recurring/${invoiceId}/cancel`, {
    method: 'POST',
    ...options
  });
}

/**
 * Get Zaprite recurring invoice by ID
 */
export async function getZapriteRecurringInvoice(invoiceId, options = {}) {
  return zapriteApiCall(`/v1/invoice/recurring/${invoiceId}`, {
    method: 'GET',
    ...options
  });
}

/**
 * Get Zaprite order by ID
 */
export async function getZapriteOrder(orderId, options = {}) {
  return zapriteApiCall(`/v1/order/${orderId}`, {
    method: 'GET',
    ...options
  });
}

/**
 * Cancel Zaprite order
 */
export async function cancelZapriteOrder(orderId, options = {}) {
  return zapriteApiCall(`/v1/order/${orderId}/cancel`, {
    method: 'POST',
    ...options
  });
}

/**
 * Get Zaprite customer by ID
 */
export async function getZapriteCustomer(customerId, options = {}) {
  return zapriteApiCall(`/v1/customer/${customerId}`, {
    method: 'GET',
    ...options
  });
}

/**
 * Create or update Zaprite customer
 */
export async function upsertZapriteCustomer(customerData, options = {}) {
  return zapriteApiCall('/v1/customer', {
    method: 'POST',
    body: JSON.stringify(customerData),
    ...options
  });
}

/**
 * List Zaprite orders (with pagination)
 */
export async function listZapriteOrders(params = {}, options = {}) {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = `/v1/order${queryString ? `?${queryString}` : ''}`;

  return zapriteApiCall(endpoint, {
    method: 'GET',
    ...options
  });
}

/**
 * Verify Zaprite API connection (health check)
 */
export async function verifyZapriteConnection() {
  try {
    // Try to list orders with limit=1 as a health check
    await listZapriteOrders({ limit: 1 }, { timeout: 5000 });
    return { connected: true, error: null };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      statusCode: error.statusCode || null
    };
  }
}

/**
 * Extract checkout URL from Zaprite response
 * Handles different possible field names
 */
export function extractCheckoutUrl(zapriteResponse) {
  return zapriteResponse.checkoutUrl ||
         zapriteResponse.checkout_url ||
         zapriteResponse.url ||
         zapriteResponse.paymentUrl ||
         zapriteResponse.payment_url ||
         zapriteResponse.hostedUrl ||
         zapriteResponse.checkoutLink ||
         null;
}

/**
 * Extract order ID from Zaprite response
 */
export function extractOrderId(zapriteResponse) {
  return zapriteResponse.id ||
         zapriteResponse.orderId ||
         zapriteResponse.order_id ||
         null;
}

/**
 * Validate Zaprite environment configuration
 */
export function validateZapriteConfig() {
  const errors = [];

  if (!ZAPRITE_API_KEY) {
    errors.push('ZAPRITE_API_KEY is not set');
  }

  if (!ZAPRITE_ORG_ID) {
    errors.push('ZAPRITE_ORG_ID is not set');
  }

  if (!ZAPRITE_BASE_URL) {
    errors.push('ZAPRITE_BASE_URL is not set');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  createZapriteOrder,
  createZapriteOrderCharge,
  createZapriteRecurringInvoice,
  cancelZapriteRecurringInvoice,
  getZapriteRecurringInvoice,
  getZapriteOrder,
  cancelZapriteOrder,
  getZapriteCustomer,
  upsertZapriteCustomer,
  listZapriteOrders,
  verifyZapriteConnection,
  extractCheckoutUrl,
  extractOrderId,
  validateZapriteConfig,
  ZapriteApiError
};
