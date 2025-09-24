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

// Schedule management middleware
const {
  validateScheduleIdParam,
  validateScheduleCreation,
  validateScheduleUpdate,
  validateScheduleQuery,
  validateBulkScheduleCreation,
  validateBulkScheduleDeletion,
  validateScheduleExpressionTest,
  validateUpcomingSchedulesQuery
} = require('../../infrastructure/middleware/scheduleValidation');

const {
  scheduleReadRateLimit,
  scheduleCreateRateLimit,
  scheduleModifyRateLimit,
  scheduleBulkRateLimit,
  scheduleTestRateLimit,
  scheduleAdminRateLimit,
  scheduleBurstProtection
} = require('../../infrastructure/middleware/scheduleRateLimit');

const router = express.Router();

// Health check
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Dependency injection will be done in app.js
let authController, commandController, systemController, userController, zoneController, scheduleController;

const setControllers = (controllers) => {
  authController = controllers.authController;
  commandController = controllers.commandController;
  systemController = controllers.systemController;
  userController = controllers.userController;
  zoneController = controllers.zoneController;
  scheduleController = controllers.scheduleController;
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

// ========================================
// SCHEDULE MANAGEMENT ROUTES
// ========================================

// Apply global security headers and burst protection to all schedule routes
router.use('/schedules*', applyAllSecurityHeaders);
router.use('/schedules*', scheduleBurstProtection());

// POST /api/schedules - Create new scheduled task
router.post('/schedules',
  scheduleCreateRateLimit,
  authMiddleware,
  validateCsrfToken,
  validateScheduleCreation,
  (req, res, next) => scheduleController.createSchedule(req, res, next)
);

// GET /api/schedules - List user's scheduled tasks with filtering and pagination
router.get('/schedules',
  scheduleReadRateLimit,
  authMiddleware,
  validateScheduleQuery,
  (req, res, next) => scheduleController.listSchedules(req, res, next)
);

// GET /api/schedules/statistics - Get user's schedule statistics
router.get('/schedules/statistics',
  scheduleReadRateLimit,
  authMiddleware,
  (req, res, next) => scheduleController.getStatistics(req, res, next)
);

// GET /api/schedules/upcoming - Get upcoming schedule executions
router.get('/schedules/upcoming',
  scheduleReadRateLimit,
  authMiddleware,
  validateUpcomingSchedulesQuery,
  (req, res, next) => scheduleController.getUpcoming(req, res, next)
);

// POST /api/schedules/test - Test schedule expression parsing
router.post('/schedules/test',
  scheduleTestRateLimit,
  authMiddleware,
  validateScheduleExpressionTest,
  (req, res, next) => scheduleController.testScheduleExpression(req, res, next)
);

// POST /api/schedules/bulk - Create multiple schedules
router.post('/schedules/bulk',
  scheduleBulkRateLimit,
  authMiddleware,
  validateCsrfToken,
  validateBulkScheduleCreation,
  (req, res, next) => scheduleController.bulkCreateSchedules(req, res, next)
);

// DELETE /api/schedules/bulk - Cancel multiple schedules
router.delete('/schedules/bulk',
  scheduleBulkRateLimit,
  authMiddleware,
  validateCsrfToken,
  validateBulkScheduleDeletion,
  (req, res, next) => scheduleController.bulkDeleteSchedules(req, res, next)
);

// PUT /api/schedules/bulk - Update multiple schedules
router.put('/schedules/bulk',
  scheduleBulkRateLimit,
  authMiddleware,
  validateCsrfToken,
  (req, res, next) => scheduleController.bulkUpdateSchedules(req, res, next)
);

// GET /api/schedules/:id - Get specific scheduled task details
router.get('/schedules/:id',
  scheduleReadRateLimit,
  authMiddleware,
  validateScheduleIdParam,
  (req, res, next) => scheduleController.getSchedule(req, res, next)
);

// PUT /api/schedules/:id - Update existing scheduled task
router.put('/schedules/:id',
  scheduleModifyRateLimit,
  authMiddleware,
  validateScheduleIdParam,
  validateCsrfToken,
  validateScheduleUpdate,
  (req, res, next) => scheduleController.updateSchedule(req, res, next)
);

// DELETE /api/schedules/:id - Cancel/delete scheduled task
router.delete('/schedules/:id',
  scheduleModifyRateLimit,
  authMiddleware,
  validateScheduleIdParam,
  validateCsrfToken,
  (req, res, next) => scheduleController.deleteSchedule(req, res, next)
);

// ========================================
// ADMINISTRATIVE SCHEDULE ROUTES
// ========================================

// GET /api/admin/schedules - Admin view of all schedules
router.get('/admin/schedules',
  scheduleAdminRateLimit,
  authMiddleware,
  adminOnly,
  validateScheduleQuery,
  (req, res, next) => scheduleController.listSchedules(req, res, next)
);

// POST /api/admin/schedules/execute/:id - Manually execute schedule
router.post('/admin/schedules/execute/:id',
  scheduleAdminRateLimit,
  authMiddleware,
  adminOnly,
  validateScheduleIdParam,
  validateCsrfToken,
  (req, res, next) => scheduleController.executeSchedule(req, res, next)
);

// GET /api/admin/schedules/health - Scheduler health status
router.get('/admin/schedules/health',
  scheduleAdminRateLimit,
  authMiddleware,
  adminOnly,
  (req, res, next) => scheduleController.getSchedulerHealth(req, res, next)
);

// GET /api/admin/schedules/statistics - System-wide schedule statistics
router.get('/admin/schedules/statistics',
  scheduleAdminRateLimit,
  authMiddleware,
  adminOnly,
  (req, res, next) => scheduleController.getStatistics(req, res, next)
);

module.exports = { router, setControllers };
