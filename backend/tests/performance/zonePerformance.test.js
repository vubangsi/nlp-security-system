const request = require('supertest');
const app = require('../../src/app');

describe('Zone Performance Tests', () => {
  let authToken;
  let userId;
  let testZoneIds = [];

  beforeAll(async () => {
    // Setup: Create a test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Performance Test User',
        pin: '9999',
        role: 'admin'
      });

    if (userResponse.status === 201 || userResponse.status === 409) {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ pin: '9999' });

      authToken = loginResponse.body.token;
      userId = loginResponse.body.user.id;
    }
  });

  afterAll(async () => {
    // Cleanup: Delete all test zones
    const deletePromises = testZoneIds.map(id =>
      request(app)
        .delete(`/api/zones/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {}) // Ignore errors during cleanup
    );
    
    await Promise.allSettled(deletePromises);
  });

  describe('Zone Creation Performance', () => {
    test('should create zones efficiently under normal load', async () => {
      const startTime = Date.now();
      const numberOfZones = 10;
      const promises = [];

      for (let i = 0; i < numberOfZones; i++) {
        promises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Performance Zone ${i}`,
              description: `Zone ${i} for performance testing`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      const successfulResponses = responses.filter(r => r.status === 201);
      expect(successfulResponses.length).toBe(numberOfZones);

      // Store IDs for cleanup
      testZoneIds.push(...successfulResponses.map(r => r.body.data.id));

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 zones
      
      // Average response time should be reasonable
      const avgResponseTime = duration / numberOfZones;
      expect(avgResponseTime).toBeLessThan(500); // 500ms per zone
    }, 10000);

    test('should handle concurrent zone creation efficiently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 5;
      const promises = [];

      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Concurrent Zone ${Date.now()}-${i}`,
              description: `Concurrent zone ${i}`
            })
        );
      }

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResponses = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      
      // Most requests should succeed
      expect(successfulResponses.length).toBeGreaterThanOrEqual(concurrentRequests - 1);

      // Store IDs for cleanup
      testZoneIds.push(...successfulResponses.map(r => r.value.body.data.id));

      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(3000); // 3 seconds for 5 concurrent requests
    }, 10000);

    test('should maintain performance with complex zone data', async () => {
      const complexZoneData = {
        name: 'Complex Performance Zone',
        description: 'A'.repeat(200), // Maximum allowed description length
        parentZoneId: null
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(complexZoneData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(1000); // 1 second for complex data

      testZoneIds.push(response.body.data.id);
    });
  });

  describe('Zone Retrieval Performance', () => {
    beforeAll(async () => {
      // Create test zones for retrieval testing
      const createPromises = [];
      for (let i = 0; i < 20; i++) {
        createPromises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Retrieval Test Zone ${i}`,
              description: `Zone ${i} for retrieval testing`
            })
        );
      }

      const responses = await Promise.all(createPromises);
      const newZoneIds = responses
        .filter(r => r.status === 201)
        .map(r => r.body.data.id);
      
      testZoneIds.push(...newZoneIds);
    });

    test('should list zones efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(duration).toBeLessThan(1000); // 1 second for listing zones
    });

    test('should retrieve individual zones efficiently', async () => {
      if (testZoneIds.length === 0) return;

      const startTime = Date.now();
      const promises = [];

      // Test retrieving multiple zones concurrently
      for (let i = 0; i < Math.min(5, testZoneIds.length); i++) {
        promises.push(
          request(app)
            .get(`/api/zones/${testZoneIds[i]}`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All retrievals should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(Math.min(5, testZoneIds.length));

      // Should complete quickly
      expect(duration).toBeLessThan(2000); // 2 seconds for 5 concurrent retrievals
    });

    test('should handle filtered zone queries efficiently', async () => {
      const filters = [
        '?armed=false',
        '?parentId=root',
        '?limit=10',
        '?includeHierarchy=true'
      ];

      for (const filter of filters) {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/zones${filter}`)
          .set('Authorization', `Bearer ${authToken}`);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(1000); // 1 second per filtered query
      }
    });
  });

  describe('Zone State Change Performance', () => {
    let armedZoneIds = [];

    beforeAll(async () => {
      // Create zones specifically for state change testing
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `State Change Zone ${i}`,
              description: `Zone ${i} for state change testing`
            })
        );
      }

      const responses = await Promise.all(createPromises);
      armedZoneIds = responses
        .filter(r => r.status === 201)
        .map(r => r.body.data.id);
      
      testZoneIds.push(...armedZoneIds);
    });

    test('should arm zones efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      for (const zoneId of armedZoneIds) {
        promises.push(
          request(app)
            .post(`/api/zones/${zoneId}/arm`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(armedZoneIds.length);

      // Should complete efficiently
      expect(duration).toBeLessThan(3000); // 3 seconds for multiple arm operations
      
      const avgResponseTime = duration / armedZoneIds.length;
      expect(avgResponseTime).toBeLessThan(300); // 300ms per arm operation
    });

    test('should disarm zones efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      for (const zoneId of armedZoneIds) {
        promises.push(
          request(app)
            .post(`/api/zones/${zoneId}/disarm`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(armedZoneIds.length);

      // Should complete efficiently
      expect(duration).toBeLessThan(3000); // 3 seconds for multiple disarm operations
    });

    test('should handle rapid state changes', async () => {
      if (armedZoneIds.length === 0) return;

      const zoneId = armedZoneIds[0];
      const operations = [];

      // Rapid arm/disarm operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          request(app)
            .post(`/api/zones/${zoneId}/arm`)
            .set('Authorization', `Bearer ${authToken}`)
        );
        operations.push(
          request(app)
            .post(`/api/zones/${zoneId}/disarm`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle rapid state changes without errors
      expect(duration).toBeLessThan(5000); // 5 seconds for rapid state changes
      
      // Should handle race conditions gracefully
      const errors = responses.filter(r => r.status === 'rejected');
      expect(errors.length).toBe(0);
    });
  });

  describe('Zone Update Performance', () => {
    let updateZoneIds = [];

    beforeAll(async () => {
      // Create zones for update testing
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Update Test Zone ${i}`,
              description: `Zone ${i} for update testing`
            })
        );
      }

      const responses = await Promise.all(createPromises);
      updateZoneIds = responses
        .filter(r => r.status === 201)
        .map(r => r.body.data.id);
      
      testZoneIds.push(...updateZoneIds);
    });

    test('should update zones efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < updateZoneIds.length; i++) {
        promises.push(
          request(app)
            .put(`/api/zones/${updateZoneIds[i]}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Updated Zone ${i}`,
              description: `Updated description ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(updateZoneIds.length);

      expect(duration).toBeLessThan(2000); // 2 seconds for multiple updates
    });

    test('should handle partial updates efficiently', async () => {
      if (updateZoneIds.length === 0) return;

      const zoneId = updateZoneIds[0];
      const updates = [
        { name: 'New Name Only' },
        { description: 'New description only' },
        { name: 'Both Name', description: 'Both description' }
      ];

      for (const update of updates) {
        const startTime = Date.now();

        const response = await request(app)
          .put(`/api/zones/${zoneId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(update);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(500); // 500ms per partial update
      }
    });
  });

  describe('Zone Hierarchy Performance', () => {
    let hierarchyZoneIds = [];
    let parentZoneId;

    beforeAll(async () => {
      // Create parent zone
      const parentResponse = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Hierarchy Parent Zone',
          description: 'Parent zone for hierarchy testing'
        });

      parentZoneId = parentResponse.body.data.id;
      testZoneIds.push(parentZoneId);

      // Create child zones
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          request(app)
            .post('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Hierarchy Child Zone ${i}`,
              description: `Child zone ${i}`,
              parentZoneId: parentZoneId
            })
        );
      }

      const responses = await Promise.all(createPromises);
      hierarchyZoneIds = responses
        .filter(r => r.status === 201)
        .map(r => r.body.data.id);
      
      testZoneIds.push(...hierarchyZoneIds);
    });

    test('should retrieve zone hierarchy efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/zones/${parentZoneId}/hierarchy`)
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // 1 second for hierarchy retrieval
    });

    test('should filter by parent efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/zones?parentId=${parentZoneId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(hierarchyZoneIds.length);
      expect(duration).toBeLessThan(800); // 800ms for parent filtering
    });

    test('should move zones in hierarchy efficiently', async () => {
      if (hierarchyZoneIds.length < 2) return;

      const sourceZoneId = hierarchyZoneIds[0];
      const targetParentId = hierarchyZoneIds[1];

      const startTime = Date.now();

      const response = await request(app)
        .put(`/api/zones/${sourceZoneId}/parent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parentZoneId: targetParentId
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect([200, 409]).toContain(response.status); // 409 if circular reference prevented
      expect(duration).toBeLessThan(1000); // 1 second for hierarchy move
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should handle large zone datasets efficiently', async () => {
      const largeDatasetSize = 50;
      const batchSize = 10;
      const batches = Math.ceil(largeDatasetSize / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = [];
        const startTime = Date.now();

        for (let i = 0; i < batchSize && (batch * batchSize + i) < largeDatasetSize; i++) {
          const zoneIndex = batch * batchSize + i;
          batchPromises.push(
            request(app)
              .post('/api/zones')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                name: `Large Dataset Zone ${zoneIndex}`,
                description: `Zone ${zoneIndex} for large dataset testing`
              })
          );
        }

        const responses = await Promise.all(batchPromises);
        const endTime = Date.now();
        const batchDuration = endTime - startTime;

        const successfulResponses = responses.filter(r => r.status === 201);
        testZoneIds.push(...successfulResponses.map(r => r.body.data.id));

        // Each batch should complete within reasonable time
        expect(batchDuration).toBeLessThan(5000); // 5 seconds per batch
      }

      // Verify all zones can be listed efficiently
      const startTime = Date.now();
      const listResponse = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${authToken}`);
      const endTime = Date.now();
      const listDuration = endTime - startTime;

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(largeDatasetSize);
      expect(listDuration).toBeLessThan(2000); // 2 seconds to list large dataset
    }, 60000); // 1 minute timeout for large dataset test

    test('should handle concurrent read operations efficiently', async () => {
      const concurrentReads = 20;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentReads; i++) {
        promises.push(
          request(app)
            .get('/api/zones')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(concurrentReads);

      // Concurrent reads should be handled efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds for 20 concurrent reads
    });
  });

  describe('Stress Testing', () => {
    test('should maintain performance under sustained load', async () => {
      const sustainedOperations = 30;
      const operationTypes = ['create', 'read', 'update'];
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < sustainedOperations; i++) {
        const operationType = operationTypes[i % operationTypes.length];

        switch (operationType) {
          case 'create':
            promises.push(
              request(app)
                .post('/api/zones')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                  name: `Stress Test Zone ${i}`,
                  description: `Stress test zone ${i}`
                })
            );
            break;

          case 'read':
            promises.push(
              request(app)
                .get('/api/zones')
                .set('Authorization', `Bearer ${authToken}`)
            );
            break;

          case 'update':
            if (testZoneIds.length > 0) {
              const randomZoneId = testZoneIds[Math.floor(Math.random() * testZoneIds.length)];
              promises.push(
                request(app)
                  .put(`/api/zones/${randomZoneId}`)
                  .set('Authorization', `Bearer ${authToken}`)
                  .send({
                    description: `Updated during stress test ${i}`
                  })
              );
            }
            break;
        }
      }

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Store new zone IDs for cleanup
      responses.forEach(response => {
        if (response.status === 'fulfilled' && 
            response.value.status === 201 && 
            response.value.body.data?.id) {
          testZoneIds.push(response.value.body.data.id);
        }
      });

      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      );

      // Should handle sustained load effectively
      expect(successfulResponses.length).toBeGreaterThan(sustainedOperations * 0.8); // 80% success rate
      expect(duration).toBeLessThan(15000); // 15 seconds for sustained load

      const avgResponseTime = duration / sustainedOperations;
      expect(avgResponseTime).toBeLessThan(500); // 500ms average response time
    }, 30000); // 30 second timeout for stress test
  });
});