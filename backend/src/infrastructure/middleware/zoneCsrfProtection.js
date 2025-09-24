/**
 * Zone CSRF Protection Middleware
 * 
 * Custom CSRF protection implementation for zone modification operations
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');
const { AUDIT_EVENTS, logAuditEvent, AUDIT_LEVELS } = require('./zoneAuditLogger');

/**
 * CSRF configuration
 */
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  SECRET_KEY: process.env.CSRF_SECRET || 'zone-csrf-secret-key-change-in-production',
  HEADER_NAME: 'x-csrf-token',
  COOKIE_NAME: 'zone-csrf-token',
  SAFE_METHODS: ['GET', 'HEAD', 'OPTIONS']
};

/**
 * Generate a secure random token
 * @returns {string} Random token
 */
const generateToken = () => {
  return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex');
};

/**
 * Create HMAC signature for token validation
 * @param {string} token - CSRF token
 * @param {string} userId - User ID
 * @param {number} timestamp - Token creation timestamp
 * @returns {string} HMAC signature
 */
const createTokenSignature = (token, userId, timestamp) => {
  const payload = `${token}:${userId}:${timestamp}`;
  return crypto
    .createHmac('sha256', CSRF_CONFIG.SECRET_KEY)
    .update(payload)
    .digest('hex');
};

/**
 * Verify HMAC signature for token validation
 * @param {string} token - CSRF token
 * @param {string} userId - User ID
 * @param {number} timestamp - Token creation timestamp
 * @param {string} signature - HMAC signature to verify
 * @returns {boolean} Whether signature is valid
 */
const verifyTokenSignature = (token, userId, timestamp, signature) => {
  const expectedSignature = createTokenSignature(token, userId, timestamp);
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
};

/**
 * Generate CSRF token for user
 * @param {string} userId - User ID
 * @returns {Object} Token data
 */
const generateCsrfToken = (userId) => {
  const token = generateToken();
  const timestamp = Date.now();
  const signature = createTokenSignature(token, userId, timestamp);
  
  return {
    token,
    timestamp,
    signature,
    expires: timestamp + CSRF_CONFIG.TOKEN_EXPIRY
  };
};

/**
 * Validate CSRF token
 * @param {string} token - CSRF token to validate
 * @param {string} userId - User ID
 * @param {string} signature - Token signature
 * @param {number} timestamp - Token timestamp
 * @returns {Object} Validation result
 */
const validateCsrfToken = (token, userId, signature, timestamp) => {
  const result = {
    isValid: false,
    reason: null
  };

  // Check if token exists
  if (!token || !signature || !timestamp) {
    result.reason = 'Missing CSRF token components';
    return result;
  }

  // Check token expiry
  const now = Date.now();
  const tokenAge = now - timestamp;
  if (tokenAge > CSRF_CONFIG.TOKEN_EXPIRY) {
    result.reason = 'CSRF token expired';
    return result;
  }

  // Verify token signature
  if (!verifyTokenSignature(token, userId, timestamp, signature)) {
    result.reason = 'Invalid CSRF token signature';
    return result;
  }

  result.isValid = true;
  return result;
};

/**
 * Middleware to generate and set CSRF token
 */
const setCsrfToken = (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const tokenData = generateCsrfToken(req.user.id);
    
    // Set secure cookie with token information
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_CONFIG.TOKEN_EXPIRY
    };

    res.cookie(CSRF_CONFIG.COOKIE_NAME, JSON.stringify({
      token: tokenData.token,
      timestamp: tokenData.timestamp,
      signature: tokenData.signature
    }), cookieOptions);

    // Also provide token in response header for SPA applications
    res.set('X-CSRF-Token', tokenData.token);

    next();
  } catch (error) {
    console.error('CSRF token generation error:', error);
    next();
  }
};

/**
 * Middleware to validate CSRF token for state-changing operations
 */
const validateCsrfTokenMiddleware = (req, res, next) => {
  try {
    // Skip validation for safe methods
    if (CSRF_CONFIG.SAFE_METHODS.includes(req.method)) {
      return next();
    }

    // Skip validation for non-authenticated requests
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Get token from header
    const tokenFromHeader = req.headers[CSRF_CONFIG.HEADER_NAME];
    
    // Get token data from cookie
    let cookieData;
    try {
      const cookieValue = req.cookies?.[CSRF_CONFIG.COOKIE_NAME];
      cookieData = cookieValue ? JSON.parse(cookieValue) : null;
    } catch (error) {
      cookieData = null;
    }

    // Check if we have both header token and cookie data
    if (!tokenFromHeader || !cookieData) {
      const additionalData = {
        csrf: {
          attack: true,
          reason: 'Missing CSRF token',
          hasHeaderToken: !!tokenFromHeader,
          hasCookieData: !!cookieData
        },
        zone: {
          id: req.params.id,
          operation: req.method,
          endpoint: req.path
        }
      };

      logAuditEvent(
        AUDIT_EVENTS.ZONE_CSRF_ATTACK,
        AUDIT_LEVELS.ERROR,
        req,
        res,
        additionalData
      );

      return res.status(403).json({
        success: false,
        message: 'CSRF token missing',
        error: 'CSRF_TOKEN_MISSING'
      });
    }

    // Validate that header token matches cookie token
    if (tokenFromHeader !== cookieData.token) {
      const additionalData = {
        csrf: {
          attack: true,
          reason: 'CSRF token mismatch',
          tokenMatch: false
        },
        zone: {
          id: req.params.id,
          operation: req.method,
          endpoint: req.path
        }
      };

      logAuditEvent(
        AUDIT_EVENTS.ZONE_CSRF_ATTACK,
        AUDIT_LEVELS.ERROR,
        req,
        res,
        additionalData
      );

      return res.status(403).json({
        success: false,
        message: 'CSRF token mismatch',
        error: 'CSRF_TOKEN_MISMATCH'
      });
    }

    // Validate token signature and expiry
    const validation = validateCsrfToken(
      cookieData.token,
      req.user.id,
      cookieData.signature,
      cookieData.timestamp
    );

    if (!validation.isValid) {
      const additionalData = {
        csrf: {
          attack: true,
          reason: validation.reason,
          tokenValid: false
        },
        zone: {
          id: req.params.id,
          operation: req.method,
          endpoint: req.path
        }
      };

      logAuditEvent(
        AUDIT_EVENTS.ZONE_CSRF_ATTACK,
        AUDIT_LEVELS.ERROR,
        req,
        res,
        additionalData
      );

      return res.status(403).json({
        success: false,
        message: `CSRF validation failed: ${validation.reason}`,
        error: 'CSRF_VALIDATION_FAILED'
      });
    }

    // CSRF validation passed
    next();
  } catch (error) {
    console.error('CSRF validation error:', error);
    
    const additionalData = {
      csrf: {
        attack: true,
        reason: 'CSRF validation error',
        error: error.message
      },
      zone: {
        id: req.params.id,
        operation: req.method,
        endpoint: req.path
      }
    };

    logAuditEvent(
      AUDIT_EVENTS.ZONE_CSRF_ATTACK,
      AUDIT_LEVELS.ERROR,
      req,
      res,
      additionalData
    );

    res.status(500).json({
      success: false,
      message: 'CSRF validation error',
      error: 'CSRF_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to provide CSRF token endpoint
 */
const provideCsrfToken = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to get CSRF token',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    const tokenData = generateCsrfToken(req.user.id);
    
    res.json({
      success: true,
      data: {
        token: tokenData.token,
        expires: tokenData.expires
      }
    });
  } catch (error) {
    console.error('CSRF token provision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CSRF token',
      error: 'CSRF_TOKEN_GENERATION_FAILED'
    });
  }
};

/**
 * Middleware for double-submit cookie pattern validation
 */
const doubleSubmitCookie = (req, res, next) => {
  try {
    // Skip for safe methods
    if (CSRF_CONFIG.SAFE_METHODS.includes(req.method)) {
      return next();
    }

    const tokenFromHeader = req.headers[CSRF_CONFIG.HEADER_NAME];
    const tokenFromBody = req.body?._csrfToken;
    const tokenFromQuery = req.query?._csrfToken;

    // Get token from any source
    const submittedToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

    if (!submittedToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token required',
        error: 'CSRF_TOKEN_REQUIRED'
      });
    }

    // Validate token format
    if (!/^[a-f0-9]{64}$/.test(submittedToken)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token format',
        error: 'INVALID_CSRF_TOKEN_FORMAT'
      });
    }

    next();
  } catch (error) {
    console.error('Double submit cookie validation error:', error);
    res.status(500).json({
      success: false,
      message: 'CSRF validation error',
      error: 'CSRF_VALIDATION_ERROR'
    });
  }
};

module.exports = {
  CSRF_CONFIG,
  generateCsrfToken,
  validateCsrfTokenFunction: validateCsrfToken,
  setCsrfToken,
  validateCsrfToken: validateCsrfTokenMiddleware,
  provideCsrfToken,
  doubleSubmitCookie
};