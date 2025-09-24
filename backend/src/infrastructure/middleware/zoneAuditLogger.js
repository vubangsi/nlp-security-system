/**
 * Zone Audit Logging Middleware
 * 
 * Comprehensive audit logging for all zone operations
 * Tracks security events, access attempts, and system changes
 */

const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

/**
 * Audit event types for zone operations
 */
const AUDIT_EVENTS = {
  // Zone CRUD operations
  ZONE_CREATED: 'zone.created',
  ZONE_READ: 'zone.read',
  ZONE_UPDATED: 'zone.updated',
  ZONE_DELETED: 'zone.deleted',
  
  // Zone state operations
  ZONE_ARMED: 'zone.armed',
  ZONE_DISARMED: 'zone.disarmed',
  
  // Zone hierarchy operations
  ZONE_HIERARCHY_VIEWED: 'zone.hierarchy.viewed',
  ZONE_PARENT_CHANGED: 'zone.parent.changed',
  ZONE_HIERARCHY_VALIDATED: 'zone.hierarchy.validated',
  
  // Zone access and security events
  ZONE_ACCESS_GRANTED: 'zone.access.granted',
  ZONE_ACCESS_DENIED: 'zone.access.denied',
  ZONE_UNAUTHORIZED_ACCESS: 'zone.unauthorized.access',
  ZONE_PERMISSION_DENIED: 'zone.permission.denied',
  
  // Zone listing and querying
  ZONES_LISTED: 'zones.listed',
  ZONES_FILTERED: 'zones.filtered',
  
  // Security events
  ZONE_RATE_LIMIT_HIT: 'zone.rate_limit.hit',
  ZONE_VALIDATION_FAILED: 'zone.validation.failed',
  ZONE_CSRF_ATTACK: 'zone.csrf.attack',
  ZONE_SUSPICIOUS_ACTIVITY: 'zone.suspicious.activity'
};

/**
 * Audit severity levels
 */
const AUDIT_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Create audit logger instance
 */
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'zone-security-audit' },
  transports: [
    // File transport for audit logs
    new winston.transports.File({ 
      filename: 'logs/zone-audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // Console transport for development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

/**
 * Security audit logger for critical events
 */
const securityAuditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'zone-security-alerts' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/zone-security-audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 20,
      tailable: true
    })
  ]
});

/**
 * Extract client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
const extractClientInfo = (req) => {
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    forwardedFor: req.get('X-Forwarded-For'),
    realIp: req.get('X-Real-IP')
  };
};

/**
 * Create audit entry for zone operation
 * @param {string} eventType - Type of audit event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} additionalData - Additional audit data
 * @returns {Object} Audit entry
 */
const createAuditEntry = (eventType, req, res, additionalData = {}) => {
  const auditEntry = {
    auditId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType,
    
    // User information
    user: {
      id: req.user?.id,
      role: req.user?.role,
      username: req.user?.username
    },
    
    // Request information
    request: {
      method: req.method,
      path: req.path,
      url: req.url,
      params: req.params,
      query: req.query,
      headers: {
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    },
    
    // Response information
    response: {
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length')
    },
    
    // Client information
    client: extractClientInfo(req),
    
    // Session information
    session: {
      id: req.sessionID,
      isAuthenticated: !!req.user
    },
    
    // Additional data
    ...additionalData
  };

  return auditEntry;
};

/**
 * Log audit event
 * @param {string} eventType - Type of audit event
 * @param {string} level - Log level
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} additionalData - Additional audit data
 */
const logAuditEvent = (eventType, level, req, res, additionalData = {}) => {
  const auditEntry = createAuditEntry(eventType, req, res, additionalData);
  
  // Log to appropriate logger based on severity
  if (level === AUDIT_LEVELS.CRITICAL || level === AUDIT_LEVELS.ERROR) {
    securityAuditLogger.log(level, 'Zone security audit event', auditEntry);
  }
  
  auditLogger.log(level, `Zone audit: ${eventType}`, auditEntry);
};

/**
 * Middleware to audit zone operations
 * @param {string} eventType - Type of operation being audited
 * @param {string} level - Audit level (default: info)
 * @returns {Function} Express middleware function
 */
const auditZoneOperation = (eventType, level = AUDIT_LEVELS.INFO) => {
  return (req, res, next) => {
    // Store original res.json to capture response data
    const originalJson = res.json;
    let responseData = null;

    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Store original res.end to log when response is complete
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      // Log the audit event
      const additionalData = {
        zone: {
          id: req.params.id,
          name: req.body?.name,
          parentId: req.body?.parentZoneId || req.params.parentId
        },
        operation: {
          type: eventType,
          success: res.statusCode >= 200 && res.statusCode < 400,
          errorCode: responseData?.error,
          message: responseData?.message
        },
        performance: {
          processingTime: Date.now() - req.startTime
        }
      };

      logAuditEvent(eventType, level, req, res, additionalData);
      
      return originalEnd.call(this, chunk, encoding);
    };

    // Set start time for performance tracking
    req.startTime = Date.now();
    
    next();
  };
};

/**
 * Middleware to audit security events
 * @param {string} eventType - Type of security event
 * @param {Object} securityContext - Security context information
 * @returns {Function} Express middleware function
 */
const auditSecurityEvent = (eventType, securityContext = {}) => {
  return (req, res, next) => {
    const additionalData = {
      security: {
        eventType,
        threat: securityContext.threat || 'unknown',
        riskLevel: securityContext.riskLevel || 'low',
        mitigationAction: securityContext.mitigation || 'logged',
        ...securityContext
      },
      zone: {
        id: req.params.id,
        operation: req.method,
        endpoint: req.path
      }
    };

    logAuditEvent(eventType, AUDIT_LEVELS.WARN, req, res, additionalData);
    next();
  };
};

/**
 * Middleware to audit access control events
 */
const auditAccessControl = () => {
  return (req, res, next) => {
    // Store original next function to catch authorization failures
    const originalNext = next;
    
    next = (error) => {
      if (error) {
        let eventType = AUDIT_EVENTS.ZONE_ACCESS_DENIED;
        let level = AUDIT_LEVELS.WARN;
        
        // Determine event type based on error
        if (error.message && error.message.includes('permission')) {
          eventType = AUDIT_EVENTS.ZONE_PERMISSION_DENIED;
        } else if (error.message && error.message.includes('unauthorized')) {
          eventType = AUDIT_EVENTS.ZONE_UNAUTHORIZED_ACCESS;
          level = AUDIT_LEVELS.ERROR;
        }

        const additionalData = {
          accessControl: {
            denied: true,
            reason: error.message,
            requiredPermission: req.zonePermission?.permission,
            userPermissions: req.zonePermission?.allPermissions
          },
          zone: {
            id: req.params.id,
            operation: req.method
          }
        };

        logAuditEvent(eventType, level, req, res, additionalData);
      } else {
        // Log successful access
        const additionalData = {
          accessControl: {
            granted: true,
            permission: req.zonePermission?.permission,
            userRole: req.user?.role
          },
          zone: {
            id: req.params.id,
            operation: req.method
          }
        };

        logAuditEvent(AUDIT_EVENTS.ZONE_ACCESS_GRANTED, AUDIT_LEVELS.INFO, req, res, additionalData);
      }
      
      return originalNext(error);
    };

    next();
  };
};

/**
 * Middleware to detect and audit suspicious activity
 */
const auditSuspiciousActivity = () => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b)/i,
    // XSS patterns
    /<script|javascript:|vbscript:|onload=|onerror=/i,
    // Path traversal patterns
    /\.\.[\/\\]/,
    // Command injection patterns
    /[;&|`$(){}]/
  ];

  return (req, res, next) => {
    const requestData = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        const additionalData = {
          suspicious: {
            pattern: pattern.toString(),
            matchedData: requestData.substring(0, 500), // Limit size
            riskLevel: 'high'
          },
          zone: {
            id: req.params.id,
            operation: req.method,
            endpoint: req.path
          }
        };

        logAuditEvent(
          AUDIT_EVENTS.ZONE_SUSPICIOUS_ACTIVITY, 
          AUDIT_LEVELS.ERROR, 
          req, 
          res, 
          additionalData
        );

        // Don't block the request, just log it
        break;
      }
    }

    next();
  };
};

module.exports = {
  AUDIT_EVENTS,
  AUDIT_LEVELS,
  auditLogger,
  securityAuditLogger,
  auditZoneOperation,
  auditSecurityEvent,
  auditAccessControl,
  auditSuspiciousActivity,
  logAuditEvent,
  createAuditEntry
};