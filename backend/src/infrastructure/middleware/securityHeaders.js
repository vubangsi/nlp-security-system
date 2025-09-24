/**
 * Security Headers Middleware
 * 
 * Comprehensive security headers implementation for zone endpoints
 * Protects against various web security vulnerabilities
 */

const helmet = require('helmet');

/**
 * Security headers configuration
 */
const SECURITY_CONFIG = {
  // Content Security Policy
  CSP: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ["allow-forms", "allow-scripts", "allow-same-origin"],
      reportUri: "/api/security/csp-report"
    },
    reportOnly: process.env.NODE_ENV !== 'production'
  },

  // HTTP Strict Transport Security
  HSTS: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Frame-Options
  FRAME_OPTIONS: 'DENY',

  // X-Content-Type-Options
  CONTENT_TYPE_OPTIONS: 'nosniff',

  // Referrer Policy
  REFERRER_POLICY: 'strict-origin-when-cross-origin',

  // Permissions Policy
  PERMISSIONS_POLICY: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    fullscreen: ["'self'"]
  }
};

/**
 * Apply comprehensive security headers using Helmet
 */
const applyHelmetSecurity = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: SECURITY_CONFIG.CSP.directives,
    reportOnly: SECURITY_CONFIG.CSP.reportOnly
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: SECURITY_CONFIG.HSTS.maxAge,
    includeSubDomains: SECURITY_CONFIG.HSTS.includeSubDomains,
    preload: SECURITY_CONFIG.HSTS.preload
  },

  // X-Frame-Options
  frameguard: {
    action: SECURITY_CONFIG.FRAME_OPTIONS.toLowerCase()
  },

  // X-Content-Type-Options
  noSniff: true,

  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: {
    policy: SECURITY_CONFIG.REFERRER_POLICY
  },

  // Remove X-Powered-By header
  hidePoweredBy: true,

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // Expect-CT (deprecated but included for compatibility)
  expectCt: {
    maxAge: 86400, // 24 hours
    enforce: process.env.NODE_ENV === 'production'
  }
});

/**
 * Custom security headers middleware for zone-specific security
 */
const zoneSecurityHeaders = (req, res, next) => {
  try {
    // Zone-specific security headers
    res.setHeader('X-Zone-Security-Version', '1.0');
    res.setHeader('X-Zone-Request-ID', req.headers['x-request-id'] || 'unknown');
    
    // Additional security headers for zone operations
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Duration', '30'); // Cache duration in seconds
    
    // Permissions Policy (replacement for Feature Policy)
    const permissionsPolicy = Object.entries(SECURITY_CONFIG.PERMISSIONS_POLICY)
      .map(([feature, allowlist]) => {
        const allowedOrigins = allowlist.length > 0 ? allowlist.join(' ') : '()';
        return `${feature}=${allowedOrigins}`;
      })
      .join(', ');
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // Cross-Origin policies
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Cache control for security-sensitive operations
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  } catch (error) {
    console.error('Zone security headers error:', error);
    next();
  }
};

/**
 * Security headers for API responses containing sensitive zone data
 */
const sensitiveDataHeaders = (req, res, next) => {
  // Store original res.json to add security headers to JSON responses
  const originalJson = res.json;
  
  res.json = function(data) {
    // Add security headers for sensitive data
    if (data && (data.data || data.zones || data.zone)) {
      this.setHeader('X-Sensitive-Data', 'true');
      this.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      this.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    }

    // Add integrity hash for critical responses
    if (data && data.success && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) {
      const responseHash = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
      this.setHeader('X-Response-Integrity', responseHash);
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Rate limiting headers
 */
const rateLimitHeaders = (windowMs, maxRequests) => {
  return (req, res, next) => {
    // Add rate limiting information headers
    res.setHeader('X-RateLimit-Window', Math.ceil(windowMs / 1000));
    res.setHeader('X-RateLimit-Limit', maxRequests);
    
    // These will be set by the rate limiting middleware
    const remaining = res.getHeader('X-RateLimit-Remaining');
    const reset = res.getHeader('X-RateLimit-Reset');
    
    if (remaining !== undefined) {
      res.setHeader('X-RateLimit-Policy', `${maxRequests};w=${Math.ceil(windowMs / 1000)}`);
    }

    next();
  };
};

/**
 * Security headers for CORS preflight requests
 */
const corsSecurityHeaders = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Additional security headers for CORS preflight
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    
    // Restrict allowed headers for zone operations
    const allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'X-Zone-Operation'
    ];
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    
    // Restrict allowed methods
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  }

  next();
};

/**
 * Content type validation headers
 */
const contentTypeValidation = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      res.setHeader('X-Content-Type-Error', 'Invalid content type');
      return res.status(400).json({
        success: false,
        message: 'Content-Type must be application/json',
        error: 'INVALID_CONTENT_TYPE'
      });
    }
  }

  next();
};

/**
 * Security headers for file upload operations (if implemented)
 */
const fileUploadSecurityHeaders = (req, res, next) => {
  if (req.files || req.file) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('Content-Disposition', 'attachment');
  }

  next();
};

/**
 * Anti-clickjacking headers for zone administration
 */
const antiClickjackingHeaders = (req, res, next) => {
  // More restrictive frame options for admin operations
  if (req.user && req.user.role === 'admin') {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  }

  next();
};

/**
 * Browser security headers
 */
const browserSecurityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Disable client-side caching for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Prevent page from being embedded in frames
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS filtering in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
};

/**
 * Comprehensive security headers middleware combining all security measures
 */
const applyAllSecurityHeaders = [
  applyHelmetSecurity,
  zoneSecurityHeaders,
  sensitiveDataHeaders,
  corsSecurityHeaders,
  contentTypeValidation,
  antiClickjackingHeaders,
  browserSecurityHeaders
];

module.exports = {
  SECURITY_CONFIG,
  applyHelmetSecurity,
  zoneSecurityHeaders,
  sensitiveDataHeaders,
  rateLimitHeaders,
  corsSecurityHeaders,
  contentTypeValidation,
  fileUploadSecurityHeaders,
  antiClickjackingHeaders,
  browserSecurityHeaders,
  applyAllSecurityHeaders
};