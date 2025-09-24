const request = require('supertest');
const app = require('../../src/app');

describe('Zone API Integration Tests', () => {
  let authToken;
  let userId;
  let createdZoneId;

  beforeAll(async () => {
    // Setup: Create a test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        pin: '1234',
        role: 'admin'
      });

    if (userResponse.status === 201) {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          pin: '1234'
        });

      authToken = loginResponse.body.token;
      userId = loginResponse.body.user.id;
    } else {
      // User might already exist, try to login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          pin: '1234'
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.token;
        userId = loginResponse.body.user.id;
      }
    }
  });

  describe('POST /api/zones', () => {
    test('should create a new zone successfully', async () => {
      const zoneData = {
        name: 'Test Zone',
        description: 'A test zone for integration testing'
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(zoneData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(zoneData.name);
      expect(response.body.data.description).toBe(zoneData.description);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.armed).toBe(false);
      expect(response.body.data.parentZoneId).toBeNull();

      createdZoneId = response.body.data.id;
    });

    test('should return 400 for missing zone name', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Zone without name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('name');
    });

    test('should return 401 for unauthorized request', async () => {
      const response = await request(app)
        .post('/api/zones')
        .send({
          name: 'Unauthorized Zone'
        });

      expect(response.status).toBe(401);
    });

    test('should return 409 for duplicate zone name', async () => {
      const zoneData = {
        name: 'Duplicate Zone',
        description: 'First zone'
      };

      // Create first zone
      await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(zoneData);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(zoneData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('GET /api/zones', () => {
    test('should list all zones', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.count).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should filter zones by armed status', async () => {
      const response = await request(app)
        .get('/api/zones?armed=false')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.filteredByArmed).toBe(false);
    });

    test('should limit number of results', async () => {
      const response = await request(app)
        .get('/api/zones?limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.count).toBeLessThanOrEqual(2);
    });

    test('should return 401 for unauthorized request', async () => {
      const response = await request(app)
        .get('/api/zones');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/zones/:id', () => {
    test('should get zone by ID', async () => {
      if (!createdZoneId) {
        // Create a zone if none exists
        const createResponse = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Get Test Zone',
            description: 'Zone for GET testing'
          });
        createdZoneId = createResponse.body.data.id;
      }

      const response = await request(app)
        .get(`/api/zones/${createdZoneId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(createdZoneId);
    });

    test('should return 404 for non-existent zone', async () => {
      const response = await request(app)
        .get('/api/zones/non-existent-zone-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should return 401 for unauthorized request', async () => {
      const response = await request(app)
        .get(`/api/zones/${createdZoneId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/zones/:id', () => {
    test('should update zone successfully', async () => {
      if (!createdZoneId) {
        // Create a zone if none exists
        const createResponse = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Update Test Zone',
            description: 'Zone for update testing'
          });
        createdZoneId = createResponse.body.data.id;
      }

      const updateData = {
        name: 'Updated Zone Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/zones/${createdZoneId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
    });

    test('should return 404 for non-existent zone', async () => {
      const response = await request(app)
        .put('/api/zones/non-existent-zone-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .put(`/api/zones/${createdZoneId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // No update fields

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/zones/:id/arm', () => {
    test('should arm zone successfully', async () => {
      if (!createdZoneId) {
        // Create a zone if none exists
        const createResponse = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Arm Test Zone',
            description: 'Zone for arm testing'
          });
        createdZoneId = createResponse.body.data.id;
      }

      const response = await request(app)
        .post(`/api/zones/${createdZoneId}/arm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.armed).toBe(true);
      expect(response.body.message).toContain('armed');
    });

    test('should return 409 for already armed zone', async () => {
      // First arm the zone
      await request(app)
        .post(`/api/zones/${createdZoneId}/arm`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to arm again
      const response = await request(app)
        .post(`/api/zones/${createdZoneId}/arm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already armed');
    });

    test('should return 404 for non-existent zone', async () => {
      const response = await request(app)
        .post('/api/zones/non-existent-zone-id/arm')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/zones/:id/disarm', () => {
    test('should disarm zone successfully', async () => {
      // Ensure zone is armed first
      await request(app)
        .post(`/api/zones/${createdZoneId}/arm`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .post(`/api/zones/${createdZoneId}/disarm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.armed).toBe(false);
      expect(response.body.message).toContain('disarmed');
    });

    test('should return 409 for already disarmed zone', async () => {
      // Ensure zone is disarmed
      await request(app)
        .post(`/api/zones/${createdZoneId}/disarm`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to disarm again
      const response = await request(app)
        .post(`/api/zones/${createdZoneId}/disarm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already disarmed');
    });
  });

  describe('DELETE /api/zones/:id', () => {
    test('should delete zone successfully', async () => {
      // Create a zone specifically for deletion
      const createResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Delete Test Zone',
          description: 'Zone for deletion testing'
        });

      const zoneToDelete = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/zones/${zoneToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify zone is actually deleted
      const getResponse = await request(app)
        .get(`/api/zones/${zoneToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    test('should return 404 for non-existent zone', async () => {
      const response = await request(app)
        .delete('/api/zones/non-existent-zone-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Zone Hierarchy Operations', () => {
    let parentZoneId;
    let childZoneId;

    beforeAll(async () => {
      // Create parent zone
      const parentResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Parent Zone',
          description: 'Parent zone for hierarchy testing'
        });
      parentZoneId = parentResponse.body.data.id;

      // Create child zone
      const childResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Child Zone',
          description: 'Child zone for hierarchy testing',
          parentZoneId: parentZoneId
        });
      childZoneId = childResponse.body.data.id;
    });

    test('should create zone with parent successfully', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Another Child Zone',
          description: 'Another child zone',
          parentZoneId: parentZoneId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parentZoneId).toBe(parentZoneId);
    });

    test('should get zone hierarchy', async () => {
      const response = await request(app)
        .get(`/api/zones/${parentZoneId}/hierarchy`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should filter zones by parent ID', async () => {
      const response = await request(app)
        .get(`/api/zones?parentId=${parentZoneId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.parentZoneId).toBe(parentZoneId);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // All returned zones should have the specified parent
      response.body.data.forEach(zone => {
        expect(zone.parentZoneId).toBe(parentZoneId);
      });
    });

    test('should change zone parent', async () => {
      // Create a new parent zone
      const newParentResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Parent Zone',
          description: 'New parent for hierarchy testing'
        });
      const newParentId = newParentResponse.body.data.id;

      const response = await request(app)
        .put(`/api/zones/${childZoneId}/parent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parentZoneId: newParentId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parentZoneId).toBe(newParentId);
    });

    test('should prevent circular hierarchy', async () => {
      const response = await request(app)
        .put(`/api/zones/${parentZoneId}/parent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parentZoneId: childZoneId // Try to make parent a child of its own child
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should validate zone name format', async () => {
      const invalidNames = [
        { name: '', error: 'required' },
        { name: 'a'.repeat(101), error: 'too long' },
        { name: 'Invalid@Name', error: 'invalid characters' }
      ];

      for (const { name, error } of invalidNames) {
        const response = await request(app)
          .post('/api/zones')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should sanitize input data', async () => {
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '  Test Zone  ', // Leading/trailing spaces
          description: '<script>alert("xss")</script>Safe Description'
        });

      if (response.status === 201) {
        expect(response.body.data.name).toBe('Test Zone'); // Should be trimmed
        expect(response.body.data.description).not.toContain('<script>'); // Should be sanitized
      }
    });

    test('should handle large description', async () => {
      const longDescription = 'A'.repeat(501);
      
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Long Description Zone',
          description: longDescription
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Concurrent Zone ${i}`,
              description: `Zone created concurrently ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed with unique zone IDs
      const successfulResponses = responses.filter(r => r.status === 201);
      expect(successfulResponses.length).toBe(5);
      
      const zoneIds = successfulResponses.map(r => r.body.data.id);
      const uniqueIds = new Set(zoneIds);
      expect(uniqueIds.size).toBe(zoneIds.length);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple zone operations efficiently', async () => {
      const startTime = Date.now();
      
      // Create multiple zones
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Performance Zone ${i}`,
              description: `Performance test zone ${i}`
            })
        );
      }
      
      const createResponses = await Promise.all(createPromises);
      const zoneIds = createResponses.map(r => r.body.data.id);
      
      // Get all zones
      await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Arm all zones
      const armPromises = zoneIds.map(id =>
        request(app)
          .post(`/api/zones/${id}/arm`)
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      await Promise.all(armPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    }, 10000); // Increase timeout for this test

    test('should handle large zone list requests', async () => {
      const response = await request(app)
        .get('/api/zones?limit=1000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should respond quickly even with large limit
      expect(response.headers['content-length']).toBeDefined();
    });
  });
});