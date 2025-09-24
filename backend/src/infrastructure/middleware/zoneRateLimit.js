/**
 * Zone Rate Limiting Middleware
 * 
 * Implements rate limiting for zone operations to prevent abuse
 * Provides different limits for different types of operations
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limit configurations for different zone operations
 */
const RATE_LIMITS = {
  // General zone operations (read, list)
  ZONE_READ: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
      success: false,
      message: 'Too many zone read requests. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    }
  },
  
  // Zone modification operations (create, update, delete)
  ZONE_MODIFY: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: {
      success: false,
      message: 'Too many zone modification requests. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    }
  },
  
  // Zone arm/disarm operations
  ZONE_ARM_DISARM: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: {
      success: false,
      message: 'Too many arm/disarm requests. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    }
  },
  
  // Zone hierarchy operations
  ZONE_HIERARCHY: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
      success: false,
      message: 'Too many hierarchy modification requests. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    }
  }
};

/**
 * Create a custom key generator that includes user ID for per-user rate limiting
 * @param {Object} req - Express request object
 * @returns {string} Rate limit key
 */
const createUserBasedKeyGenerator = (operation) => {
  return (req) => {
    const userId = req.user ? req.user.id : ipKeyGenerator(req);
    return `${operation}:${userId}`;
  };
};

/**
 * Create a custom handler for rate limit exceeded
 * @param {Object} limitConfig - Rate limit configuration
 * @returns {Function} Rate limit handler
 */
const createRateLimitHandler = (limitConfig) => {
  return (req, res) => {
    // Log rate limit exceeded event
    console.warn(`Rate limit exceeded for user ${req.user?.id || 'anonymous'} on ${req.path}`, {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limitConfig.max,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': new Date(Date.now() + limitConfig.windowMs).toISOString(),
      'Retry-After': Math.ceil(limitConfig.windowMs / 1000)
    });

    res.status(429).json(limitConfig.message);
  };
};

/**
 * Skip rate limiting for certain conditions
 * @param {Object} req - Express request object
 * @returns {boolean} Whether to skip rate limiting
 */
const shouldSkipRateLimit = (req) => {
  // Skip rate limiting for system users in development
  if (process.env.NODE_ENV === 'development' && req.user?.role === 'system') {
    return true;
  }
  
  // Skip rate limiting if user has admin role and specific bypass header
  if (req.user?.role === 'admin' && req.headers['x-bypass-rate-limit'] === 'true') {
    return true;
  }
  
  return false;
};

/**
 * Rate limiter for zone read operations (GET requests)
 */
const zoneReadRateLimit = rateLimit({
  windowMs: RATE_LIMITS.ZONE_READ.windowMs,
  max: RATE_LIMITS.ZONE_READ.max,
  keyGenerator: createUserBasedKeyGenerator('zone_read'),
  handler: createRateLimitHandler(RATE_LIMITS.ZONE_READ),
  skip: shouldSkipRateLimit,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for zone modification operations (POST, PUT, DELETE)
 */
const zoneModifyRateLimit = rateLimit({
  windowMs: RATE_LIMITS.ZONE_MODIFY.windowMs,
  max: RATE_LIMITS.ZONE_MODIFY.max,
  keyGenerator: createUserBasedKeyGenerator('zone_modify'),
  handler: createRateLimitHandler(RATE_LIMITS.ZONE_MODIFY),
  skip: shouldSkipRateLimit,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for zone arm/disarm operations
 */
const zoneArmDisarmRateLimit = rateLimit({
  windowMs: RATE_LIMITS.ZONE_ARM_DISARM.windowMs,
  max: RATE_LIMITS.ZONE_ARM_DISARM.max,
  keyGenerator: createUserBasedKeyGenerator('zone_arm_disarm'),
  handler: createRateLimitHandler(RATE_LIMITS.ZONE_ARM_DISARM),
  skip: shouldSkipRateLimit,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for zone hierarchy operations
 */
const zoneHierarchyRateLimit = rateLimit({
  windowMs: RATE_LIMITS.ZONE_HIERARCHY.windowMs,
  max: RATE_LIMITS.ZONE_HIERARCHY.max,
  keyGenerator: createUserBasedKeyGenerator('zone_hierarchy'),
  handler: createRateLimitHandler(RATE_LIMITS.ZONE_HIERARCHY),
  skip: shouldSkipRateLimit,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Adaptive rate limiter that applies different limits based on user role
 * @param {string} operation - Type of operation
 * @returns {Function} Rate limiting middleware
 */
const adaptiveZoneRateLimit = (operation) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'user';
    
    // Different limits for different roles
    const roleLimits = {
      admin: {
        multiplier: 5, // 5x higher limits for admins
        windowMs: RATE_LIMITS[operation].windowMs
      },
      user: {
        multiplier: 1, // Standard limits for users
        windowMs: RATE_LIMITS[operation].windowMs
      },
      system: {
        multiplier: 10, // 10x higher limits for system
        windowMs: RATE_LIMITS[operation].windowMs
      }
    };

    const roleConfig = roleLimits[userRole] || roleLimits.user;
    const maxRequests = RATE_LIMITS[operation].max * roleConfig.multiplier;

    // Create dynamic rate limiter
    const dynamicRateLimit = rateLimit({
      windowMs: roleConfig.windowMs,
      max: maxRequests,
      keyGenerator: createUserBasedKeyGenerator(`${operation}_${userRole}`),
      handler: createRateLimitHandler({
        ...RATE_LIMITS[operation],
        max: maxRequests
      }),
      skip: shouldSkipRateLimit,
      standardHeaders: true,
      legacyHeaders: false
    });

    dynamicRateLimit(req, res, next);
  };
};

/**
 * Burst protection middleware for detecting rapid successive requests
 * @param {number} burstThreshold - Number of requests that trigger burst protection
 * @param {number} burstWindowMs - Time window for burst detection
 * @returns {Function} Burst protection middleware
 */
const burstProtection = (burstThreshold = 5, burstWindowMs = 10000) => {
  const burstTracker = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const key = `burst:${userId}`;

    // Clean up old entries
    for (const [trackingKey, data] of burstTracker.entries()) {
      if (now - data.firstRequest > burstWindowMs) {
        burstTracker.delete(trackingKey);
      }
    }

    // Get or create burst tracking data
    let burstData = burstTracker.get(key);
    if (!burstData) {
      burstData = {
        count: 0,
        firstRequest: now
      };
      burstTracker.set(key, burstData);
    }

    // Check if within burst window
    if (now - burstData.firstRequest <= burstWindowMs) {
      burstData.count++;

      if (burstData.count > burstThreshold) {
        console.warn(`Burst protection triggered for user ${userId}`, {
          userId,
          requestCount: burstData.count,
          timeWindow: burstWindowMs,
          ip: req.ip,
          path: req.path
        });

        return res.status(429).json({
          success: false,
          message: 'Too many rapid requests detected. Please slow down.',
          error: 'BURST_PROTECTION_TRIGGERED',
          retryAfter: Math.ceil(burstWindowMs / 1000)
        });
      }
    } else {
      // Reset burst tracking
      burstData.count = 1;
      burstData.firstRequest = now;
    }

    next();
  };
};

module.exports = {
  RATE_LIMITS,
  zoneReadRateLimit,
  zoneModifyRateLimit,
  zoneArmDisarmRateLimit,
  zoneHierarchyRateLimit,
  adaptiveZoneRateLimit,
  burstProtection
};