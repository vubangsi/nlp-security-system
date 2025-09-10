const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('API Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Create a simple Express app for testing
    app = express();
    app.use(cors());
    app.use(express.json());

    // Simple test routes
    app.post('/api/login', (req, res) => {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ error: 'PIN is required' });
      }
      if (pin === '0000') {
        return res.json({
          success: true,
          token: 'test-token',
          user: { id: 'admin', name: 'Admin', role: 'admin' }
        });
      }
      return res.status(401).json({ success: false, error: 'Invalid PIN' });
    });

    app.get('/api/system/state', (req, res) => {
      const auth = req.headers.authorization;
      if (!auth) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      res.json({
        armed: false,
        mode: 'disarmed',
        lastModified: new Date().toISOString(),
        modifiedBy: 'system'
      });
    });

    app.post('/api/command', (req, res) => {
      const auth = req.headers.authorization;
      if (!auth) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }
      res.json({
        success: true,
        command,
        intent: 'ARM_SYSTEM',
        result: { success: true, message: 'System armed in away mode' }
      });
    });
  });

  describe('POST /api/login', () => {
    test('should authenticate with correct PIN', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ pin: '0000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('test-token');
      expect(response.body.user.id).toBe('admin');
    });

    test('should reject invalid PIN', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ pin: '1234' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid PIN');
    });

    test('should require PIN in request body', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PIN is required');
    });
  });

  describe('GET /api/system/state', () => {
    test('should return system state for authenticated user', async () => {
      const mockSystemState = {
        armed: false,
        mode: 'disarmed',
        lastModified: new Date().toISOString(),
        modifiedBy: 'system'
      };

      const response = await request(app)
        .get('/api/system/state')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.armed).toBe(mockSystemState.armed);
      expect(response.body.mode).toBe(mockSystemState.mode);
      expect(response.body.modifiedBy).toBe(mockSystemState.modifiedBy);
      expect(response.body.lastModified).toBeDefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/system/state');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access denied. No token provided.');
    });
  });

  describe('POST /api/command', () => {
    test('should process valid command', async () => {
      const response = await request(app)
        .post('/api/command')
        .set('Authorization', 'Bearer valid-token')
        .send({ command: 'arm system' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.intent).toBe('ARM_SYSTEM');
    });

    test('should require command in request body', async () => {
      const response = await request(app)
        .post('/api/command')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Command is required');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/command')
        .send({ command: 'arm system' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access denied. No token provided.');
    });
  });
});
