// Simple in-memory rate limiter
const rateLimitStore = new Map();

export function checkRateLimit(key, maxAttempts = 3, windowMs = 3600000) { // 1 hour default
  const now = Date.now();

  // Clean up expired entries periodically
  if (Math.random() < 0.1) { // 10% chance to clean up on each check
    for (const [k, data] of rateLimitStore.entries()) {
      if (now - data.firstAttempt > windowMs) {
        rateLimitStore.delete(k);
      }
    }
  }

  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First attempt
    rateLimitStore.set(key, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > windowMs) {
    // Reset the window
    rateLimitStore.set(key, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
  }

  // Window is still active
  if (entry.attempts >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.firstAttempt + windowMs,
      retryAfter: Math.ceil((entry.firstAttempt + windowMs - now) / 1000) // seconds
    };
  }

  // Increment attempts
  entry.attempts++;
  entry.lastAttempt = now;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: maxAttempts - entry.attempts,
    resetTime: entry.firstAttempt + windowMs
  };
}

export function getRateLimitStatus(key) {
  const entry = rateLimitStore.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const windowMs = 3600000; // 1 hour

  if (now - entry.firstAttempt > windowMs) {
    // Expired
    rateLimitStore.delete(key);
    return null;
  }

  return {
    attempts: entry.attempts,
    firstAttempt: entry.firstAttempt,
    lastAttempt: entry.lastAttempt,
    remaining: Math.max(0, 3 - entry.attempts)
  };
}