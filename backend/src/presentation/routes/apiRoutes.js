const express = require('express');
const { authMiddleware, adminOnly } = require('../../infrastructure/middleware/authMiddleware');

// Zone security middleware
const { 
  requireZonePermission, 
  zonePermissions,
  requireZoneAccess,
  requireZoneOwnership,
  validateHierarchyDepth,
  preventCircularReference
} = require('../../infrastructure/middleware/zonePermissions');

const {
  validateZoneCreation,
  validateZoneUpdate,
  validateZoneIdParam,
  validateZoneParentChange,
  validateZoneQuery
} = require('../../infrastructure/middleware/zoneValidation');

const {
  zoneReadRateLimit,
  zoneModifyRateLimit,
  zoneArmDisarmRateLimit,
  zoneHierarchyRateLimit,
  burstProtection
} = require('../../infrastructure/middleware/zoneRateLimit');

const {
  auditZoneOperation,
  auditAccessControl,
  auditSuspiciousActivity,
  AUDIT_EVENTS
} = require('../../infrastructure/middleware/zoneAuditLogger');

const {
  setCsrfToken,
  validateCsrfToken,
  provideCsrfToken
} = require('../../infrastructure/middleware/zoneCsrfProtection');

const {
  applyAllSecurityHeaders
} = require('../../infrastructure/middleware/securityHeaders');

const router = express.Router();

// Health check
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Dependency injection will be done in app.js
let authController, commandController, systemController, userController, zoneController;

const setControllers = (controllers) => {
  authController = controllers.authController;
  commandController = controllers.commandController;
  systemController = controllers.systemController;
  userController = controllers.userController;
  zoneController = controllers.zoneController;
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

// Apply global security headers to all zone routes
router.use('/zones*', applyAllSecurityHeaders);

// Apply burst protection to all zone routes
router.use('/zones*', burstProtection());

// Apply suspicious activity monitoring to all zone routes
router.use('/zones*', auditSuspiciousActivity());

// CSRF token endpoint
router.get('/zones/csrf-token', 
  authMiddleware,
  setCsrfToken,
  provideCsrfToken
);

// Zone routes (authenticated users)
// GET /api/zones - List all zones with optional filters
router.get('/zones', 
  zoneReadRateLimit,
  authMiddleware,
  requireZonePermission(zonePermissions.READ),
  validateZoneQuery,
  auditZoneOperation(AUDIT_EVENTS.ZONES_LISTED),
  auditAccessControl(),
  (req, res, next) => zoneController.listZones(req, res, next)
);

// GET /api/zones/:id - Get specific zone by ID
router.get('/zones/:id', 
  zoneReadRateLimit,
  authMiddleware,
  validateZoneIdParam,
  requireZonePermission(zonePermissions.READ),
  requireZoneAccess(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_READ),
  auditAccessControl(),
  (req, res, next) => zoneController.getZone(req, res, next)
);

// POST /api/zones - Create new zone (admin only)
router.post('/zones', 
  zoneModifyRateLimit,
  authMiddleware,
  adminOnly,
  validateCsrfToken,
  requireZonePermission(zonePermissions.ADMIN),
  validateZoneCreation,
  validateHierarchyDepth(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_CREATED),
  auditAccessControl(),
  (req, res, next) => zoneController.createZone(req, res, next)
);

// PUT /api/zones/:id - Update zone (admin only)
router.put('/zones/:id', 
  zoneModifyRateLimit,
  authMiddleware,
  validateZoneIdParam,
  adminOnly,
  validateCsrfToken,
  requireZonePermission(zonePermissions.ADMIN),
  requireZoneOwnership(),
  validateZoneUpdate,
  auditZoneOperation(AUDIT_EVENTS.ZONE_UPDATED),
  auditAccessControl(),
  (req, res, next) => zoneController.updateZone(req, res, next)
);

// DELETE /api/zones/:id - Delete zone (admin only)
router.delete('/zones/:id', 
  zoneModifyRateLimit,
  authMiddleware,
  validateZoneIdParam,
  adminOnly,
  validateCsrfToken,
  requireZonePermission(zonePermissions.ADMIN),
  requireZoneOwnership(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_DELETED),
  auditAccessControl(),
  (req, res, next) => zoneController.deleteZone(req, res, next)
);

// POST /api/zones/:id/arm - Arm specific zone
router.post('/zones/:id/arm', 
  zoneArmDisarmRateLimit,
  authMiddleware,
  validateZoneIdParam,
  validateCsrfToken,
  requireZonePermission(zonePermissions.ARM_DISARM),
  requireZoneAccess(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_ARMED),
  auditAccessControl(),
  (req, res, next) => zoneController.armZone(req, res, next)
);

// POST /api/zones/:id/disarm - Disarm specific zone
router.post('/zones/:id/disarm', 
  zoneArmDisarmRateLimit,
  authMiddleware,
  validateZoneIdParam,
  validateCsrfToken,
  requireZonePermission(zonePermissions.ARM_DISARM),
  requireZoneAccess(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_DISARMED),
  auditAccessControl(),
  (req, res, next) => zoneController.disarmZone(req, res, next)
);

// GET /api/zones/:id/hierarchy - Get zone hierarchy
router.get('/zones/:id/hierarchy', 
  zoneReadRateLimit,
  authMiddleware,
  validateZoneIdParam,
  requireZonePermission(zonePermissions.READ),
  requireZoneAccess(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_HIERARCHY_VIEWED),
  auditAccessControl(),
  (req, res, next) => zoneController.getZoneHierarchy(req, res, next)
);

// PUT /api/zones/:id/parent - Change zone parent (admin only)
router.put('/zones/:id/parent', 
  zoneHierarchyRateLimit,
  authMiddleware,
  validateZoneIdParam,
  adminOnly,
  validateCsrfToken,
  requireZonePermission(zonePermissions.HIERARCHY),
  requireZoneOwnership(),
  validateZoneParentChange,
  preventCircularReference(),
  validateHierarchyDepth(),
  auditZoneOperation(AUDIT_EVENTS.ZONE_PARENT_CHANGED),
  auditAccessControl(),
  (req, res, next) => zoneController.changeZoneParent(req, res, next)
);

// GET /api/zones/hierarchy/validate - Validate zone hierarchy integrity (admin only)
router.get('/zones/hierarchy/validate', 
  zoneReadRateLimit,
  authMiddleware,
  adminOnly,
  requireZonePermission(zonePermissions.ADMIN),
  auditZoneOperation(AUDIT_EVENTS.ZONE_HIERARCHY_VALIDATED),
  auditAccessControl(),
  (req, res, next) => zoneController.validateHierarchy(req, res, next)
);

module.exports = { router, setControllers };
