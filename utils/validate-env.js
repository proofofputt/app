/**
 * Environment Variable Validator
 * Validates all required environment variables are present on startup
 * Fails fast with clear error messages to prevent runtime issues
 */

import { critical } from './logger.js';

/**
 * Required environment variables grouped by feature
 */
const REQUIRED_ENV_VARS = {
  // Core Application
  core: [
    'DATABASE_URL',
    'JWT_SECRET',
    'FRONTEND_URL',
    'NODE_ENV'
  ],

  // Zaprite Payment Processing
  zaprite: [
    'ZAPRITE_API_KEY',
    'ZAPRITE_ORG_ID',
    'ZAPRITE_BASE_URL',
    'ZAPRITE_WEBHOOK_SECRET'
  ],

  // OAuth Authentication
  oauth: [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ],

  // Email (Optional but recommended)
  email: [
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL'
  ]
};

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  ZAPRITE_BASE_URL: 'https://api.zaprite.com',
  NODE_ENV: 'development'
};

/**
 * Validation rules for specific environment variables
 */
const VALIDATION_RULES = {
  DATABASE_URL: (value) => {
    if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
      return 'DATABASE_URL must be a valid PostgreSQL connection string';
    }
    return null;
  },

  JWT_SECRET: (value) => {
    if (value.length < 32) {
      return 'JWT_SECRET should be at least 32 characters long for security';
    }
    return null;
  },

  FRONTEND_URL: (value) => {
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      return 'FRONTEND_URL must include protocol (http:// or https://)';
    }
    if (value.endsWith('/')) {
      return 'FRONTEND_URL should not end with a slash';
    }
    return null;
  },

  ZAPRITE_API_KEY: (value) => {
    if (!value.startsWith('zprt_')) {
      return 'ZAPRITE_API_KEY appears invalid (should start with zprt_)';
    }
    return null;
  },

  ZAPRITE_BASE_URL: (value) => {
    if (!value.startsWith('https://')) {
      return 'ZAPRITE_BASE_URL must use HTTPS';
    }
    return null;
  }
};

/**
 * Validate a single environment variable
 */
function validateEnvVar(name, value) {
  const errors = [];

  // Check if value is present
  if (!value || value.trim() === '') {
    errors.push(`${name} is required but not set`);
    return errors;
  }

  // Run validation rule if exists
  if (VALIDATION_RULES[name]) {
    const error = VALIDATION_RULES[name](value);
    if (error) {
      errors.push(`${name}: ${error}`);
    }
  }

  return errors;
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(options = {}) {
  const {
    requireZaprite = true,
    requireOAuth = true,
    requireEmail = false,
    throwOnError = true
  } = options;

  const errors = [];
  const warnings = [];
  const missing = [];

  // Validate core variables (always required)
  for (const varName of REQUIRED_ENV_VARS.core) {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else {
      const varErrors = validateEnvVar(varName, value);
      errors.push(...varErrors);
    }
  }

  // Validate Zaprite variables
  if (requireZaprite) {
    for (const varName of REQUIRED_ENV_VARS.zaprite) {
      const value = process.env[varName];
      if (!value) {
        missing.push(varName);
      } else {
        const varErrors = validateEnvVar(varName, value);
        errors.push(...varErrors);
      }
    }
  }

  // Validate OAuth variables
  if (requireOAuth) {
    for (const varName of REQUIRED_ENV_VARS.oauth) {
      const value = process.env[varName];
      if (!value) {
        missing.push(varName);
      } else {
        const varErrors = validateEnvVar(varName, value);
        errors.push(...varErrors);
      }
    }
  }

  // Validate Email variables (warnings only)
  if (requireEmail) {
    for (const varName of REQUIRED_ENV_VARS.email) {
      const value = process.env[varName];
      if (!value) {
        warnings.push(`${varName} is not set - email features will be disabled`);
      }
    }
  }

  // Check for example/placeholder values
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (
      value.includes('your-') ||
      value.includes('example') ||
      value.includes('placeholder') ||
      value === 'changeme'
    )) {
      warnings.push(`${key} appears to be a placeholder value: "${value}"`);
    }
  }

  // Compile results
  const result = {
    valid: errors.length === 0 && missing.length === 0,
    errors: [...missing.map(v => `${v} is required but not set`), ...errors],
    warnings,
    missing
  };

  // Log results
  if (!result.valid) {
    const errorMessage = 'Environment validation failed';
    critical(errorMessage, new Error(errorMessage), {
      errors: result.errors,
      warnings: result.warnings,
      missing: result.missing
    });

    if (throwOnError) {
      throw new Error(
        `Environment validation failed:\n${result.errors.join('\n')}\n\n` +
        `Please check your .env file and ensure all required variables are set.\n` +
        `See .env.example for reference.`
      );
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('Environment warnings:', warnings);
  }

  return result;
}

/**
 * Get environment variable with fallback
 */
export function getEnv(name, defaultValue = null) {
  return process.env[name] || OPTIONAL_ENV_VARS[name] || defaultValue;
}

/**
 * Get required environment variable (throws if missing)
 */
export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Check if we're in production environment
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development environment
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if we're in test environment
 */
export function isTest() {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get a summary of the environment configuration
 */
export function getEnvironmentSummary() {
  return {
    environment: process.env.NODE_ENV || 'development',
    hasDatabase: !!process.env.DATABASE_URL,
    hasZaprite: !!(process.env.ZAPRITE_API_KEY && process.env.ZAPRITE_ORG_ID),
    hasGoogleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasLinkedInOAuth: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
    hasEmail: !!process.env.SENDGRID_API_KEY,
    frontendUrl: process.env.FRONTEND_URL || 'not set'
  };
}

/**
 * Validate environment on module load (in production only)
 */
if (isProduction() && process.env.SKIP_ENV_VALIDATION !== 'true') {
  try {
    validateEnvironment({
      requireZaprite: true,
      requireOAuth: true,
      requireEmail: false,
      throwOnError: true
    });
  } catch (error) {
    console.error('FATAL: Environment validation failed on startup');
    console.error(error.message);
    process.exit(1);
  }
}

export default {
  validateEnvironment,
  getEnv,
  getRequiredEnv,
  isProduction,
  isDevelopment,
  isTest,
  getEnvironmentSummary
};
