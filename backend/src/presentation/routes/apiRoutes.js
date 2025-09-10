const express = require('express');
const { authMiddleware, adminOnly } = require('../../infrastructure/middleware/authMiddleware');

const router = express.Router();

// Health check
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Dependency injection will be done in app.js
let authController, commandController, systemController, userController;

const setControllers = (controllers) => {
  authController = controllers.authController;
  commandController = controllers.commandController;
  systemController = controllers.systemController;
  userController = controllers.userController;
};

// Auth routes
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Command routes (authenticated users)
router.post('/command', authMiddleware, (req, res, next) => 
  commandController.processCommand(req, res, next)
);

// User routes (admin only)
router.post('/users', authMiddleware, adminOnly, (req, res, next) => 
  userController.addUser(req, res, next)
);
router.get('/users', authMiddleware, adminOnly, (req, res, next) => 
  userController.listUsers(req, res, next)
);

// System routes (authenticated users)
router.get('/system/state', authMiddleware, (req, res, next) => 
  systemController.getSystemState(req, res, next)
);
router.get('/system/events', authMiddleware, (req, res, next) => 
  systemController.getEventLogs(req, res, next)
);
router.delete('/system/events', authMiddleware, adminOnly, (req, res, next) => 
  systemController.clearEventLogs(req, res, next)
);

module.exports = { router, setControllers };
