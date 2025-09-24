# Security Remediation Implementation Guide
## Critical Security Fixes for Scheduled System Arming Feature

**Priority:** CRITICAL  
**Implementation Timeline:** Immediate (within 24-48 hours)  
**Impact:** Production security vulnerabilities  

---

## 🚨 CRITICAL FIX 1: JWT Secret Security

### Current Vulnerability
```javascript
// app.js:38-40 - REMOVE THESE LINES
console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Using default'}`);
console.log(`👤 Admin PIN: ${process.env.ADMIN_PIN || '0000'}`);
```

### Secure Implementation
```javascript
// app.js - Replace with secure secret management
const crypto = require('crypto');

// Secure JWT secret handling
const getJWTSecret = () => {
  if (!process.env.JWT_SECRET) {
    console.error('🔐 SECURITY ERROR: JWT_SECRET environment variable not set');
    console.error('🔐 Generating random secret for this session');
    return crypto.randomBytes(64).toString('hex');
  }
  
  // Validate secret strength
  if (process.env.JWT_SECRET.length < 32) {
    console.error('🔐 SECURITY WARNING: JWT_SECRET should be at least 32 characters');
  }
  
  return process.env.JWT_SECRET;
};

const JWT_SECRET = getJWTSecret();

// Secure admin PIN validation
const validateAdminPin = () => {
  const adminPin = process.env.ADMIN_PIN;
  
  if (!adminPin || adminPin === '0000' || adminPin.length < 6) {
    console.error('👤 SECURITY ERROR: Admin PIN must be set and at least 6 characters');
    console.error('👤 Current PIN is weak or using default');
    process.exit(1);
  }
  
  // Check PIN complexity
  if (!/^(?=.*\d)(?=.*[a-zA-Z]).{6,}$/.test(adminPin)) {
    console.error('👤 SECURITY WARNING: Admin PIN should contain letters and numbers');
  }
  
  console.log('👤 Admin PIN: Configured securely');
};

validateAdminPin();
```

---

## 🚨 CRITICAL FIX 2: CORS Security Configuration

### Current Vulnerability
```javascript
// app.js:22 - REPLACE THIS LINE
app.use(cors());
```

### Secure Implementation
```javascript
// app.js - Implement secure CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

---

## 🚨 CRITICAL FIX 3: NLP Command Injection Prevention

### Create New Security Middleware
**File:** `/infrastructure/middleware/nlpSecurity.js`
```javascript
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

/**
 * NLP Command Security Middleware
 * Sanitizes and validates natural language commands before processing
 */

const sanitizeNLPCommand = (req, res, next) => {
  if (!req.body.command) {
    return next();
  }

  try {
    let command = req.body.command;
    
    // Basic type validation
    if (typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Command must be a string',
        code: 'INVALID_COMMAND_TYPE'
      });
    }

    // Length validation
    if (command.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Command too long (max 500 characters)',
        code: 'COMMAND_TOO_LONG'
      });
    }

    // Remove HTML and script content
    command = DOMPurify.sanitize(command, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // Remove dangerous patterns
    const dangerousPatterns = [
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<script/gi,
      /<\/script>/gi,
      /eval\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        console.warn(`🚫 Blocked dangerous pattern in command: ${command}`);
        return res.status(400).json({
          success: false,
          error: 'Command contains invalid content',
          code: 'INVALID_COMMAND_CONTENT'
        });
      }
    }

    // Character whitelist validation
    if (!/^[a-zA-Z0-9\s\-_:,\.\?!]+$/.test(command)) {
      return res.status(400).json({
        success: false,
        error: 'Command contains invalid characters',
        code: 'INVALID_CHARACTERS'
      });
    }

    // Normalize whitespace
    command = command.trim().replace(/\s+/g, ' ');
    
    // Update request with sanitized command
    req.body.command = command;
    
    // Log security event
    console.log(`🔍 NLP Command sanitized: ${command.substring(0, 50)}...`);
    
    next();
    
  } catch (error) {
    console.error('NLP Security middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Command processing error',
      code: 'COMMAND_PROCESSING_ERROR'
    });
  }
};

const rateLimitNLPCommands = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 commands per minute per IP
  message: {
    success: false,
    error: 'Too many command requests, please slow down',
    code: 'NLP_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `nlp_${req.ip}_${req.user.id}` : `nlp_${req.ip}`;
  }
});

module.exports = {
  sanitizeNLPCommand,
  rateLimitNLPCommands
};
```

### Update Routes with NLP Security
**File:** `/presentation/routes/apiRoutes.js`
```javascript
// Add at top
const { sanitizeNLPCommand, rateLimitNLPCommands } = require('../../infrastructure/middleware/nlpSecurity');

// Update command route
router.post('/command', 
  rateLimitNLPCommands,
  authMiddleware, 
  sanitizeNLPCommand,
  (req, res, next) => commandController.processCommand(req, res, next)
);
```

---

## 🚨 CRITICAL FIX 4: Enhanced Authentication Service

### Update Authentication Service
**File:** `/domain/services/AuthenticationService.js`
```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthenticationService {
  constructor(jwtSecret, refreshSecret) {
    this.jwtSecret = jwtSecret;
    this.refreshSecret = refreshSecret || crypto.randomBytes(64).toString('hex');
    this.blacklistedTokens = new Set(); // In production, use Redis
    this.failedAttempts = new Map(); // In production, use Redis
  }

  // Enhanced token generation with refresh tokens
  generateTokens(user) {
    // Short-lived access token
    const accessToken = jwt.sign(
      { 
        user: {
          id: user.id,
          role: user.role,
          name: user.name
        },
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      }, 
      this.jwtSecret, 
      { expiresIn: '15m' }
    );
    
    // Long-lived refresh token
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      this.refreshSecret,
      { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
  }

  // Enhanced token verification
  verifyToken(token) {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  // Refresh token verification
  verifyRefreshToken(refreshToken) {
    try {
      if (this.blacklistedTokens.has(refreshToken)) {
        throw new Error('Refresh token has been revoked');
      }

      const decoded = jwt.verify(refreshToken, this.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  // Enhanced authentication with brute force protection
  authenticateUser(user, inputPin, clientIP) {
    const attemptKey = `${clientIP}:${user?.id || 'unknown'}`;
    
    // Check for brute force attempts
    const attempts = this.failedAttempts.get(attemptKey) || { count: 0, lockUntil: 0 };
    
    // Check if locked
    if (attempts.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
      throw new Error(`Account locked due to too many failed attempts. Try again in ${remainingTime} seconds.`);
    }

    if (!user) {
      this.recordFailedAttempt(attemptKey);
      throw new Error('User not found');
    }

    if (!user.validatePin(inputPin)) {
      this.recordFailedAttempt(attemptKey);
      throw new Error('Invalid PIN');
    }

    // Reset failed attempts on successful login
    this.failedAttempts.delete(attemptKey);
    
    // Generate tokens
    return this.generateTokens(user);
  }

  // Record failed authentication attempts
  recordFailedAttempt(attemptKey) {
    const attempts = this.failedAttempts.get(attemptKey) || { count: 0, lockUntil: 0 };
    attempts.count += 1;

    // Lock account after 5 failed attempts for 15 minutes
    if (attempts.count >= 5) {
      attempts.lockUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
      console.warn(`🔒 Account locked due to failed attempts: ${attemptKey}`);
    }

    this.failedAttempts.set(attemptKey, attempts);
  }

  // Token revocation
  revokeToken(token) {
    this.blacklistedTokens.add(token);
    console.log('🚫 Token revoked');
  }

  // Refresh access token
  refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Here you would fetch the user from database
      // For now, creating minimal user object
      const user = {
        id: decoded.userId,
        // You would fetch role and name from database
      };
      
      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Unable to refresh token');
    }
  }
}

module.exports = AuthenticationService;
```

---

## 🚨 CRITICAL FIX 5: Request Size and Security Limits

### Update Main Application Configuration
**File:** `/app.js`
```javascript
require('dotenv').config({ path: __dirname + '/../../.env' });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');

// Infrastructure
const DIContainer = require('./infrastructure/container/DIContainer');
const { router: apiRoutes, setControllers } = require('./presentation/routes/apiRoutes');
const errorHandler = require('./infrastructure/middleware/errorHandler');

// Security middleware
const securityMiddleware = require('./infrastructure/middleware/globalSecurity');

// Initialize DI Container
const container = new DIContainer();
setControllers(container.getControllers());

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'nonce-{{nonce}}'"],
      scriptSrc: ["'self'", "'nonce-{{nonce}}'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    },
    reportOnly: false
  }
}));

// Request size limits
app.use(bodyParser.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    // Verify JSON structure isn't too complex
    try {
      const parsed = JSON.parse(buf);
      if (JSON.stringify(parsed).length > 1000000) { // 1MB limit
        throw new Error('Request too large');
      }
    } catch (e) {
      // Let bodyParser handle parsing errors
    }
  }
}));

app.use(bodyParser.urlencoded({ 
  extended: true, 
  limit: '1mb'
}));

// CORS configuration (see CRITICAL FIX 2 above)
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000'
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
};

app.use(cors(corsOptions));

// Global security middleware
app.use(securityMiddleware);

// Routes
app.use('/api', apiRoutes);

// Enhanced error handling
app.use(errorHandler);

// Server startup
const PORT = process.env.PORT || 3001;

// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET', 'ADMIN_PIN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`🚨 CRITICAL: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 Security Control Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Security: Enhanced security measures active`);
});

module.exports = app;
```

---

## 🚨 CRITICAL FIX 6: Global Security Middleware

### Create Global Security Middleware
**File:** `/infrastructure/middleware/globalSecurity.js`
```javascript
const rateLimit = require('express-rate-limit');
const validator = require('validator');

// Global rate limiting
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Parameter pollution protection
const parameterPollutionProtection = (req, res, next) => {
  // Check query parameters
  for (const param in req.query) {
    if (Array.isArray(req.query[param]) && req.query[param].length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Too many parameter values',
        code: 'PARAMETER_POLLUTION'
      });
    }
  }
  
  // Check for suspicious patterns
  const queryString = JSON.stringify(req.query);
  if (queryString.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Query string too large',
      code: 'QUERY_TOO_LARGE'
    });
  }
  
  next();
};

// Basic input sanitization
const basicInputSanitization = (req, res, next) => {
  // Sanitize string inputs in body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove null bytes
        req.body[key] = req.body[key].replace(/\0/g, '');
        
        // Validate basic patterns
        if (req.body[key].length > 10000) {
          return res.status(400).json({
            success: false,
            error: `Field ${key} is too long`,
            code: 'FIELD_TOO_LONG'
          });
        }
      }
    }
  }
  
  next();
};

// Security headers
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

// Suspicious activity detection
const suspiciousActivityDetection = (req, res, next) => {
  const suspiciousPatterns = [
    /union.*select/i,
    /script.*alert/i,
    /javascript:/i,
    /vbscript:/i,
    /<script/i,
    /eval\(/i,
    /expression\(/i
  ];
  
  const requestContent = JSON.stringify({
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestContent)) {
      console.warn(`🚨 Suspicious activity detected from ${req.ip}: ${pattern}`);
      
      return res.status(400).json({
        success: false,
        error: 'Request blocked due to security policy',
        code: 'SUSPICIOUS_ACTIVITY'
      });
    }
  }
  
  next();
};

// Combine all middleware
const globalSecurityMiddleware = [
  globalRateLimit,
  securityHeaders,
  parameterPollutionProtection,
  basicInputSanitization,
  suspiciousActivityDetection
];

module.exports = globalSecurityMiddleware;
```

---

## 🔧 ENVIRONMENT CONFIGURATION

### Required Environment Variables
**File:** `.env` (Create if doesn't exist)
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
REFRESH_SECRET=your-super-secure-refresh-secret-different-from-jwt

# Admin Configuration
ADMIN_PIN=SecureAdminPin123!

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Security Configuration
NODE_ENV=production
SECURITY_LOG_LEVEL=warn

# NLP Configuration
GROQ_API_KEY=your-groq-api-key-if-using
```

---

## 🧪 SECURITY TESTING

### Test Script for Critical Fixes
**File:** `security-test.js`
```javascript
const request = require('supertest');
const app = require('./src/app');

describe('Critical Security Tests', () => {
  
  test('Should reject requests without proper CORS origin', async () => {
    const response = await request(app)
      .get('/api/schedules')
      .set('Origin', 'https://malicious-site.com')
      .expect(500); // CORS error
  });
  
  test('Should sanitize NLP commands', async () => {
    const maliciousCommand = '<script>alert("xss")</script>arm system weekdays at 9pm';
    
    const loginResponse = await request(app)
      .post('/api/login')
      .send({ username: 'admin', pin: process.env.ADMIN_PIN });
    
    const token = loginResponse.body.token;
    
    const response = await request(app)
      .post('/api/command')
      .set('Authorization', `Bearer ${token}`)
      .send({ command: maliciousCommand })
      .expect(400);
      
    expect(response.body.code).toBe('INVALID_COMMAND_CONTENT');
  });
  
  test('Should rate limit requests', async () => {
    const requests = [];
    
    // Make 20 rapid requests
    for (let i = 0; i < 20; i++) {
      requests.push(
        request(app)
          .get('/api/healthz')
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
  
  test('Should reject oversized requests', async () => {
    const largePayload = {
      data: 'x'.repeat(2000000) // 2MB
    };
    
    const response = await request(app)
      .post('/api/schedules')
      .send(largePayload)
      .expect(413); // Payload too large
  });
  
});
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Critical Fixes Checklist

- [ ] **Fix 1: JWT Secret Security**
  - [ ] Remove JWT secret from console logs
  - [ ] Implement secure secret validation
  - [ ] Add secret strength requirements
  - [ ] Test token generation with secure secret

- [ ] **Fix 2: CORS Configuration**
  - [ ] Replace permissive CORS with restricted origins
  - [ ] Configure allowed methods and headers
  - [ ] Test cross-origin requests
  - [ ] Verify CORS error handling

- [ ] **Fix 3: NLP Command Injection**
  - [ ] Create NLP security middleware
  - [ ] Implement command sanitization
  - [ ] Add input validation patterns
  - [ ] Test malicious command blocking

- [ ] **Fix 4: Enhanced Authentication**
  - [ ] Implement refresh token mechanism
  - [ ] Add brute force protection
  - [ ] Implement token blacklisting
  - [ ] Test authentication security

- [ ] **Fix 5: Request Security**
  - [ ] Add request size limits
  - [ ] Implement parameter pollution protection
  - [ ] Add global rate limiting
  - [ ] Test security middleware

- [ ] **Fix 6: Environment Security**
  - [ ] Remove sensitive data from logs
  - [ ] Validate required environment variables
  - [ ] Add environment variable validation
  - [ ] Test production configuration

### Testing Checklist

- [ ] **Security Tests**
  - [ ] CORS origin validation
  - [ ] NLP command injection prevention
  - [ ] Rate limiting functionality
  - [ ] Request size limits
  - [ ] Authentication security

- [ ] **Integration Tests**
  - [ ] All endpoints still functional
  - [ ] User authentication flows
  - [ ] Schedule management operations
  - [ ] Admin operations

### Deployment Checklist

- [ ] **Pre-deployment**
  - [ ] All critical fixes implemented
  - [ ] Security tests passing
  - [ ] Environment variables configured
  - [ ] Code review completed

- [ ] **Post-deployment**
  - [ ] Monitor security logs
  - [ ] Verify CORS functionality
  - [ ] Test authentication flows
  - [ ] Confirm rate limiting active

---

## 🚨 URGENT ACTIONS REQUIRED

1. **IMMEDIATE** (Next 2 hours):
   - Remove sensitive data from console logs
   - Implement secure CORS configuration
   - Add basic NLP command sanitization

2. **CRITICAL** (Within 24 hours):
   - Complete enhanced authentication service
   - Implement all request security measures
   - Deploy and test all fixes

3. **ESSENTIAL** (Within 48 hours):
   - Complete security testing
   - Monitor for security events
   - Document all changes

This implementation guide provides step-by-step instructions to address all critical security vulnerabilities identified in the audit. Follow this guide in order, testing each fix before proceeding to the next.