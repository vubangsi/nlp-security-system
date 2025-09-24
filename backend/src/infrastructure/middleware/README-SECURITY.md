# Zone Security Implementation Documentation

## Overview

This document describes the comprehensive security implementation for the zone-based security management feature. The implementation includes multiple layers of security controls to protect against various attack vectors and ensure compliance with security best practices.

## Security Architecture

### 1. Role-Based Access Control (RBAC)

**File:** `zonePermissions.js`

**Permissions Matrix:**
- `zone:read` - View zone information
- `zone:write` - Modify zone data
- `zone:arm_disarm` - Arm/disarm zones
- `zone:admin` - Full administrative access
- `zone:hierarchy` - Manage zone hierarchy

**Role Assignments:**
- **Regular Users:** Read zones, arm/disarm owned zones
- **Admin Users:** Full CRUD operations, hierarchy management
- **System:** Internal operations, event publishing

**Features:**
- Granular permission checking
- Zone ownership validation
- Hierarchy depth limits (max 5 levels)
- Circular reference prevention

### 2. Input Validation & Sanitization

**File:** `zoneValidation.js`

**Validation Rules:**
- Zone names: Alphanumeric, spaces, hyphens, underscores only (1-100 chars)
- Zone descriptions: Max 200 characters, HTML/script stripped
- Zone IDs: UUID/alphanumeric format validation
- Parent zone validation: Prevents circular references
- Query parameter validation

**Security Features:**
- XSS prevention through input sanitization
- SQL injection protection
- Script injection detection
- Dangerous pattern filtering

### 3. Rate Limiting

**File:** `zoneRateLimit.js`

**Rate Limits:**
- Zone Read Operations: 60 requests/minute
- Zone Modifications: 10 requests/minute
- Arm/Disarm Operations: 20 requests/minute
- Hierarchy Operations: 5 requests/minute

**Advanced Features:**
- Per-user rate limiting
- Role-based adaptive limits (admin: 5x, system: 10x)
- Burst protection (5 requests in 10 seconds)
- IP-based fallback for unauthenticated requests

### 4. Audit Logging

**File:** `zoneAuditLogger.js`

**Logged Events:**
- All CRUD operations
- Zone state changes (arm/disarm)
- Hierarchy modifications
- Access control events
- Security violations
- Suspicious activity

**Log Levels:**
- INFO: Normal operations
- WARN: Security events
- ERROR: Security violations
- CRITICAL: System threats

**Security Features:**
- Comprehensive audit trail
- Security event correlation
- Suspicious pattern detection
- Separate security audit log

### 5. CSRF Protection

**File:** `zoneCsrfProtection.js`

**Implementation:**
- Custom CSRF token generation
- HMAC signature validation
- Double-submit cookie pattern
- Timing-safe comparison
- Token expiry (24 hours)

**Security Features:**
- Prevents cross-site request forgery
- Secure token generation (32-byte random)
- Attack detection and logging
- Token replay protection

### 6. Security Headers

**File:** `securityHeaders.js`

**Headers Applied:**
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer Policy
- Permissions Policy

**Additional Features:**
- Response integrity hashing
- Sensitive data headers
- Browser security controls
- CORS security headers

## API Security Matrix

| Endpoint | Rate Limit | CSRF | Validation | Audit | Permissions |
|----------|------------|------|------------|-------|-------------|
| GET /zones | Read | No | Query | Yes | zone:read |
| GET /zones/:id | Read | No | ID | Yes | zone:read |
| POST /zones | Modify | Yes | Full | Yes | zone:admin |
| PUT /zones/:id | Modify | Yes | Full | Yes | zone:admin |
| DELETE /zones/:id | Modify | Yes | ID | Yes | zone:admin |
| POST /zones/:id/arm | Arm/Disarm | Yes | ID | Yes | zone:arm_disarm |
| POST /zones/:id/disarm | Arm/Disarm | Yes | ID | Yes | zone:arm_disarm |
| GET /zones/:id/hierarchy | Read | No | ID | Yes | zone:read |
| PUT /zones/:id/parent | Hierarchy | Yes | Full | Yes | zone:hierarchy |

## Security Controls

### Input Validation
- Sanitization using DOMPurify
- Pattern matching validation
- Length restrictions
- Type checking
- Dangerous content filtering

### Authorization
- JWT token validation
- Role-based permissions
- Zone ownership checks
- Operation-specific authorization
- Hierarchy permission validation

### Data Protection
- Response integrity hashing
- Sensitive data headers
- Cache control for security
- Content type validation
- Cross-origin protection

### Monitoring & Alerting
- Real-time security event logging
- Suspicious activity detection
- Rate limit violation tracking
- Access control audit trail
- Attack pattern recognition

## Threat Mitigation

### Cross-Site Scripting (XSS)
- Input sanitization
- Content Security Policy
- Output encoding
- Script injection detection

### Cross-Site Request Forgery (CSRF)
- Custom CSRF tokens
- Double-submit cookies
- SameSite cookie attributes
- Origin validation

### SQL Injection
- Input validation
- Parameterized queries
- Special character filtering
- Pattern detection

### Privilege Escalation
- Role-based access control
- Permission validation
- Zone ownership checks
- Admin-only operations

### Denial of Service (DoS)
- Rate limiting
- Burst protection
- Request size limits
- Connection throttling

### Data Exposure
- Sensitive data headers
- Response sanitization
- Cache control
- Access logging

## Configuration

### Environment Variables
```bash
# CSRF Protection
CSRF_SECRET=your-csrf-secret-key

# JWT Authentication
JWT_SECRET=your-jwt-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Security Headers
SECURITY_HEADERS_ENABLED=true
CSP_REPORT_URI=/api/security/csp-report
```

### Security Middleware Stack

Each zone endpoint applies the following middleware in order:

1. **Security Headers** - Basic browser protection
2. **Burst Protection** - Rapid request detection
3. **Suspicious Activity** - Pattern monitoring
4. **Rate Limiting** - Request throttling
5. **Authentication** - User verification
6. **Authorization** - Permission checking
7. **Input Validation** - Data sanitization
8. **CSRF Protection** - State-changing operations
9. **Audit Logging** - Security event tracking
10. **Access Control** - Fine-grained permissions

## Monitoring

### Log Files
- `logs/zone-audit.log` - General audit events
- `logs/zone-security-audit.log` - Security-specific events

### Metrics Tracked
- Request rates per user/IP
- Failed authentication attempts
- Permission denied events
- Validation failures
- CSRF attack attempts
- Suspicious activity patterns

### Alerting Thresholds
- Rate limit violations: 3+ in 1 minute
- Failed auth attempts: 5+ in 5 minutes
- CSRF attacks: Any occurrence
- Suspicious patterns: Any detection
- Privilege escalation: Any attempt

## Compliance

### Security Standards
- OWASP Top 10 protection
- Defense in depth architecture
- Principle of least privilege
- Secure by default configuration

### Audit Requirements
- Comprehensive logging
- Immutable audit trail
- User action tracking
- Security event correlation
- Compliance reporting

## Testing

### Security Test Coverage
- Input validation testing
- Authentication bypass attempts
- Authorization escalation tests
- CSRF protection validation
- Rate limiting verification
- XSS injection testing

### Penetration Testing
- Automated security scanning
- Manual security testing
- Vulnerability assessments
- Security code review
- Threat modeling validation

## Maintenance

### Security Updates
- Regular dependency updates
- Security patch monitoring
- Vulnerability scanning
- Configuration reviews
- Policy updates

### Performance Monitoring
- Rate limiting effectiveness
- Validation performance
- Audit log management
- Security overhead tracking
- Resource utilization

This security implementation provides comprehensive protection for the zone management system while maintaining usability and performance.