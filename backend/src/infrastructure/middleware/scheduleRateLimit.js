/**
 * Schedule Rate Limiting Middleware
 * 
 * Provides comprehensive rate limiting for schedule management endpoints.
 * Follows the same patterns as existing rate limiting middleware in the system.
 * Implements different rate limits for different types of schedule operations.
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for schedule read operations (GET requests)
 * More permissive limits for read-only operations
 */
const scheduleReadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Allow 200 requests per 15-minute window
  message: {
    success: false,
    message: 'Too many schedule read requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_read_${req.ip}_${req.user.id}`;
    }
    return `schedule_read_${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users in development/testing
    if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter for schedule creation operations (POST requests)
 * More restrictive limits to prevent spam and abuse
 */
const scheduleCreateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Allow 50 schedule creations per hour
  message: {
    success: false,
    message: 'Too many schedule creation requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_create_${req.ip}_${req.user.id}`;
    }
    return `schedule_create_${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users in development/testing
    if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter for schedule modification operations (PUT, PATCH, DELETE requests)
 * Moderate limits for update and delete operations
 */
const scheduleModifyRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 100, // Allow 100 schedule modifications per 30 minutes
  message: {
    success: false,
    message: 'Too many schedule modification requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '30 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_modify_${req.ip}_${req.user.id}`;
    }
    return `schedule_modify_${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users in development/testing
    if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter for bulk schedule operations
 * Very restrictive limits due to the resource-intensive nature of bulk operations
 */
const scheduleBulkRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow 10 bulk operations per hour
  message: {
    success: false,
    message: 'Too many bulk schedule operation requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_bulk_${req.ip}_${req.user.id}`;
    }
    return `schedule_bulk_${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users in development/testing
    if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter for schedule testing operations
 * Moderate limits for testing schedule expressions
 */
const scheduleTestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Allow 50 test requests per 15 minutes
  message: {
    success: false,
    message: 'Too many schedule test requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_test_${req.ip}_${req.user.id}`;
    }
    return `schedule_test_${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users in development/testing
    if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter for administrative schedule operations
 * More permissive for admin operations but still protected
 */
const scheduleAdminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Allow 300 admin requests per 15 minutes
  message: {
    success: false,
    message: 'Too many admin schedule requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user ID for authenticated requests
    if (req.user && req.user.id) {
      return `schedule_admin_${req.ip}_${req.user.id}`;
    }
    return `schedule_admin_${req.ip}`;
  },
  skip: (req) => {
    // Only apply to admin users
    if (!req.user || req.user.role !== 'admin') {
      return true;
    }
    // Skip rate limiting in development/testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
});

/**
 * Burst protection middleware for schedule operations
 * Prevents rapid-fire requests that could overwhelm the system
 */
const scheduleBurstProtection = (options = {}) => {
  const {
    windowMs = 1 * 60 * 1000, // 1 minute
    max = 30, // Allow 30 requests per minute
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    skipFailedRequests,
    message: {
      success: false,
      message: 'Too many rapid requests detected. Please slow down.',
      error: 'BURST_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use combination of IP and user ID for authenticated requests
      if (req.user && req.user.id) {
        return `schedule_burst_${req.ip}_${req.user.id}`;
      }
      return `schedule_burst_${req.ip}`;
    },
    skip: (req) => {
      // Skip rate limiting for admin users in development/testing
      if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
        return true;
      }
      return false;
    }
  });
};

/**
 * Progressive rate limiting middleware
 * Applies stricter limits for users who have exceeded certain thresholds
 */
const scheduleProgressiveRateLimit = (req, res, next) => {
  const store = scheduleCreateRateLimit.store;
  const key = scheduleCreateRateLimit.keyGenerator(req);

  // Get current hit count for this key
  store.get(key, (err, hits) => {
    if (err) {
      // If we can't check the store, continue without additional limiting
      return next();
    }

    // If user has made many requests, apply stricter limits
    if (hits && hits >= 30) {
      // Apply very restrictive rate limit for heavy users
      const strictLimit = rateLimit({
        windowMs: 2 * 60 * 60 * 1000, // 2 hours
        max: 5, // Only 5 more requests in 2 hours
        message: {
          success: false,
          message: 'You have exceeded the normal usage limits. Please try again later.',
          error: 'PROGRESSIVE_RATE_LIMIT_EXCEEDED',
          retryAfter: '2 hours'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `schedule_progressive_${key}`,
        skip: (req) => {
          // Skip rate limiting for admin users in development/testing
          if (process.env.NODE_ENV === 'development' && req.user && req.user.role === 'admin') {
            return true;
          }
          return false;
        }
      });

      return strictLimit(req, res, next);
    }

    next();
  });
};

/**
 * Custom error handler for rate limit responses
 * Provides consistent error responses across all rate limiters
 */
const handleRateLimitError = (req, res, next, rateLimitReached) => {
  if (rateLimitReached) {
    // Log the rate limit violation for monitoring
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.originalUrl}`, {
      ip: req.ip,
      userId: req.user?.id,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      details: {
        endpoint: req.originalUrl,
        method: req.method,
        retryAfter: res.get('Retry-After') || 'later'
      }
    });
  }

  next();
};

module.exports = {
  scheduleReadRateLimit,
  scheduleCreateRateLimit,
  scheduleModifyRateLimit,
  scheduleBulkRateLimit,
  scheduleTestRateLimit,
  scheduleAdminRateLimit,
  scheduleBurstProtection,
  scheduleProgressiveRateLimit,
  handleRateLimitError
};