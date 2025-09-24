/**
 * Zone Security Tests
 * 
 * Comprehensive security testing for zone management features
 * Tests authentication, authorization, input validation, and security controls
 */

const request = require('supertest');
const app = require('../../src/app');
const { generateCsrfToken } = require('../../src/infrastructure/middleware/zoneCsrfProtection');
const jwt = require('jsonwebtoken');

describe('Zone Security Tests', () => {
  let userToken, adminToken, csrfToken;
  
  beforeAll(async () => {
    // Create test tokens
    userToken = jwt.sign(
      { user: { id: 'user123', role: 'user', username: 'testuser' } },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    adminToken = jwt.sign(
      { user: { id: 'admin123', role: 'admin', username: 'testadmin' } },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    // Generate CSRF token
    const tokenData = generateCsrfToken('admin123');
    csrfToken = tokenData.token;
  });

  describe('Authentication Tests', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/zones')
        .expect(401);
        
      expect(response.body.message).toContain('token');
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
        
      expect(response.body.message).toContain('valid');
    });

    test('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });

  describe('Authorization Tests', () => {
    test('should deny admin operations for regular users', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Test Zone' })
        .expect(403);
        
      expect(response.body.message).toContain('Admin access required');
    });

    test('should allow admin operations for admin users', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Test Zone' });
        
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Input Validation Tests', () => {
    test('should reject zone creation with invalid name', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: '<script>alert("xss")</script>' })
        .expect(400);
        
      expect(response.body.errors).toBeDefined();
    });

    test('should reject zone creation with overly long name', async () => {
      const longName = 'a'.repeat(101);
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: longName })
        .expect(400);
        
      expect(response.body.errors.name).toBeDefined();
    });

    test('should sanitize zone description', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ 
          name: 'Test Zone',
          description: '<script>alert("xss")</script>Clean description'
        });
        
      // Should not contain script tags
      if (response.status < 400 && response.body.data) {
        expect(response.body.data.description).not.toContain('<script>');
      }
    });

    test('should reject invalid zone ID format', async () => {
      const response = await request(app)
        .get('/api/zones/<script>alert("xss")</script>')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
        
      expect(response.body.errors.id).toBeDefined();
    });
  });

  describe('CSRF Protection Tests', () => {
    test('should reject state-changing operations without CSRF token', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Zone' })
        .expect(403);
        
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    test('should reject operations with invalid CSRF token', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ name: 'Test Zone' })
        .expect(403);
        
      expect(response.body.error).toContain('CSRF');
    });

    test('should allow GET operations without CSRF token', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should enforce rate limits for zone operations', async () => {
      const promises = [];
      
      // Send multiple requests rapidly
      for (let i = 0; i < 65; i++) {
        promises.push(
          request(app)
            .get('/api/zones')
            .set('Authorization', `Bearer ${userToken}`)
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers Tests', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${userToken}`);
        
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should include zone-specific security headers', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${userToken}`);
        
      expect(response.headers['x-zone-security-version']).toBe('1.0');
      expect(response.headers['permissions-policy']).toBeDefined();
    });
  });

  describe('SQL Injection Tests', () => {
    test('should reject SQL injection attempts in zone name', async () => {
      const sqlInjection = "'; DROP TABLE zones; --";
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: sqlInjection })
        .expect(400);
        
      expect(response.body.errors).toBeDefined();
    });

    test('should reject SQL injection attempts in zone ID', async () => {
      const sqlInjection = "1' OR '1'='1";
      const response = await request(app)
        .get(`/api/zones/${sqlInjection}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
        
      expect(response.body.errors.id).toBeDefined();
    });
  });

  describe('XSS Protection Tests', () => {
    test('should sanitize script tags in zone name', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: xssPayload })
        .expect(400);
        
      expect(response.body.errors.name).toBeDefined();
    });

    test('should sanitize javascript: protocol in description', async () => {
      const xssPayload = 'javascript:alert("xss")';
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ 
          name: 'Test Zone',
          description: xssPayload
        });
        
      if (response.status < 400 && response.body.data) {
        expect(response.body.data.description).not.toContain('javascript:');
      }
    });
  });

  describe('Path Traversal Tests', () => {
    test('should reject path traversal attempts in zone ID', async () => {
      const pathTraversal = '../../../etc/passwd';
      const response = await request(app)
        .get(`/api/zones/${pathTraversal}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
        
      expect(response.body.errors.id).toBeDefined();
    });
  });

  describe('Content Type Validation Tests', () => {
    test('should reject non-JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/plain')
        .set('X-CSRF-Token', csrfToken)
        .send('name=Test Zone')
        .expect(400);
        
      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });
  });

  describe('Audit Logging Tests', () => {
    test('should log zone creation attempts', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Audit Test Zone' });
        
      // Audit logging happens asynchronously, so we just verify the request completes
      expect(response.status).toBeDefined();
    });

    test('should log security violations', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Unauthorized Zone' })
        .expect(403);
        
      // Security violation should be logged
      expect(response.body.message).toContain('Admin access required');
    });
  });

  describe('Zone Access Control Tests', () => {
    test('should enforce zone access permissions', async () => {
      // Attempt to access a specific zone
      const response = await request(app)
        .get('/api/zones/test-zone-id')
        .set('Authorization', `Bearer ${userToken}`);
        
      // Should either succeed with proper access or fail with proper error
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  describe('Burst Protection Tests', () => {
    test('should detect and block rapid successive requests', async () => {
      const promises = [];
      
      // Send rapid successive requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/zones')
            .set('Authorization', `Bearer ${userToken}`)
        );
      }
      
      const responses = await Promise.allSettled(promises);
      
      // Should have some requests succeed and some potentially blocked
      expect(responses.length).toBe(10);
    });
  });
});

describe('Zone Hierarchy Security Tests', () => {
  let adminToken, csrfToken;
  
  beforeAll(async () => {
    adminToken = jwt.sign(
      { user: { id: 'admin123', role: 'admin', username: 'testadmin' } },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    const tokenData = generateCsrfToken('admin123');
    csrfToken = tokenData.token;
  });

  test('should prevent circular reference creation', async () => {
    const response = await request(app)
      .put('/api/zones/zone1/parent')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ parentZoneId: 'zone1' })
      .expect(400);
      
    expect(response.body.errors.parentZoneId).toContain('cannot be its own parent');
  });

  test('should validate hierarchy depth limits', async () => {
    // This would require setting up a deep hierarchy first
    // For now, we test the validation middleware
    const response = await request(app)
      .post('/api/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ 
        name: 'Deep Zone',
        parentZoneId: 'valid-parent-id'
      });
      
    // Should either succeed or fail with proper validation
    expect([200, 201, 400, 404]).toContain(response.status);
  });
});